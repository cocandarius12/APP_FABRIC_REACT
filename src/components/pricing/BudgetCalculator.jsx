// Calculează oferte bazate pe buget (budget-first approach)

export function calculateBudgetBasedOffers(
  budget,
  targetQuantity,
  personalizationType,
  personalizationAreaCm2,
  category,
  products,
  ateliers
) {
  const offers = [];
  
  // Filtrează produse după categorie
  const categoryProducts = products.filter(p => p.category === category);
  
  // Filtrează ateliere care pot face tipul de personalizare
  const suitableAteliers = ateliers.filter(a => 
    a.skills?.includes(personalizationType) && 
    a.status === 'active' &&
    (a.min_qty || 0) <= targetQuantity
  );

  if (suitableAteliers.length === 0 || categoryProducts.length === 0) {
    return [];
  }

  // Pentru fiecare atelier și produs, calculează ce cantitate poate fi comandată
  suitableAteliers.forEach(atelier => {
    categoryProducts.forEach(product => {
      // Calculează costul de personalizare per unitate
      const personalizationUnitCost = calculatePersonalizationCost(
        atelier,
        personalizationType,
        personalizationAreaCm2
      );

      const setupFee = atelier.setup_fee || 0;
      const productBaseCost = product.base_cost || 0;
      
      // Cost total per unitate (produs + personalizare)
      const costPerUnit = productBaseCost + personalizationUnitCost;
      
      // Calculează câte bucăți pot fi cumpărate cu bugetul disponibil
      // Budget = (quantity * costPerUnit) + setupFee
      // quantity = (Budget - setupFee) / costPerUnit
      
      if (budget <= setupFee) {
        return; // Buget insuficient pentru setup
      }
      
      // Verifică dacă bugetul permite cantitatea țintă
      const costForTargetQuantity = (targetQuantity * costPerUnit) + setupFee;
      
      if (costForTargetQuantity > budget) {
        return; // Buget insuficient pentru cantitatea cerută
      }
      
      if (targetQuantity < (atelier.min_qty || 0)) {
        return; // Cantitate sub minimul atelierului
      }

      // Aplică discount pe volum dacă există
      let finalCostPerUnit = costPerUnit;
      const volumeDiscount = getVolumeDiscount(targetQuantity);
      if (volumeDiscount > 0) {
        finalCostPerUnit = costPerUnit * (1 - volumeDiscount);
      }

      const totalCost = (targetQuantity * finalCostPerUnit) + setupFee;
      
      // HARD CONSTRAINT: totalCost TREBUIE să fie <= budget
      if (totalCost <= budget) {
        offers.push({
          product: product,
          atelier_id: atelier.id,
          atelier_name: atelier.name,
          quantity: targetQuantity,
          product_unit_price: productBaseCost,
          personalization_unit_cost: personalizationUnitCost,
          unit_price: finalCostPerUnit,
          setup_fee: setupFee,
          personalization_cost: (targetQuantity * personalizationUnitCost) + setupFee,
          total_price: totalCost,
          lead_time_days: estimateLeadTime(atelier, targetQuantity),
          volume_discount: volumeDiscount
        });
      }
    });
  });

  // Sortează ofertele: cel mai bun preț total (mai jos = mai bun)
  offers.sort((a, b) => {
    return a.total_price - b.total_price;
  });

  return offers.slice(0, 6); // Returnează top 6 oferte
}

function calculatePersonalizationCost(atelier, type, areaCm2) {
  const costs = atelier.personalization_costs;
  
  if (!costs || !costs[type]) {
    // Fallback la costuri estimate
    const fallbackCosts = {
      print_dtg: 0.15,
      print_screen: 0.10,
      broderie: 0.25,
      sublimation: 0.12,
      patch: 0.20,
      vinyl: 0.18
    };
    
    const costPerCm2 = fallbackCosts[type] || 0.15;
    const baseCost = areaCm2 * costPerCm2;
    
    return Math.max(baseCost, 10); // Cost minim 10 RON
  }

  // Calculează din fișa atelierului
  const typeCosts = costs[type];
  const costPerCm2 = typeCosts.cost_per_cm2 || 0.15;
  const minCost = typeCosts.min_cost || 10;
  
  const cost = areaCm2 * costPerCm2;
  
  return Math.max(cost, minCost);
}

function getVolumeDiscount(quantity) {
  if (quantity >= 500) return 0.15;
  if (quantity >= 200) return 0.10;
  if (quantity >= 100) return 0.05;
  return 0;
}

function estimateLeadTime(atelier, quantity) {
  const baseLeadTime = atelier.avg_lead_time_days || 7;
  const currentLoad = (atelier.current_load_percent || 0) / 100;
  const capacity = atelier.capacity_per_week || 1000;
  
  const weeksNeeded = quantity / capacity;
  const loadMultiplier = 1 + (currentLoad * 0.5);
  
  return Math.ceil((baseLeadTime + (weeksNeeded * 7)) * loadMultiplier);
}