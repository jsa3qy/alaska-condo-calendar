# Alaska Condo Calendar

A visit reservation system for managing guest stays at a shared property. Users can propose visit dates, and admins can review, approve, or deny requests.

## Features

- **Calendar View** - Interactive monthly calendar showing all confirmed visits
- **Visit Proposals** - Users can propose dates with optional arrival/departure times and notes
- **My Visits** - Track submitted proposals and their status
- **Admin Panel** - Review pending visits, approve/deny requests, create visits on behalf of users
- **Authentication** - Email/password sign up and sign in

## Tech Stack

- React 19 + Vite
- Supabase (PostgreSQL, Auth, Row-Level Security)
- CSS with Nordic Cabin Modernism theme

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Run the schema in `supabase-schema.sql` against your Supabase database
4. Install dependencies and start:
   ```bash
   npm install
   npm run dev
   ```

## How Visits Work

1. **User proposes a visit** - Submits dates, times, and notes
2. **Visit is pending** - Appears on calendar with dashed border
3. **Admin reviews** - Approves or denies the request
4. **Confirmed visits** - Appear on calendar with solid styling

## Deployment

Configured for GitHub Pages. Build with `npm run build`.
