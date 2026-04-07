import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getSession, getProfile, onAuthChange } from './lib/auth'
import Login from './pages/Login'
import MundaTracker from './MundaTracker'
import Admin from './pages/Admin'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    getSession().then(s => {
      setSession(s)
      if (s) getProfile().then(setProfile)
    })

    const { data: { subscription } } = onAuthChange(s => {
      setSession(s)
      if (s) getProfile().then(setProfile)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Loading
  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Source Sans 3', system-ui, sans-serif", color: "#7A746B" }}>Loading...</div>
  }

  // DEV BYPASS: skip login during development
  // if (!session) {
  //   return <Login />
  // }

  const isAdmin = profile?.role === 'admin'

  return (
    <BrowserRouter>
      <Routes>
        {isAdmin && <Route path="/admin" element={<Admin />} />}
        <Route path="/*" element={<MundaTracker userProfile={profile} />} />
      </Routes>
    </BrowserRouter>
  )
}
