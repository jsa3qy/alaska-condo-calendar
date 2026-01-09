import { useState, useEffect, useMemo } from 'react'
import { supabase } from './lib/supabase'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Calendar from './components/Calendar'
import Auth from './components/Auth'
import ProposalForm from './components/ProposalForm'
import MyVisits from './components/MyVisits'
import AdminPanel from './components/AdminPanel'
import OwnerStatusPanel from './components/OwnerStatusPanel'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  parseISO,
  isWithinInterval,
  areIntervalsOverlapping
} from 'date-fns'
import './App.css'

const VISITOR_COLORS = [
  '#5b8fb9', // Mountain Blue
  '#6b9b6b', // Pine
  '#c4854a', // Sunset
  '#b87878', // Fireweed
  '#8878a8', // Twilight
  '#5b9b9b', // Glacier
  '#c47868', // Coral
  '#8b9b6b', // Olive
]

function AppContent() {
  const { user, profile, isAdmin, loading: authLoading, signOut } = useAuth()
  const [visits, setVisits] = useState([])
  const [visitors, setVisitors] = useState([])
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Modal states
  const [showAuth, setShowAuth] = useState(false)
  const [showProposal, setShowProposal] = useState(false)
  const [showMyVisits, setShowMyVisits] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)

  useEffect(() => {
    // Wait for auth to finish loading before fetching data
    if (!authLoading) {
      fetchData()
    }
  }, [user, authLoading])  // Refetch when user logs in/out or auth finishes loading

  const fetchData = async () => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

    // Use user's auth token if logged in, otherwise anon key
    const storedSession = localStorage.getItem('supabase_session')
    let token = SUPABASE_KEY
    if (storedSession) {
      try {
        token = JSON.parse(storedSession).access_token || SUPABASE_KEY
      } catch (e) {
        // Fall back to anon key
      }
    }

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    try {
      setLoading(true)
      // Fetch visitors
      const visitorsRes = await fetch(`${SUPABASE_URL}/rest/v1/visitors?select=*&order=name`, { headers })
      if (!visitorsRes.ok) throw new Error(`Visitors fetch failed: ${visitorsRes.status}`)
      const visitorsData = await visitorsRes.json()

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

      // Fetch admin profiles (owners)
      const adminsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?is_admin=eq.true&select=id,name,email,owner_status,owner_status_until`,
        { headers }
      )
      if (adminsRes.ok) {
        const adminsData = await adminsRes.json()
        setAdmins(adminsData || [])
      }
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

  // Filter visitors to only those with visits in the current calendar view
  const visibleVisitors = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const viewStart = startOfWeek(monthStart)
    const viewEnd = endOfWeek(monthEnd)

    // Find visitor IDs that have non-denied visits overlapping with the current view
    const visitorIdsInView = new Set(
      visits
        .filter(visit => {
          if (visit.status === 'denied') return false
          const visitStart = parseISO(visit.start_date)
          const visitEnd = parseISO(visit.end_date)
          return areIntervalsOverlapping(
            { start: viewStart, end: viewEnd },
            { start: visitStart, end: visitEnd },
            { inclusive: true }
          )
        })
        .map(visit => visit.visitor_id)
    )

    return visitors.filter(v => visitorIdsInView.has(v.id))
  }, [visitors, visits, currentMonth])

  if (loading || authLoading) {
    return (
      <div className="app">
        <div className="loading">Loading calendar...</div>
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
            <h1>4503 Visitors Calendar</h1>
            <p>View upcoming visits to Jesse and Paul's</p>
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
        <OwnerStatusPanel admins={admins} visits={visits} onStatusChange={fetchData} />

        <Calendar visits={visits.filter(v => v.status !== 'denied')} currentMonth={currentMonth} onMonthChange={setCurrentMonth} />

        <div className="legend-section">
          {visibleVisitors.length > 0 && (
            <div className="legend">
              <h3>Visitors</h3>
              <div className="legend-items">
                {visibleVisitors.map(visitor => (
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
