import { getCached, setCache } from './db'

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'
const SOILGRIDS = 'https://rest.isric.org/soilgrids/v2.0/properties/query'

export async function fetchWeather(lat, lon) {
  const cacheKey = `weather_${lat.toFixed(2)}_${lon.toFixed(2)}`
  const cached = await getCached(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode',
    hourly: 'soil_moisture_0_to_7cm,soil_temperature_0_to_7cm',
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weathercode',
    timezone: 'auto',
    forecast_days: 7,
  })

  const res = await fetch(`${OPEN_METEO}?${params}`)
  if (!res.ok) throw new Error('Weather fetch failed')
  const data = await res.json()

  // Cache for 3 hours
  await setCache(cacheKey, data, 3 * 60 * 60 * 1000)
  return data
}

export async function fetchSoilData(lat, lon) {
  const cacheKey = `soil_${lat.toFixed(3)}_${lon.toFixed(3)}`
  const cached = await getCached(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({
    lon: lon,
    lat: lat,
    property: ['clay', 'sand', 'soc', 'phh2o', 'nitrogen'].join(','),
    depth: '0-5cm',
    value: 'mean',
  })

  try {
    const res = await fetch(`${SOILGRIDS}?${params}`)
    if (!res.ok) throw new Error('SoilGrids fetch failed')
    const data = await res.json()

    const result = parseSoilGrids(data)
    // Cache forever (soil doesn't change)
    await setCache(cacheKey, result, 365 * 24 * 60 * 60 * 1000)
    return result
  } catch {
    // SoilGrids may be unavailable — return null, farmer uses manual assessment
    return null
  }
}

function parseSoilGrids(data) {
  const props = {}
  if (data.properties?.layers) {
    for (const layer of data.properties.layers) {
      const depth = layer.depths?.[0]
      if (depth?.values?.mean != null) {
        props[layer.name] = {
          value: depth.values.mean,
          unit: layer.unit_measure?.mapped_units ?? '',
        }
      }
    }
  }

  // Interpret soil texture from clay/sand percentages
  const clay = props.clay?.value ?? 0  // g/kg
  const sand = props.sand?.value ?? 0  // g/kg
  let texture = 'unknown'
  if (sand > 650) texture = 'sandy'
  else if (clay > 400) texture = 'clay'
  else if (sand > 400 && clay < 300) texture = 'sandy loam'
  else if (clay > 250) texture = 'clay loam'
  else texture = 'loam'

  return {
    clay: clay / 10, // convert g/kg to %
    sand: sand / 10,
    organicCarbon: props.soc?.value ? props.soc.value / 10 : null, // g/kg to %
    ph: props.phh2o?.value ? props.phh2o.value / 10 : null, // stored as pH*10
    nitrogen: props.nitrogen?.value ?? null,
    texture,
    raw: props,
  }
}

// ── ENSO / Seasonal Forecast ──

const IRI_ENSO = 'https://iridl.ldeo.columbia.edu/SOURCES/.IRI/.FD/.ENSO_Forecast/.probabilistic/.object/data.json'
const NOAA_ONI = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt'

export async function fetchENSO() {
  const cacheKey = 'enso_status'
  const cached = await getCached(cacheKey)
  if (cached) return cached

  // Try multiple sources in order of preference
  let result = null

  // Attempt 1: IRI ENSO probabilistic forecast
  try {
    const res = await fetch(IRI_ENSO, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = await res.json()
      result = parseIRIEnso(data)
    }
  } catch {
    // CORS or network issue — try next source
  }

  // Attempt 2: NOAA ONI text data (current ENSO state from SST anomalies)
  if (!result) {
    try {
      const res = await fetch(NOAA_ONI, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const text = await res.text()
        result = parseONI(text)
      }
    } catch {
      // Also blocked — use Open-Meteo historical as proxy
    }
  }

  // Attempt 3: Use Open-Meteo historical precipitation anomaly as a rainfall signal
  // (not ENSO directly, but gives us "is this season wetter/drier than normal")
  if (!result) {
    result = await estimateFromOpenMeteo()
  }

  if (result) {
    // Cache for 24 hours (ENSO changes slowly)
    await setCache(cacheKey, result, 24 * 60 * 60 * 1000)
  }

  return result
}

function parseIRIEnso(data) {
  try {
    // IRI format varies — extract latest forecast probabilities
    // Probabilities for El Nino / Neutral / La Nina
    const latest = Array.isArray(data) ? data[data.length - 1] : data
    return {
      source: 'IRI',
      status: latest.ElNino > 0.5 ? 'el_nino'
        : latest.LaNina > 0.5 ? 'la_nina'
        : 'neutral',
      probabilities: {
        el_nino: latest.ElNino ?? null,
        neutral: latest.Neutral ?? null,
        la_nina: latest.LaNina ?? null,
      },
      fetchedAt: Date.now(),
    }
  } catch {
    return null
  }
}

function parseONI(text) {
  try {
    // ONI format: SEAS  YEAR   TOTAL   APTS
    // Last row has most recent data
    const lines = text.trim().split('\n').filter((l) => l.trim() && !l.startsWith('SEAS'))
    const last = lines[lines.length - 1].trim().split(/\s+/)
    const oni = parseFloat(last[last.length - 1])

    let status = 'neutral'
    if (oni >= 0.5) status = 'el_nino'
    else if (oni <= -0.5) status = 'la_nina'

    return {
      source: 'NOAA_ONI',
      status,
      oni,
      season: last[0],
      year: last[1],
      fetchedAt: Date.now(),
    }
  } catch {
    return null
  }
}

async function estimateFromOpenMeteo() {
  // Compare recent 30-day precip vs climate normal for Zambia's centroid
  // This isn't ENSO, but it's a practical "is it wetter or drier than expected" signal
  const lat = -15.4, lon = 28.3 // Lusaka as Zambia reference
  const now = new Date()
  const end = now.toISOString().slice(0, 10)
  const start30 = new Date(now - 30 * 86400000).toISOString().slice(0, 10)

  try {
    const res = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start30}&end_date=${end}&daily=precipitation_sum&timezone=auto`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json()

    const totalPrecip = (data.daily?.precipitation_sum || []).reduce((a, b) => a + (b || 0), 0)

    // Rough monthly normals for Lusaka (mm): Oct=15, Nov=90, Dec=200, Jan=230, Feb=190, Mar=110, Apr=30, May-Sep=~0
    const monthNormals = [230, 190, 110, 30, 0, 0, 0, 0, 0, 15, 90, 200]
    const currentMonth = now.getMonth()
    const normalForMonth = monthNormals[currentMonth]

    let rainfallSignal = 'normal'
    if (normalForMonth > 10) {
      const ratio = totalPrecip / normalForMonth
      if (ratio < 0.6) rainfallSignal = 'below_normal'
      else if (ratio > 1.4) rainfallSignal = 'above_normal'
    }

    return {
      source: 'open_meteo_estimate',
      status: 'unknown',
      rainfallSignal,
      recentPrecip: Math.round(totalPrecip),
      normalPrecip: normalForMonth,
      fetchedAt: Date.now(),
    }
  } catch {
    return null
  }
}

// Interpret ENSO status for a specific Zambian zone
export function getENSOAdvice(enso, zone) {
  if (!enso) return null

  const status = enso.status
  const isElNino = status === 'el_nino'
  const isLaNina = status === 'la_nina'

  // Base interpretation
  const outlook = {
    status,
    statusLabel: isElNino ? 'El Ni\u00f1o' : isLaNina ? 'La Ni\u00f1a' : 'Neutral',
    icon: isElNino ? '\uD83C\uDF21\uFE0F' : isLaNina ? '\uD83C\uDF0A' : '\u2696\uFE0F',
    source: enso.source,
  }

  if (isElNino) {
    outlook.headline = 'Drier season likely'
    outlook.severity = zone === 'I' || zone === 'IIa' ? 'high' : 'moderate'

    const advice = [
      'Plant drought-tolerant varieties (sorghum, pearl millet, cowpea)',
      'Prioritise water conservation \u2014 mulch heavily, use planting basins',
      'Plant early to maximise available rainfall',
      'Consider shorter-season maize varieties',
    ]

    if (zone === 'I') {
      advice.push('Zone I is highest risk \u2014 consider reducing maize area in favour of sorghum/millet')
      advice.push('Planting basins are critical this season for water capture')
    } else if (zone === 'IIa') {
      advice.push('Intercrop maize with pigeon pea for insurance \u2014 pigeon pea survives dry spells')
      advice.push('Apply mulch before dry spells hit to conserve soil moisture')
    } else if (zone === 'IIb' || zone === 'III') {
      advice.push('Northern zones are less affected, but prepare for irregular rainfall distribution')
      advice.push('Dry spells within the season are more likely even if total rainfall is near normal')
    }

    outlook.advice = advice
    outlook.summary = zone === 'I'
      ? 'High drought risk. Shift to drought-tolerant crops and water conservation.'
      : zone === 'IIa'
      ? 'Below-normal rainfall expected. Mulch, plant early, diversify with legumes.'
      : 'Moderate impact expected. Watch for dry spells within the season.'

  } else if (isLaNina) {
    outlook.headline = 'Wetter season likely'
    outlook.severity = 'positive'

    const advice = [
      'Good conditions for planting \u2014 don\u2019t delay',
      'Wetter season means higher weed pressure \u2014 plan for extra weeding labour',
      'Favourable for legume intercropping and green manure crops',
      'Good year to establish agroforestry trees (Faidherbia, Gliricidia)',
    ]

    if (zone === 'I') {
      advice.push('Zone I may receive near-normal rainfall \u2014 a good year to try intercropping')
    } else if (zone === 'IIa') {
      advice.push('Excellent conditions for maize-pigeon pea system')
      advice.push('Consider relay-planting velvet bean for soil building')
    } else if (zone === 'IIb' || zone === 'III') {
      advice.push('Watch for waterlogging on clay soils \u2014 ensure drainage')
      advice.push('Leaching risk for nutrients \u2014 split manure application, don\u2019t apply all at once')
      advice.push('Higher risk of fungal diseases in wet conditions')
    }

    outlook.advice = advice
    outlook.summary = zone === 'III'
      ? 'Above-normal rainfall expected. Watch for waterlogging and disease pressure.'
      : 'Wetter season expected. Good conditions for planting and soil building.'

  } else {
    outlook.headline = 'Normal season expected'
    outlook.severity = 'neutral'
    outlook.advice = [
      'Follow standard seasonal planning for your zone',
      'Good conditions for trying new practices on a test plot',
      'Continue building soil organic matter \u2014 every season counts',
    ]
    outlook.summary = 'Near-normal rainfall expected. A good season for steady improvement.'
  }

  // Add rainfall signal from Open-Meteo estimate if available
  if (enso.rainfallSignal && enso.source === 'open_meteo_estimate') {
    outlook.rainfallNote = enso.rainfallSignal === 'below_normal'
      ? `Recent rainfall is below normal (${enso.recentPrecip}mm vs ~${enso.normalPrecip}mm expected). Watch for developing dry conditions.`
      : enso.rainfallSignal === 'above_normal'
      ? `Recent rainfall is above normal (${enso.recentPrecip}mm vs ~${enso.normalPrecip}mm expected). Good soil moisture conditions.`
      : null
  }

  return outlook
}

export function getWeatherDescription(code) {
  const descriptions = {
    0: 'Clear sky',
    1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail',
  }
  return descriptions[code] ?? 'Unknown'
}

export function getWeatherEmoji(code) {
  if (code === 0) return '\u2600\uFE0F'
  if (code <= 3) return '\u26C5'
  if (code <= 48) return '\uD83C\uDF2B\uFE0F'
  if (code <= 55) return '\uD83C\uDF26\uFE0F'
  if (code <= 65) return '\uD83C\uDF27\uFE0F'
  if (code <= 75) return '\u2744\uFE0F'
  if (code <= 82) return '\uD83C\uDF26\uFE0F'
  return '\u26C8\uFE0F'
}
