import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { getProfile } from '../lib/db'
import { zoneInfo } from '../lib/zones'
import './Profile.css'

const handleShare = async () => {
  if (navigator.share) {
    await navigator.share({
      title: 'Munda Farmer App',
      text: 'Regenerative farming advisor for Zambian smallholders. Works offline.',
      url: window.location.origin,
    })
  } else {
    await navigator.clipboard.writeText(window.location.origin)
    alert('Link copied!')
  }
}

export default function Profile() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    getProfile().then(setProfile)
  }, [])

  if (!profile) {
    return (
      <div className="profile-page">
        <h2>{t('profile.title')}</h2>
        <div className="profile-empty">
          <p>No farm profile set up yet.</p>
          <button className="setup-btn" onClick={() => navigate('/onboarding')}>
            {t('dashboard.setup_profile')}
          </button>
        </div>
      </div>
    )
  }

  const zone = profile.zone ? zoneInfo[profile.zone] : null

  return (
    <div className="profile-page">
      <h2>{t('profile.title')}</h2>

      <div className="profile-section">
        <h3>{t('profile.zone')}</h3>
        {zone && (
          <div className="profile-card">
            <strong>{zone.name}</strong> — {zone.rainfall}
            <p>{zone.description}</p>
          </div>
        )}
      </div>

      {profile.soilData && (
        <div className="profile-section">
          <h3>{t('profile.soil')} (satellite)</h3>
          <div className="profile-card">
            <div className="profile-row"><span>Texture:</span><strong>{profile.soilData.texture}</strong></div>
            {profile.soilData.ph && <div className="profile-row"><span>pH:</span><strong>{profile.soilData.ph.toFixed(1)}</strong></div>}
            {profile.soilData.organicCarbon != null && <div className="profile-row"><span>Organic Carbon:</span><strong>{profile.soilData.organicCarbon.toFixed(1)}%</strong></div>}
          </div>
        </div>
      )}

      {profile.soilColour && (
        <div className="profile-section">
          <h3>{t('profile.soil')} (field assessment)</h3>
          <div className="profile-card">
            <div className="profile-row"><span>Colour:</span><strong>{t(`onboarding.soil_colour_${profile.soilColour}`)}</strong></div>
            {profile.earthworms && <div className="profile-row"><span>Earthworms:</span><strong>{t(`onboarding.earthworms_${profile.earthworms}`)}</strong></div>}
            {profile.waterInfiltration && <div className="profile-row"><span>Water:</span><strong>{t(`onboarding.water_${profile.waterInfiltration}`)}</strong></div>}
          </div>
        </div>
      )}

      {Object.keys(profile.livestock || {}).length > 0 && (
        <div className="profile-section">
          <h3>{t('profile.livestock')}</h3>
          <div className="profile-card">
            {Object.entries(profile.livestock).map(([type, count]) => (
              <div key={type} className="profile-row">
                <span>{t(`onboarding.${type}`)}:</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.crops?.length > 0 && (
        <div className="profile-section">
          <h3>{t('profile.crops')}</h3>
          <div className="profile-card">
            <div className="crop-tags">
              {profile.crops.map((c) => (
                <span key={c} className="crop-tag">{t(`onboarding.${c}`)}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <button className="edit-profile-btn" onClick={() => navigate('/onboarding')}>
        {t('profile.edit')} {t('profile.title')}
      </button>

      <button className="edit-profile-btn" style={{ marginTop: '12px', background: 'var(--green-600)' }} onClick={handleShare}>
        Share Munda
      </button>
    </div>
  )
}
