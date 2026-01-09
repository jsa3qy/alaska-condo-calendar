import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext({})

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for stored session on mount
    async function restoreSession() {
      const storedSession = localStorage.getItem('supabase_session')
      if (!storedSession) {
        setLoading(false)
        return
      }

      try {
        const session = JSON.parse(storedSession)
        if (!session.user || !session.refresh_token) {
          localStorage.removeItem('supabase_session')
          setLoading(false)
          return
        }

        // Always refresh the token on mount to ensure it's valid
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refresh_token: session.refresh_token })
        })

        const data = await res.json()

        if (data.error || !data.access_token) {
          // Refresh failed - session is invalid, clear it
          localStorage.removeItem('supabase_session')
          setLoading(false)
          return
        }

        // Update stored session with new tokens
        const newSession = {
          user: data.user,
          access_token: data.access_token,
          refresh_token: data.refresh_token
        }
        localStorage.setItem('supabase_session', JSON.stringify(newSession))

        setUser(data.user)
        await fetchProfile(data.user.id, data.access_token)
        setLoading(false)
      } catch (e) {
        localStorage.removeItem('supabase_session')
        setLoading(false)
      }
    }

    restoreSession()
  }, [])

  async function fetchProfile(userId, accessToken) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )
      const data = await res.json()
      if (data && data[0]) {
        setProfile(data[0])
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  async function signUp(email, password, name) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          data: { name }
        })
      })
      const data = await res.json()
      if (data.error) {
        return { data: null, error: data.error }
      }

      // If email confirmation is disabled, we get a session immediately
      if (data.access_token && data.user) {
        const session = {
          user: data.user,
          access_token: data.access_token,
          refresh_token: data.refresh_token
        }
        localStorage.setItem('supabase_session', JSON.stringify(session))
        setUser(data.user)
        if (data.user) {
          await fetchProfile(data.user.id, data.access_token)
        }
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: { message: error.message } }
    }
  }

  async function signIn(email, password) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()

      if (data.error || data.error_description) {
        return { data: null, error: { message: data.error_description || data.error } }
      }

      // Store session
      const session = {
        user: data.user,
        access_token: data.access_token,
        refresh_token: data.refresh_token
      }
      localStorage.setItem('supabase_session', JSON.stringify(session))

      setUser(data.user)
      if (data.user) {
        await fetchProfile(data.user.id, data.access_token)
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: { message: error.message } }
    }
  }

  async function signOut() {
    try {
      const storedSession = localStorage.getItem('supabase_session')
      if (storedSession) {
        const session = JSON.parse(storedSession)
        // Call logout endpoint
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${session.access_token}`
          }
        }).catch(() => {}) // Ignore errors
      }
    } finally {
      // Always clear local state
      localStorage.removeItem('supabase_session')
      setUser(null)
      setProfile(null)
    }
    return { error: null }
  }

  async function updateProfile(updates) {
    if (!user) return { error: { message: 'Not logged in' } }

    const storedSession = localStorage.getItem('supabase_session')
    if (!storedSession) return { error: { message: 'No session' } }

    try {
      const session = JSON.parse(storedSession)
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updates)
        }
      )
      const data = await res.json()
      if (data && data[0]) {
        setProfile(data[0])
        return { data: data[0], error: null }
      }
      return { data: null, error: { message: 'Update failed' } }
    } catch (error) {
      return { data: null, error: { message: error.message } }
    }
  }

  // Get current access token for API calls
  function getAccessToken() {
    const storedSession = localStorage.getItem('supabase_session')
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession)
        return session.access_token
      } catch (e) {
        return null
      }
    }
    return null
  }

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.is_admin ?? false,
    signUp,
    signIn,
    signOut,
    updateProfile,
    getAccessToken,
    refreshProfile: () => {
      const token = getAccessToken()
      if (user && token) fetchProfile(user.id, token)
    }
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
