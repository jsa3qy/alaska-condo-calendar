import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import './AdminPanel.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function AdminPanel({ onClose, onUpdate }) {
  const { user, getAccessToken } = useAuth()
  const [pendingVisits, setPendingVisits] = useState([])
  const [allVisits, setAllVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const [activeTab, setActiveTab] = useState('pending')
  const [editingVisit, setEditingVisit] = useState(null)
  const [editForm, setEditForm] = useState({
    start_date: '',
    end_date: '',
    arrival_time: '',
    departure_time: '',
    notes: '',
    status: ''
  })

  const getHeaders = () => {
    const token = getAccessToken()
    return {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  }

  useEffect(() => {
    fetchVisits()
  }, [])

  async function fetchVisits() {
    try {
      const headers = getHeaders()

      // Fetch pending visits
      const pendingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/visits?status=eq.pending&select=*,visitors(name),profiles:submitted_by(email,name)&order=created_at.asc`,
        { headers }
      )
      const pendingData = await pendingRes.json()
      setPendingVisits(pendingData || [])

      // Fetch all non-pending visits
      const allRes = await fetch(
        `${SUPABASE_URL}/rest/v1/visits?status=neq.pending&select=*,visitors(name),profiles:submitted_by(email,name)&order=start_date.desc`,
        { headers }
      )
      const allData = await allRes.json()
      setAllVisits(allData || [])
    } catch (err) {
      console.error('Error fetching visits:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDecision(visitId, status) {
    setProcessing(visitId)

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/visits?id=eq.${visitId}`,
        {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({
            status,
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id
          })
        }
      )

      if (!res.ok) {
        throw new Error('Failed to update visit')
      }

      setPendingVisits(pendingVisits.filter(v => v.id !== visitId))
      onUpdate?.()
    } catch (err) {
      console.error('Error updating visit:', err)
      alert('Could not update visit. ' + err.message)
    } finally {
      setProcessing(null)
    }
  }

  async function handleDelete(visitId) {
    if (!confirm('Are you sure you want to delete this visit?')) return

    setProcessing(visitId)

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/visits?id=eq.${visitId}`,
        {
          method: 'DELETE',
          headers: getHeaders()
        }
      )

      if (!res.ok) {
        throw new Error('Failed to delete visit')
      }

      setPendingVisits(pendingVisits.filter(v => v.id !== visitId))
      setAllVisits(allVisits.filter(v => v.id !== visitId))
      onUpdate?.()
    } catch (err) {
      console.error('Error deleting visit:', err)
      alert('Could not delete visit. ' + err.message)
    } finally {
      setProcessing(null)
    }
  }

  function handleEdit(visit) {
    setEditingVisit(visit.id)
    setEditForm({
      start_date: visit.start_date,
      end_date: visit.end_date,
      arrival_time: visit.arrival_time || '',
      departure_time: visit.departure_time || '',
      notes: visit.notes || '',
      status: visit.status
    })
  }

  function handleCancelEdit() {
    setEditingVisit(null)
    setEditForm({
      start_date: '',
      end_date: '',
      arrival_time: '',
      departure_time: '',
      notes: '',
      status: ''
    })
  }

  async function handleSaveEdit(visitId) {
    setProcessing(visitId)

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/visits?id=eq.${visitId}`,
        {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({
            start_date: editForm.start_date,
            end_date: editForm.end_date,
            arrival_time: editForm.arrival_time || null,
            departure_time: editForm.departure_time || null,
            notes: editForm.notes || null,
            status: editForm.status
          })
        }
      )

      if (!res.ok) {
        throw new Error('Failed to update visit')
      }

      // Update local state
      const updateVisit = (visit) =>
        visit.id === visitId
          ? { ...visit, ...editForm, arrival_time: editForm.arrival_time || null, departure_time: editForm.departure_time || null, notes: editForm.notes || null }
          : visit

      setPendingVisits(pendingVisits.map(updateVisit))
      setAllVisits(allVisits.map(updateVisit))

      // If status changed, move between lists
      if (editForm.status === 'pending') {
        const updated = [...pendingVisits, ...allVisits].find(v => v.id === visitId)
        if (updated) {
          setPendingVisits(prev => prev.some(v => v.id === visitId) ? prev.map(updateVisit) : [...prev, updateVisit(updated)])
          setAllVisits(prev => prev.filter(v => v.id !== visitId))
        }
      } else {
        const updated = [...pendingVisits, ...allVisits].find(v => v.id === visitId)
        if (updated) {
          setAllVisits(prev => prev.some(v => v.id === visitId) ? prev.map(updateVisit) : [...prev, updateVisit(updated)])
          setPendingVisits(prev => prev.filter(v => v.id !== visitId))
        }
      }

      handleCancelEdit()
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

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Pending', className: 'status-pending' },
      confirmed: { label: 'Confirmed', className: 'status-confirmed' },
      denied: { label: 'Denied', className: 'status-denied' }
    }
    return badges[status] || badges.pending
  }

  const renderEditForm = (visit) => (
    <div className="pending-card editing">
      <div className="edit-form">
        <div className="edit-header">
          <span className="submitter-name">{visit.visitors?.name || 'Unknown'}</span>
          <span className="submitter-email">{visit.profiles?.email}</span>
        </div>

        <div className="edit-row">
          <div className="edit-field">
            <label>Start Date</label>
            <input
              type="date"
              value={editForm.start_date}
              onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
            />
          </div>
          <div className="edit-field">
            <label>End Date</label>
            <input
              type="date"
              value={editForm.end_date}
              onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
              min={editForm.start_date}
            />
          </div>
        </div>

        <div className="edit-row">
          <div className="edit-field">
            <label>Arrival Time</label>
            <input
              type="time"
              value={editForm.arrival_time}
              onChange={(e) => setEditForm({ ...editForm, arrival_time: e.target.value })}
            />
          </div>
          <div className="edit-field">
            <label>Departure Time</label>
            <input
              type="time"
              value={editForm.departure_time}
              onChange={(e) => setEditForm({ ...editForm, departure_time: e.target.value })}
            />
          </div>
        </div>

        <div className="edit-field">
          <label>Status</label>
          <select
            value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="denied">Denied</option>
          </select>
        </div>

        <div className="edit-field">
          <label>Notes</label>
          <textarea
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            rows={2}
          />
        </div>

        <div className="edit-actions">
          <button
            className="cancel-edit-btn"
            onClick={handleCancelEdit}
            disabled={processing === visit.id}
          >
            Cancel
          </button>
          <button
            className="save-btn"
            onClick={() => handleSaveEdit(visit.id)}
            disabled={processing === visit.id}
          >
            {processing === visit.id ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <button className="admin-close" onClick={onClose}>&times;</button>

        <h2>Manage Visits</h2>

        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending ({pendingVisits.length})
          </button>
          <button
            className={`admin-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Visits ({allVisits.length})
          </button>
        </div>

        {activeTab === 'pending' && (
          <>
            {pendingVisits.length === 0 ? (
              <div className="no-pending">
                <p>No pending proposals to review.</p>
              </div>
            ) : (
              <div className="pending-list">
                {pendingVisits.map(visit => (
                  editingVisit === visit.id ? (
                    <div key={visit.id}>{renderEditForm(visit)}</div>
                  ) : (
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
                          className="edit-btn"
                          onClick={() => handleEdit(visit)}
                          disabled={processing === visit.id}
                        >
                          Edit
                        </button>
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
                  )
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'all' && (
          <>
            {allVisits.length === 0 ? (
              <div className="no-pending">
                <p>No confirmed or denied visits.</p>
              </div>
            ) : (
              <div className="pending-list">
                {allVisits.map(visit => {
                  if (editingVisit === visit.id) {
                    return <div key={visit.id}>{renderEditForm(visit)}</div>
                  }
                  const badge = getStatusBadge(visit.status)
                  return (
                    <div key={visit.id} className="pending-card">
                      <div className="pending-header">
                        <div className="submitter-info">
                          <span className="submitter-name">
                            {visit.visitors?.name || 'Unknown'}
                          </span>
                          <span className={`status-badge ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
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
                          className="edit-btn"
                          onClick={() => handleEdit(visit)}
                          disabled={processing === visit.id}
                        >
                          Edit
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDelete(visit.id)}
                          disabled={processing === visit.id}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AdminPanel
