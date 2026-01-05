import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './ProposalForm.css'

function ProposalForm({ onClose, onSubmitted }) {
  const { user, profile } = useAuth()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // First, find or create a visitor record for this user
      let visitorId

      const { data: existingVisitor } = await supabase
        .from('visitors')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existingVisitor) {
        visitorId = existingVisitor.id
      } else {
        // Create new visitor linked to this user
        const { data: newVisitor, error: visitorError } = await supabase
          .from('visitors')
          .insert({
            user_id: user.id,
            name: profile?.name || user.email.split('@')[0],
            description: 'Registered user'
          })
          .select('id')
          .single()

        if (visitorError) throw visitorError
        visitorId = newVisitor.id
      }

      // Create the visit proposal
      const { error: visitError } = await supabase
        .from('visits')
        .insert({
          visitor_id: visitorId,
          submitted_by: user.id,
          start_date: startDate,
          end_date: endDate,
          arrival_time: arrivalTime || null,
          departure_time: departureTime || null,
          notes: notes || null,
          status: 'pending'
        })

      if (visitError) throw visitError

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
