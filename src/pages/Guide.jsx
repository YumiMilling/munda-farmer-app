import { useI18n } from '../contexts/I18nContext'
import './Guide.css'

export default function Guide() {
  const { t } = useI18n()

  const categories = [
    { key: 'soil', icon: '🪱', count: 3 },
    { key: 'crops', icon: '🌾', count: 8 },
    { key: 'livestock', icon: '🐄', count: 2 },
    { key: 'water', icon: '💧', count: 1 },
    { key: 'pests', icon: '🐛', count: 1 },
    { key: 'business', icon: '💰', count: 2 },
  ]

  return (
    <div className="guide-page">
      <h2>{t('guide.title')}</h2>

      <div className="search-bar">
        <input type="text" placeholder={t('guide.search')} />
      </div>

      <div className="category-grid">
        {categories.map((cat) => (
          <button key={cat.key} className="category-card">
            <span className="cat-icon">{cat.icon}</span>
            <span className="cat-name">{t(`guide.categories.${cat.key}`)}</span>
            <span className="cat-count">{cat.count} practices</span>
          </button>
        ))}
      </div>

      <p className="guide-placeholder">
        Practice cards and decision trees coming soon. Content will be tailored to your farm profile.
      </p>
    </div>
  )
}
