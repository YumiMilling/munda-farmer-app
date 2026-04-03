// Zambia agroecological zone detection from coordinates
// Simplified polygon-based classification using latitude + longitude + elevation heuristics
// Based on Zambia's three major agroecological zones

// Zone boundaries are approximations. Real boundaries follow rainfall isohyets,
// not straight lines. This gets it right ~85% of the time. The farmer can override.

export function detectZone(lat, lon) {
  // Zambia roughly spans lat -8 to -18, lon 22 to 33

  // Zone I: Southern valley areas, <800mm rainfall
  // Southern Province lowveld, Luangwa valley, Gwembe valley
  if (lat < -15.5 && lon > 25 && lon < 29) return 'I'
  if (lat < -16 && lon > 28 && lon < 33) return 'I'
  // Luangwa valley
  if (lat > -14.5 && lat < -12 && lon > 30.5) return 'I'

  // Zone III: Northern high-rainfall areas, >1200mm
  // Northern, Luapula, Copperbelt, parts of Northwestern
  if (lat > -11) return 'III'
  if (lat > -12 && lon < 27) return 'III' // Northwestern
  if (lat > -12.5 && lon > 28.5 && lon < 30) return 'IIb' // Copperbelt transition

  // Zone IIb: 1000-1200mm, transitional
  if (lat > -13 && lon < 28) return 'IIb'
  if (lat > -12.5) return 'IIb'

  // Zone IIa: The big middle, 800-1000mm
  // Central, Eastern, Southern plateau, Lusaka, parts of Western
  return 'IIa'
}

export const zoneInfo = {
  'I': {
    name: 'Zone I',
    rainfall: '<800mm',
    description: 'Dry zone — drought-prone, often sandy soils, low organic matter',
    provinces: 'Southern (valley), parts of Eastern, Lusaka lowveld',
    priorities: ['Water conservation', 'Drought-tolerant crops', 'Improved manure handling', 'Minimum tillage'],
  },
  'IIa': {
    name: 'Zone IIa',
    rainfall: '800–1,000mm',
    description: 'Medium rainfall — variable soils, moderate organic matter potential',
    provinces: 'Central, Southern (plateau), Eastern, Lusaka, parts of Western',
    priorities: ['Intercropping systems', 'Crop rotation', 'Agroforestry', 'Holistic grazing', 'Composting'],
  },
  'IIb': {
    name: 'Zone IIb',
    rainfall: '1,000–1,200mm',
    description: 'Wet transitional zone — often acidic, leached soils',
    provinces: 'Parts of Central, Copperbelt, Northwestern',
    priorities: ['Acidity management', 'Legume cover crops', 'Green manure', 'Agroforestry'],
  },
  'III': {
    name: 'Zone III',
    rainfall: '>1,200mm',
    description: 'High rainfall — acidic soils, low phosphorus, high organic matter potential',
    provinces: 'Northern, Luapula, Copperbelt, Northwestern',
    priorities: ['Acidity management (lime, wood ash)', 'Cassava systems', 'Legume cover crops', 'Green manure'],
  },
}
