import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './AdminPanel.css'

function AdminPanel({ onClose, onUpdate }) {
  const { user } = useAuth()
  const [pendingVisits, setPendingVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)

  useEffect(() => {
    fetchPendingVisits()
  }, [])

  async function fetchPendingVisits() {
    try {
      const { data, error } = await supabase
        .from('visits')
        .select(`
          *,
          visitors (name),
          profiles:submitted_by (email, name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (error) throw error
      setPendingVisits(data || [])
    } catch (err) {
      console.error('Error fetching pending visits:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDecision(visitId, status) {
    setProcessing(visitId)

    try {
      const { error } = await supabase
        .from('visits')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .eq('id', visitId)

      if (error) throw error

      setPendingVisits(pendingVisits.filter(v => v.id !== visitId))
      onUpdate?.()
    } catch (err) {
      console.error('Error updating visit:', err)
      alert('Could not update visit. ' + err.message)
    } finally {
      setProcessing(null)
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

  if (loading) {
    return (
      <div className="admin-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <button className="admin-close" onClick={onClose}>&times;</button>

        <h2>Pending Proposals</h2>
        <p className="admin-subtitle">
          Review and approve or deny visit requests
        </p>

        {pendingVisits.length === 0 ? (
          <div className="no-pending">
            <p>No pending proposals to review.</p>
          </div>
        ) : (
          <div className="pending-list">
            {pendingVisits.map(visit => (
              <div key={visit.id} className="pending-card">
                <div className="pending-header">
                  <div className="submitter-info">
                    <span className="submitter-name">
                      {visit.visitors?.name || 'Unknown'}
                    </span>
                    <span className="submitter-email">
                      {visit.profiles?.email}
                    </span>
                  </div>
                  <span className="submitted-date">
                    Submitted {format(parseISO(visit.created_at), 'MMM d')}
                  </span>
                </div>

                <div className="pending-dates">
                  <span className="date-range">
                    {formatDate(visit.start_date)} - {formatDate(visit.end_date)}
                  </span>
                </div>

                {(visit.arrival_time || visit.departure_time) && (
                  <div className="pending-times">
                    {visit.arrival_time && (
                      <span>Arrive: {formatTime(visit.arrival_time)}</span>
                    )}
                    {visit.departure_time && (
                      <span>Depart: {formatTime(visit.departure_time)}</span>
                    )}
                  </div>
                )}

                {visit.notes && (
                  <div className="pending-notes">{visit.notes}</div>
                )}

                <div className="pending-actions">
                  <button
                    className="deny-btn"
                    onClick={() => handleDecision(visit.id, 'denied')}
                    disabled={processing === visit.id}
                  >
                    Deny
                  </button>
                  <button
                    className="approve-btn"
                    onClick={() => handleDecision(visit.id, 'confirmed')}
                    disabled={processing === visit.id}
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPanel
