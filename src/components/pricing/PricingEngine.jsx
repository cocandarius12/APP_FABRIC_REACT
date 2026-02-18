// Pricing Engine - Calculează prețuri și selectează ateliere

const PERSONALIZATION_BASE_COSTS = {
  print_dtg: { small: 8, medium: 15, large: 25, xlarge: 40 },
  print_screen: { small: 5, medium: 10, large: 18, xlarge: 30 },
  broderie: { small: 12, medium: 22, large: 35, xlarge: 50 },
  sublimation: { small: 10, medium: 18, large: 28, xlarge: 45 },
  patch: { small: 15, medium: 25, large: 35, xlarge: 45 },
  vinyl: { small: 6, medium: 12, large: 20, xlarge: 32 }
};

const SETUP_FEES = {
  print_dtg: 50,
  print_screen: 150,
  broderie: 80,
  sublimation: 60,
  patch: 100,
  vinyl: 40
};

const COLOR_FEES = {
  print_screen: 25, // per culoare adițională pentru serigrafie
  default: 5
};

const POSITION_MULTIPLIERS = {
  1: 1,
  2: 1.7,
  3: 2.3,
  4: 2.8,
  5: 3.2
};

const RUSH_MULTIPLIERS = {
  rapid: 1.35,   // +35% pentru livrare rapidă
  economic: 1.0,  // preț standard
  premium: 1.15   // +15% pentru calitate premium
};

const VOLUME_DISCOUNTS = [
  { minQty: 500, discount: 0.15 },
  { minQty: 200, discount: 0.10 },
  { minQty: 100, discount: 0.05 },
  { minQty: 50, discount: 0.02 }
];

export function calculateOrderPrice(order, product, priceMatrix = null) {
  const qty = order.quantity || 1;
  
  // 1. Cost bază produs
  const baseCost = product?.base_cost || 25;
  const manufacturingCost = product?.manufacturing_cost || 5;
  
  // 2. Cost personalizare
  const persType = order.personalization_type || 'print_dtg';
  const persSize = order.personalization_size || 'medium';
  const numPositions = order.personalization_positions?.length || 1;
  const numColors = order.num_colors || 1;
  
  let personalizationCostPerUnit = PERSONALIZATION_BASE_COSTS[persType]?.[persSize] || 15;
  
  // Multiplier pentru poziții multiple
  personalizationCostPerUnit *= POSITION_MULTIPLIERS[Math.min(numPositions, 5)] || 1;
  
  // Taxa per culoare (relevant pentru serigrafie)
  const colorFee = (numColors - 1) * (COLOR_FEES[persType] || COLOR_FEES.default);
  
  // 3. Setup fee (one-time)
  const setupFee = SETUP_FEES[persType] || 50;
  
  // 4. Cost per unitate înainte de discount
  let unitCost = baseCost + manufacturingCost + personalizationCostPerUnit;
  
  // 5. Volume discount
  const volumeDiscount = VOLUME_DISCOUNTS.find(d => qty >= d.minQty)?.discount || 0;
  unitCost = unitCost * (1 - volumeDiscount);
  
  // 6. Color fee distribuit pe cantitate
  unitCost += colorFee / qty;
  
  // 7. Total
  const subtotal = unitCost * qty;
  const totalPrice = subtotal + setupFee;
  
  return {
    unit_price: Math.round(unitCost * 100) / 100,
    setup_fee: setupFee,
    subtotal: Math.round(subtotal),
    total_price: Math.round(totalPrice),
    volume_discount_percent: volumeDiscount * 100,
    breakdown: {
      base_cost: baseCost,
      manufacturing_cost: manufacturingCost,
      personalization_cost: personalizationCostPerUnit,
      color_fee_per_unit: colorFee / qty
    }
  };
}

export function calculateAtelierScore(atelier, orderRequirements) {
  // Ponderi pentru scor
  const weights = {
    lead_time: 0.30,
    error_rate: 0.25,
    capacity: 0.15,
    price: 0.15,
    skills_match: 0.15
  };
  
  // Normalizare lead time (mai mic = mai bine)
  const leadTimeScore = Math.max(0, 1 - (atelier.avg_lead_time_days || 7) / 14);
  
  // Normalizare error rate (mai mic = mai bine)
  const errorScore = Math.max(0, 1 - (atelier.error_rate_percent || 5) / 20);
  
  // Normalizare capacitate (mai mult spațiu disponibil = mai bine)
  const capacityScore = Math.max(0, 1 - (atelier.current_load_percent || 50) / 100);
  
  // Normalizare preț (modificator mai mic = mai bine)
  const priceScore = Math.max(0, 1 - ((atelier.price_modifier || 1) - 0.8) / 0.4);
  
  // Skills match
  const requiredSkill = orderRequirements?.personalization_type;
  const hasSkill = atelier.skills?.includes(requiredSkill) ? 1 : 0;
  
  // Verificare cantitate minimă
  if (orderRequirements?.quantity < (atelier.min_qty || 0)) {
    return 0; // Nu poate prelua comanda
  }
  
  // Calcul scor final
  const score = (
    leadTimeScore * weights.lead_time +
    errorScore * weights.error_rate +
    capacityScore * weights.capacity +
    priceScore * weights.price +
    hasSkill * weights.skills_match
  ) * 100;
  
  return Math.round(score * 10) / 10;
}

export function selectBestAteliers(ateliers, orderRequirements, count = 3) {
  // Filtrează atelierele active care pot prelua comanda
  const eligibleAteliers = ateliers.filter(a => {
    if (a.status !== 'active') return false;
    if (a.current_load_percent >= 95) return false;
    if (!a.skills?.includes(orderRequirements.personalization_type)) return false;
    if (orderRequirements.quantity < (a.min_qty || 0)) return false;
    return true;
  });
  
  // Calculează scor pentru fiecare
  const scored = eligibleAteliers.map(atelier => ({
    ...atelier,
    calculated_score: calculateAtelierScore(atelier, orderRequirements)
  }));
  
  // Sortează după scor
  scored.sort((a, b) => b.calculated_score - a.calculated_score);
  
  return scored.slice(0, count);
}

export function generateOffers(order, product, ateliers) {
  const basePrice = calculateOrderPrice(order, product);
  const bestAteliers = selectBestAteliers(ateliers, order, 3);
  
  if (bestAteliers.length === 0) {
    return { offers: [], needsManualQuote: true };
  }
  
  const offers = [];
  
  // Oferta RAPID (cel mai rapid atelier, preț mai mare)
  const rapidAtelier = [...bestAteliers].sort((a, b) => 
    (a.avg_lead_time_days || 7) - (b.avg_lead_time_days || 7)
  )[0];
  
  if (rapidAtelier) {
    const rapidPrice = Math.round(basePrice.total_price * RUSH_MULTIPLIERS.rapid);
    offers.push({
      type: 'rapid',
      atelier_id: rapidAtelier.id,
      atelier_name: rapidAtelier.name,
      atelier_city: rapidAtelier.city,
      lead_time_days: Math.max(3, (rapidAtelier.avg_lead_time_days || 7) - 2),
      total_price: rapidPrice,
      unit_price: Math.round((rapidPrice - basePrice.setup_fee) / order.quantity * 100) / 100,
      setup_fee: basePrice.setup_fee,
      features: [
        'Producție prioritară',
        'Livrare express',
        'Confirmare în 2h',
        'Tracking în timp real'
      ]
    });
  }
  
  // Oferta ECONOMIC (cel mai ieftin)
  const economicAtelier = [...bestAteliers].sort((a, b) => 
    (a.price_modifier || 1) - (b.price_modifier || 1)
  )[0];
  
  if (economicAtelier) {
    const economicPrice = Math.round(basePrice.total_price * (economicAtelier.price_modifier || 1));
    offers.push({
      type: 'economic',
      atelier_id: economicAtelier.id,
      atelier_name: economicAtelier.name,
      atelier_city: economicAtelier.city,
      lead_time_days: economicAtelier.avg_lead_time_days || 7,
      total_price: economicPrice,
      unit_price: Math.round((economicPrice - basePrice.setup_fee) / order.quantity * 100) / 100,
      setup_fee: basePrice.setup_fee,
      features: [
        'Cel mai bun preț',
        'Calitate standard',
        'Livrare în termen',
        'Suport dedicat'
      ]
    });
  }
  
  // Oferta PREMIUM (cel mai bun scor, eroare minimă)
  const premiumAtelier = [...bestAteliers].sort((a, b) => 
    (a.error_rate_percent || 5) - (b.error_rate_percent || 5)
  )[0];
  
  if (premiumAtelier && premiumAtelier.id !== economicAtelier?.id) {
    const premiumPrice = Math.round(basePrice.total_price * RUSH_MULTIPLIERS.premium);
    offers.push({
      type: 'premium',
      atelier_id: premiumAtelier.id,
      atelier_name: premiumAtelier.name,
      atelier_city: premiumAtelier.city,
      lead_time_days: premiumAtelier.avg_lead_time_days || 7,
      total_price: premiumPrice,
      unit_price: Math.round((premiumPrice - basePrice.setup_fee) / order.quantity * 100) / 100,
      setup_fee: basePrice.setup_fee,
      features: [
        'Calitate superioară',
        'Control QA extins',
        'Garanție extinsă',
        'Manager dedicat'
      ]
    });
  }
  
  return { offers, needsManualQuote: false };
}

export function estimateLeadTime(atelier, order) {
  const baseLeadTime = atelier.avg_lead_time_days || 7;
  const loadFactor = (atelier.current_load_percent || 50) / 100;
  
  // Ajustare pentru încărcare
  let adjusted = baseLeadTime * (1 + loadFactor * 0.3);
  
  // Ajustare pentru cantitate mare
  if (order.quantity > 500) adjusted += 2;
  else if (order.quantity > 200) adjusted += 1;
  
  // Safety margin 20%
  adjusted *= 1.2;
  
  return Math.ceil(adjusted);
}