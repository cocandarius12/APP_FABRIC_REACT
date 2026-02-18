import { normalizeText } from './normalizeText';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const COLORS = ['Alb', 'Negru', 'Navy', 'Gri', 'Roșu', 'Verde', 'Albastru'];

const colorMap = {
  'alb': 'Alb', 'albe': 'Alb', 'alba': 'Alb', 'albi': 'Alb', 'white': 'Alb',
  'negru': 'Negru', 'negre': 'Negru', 'neagra': 'Negru', 'negri': 'Negru', 'black': 'Negru',
  'navy': 'Navy',
  'gri': 'Gri', 'gris': 'Gri', 'gray': 'Gri', 'grey': 'Gri',
  'rosu': 'Roșu', 'rosie': 'Roșu', 'rosii': 'Roșu', 'red': 'Roșu',
  'verde': 'Verde', 'verzi': 'Verde', 'green': 'Verde',
  'albastru': 'Albastru', 'albastra': 'Albastru', 'albastri': 'Albastru', 'blue': 'Albastru'
};

/**
 * Builds a fresh orderState from a slice of conversation history
 * Used for deterministic replay during edit operations
 */
export function buildOrderStateFromConversation(conversationSlice) {
  const orderState = {
    product_type: null,
    garment_type: null,
    variants: [],
    budget: null,
    lastQuestion: null,
    activeVariant: null,
    activeVariantLocked: false
  };

  // Replay each message to build state deterministically
  for (const message of conversationSlice) {
    if (message.role === 'user') {
      try {
        const result = parseMessageAndUpdateState(orderState, message.content);
        Object.assign(orderState, result);
      } catch (err) {
        console.warn('[buildOrderState] Failed to parse message:', message, err);
        // Continue processing - don't fail the entire build
      }
    } else if (message.role === 'assistant') {
      // Track last question for context
      orderState.lastQuestion = message.content;
    }
  }

  return orderState;
}

/**
 * Parses a single user message and updates orderState
 * ADDITIVE MERGE: quantities are always added, never replaced
 * Throws only on unrecoverable parse errors
 */
export function parseMessageAndUpdateState(currentState, userMessage) {
  const updatedState = JSON.parse(JSON.stringify(currentState)); // Deep copy
  const msgNorm = normalizeText(userMessage);
  
  const diagnostics = {
    parsedSizes: [],
    parsedColors: [],
    parsedQuantities: {},
    targetVariant: null,
    warnings: []
  };

  // 1) EXTRACT PRODUCT TYPE
  if (!updatedState.product_type) {
    if (/\b(tricou[ri]*|t-shirt)/i.test(userMessage)) {
      updatedState.product_type = 'tricouri';
    } else if (/\bhanorac[e]*/i.test(userMessage)) {
      updatedState.product_type = 'hanorace';
    } else if (/\bpolo/i.test(userMessage)) {
      updatedState.product_type = 'polo';
    }
  }

  // 2) DETERMINE TARGET VARIANT
  let targetVariant = null;
  
  // Check if user explicitly mentions a color (override activeVariant lock)
  const explicitColorMentioned = Object.entries(colorMap).find(([key, value]) => {
    return msgNorm.includes(key) && !updatedState.activeVariantLocked;
  });
  
  // Check for unlock commands
  const unlockCommands = ['schimb', 'vreau altceva', 'reset variant', 'alta culoare'];
  const shouldUnlock = unlockCommands.some(cmd => msgNorm.includes(cmd));
  
  if (shouldUnlock) {
    updatedState.activeVariantLocked = false;
    updatedState.activeVariant = null;
    diagnostics.warnings.push('activeVariantLocked released by user command');
  }

  if (updatedState.activeVariant && updatedState.activeVariantLocked && !explicitColorMentioned) {
    // Use locked active variant
    targetVariant = updatedState.variants.find(v => normalizeText(v.color || '') === normalizeText(updatedState.activeVariant));
    diagnostics.targetVariant = updatedState.activeVariant;
  } else if (updatedState.activeVariant) {
    // Use active variant (not locked)
    targetVariant = updatedState.variants.find(v => normalizeText(v.color || '') === normalizeText(updatedState.activeVariant));
    diagnostics.targetVariant = updatedState.activeVariant;
  } else if (updatedState.variants.length > 0) {
    // Fallback: find first incomplete variant
    targetVariant = updatedState.variants.find(v => 
      Object.keys(v.quantities_per_size || {}).length === 0
    );
    if (targetVariant) {
      updatedState.activeVariant = targetVariant.color;
      diagnostics.targetVariant = targetVariant.color;
    }
  }

  // 3) EXTRACT SIZES WITH QUANTITIES - ADDITIVE MERGE
  const sizeQtyPatterns = [
    /(\d+)\s*(xs|s|m|l|xl|xxl|3xl)\b/gi,
    /\b(xs|s|m|l|xl|xxl|3xl)\s*:?\s*(\d+)/gi,
    /\b(xs|s|m|l|xl|xxl|3xl)(\d+)/gi
  ];
  
  sizeQtyPatterns.forEach(pattern => {
    let matches = [...userMessage.matchAll(pattern)];
    matches.forEach(match => {
      let size, qty;
      
      if (/^\d+$/.test(match[1])) {
        qty = parseInt(match[1]);
        size = match[2].toUpperCase();
      } else {
        size = match[1].toUpperCase();
        qty = parseInt(match[2]);
      }
      
      if (SIZES.includes(size) && qty > 0 && targetVariant) {
        const before = targetVariant.quantities_per_size[size] || 0;
        // ADDITIVE MERGE
        targetVariant.quantities_per_size[size] = before + qty;
        diagnostics.parsedSizes.push(size);
        diagnostics.parsedQuantities[size] = { before, added: qty, after: targetVariant.quantities_per_size[size] };
      }
    });
  });

  // 4) RELATIVE QUANTITY RESOLUTION: "restul XL", "rest L"
  if (targetVariant && targetVariant.total_quantity) {
    const restPatterns = [
      /\b(?:restul|rest)\s+(xs|s|m|l|xl|xxl|3xl)\b/gi,
      /\b(xs|s|m|l|xl|xxl|3xl)\s+(?:restul|rest)\b/gi
    ];
    
    restPatterns.forEach(pattern => {
      const matches = [...msgNorm.matchAll(pattern)];
      matches.forEach(match => {
        const size = match[1].toUpperCase();
        if (SIZES.includes(size)) {
          const currentSum = Object.values(targetVariant.quantities_per_size).reduce((s, q) => s + q, 0);
          const remaining = targetVariant.total_quantity - currentSum;
          
          if (remaining > 0) {
            targetVariant.quantities_per_size[size] = remaining;
            diagnostics.parsedSizes.push(`${size} (rest)`);
            diagnostics.parsedQuantities[size] = { rest: true, value: remaining };
          } else if (remaining < 0) {
            targetVariant.error = 'over_capacity';
            diagnostics.warnings.push(`Cannot assign rest to ${size}: already over capacity`);
            throw new Error(`over_capacity: sum=${currentSum} > total=${targetVariant.total_quantity}`);
          }
        }
      });
    });
  }

  // 5) EXTRACT COLORS AND CREATE VARIANTS
  const detectedVariants = [];
  
  Object.entries(colorMap).forEach(([colorKey, colorValue]) => {
    const colorQtyPattern = new RegExp(`(\\d+)\\s*(?:de)?\\s*(?:tricou[ri]*|hanorac[e]*|polo)?\\s*${colorKey}\\b`, 'gi');
    const matches = [...msgNorm.matchAll(colorQtyPattern)];
    
    matches.forEach(match => {
      const qty = parseInt(match[1]);
      if (qty > 0) {
        const existingVariant = updatedState.variants.find(v => normalizeText(v.color || '') === normalizeText(colorValue));
        if (existingVariant) {
          existingVariant.total_quantity = qty;
        } else {
          detectedVariants.push({
            color: colorValue,
            total_quantity: qty,
            quantities_per_size: {},
            personalization: { enabled: false, technique: null, zone: null },
            isComplete: false,
            error: null
          });
          diagnostics.parsedColors.push(colorValue);
        }
      }
    });
  });
  
  // Extract standalone colors
  Object.entries(colorMap).forEach(([key, value]) => {
    if (msgNorm.includes(key)) {
      const exists = updatedState.variants.find(v => normalizeText(v.color || '') === normalizeText(value)) || 
                    detectedVariants.find(v => normalizeText(v.color || '') === normalizeText(value));
      if (!exists) {
        detectedVariants.push({
          color: value,
          total_quantity: null,
          quantities_per_size: {},
          personalization: { enabled: false, technique: null, zone: null },
          isComplete: false,
          error: null
        });
        diagnostics.parsedColors.push(value);
      }
    }
  });
  
  // Add new variants
  detectedVariants.forEach(newVariant => {
    if (!updatedState.variants.find(v => normalizeText(v.color || '') === normalizeText(newVariant.color))) {
      updatedState.variants.push(newVariant);
    }
  });

  // 6) SHORT ANSWER RESOLUTION
  if (/^\d+$/.test(userMessage.trim()) && currentState.lastQuestion) {
    const qty = parseInt(userMessage.trim());
    const lastQ = normalizeText(currentState.lastQuestion);
    
    let sizeFound = false;
    SIZES.forEach(size => {
      if (lastQ.includes(normalizeText(size)) && targetVariant) {
        const before = targetVariant.quantities_per_size[size] || 0;
        targetVariant.quantities_per_size[size] = before + qty;
        diagnostics.parsedSizes.push(`${size} (short answer)`);
        sizeFound = true;
      }
    });
  }

  // 7) RECALCULATE COMPLETION STATUS PER VARIANT
  updatedState.variants.forEach(variant => {
    const assigned = Object.values(variant.quantities_per_size).reduce((sum, q) => sum + q, 0);
    
    // Auto-set total if not specified
    if (assigned > 0 && !variant.total_quantity) {
      variant.total_quantity = assigned;
    }
    
    // COMPLETION CHECK
    if (variant.total_quantity && assigned > 0) {
      if (assigned === variant.total_quantity) {
        variant.isComplete = true;
        variant.error = null;
        
        // Release lock if this is the active variant
        if (normalizeText(variant.color || '') === normalizeText(updatedState.activeVariant)) {
          updatedState.activeVariantLocked = false;
        }
      } else if (assigned > variant.total_quantity) {
        variant.isComplete = false;
        variant.error = 'over_capacity';
        diagnostics.warnings.push(`Variant ${variant.color}: over_capacity (${assigned}/${variant.total_quantity})`);
      } else {
        variant.isComplete = false;
        variant.error = null;
        variant.remaining = variant.total_quantity - assigned;
      }
    }
  });

  return { ...updatedState, _diagnostics: diagnostics };
}