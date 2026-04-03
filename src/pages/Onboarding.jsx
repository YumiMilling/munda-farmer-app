import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { saveProfile } from '../lib/db'
import { detectZone, zoneInfo } from '../lib/zones'
import { fetchSoilData } from '../lib/api'
import './Onboarding.css'

const STEPS = ['welcome', 'location', 'soil', 'livestock', 'labour', 'crops', 'water', 'done']

const CROP_OPTIONS = [
  'maize', 'sorghum', 'millet', 'groundnuts', 'soybeans',
  'cowpea', 'pigeon_pea', 'cassava', 'sweet_potato', 'vegetables',
]

const LIVESTOCK_TYPES = ['cattle', 'goats', 'chickens', 'pigs']

export default function Onboarding() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [detecting, setDetecting] = useState(false)
  const [profile, setProfile] = useState({
    lat: null,
    lon: null,
    zone: null,
    soilData: null,
    soilColour: null,
    earthworms: null,
    waterInfiltration: null,
    livestock: {},
    adults: null,
    childrenHelp: false,
    crops: [],
    fieldSize: null,
    waterAccess: null, // 'borehole', 'river', 'dam', 'none'
    irrigatedGarden: null, // true/false
  })

  const update = (key, value) => setProfile((p) => ({ ...p, [key]: value }))

  const detectLocation = async () => {
    setDetecting(true)
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 15000,
          enableHighAccuracy: false,
        })
      })
      const lat = pos.coords.latitude
      const lon = pos.coords.longitude
      const zone = detectZone(lat, lon)
      update('lat', lat)
      update('lon', lon)
      setProfile((p) => ({ ...p, lat, lon, zone }))

      // Try to fetch soil data in background
      fetchSoilData(lat, lon).then((soilData) => {
        if (soilData) setProfile((p) => ({ ...p, soilData }))
      })
    } catch {
      // Location failed — user can set manually
    }
    setDetecting(false)
  }

  const toggleCrop = (crop) => {
    setProfile((p) => ({
      ...p,
      crops: p.crops.includes(crop)
        ? p.crops.filter((c) => c !== crop)
        : [...p.crops, crop],
    }))
  }

  const toggleLivestock = (type) => {
    setProfile((p) => {
      const livestock = { ...p.livestock }
      if (livestock[type]) {
        delete livestock[type]
      } else {
        livestock[type] = 1
      }
      return { ...p, livestock }
    })
  }

  const setLivestockCount = (type, count) => {
    const n = parseInt(count) || 0
    setProfile((p) => {
      const livestock = { ...p.livestock }
      if (n > 0) {
        livestock[type] = n
      } else {
        delete livestock[type]
      }
      return { ...p, livestock }
    })
  }

  const finish = async () => {
    await saveProfile(profile)
    navigate('/')
  }

  const canNext = () => {
    switch (STEPS[step]) {
      case 'location': return profile.zone != null
      default: return true
    }
  }

  const currentStep = STEPS[step]
  const zone = profile.zone ? zoneInfo[profile.zone] : null

  return (
    <div className="onboarding">
      {/* Progress bar */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${((step) / (STEPS.length - 1)) * 100}%` }} />
      </div>

      <div className="onboarding-content">
        {currentStep === 'welcome' && (
          <div className="step-content welcome-step">
            <div className="welcome-icon">🌱</div>
            <h1>{t('onboarding.welcome_title')}</h1>
            <p>{t('onboarding.welcome_desc')}</p>
          </div>
        )}

        {currentStep === 'location' && (
          <div className="step-content">
            <h2>{t('onboarding.step_location')}</h2>
            <p>{t('onboarding.step_location_desc')}</p>

            {!profile.lat ? (
              <button
                className="detect-btn"
                onClick={detectLocation}
                disabled={detecting}
              >
                {detecting ? t('onboarding.detecting') : t('onboarding.detect_location')}
              </button>
            ) : (
              <div className="zone-result">
                <div className="zone-badge">{zone?.name}</div>
                <p className="zone-rainfall">{zone?.rainfall} rainfall</p>
                <p className="zone-desc">{zone?.description}</p>
                <p className="zone-provinces">{zone?.provinces}</p>
              </div>
            )}

            {profile.soilData && (
              <div className="soil-api-result">
                <h3>Soil data for your area</h3>
                <div className="soil-grid">
                  <div className="soil-item">
                    <span className="soil-label">Texture</span>
                    <span className="soil-value">{profile.soilData.texture}</span>
                  </div>
                  {profile.soilData.ph && (
                    <div className="soil-item">
                      <span className="soil-label">pH</span>
                      <span className="soil-value">{profile.soilData.ph.toFixed(1)}</span>
                    </div>
                  )}
                  {profile.soilData.organicCarbon != null && (
                    <div className="soil-item">
                      <span className="soil-label">Organic Carbon</span>
                      <span className="soil-value">{profile.soilData.organicCarbon.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 'soil' && (
          <div className="step-content">
            <h2>{t('onboarding.step_soil')}</h2>

            <div className="question">
              <label>{t('onboarding.soil_colour')}</label>
              <div className="options">
                {['dark', 'medium', 'pale', 'red'].map((c) => (
                  <button
                    key={c}
                    className={`option-btn ${profile.soilColour === c ? 'selected' : ''}`}
                    onClick={() => update('soilColour', c)}
                  >
                    <span className={`colour-dot colour-${c}`} />
                    {t(`onboarding.soil_colour_${c}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="question">
              <label>{t('onboarding.earthworms')}</label>
              <div className="options">
                {['many', 'some', 'few'].map((e) => (
                  <button
                    key={e}
                    className={`option-btn ${profile.earthworms === e ? 'selected' : ''}`}
                    onClick={() => update('earthworms', e)}
                  >
                    {t(`onboarding.earthworms_${e}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="question">
              <label>{t('onboarding.water_test')}</label>
              <div className="options">
                {['soaks', 'slow', 'pools'].map((w) => (
                  <button
                    key={w}
                    className={`option-btn ${profile.waterInfiltration === w ? 'selected' : ''}`}
                    onClick={() => update('waterInfiltration', w)}
                  >
                    {t(`onboarding.water_${w}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 'livestock' && (
          <div className="step-content">
            <h2>{t('onboarding.step_livestock')}</h2>
            <p>{t('onboarding.livestock_desc')}</p>

            <div className="livestock-list">
              {LIVESTOCK_TYPES.map((type) => (
                <div key={type} className="livestock-row">
                  <span className="livestock-label">{t(`onboarding.${type}`)}</span>
                  <div className="livestock-counter">
                    <button
                      className="counter-btn"
                      onClick={() => setLivestockCount(type, Math.max(0, (profile.livestock[type] || 0) - 1))}
                    >−</button>
                    <span className="counter-value">{profile.livestock[type] || 0}</span>
                    <button
                      className="counter-btn"
                      onClick={() => setLivestockCount(type, (profile.livestock[type] || 0) + 1)}
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'labour' && (
          <div className="step-content">
            <h2>{t('onboarding.step_labour')}</h2>
            <p>{t('onboarding.labour_desc')}</p>

            <div className="options">
              {['1', '2', '3'].map((n) => (
                <button
                  key={n}
                  className={`option-btn ${profile.adults === n ? 'selected' : ''}`}
                  onClick={() => update('adults', n)}
                >
                  {t(`onboarding.adults_${n}`)}
                </button>
              ))}
            </div>

            <div className="question">
              <label>{t('onboarding.children_help')}</label>
              <div className="options row">
                <button
                  className={`option-btn ${profile.childrenHelp === true ? 'selected' : ''}`}
                  onClick={() => update('childrenHelp', true)}
                >{t('onboarding.yes')}</button>
                <button
                  className={`option-btn ${profile.childrenHelp === false ? 'selected' : ''}`}
                  onClick={() => update('childrenHelp', false)}
                >{t('onboarding.no')}</button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'crops' && (
          <div className="step-content">
            <h2>{t('onboarding.step_crops')}</h2>
            <p>{t('onboarding.crops_desc')}</p>

            <div className="crop-grid">
              {CROP_OPTIONS.map((crop) => (
                <button
                  key={crop}
                  className={`option-btn ${profile.crops.includes(crop) ? 'selected' : ''}`}
                  onClick={() => toggleCrop(crop)}
                >
                  {t(`onboarding.${crop}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'water' && (
          <div className="step-content">
            <h2>Water Access</h2>
            <p>Do you have water for dry-season gardening? This changes what you can grow year-round.</p>

            <div className="question">
              <label>Water source for irrigation/gardening</label>
              <div className="options">
                {[
                  { key: 'borehole', label: 'Borehole or well' },
                  { key: 'river', label: 'River or stream nearby' },
                  { key: 'dam', label: 'Dam or pond' },
                  { key: 'none', label: 'No dry-season water' },
                ].map((w) => (
                  <button
                    key={w.key}
                    className={`option-btn ${profile.waterAccess === w.key ? 'selected' : ''}`}
                    onClick={() => update('waterAccess', w.key)}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {profile.waterAccess && profile.waterAccess !== 'none' && (
              <div className="question">
                <label>Do you currently grow vegetables in the dry season?</label>
                <div className="options row">
                  <button
                    className={`option-btn ${profile.irrigatedGarden === true ? 'selected' : ''}`}
                    onClick={() => update('irrigatedGarden', true)}
                  >Yes</button>
                  <button
                    className={`option-btn ${profile.irrigatedGarden === false ? 'selected' : ''}`}
                    onClick={() => update('irrigatedGarden', false)}
                  >Not yet</button>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 'done' && (
          <div className="step-content welcome-step">
            <div className="welcome-icon">✅</div>
            <h1>{t('onboarding.step_done')}</h1>
            <p>{t('onboarding.done_desc')}</p>

            {zone && (
              <div className="summary-card">
                <div><strong>{zone.name}</strong> — {zone.rainfall}</div>
                {profile.soilColour && <div>Soil: {t(`onboarding.soil_colour_${profile.soilColour}`)}</div>}
                {Object.keys(profile.livestock).length > 0 && (
                  <div>Livestock: {Object.entries(profile.livestock).map(([k, v]) => `${v} ${t(`onboarding.${k}`)}`).join(', ')}</div>
                )}
                {profile.crops.length > 0 && (
                  <div>Crops: {profile.crops.map((c) => t(`onboarding.${c}`)).join(', ')}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="onboarding-nav">
        {step > 0 && (
          <button className="nav-btn back" onClick={() => setStep((s) => s - 1)}>
            {t('onboarding.back')}
          </button>
        )}
        <div className="spacer" />
        {step < STEPS.length - 1 ? (
          <button
            className="nav-btn next"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
          >
            {step === 0 ? t('onboarding.start') : t('onboarding.next')}
          </button>
        ) : (
          <button className="nav-btn next" onClick={finish}>
            {t('onboarding.finish')}
          </button>
        )}
      </div>
    </div>
  )
}
