/**
 * STRICT BUDGET CALCULATOR
 * Hard constraints - no fallbacks, no silent errors
 */

export function calculateStrictOffers(
  budget,
  targetQuantity,
  zoneId,
  techniquePreference, // "DTG", "BRODERIE", null (auto)
  category,
  products,
  ateliers,
  zones
) {
  // VALIDARE 1: INPUT
  if (!budget || budget <= 0) {
    return { error: "INVALID_BUDGET", message: "Bugetul trebuie să fie mai mare ca 0." };
  }
  
  if (!targetQuantity || targetQuantity <= 0) {
    return { error: "INVALID_QUANTITY", message: "Cantitatea trebuie să fie mai mare ca 0." };
  }

  // VALIDARE 2: ZONA
  const zone = zones.find(z => z.id_zone === zoneId && z.is_active);
  if (!zone) {
    return { error: "INVALID_ZONE", message: "Zona de personalizare selectată nu este validă." };
  }

  if (!zone.area_cm2 || zone.area_cm2 <= 0) {
    return { error: "INVALID_ZONE_AREA", message: "Zona selectată nu are o suprafață validă." };
  }

  // Filtrare produse după categorie
  const categoryProducts = products.filter(p => p.category === category && p.is_active);
  if (categoryProducts.length === 0) {
    return { error: "NO_PRODUCTS", message: "Nu există produse pentru categoria selectată." };
  }

  // Filtrare ateliere active
  const activeAteliers = ateliers.filter(a => a.status === 'active');
  if (activeAteliers.length === 0) {
    return { error: "NO_ATELIERS", message: "Nu există ateliere disponibile momentan." };
  }

  console.log('[CALCULATOR] Ateliere active:', activeAteliers.length);
  console.log('[CALCULATOR] Primele 2 ateliere:', activeAteliers.slice(0, 2).map(a => ({
    name: a.name,
    has_techniques: !!a.personalization_techniques,
    techniques_count: a.personalization_techniques?.length || 0,
    techniques: a.personalization_techniques?.map(t => t.technique)
  })));

  const offers = [];

  // Pentru fiecare atelier
  activeAteliers.forEach(atelier => {
    // Pentru fiecare tehnică a atelierului
    if (!atelier.personalization_techniques || atelier.personalization_techniques.length === 0) {
      console.warn('[CALCULATOR] Atelier skip - fără personalization_techniques:', atelier.name);
      return; // Skip atelier fără tehnici
    }

    console.log('[CALCULATOR] Procesez atelier:', atelier.name, 'cu', atelier.personalization_techniques.length, 'tehnici');

    atelier.personalization_techniques.forEach(technique => {
      // VALIDARE 3: TEHNICĂ COMPLETĂ
      if (!technique.technique || 
          technique.cost_per_cm2 === undefined || 
          technique.min_cost_per_piece === undefined ||
          technique.setup_fee === undefined ||
          technique.min_qty === undefined ||
          technique.max_area_cm2 === undefined) {
        console.warn('[CALCULATOR] Tehnică invalidă:', {
          atelier: atelier.name,
          technique: technique.technique,
          missing_fields: {
            technique: !technique.technique,
            cost_per_cm2: technique.cost_per_cm2 === undefined,
            min_cost_per_piece: technique.min_cost_per_piece === undefined,
            setup_fee: technique.setup_fee === undefined,
            min_qty: technique.min_qty === undefined,
            max_area_cm2: technique.max_area_cm2 === undefined
          }
        });
        return; // Skip tehnică invalidă
      }

      // Verifică dacă tehnica e permisă pentru zona selectată
      if (!zone.allowed_techniques.includes(technique.technique)) {
        console.log('[CALCULATOR] Tehnică nu e permisă în zonă:', {
          technique: technique.technique,
          zone: zone.label_client,
          allowed: zone.allowed_techniques
        });
        return;
      }

      // Dacă user a specificat tehnică preferată, filtrează
      if (techniquePreference && technique.technique !== techniquePreference) {
        console.log('[CALCULATOR] Tehnică nu match preferință:', technique.technique, 'vs', techniquePreference);
        return;
      }

      console.log('[CALCULATOR] ✅ Procesez tehnică:', technique.technique, 'pentru', atelier.name);

      // VALIDARE 4: CANTITATE MINIMĂ
      if (targetQuantity < technique.min_qty) {
        console.log('[CALCULATOR] Cantitate sub minim:', {
          atelier: atelier.name,
          technique: technique.technique,
          requested: targetQuantity,
          min_required: technique.min_qty
        });
        return; // Cantitate sub minim
      }

      // VALIDARE 5: ARIE MAXIMĂ
      if (zone.area_cm2 > technique.max_area_cm2) {
        console.log('[CALCULATOR] Zonă prea mare:', {
          zone_area: zone.area_cm2,
          max_area: technique.max_area_cm2
        });
        return; // Zona prea mare pentru tehnică
      }

      console.log('[CALCULATOR] ✅ Tehnică validă:', {
        atelier: atelier.name,
        technique: technique.technique,
        zone: zone.label_client
      });

      // Pentru fiecare produs
      categoryProducts.forEach(product => {
        // VALIDARE CRITICĂ: base_cost OBLIGATORIU
        if (product.base_cost === undefined || product.base_cost === null) {
          console.error('[CALCULATOR ERROR] Produs fără base_cost:', product.name, product.id);
          return; // Skip produs invalid
        }

        const baseProductCost = product.base_cost;

        // CALCUL COST PERSONALIZARE PER BUCATĂ
        const personalizationCostPerUnit = Math.max(
          technique.cost_per_cm2 * zone.area_cm2,
          technique.min_cost_per_piece
        );

        // Validare numerică
        if (isNaN(personalizationCostPerUnit) || !isFinite(personalizationCostPerUnit)) {
          console.error('[CALCULATOR ERROR] personalizationCostPerUnit invalid:', {
            cost_per_cm2: technique.cost_per_cm2,
            area_cm2: zone.area_cm2,
            min_cost: technique.min_cost_per_piece,
            result: personalizationCostPerUnit
          });
          return;
        }

        // CALCUL COST TOTAL
        const priceModifier = technique.price_modifier || 1.0;
        const atelierModifier = atelier.price_modifier || 1.0;
        
        const unitPrice = (baseProductCost + personalizationCostPerUnit) * priceModifier;
        const subtotal = targetQuantity * unitPrice;
        const totalCost = subtotal * atelierModifier + technique.setup_fee;

        // DEBUG LOGGING pentru detectare bug-uri
        if (totalCost > budget) {
          console.log('[CALCULATOR DEBUG] Ofertă respinsă - depășește buget:', {
            product: product.name,
            atelier: atelier.name,
            technique: technique.technique,
            base_cost: baseProductCost,
            personalization_per_unit: personalizationCostPerUnit,
            unit_price: unitPrice,
            quantity: targetQuantity,
            subtotal: subtotal,
            atelier_modifier: atelierModifier,
            setup_fee: technique.setup_fee,
            total_cost: totalCost,
            budget: budget,
            exceeded_by: totalCost - budget
          });
        }

        // Validare numerică finală
        if (isNaN(totalCost) || !isFinite(totalCost)) {
          console.error('[CALCULATOR ERROR] totalCost invalid:', {
            baseProductCost,
            personalizationCostPerUnit,
            unitPrice,
            subtotal,
            atelierModifier,
            setup_fee: technique.setup_fee,
            totalCost
          });
          return;
        }

        // VALIDARE 6: HARD BUDGET CONSTRAINT
        if (totalCost > budget) {
          return; // REJECT - depășește bugetul
        }

        // OFERTA ESTE VALIDĂ
        const leadTime = (atelier.avg_lead_time_days || 7) + (technique.lead_time_modifier_days || 0);
        
        offers.push({
          product: product,
          atelier_id: atelier.id,
          atelier_name: atelier.name,
          technique: technique.technique,
          zone_id: zone.id_zone,
          zone_label: zone.label_client,
          quantity: targetQuantity,
          base_product_cost: baseProductCost,
          personalization_cost_per_unit: personalizationCostPerUnit,
          unit_price: unitPrice,
          setup_fee: technique.setup_fee,
          total_cost: totalCost,
          lead_time_days: leadTime,
          budget_remaining: budget - totalCost
        });
      });
    });
  });

  if (offers.length === 0) {
    console.warn('[CALCULATOR] Zero oferte generate pentru:', {
      budget,
      targetQuantity,
      zoneId,
      category,
      techniquePreference,
      total_products: categoryProducts.length,
      total_ateliers: activeAteliers.length
    });
    
    return { 
      error: "BUDGET_INSUFFICIENT", 
      message: `Bugetul de ${budget.toFixed(2)} RON nu este suficient pentru ${targetQuantity} bucăți cu personalizarea selectată. Verifică configurația sau crește bugetul.`
    };
  }

  // Sortare: preț total crescător (mai ieftin = mai bun)
  offers.sort((a, b) => a.total_cost - b.total_cost);

  return { offers: offers.slice(0, 6) };
}

/**
 * Validează parametrii înainte de calcul
 */
export function validateCalculatorInput(budget, quantity, zoneId) {
  const errors = [];
  
  if (!budget || budget <= 0) {
    errors.push("Bugetul este obligatoriu și trebuie să fie mai mare ca 0");
  }
  
  if (!quantity || quantity <= 0) {
    errors.push("Cantitatea este obligatorie și trebuie să fie mai mare ca 0");
  }
  
  if (!zoneId) {
    errors.push("Selectează zona de personalizare");
  }
  
  return errors;
}