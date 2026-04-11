import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import UsersPage from './UsersPage'
import TemplatesPage from './TemplatesPage'
import '../styles/Dashboard.css'

interface DashboardProps {
  accessToken: string
  onLogout: () => void
}

export default function Dashboard({ accessToken, onLogout }: DashboardProps) {
  const { t, i18n } = useTranslation()
  const [currentPage, setCurrentPage] = useState<'home' | 'users' | 'templates' | 'audit'>('home')

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh'
    i18n.changeLanguage(newLang)
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>{t('app.title')}</h1>
        <div className="header-controls">
          <button onClick={toggleLanguage} className="lang-btn">
            {i18n.language === 'zh' ? 'English' : '中文'}
          </button>
          <button onClick={onLogout} className="logout-btn">
            {t('nav.logout')}
          </button>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button
          className={currentPage === 'home' ? 'active' : ''}
          onClick={() => setCurrentPage('home')}
        >
          {t('nav.dashboard')}
        </button>
        <button
          className={currentPage === 'users' ? 'active' : ''}
          onClick={() => setCurrentPage('users')}
        >
          {t('nav.users')}
        </button>
        <button
          className={currentPage === 'templates' ? 'active' : ''}
          onClick={() => setCurrentPage('templates')}
        >
          {t('nav.templates')}
        </button>
        <button
          className={currentPage === 'audit' ? 'active' : ''}
          onClick={() => setCurrentPage('audit')}
        >
          {t('nav.audit')}
        </button>
      </nav>

      <main className="dashboard-content">
        {currentPage === 'home' && (
          <div className="home-page">
            <h2>{t('home.welcome')}</h2>
            <p>{t('home.description')}</p>
            <div className="quick-stats">
              <div className="stat-card">
                <h3>{t('home.users.title')}</h3>
                <p>{t('home.users.desc')}</p>
                <button onClick={() => setCurrentPage('users')}>{t('home.users.button')}</button>
              </div>
              <div className="stat-card">
                <h3>{t('home.templates.title')}</h3>
                <p>{t('home.templates.desc')}</p>
                <button onClick={() => setCurrentPage('templates')}>{t('home.templates.button')}</button>
              </div>
              <div className="stat-card">
                <h3>{t('home.audit.title')}</h3>
                <p>{t('home.audit.desc')}</p>
                <button onClick={() => setCurrentPage('audit')}>{t('home.audit.button')}</button>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'users' && <UsersPage accessToken={accessToken} />}
        {currentPage === 'templates' && <TemplatesPage accessToken={accessToken} />}
        {currentPage === 'audit' && (
          <div className="page">
            <h2>{t('audit.title')}</h2>
            <p>{t('audit.comingSoon')}</p>
          </div>
        )}
      </main>
    </div>
  )
}
