import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Calendar from './components/Calendar'
import Auth from './components/Auth'
import ProposalForm from './components/ProposalForm'
import MyVisits from './components/MyVisits'
import AdminPanel from './components/AdminPanel'
import './App.css'

const VISITOR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]

function AppContent() {
  const { user, profile, isAdmin, loading: authLoading, signOut } = useAuth()
  const [visits, setVisits] = useState([])
  const [visitors, setVisitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal states
  const [showAuth, setShowAuth] = useState(false)
  const [showProposal, setShowProposal] = useState(false)
  const [showMyVisits, setShowMyVisits] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }

    try {
      setLoading(true)
      console.log('Fetching data via direct API...')

      // Fetch visitors
      const visitorsRes = await fetch(`${SUPABASE_URL}/rest/v1/visitors?select=*&order=name`, { headers })
      if (!visitorsRes.ok) throw new Error(`Visitors fetch failed: ${visitorsRes.status}`)
      const visitorsData = await visitorsRes.json()
      console.log('Visitors:', visitorsData)

      // Assign colors to visitors
      const visitorsWithColors = (visitorsData || []).map((visitor, idx) => ({
        ...visitor,
        color: VISITOR_COLORS[idx % VISITOR_COLORS.length]
      }))

      setVisitors(visitorsWithColors)

      // Fetch visits with visitor info
      const visitsRes = await fetch(`${SUPABASE_URL}/rest/v1/visits?select=*,visitors(id,name,description)&order=start_date`, { headers })
      if (!visitsRes.ok) throw new Error(`Visits fetch failed: ${visitsRes.status}`)
      const visitsData = await visitsRes.json()
      console.log('Visits:', visitsData)

      // Map visits with visitor colors
      const visitsWithColors = (visitsData || []).map(visit => {
        const visitor = visitorsWithColors.find(v => v.id === visit.visitor_id)
        return {
          ...visit,
          visitor_name: visit.visitors?.name || 'Unknown',
          color: visitor?.color || '#6b7280'
        }
      })

      setVisits(visitsWithColors)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  // Count pending visits for admin badge
  const pendingCount = visits.filter(v => v.status === 'pending').length

  console.log('Render state:', { loading, authLoading })

  if (loading || authLoading) {
    return (
      <div className="app">
        <div className="loading">Loading calendar... (data: {loading ? 'loading' : 'done'}, auth: {authLoading ? 'loading' : 'done'})</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">
          <h2>Error loading data</h2>
          <p>{error}</p>
          <p className="hint">Make sure you've set up your Supabase environment variables.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Alaska Condo Calendar</h1>
            <p>View upcoming visits and reservations</p>
          </div>

          <div className="header-actions">
            {user ? (
              <>
                <span className="user-greeting">
                  Hi, {profile?.name || user.email.split('@')[0]}
                  {isAdmin && <span className="admin-badge">Admin</span>}
                </span>

                <button className="header-btn" onClick={() => setShowProposal(true)}>
                  Propose Visit
                </button>

                <button className="header-btn secondary" onClick={() => setShowMyVisits(true)}>
                  My Visits
                </button>

                {isAdmin && (
                  <button className="header-btn admin" onClick={() => setShowAdmin(true)}>
                    Review
                    {pendingCount > 0 && (
                      <span className="pending-badge">{pendingCount}</span>
                    )}
                  </button>
                )}

                <button className="header-btn ghost" onClick={handleSignOut}>
                  Sign Out
                </button>
              </>
            ) : (
              <button className="header-btn" onClick={() => setShowAuth(true)}>
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <Calendar visits={visits} />

        <div className="legend-section">
          {visitors.length > 0 && (
            <div className="legend">
              <h3>Visitors</h3>
              <div className="legend-items">
                {visitors.map(visitor => (
                  <div key={visitor.id} className="legend-item">
                    <span
                      className="legend-color"
                      style={{ backgroundColor: visitor.color }}
                    />
                    <span className="legend-name">{visitor.name}</span>
                    {visitor.description && (
                      <span className="legend-desc">{visitor.description}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="status-legend">
            <h3>Status</h3>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-color confirmed" />
                <span className="legend-name">Confirmed</span>
              </div>
              <div className="legend-item">
                <span className="legend-color pending" />
                <span className="legend-name">Pending Review</span>
              </div>
              <div className="legend-item">
                <span className="legend-color denied" />
                <span className="legend-name">Denied</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>Alaska Condo Reservation Calendar</p>
      </footer>

      {/* Modals */}
      {showAuth && (
        <Auth onClose={() => setShowAuth(false)} />
      )}

      {showProposal && user && (
        <ProposalForm
          onClose={() => setShowProposal(false)}
          onSubmitted={fetchData}
        />
      )}

      {showMyVisits && user && (
        <MyVisits
          onClose={() => setShowMyVisits(false)}
          onUpdate={fetchData}
        />
      )}

      {showAdmin && isAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          onUpdate={fetchData}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
