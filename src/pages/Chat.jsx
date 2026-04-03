import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Markdown from 'react-markdown'
import { sendMessage } from '../lib/chat'
import { addPlanEntry, getProfile, saveChatMessages, getChatMessages } from '../lib/db'
import { fetchWeather, fetchENSO } from '../lib/api'
import './Chat.css'

function getSuggestions(profile, weather) {
  const month = new Date().getMonth() // 0-indexed
  const hasLivestock = Object.keys(profile?.livestock || {}).length > 0
  const cattle = profile?.livestock?.cattle || 0
  const hasWater = profile?.waterAccess && profile.waterAccess !== 'none'
  const hasRainSoon = weather?.daily?.precipitation_sum?.slice(0, 3).some(p => p > 5)

  // April (3) - harvest time
  if (month === 3 || month === 4) {
    const s = ['What should I do with my field after maize harvest?']
    if (cattle > 0) s.push(`How do I start composting with my ${cattle} cattle's manure?`)
    else s.push('How do I build soil without livestock?')
    s.push('Make me a plan from now until next planting season')
    if (hasWater) s.push('What vegetables can I grow in the dry season?')
    else s.push('How do I store grain to avoid weevil damage?')
    return s
  }

  // May-Jul (4-6) - dry season
  if (month >= 4 && month <= 6) {
    const s = []
    if (hasLivestock) s.push('How much manure can I collect and how far will it go?')
    s.push('What should I be preparing for next planting season?')
    if (hasWater) s.push('Best dry-season crops for cash income right now')
    s.push('Make me a plan for the next 6 months')
    if (!hasWater) s.push('How do I earn income in the dry season without irrigation?')
    return s
  }

  // Aug-Sep (7-8) - critical prep
  if (month === 7 || month === 8) {
    const s = [
      'What must be done before the rains start?',
      'Make me a planting plan for this season',
    ]
    if (hasLivestock) s.push('Is my compost ready? How do I check?')
    s.push('How do I set up maize-pigeon pea intercropping?')
    return s
  }

  // Oct-Nov (9-10) - planting
  if (month === 9 || month === 10) {
    const s = []
    if (hasRainSoon) s.push('Rain is coming — what do I plant first?')
    else s.push('Rains haven\'t started — should I wait or dry-plant?')
    s.push('Correct spacing for maize-pigeon pea intercrop')
    if (hasLivestock) s.push('How do I apply manure in strips at planting?')
    s.push('Make me a plan for this growing season')
    return s
  }

  // Dec-Feb (11, 0, 1) - growing season
  if (month === 11 || month === 0 || month === 1) {
    const s = [
      'When do I plant velvet bean relay into my maize?',
      'My maize leaves are yellowing — what is wrong?',
    ]
    if (hasRainSoon) s.push('Heavy rain expected — should I worry about waterlogging?')
    else s.push('No rain for 10 days — how do I protect my crop?')
    s.push('How do I check for fall armyworm and what do I do?')
    return s
  }

  // Feb-Mar (2) - late season
  return [
    'When should I harvest my maize?',
    'How do I prepare for pigeon pea harvest?',
    'Don\'t let me burn my crop residues — convince me why',
    'Make me a post-harvest plan',
  ]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parsePlanEntries(text) {
  const match = text.match(/\[PLAN\]([\s\S]*?)\[\/PLAN\]/)
  if (!match) return { cleanText: text, entries: [] }

  const cleanText = text.replace(/\[PLAN\][\s\S]*?\[\/PLAN\]/, '').trim()
  const entries = []

  const lines = match[1].trim().split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const entry = JSON.parse(trimmed)
      if (entry.month && entry.title) {
        entries.push(entry)
      }
    } catch {
      // skip unparseable lines
    }
  }

  return { cleanText, entries }
}

function PlanBlock({ entries }) {
  const navigate = useNavigate()

  return (
    <div className="plan-block">
      <div className="plan-header">
        <span className="plan-label">Saved to your plan</span>
        <button className="view-plan-btn" onClick={() => navigate('/plan')}>
          View plan →
        </button>
      </div>
      <div className="plan-entries">
        {entries.map((entry, i) => (
          <div key={i} className="plan-entry saved">
            <div className="plan-month">{MONTHS[entry.month - 1]}</div>
            <div className="plan-content">
              <div className="plan-title">{entry.title}</div>
            </div>
            <span className="entry-check">✓</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [contextData, setContextData] = useState({ weather: null, enso: null })
  const [profile, setProfile] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load saved chat messages on mount
  useEffect(() => {
    getChatMessages().then((saved) => {
      if (saved && saved.length > 0) setMessages(saved)
    })
  }, [])

  // Fetch profile + weather + ENSO on mount
  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p)
      if (p?.lat && p?.lon) {
        fetchWeather(p.lat, p.lon).then((w) => setContextData((d) => ({ ...d, weather: w }))).catch(() => {})
      }
      fetchENSO().then((e) => setContextData((d) => ({ ...d, enso: e }))).catch(() => {})
    })
  }, [])

  const send = async (text) => {
    if (!text.trim() || streaming) return
    setError(null)

    const userMsg = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages([...newMessages, { role: 'assistant', content: '', loading: true }])
    setInput('')

    try {
      setStreaming(true)
      const fullText = await sendMessage(newMessages, (partial) => {
        setMessages([...newMessages, { role: 'assistant', content: partial }])
      }, contextData)
      const finalMessages = [...newMessages, { role: 'assistant', content: fullText }]
      setMessages(finalMessages)
      saveChatMessages(finalMessages)

      // Auto-save any plan entries to calendar
      const { entries } = parsePlanEntries(fullText)
      if (entries.length > 0) {
        for (const entry of entries) {
          await addPlanEntry(entry)
        }
      }
    } catch (err) {
      setMessages(newMessages)
      setError(err.message || 'Could not reach the advisor. Check your connection.')
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    send(input)
  }

  const isEmpty = messages.length === 0

  return (
    <div className="chat-page">
      <div className="chat-messages">
        {isEmpty && (
          <div className="chat-empty">
            <div className="chat-empty-icon">🌱</div>
            <h2>Ask Munda</h2>
            <p>Ask any farming question. I know the regenerative practices for Zambian conditions and your specific farm.</p>
            <div className="suggestions">
              {getSuggestions(profile, contextData.weather).map((s) => (
                <button key={s} className="suggestion-btn" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <div key={i} className="chat-bubble user">
                <div className="bubble-content">
                  <div className="bubble-text">{msg.content}</div>
                </div>
              </div>
            )
          }

          const { cleanText, entries } = parsePlanEntries(msg.content || '')

          return (
            <div key={i} className="chat-bubble assistant">
              <div className="bubble-avatar">🌱</div>
              <div className="bubble-content">
                {msg.loading ? (
                  <div className="typing-indicator">
                    <span /><span /><span />
                  </div>
                ) : (
                  <>
                    {cleanText && <div className="bubble-text"><Markdown>{cleanText}</Markdown></div>}
                    {entries.length > 0 && <PlanBlock entries={entries} />}
                  </>
                )}
              </div>
            </div>
          )
        })}

        {error && (
          <div className="chat-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your farm..."
          disabled={streaming}
          autoComplete="off"
        />
        <button
          type="submit"
          className="send-btn"
          disabled={!input.trim() || streaming}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  )
}
