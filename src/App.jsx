import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Calendar from './components/Calendar'
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

function App() {
  const [visits, setVisits] = useState([])
  const [visitors, setVisitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch visitors
      const { data: visitorsData, error: visitorsError } = await supabase
        .from('visitors')
        .select('*')
        .order('name')

      if (visitorsError) throw visitorsError

      // Assign colors to visitors
      const visitorsWithColors = visitorsData.map((visitor, idx) => ({
        ...visitor,
        color: VISITOR_COLORS[idx % VISITOR_COLORS.length]
      }))

      setVisitors(visitorsWithColors)

      // Fetch visits with visitor info
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          visitors (
            id,
            name,
            description
          )
        `)
        .order('start_date')

      if (visitsError) throw visitsError

      // Map visits with visitor colors
      const visitsWithColors = visitsData.map(visit => {
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

  if (loading) {
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
        <h1>Alaska Condo Calendar</h1>
        <p>View upcoming visits and reservations</p>
      </header>

      <main>
        <Calendar visits={visits} />

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
      </main>

      <footer className="app-footer">
        <p>Alaska Condo Reservation Calendar</p>
      </footer>
    </div>
  )
}

export default App
