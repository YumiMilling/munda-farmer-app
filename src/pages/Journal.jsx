import { useState, useEffect } from 'react'
import { useI18n } from '../contexts/I18nContext'
import { getJournalEntries } from '../lib/db'
import './Journal.css'

export default function Journal() {
  const { t } = useI18n()
  const [entries, setEntries] = useState([])

  useEffect(() => {
    getJournalEntries().then(setEntries)
  }, [])

  return (
    <div className="journal-page">
      <div className="journal-header">
        <h2>{t('journal.title')}</h2>
        <button className="new-entry-btn">+ {t('journal.new_entry')}</button>
      </div>

      {entries.length === 0 ? (
        <div className="journal-empty">
          <div className="empty-icon">📓</div>
          <p>{t('journal.no_entries')}</p>
        </div>
      ) : (
        <div className="entry-list">
          {entries.map((entry) => (
            <div key={entry.id} className="entry-card">
              <div className="entry-date">{new Date(entry.createdAt).toLocaleDateString()}</div>
              <div className="entry-type">{entry.type}</div>
              <p className="entry-notes">{entry.notes}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
