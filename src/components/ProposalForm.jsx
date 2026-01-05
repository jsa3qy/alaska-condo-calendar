import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './ProposalForm.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function ProposalForm({ onClose, onSubmitted }) {
  const { user, profile, getAccessToken } = useAuth()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const getHeaders = () => {
    const token = getAccessToken()
    return {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const headers = getHeaders()
      let visitorId

      // First, find existing visitor record for this user
      const existingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/visitors?user_id=eq.${user.id}&select=id`,
        { headers }
      )
      const existingVisitors = await existingRes.json()

      if (existingVisitors && existingVisitors.length > 0) {
        visitorId = existingVisitors[0].id
      } else {
        // Create new visitor linked to this user
        const createRes = await fetch(`${SUPABASE_URL}/rest/v1/visitors`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            user_id: user.id,
            name: profile?.name || user.email.split('@')[0],
            description: 'Registered user'
          })
        })

        if (!createRes.ok) {
          const errData = await createRes.json()
          throw new Error(errData.message || 'Failed to create visitor')
        }

        const newVisitors = await createRes.json()
        visitorId = newVisitors[0].id
      }

      // Create the visit proposal
      const visitRes = await fetch(`${SUPABASE_URL}/rest/v1/visits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          visitor_id: visitorId,
          submitted_by: user.id,
          start_date: startDate,
          end_date: endDate,
          arrival_time: arrivalTime || null,
          departure_time: departureTime || null,
          notes: notes || null,
          status: 'pending'
        })
      })

      if (!visitRes.ok) {
        const errData = await visitRes.json()
        throw new Error(errData.message || 'Failed to create visit')
      }

      onSubmitted?.()
      onClose?.()
    } catch (err) {
      console.error('Error submitting proposal:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Set minimum date to today
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="proposal-overlay" onClick={onClose}>
      <div className="proposal-modal" onClick={(e) => e.stopPropagation()}>
        <button className="proposal-close" onClick={onClose}>&times;</button>

        <h2>Propose Visit Dates</h2>
        <p className="proposal-subtitle">
          Submit your preferred dates for review
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startDate">Arrival Date *</label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={today}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="endDate">Departure Date *</label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || today}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="arrivalTime">Arrival Time</label>
              <input
                id="arrivalTime"
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                placeholder="Optional"
              />
              <span className="form-hint">Flight arrival time</span>
            </div>

            <div className="form-group">
              <label htmlFor="departureTime">Departure Time</label>
              <input
                id="departureTime"
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                placeholder="Optional"
              />
              <span className="form-hint">Flight departure time</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details about your visit..."
              rows={3}
            />
          </div>

          {error && <div className="proposal-error">{error}</div>}

          <div className="proposal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProposalForm
