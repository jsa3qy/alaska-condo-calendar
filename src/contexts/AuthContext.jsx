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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function initAuth() {
      // Check for email confirmation tokens in URL hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        // Get user info from the token
        try {
          const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${accessToken}`
            }
          })
          const userData = await res.json()

          if (userData && userData.id) {
            // Store session
            const session = {
              user: userData,
              access_token: accessToken,
              refresh_token: refreshToken
            }
            localStorage.setItem('supabase_session', JSON.stringify(session))
            setUser(userData)
            fetchProfile(userData.id, accessToken)

            // Clear the hash from URL
            history.replaceState(null, '', window.location.pathname + window.location.search)
            return
          }
        } catch (e) {
          console.error('Error processing auth tokens:', e)
        }
      }

      // Check for stored session
      const storedSession = localStorage.getItem('supabase_session')
      if (storedSession) {
        try {
          const session = JSON.parse(storedSession)
          if (session.user && session.access_token) {
            setUser(session.user)
            fetchProfile(session.user.id, session.access_token)
          }
        } catch (e) {
          localStorage.removeItem('supabase_session')
        }
      }
    }

    initAuth()
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
      // Build redirect URL for email confirmation
      const redirectUrl = window.location.origin + window.location.pathname
      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectUrl)}`, {
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
