import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlanEntries, togglePlanEntry, deletePlanEntry, clearPlan } from '../lib/db'
import './Plan.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Plan() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    getPlanEntries().then((e) => {
      setEntries(e)
      setLoading(false)
    })
  }

  useEffect(load, [])

  const toggle = async (id, done) => {
    await togglePlanEntry(id, done)
    load()
  }

  const remove = async (id) => {
    await deletePlanEntry(id)
    load()
  }

  const clearAll = async () => {
    await clearPlan()
    load()
  }

  if (loading) return <div className="plan-page"><p style={{ color: '#9ca3af', textAlign: 'center', paddingTop: 60 }}>Loading...</p></div>

  // Group by month
  const byMonth = {}
  for (const entry of entries) {
    const m = entry.month || 0
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(entry)
  }

  const currentMonth = new Date().getMonth() + 1 // 1-indexed
  const sortedMonths = Object.keys(byMonth).map(Number).sort((a, b) => {
    // Sort starting from current month
    const aOff = (a - currentMonth + 12) % 12
    const bOff = (b - currentMonth + 12) % 12
    return aOff - bOff
  })

  const isEmpty = entries.length === 0
  const doneCount = entries.filter((e) => e.done).length

  return (
    <div className="plan-page">
      <div className="plan-page-header">
        <h2>Farm Plan</h2>
        {!isEmpty && (
          <div className="plan-progress">
            <span className="progress-text">{doneCount}/{entries.length}</span>
            <div className="progress-bar-mini">
              <div className="progress-fill-mini" style={{ width: `${(doneCount / entries.length) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="plan-empty">
          <div className="plan-empty-icon">📅</div>
          <h3>No plan yet</h3>
          <p>Ask Munda to make you a seasonal plan and save the entries here.</p>
          <button className="plan-ask-btn" onClick={() => navigate('/chat')}>
            Ask Munda for a plan
          </button>
        </div>
      ) : (
        <>
          <div className="plan-timeline">
            {sortedMonths.map((m) => (
              <div key={m} className={`plan-month-group ${m === currentMonth ? 'current' : ''}`}>
                <div className="month-label">
                  <span className={`month-badge ${m === currentMonth ? 'now' : ''}`}>
                    {MONTHS_SHORT[m - 1]}
                  </span>
                  {m === currentMonth && <span className="now-tag">Now</span>}
                </div>
                <div className="month-entries">
                  {byMonth[m].map((entry) => (
                    <div key={entry.id} className={`timeline-entry ${entry.done ? 'done' : ''}`}>
                      <button
                        className={`check-circle ${entry.done ? 'checked' : ''}`}
                        onClick={() => toggle(entry.id, !entry.done)}
                      >
                        {entry.done && '✓'}
                      </button>
                      <div className="timeline-content">
                        <div className="timeline-title">{entry.title}</div>
                        {entry.body && <div className="timeline-body">{entry.body}</div>}
                      </div>
                      <button className="delete-entry" onClick={() => remove(entry.id)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button className="clear-plan-btn" onClick={clearAll}>
            Clear plan
          </button>
        </>
      )}
    </div>
  )
}
