import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MundaTracker from './MundaTracker'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/*" element={<MundaTracker />} />
      </Routes>
    </BrowserRouter>
  )
}
