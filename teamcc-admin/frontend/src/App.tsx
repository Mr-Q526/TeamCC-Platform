import { useState, useEffect } from 'react'
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

    window.addEventListener('teamcc-auth-invalid', handleAuthInvalid)
    return () => window.removeEventListener('teamcc-auth-invalid', handleAuthInvalid)
  }, [])

  if (!accessToken) {
    return <LoginPage onLogin={handleLogin} />
  }

  return <Dashboard accessToken={accessToken} onLogout={handleLogout} />
}

export default App
