/**
 * New Pricing Engine - Rule-based pricing cu PersonalizationPricing
 * 
 * Formula: 
 * total_cost = product_cost + personalization_cost + logistics
 * final_price = total_cost * (1 + platform_margin_pct)
 */

export function calculatePersonalizationCost(type, params, pricingRules) {
  // params: { qty, num_colors, stitch_count, is_rush }
  const { qty, num_colors = 1, stitch_count = 0, is_rush = false } = params;
  
  // Find matching pricing rule
  let rule = null;
  
  if (type === 'embroidery') {
    // Match by stitch count tier
    rule = pricingRules.find(r => 
      r.type === 'embroidery' && 
      stitch_count >= r.min_stitch_count && 
      stitch_count <= r.max_stitch_count
    );
  } else {
    rule = pricingRules.find(r => r.type === type);
  }
  
  if (!rule) {
    console.warn(`No pricing rule found for type: ${type}`);
    return { cost: 0, breakdown: {}, error: 'No pricing rule found' };
  }
  
  let cost = 0;
  const breakdown = {};
  
  switch (type) {
    case 'embroidery':
      // Formula: digitizing_fee + (stitch_count * stitch_rate) + (per_piece_handling * qty)
      breakdown.digitizing_fee = rule.digitizing_fee || 0;
      breakdown.stitch_cost = stitch_count * (rule.stitch_rate_per_stitch || 0);
      breakdown.handling_cost = (rule.per_piece_handling || 0) * qty;
      cost = breakdown.digitizing_fee + breakdown.stitch_cost + breakdown.handling_cost;
      break;
      
    case 'screen_print':
      // Formula: (setup_per_color * colors) + (price_per_piece_per_color * colors * qty)
      breakdown.setup_cost = (rule.setup_fee_per_color || 0) * num_colors;
      breakdown.print_cost = (rule.price_per_piece_per_color || 0) * num_colors * qty;
      cost = breakdown.setup_cost + breakdown.print_cost;
      break;
      
    case 'dtg':
    case 'dtf':
    case 'sublimation':
      // Formula: price_per_piece * qty
      breakdown.unit_cost = rule.price_per_piece || 0;
      cost = breakdown.unit_cost * qty;
      break;
      
    case 'patch':
      // Formula: setup + (price_per_piece * qty)
      breakdown.setup_cost = rule.setup_fee_per_color || 0;
      breakdown.piece_cost = (rule.price_per_piece || 0) * qty;
      cost = breakdown.setup_cost + breakdown.piece_cost;
      break;
      
    default:
      cost = 0;
  }
  
  // Apply rush multiplier
  if (is_rush && rule.rush_multiplier) {
    cost *= rule.rush_multiplier;
    breakdown.rush_applied = true;
    breakdown.rush_multiplier = rule.rush_multiplier;
  }
  
  return {
    cost,
    breakdown,
    rule_used: {
      type: rule.type,
      tier: rule.size_tier,
      min_run: rule.min_run
    }
  };
}

export function calculateOfferWithNewPricing(request, ateliers, variants, pricingRules, platformMargin = 0.15) {
  // request: { sku, qty, personalization: { type, params }, deadline }
  const { sku, qty, personalization, deadline } = request;
  
  // Find variant (product)
  const variant = variants.find(v => v.sku === sku);
  if (!variant) {
    return { error: 'Product variant not found', sku };
  }
  
  // Calculate product cost
  const product_cost = variant.base_cost_ron * qty;
  
  // Calculate personalization cost
  let personalization_cost = 0;
  let personalization_breakdown = {};
  
  if (personalization && personalization.type && personalization.type !== 'none') {
    const persResult = calculatePersonalizationCost(
      personalization.type, 
      { ...personalization.params, qty }, 
      pricingRules
    );
    personalization_cost = persResult.cost;
    personalization_breakdown = persResult.breakdown;
    
    // Check min_run
    if (persResult.rule_used && persResult.rule_used.min_run && qty < persResult.rule_used.min_run) {
      return {
        error: `Cantitate minimă pentru ${personalization.type}: ${persResult.rule_used.min_run}`,
        min_qty: persResult.rule_used.min_run
      };
    }
  }
  
  // Find matching ateliers
  const eligibleAteliers = ateliers.filter(atelier => {
    if (atelier.status !== 'active') return false;
    if (atelier.min_order_qty && qty < atelier.min_order_qty) return false;
    
    // Check if atelier has required skill
    if (personalization && personalization.type) {
      const skillMap = {
        'embroidery': 'embroidery',
        'screen_print': 'screen_print',
        'dtg': 'print_dtg',
        'dtf': 'dtf',
        'sublimation': 'sublimation',
        'patch': 'patches'
      };
      const requiredSkill = skillMap[personalization.type];
      if (requiredSkill && !atelier.skills?.includes(requiredSkill)) {
        return false;
      }
    }
    
    return true;
  });
  
  if (eligibleAteliers.length === 0) {
    return { error: 'No eligible ateliers found for this request' };
  }
  
  // Generate offers for each atelier
  const offers = eligibleAteliers.map(atelier => {
    // Simple logistics estimate (could be enhanced)
    const logistics_estimate = qty > 100 ? 50 : 30;
    
    // Calculate costs
    const net_cost = product_cost + personalization_cost + logistics_estimate;
    
    // Apply atelier markup
    const atelier_markup = net_cost * ((atelier.base_markup_pct || 15) / 100);
    
    // Apply platform margin
    const platform_margin_cost = (net_cost + atelier_markup) * platformMargin;
    
    const final_price = net_cost + atelier_markup + platform_margin_cost;
    
    // Calculate lead time
    let estimated_lead_days = atelier.avg_lead_time_days || 7;
    
    // Check if rush
    const is_rush = deadline && new Date(deadline) < new Date(Date.now() + estimated_lead_days * 24 * 60 * 60 * 1000);
    
    return {
      atelier_id: atelier.id,
      atelier_name: atelier.name,
      atelier_city: atelier.city,
      product: {
        sku: variant.sku,
        name: variant.product_name,
        color: variant.color,
        size: variant.size,
        qty: qty
      },
      cost_breakdown: {
        product_cost,
        personalization_cost,
        personalization_details: personalization_breakdown,
        logistics: logistics_estimate,
        atelier_markup,
        platform_margin: platform_margin_cost,
        net_cost,
        final_price
      },
      estimated_delivery_days: estimated_lead_days,
      is_rush,
      skills_matched: atelier.skills,
      capacity_available: atelier.weekly_capacity
    };
  });
  
  // Sort by final price
  offers.sort((a, b) => a.cost_breakdown.final_price - b.cost_breakdown.final_price);
  
  return {
    success: true,
    offers,
    product_info: variant,
    personalization_requested: personalization
  };
}