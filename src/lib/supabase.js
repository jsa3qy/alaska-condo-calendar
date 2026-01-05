import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase config:', {
  url: supabaseUrl || 'MISSING - using placeholder',
  keySet: supabaseAnonKey ? 'yes' : 'MISSING'
})

// Test if we can reach Supabase at all
if (supabaseUrl) {
  fetch(`${supabaseUrl}/rest/v1/`, {
    headers: { 'apikey': supabaseAnonKey }
  })
    .then(r => console.log('Supabase reachable:', r.status))
    .catch(e => console.error('Supabase unreachable:', e))
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
