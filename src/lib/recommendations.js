// Generate actionable, time-sensitive recommendations based on
// farmer profile + current date + zone + soil + livestock

export function getRecommendations(profile, weather) {
  if (!profile?.zone) return []

  const now = new Date()
  const month = now.getMonth() // 0=Jan
  const zone = profile.zone
  const hasLivestock = Object.keys(profile.livestock || {}).length > 0
  const cattle = profile.livestock?.cattle || 0
  const chickens = profile.livestock?.chickens || 0
  const pigs = profile.livestock?.pigs || 0
  const crops = profile.crops || []
  const soilHealth = assessSoilHealth(profile)
  const adults = parseInt(profile.adults) || 1
  const hasWater = profile.waterAccess && profile.waterAccess !== 'none'
  const hasGarden = profile.irrigatedGarden === true

  const recs = []

  // ── DRY SEASON WATER/GARDEN (May-Sep) ──
  if (month >= 4 && month <= 8) {
    if (hasWater && !hasGarden) {
      recs.push({
        priority: 'high',
        icon: '💧',
        title: 'Start a dry-season vegetable garden',
        body: `You have water (${profile.waterAccess}) but no garden yet. Rape, tomato, onion, cabbage grow through the dry season and give you cash every week. This reduces pressure to sell maize early at harvest when prices are lowest.`,
        tag: 'Income gap',
      })
    }
    if (hasWater && hasGarden) {
      recs.push({
        priority: 'medium',
        icon: '🥬',
        title: 'Dry-season garden income',
        body: 'Keep your vegetable garden producing. Succession planting every 2-3 weeks ensures continuous harvest. Rape and leafy greens are fastest (4-6 weeks to harvest).',
        tag: 'Ongoing',
      })
    }
  }

  // ── AUGUST-SEPTEMBER: Critical prep deadline ──
  if (month === 7 || month === 8) {
    recs.push({
      priority: 'high',
      icon: '⏰',
      title: 'Prepare now — rains start in 6-8 weeks',
      body: zone === 'I'
        ? 'Dig planting basins now (15cm deep, crop spacing). Apply manure in each basin. When rains come you plant immediately — late planting in Zone I costs 10-15% yield per week.'
        : 'Clear planting strips along your rows. Do NOT plough the whole field. Leave inter-row residue as mulch. Apply improved manure in strips 10-15cm wide, 10-15cm deep.',
      tag: 'Deadline: end of September',
    })

    if (cattle > 0 || Object.keys(profile.livestock || {}).length > 0) {
      recs.push({
        priority: 'high',
        icon: '💩',
        title: 'Compost must be started NOW',
        body: 'Compost takes 6-8 weeks to mature. If you start now, it will be ready for November planting. Cover your manure heap, mix 2:1 with green material, turn every 2 weeks.',
        tag: 'Deadline: start this week',
      })
    }

    recs.push({
      priority: 'medium',
      icon: '🫘',
      title: 'Source pigeon pea seed',
      body: 'You need 15 kg/ha. Check local farmers who already grow it (K100-200) or seed companies (K200-400). This seed lasts 3 years — one purchase, three harvests.',
      tag: 'Before rains',
    })
  }

  // October-November: Pre-planting / early planting
  if (month >= 9 && month <= 10) {
    recs.push({
      priority: 'high',
      icon: '🌧️',
      title: 'Prepare for planting season',
      body: zone === 'I'
        ? 'Dig planting basins now while soil is dry. 15cm deep × 15cm wide at your crop spacing. Apply manure in the basin. When first rains come, you\'re ready.'
        : 'Clear planting strips (15-20cm wide) along your rows. Leave inter-row residue in place as mulch. Do NOT burn your crop residues.',
      tag: 'Do this week',
    })

    if (crops.includes('maize')) {
      recs.push({
        priority: 'high',
        icon: '🌽',
        title: 'Plan your maize-pigeon pea intercrop',
        body: 'Get pigeon pea seed now (15 kg/ha, K100-200 from local farmers). You\'ll plant it in the same hole as maize on planting day. One planting, three years of harvest.',
        tag: 'Before rains start',
      })
    }

    if (cattle > 0) {
      recs.push({
        priority: 'medium',
        icon: '💩',
        title: `Your ${cattle} cattle = free fertiliser`,
        body: `Cover your manure heap now. Mix in green material (weeds, legume cuttings). In 6-8 weeks you'll have concentrated manure ready for strip application at planting. ${cattle >= 3 ? `With ${cattle} cattle you have enough for at least 1 hectare.` : 'Even 2-3 cattle produce meaningful manure for a small field.'}`,
        tag: 'Start today',
      })
    }
  }

  // November-December: Planting
  if (month >= 10 && month <= 11) {
    const hasRainSoon = weather?.daily?.precipitation_probability_max?.some(p => p > 50)

    if (hasRainSoon) {
      recs.push({
        priority: 'high',
        icon: '🌱',
        title: 'Rain coming — plant now',
        body: 'Plant within 1-2 days of first good rains (>20mm). If intercropping with pigeon pea, drop both seeds in the same hole. Maize at 90cm × 30cm spacing.',
        tag: 'Urgent',
      })
    }

    recs.push({
      priority: 'medium',
      icon: '🫘',
      title: 'Plant cowpea between rows',
      body: 'Wait 2-3 weeks after maize emergence, then plant spreading cowpea varieties between your maize rows. Ground cover, weed suppression, and food. Three benefits from one action.',
      tag: '2-3 weeks after planting',
    })
  }

  // December-February: Growing season
  if (month === 11 || month === 0 || month === 1) {
    recs.push({
      priority: 'medium',
      icon: '🌿',
      title: 'Relay-plant velvet bean into standing maize',
      body: '4-6 weeks after maize emergence, plant velvet bean in the inter-row. It grows slowly under maize, then explodes after harvest — covering your soil through the dry season. 100-150 kg nitrogen/ha fixed for free.',
      tag: zone === 'I' ? 'If rainfall is adequate' : 'Good conditions',
    })

    if (cattle > 0) {
      recs.push({
        priority: 'medium',
        icon: '💩',
        title: 'Second manure application',
        body: 'Apply strip manure alongside crop rows at 4-6 weeks (time with weeding so you can incorporate it). Most nitrogen from first application is used up by now.',
        tag: 'At weeding time',
      })
    }
  }

  // March-April: Pre-harvest
  if (month === 2 || month === 3) {
    if (crops.includes('maize')) {
      recs.push({
        priority: 'medium',
        icon: '🌽',
        title: 'Plan your harvest — don\'t sell all at once',
        body: 'Maize prices are LOWEST at harvest (K150-250/bag) when everyone sells. Store what you can and sell later. If you have pigeon pea or groundnut, those prices hold better.',
        tag: 'Before harvest',
      })
    }

    recs.push({
      priority: 'high',
      icon: '🚫',
      title: 'Do NOT burn crop residues',
      body: 'After harvest, leave stalks on the field as mulch. This is next season\'s water conservation and soil biology food. Burning destroys organic matter that took an entire season to build.',
      tag: 'Critical',
    })
  }

  // April-May: Harvest + dry season start
  if (month === 3 || month === 4) {
    if (chickens > 0) {
      recs.push({
        priority: 'medium',
        icon: '🐔',
        title: `Move your ${chickens} chickens through harvested fields`,
        body: 'After harvest, let chickens work the field — they eat pest larvae, scratch manure into soil, and control termites. A simple mobile cage (3m × 2m) moved daily concentrates the benefit.',
        tag: 'After harvest',
      })
    }

    if (pigs > 0) {
      recs.push({
        priority: 'medium',
        icon: '🐷',
        title: 'Pig tractor on harvested field',
        body: `Run your ${pigs} pigs through harvested fields in a mobile cage (12m × 4m). They root out weeds, break soil crust, and deposit concentrated manure. Replaces hand-hoeing for next season's land prep.`,
        tag: 'After harvest',
      })
    }
  }

  // May-September: Dry season
  if (month >= 4 && month <= 8) {
    if (cattle >= 5) {
      recs.push({
        priority: 'medium',
        icon: '🐄',
        title: 'Dry season grazing management',
        body: `With ${cattle} cattle, talk to neighbouring farmers about combining herds for rotational grazing. Graze each paddock 2-3 days, then rest 60-90 days. Even 30 cattle together have meaningful impact. And stop burning the grassland.`,
        tag: 'Ongoing',
      })
    }

    recs.push({
      priority: 'low',
      icon: '🌳',
      title: 'Plant Faidherbia albida seedlings',
      body: 'The dry season is good for establishing tree seedlings if you can water them. Faidherbia is the highest-value tree investment — it drops leaves in the rainy season (no shade on crops!) and maize yields are 100-400% higher under mature trees. 5-8 year investment.',
      tag: 'Long-term',
    })

    if (soilHealth === 'poor') {
      recs.push({
        priority: 'high',
        icon: '🪱',
        title: 'Your soil needs urgent attention',
        body: 'Pale soil colour, few earthworms, and poor water infiltration mean very low organic matter. Start building NOW: cover your manure, start a compost heap, and plan to relay velvet bean next season. This is a 3-season recovery but it starts with the decision to stop burning and start feeding the soil.',
        tag: 'Foundation',
      })
    }
  }

  // June-August: Pigeon pea harvest
  if (month >= 5 && month <= 7) {
    if (crops.includes('pigeon_pea') || crops.includes('maize')) {
      recs.push({
        priority: 'medium',
        icon: '🫘',
        title: 'Pigeon pea harvest season',
        body: 'If you intercropped pigeon pea, harvest pods now. Dry and store. Current price K5-15/kg. Don\'t cut the plant — it ratoons from the root for 2 more years. Prune branches for firewood and livestock feed.',
        tag: 'Cash opportunity',
      })
    }
  }

  // ── YEAR-ROUND RECOMMENDATIONS based on profile gaps ──

  if (!crops.includes('pigeon_pea') && !crops.includes('cowpea') && (zone === 'I' || zone === 'IIa')) {
    recs.push({
      priority: 'medium',
      icon: '💡',
      title: 'You\'re missing legumes in your system',
      body: 'No pigeon pea or cowpea means you\'re buying all your nitrogen and missing out on K500-1,500/ha of cash income. Pigeon pea costs K100-200 to start and lasts 3 years. It\'s the single best investment in Zambian farming.',
      tag: 'Next season',
    })
  }

  if (!hasLivestock && soilHealth !== 'good') {
    recs.push({
      priority: 'medium',
      icon: '🌿',
      title: 'No livestock? Build soil with green manure',
      body: 'Without animal manure, your best option is composting crop residues and growing green manure crops. Velvet bean or sun hemp in the off-season. Cowpea as a dual-purpose intercrop. These fix nitrogen from the air — the same nitrogen in expensive urea bags.',
      tag: 'System design',
    })
  }

  if (adults <= 1) {
    // Filter out labour-heavy recommendations for single-adult households
    return recs.filter(r => {
      if (r.title.includes('Pig tractor') || r.title.includes('combining herds')) return false
      return true
    }).slice(0, 4)
  }

  // Return top 5 by priority
  const order = { high: 0, medium: 1, low: 2 }
  recs.sort((a, b) => order[a.priority] - order[b.priority])
  return recs.slice(0, 5)
}

function assessSoilHealth(profile) {
  let score = 0
  if (profile.soilColour === 'dark') score += 2
  else if (profile.soilColour === 'medium') score += 1

  if (profile.earthworms === 'many') score += 2
  else if (profile.earthworms === 'some') score += 1

  if (profile.waterInfiltration === 'soaks') score += 2
  else if (profile.waterInfiltration === 'slow') score += 1

  if (profile.soilData?.organicCarbon > 2) score += 2
  else if (profile.soilData?.organicCarbon > 1) score += 1

  if (score >= 6) return 'good'
  if (score >= 3) return 'moderate'
  return 'poor'
}
