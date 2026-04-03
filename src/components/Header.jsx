import { useState, useEffect } from 'react'
import { useI18n } from '../contexts/I18nContext'
import './Header.css'

export default function Header() {
  const { t } = useI18n()
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <header className="app-header">
      <h1>{t('app.name')}</h1>
      <span className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
        {isOnline ? t('status.online') : t('status.offline')}
      </span>
    </header>
  )
}
