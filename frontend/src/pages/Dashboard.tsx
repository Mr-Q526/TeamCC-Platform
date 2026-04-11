import { useState } from 'react'
import UsersPage from './UsersPage'
import TemplatesPage from './TemplatesPage'
import '../styles/Dashboard.css'

interface DashboardProps {
  accessToken: string
  onLogout: () => void
}

export default function Dashboard({ accessToken, onLogout }: DashboardProps) {
  const [currentPage, setCurrentPage] = useState<'home' | 'users' | 'templates' | 'audit'>('home')

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>TeamCC Admin</h1>
        <button onClick={onLogout} className="logout-btn">
          Logout
        </button>
      </header>

      <nav className="dashboard-nav">
        <button
          className={currentPage === 'home' ? 'active' : ''}
          onClick={() => setCurrentPage('home')}
        >
          Dashboard
        </button>
        <button
          className={currentPage === 'users' ? 'active' : ''}
          onClick={() => setCurrentPage('users')}
        >
          Users
        </button>
        <button
          className={currentPage === 'templates' ? 'active' : ''}
          onClick={() => setCurrentPage('templates')}
        >
          Permission Templates
        </button>
        <button
          className={currentPage === 'audit' ? 'active' : ''}
          onClick={() => setCurrentPage('audit')}
        >
          Audit Log
        </button>
      </nav>

      <main className="dashboard-content">
        {currentPage === 'home' && (
          <div className="home-page">
            <h2>Welcome to TeamCC Admin</h2>
            <p>Manage identity and permissions for your organization</p>
            <div className="quick-stats">
              <div className="stat-card">
                <h3>Users</h3>
                <p>Manage employee accounts</p>
                <button onClick={() => setCurrentPage('users')}>Go to Users</button>
              </div>
              <div className="stat-card">
                <h3>Templates</h3>
                <p>Define permission templates</p>
                <button onClick={() => setCurrentPage('templates')}>Go to Templates</button>
              </div>
              <div className="stat-card">
                <h3>Audit</h3>
                <p>View activity logs</p>
                <button onClick={() => setCurrentPage('audit')}>Go to Audit</button>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'users' && <UsersPage accessToken={accessToken} />}
        {currentPage === 'templates' && <TemplatesPage accessToken={accessToken} />}
        {currentPage === 'audit' && (
          <div className="page">
            <h2>Audit Log</h2>
            <p>Coming soon...</p>
          </div>
        )}
      </main>
    </div>
  )
}
