import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sparkles, ChevronRight, Package, AlertCircle, Zap, Clock, Award, Minus, Plus, X, Eye, Info } from "lucide-react";
import ProductVariantsList from '@/components/product/ProductVariantsList';
import { calculateStrictOffers } from '@/components/pricing/StrictCalculator';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// FEATURE FLAG: Enable chat message editing with audit trail
const ALLOW_CHAT_EDIT = true;

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const COLORS = ['Alb', 'Negru', 'Navy', 'Gri', 'Roșu', 'Verde', 'Albastru'];

export default function CatalogWithQuickQuotePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    delivery_address: '',
    budget: '',
    budget_products: '',
    budget_personalization: '',
    products: [] // [{ product_id, product_name, category, variants: [{ color, sizes: {M: 10}, personalization_zone, personalization_technique }] }]
  });

  // Fetch current user data
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      try {
        return await base44.auth.me();
      } catch {
        return null;
      }
    }
  });

  // Precompletare date utilizator
  useEffect(() => {
    if (currentUser && !formData.client_name && !formData.client_email) {
      setFormData(prev => ({
        ...prev,
        client_name: currentUser.full_name || '',
        client_email: currentUser.email || '',
        client_phone: currentUser.phone || '',
        delivery_address: currentUser.delivery_address || ''
      }));
    }
  }, [currentUser]);

  const [calculationResult, setCalculationResult] = useState(null);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [viewingOffer, setViewingOffer] = useState(null);
  const [aiDescription, setAiDescription] = useState('');
  const [processingAI, setProcessingAI] = useState(false);
  const [aiConversation, setAiConversation] = useState([]);
  const [showProductConfig, setShowProductConfig] = useState(false);
  const [showManualSelection, setShowManualSelection] = useState(false);
  const [contactSectionOpen, setContactSectionOpen] = useState(true);
  const [showBudgetBreakdown, setShowBudgetBreakdown] = useState(false);
  
  // Persistent Order State - survives entire conversation
  // VARIANT-BASED: Each color is a separate variant with own sizes/quantities/personalization
  const [orderState, setOrderState] = useState({
    product_type: null, // tricouri/hanorace/etc
    garment_type: null,
    variants: [], // [{ color, quantities_per_size: {S:10, M:20}, personalization: {enabled, technique, zone} }]
    budget: null,
    lastQuestion: null, // track what was asked last
    activeVariant: null, // which COLOR we're currently configuring (e.g., "Alb", "Negru")
    activeVariantLocked: false // prevents input from applying to other variants until current is complete
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.ProductTemplate.filter({ is_active: true })
  });

  const { data: ateliers = [] } = useQuery({
    queryKey: ['ateliers'],
    queryFn: () => base44.entities.Atelier.filter({ status: 'active' })
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.PersonalizationZone.filter({ is_active: true })
  });

  const createOrderMutation = useMutation({
    mutationFn: (data) => base44.entities.Order.bulkCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['client-orders']);
      toast.success('Comandă plasată cu succes!');
      navigate(createPageUrl('ClientDashboard'));
    },
    onError: () => {
      toast.error('Eroare la plasarea comenzii');
    }
  });

  const addProduct = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const defaultZone = zones.find(z => z.is_active)?.id_zone || '';

    // Check if product already exists
    const existingIndex = formData.products.findIndex(p => p.product_id === productId);

    if (existingIndex >= 0) {
      // Add new variant to existing product
      setFormData(prev => ({
        ...prev,
        products: prev.products.map((p, i) => {
          if (i === existingIndex) {
            return { 
              ...p, 
              variants: [...(p.variants || []), { 
                color: '', 
                sizes: {}, 
                personalization_zone: defaultZone, 
                personalization_technique: defaultZone ? '' : '' // Auto when has personalization
              }] 
            };
          }
          return p;
        })
      }));
      toast.success('Variantă nouă adăugată la produs existent');
    } else {
      setFormData(prev => ({
        ...prev,
        products: [...prev.products, { 
          product_id: productId, 
          product_name: product.name,
          category: product.category,
          variants: [{ 
            color: '', 
            sizes: {}, 
            personalization_zone: defaultZone, 
            personalization_technique: '' // Auto by default
          }]
        }]
      }));
    }
    setShowProductConfig(false);
  };

  const processAIDescription = async () => {
    if (!aiDescription.trim() || products.length === 0) {
      toast.error('Introdu o descriere');
      return;
    }

    console.log('[AI] Starting processAIDescription');
    setProcessingAI(true);
    const userMessage = aiDescription;
    setAiConversation(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiDescription('');

    try {
      console.log('[AI] Preparing prompt...');
      const conversationContext = aiConversation.map(msg => `${msg.role}: ${msg.content}`).join('\n');
      
      // STEP 1: DETERMINISTIC EXTRACTION ENGINE
      const updatedOrderState = { ...orderState }; // Never delete existing values, only merge
      
      console.log('[Parser] Input:', userMessage);
      console.log('[Parser] Current state before parsing:', orderState);
      
      // Normalize function - remove diacritics (DEFENSIVE: handles non-strings)
      const normalize = (text) => {
        if (text === null || text === undefined) return '';
        if (typeof text !== 'string') text = String(text);
        return text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/ă/g, 'a')
          .replace(/â/g, 'a')
          .replace(/î/g, 'i')
          .replace(/ș/g, 's')
          .replace(/ț/g, 't');
      };
      
      const msgNorm = normalize(userMessage);
      
      // 1) EXTRACT PRODUCT TYPE
      if (!updatedOrderState.product_type) {
        if (/\b(tricou[ri]*|t-shirt)/i.test(userMessage)) {
          updatedOrderState.product_type = 'tricouri';
          console.log('[Parser] Extracted product_type: tricouri');
        } else if (/\bhanorac[e]*/i.test(userMessage)) {
          updatedOrderState.product_type = 'hanorace';
          console.log('[Parser] Extracted product_type: hanorace');
        } else if (/\bpolo/i.test(userMessage)) {
          updatedOrderState.product_type = 'polo';
          console.log('[Parser] Extracted product_type: polo');
        }
      }
      
      // 2) EXTRACT SIZES WITH QUANTITIES - APPLY TO ACTIVE VARIANT ONLY
      // Determine target variant using activeVariant pointer
      let targetVariant = null;
      if (updatedOrderState.activeVariant) {
        // Use explicitly active variant
        targetVariant = updatedOrderState.variants.find(v => v.color === updatedOrderState.activeVariant);
        console.log(`[Parser] Active variant: ${updatedOrderState.activeVariant}`, targetVariant ? 'found' : 'NOT FOUND');
      } else if (updatedOrderState.variants.length > 0) {
        // Fallback: find first incomplete variant
        targetVariant = updatedOrderState.variants.find(v => 
          Object.keys(v.quantities_per_size).length === 0
        );
        if (targetVariant) {
          updatedOrderState.activeVariant = targetVariant.color;
          console.log(`[Parser] Auto-selected active variant: ${targetVariant.color}`);
        }
      }
      
      // Patterns: "20 s", "40 xl", "10 M", "15L", "S20", "s:20", "M 10"
      const sizeQtyPatterns = [
        /(\d+)\s*(xs|s|m|l|xl|xxl|3xl)\b/gi,        // "20 s", "10 M"
        /\b(xs|s|m|l|xl|xxl|3xl)\s*:?\s*(\d+)/gi,   // "S:20", "M 10"
        /\b(xs|s|m|l|xl|xxl|3xl)(\d+)/gi            // "S20", "M15"
      ];
      
      sizeQtyPatterns.forEach(pattern => {
        let matches = [...userMessage.matchAll(pattern)];
        matches.forEach(match => {
          let size, qty;
          
          // Determine which group is size vs qty
          if (/^\d+$/.test(match[1])) {
            // First group is number: "20 s"
            qty = parseInt(match[1]);
            size = match[2].toUpperCase();
          } else {
            // First group is size: "S 20" or "S20"
            size = match[1].toUpperCase();
            qty = parseInt(match[2]);
          }
          
          if (SIZES.includes(size) && qty > 0 && targetVariant) {
            // Apply ONLY to active variant
            targetVariant.quantities_per_size[size] = (targetVariant.quantities_per_size[size] || 0) + qty;
            console.log(`[Parser] Added size ${size}=${qty} to ACTIVE variant ${targetVariant.color}`);
          }
        });
      });
      
      // 2b) RELATIVE QUANTITY RESOLUTION: "restul XL", "rest L"
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
              // Calculate remaining quantity
              const currentSum = Object.values(targetVariant.quantities_per_size).reduce((s, q) => s + q, 0);
              const remaining = targetVariant.total_quantity - currentSum;
              
              if (remaining > 0) {
                targetVariant.quantities_per_size[size] = remaining;
                console.log(`[Parser] RELATIVE: "restul ${size}" = ${remaining} (total ${targetVariant.total_quantity} - sum ${currentSum})`);
              } else {
                console.warn(`[Parser] RELATIVE: Cannot assign "restul ${size}", already at capacity (${currentSum} >= ${targetVariant.total_quantity})`);
              }
            }
          });
        });
      }
      
      // 3) EXTRACT COLORS
      const colorMap = {
        'alb': 'Alb', 'albe': 'Alb', 'alba': 'Alb', 'albi': 'Alb', 'white': 'Alb',
        'negru': 'Negru', 'negre': 'Negru', 'neagra': 'Negru', 'negri': 'Negru', 'black': 'Negru',
        'navy': 'Navy',
        'gri': 'Gri', 'gris': 'Gri', 'gray': 'Gri', 'grey': 'Gri',
        'rosu': 'Roșu', 'rosie': 'Roșu', 'rosii': 'Roșu', 'red': 'Roșu',
        'verde': 'Verde', 'verzi': 'Verde', 'green': 'Verde',
        'albastru': 'Albastru', 'albastra': 'Albastru', 'albastri': 'Albastru', 'blue': 'Albastru'
      };
      
      // 4) EXTRACT COLORS AND CREATE VARIANTS
      // Patterns: "30 tricouri rosii", "40 albe", "20 negre", "30 de tricouri albe"
      const detectedVariants = [];
      
      Object.entries(colorMap).forEach(([colorKey, colorValue]) => {
        // Pattern: number + optional "de" + optional product + color
        const colorQtyPattern = new RegExp(`(\\d+)\\s*(?:de)?\\s*(?:tricou[ri]*|hanorac[e]*|polo)?\\s*${colorKey}\\b`, 'gi');
        const matches = [...msgNorm.matchAll(colorQtyPattern)];
        
        matches.forEach(match => {
          const qty = parseInt(match[1]);
          if (qty > 0) {
            // Check if variant already exists
            const existingVariant = updatedOrderState.variants.find(v => v.color === colorValue);
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
            }
            console.log(`[Parser] Extracted color variant: ${colorValue} (total_qty: ${qty})`);
          }
        });
      });
      
      // Extract standalone colors (mentioned but no qty) - create variants without total
      Object.entries(colorMap).forEach(([key, value]) => {
        if (msgNorm.includes(key)) {
          const exists = updatedOrderState.variants.find(v => v.color === value) || 
                        detectedVariants.find(v => v.color === value);
          if (!exists) {
            detectedVariants.push({
              color: value,
              total_quantity: null,
              quantities_per_size: {},
              personalization: { enabled: false, technique: null, zone: null },
              isComplete: false,
              error: null
            });
            console.log(`[Parser] Extracted standalone color variant: ${value}`);
          }
        }
      });
      
      // Add new variants to state
      detectedVariants.forEach(newVariant => {
        if (!updatedOrderState.variants.find(v => v.color === newVariant.color)) {
          updatedOrderState.variants.push(newVariant);
        }
      });
      
      // 5) SHORT ANSWER RESOLUTION - APPLY TO ACTIVE VARIANT ONLY
      if (/^\d+$/.test(userMessage.trim()) && orderState.lastQuestion) {
        const qty = parseInt(userMessage.trim());
        const lastQ = normalize(orderState.lastQuestion);
        
        console.log(`[Parser] Short answer detected: ${qty}, last question was: "${orderState.lastQuestion}"`);
        
        // Use activeVariant pointer
        let targetVariant = updatedOrderState.activeVariant 
          ? updatedOrderState.variants.find(v => v.color === updatedOrderState.activeVariant)
          : updatedOrderState.variants[0];
        
        // Check if question was about a specific size
        let sizeFound = false;
        SIZES.forEach(size => {
          if (lastQ.includes(size.toLowerCase()) && targetVariant) {
            targetVariant.quantities_per_size[size] = (targetVariant.quantities_per_size[size] || 0) + qty;
            console.log(`[Parser] Applied short answer to ACTIVE variant ${targetVariant.color}, size ${size}: ${qty}`);
            sizeFound = true;
          }
        });
      }
      
      // 6) RECALCULATE TOTALS AND CHECK COMPLETION PER VARIANT
      updatedOrderState.variants.forEach(variant => {
        const assigned = Object.values(variant.quantities_per_size).reduce((sum, q) => sum + q, 0);
        
        // Auto-set total if not specified
        if (assigned > 0 && !variant.total_quantity) {
          variant.total_quantity = assigned;
        }
        
        // COMPLETION CHECK - CRITICAL
        if (variant.total_quantity && assigned > 0) {
          if (assigned === variant.total_quantity) {
            variant.isComplete = true;
            console.log(`[Parser] ✅ Variant ${variant.color} COMPLETE: ${assigned}/${variant.total_quantity}`);
          } else if (assigned > variant.total_quantity) {
            variant.isComplete = false;
            variant.error = 'over_capacity';
            console.warn(`[Parser] ⚠️ Variant ${variant.color} OVER: ${assigned}/${variant.total_quantity}`);
          } else {
            variant.isComplete = false;
            variant.error = null;
            console.log(`[Parser] ⏳ Variant ${variant.color} INCOMPLETE: ${assigned}/${variant.total_quantity} (need ${variant.total_quantity - assigned} more)`);
          }
        }
      });
      
      // 8) EXTRACT BUDGET
      if (!updatedOrderState.budget && formData.budget) {
        updatedOrderState.budget = parseFloat(formData.budget);
      }
      
      // 9) SYNC WITH CART (formData.products) - MERGE existing data into variants
      if (formData.products.length > 0) {
        console.log('[Parser] Syncing with cart products...');
        formData.products.forEach(p => {
          if (!updatedOrderState.product_type) {
            updatedOrderState.product_type = p.category;
          }
          if (p.variants) {
            p.variants.forEach(v => {
              if (v.color) {
                // Find or create variant for this color
                let stateVariant = updatedOrderState.variants.find(sv => sv.color === v.color);
                if (!stateVariant) {
                  stateVariant = {
                    color: v.color,
                    total_quantity: null,
                    quantities_per_size: {},
                    personalization: { enabled: false, technique: null, zone: null },
                    isComplete: false,
                    error: null
                  };
                  updatedOrderState.variants.push(stateVariant);
                  console.log(`[Parser] Created variant from cart: ${v.color}`);
                }
                
                // Merge sizes
                Object.entries(v.sizes || {}).forEach(([size, qty]) => {
                  if (qty > 0) {
                    stateVariant.quantities_per_size[size] = (stateVariant.quantities_per_size[size] || 0) + qty;
                    console.log(`[Parser] Merged size to variant ${v.color}: ${size} += ${qty}`);
                  }
                });
                
                // Merge personalization
                if (v.personalization_zone) {
                  stateVariant.personalization.enabled = true;
                  stateVariant.personalization.zone = v.personalization_zone;
                  stateVariant.personalization.technique = v.personalization_technique;
                }
              }
            });
          }
        });
        
        // Recalculate totals per variant
        updatedOrderState.variants.forEach(variant => {
          const variantTotal = Object.values(variant.quantities_per_size).reduce((sum, q) => sum + q, 0);
          if (variantTotal > 0) {
            variant.total_quantity = variantTotal;
          }
        });
      }
      
      // Update state
      setOrderState(updatedOrderState);
      console.log('[Parser] ✅ Final OrderState:', updatedOrderState);
      
      // TRACKING: Build complete current state for AI
      const currentProducts = formData.products.map(p => ({
        name: p.product_name,
        product_id: p.product_id,
        variants: p.variants?.map(v => ({
          color: v.color,
          sizes: v.sizes,
          qty: Object.values(v.sizes || {}).reduce((s, q) => s + q, 0),
          personalization: v.personalization_zone ? 'cu personalizare' : 'fără personalizare',
          zone: v.personalization_zone,
          technique: v.personalization_technique
        }))
      }));
      
      // Generate product summary for AI context
      const productsSummary = currentProducts.map((p, idx) => {
        const totalQty = p.variants.reduce((sum, v) => sum + v.qty, 0);
        const variantDetails = p.variants.map(v => 
          `    - ${v.color}: ${v.qty} buc (${Object.entries(v.sizes).map(([s,q]) => `${s}:${q}`).join(', ')}) ${v.personalization}`
        ).join('\n');
        return `Produs ${idx + 1}: ${p.name} (${totalQty} buc total)\n${variantDetails}`;
      }).join('\n\n');

      const budgetInfo = formData.budget ? `\n\nBUGET DISPONIBIL: ${formData.budget} RON` : '';
      
      // Calculate total quantity already in cart
      const totalInCart = currentProducts.reduce((sum, p) => sum + p.variants.reduce((s, v) => s + v.qty, 0), 0);
      
      // STEP 2: Build PER-VARIANT ORDER STATE summary with COMPLETION LOGIC
      const incompleteVariants = [];
      const completeVariants = [];
      
      updatedOrderState.variants.forEach((variant, idx) => {
        const assigned = Object.values(variant.quantities_per_size).reduce((s, q) => s + q, 0);
        const sizesComplete = variant.isComplete === true; // Use explicit completion flag
        const hasPersonalizationDecision = variant.personalization.enabled !== undefined;
        
        // Variant is fully complete only if BOTH sizes complete AND personalization decided
        const fullyComplete = sizesComplete && hasPersonalizationDecision;
        
        if (!fullyComplete) {
          incompleteVariants.push({ 
            ...variant, 
            index: idx, 
            assigned, 
            remaining: variant.total_quantity ? variant.total_quantity - assigned : 0,
            sizesComplete, 
            hasPersonalizationDecision 
          });
        } else {
          completeVariants.push({ ...variant, index: idx });
        }
      });
      
      // Determine active variant - CRITICAL for state machine
      const activeVariantData = incompleteVariants[0] || null;
      if (activeVariantData && !updatedOrderState.activeVariant) {
        // Set active variant to first incomplete
        updatedOrderState.activeVariant = activeVariantData.color;
        console.log(`[OrderState] Setting activeVariant: ${activeVariantData.color}`);
      }
      
      const variantsSummary = updatedOrderState.variants.map((v, idx) => {
        const assigned = Object.values(v.quantities_per_size).reduce((s, q) => s + q, 0);
        const sizesComplete = v.isComplete === true;
        const sizesStr = assigned > 0 ? Object.entries(v.quantities_per_size).map(([s,q]) => `${s}:${q}`).join(', ') : 'LIPSĂ';
        const persStr = v.personalization.enabled !== undefined ? (v.personalization.enabled ? `${v.personalization.technique || 'Da'}` : 'Nu') : 'NEDEFINIT';
        const fullyComplete = sizesComplete && v.personalization.enabled !== undefined;
        const status = fullyComplete ? '✅ COMPLET' : '⚠️ INCOMPLET';
        const isActive = v.color === updatedOrderState.activeVariant;
        
        let sizeStatus = '';
        if (v.error === 'over_capacity') {
          sizeStatus = `❌ EROARE: ${assigned}/${v.total_quantity || '?'} (prea mult!)`;
        } else if (sizesComplete) {
          sizeStatus = `✅ ${assigned}/${v.total_quantity || '?'}`;
        } else if (assigned > 0) {
          const remaining = (v.total_quantity || 0) - assigned;
          sizeStatus = `⏳ ${assigned}/${v.total_quantity || '?'} (lipsesc ${remaining})`;
        } else {
          sizeStatus = 'LIPSĂ';
        }
        
        return `${isActive ? '👉 ACTIV' : ''} Variantă ${idx + 1} (${v.color}): ${status}
  - Mărimi: ${sizesStr} ${sizeStatus}
  - Personalizare: ${persStr}`;
      }).join('\n\n');
      
      // Calculate missing fields for ACTIVE VARIANT only - SKIP if complete
      const missingForActive = [];
      if (activeVariantData) {
        if (activeVariantData.error === 'over_capacity') {
          missingForActive.push(`EROARE: suma mărimilor (${activeVariantData.assigned}) > total declarat (${activeVariantData.total_quantity})`);
        } else if (!activeVariantData.sizesComplete) {
          missingForActive.push(`mărimi (are ${activeVariantData.assigned}/${activeVariantData.total_quantity || '?'} buc, lipsesc ${activeVariantData.remaining})`);
        }
        if (!activeVariantData.hasPersonalizationDecision) {
          missingForActive.push('decizie personalizare');
        }
      }
      
      const orderStateSummary = `
🧠 ORDER STATE - VARIANT-BASED (PERSISTENT):
${updatedOrderState.product_type ? `✅ LOCKED Tip produs: ${updatedOrderState.product_type}` : '⚠️ LIPSĂ Tip produs'}
${updatedOrderState.variants.length > 0 ? `✅ Variante detectate: ${updatedOrderState.variants.length}` : '⚠️ LIPSĂ Culori/Variante'}
${updatedOrderState.activeVariant ? `👉 ACTIVE VARIANT: ${updatedOrderState.activeVariant}` : ''}

${variantsSummary}

🚨 ACTIVE VARIANT STATE MACHINE:
- TOATE inputs (mărimi, cantități) se aplică DOAR la activeVariant
- Când întrebi "Pentru tricourile ROȘII...", setează active_variant="Roșu" în JSON response
- După ce assigned === total_quantity, marchează variant.isComplete = true
- NU mai întreba pentru variante cu isComplete = true
- Avansează automat la următoarea variantă incompletă

⚠️ ARITHMETIC VALIDATION:
- assigned = sum(quantities_per_size)
- Dacă assigned === total_quantity → COMPLET, treci la următoarea variantă
- Dacă assigned > total_quantity → EROARE, cere user să corecteze
- Dacă assigned < total_quantity → întreabă doar pentru remaining (total - assigned)

${activeVariantData ? `⚠️ VARIANTĂ ACTIVĂ: ${activeVariantData.color} (${activeVariantData.total_quantity || '?'} buc)
   Status: assigned=${activeVariantData.assigned}, remaining=${activeVariantData.remaining}
   Lipsește: ${missingForActive.join(', ')}
   ${activeVariantData.error === 'over_capacity' ? `❌ EROARE: Suma mărimilor (${activeVariantData.assigned}) depășește totalul (${activeVariantData.total_quantity}). Cere user să corecteze.` : ''}
   ${!activeVariantData.sizesComplete && activeVariantData.remaining > 0 ? `→ Întreabă DOAR pentru remaining: "Mai lipsesc ${activeVariantData.remaining} bucăți pentru ${activeVariantData.color}. Pe ce mărimi?"` : ''}
   ${!activeVariantData.sizesComplete && activeVariantData.assigned === 0 ? `→ Întreabă: "Pentru cele ${activeVariantData.total_quantity || 'X'} tricouri ${activeVariantData.color.toUpperCase()}, ce mărimi și câte din fiecare?"` : ''}
   ${activeVariantData.sizesComplete && !activeVariantData.hasPersonalizationDecision ? `→ Întreabă: "Dorești personalizare pe tricourile ${activeVariantData.color.toUpperCase()}?"` : ''}` : '✅ TOATE VARIANTELE SUNT COMPLETE - status="complete"'}
`;

      console.log('[OrderState] Current state:', updatedOrderState);
      console.log('[AI] Calling InvokeLLM...');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Ești un consultant B2B pentru textile personalizate cu ORDER STATE PERSISTENT.${budgetInfo}

${orderStateSummary}

Conversație până acum:
${conversationContext}

User: ${userMessage}

⚠️⚠️⚠️ CONTEXT CRITIC - STARE CURENTĂ COMANDĂ:
${currentProducts.length > 0 ? productsSummary : '🚫 NICIUN PRODUS în comandă - comenzi GOALĂ'}

📊 TOTAL CANTITATE ÎN COMANDĂ: ${totalInCart} bucăți

🔄 TRACKING BIDIRECȚIONAL:
- Când adaugi/modifici/ștergi produse în răspuns → sistemul actualizează AUTOMAT lista "Produse selectate"
- Când user modifică manual lista "Produse selectate" → TU trebuie să vezi noua stare în conversație următoare
- SINCRONIZEAZĂ întotdeauna răspunsul tău cu starea reală de mai sus

Produse disponibile:
${products.map(p => `- ${p.name} (${p.category}) - ${p.base_cost} RON/buc`).join('\n')}

CULORI DISPONIBILE:
${COLORS.join(', ')}

Mărimi disponibile:
${SIZES.join(', ')}

Zone personalizare:
${zones.map(z => z.label_client).join(', ')}

🧠 ORDER STATE - REGULI ABSOLUTE:
1. ORDER STATE e PERSISTENT - supraviețuiește întreaga conversație
2. VARIANT-BASED: fiecare culoare = variantă separată cu propriile mărimi
3. Câmpuri ✅ COMPLETE = INTERZIS să întrebi din nou (FOREVER)
4. NICIODATĂ resetare (doar dacă user zice explicit "reset"/"start over"/"change order")

🚫 NU MODEL DE PRODUS:
- Sistemul alege automat cel mai bun tricou pentru buget
- NU întreba "ce model?"

📝 ACTIVE VARIANT TRACKING (OBLIGATORIU):
- User: "30 roșii și 40 albe" → creează 2 variante
- Bot: "Pentru cele 30 tricouri ROȘII, ce mărimi dorești?" 
  → CRITICAL: setează în răspuns JSON: active_variant="Roșu"
- După răspuns → avansează la următoarea variantă incompletă
- Bot: "Pentru cele 40 tricouri ALBE, ce mărimi?"
  → setează active_variant="Alb"

⚠️ INTERZIS:
- NU copia mărimile între variante
- NU genera produse până când TOATE variantele au mărimi complete (sum = total_quantity)
- NU întreba despre variante deja complete
- NU întreba global despre mărimi - întreabă PER CULOARE ACTIVĂ

🔢 ARITHMETIC:
- Dacă user zice "10 S, 5 M și restul L" pentru variantă cu 40 buc → L = 40 - 15 = 25
- Validează: sum(sizes) = variant.total_quantity

🔒 SHORT ANSWER:
- TOATE input-urile se aplică DOAR la activeVariant
- Dacă activeVariant="Roșu" și user zice "10 M 20 L" → aplică DOAR la variantă roșie

⚠️⚠️⚠️ REGULA CRITICĂ - MODIFICARE vs ADĂUGARE vs ȘTERGERE:

📝 MODIFICARE (când user zice "schimbă", "vreau toate", "fă-le"):
→ MODIFICĂ produsele EXISTENTE, păstrează cantitățile
→ Exemplu: "vreau toate albe" când are 50 tricouri → schimbă culorile, păstrează 50 total

➕ ADĂUGARE (când user zice "mai vreau", "adaugă și", "plus"):
→ ADAUGĂ PESTE ce există deja
→ Exemplu: "mai vreau 20 hanorace" când are 50 tricouri → TOTAL devine 70 articole

🗑️ ȘTERGERE (când user zice "șterge", "elimină", "nu mai vreau"):
→ action="delete" cu delete_criteria: {product_name, color}
→ Exemplu: "șterge tricourile roșii" → șterge DOAR varianta roșie

🚫 VALIDARE PRODUSE:
- Verifică că produsul ARE culorile și mărimile cerute
- Dacă NU are → status="needs_info", întreabă despre produs alternativ
- NU schimba produsul fără să întrebi

⚠️ CANTITĂȚI - PER VARIANTĂ:
- Fiecare variantă (culoare) trebuie să aibă propriile cantități per mărime
- Dacă user zice "30 roșii" fără mărimi → întreabă: "Pentru cele 30 tricouri ROȘII, ce mărimi? (ex: 10 M, 15 L, 5 XL)"
- Dacă user zice "40 albe" fără mărimi → întreabă: "Pentru cele 40 tricouri ALBE, ce mărimi?"
- NICIODATĂ sizes goale sau cu valori 0
- NICIODATĂ presupune că toate variantele au aceleași mărimi

✅ CERINȚE OBLIGATORII - VARIANT STATE MACHINE:
1. CITEȘTE ORDER STATE înainte de orice
2. Status "needs_info" când există variante incomplete (fără mărimi sau fără decizie personalizare)
3. Status "complete" când TOATE variantele au:
   - quantities_per_size completat (ex: {M:10, L:20})
   - personalization.enabled definit (true/false)
4. Procesează variantele SECVENȚIAL - o culoare pe rând
5. NU genera produse până când toate variantele sunt complete
6. Întreabă EXPLICIT pentru fiecare culoare: "Pentru tricourile ROȘII..." apoi "Pentru tricourile ALBE..."

REGULI TEHNICE:
1. Culori DOAR din lista: ${COLORS.join(', ')}
2. Variante separate pentru cu/fără personalizare (același produs, culoare diferită = 2 variante)
3. Ștergere: action="delete" cu criteriile exacte
4. Tehnici: BRODERIE, DTG, SERIGRAFIE, SUBLIMARE, VINIL

STATUS-uri:
- "needs_info" - Când ORDER MEMORY are câmpuri cu ⚠ (lipsă)
- "complete" - Când ORDER MEMORY are TOATE câmpurile cu ✓ (complete)
- "delete" - Pentru ștergere produse

EXEMPLE PER-VARIANT:
User: "30 roșii și 40 albe"
→ STATE: 2 variante create (roșie: 30 buc, albă: 40 buc), ambele incomplete
→ needs_info: "Pentru cele 30 tricouri ROȘII, ce mărimi dorești? (ex: 10 M, 15 L, 5 XL)"

User: "10 M și 20 L" (răspuns la roșii)
→ STATE: variantă roșie completă (M:10, L:20), variantă albă incompletă
→ needs_info: "Pentru cele 40 tricouri ALBE, ce mărimi dorești?"

User: "20 S și 20 M" (răspuns la albe)
→ STATE: ambele variante complete pentru mărimi
→ needs_info: "Dorești personalizare pe tricourile ROȘII?" (întreabă per variantă)

User: "nu"
→ STATE: roșie.personalization.enabled = false
→ needs_info: "Dorești personalizare pe tricourile ALBE?"

User: "da broderie pe piept"
→ STATE: toate variante complete
→ complete: generează produse cu 2 variante distincte

Răspunde JSON:`,
        response_json_schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["needs_info", "complete", "delete"] },
            message: { type: "string" },
            action: { type: "string", enum: ["add", "delete", "ask"] },
            active_variant: { type: "string", description: "Set to color name when asking about specific variant (ex: 'Roșu', 'Alb')" },
            delete_criteria: {
              type: "object",
              properties: {
                product_name: { type: "string" },
                color: { type: "string" }
              }
            },
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_name: { type: "string" },
                  variants: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        color: { type: "string" },
                        sizes: { type: "object" },
                        personalization_zone: { type: "string" },
                        personalization_technique: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      console.log('[AI] Received result:', result);

      if (!result || !result.message) {
        console.error('[AI] Invalid result from InvokeLLM:', result);
        toast.error('Eroare: răspuns invalid de la AI');
        setAiConversation(prev => [...prev, { 
          role: 'assistant', 
          content: 'Eroare: Nu am putut procesa cererea. Te rog încearcă din nou.' 
        }]);
        return;
      }

      // Track last question and active variant
      if (result.status === 'needs_info') {
        setOrderState(prev => ({ 
          ...prev, 
          lastQuestion: result.message,
          activeVariant: result.active_variant || prev.activeVariant // Set active variant from AI response
        }));
        console.log(`[AI] Active variant set to: ${result.active_variant || orderState.activeVariant}`);
      }
      
      setAiConversation(prev => [...prev, { role: 'assistant', content: result.message }]);

      // Handle delete action
      if (result.status === 'delete' || result.action === 'delete') {
        if (result.delete_criteria) {
          const { product_name, color } = result.delete_criteria;
          
          setFormData(prev => ({
            ...prev,
            products: prev.products.map(p => {
              // If product name matches (partial match)
              if (product_name && (p.product_name || '').toLowerCase().includes((product_name || '').toLowerCase())) {
                // If color specified, remove only that color variant
                if (color) {
                  return {
                    ...p,
                    variants: p.variants.filter(v => 
                      !(v.color || '').toLowerCase().includes((color || '').toLowerCase())
                    )
                  };
                } else {
                  // Remove entire product
                  return null;
                }
              }
              return p;
            }).filter(p => p !== null && p.variants && p.variants.length > 0)
          }));
          
          toast.success('Produse șterse conform cererii');
        }
        return;
      }

      if (result.status === 'complete' && result.products && result.products.length > 0) {
        const defaultZone = zones.find(z => z.is_active)?.id_zone || '';
        const validationErrors = [];
        
        // Check if this is a modification (user said "change", "all", "make them", etc.)
        const isModification = (userMessage || '').toLowerCase().match(/\b(schimb[aă]|toate|fac[ăe]|vreau (toate|sa fie)|f[aă]r[aă] personaliz)/i);
        
        // If modification and we have existing products, UPDATE them instead of adding
        if (isModification && formData.products.length > 0) {
          const aiProduct = result.products[0]; // Get first product from AI response
          const matchedProduct = products.find(p => 
            (p.name || '').toLowerCase().includes((aiProduct.product_name || '').toLowerCase()) ||
            (aiProduct.product_name || '').toLowerCase().includes((p.name || '').toLowerCase())
          );
          
          if (matchedProduct && aiProduct.variants && aiProduct.variants.length > 0) {
            const newVariant = aiProduct.variants[0]; // Get desired changes
            
            // Update existing products with new properties
            setFormData(prev => ({
              ...prev,
              products: prev.products.map(product => {
                // Only update matching product type
                if (product.product_id === matchedProduct.id || 
                    (product.product_name || '').toLowerCase().includes((matchedProduct.name || '').toLowerCase())) {
                  return {
                    ...product,
                    variants: product.variants.map(variant => ({
                      ...variant,
                      color: newVariant.color || variant.color,
                      sizes: newVariant.sizes && Object.keys(newVariant.sizes).length > 0 ? newVariant.sizes : variant.sizes,
                      personalization_zone: newVariant.personalization_zone !== undefined ? 
                        (newVariant.personalization_zone === '' || 
                         (newVariant.personalization_zone || '').toLowerCase().includes('fără') || 
                         (newVariant.personalization_zone || '').toLowerCase().includes('fara') ? '' : 
                         zones.find(z => (z.label_client || '').toLowerCase().includes((newVariant.personalization_zone || '').toLowerCase()))?.id_zone || variant.personalization_zone) : 
                        variant.personalization_zone,
                      personalization_technique: newVariant.personalization_technique || variant.personalization_technique
                    }))
                  };
                }
                return product;
              })
            }));
            toast.success('Produse actualizate!');
            return;
          }
        }
        
        // Otherwise, proceed with adding new products
        const newProducts = [];
        const productMap = new Map();
        
        result.products.forEach(aiProduct => {
          try {
            const matchedProduct = products.find(p => 
              (p.name || '').toLowerCase().includes((aiProduct.product_name || '').toLowerCase()) ||
              (aiProduct.product_name || '').toLowerCase().includes((p.name || '').toLowerCase())
            );

            if (!matchedProduct) {
              validationErrors.push(`Produsul "${aiProduct.product_name}" nu există în catalog`);
              return;
            }

            if (matchedProduct && aiProduct.variants) {
              const variants = [];
              
              aiProduct.variants.forEach(variant => {
                // DEFENSIVE: Guard against undefined variant properties
                const variantColor = (variant.color || '').toLowerCase();
                const variantZone = (variant.personalization_zone || '').toLowerCase();
                
                const matchedColor = COLORS.find(c => 
                  c.toLowerCase() === variantColor ||
                  variantColor.includes(c.toLowerCase())
                );
                
                if (!matchedColor && variant.color) {
                  validationErrors.push(`Culoarea "${variant.color}" nu este disponibilă. Culori disponibile: ${COLORS.join(', ')}`);
                  return;
                }
                
                let zone = '';
                if (variant.personalization_zone) {
                  if (variantZone === 'fără' || 
                      variantZone === 'fara' ||
                      variantZone.includes('fără personalizare') ||
                      variantZone.includes('fara personalizare')) {
                    zone = '';
                  } else {
                    const matchedZone = zones.find(z => 
                      (z.label_client || '').toLowerCase().includes(variantZone) ||
                      variantZone.includes((z.label_client || '').toLowerCase())
                    );
                    zone = matchedZone ? matchedZone.id_zone : defaultZone;
                  }
                }
                
                let technique = '';
                if (variant.personalization_technique) {
                  technique = variant.personalization_technique;
                } else if (zone) {
                  const msgLower = (userMessage || '').toLowerCase();
                  if (msgLower.includes('broderie') || msgLower.includes('brodat')) technique = 'BRODERIE';
                  else if (msgLower.includes('dtg')) technique = 'DTG';
                  else if (msgLower.includes('serigrafie')) technique = 'SERIGRAFIE';
                  else if (msgLower.includes('sublimare')) technique = 'SUBLIMARE';
                  else if (msgLower.includes('vinil')) technique = 'VINIL';
                }
                
                // Ensure sizes have values - FILTER OUT ZEROS
                const rawSizes = variant.sizes || {};
                const validSizes = {};
                Object.entries(rawSizes).forEach(([size, qty]) => {
                  if (qty && qty > 0) {
                    validSizes[size] = qty;
                  }
                });
                
                // If no personalization zone specified and AI didn't mention personalization, default to no personalization
                const finalZone = zone || ((userMessage || '').toLowerCase().includes('personaliz') ? zone : '');
                
                variants.push({
                  color: matchedColor || variant.color,
                  sizes: validSizes,
                  personalization_zone: finalZone,
                  personalization_technique: finalZone ? technique : ''
                });
              });

              if (productMap.has(matchedProduct.id)) {
                productMap.get(matchedProduct.id).variants.push(...variants);
              } else {
                productMap.set(matchedProduct.id, {
                  product_id: matchedProduct.id,
                  product_name: matchedProduct.name,
                  category: matchedProduct.category,
                  variants: variants
                });
              }
            }
          } catch (variantError) {
            console.error('[VARIANT ERROR] Failed to process variant:', variantError);
            console.error('[VARIANT ERROR] Product:', aiProduct);
            validationErrors.push(`Eroare la procesarea variantei pentru "${aiProduct.product_name || 'unknown'}"`);
          }
        });

        if (validationErrors.length > 0) {
          setAiConversation(prev => [...prev.slice(0, -1), { 
            role: 'assistant', 
            content: validationErrors.join('\n') 
          }]);
          return;
        }

        // Check existing products and only add NEW ones
        productMap.forEach((productData) => {
          const existingIndex = formData.products.findIndex(p => p.product_id === productData.product_id);
          
          if (existingIndex >= 0) {
            // Product exists - add only NEW variants that don't match existing ones
            const existingProduct = formData.products[existingIndex];
            const newVariants = productData.variants.filter(newVar => {
              // Check if variant with same color and sizes already exists
              return !existingProduct.variants?.some(existingVar => {
                const sameColor = (existingVar.color || '') === (newVar.color || '');
                const sameSizes = JSON.stringify(existingVar.sizes || {}) === JSON.stringify(newVar.sizes || {});
                return sameColor && sameSizes;
              });
            });
            
            if (newVariants.length > 0) {
              setFormData(prev => ({
                ...prev,
                products: prev.products.map((p, i) => {
                  if (i === existingIndex) {
                    return { ...p, variants: [...(p.variants || []), ...newVariants] };
                  }
                  return p;
                })
              }));
            }
          } else {
            newProducts.push(productData);
          }
        });

        if (newProducts.length > 0) {
          setFormData(prev => ({
            ...prev,
            products: [...prev.products, ...newProducts]
          }));
          
          // Calculate actual costs for AI feedback
          const addedSummary = newProducts.map(p => {
            const totalQty = p.variants.reduce((sum, v) => sum + Object.values(v.sizes || {}).reduce((s, q) => s + q, 0), 0);
            return `${p.product_name}: ${totalQty} buc`;
          }).join(', ');
          
          setAiConversation(prev => [...prev, { 
            role: 'system', 
            content: `✓ CONFIRMAT: Adăugate ${addedSummary}. Așteaptă calculul automat pentru cost real.` 
          }]);
          
          toast.success(`${newProducts.length} produse adăugate!`);
        } else {
          toast.success('Produse actualizate!');
        }
      }
    } catch (error) {
      console.error('[AI] Error in processAIDescription:', error);
      console.error('[AI] Error details:', {
        message: error?.message,
        stack: error?.stack,
        response: error?.response
      });
      
      const errorMessage = error?.message || 'Eroare necunoscută';
      toast.error(`Eroare AI: ${errorMessage}`);
      
      setAiConversation(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ Eroare: ${errorMessage}. Te rog încearcă din nou sau contactează suportul.` 
      }]);
    } finally {
      setProcessingAI(false);
      console.log('[AI] Finished processAIDescription');
    }
  };

  const removeProduct = (index) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };

  const addVariantToProduct = (productIndex) => {
    const defaultZone = zones.find(z => z.is_active)?.id_zone || '';
    setFormData(prev => ({
      ...prev,
      products: prev.products.map((p, i) => {
        if (i === productIndex) {
          return {
            ...p,
            variants: [
              ...(p.variants || []),
              { color: '', sizes: {}, personalization_zone: defaultZone, personalization_technique: '' } // Auto by default
            ]
          };
        }
        return p;
      })
    }));
  };

  const updateVariant = (productIndex, variantIndex, updatedVariant) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.map((p, i) => {
        if (i === productIndex) {
          return {
            ...p,
            variants: p.variants.map((v, vi) => vi === variantIndex ? updatedVariant : v)
          };
        }
        return p;
      })
    }));
  };

  const removeVariant = (productIndex, variantIndex) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.map((p, i) => {
        if (i === productIndex) {
          const newVariants = p.variants.filter((_, vi) => vi !== variantIndex);
          // If no variants left, remove the product
          if (newVariants.length === 0) {
            return null;
          }
          return { ...p, variants: newVariants };
        }
        return p;
      }).filter(p => p !== null)
    }));
  };

  const getTotalQuantity = () => {
    return formData.products.reduce((total, product) => {
      if (product.variants) {
        return total + product.variants.reduce((variantTotal, variant) => {
          return variantTotal + Object.values(variant.sizes || {}).reduce((sum, qty) => sum + qty, 0);
        }, 0);
      }
      return total + Object.values(product.color_quantities || {}).reduce((colorTotal, sizes) => {
        return colorTotal + Object.values(sizes).reduce((sum, qty) => sum + qty, 0);
      }, 0);
    }, 0);
  };

  const getEstimatedSpent = () => {
    if (!calculationResult?.offers || calculationResult.offers.length === 0) return 0;
    return calculationResult.offers[0].total_cost || 0;
  };

  const getBudgetRemaining = () => {
    const budget = parseFloat(formData.budget) || 0;
    const spent = getEstimatedSpent();
    return budget - spent;
  };

  const isContactComplete = formData.client_name && formData.client_email && formData.client_phone && formData.delivery_address;

  // Auto-collapse contact section when complete and user adds product/budget
  useEffect(() => {
    if (isContactComplete && (formData.budget || formData.products.length > 0)) {
      setContactSectionOpen(false);
    }
  }, [formData.budget, formData.products.length, isContactComplete]);

  // Send real cost feedback to AI after calculation
  useEffect(() => {
    if (calculationResult?.offers && calculationResult.offers.length > 0 && aiConversation.length > 0) {
      const lastMsg = aiConversation[aiConversation.length - 1];
      if (lastMsg.role === 'system' && lastMsg.content.includes('Așteaptă calculul')) {
        const realCost = getEstimatedSpent();
        const remaining = getBudgetRemaining();

        setAiConversation(prev => [...prev, {
          role: 'system',
          content: `✓ CALCUL REAL: Cost total ${realCost.toFixed(2)} RON. ${remaining >= 0 ? `Rămân ${remaining.toFixed(2)} RON` : `Depășire cu ${Math.abs(remaining).toFixed(2)} RON`}`
        }]);
      }
    }
  }, [calculationResult]);

  // Calculate total budget
  useEffect(() => {
    const prod = parseFloat(formData.budget_products) || 0;
    const pers = parseFloat(formData.budget_personalization) || 0;
    const total = prod + pers;
    if (total !== parseFloat(formData.budget)) {
      setFormData(prev => ({ ...prev, budget: total.toString() }));
    }
  }, [formData.budget_products, formData.budget_personalization]);

  useEffect(() => {
    const { budget, client_name, client_email, client_phone, delivery_address } = formData;
    const totalQty = getTotalQuantity();
    
    console.log('[CALC TRIGGER] Budget:', budget, 'Qty:', totalQty, 'Products:', formData.products.length);
    
    if (!budget || totalQty === 0 || !client_name || !client_email || !client_phone || !delivery_address) {
      setCalculationResult(null);
      return;
    }

    // Build combined order from all products - AGGREGATE ALL ITEMS
    const allProductVariants = [];
    let totalOrderQty = 0;
    
    formData.products.forEach(product => {
      if (product.variants) {
        product.variants.forEach(variant => {
          const qty = Object.values(variant.sizes || {}).reduce((sum, q) => sum + q, 0);
          if (qty > 0 && variant.color) {
            allProductVariants.push({
              product_id: product.product_id,
              product_name: product.product_name,
              category: product.category,
              color: variant.color,
              sizes: variant.sizes,
              quantity: qty,
              personalization_zone: variant.personalization_zone || '',
              personalization_technique: variant.personalization_technique || ''
            });
            totalOrderQty += qty;
          }
        });
      }
    });

    console.log('[ORDER AGGREGATION] Total variants:', allProductVariants.length, 'Total quantity:', totalOrderQty);

    // Validation: Ensure we have all products
    if (allProductVariants.length === 0) {
      console.warn('[ORDER] No valid product variants to quote');
      setCalculationResult(null);
      return;
    }

    // Calculate combined offers - ONE OFFER PER ATELIER FOR ENTIRE ORDER
    const combinedOffers = [];
    
    console.log('[OFFERS] Starting calculation with', ateliers.length, 'ateliers');
    
    ateliers.forEach(atelier => {
      if (atelier.status !== 'active') {
        console.log('[OFFERS] Skipping inactive atelier:', atelier.name);
        return;
      }
      
      console.log('[OFFERS] Processing atelier:', atelier.name, 'variants:', allProductVariants.length);

      // AGGREGATE: Calculate total product cost for ALL variants
      let totalProductCost = 0;
      let maxLeadTime = atelier.avg_lead_time_days || 7;
      const orderItems = [];
      let canFulfillAll = true;

      // Process all variants regardless of personalization
      allProductVariants.forEach(variant => {
        const product = products.find(p => p.id === variant.product_id);
        if (!product || !product.base_cost) {
          canFulfillAll = false;
          return;
        }
        
        const unitProductCost = product.base_cost;
        const variantProductCost = unitProductCost * variant.quantity;
        totalProductCost += variantProductCost;
        
        orderItems.push({
          ...variant,
          product,
          base_product_cost: unitProductCost,
          base_total_cost: variantProductCost
        });
      });

      if (!canFulfillAll) {
        console.log('[OFFERS] Atelier cannot fulfill all products:', atelier.name);
        return;
      }

      // AGGREGATE PERSONALIZATION: Calculate at order level if ANY item has personalization
      const itemsWithPersonalization = orderItems.filter(item => item.personalization_zone && item.personalization_zone !== '');
      
      if (itemsWithPersonalization.length === 0) {
        // NO PERSONALIZATION - Simple offer
        const finalOfferItems = orderItems.map(item => ({
          ...item,
          offer: {
            product: item.product,
            atelier_id: atelier.id,
            atelier_name: atelier.name,
            technique: 'none',
            zone_id: '',
            zone_label: 'Fără personalizare',
            quantity: item.quantity,
            base_product_cost: item.base_product_cost,
            personalization_cost_per_unit: 0,
            unit_price: item.base_product_cost,
            setup_fee: 0,
            total_cost: item.base_total_cost,
            lead_time_days: maxLeadTime,
            budget_remaining: 0
          }
        }));

        combinedOffers.push({
          atelier_id: atelier.id,
          atelier_name: atelier.name,
          total_cost: totalProductCost,
          lead_time_days: maxLeadTime,
          budget_remaining: parseFloat(budget) - totalProductCost,
          order_items: finalOfferItems,
          total_units: totalOrderQty,
          price_per_unit: totalProductCost / totalOrderQty,
          isOverBudget: totalProductCost > parseFloat(budget)
        });
        return;
      }

      // WITH PERSONALIZATION - Apply to ALL items (entire order)
      // Use FIRST personalization zone/technique as template
      const primaryPersonalization = itemsWithPersonalization[0];
      
      const persResult = calculateStrictOffers(
        parseFloat(budget) * 10,
        totalOrderQty, // TOTAL quantity for entire order
        primaryPersonalization.personalization_zone,
        primaryPersonalization.personalization_technique || null,
        primaryPersonalization.category,
        products,
        [atelier],
        zones
      );

      if (!persResult.offers || persResult.offers.length === 0) {
        console.log('[OFFERS] No personalization offers for atelier:', atelier.name);
        return;
      }

      // Generate ONE offer per technique option
      persResult.offers.forEach(persOffer => {
        // Calculate total personalization cost for entire order
        const totalPersonalizationCost = persOffer.total_cost;
        const persPerUnit = (persOffer.personalization_cost_per_unit || 0);
        const setupFee = persOffer.setup_fee || 0;
        
        // Create offer items with personalization applied
        const finalOfferItems = orderItems.map(item => ({
          ...item,
          offer: {
            product: item.product,
            atelier_id: atelier.id,
            atelier_name: atelier.name,
            technique: persOffer.technique,
            zone_id: persOffer.zone_id,
            zone_label: persOffer.zone_label,
            quantity: item.quantity,
            base_product_cost: item.base_product_cost,
            personalization_cost_per_unit: persPerUnit,
            unit_price: item.base_product_cost + persPerUnit,
            setup_fee: 0, // Setup counted once at order level
            total_cost: item.base_total_cost + (persPerUnit * item.quantity),
            lead_time_days: persOffer.lead_time_days,
            budget_remaining: 0
          }
        }));

        const totalCost = totalProductCost + totalPersonalizationCost;
        const leadTime = Math.max(maxLeadTime, persOffer.lead_time_days);

        // CRITICAL VALIDATION: Ensure offer includes ALL selected products
        const offerQty = finalOfferItems.reduce((sum, item) => sum + item.quantity, 0);
        if (offerQty !== totalOrderQty) {
          console.error('[VALIDATION FAILED] Offer incomplete! Expected:', totalOrderQty, 'Got:', offerQty);
          console.error('[VALIDATION FAILED] Missing items in offer for atelier:', atelier.name);
          return; // BLOCK invalid offer
        }
        
        console.log('[VALIDATION OK] Offer complete:', atelier.name, 'Total qty:', offerQty);

        combinedOffers.push({
          atelier_id: atelier.id,
          atelier_name: atelier.name,
          total_cost: totalCost,
          lead_time_days: leadTime,
          budget_remaining: parseFloat(budget) - totalCost,
          order_items: finalOfferItems,
          total_units: totalOrderQty,
          price_per_unit: totalCost / totalOrderQty,
          personalization: {
            technique: persOffer.technique,
            zone: persOffer.zone_label,
            cost_per_unit: persPerUnit,
            setup_fee: setupFee,
            total_cost: totalPersonalizationCost
          },
          breakdown: {
            products_subtotal: totalProductCost,
            personalization_subtotal: totalPersonalizationCost,
            total: totalCost
          },
          isOverBudget: totalCost > parseFloat(budget)
        });
      });
    });

    // FINAL VALIDATION: All offers must include ALL products
    const validOffers = combinedOffers.filter(offer => {
      const offerQty = offer.order_items.reduce((sum, item) => sum + item.quantity, 0);
      if (offerQty !== totalOrderQty) {
        console.error('[FINAL VALIDATION] Rejected incomplete offer from:', offer.atelier_name);
        return false;
      }
      return true;
    });

    if (validOffers.length === 0 && combinedOffers.length > 0) {
      console.error('[CRITICAL ERROR] All offers rejected - incomplete orders!');
      setCalculationResult({ 
        error: true, 
        message: 'Nu s-au găsit ateliere care să poată procesa TOATE produsele selectate. Te rugăm verifică selecția.' 
      });
      return;
    }

    // Sort: within-budget first (by cost), then over-budget (by cost)
    validOffers.sort((a, b) => {
      if (a.isOverBudget && !b.isOverBudget) return 1;
      if (!a.isOverBudget && b.isOverBudget) return -1;
      return a.total_cost - b.total_cost;
    });
    
    console.log('[OFFERS] Valid complete offers:', validOffers.length, '/', combinedOffers.length);
    setCalculationResult({ offers: validOffers });
  }, [formData, products, ateliers, zones]);

  const handleSelectOffer = async (offer) => {
    const atelier = ateliers.find(a => a.id === offer.atelier_id);
    
    // Generate order number: SEQ-YYYYMMDD-ATJUD
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get today's order count for sequential number
    const todayOrders = await base44.entities.Order.filter({
      created_date: { $gte: today.toISOString().slice(0, 10) }
    });
    const seqNumber = String(todayOrders.length + 1).padStart(4, '0');
    
    const atelierCode = atelier?.invoice_series || 'XXX';
    const countyCode = atelier?.county_code || 'XX';
    const orderNumber = `${seqNumber}-${dateStr}-${atelierCode}${countyCode}`;
    
    const orderData = {
      order_number: orderNumber,
      client_name: formData.client_name,
      client_email: formData.client_email,
      client_phone: formData.client_phone,
      delivery_address: formData.delivery_address,
      order_items: offer.order_items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        color: item.color,
        quantity: item.quantity,
        sizes_breakdown: item.sizes,
        unit_price: item.offer.unit_price,
        personalization_cost_per_unit: item.offer.personalization_cost_per_unit,
        base_product_cost: item.offer.base_product_cost,
        setup_fee: item.offer.setup_fee,
        total_price: item.offer.total_cost
      })),
      personalization_type: offer.order_items[0]?.offer.technique,
      personalization_zone: offer.zone_id,
      total_price: offer.total_cost,
      estimated_lead_time_days: offer.lead_time_days,
      atelier_id: offer.atelier_id,
      atelier_name: offer.atelier_name,
      status: 'offer_sent'
    };
    
    await createOrderMutation.mutateAsync([orderData]);
  };

  const toggleZone = (zoneId) => {
    setFormData(prev => ({
      ...prev,
      selected_zones: prev.selected_zones.includes(zoneId)
        ? prev.selected_zones.filter(id => id !== zoneId)
        : [...prev.selected_zones, zoneId]
    }));
  };

  const getDeliveryTimeColor = (days) => {
    if (days <= 3) return 'text-emerald-400';
    if (days <= 7) return 'text-blue-400';
    if (days <= 14) return 'text-amber-400';
    return 'text-red-400';
  };

  const hasRequiredFields = formData.client_name && formData.client_email && formData.client_phone && formData.delivery_address && formData.budget && formData.products.length > 0 && formData.products.every(p => p.variants && p.variants.length > 0);

  return (
    <div className="min-h-screen bg-[#F5F7FA] py-12">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-1 w-12 bg-[#1F3A5F]"></div>
            <span className="text-xs font-semibold tracking-wider text-[#6B7280] uppercase">Calculator oferte</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold text-[#1F2933] mb-3 tracking-tight">
            Textile personalizate B2B
          </h1>
          <p className="text-[#6B7280] text-base max-w-2xl leading-relaxed">Configurează comanda și primești oferte instant de la atelierele noastre verificate</p>
        </motion.div>

        <div className="grid lg:grid-cols-[420px_1fr] gap-8">
          <div className="space-y-6">
            <Card className="bg-white border-0 shadow-[0_4px_12px_rgba(0,0,0,0.04)] rounded-xl">
              <CardContent className="p-8">
                <button 
                  onClick={() => setContactSectionOpen(!contactSectionOpen)}
                  className="w-full flex items-center justify-between mb-6"
                >
                  <h3 className="text-sm font-semibold text-[#1F2933] flex items-center gap-3 tracking-tight">
                    <span className="w-8 h-8 rounded-lg bg-[#1F3A5F] flex items-center justify-center text-xs text-white font-semibold">1</span>
                    Date contact
                  </h3>
                  <ChevronRight className={`w-4 h-4 text-[#6B7280] transition-transform ${contactSectionOpen ? 'rotate-90' : ''}`} />
                </button>
                
                {contactSectionOpen ? (
                  <div className="space-y-4">
                    <Input placeholder="Nume complet *" value={formData.client_name} onChange={(e) => setFormData({...formData, client_name: e.target.value})} className="bg-[#FAFAFA] border-[#E5E7EB] text-[#1F2933] placeholder:text-[#9CA3AF] h-12 rounded-lg focus:border-[#1F3A5F] focus:ring-1 focus:ring-[#1F3A5F]" />
                    <Input type="email" placeholder="Email *" value={formData.client_email} onChange={(e) => setFormData({...formData, client_email: e.target.value})} className="bg-[#FAFAFA] border-[#E5E7EB] text-[#1F2933] placeholder:text-[#9CA3AF] h-12 rounded-lg focus:border-[#1F3A5F] focus:ring-1 focus:ring-[#1F3A5F]" />
                    <Input placeholder="Telefon *" value={formData.client_phone} onChange={(e) => setFormData({...formData, client_phone: e.target.value})} className="bg-[#FAFAFA] border-[#E5E7EB] text-[#1F2933] placeholder:text-[#9CA3AF] h-12 rounded-lg focus:border-[#1F3A5F] focus:ring-1 focus:ring-[#1F3A5F]" />
                    <Textarea placeholder="Adresă livrare *" value={formData.delivery_address} onChange={(e) => setFormData({...formData, delivery_address: e.target.value})} className="bg-[#FAFAFA] border-[#E5E7EB] text-[#1F2933] placeholder:text-[#9CA3AF] rounded-lg focus:border-[#1F3A5F] focus:ring-1 focus:ring-[#1F3A5F]" rows={3} />
                  </div>
                ) : isContactComplete ? (
                  <div className="space-y-2 text-sm text-[#6B7280] bg-[#F9FAFB] p-5 rounded-lg border border-[#E5E7EB]">
                    <p className="font-semibold text-[#1F2933]">{formData.client_name}</p>
                    <p>{formData.client_email}</p>
                    <p>{formData.client_phone}</p>
                    <p className="text-xs leading-relaxed pt-2 border-t border-[#E5E7EB]">{formData.delivery_address}</p>
                  </div>
                ) : (
                  <p className="text-sm text-[#9CA3AF]">Completează datele de contact</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-[0_4px_12px_rgba(0,0,0,0.04)] rounded-xl">
              <CardContent className="p-8">
                <h3 className="text-sm font-semibold text-[#1F2933] mb-6 flex items-center gap-3 tracking-tight">
                  <span className="w-8 h-8 rounded-lg bg-[#1F3A5F] flex items-center justify-center text-xs text-white font-semibold">2</span>
                  Produse selectate
                </h3>

                <div className="flex items-center justify-between mb-5">
                  {getTotalQuantity() > 0 && (
                    <Badge variant="outline" className="border-[#1F3A5F] text-[#1F3A5F] text-xs font-semibold">
                      {getTotalQuantity()} buc
                    </Badge>
                  )}
                </div>
                      
                {formData.products.length === 0 ? (
                  <div className="text-center py-8 bg-gradient-to-br from-[#F9FAFB] to-[#F3F4F6] rounded-xl border border-[#E5E7EB]">
                    <Package className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" />
                    <p className="text-xs text-[#6B7280] font-medium">Niciun produs configurat</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.products.map((product, idx) => (
                      <ProductVariantsList
                        key={idx}
                        product={product}
                        productIndex={idx}
                        zones={zones}
                        onUpdateVariant={updateVariant}
                        onRemoveVariant={removeVariant}
                        onAddVariant={addVariantToProduct}
                        onRemoveProduct={removeProduct}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <AnimatePresence mode="wait">
              {showProductConfig && (
                <motion.div key="config" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <Card className="bg-white border-0 shadow-[0_4px_12px_rgba(0,0,0,0.04)] rounded-xl">
                    <CardContent className="p-10">
                      <div className="mb-10 pb-6 border-b-2 border-[#1F3A5F]">
                        <h2 className="text-2xl font-semibold text-[#1F2933] tracking-tight">Configurare produse</h2>
                        <p className="text-sm text-[#6B7280] mt-2">Descrie cerința sau selectează manual din catalog</p>
                      </div>

                      <div className="space-y-8">
                        <div className="bg-gradient-to-br from-[#F9FAFB] to-[#F3F4F6] border-2 border-[#E5E7EB] p-4 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <Label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Buget</Label>
                            <button 
                              onClick={() => setShowBudgetBreakdown(!showBudgetBreakdown)}
                              className="text-[10px] text-[#6B7280] hover:text-[#1F3A5F] underline"
                            >
                              {showBudgetBreakdown ? 'Ascunde detalii' : 'Detalii'}
                            </button>
                          </div>

                          {showBudgetBreakdown ? (
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <Input 
                                type="number" 
                                placeholder="Produse" 
                                value={formData.budget_products} 
                                onChange={(e) => setFormData({...formData, budget_products: e.target.value})} 
                                className="bg-white border-[#E5E7EB] text-[#1F2933] text-sm text-center h-9 rounded-lg" 
                              />
                              <Input 
                                type="number" 
                                placeholder="Personalizare" 
                                value={formData.budget_personalization} 
                                onChange={(e) => setFormData({...formData, budget_personalization: e.target.value})} 
                                className="bg-white border-[#E5E7EB] text-[#1F2933] text-sm text-center h-9 rounded-lg" 
                              />
                            </div>
                          ) : (
                            <Input 
                              type="number" 
                              placeholder="0" 
                              value={formData.budget} 
                              onChange={(e) => setFormData({...formData, budget: e.target.value})} 
                              className="bg-white border-[#E5E7EB] text-[#1F2933] text-xl font-semibold text-center h-12 rounded-lg mb-2" 
                            />
                          )}

                          <div className="text-center text-xs text-[#6B7280] mb-3">
                            Total: <span className="font-bold text-[#1F3A5F] text-lg">{(parseFloat(formData.budget) || 0).toFixed(0)}</span> RON
                          </div>

                          {formData.budget && calculationResult?.offers && calculationResult.offers.length > 0 && (
                            <div className="pt-3 border-t border-[#E5E7EB] space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-[#6B7280]">Estimat:</span>
                                <span className="font-semibold text-[#1F2933]">{getEstimatedSpent().toFixed(0)} RON</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#6B7280]">{getBudgetRemaining() >= 0 ? 'Rămas:' : 'Depășit:'}</span>
                                <span className={`font-bold ${getBudgetRemaining() >= 0 ? 'text-[#2FA36B]' : 'text-red-600'}`}>
                                  {Math.abs(getBudgetRemaining()).toFixed(0)} RON
                                </span>
                              </div>
                              <div className="w-full bg-[#E5E7EB] rounded-full h-1.5 overflow-hidden mt-2">
                                <div 
                                  className={`h-full transition-all duration-300 rounded-full ${getBudgetRemaining() >= 0 ? 'bg-[#1F3A5F]' : 'bg-red-600'}`}
                                  style={{ width: `${Math.min((getEstimatedSpent() / parseFloat(formData.budget)) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <Label className="text-sm font-semibold text-[#1F2933] mb-5 block">Descrie cerința ta</Label>
                          
                          {aiConversation.length > 0 && (
                            <div className="mb-5 space-y-3 max-h-[240px] overflow-y-auto p-5 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                              {[...aiConversation].reverse().map((msg, idx) => (
                                <div key={idx} className={`p-4 rounded-lg text-sm whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'bg-[#1F3A5F] text-white ml-8' : 'bg-white text-[#1F2933] mr-8 border border-[#E5E7EB]'}`}>
                                  {msg.content}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <Textarea 
                            value={aiDescription}
                            onChange={(e) => setAiDescription(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (!processingAI && aiDescription.trim()) {
                                  processAIDescription();
                                }
                              }
                            }}
                            placeholder="Ex: Vreau 50 tricouri, 30 albe și 20 negre, cu logo pe piept..."
                            className="min-h-[120px] bg-[#FAFABA] border-[#E5E7EB] text-[#1F2933] placeholder:text-[#9CA3AF] rounded-lg focus:border-[#1F3A5F] focus:ring-2 focus:ring-[#1F3A5F]/20"
                            disabled={processingAI}
                          />
                          
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('[BUTTON] Clicked, processingAI:', processingAI, 'text:', aiDescription);
                              if (!processingAI && aiDescription.trim()) {
                                await processAIDescription();
                              }
                            }}
                            type="button"
                            disabled={processingAI || !aiDescription.trim()}
                            className={`w-full mt-4 h-12 font-semibold rounded-lg shadow-sm transition-colors ${
                              processingAI || !aiDescription.trim() 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-[#2FA36B] hover:bg-[#27875a] active:bg-[#1f7d4f]'
                            } text-white`}
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                          >
                            {processingAI ? 'Procesez...' : 'Trimite'}
                          </button>
                        </div>

                        <div className="border-t-2 border-[#E5E7EB] pt-8">
                          <Button 
                            variant="outline"
                            onClick={() => setShowManualSelection(!showManualSelection)}
                            className="w-full border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#1F3A5F] hover:text-[#1F3A5F] h-12 font-medium rounded-lg"
                          >
                            {showManualSelection ? '▼' : '▶'} Sau selectează manual produsele
                          </Button>
                          
                          {showManualSelection && (
                            <div className="grid grid-cols-2 gap-4 mt-6">
                              {products.filter(p => p.is_active).map(product => (
                                <button 
                                  key={product.id} 
                                  onClick={() => { addProduct(product.id); setShowProductConfig(false); }}
                                  className="p-6 rounded-xl bg-white hover:bg-[#F9FAFB] border-2 border-[#E5E7EB] hover:border-[#1F3A5F] transition-all text-left group shadow-sm hover:shadow-md"
                                >
                                  <div className="font-semibold text-sm text-[#1F2933] mb-2 group-hover:text-[#1F3A5F]">{product.name}</div>
                                  <div className="text-xs text-[#9CA3AF] mb-4 uppercase tracking-wider font-medium">{product.category}</div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-base font-bold text-[#1F2933]">{product.base_cost} <span className="text-sm font-normal text-[#6B7280]">RON</span></span>
                                    <Plus className="w-5 h-5 text-[#D1D5DB] group-hover:text-[#1F3A5F]" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
              
              {calculationResult?.offers && (
                <motion.div key="offers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="mb-8">
                    <h2 className="text-2xl font-semibold text-[#1F2933] tracking-tight mb-2">{calculationResult.offers.length} oferte disponibile</h2>
                    <p className="text-sm text-[#6B7280]">Selectează oferta optimă pentru comanda ta</p>
                  </div>

                      <div className="grid gap-5">
                        {calculationResult.offers.map((offer, idx) => {
                          const isFirst = idx === 0 && !offer.isOverBudget;
                          const isOverBudget = offer.isOverBudget;

                          // Gather unique techniques in this offer
                          const techniques = [...new Set(offer.order_items.map(item => item.offer?.technique || 'none'))].filter(t => t !== 'none');

                          return (
                            <Card 
                              key={idx} 
                              className={`transition-all rounded-xl ${!isOverBudget ? 'hover:shadow-lg' : ''} ${
                                isFirst 
                                  ? 'bg-gradient-to-br from-[#F9FAFB] to-white border-2 border-[#1F3A5F] shadow-[0_4px_12px_rgba(31,58,95,0.08)]' 
                                  : isOverBudget
                                    ? 'bg-[#F9FAFB]/50 border border-[#E5E7EB] opacity-50'
                                    : 'bg-white border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                              }`}
                            >
                              <CardContent className="p-8">
                                <div className="flex items-start justify-between mb-6">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                      <h3 className={`text-lg font-semibold tracking-tight ${isOverBudget ? 'text-[#9CA3AF]' : 'text-[#1F2933]'}`}>
                                        {offer.atelier_name}
                                      </h3>
                                      {isFirst && (
                                        <Badge className="bg-[#1F3A5F] text-white text-xs font-semibold px-3 py-1">
                                          RECOMANDAT
                                        </Badge>
                                      )}
                                      {isOverBudget && (
                                        <Badge variant="outline" className="border-[#E5E7EB] text-[#9CA3AF] text-xs">
                                          Peste buget
                                        </Badge>
                                      )}
                                      </div>
                                      <div className="flex items-center gap-4 flex-wrap">
                                      <p className={`text-xs font-medium ${isOverBudget ? 'text-[#9CA3AF]' : 'text-[#6B7280]'}`}>
                                        {offer.total_units} articole total
                                      </p>
                                      {techniques.length > 0 && (
                                        <>
                                          <span className="text-xs text-[#D1D5DB]">•</span>
                                          <div className="flex gap-2">
                                            {techniques.map(tech => (
                                              <Badge key={tech} variant="outline" className={`text-[10px] font-medium ${isOverBudget ? 'border-[#E5E7EB] text-[#9CA3AF]' : 'border-[#1F3A5F]/20 text-[#1F3A5F] bg-[#1F3A5F]/5'}`}>
                                                {tech}
                                              </Badge>
                                            ))}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="text-right">
                                    <div className={`text-3xl font-semibold ${isOverBudget ? 'text-[#9CA3AF]' : 'text-[#1F2933]'}`}>
                                      {offer.total_cost.toFixed(0)} <span className="text-base font-normal text-[#6B7280]">RON</span>
                                    </div>
                                    <div className={`text-xs font-semibold mt-1 ${
                                      isOverBudget 
                                        ? 'text-[#9CA3AF]' 
                                        : offer.budget_remaining >= 0 
                                          ? 'text-[#2FA36B]' 
                                          : 'text-red-600'
                                    }`}>
                                      {offer.budget_remaining >= 0 ? 'Rămân' : 'Lipsesc'} {Math.abs(offer.budget_remaining).toFixed(0)} RON
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-5 mb-6 text-sm pb-5 border-b border-[#E5E7EB]">
                                  <div className="flex items-center gap-2">
                                    <Clock className={`w-4 h-4 ${isOverBudget ? 'text-[#9CA3AF]' : getDeliveryTimeColor(offer.lead_time_days)}`} />
                                    <span className={`font-semibold ${isOverBudget ? 'text-[#9CA3AF]' : getDeliveryTimeColor(offer.lead_time_days)}`}>
                                      {offer.lead_time_days} zile livrare
                                    </span>
                                  </div>
                                  <Badge variant="outline" className={`text-xs font-medium ${isOverBudget ? 'border-[#E5E7EB] text-[#9CA3AF]' : 'text-[#6B7280] border-[#E5E7EB]'}`}>
                                    {offer.zone_label}
                                  </Badge>
                                </div>

                                <div className="flex gap-4">
                                  <Button 
                                    onClick={() => setViewingOffer(offer)} 
                                    variant="outline" 
                                    className={`flex-1 h-12 text-sm font-semibold rounded-lg ${isOverBudget ? 'border-[#E5E7EB] text-[#9CA3AF] hover:bg-[#F9FAFB]' : 'border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#1F3A5F]'}`}
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    Vezi detalii
                                  </Button>
                                  <Button 
                                    onClick={() => handleSelectOffer(offer)} 
                                    disabled={createOrderMutation.isPending || isOverBudget} 
                                    className={`flex-1 h-12 text-sm font-semibold rounded-lg shadow-sm ${
                                      isFirst 
                                        ? 'bg-[#2FA36B] hover:bg-[#27875a] text-white' 
                                        : isOverBudget
                                          ? 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
                                          : 'bg-[#1F3A5F] hover:bg-[#162d47] text-white'
                                    }`}
                                  >
                                    {isOverBudget ? 'Indisponibil' : 'Selectează oferta'}
                                    {!isOverBudget && <ChevronRight className="w-4 h-4 ml-2" />}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                  </div>
                </motion.div>
              )}
              
              {!showProductConfig && !hasRequiredFields && !calculationResult?.offers && (
                <div className="flex flex-col items-center justify-center h-96 bg-gradient-to-br from-white to-[#F9FAFB] rounded-xl border-2 border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <div className="text-center px-8">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#F9FAFB] flex items-center justify-center">
                      <Package className="w-10 h-10 text-[#D1D5DB]" />
                    </div>
                    <p className="text-[#1F2933] font-semibold text-lg mb-2">Configurează comanda</p>
                    <p className="text-sm text-[#6B7280] leading-relaxed max-w-md mx-auto mb-6">Completează datele de contact și configurează produsele</p>
                    <Button 
                      onClick={() => setShowProductConfig(true)} 
                      className="bg-[#2FA36B] hover:bg-[#27875a] text-white h-12 px-8 font-semibold rounded-lg shadow-sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Configurează produse
                    </Button>
                  </div>
                </div>
              )}
              
              {calculationResult?.error && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-red-700">{calculationResult.message}</AlertDescription>
                </Alert>
              )}
              
              {false && calculationResult?.offers && (
                <motion.div key="offers-old" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">🎉 {calculationResult.offers.length} oferte</h2>
                    <p className="text-sm text-slate-400">Alege oferta potrivită</p>
                  </div>

                  <div className="grid gap-3">
                    {calculationResult.offers.map((offer, idx) => (
                      <Card key={idx} className={`transition-all hover:scale-[1.01] ${idx === 0 ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-indigo-500/50' : 'bg-slate-800/50 border-slate-700'}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-bold text-white">{offer.atelier_name}</h3>
                                {idx === 0 && (
                                  <Badge className="bg-amber-500 text-white text-xs">
                                    <Award className="w-3 h-3 mr-1" />
                                    TOP
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">{offer.order_items.length} produse</p>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-2xl font-bold text-white">
                                {offer.total_cost.toFixed(0)} <span className="text-sm text-slate-400">RON</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-emerald-400">
                                Rămân {offer.budget_remaining.toFixed(0)} RON
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3 mb-3 text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className={`w-3 h-3 ${offer.isOverBudget ? 'text-slate-600' : getDeliveryTimeColor(offer.lead_time_days)}`} />
                              <span className={`font-semibold ${offer.isOverBudget ? 'text-slate-600' : getDeliveryTimeColor(offer.lead_time_days)}`}>
                                {offer.lead_time_days} zile
                              </span>
                            </div>
                            <Badge variant="outline" className={`text-xs ${offer.isOverBudget ? 'text-slate-600 border-slate-600' : 'text-slate-300 border-slate-600'}`}>
                              {offer.zone_label}
                            </Badge>
                          </div>

                          <div className="flex gap-2">
                            <Button onClick={() => setViewingOffer(offer)} variant="outline" className={`flex-1 h-9 text-sm ${offer.isOverBudget ? 'border-slate-700 text-slate-600 hover:bg-slate-800' : ''}`}>
                              <Eye className="w-3 h-3 mr-1" />
                              Detalii
                            </Button>
                            <Button 
                              onClick={() => handleSelectOffer(offer)} 
                              disabled={createOrderMutation.isPending || offer.isOverBudget} 
                              className={`flex-1 h-9 text-sm ${
                                idx === 0 && !offer.isOverBudget
                                  ? 'bg-indigo-500 hover:bg-indigo-600' 
                                  : offer.isOverBudget
                                    ? 'bg-slate-700 text-slate-600 cursor-not-allowed'
                                    : 'bg-slate-700 hover:bg-slate-600'
                              }`}
                            >
                              {idx === 0 && !offer.isOverBudget && <Zap className="w-3 h-3 mr-1" />}
                              {offer.isOverBudget ? 'Indisponibil' : 'Comandă'}
                              {!offer.isOverBudget && <ChevronRight className="w-3 h-3 ml-1" />}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Configurare produse</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold text-slate-700">Buget disponibil</Label>
                <div className="text-right">
                  <div className="text-2xl font-bold text-indigo-600">{formData.budget || 0} RON</div>
                  {formData.products.length > 0 && (
                    <div className="text-xs text-slate-500">
                      Rămas: <span className="font-semibold text-emerald-600">{formData.budget || 0} RON</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-3 block">🤖 Descrie ce dorești (AI)</Label>
              <Textarea 
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                placeholder="Ex: Vreau 50 tricouri albe și negre, cu logo pe piept, mărimi S, M, L..."
                className="min-h-[80px]"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-slate-500">💡 Descrie produsele, culorile și cantitățile dorite</p>
                <Button 
                  onClick={processAIDescription} 
                  disabled={processingAI || !aiDescription.trim()}
                  size="sm"
                  className="bg-indigo-500 hover:bg-indigo-600"
                >
                  {processingAI ? 'Procesez...' : 'Generează produse'}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-3 block">Sau selectează manual</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {products.filter(p => p.is_active).map(product => (
                  <button 
                    key={product.id} 
                    onClick={() => addProduct(product.id)} 
                    className="p-4 rounded-lg bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-400 transition-all text-left group"
                  >
                    <div className="font-semibold text-sm mb-1 group-hover:text-indigo-600">{product.name}</div>
                    <div className="text-xs text-slate-500 mb-2">{product.category}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">{product.base_cost} RON</span>
                      <Badge variant="outline" className="text-xs">+ Adaugă</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingOffer} onOpenChange={() => setViewingOffer(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalii complete ofertă</DialogTitle>
          </DialogHeader>
          
          {viewingOffer && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${viewingOffer.isOverBudget ? 'bg-slate-100 opacity-80' : 'bg-indigo-50'}`}>
                <h3 className={`font-semibold mb-2 ${viewingOffer.isOverBudget ? 'text-slate-600' : ''}`}>
                  {viewingOffer.atelier_name}
                  {viewingOffer.isOverBudget && (
                    <Badge variant="outline" className="border-slate-400 text-slate-500 text-xs ml-2">Peste buget</Badge>
                  )}
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Total</p>
                    <p className={`font-bold text-lg ${viewingOffer.isOverBudget ? 'text-slate-600' : ''}`}>{viewingOffer.total_cost.toFixed(2)} RON</p>
                  </div>
                  <div>
                    <p className="text-slate-500">{viewingOffer.budget_remaining >= 0 ? 'Buget rămas' : 'Depășire buget'}</p>
                    <p className={`font-bold text-lg ${viewingOffer.isOverBudget ? 'text-red-500' : 'text-emerald-600'}`}>
                      {viewingOffer.budget_remaining >= 0 ? '' : '-'}{Math.abs(viewingOffer.budget_remaining).toFixed(2)} RON
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Lead time</p>
                    <p className={`font-bold ${viewingOffer.isOverBudget ? 'text-slate-600' : ''}`}>{viewingOffer.lead_time_days} zile</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-4 text-lg">Detalii comandă</h4>

                {/* Lista produse */}
                <div className="space-y-2 mb-6">
                  {viewingOffer.order_items.map((item, idx) => {
                    const hasPersonalization = item.offer?.technique && item.offer.technique !== 'none';
                    const selectedSizes = Object.entries(item.sizes).filter(([s, q]) => q > 0).map(([s, q]) => `${s}:${q}`).join(', ');

                    return (
                      <div key={idx} className="bg-white border-2 border-slate-200 rounded-lg p-3">
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-start">
                          {/* Stânga - Produs */}
                          <div>
                            <div className="font-semibold text-sm mb-1">{item.product_name} - {item.color}</div>
                            <div className="text-xs text-slate-500 mb-2">{item.quantity} buc • {selectedSizes}</div>
                            <div className="text-xs text-slate-600">
                              <span className="font-semibold">{item.offer.base_product_cost.toFixed(2)} RON</span>/buc
                            </div>
                          </div>

                          {/* Mijloc - Personalizare */}
                          <div className="border-l border-slate-200 pl-4">
                            {hasPersonalization ? (
                              <>
                                <Badge className="bg-[#1F3A5F] text-white text-[10px] mb-1">{item.offer.technique}</Badge>
                                <div className="text-[10px] text-slate-500 mb-1">{item.offer.zone_label}</div>
                                <div className="text-xs text-slate-600">
                                  <span className="font-semibold">{(item.offer.personalization_cost_per_unit || 0).toFixed(2)} RON</span>/buc
                                  {item.offer.setup_fee > 0 && <div className="text-[10px]">+{item.offer.setup_fee.toFixed(2)} setup</div>}
                                </div>
                              </>
                            ) : (
                              <Badge variant="outline" className="text-slate-500 text-[10px]">Fără personalizare</Badge>
                            )}
                          </div>

                          {/* Dreapta - Total */}
                          <div className="text-right border-l border-slate-200 pl-4">
                            <div className="text-[10px] text-slate-500 mb-1">Total</div>
                            <div className="text-xl font-bold text-[#1F3A5F]">{item.offer.total_cost.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-500">RON</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sumar general */}
                <div className="bg-slate-100 border-2 border-slate-300 rounded-lg p-5">
                  <div className="space-y-2 text-sm mb-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Subtotal produse:</span>
                      <span className="font-semibold">{viewingOffer.order_items.reduce((sum, item) => sum + (item.offer.base_product_cost * item.quantity), 0).toFixed(2)} RON</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Subtotal personalizări:</span>
                      <span className="font-semibold">{viewingOffer.order_items.reduce((sum, item) => sum + ((item.offer.personalization_cost_per_unit || 0) * item.quantity), 0).toFixed(2)} RON</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total setup:</span>
                      <span className="font-semibold">{viewingOffer.order_items.reduce((sum, item) => sum + (item.offer.setup_fee || 0), 0).toFixed(2)} RON</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t-2 border-slate-400 flex justify-between items-baseline">
                    <span className="text-lg font-bold text-slate-900">TOTAL COMANDĂ</span>
                    <span className="text-3xl font-bold text-[#1F3A5F]">{viewingOffer.total_cost.toFixed(2)} RON</span>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => { setViewingOffer(null); handleSelectOffer(viewingOffer); }} 
                disabled={viewingOffer.isOverBudget}
                className={`w-full ${viewingOffer.isOverBudget ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-500 hover:bg-indigo-600'}`}
              >
                {!viewingOffer.isOverBudget && <Zap className="w-4 h-4 mr-2" />}
                {viewingOffer.isOverBudget ? 'Peste buget - indisponibil' : 'Comandă acum'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}