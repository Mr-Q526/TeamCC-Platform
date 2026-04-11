import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE } from '../api/client'
import '../styles/LoginPage.css'

interface LoginPageProps {
  onLogin: (accessToken: string, refreshToken: string) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('password123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        throw new Error(t('login.failed'))
      }

      const data = await response.json()
      onLogin(data.accessToken, data.refreshToken)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>{t('app.title')}</h1>
        <p className="subtitle">{t('app.subtitle')}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">{t('login.username')}</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('login.password')}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? t('login.loggingIn') : t('login.button')}
          </button>
        </form>

        <p className="hint">{t('login.demo')}</p>
      </div>
    </div>
  )
}
