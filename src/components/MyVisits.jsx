import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import './MyVisits.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function MyVisits({ onClose, onUpdate }) {
  const { user, getAccessToken } = useAuth()
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)

  const getHeaders = () => {
    const token = getAccessToken()
    return {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }

  useEffect(() => {
    fetchMyVisits()
  }, [user])

  async function fetchMyVisits() {
    if (!user) return

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/visits?submitted_by=eq.${user.id}&select=*&order=start_date.asc`,
        { headers: getHeaders() }
      )
      const data = await res.json()
      setVisits(data || [])
    } catch (err) {
      console.error('Error fetching visits:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(visitId, status) {
    const message = status === 'confirmed'
      ? 'Are you sure you want to cancel this confirmed visit?'
      : 'Are you sure you want to cancel this proposal?'

    if (!confirm(message)) return

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/visits?id=eq.${visitId}&submitted_by=eq.${user.id}`,
        {
          method: 'DELETE',
          headers: getHeaders()
        }
      )

      if (!res.ok) {
        throw new Error('Failed to cancel visit')
      }

      setVisits(visits.filter(v => v.id !== visitId))
      onUpdate?.()
    } catch (err) {
      console.error('Error canceling visit:', err)
      alert('Could not cancel visit. ' + err.message)
    }
  }

  const formatDate = (dateStr) => format(parseISO(dateStr), 'MMM d, yyyy')
  const formatTime = (timeStr) => {
    if (!timeStr) return null
    const [hours, minutes] = timeStr.split(':')
    const h = parseInt(hours, 10)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Pending Review', className: 'status-pending' },
      confirmed: { label: 'Confirmed', className: 'status-confirmed' },
      denied: { label: 'Denied', className: 'status-denied' }
    }
    return badges[status] || badges.pending
  }

  if (loading) {
    return (
      <div className="my-visits-overlay" onClick={onClose}>
        <div className="my-visits-modal" onClick={(e) => e.stopPropagation()}>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="my-visits-overlay" onClick={onClose}>
      <div className="my-visits-modal" onClick={(e) => e.stopPropagation()}>
        <button className="my-visits-close" onClick={onClose}>&times;</button>

        <h2>My Visit Proposals</h2>
        <p className="my-visits-subtitle">
          Track the status of your submitted visit requests
        </p>

        {visits.length === 0 ? (
          <div className="no-visits">
            <p>You haven't submitted any visit proposals yet.</p>
          </div>
        ) : (
          <div className="visits-list">
            {visits.map(visit => {
              const badge = getStatusBadge(visit.status)
              return (
                <div key={visit.id} className={`visit-card ${visit.status}`}>
                  <div className="visit-header">
                    <span className={`status-badge ${badge.className}`}>
                      {badge.label}
                    </span>
                    {visit.status !== 'denied' && (
                      <button
                        className="cancel-btn"
                        onClick={() => handleCancel(visit.id, visit.status)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  <div className="visit-dates">
                    <span className="date-range">
                      {formatDate(visit.start_date)} - {formatDate(visit.end_date)}
                    </span>
                  </div>

                  {(visit.arrival_time || visit.departure_time) && (
                    <div className="visit-times">
                      {visit.arrival_time && (
                        <span>Arrive: {formatTime(visit.arrival_time)}</span>
                      )}
                      {visit.departure_time && (
                        <span>Depart: {formatTime(visit.departure_time)}</span>
                      )}
                    </div>
                  )}

                  {visit.notes && (
                    <div className="visit-notes">{visit.notes}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default MyVisits
