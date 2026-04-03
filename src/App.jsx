import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showInstall, setShowInstall] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    const handleInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handleInstall)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('beforeinstallprompt', handleInstall)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
      setShowInstall(false)
    }
  }

  const actions = [
    { icon: '🌾', label: 'My Crops', desc: 'Track & manage' },
    { icon: '🌤️', label: 'Weather', desc: 'Forecast & alerts' },
    { icon: '📊', label: 'Market', desc: 'Prices & trends' },
    { icon: '📋', label: 'Tasks', desc: 'Farm to-dos' },
  ]

  const activities = [
    { type: 'crop', text: 'Maize seedlings ready for transplant', time: 'Today' },
    { type: 'weather', text: 'Rain expected tomorrow afternoon', time: '1h ago' },
    { type: 'market', text: 'Tomato prices up 12% this week', time: '3h ago' },
  ]

  return (
    <>
      <header className="app-header">
        <h1>🌱 Munda</h1>
        <span className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </header>

      <main className="app-main">
        {showInstall && (
          <div className="install-banner">
            <p>Install Munda for quick access & offline use</p>
            <button className="install-btn" onClick={handleInstallClick}>Install</button>
            <button className="dismiss-btn" onClick={() => setShowInstall(false)}>×</button>
          </div>
        )}

        <div className="welcome">
          <h2>Good morning, Farmer</h2>
          <p>Here's what's happening on your farm today.</p>
        </div>

        <div className="quick-actions">
          {actions.map((a) => (
            <button key={a.label} className="action-card">
              <span className="action-icon">{a.icon}</span>
              <span className="action-label">{a.label}</span>
              <span className="action-desc">{a.desc}</span>
            </button>
          ))}
        </div>

        <div className="weather-card">
          <div className="weather-top">
            <div>
              <div className="weather-temp">28°</div>
            </div>
            <div className="weather-icon">⛅</div>
          </div>
          <div className="weather-desc">Partly cloudy with chance of afternoon showers</div>
          <div className="weather-details">
            <div className="weather-detail">
              Humidity<span>72%</span>
            </div>
            <div className="weather-detail">
              Wind<span>12 km/h</span>
            </div>
            <div className="weather-detail">
              Rain<span>40%</span>
            </div>
          </div>
        </div>

        <div className="section-header">
          <h3>Recent Activity</h3>
          <a href="#">View all</a>
        </div>
        <div className="activity-feed">
          {activities.map((item, i) => (
            <div key={i} className="activity-item">
              <div className={`activity-dot ${item.type}`} />
              <span className="activity-text">{item.text}</span>
              <span className="activity-time">{item.time}</span>
            </div>
          ))}
        </div>
      </main>

      <nav className="bottom-nav">
        <button className="nav-item active">
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </button>
        <button className="nav-item">
          <span className="nav-icon">🌾</span>
          <span className="nav-label">Crops</span>
        </button>
        <button className="nav-item">
          <span className="nav-icon">📊</span>
          <span className="nav-label">Market</span>
        </button>
        <button className="nav-item">
          <span className="nav-icon">👤</span>
          <span className="nav-label">Profile</span>
        </button>
      </nav>
    </>
  )
}

export default App
