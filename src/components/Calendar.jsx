import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  parseISO
} from 'date-fns'
import './Calendar.css'

function Calendar({ visits = [] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const goToToday = () => setCurrentMonth(new Date())

  const renderHeader = () => (
    <div className="calendar-header">
      <button onClick={prevMonth} className="nav-btn">&larr;</button>
      <div className="header-center">
        <h2>{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={goToToday} className="today-btn">Today</button>
      </div>
      <button onClick={nextMonth} className="nav-btn">&rarr;</button>
    </div>
  )

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return (
      <div className="calendar-days">
        {days.map(day => (
          <div key={day} className="day-name">{day}</div>
        ))}
      </div>
    )
  }

  const getVisitsForDay = (day) => {
    return visits.filter(visit => {
      const start = parseISO(visit.start_date)
      const end = parseISO(visit.end_date)
      return isWithinInterval(day, { start, end })
    })
  }

  const getVisitPosition = (visit, day) => {
    const start = parseISO(visit.start_date)
    const end = parseISO(visit.end_date)
    const isStart = isSameDay(day, start)
    const isEnd = isSameDay(day, end)
    return { isStart, isEnd }
  }

  const formatTime = (time) => {
    if (!time) return null
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours, 10)
    const ampm = h >= 12 ? 'pm' : 'am'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes}${ampm}`
  }

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const rows = []
    let days = []
    let day = startDate

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const dayVisits = getVisitsForDay(day)
        const isCurrentMonth = isSameMonth(day, monthStart)
        const isToday = isSameDay(day, new Date())
        const currentDay = day

        days.push(
          <div
            key={day.toString()}
            className={`calendar-cell ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
          >
            <span className="day-number">{format(day, 'd')}</span>
            <div className="visits-container">
              {dayVisits.map((visit, idx) => {
                const { isStart, isEnd } = getVisitPosition(visit, currentDay)
                return (
                  <div
                    key={visit.id || idx}
                    className={`visit-bar ${isStart ? 'visit-start' : ''} ${isEnd ? 'visit-end' : ''}`}
                    style={{ backgroundColor: visit.color }}
                    title={`${visit.visitor_name}${visit.notes ? `: ${visit.notes}` : ''}`}
                  >
                    {isStart && (
                      <span className="visit-label">
                        {visit.visitor_name}
                        {visit.arrival_time && (
                          <span className="visit-time"> {formatTime(visit.arrival_time)}</span>
                        )}
                      </span>
                    )}
                    {isEnd && !isStart && visit.departure_time && (
                      <span className="visit-label visit-time">
                        {formatTime(visit.departure_time)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
        day = addDays(day, 1)
      }
      rows.push(
        <div key={day.toString()} className="calendar-row">
          {days}
        </div>
      )
      days = []
    }

    return <div className="calendar-body">{rows}</div>
  }

  return (
    <div className="calendar">
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  )
}

export default Calendar
