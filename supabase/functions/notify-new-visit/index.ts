import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const NOTIFY_EMAILS = ["jessealloy@gmail.com", "benoitpaul6@gmail.com"]

interface VisitPayload {
  type: "INSERT"
  table: "visits"
  record: {
    id: string
    start_date: string
    end_date: string
    arrival_time?: string
    departure_time?: string
    notes?: string
    status: string
    visitor_id: string
  }
}

Deno.serve(async (req) => {
  try {
    const payload: VisitPayload = await req.json()

    // Only notify for new pending visits
    if (payload.type !== "INSERT" || payload.record.status !== "pending") {
      return new Response(JSON.stringify({ message: "Skipped - not a new pending visit" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    const visit = payload.record
    const startDate = new Date(visit.start_date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    const endDate = new Date(visit.end_date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    const arrivalInfo = visit.arrival_time ? ` (arriving ${visit.arrival_time})` : ""
    const departureInfo = visit.departure_time ? ` (departing ${visit.departure_time})` : ""
    const notesInfo = visit.notes ? `\n\nNotes: ${visit.notes}` : ""

    const emailHtml = `
      <h2>New Visit Proposal</h2>
      <p>A new visit has been proposed for the Alaska condo:</p>
      <ul>
        <li><strong>Start:</strong> ${startDate}${arrivalInfo}</li>
        <li><strong>End:</strong> ${endDate}${departureInfo}</li>
      </ul>
      ${visit.notes ? `<p><strong>Notes:</strong> ${visit.notes}</p>` : ""}
      <p>Log in to the calendar to review and approve or deny this request.</p>
    `

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Alaska Condo Calendar <onboarding@resend.dev>",
        to: NOTIFY_EMAILS,
        subject: `New Visit Proposal: ${startDate} - ${endDate}`,
        html: emailHtml,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("Resend error:", data)
      return new Response(JSON.stringify({ error: data }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ message: "Email sent", data }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Function error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
