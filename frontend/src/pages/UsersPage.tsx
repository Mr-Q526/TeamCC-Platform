import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE } from '../api/client'
import '../styles/UsersPage.css'

interface User {
  id: number
  username: string
  email: string
  departmentId: number
  teamId: number
  roleId: number
  levelId: number
  roles: string
  status: string
}

interface UsersPageProps {
  accessToken: string
}

const DEPT_MAP: Record<number, string> = {
  101: 'Frontend', 102: 'Backend', 103: 'QA', 104: 'SRE',
  105: 'Data', 106: 'Mobile', 107: 'Product', 108: 'Operations',
}

const TEAM_MAP: Record<number, string> = {
  1011: 'Commerce Web', 1012: 'Growth Mobile', 1013: 'Admin Portal',
  1021: 'Payment Infra', 1022: 'Order Service', 1051: 'Data Platform',
  1052: 'Algorithm', 1071: 'Product Growth', 1072: 'Product Platform',
}

const ROLE_MAP: Record<number, string> = {
  201: 'Frontend Dev', 202: 'Backend Dev', 203: 'QA Engineer', 204: 'DevOps/SRE',
}

const LEVEL_MAP: Record<number, string> = {
  301: 'P3', 302: 'P4', 303: 'P5', 304: 'P6', 305: 'P7',
}

export default function UsersPage({ accessToken }: UsersPageProps) {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/admin/users`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Endpoint not yet implemented, show mock data
          setUsers(getMockUsers())
        } else {
          throw new Error('Failed to fetch users')
        }
      } else {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      setError((err as Error).message)
      // Show mock data if endpoint not ready
      setUsers(getMockUsers())
    } finally {
      setLoading(false)
    }
  }

  const getMockUsers = (): User[] => [
    { id: 1, username: 'admin', email: 'admin@example.com', departmentId: 101, teamId: 1011, roleId: 201, levelId: 304, roles: 'admin', status: 'active' },
    { id: 2, username: 'alice', email: 'alice@example.com', departmentId: 101, teamId: 1011, roleId: 201, levelId: 303, roles: 'viewer', status: 'active' },
    { id: 3, username: 'bob', email: 'bob@example.com', departmentId: 102, teamId: 1021, roleId: 202, levelId: 303, roles: 'viewer', status: 'active' },
    { id: 4, username: 'carol', email: 'carol@example.com', departmentId: 102, teamId: 1022, roleId: 202, levelId: 302, roles: 'viewer', status: 'active' },
    { id: 5, username: 'david', email: 'david@example.com', departmentId: 103, teamId: 1013, roleId: 203, levelId: 302, roles: 'viewer', status: 'active' },
    { id: 6, username: 'emma', email: 'emma@example.com', departmentId: 104, teamId: 1021, roleId: 204, levelId: 303, roles: 'viewer', status: 'active' },
    { id: 7, username: 'frank', email: 'frank@example.com', departmentId: 105, teamId: 1051, roleId: 202, levelId: 302, roles: 'viewer', status: 'active' },
    { id: 8, username: 'grace', email: 'grace@example.com', departmentId: 106, teamId: 1012, roleId: 201, levelId: 302, roles: 'viewer', status: 'active' },
    { id: 9, username: 'henry', email: 'henry@example.com', departmentId: 102, teamId: 1022, roleId: 202, levelId: 303, roles: 'viewer', status: 'active' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <h2>{t('users.title')}</h2>
        <button className="btn-primary">+ {t('users.title')}</button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Department</th>
                <th>Team</th>
                <th>Role</th>
                <th>Level</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td className="username">{user.username}</td>
                  <td>{user.email}</td>
                  <td>{DEPT_MAP[user.departmentId] || 'Unknown'}</td>
                  <td>{TEAM_MAP[user.teamId] || 'Unknown'}</td>
                  <td>{ROLE_MAP[user.roleId] || 'Unknown'}</td>
                  <td className="level">{LEVEL_MAP[user.levelId] || 'Unknown'}</td>
                  <td>
                    <span className={`status ${user.status}`}>{user.status}</span>
                  </td>
                  <td className="action">
                    <button className="btn-sm">Edit</button>
                    <button className="btn-sm danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="info">
        <p>Total: {users.length} employees</p>
      </div>
    </div>
  )
}
