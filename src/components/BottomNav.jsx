import { NavLink } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import './BottomNav.css'

export default function BottomNav() {
  const { t } = useI18n()

  const items = [
    { to: '/', icon: '\uD83C\uDFE0', label: t('nav.home') },
    { to: '/chat', icon: '\uD83D\uDCAC', label: 'Ask Munda' },
    { to: '/profile', icon: '\uD83D\uDC64', label: t('nav.profile') },
  ]

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
