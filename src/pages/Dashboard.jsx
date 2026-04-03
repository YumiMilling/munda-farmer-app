import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { getProfile, getPlanEntries, togglePlanEntry } from '../lib/db'
import { fetchWeather, fetchENSO, getENSOAdvice, getWeatherEmoji, getWeatherDescription } from '../lib/api'
import { zoneInfo } from '../lib/zones'
import { getRecommendations } from '../lib/recommendations'
import './Dashboard.css'

export default function Dashboard() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [weather, setWeather] = useState(null)
  const [enso, setEnso] = useState(null)
  const [planEntries, setPlanEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const loadPlan = () => getPlanEntries().then(setPlanEntries)

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p)
      setLoading(false)
      if (p?.lat && p?.lon) {
        fetchWeather(p.lat, p.lon).then(setWeather).catch(() => {})
      }
      fetchENSO().then(setEnso).catch(() => {})
    })
    loadPlan()
  }, [])

  const handleToggle = async (id, done) => {
    await togglePlanEntry(id, done)
    loadPlan()
  }

  if (loading) return <div className="dash-loading">{t('common.loading')}</div>

  if (!profile) {
    return (
      <div className="dash-empty">
        <div className="empty-icon">🌱</div>
        <p>{t('dashboard.no_profile')}</p>
        <button className="setup-btn" onClick={() => navigate('/onboarding')}>
          {t('dashboard.setup_profile')}
        </button>
      </div>
    )
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('dashboard.greeting_morning')
    : hour < 17 ? t('dashboard.greeting_afternoon')
    : t('dashboard.greeting_evening')

  const zone = profile.zone ? zoneInfo[profile.zone] : null
  const current = weather?.current
  const outlook = getENSOAdvice(enso, profile.zone)
  const recommendations = getRecommendations(profile, weather)

  return (
    <div className="dashboard">
      <div className="dash-welcome">
        <h2>{greeting}</h2>
        <p>{t('dashboard.farm_summary')}</p>
        {zone && <span className="zone-tag">{zone.name} — {zone.rainfall}</span>}
      </div>

      {current && (
        <div className="weather-card">
          <div className="weather-top">
            <div>
              <div className="weather-temp">{Math.round(current.temperature_2m)}°</div>
              <div className="weather-desc">{getWeatherDescription(current.weathercode)}</div>
            </div>
            <div className="weather-emoji">{getWeatherEmoji(current.weathercode)}</div>
          </div>
          <div className="weather-details">
            <div className="weather-detail">
              {t('weather.humidity')}
              <span>{current.relative_humidity_2m}%</span>
            </div>
            <div className="weather-detail">
              {t('weather.wind')}
              <span>{Math.round(current.wind_speed_10m)} km/h</span>
            </div>
          </div>

          {weather.daily && (
            <div className="forecast-row">
              {weather.daily.time.slice(0, 5).map((day, i) => (
                <div key={day} className="forecast-day">
                  <span className="forecast-label">
                    {i === 0 ? 'Today' : new Date(day).toLocaleDateString('en', { weekday: 'short' })}
                  </span>
                  <span className="forecast-emoji">{getWeatherEmoji(weather.daily.weathercode[i])}</span>
                  <span className="forecast-rain">
                    {weather.daily.precipitation_sum[i] > 0
                      ? `${Math.round(weather.daily.precipitation_sum[i])}mm`
                      : '—'}
                  </span>
                  <span className="forecast-temps">
                    {Math.round(weather.daily.temperature_2m_max[i])}° / {Math.round(weather.daily.temperature_2m_min[i])}°
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {outlook && (
        <div className={`seasonal-card severity-${outlook.severity}`}>
          <div className="seasonal-header">
            <span className="seasonal-icon">{outlook.icon}</span>
            <div>
              <div className="seasonal-label">Seasonal Outlook</div>
              <div className="seasonal-status">{outlook.statusLabel}</div>
            </div>
            {outlook.source && (
              <span className="seasonal-source">
                {outlook.source === 'IRI' ? 'IRI Columbia'
                  : outlook.source === 'NOAA_ONI' ? 'NOAA'
                  : 'Estimate'}
              </span>
            )}
          </div>

          <div className="seasonal-headline">{outlook.headline}</div>
          <p className="seasonal-summary">{outlook.summary}</p>

          {outlook.rainfallNote && (
            <div className="rainfall-note">{outlook.rainfallNote}</div>
          )}

          <div className="seasonal-advice">
            <div className="advice-title">What to do this season</div>
            <ul>
              {outlook.advice.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="recs-section">
          <div className="section-header">
            <h3>For your farm right now</h3>
          </div>
          <div className="recs-list">
            {recommendations.map((rec, i) => (
              <div key={i} className={`rec-card priority-${rec.priority}`}>
                <div className="rec-top">
                  <span className="rec-icon">{rec.icon}</span>
                  <div className="rec-header">
                    <span className="rec-title">{rec.title}</span>
                    <span className={`rec-tag tag-${rec.priority}`}>{rec.tag}</span>
                  </div>
                </div>
                <p className="rec-body">{rec.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {planEntries.length > 0 && (() => {
        const currentMonth = new Date().getMonth() + 1
        const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        // Sort: current/upcoming months first, done items last
        const sorted = [...planEntries].sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1
          const aOff = ((a.month || 1) - currentMonth + 12) % 12
          const bOff = ((b.month || 1) - currentMonth + 12) % 12
          return aOff - bOff
        })
        const pending = sorted.filter((e) => !e.done)
        const done = sorted.filter((e) => e.done)

        return (
          <div className="plan-section">
            <div className="section-header">
              <h3>Your plan</h3>
              <span className="plan-counter">{done.length}/{planEntries.length} done</span>
            </div>
            <div className="plan-list">
              {pending.slice(0, 6).map((entry) => (
                <div key={entry.id} className={`plan-item ${entry.month === currentMonth ? 'current-month' : ''}`}>
                  <button
                    className="plan-check"
                    onClick={() => handleToggle(entry.id, true)}
                  />
                  <div className="plan-item-content">
                    <span className="plan-item-month">{MONTHS_SHORT[(entry.month || 1) - 1]}</span>
                    <span className="plan-item-title">{entry.title}</span>
                  </div>
                </div>
              ))}
              {done.length > 0 && (
                <div className="plan-done-count">{done.length} completed</div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
