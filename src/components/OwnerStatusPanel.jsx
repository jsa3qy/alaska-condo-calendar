import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { parseISO, isBefore, isAfter, startOfDay } from 'date-fns'
import './OwnerStatusPanel.css'

export default function OwnerStatusPanel({ admins, visits, onStatusChange }) {
  const { user, isAdmin, updateOwnerStatus } = useAuth()
  const [updating, setUpdating] = useState(null)

  const today = startOfDay(new Date())

  // Check if an admin's until date has expired
  const isUntilExpired = (admin) => {
    if (!admin.owner_status_until) return false
    const untilDate = parseISO(admin.owner_status_until)
    return isBefore(untilDate, today)
  }

  // Auto-update expired statuses
  useEffect(() => {
    admins.forEach(async (admin) => {
      if (admin.owner_status === 'in_town_indefinitely' && isUntilExpired(admin)) {
        // Until date passed - update to out of state
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
        const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
        const storedSession = localStorage.getItem('supabase_session')
        const token = storedSession ? JSON.parse(storedSession).access_token : SUPABASE_KEY

        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${admin.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            owner_status: 'out_of_state_indefinitely',
            owner_status_until: null
          })
        })
        if (onStatusChange) onStatusChange()
      }
    })
  }, [admins])

  // Check if admin has a CONFIRMED visit happening now
  const getCurrentVisit = (adminId) => {
    return visits.find(visit => {
      if (visit.status !== 'confirmed') return false
      if (visit.submitted_by !== adminId) return false
      const startDate = parseISO(visit.start_date)
      const endDate = parseISO(visit.end_date)
      return !isBefore(today, startDate) && !isAfter(today, endDate)
    })
  }

  // Get next upcoming visit (confirmed or pending)
  const getNextVisit = (adminId) => {
    return visits
      .filter(visit => {
        if (visit.status === 'denied') return false
        if (visit.submitted_by !== adminId) return false
        const startDate = parseISO(visit.start_date)
        return isAfter(startDate, today)
      })
      .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date))[0]
  }

  const formatDateRange = (visit) => {
    const start = parseISO(visit.start_date)
    const end = parseISO(visit.end_date)
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${startStr} - ${endStr}`
  }

  const updateAdminProfile = async (adminId, updates) => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
    const storedSession = localStorage.getItem('supabase_session')
    const token = storedSession ? JSON.parse(storedSession).access_token : SUPABASE_KEY

    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${adminId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    })
  }

  const handleToggle = async (adminId, currentStatus) => {
    if (!isAdmin) return // Only admins can toggle

    // Toggle between in_town and out_of_state
    const newStatus = currentStatus === 'in_town_indefinitely'
      ? 'out_of_state_indefinitely'
      : 'in_town_indefinitely'

    // Clear until date when switching to out of state
    const updates = { owner_status: newStatus }
    if (newStatus === 'out_of_state_indefinitely') {
      updates.owner_status_until = null
    }

    setUpdating(adminId)
    try {
      await updateAdminProfile(adminId, updates)
      if (onStatusChange) onStatusChange()
    } finally {
      setUpdating(null)
    }
  }

  const handleUntilChange = async (adminId, date) => {
    if (!isAdmin) return

    setUpdating(adminId)
    try {
      await updateAdminProfile(adminId, { owner_status_until: date || null })
      if (onStatusChange) onStatusChange()
    } finally {
      setUpdating(null)
    }
  }

  const formatUntilDate = (dateStr) => {
    if (!dateStr) return null
    const date = parseISO(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (!admins || admins.length === 0) return null

  return (
    <div className="owner-status-panel">
      <div className="owner-list">
        {admins.map(admin => {
          const currentVisit = getCurrentVisit(admin.id)
          const nextVisit = getNextVisit(admin.id)
          const isUpdating = updating === admin.id
          const expired = isUntilExpired(admin)
          const isInTown = currentVisit || (admin.owner_status === 'in_town_indefinitely' && !expired)
          const isLocked = !!currentVisit // Can't toggle if currently visiting

          const canToggle = isAdmin && !isLocked

          return (
            <div key={admin.id} className="owner-item">
              <div className="owner-name-status">
                <span className="owner-name">{admin.name || admin.email.split('@')[0]}</span>
                <button
                  className={`status-toggle ${isInTown ? 'in-town' : 'out-of-state'} ${isLocked ? 'locked' : ''} ${isUpdating ? 'updating' : ''}`}
                  onClick={() => canToggle && handleToggle(admin.id, admin.owner_status)}
                  disabled={!canToggle || isUpdating}
                  title={isLocked ? 'Status locked during active visit' : canToggle ? 'Click to toggle' : ''}
                >
                  {isInTown ? 'In Town' : 'Out of State'}
                </button>
              </div>

              {currentVisit ? (
                <span className="visit-date">{formatDateRange(currentVisit)}</span>
              ) : isInTown && isAdmin ? (
                <div className="until-wrapper">
                  {admin.owner_status_until ? (
                    <>
                      <span className="until-label">until</span>
                      <input
                        type="date"
                        className="until-input"
                        value={admin.owner_status_until}
                        onChange={(e) => handleUntilChange(admin.id, e.target.value)}
                        disabled={isUpdating}
                      />
                      <button
                        className="until-clear"
                        onClick={() => handleUntilChange(admin.id, null)}
                        disabled={isUpdating}
                        title="Set to indefinitely"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="until-indefinite">indefinitely</span>
                      <input
                        type="date"
                        className="until-input until-input-hidden"
                        value=""
                        onChange={(e) => handleUntilChange(admin.id, e.target.value)}
                        disabled={isUpdating}
                        title="Set end date"
                      />
                    </>
                  )}
                </div>
              ) : isInTown && admin.owner_status_until ? (
                <span className="visit-date">until {formatUntilDate(admin.owner_status_until)}</span>
              ) : isInTown ? (
                <span className="visit-date subtle">indefinitely</span>
              ) : nextVisit ? (
                <span className="visit-date next">
                  Next: {formatDateRange(nextVisit)}
                  {nextVisit.status === 'pending' && <span className="pending-indicator">*</span>}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
