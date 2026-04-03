// Manure production & nutrient calculator
// Sources: FAO, IPCC 2019, Lekasi et al. 2003, Rufino et al. 2006,
// Nyamangara et al. 2003, ICRISAT/Twomlow et al. 2010

const ANIMALS = {
  cattle: {
    label: 'Cattle',
    freshPerDay: 12,        // kg fresh manure/day (Sanga/Angoni, 300-400kg liveweight)
    collectionRate: 0.45,   // 45% collectible from overnight kraaling (6pm-6am)
    collectionWithMorning: 0.55, // +10% if held 1-2hrs before morning release
    nutrientsPerTonne: { n: 4, p: 1.5, k: 4 }, // kg per tonne fresh
  },
  goats: {
    label: 'Goats',
    freshPerDay: 1.2,
    collectionRate: 0.35,
    collectionWithMorning: 0.45,
    nutrientsPerTonne: { n: 5, p: 2.5, k: 4 },
  },
  chickens: {
    label: 'Chickens',
    freshPerDay: 0.08,
    collectionRate: 0.65,   // roost 10-12hrs, most excretion at rest
    collectionWithMorning: 0.65,
    nutrientsPerTonne: { n: 14, p: 10, k: 6.5 },
  },
  pigs: {
    label: 'Pigs',
    freshPerDay: 2.5,       // average of weaner + adult
    collectionRate: 0.90,   // penned
    collectionWithMorning: 0.90,
    nutrientsPerTonne: { n: 6, p: 4, k: 5 },
  },
}

const N_LOSS_TRADITIONAL = 0.50  // 50% nitrogen lost when uncovered
const N_LOSS_IMPROVED = 0.20     // 20% lost with improved handling
const COMPOST_WEIGHT_LOSS = 0.50 // finished compost is ~50% of input weight
const STRIP_RATE_PER_HA = 6000   // kg improved manure per ha with strip application

export function calculateManure(livestock) {
  const results = {
    animals: {},
    totals: {
      freshPerYear: 0,
      collectiblePerYear: 0,
      compostPerYear: 0,
      hectaresCovered: 0,
      nutrients: {
        traditional: { n: 0, p: 0, k: 0 },
        improved: { n: 0, p: 0, k: 0 },
      },
    },
  }

  for (const [type, count] of Object.entries(livestock)) {
    if (!count || !ANIMALS[type]) continue
    const spec = ANIMALS[type]

    const freshPerDay = spec.freshPerDay * count
    const freshPerYear = freshPerDay * 365
    const collectiblePerYear = freshPerYear * spec.collectionRate
    const compostPerYear = collectiblePerYear * COMPOST_WEIGHT_LOSS

    // Nutrients from collectible manure
    const nFresh = (collectiblePerYear / 1000) * spec.nutrientsPerTonne.n
    const pFresh = (collectiblePerYear / 1000) * spec.nutrientsPerTonne.p
    const kFresh = (collectiblePerYear / 1000) * spec.nutrientsPerTonne.k

    const nTraditional = nFresh * (1 - N_LOSS_TRADITIONAL)
    const nImproved = nFresh * (1 - N_LOSS_IMPROVED)

    results.animals[type] = {
      label: spec.label,
      count,
      freshPerDay: Math.round(freshPerDay * 10) / 10,
      freshPerYear: Math.round(freshPerYear),
      collectiblePerYear: Math.round(collectiblePerYear),
      compostPerYear: Math.round(compostPerYear),
      nTraditional: Math.round(nTraditional * 10) / 10,
      nImproved: Math.round(nImproved * 10) / 10,
    }

    results.totals.freshPerYear += freshPerYear
    results.totals.collectiblePerYear += collectiblePerYear
    results.totals.compostPerYear += compostPerYear
    results.totals.nutrients.traditional.n += nTraditional
    results.totals.nutrients.traditional.p += pFresh * (1 - N_LOSS_TRADITIONAL) // P loss is lower but simplify
    results.totals.nutrients.traditional.k += kFresh
    results.totals.nutrients.improved.n += nImproved
    results.totals.nutrients.improved.p += pFresh * (1 - N_LOSS_IMPROVED)
    results.totals.nutrients.improved.k += kFresh
  }

  // Round totals
  results.totals.freshPerYear = Math.round(results.totals.freshPerYear)
  results.totals.collectiblePerYear = Math.round(results.totals.collectiblePerYear)
  results.totals.compostPerYear = Math.round(results.totals.compostPerYear)
  results.totals.hectaresCovered = Math.round((results.totals.compostPerYear / STRIP_RATE_PER_HA) * 10) / 10

  for (const method of ['traditional', 'improved']) {
    const n = results.totals.nutrients[method]
    n.n = Math.round(n.n * 10) / 10
    n.p = Math.round(n.p * 10) / 10
    n.k = Math.round(n.k * 10) / 10
  }

  // FISP equivalence (200kg D-compound 10:20:10 + 200kg urea 46%N = 112kg N)
  results.totals.fispNEquivalent = Math.round((results.totals.nutrients.improved.n / 112) * 100)

  return results
}

// Human-readable summary for the chatbot
export function manureSummary(livestock) {
  const r = calculateManure(livestock)
  if (r.totals.freshPerYear === 0) return null

  const lines = []
  lines.push(`MANURE CALCULATOR FOR THIS FARMER:`)

  for (const a of Object.values(r.animals)) {
    lines.push(`${a.count} ${a.label}: ${a.freshPerDay} kg/day fresh, ${a.collectiblePerYear} kg/year collectible from overnight kraaling`)
  }

  lines.push(``)
  lines.push(`Total collectible: ${r.totals.collectiblePerYear} kg/year (${(r.totals.collectiblePerYear / 1000).toFixed(1)} tonnes)`)
  lines.push(`After composting (50% weight loss): ${r.totals.compostPerYear} kg (${(r.totals.compostPerYear / 1000).toFixed(1)} tonnes)`)
  lines.push(``)
  lines.push(`Nitrogen available:`)
  lines.push(`- Traditional handling (uncovered, 50% N loss): ${r.totals.nutrients.traditional.n} kg N`)
  lines.push(`- Improved handling (covered, turned, 20% N loss): ${r.totals.nutrients.improved.n} kg N`)
  lines.push(`- Improvement factor: ${(r.totals.nutrients.improved.n / Math.max(r.totals.nutrients.traditional.n, 0.1)).toFixed(1)}x more nitrogen retained`)
  lines.push(``)
  lines.push(`Strip application (6 t/ha): covers ${r.totals.hectaresCovered} hectares`)
  lines.push(`FISP nitrogen equivalent: ${r.totals.fispNEquivalent}% of standard package (112 kg N/ha)`)

  return lines.join('\n')
}
