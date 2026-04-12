import { useState, useEffect } from 'react'
import {
  AUTH_INVALID_EVENT,
  AUTH_REFRESHED_EVENT,
} from './api/client'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('accessToken')
  )
  const [refreshToken, setRefreshToken] = useState<string | null>(
    localStorage.getItem('refreshToken')
  )

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken)
    } else {
      localStorage.removeItem('accessToken')
    }
  }, [accessToken])

  useEffect(() => {
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken)
    } else {
      localStorage.removeItem('refreshToken')
    }
  }, [refreshToken])

  const handleLogin = (access: string, refresh: string) => {
    setAccessToken(access)
    setRefreshToken(refresh)
  }

  const handleLogout = () => {
    setAccessToken(null)
    setRefreshToken(null)
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  useEffect(() => {
    const handleAuthInvalid = () => {
      setAccessToken(null)
      setRefreshToken(null)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    }

    const handleAuthRefreshed = (event: Event) => {
      const detail = (event as CustomEvent<{ accessToken: string; refreshToken: string }>).detail
      if (!detail) return
      setAccessToken(detail.accessToken)
      setRefreshToken(detail.refreshToken)
    }

    window.addEventListener(AUTH_INVALID_EVENT, handleAuthInvalid)
    window.addEventListener(AUTH_REFRESHED_EVENT, handleAuthRefreshed as EventListener)

    return () => {
      window.removeEventListener(AUTH_INVALID_EVENT, handleAuthInvalid)
      window.removeEventListener(AUTH_REFRESHED_EVENT, handleAuthRefreshed as EventListener)
    }
  }, [])

  if (!accessToken) {
    return <LoginPage onLogin={handleLogin} />
  }

  return <Dashboard accessToken={accessToken} onLogout={handleLogout} />
}

export default App
