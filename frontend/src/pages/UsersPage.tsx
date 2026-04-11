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
  101: 'dept.frontend', 102: 'dept.backend', 103: 'dept.qa', 104: 'dept.sre',
  105: 'dept.data', 106: 'dept.mobile', 107: 'dept.product', 108: 'dept.operations',
}

const TEAM_MAP: Record<number, string> = {
  1011: 'team.commerce-web', 1012: 'team.growth-mobile', 1013: 'team.admin-portal',
  1021: 'team.payment-infra', 1022: 'team.order-service', 1051: 'team.data-platform',
  1052: 'team.algorithm', 1071: 'team.product-growth', 1072: 'team.product-platform',
}

const ROLE_MAP: Record<number, string> = {
  201: 'role.frontend-developer', 202: 'role.backend-developer', 203: 'role.qa-engineer', 204: 'role.devops-sre',
}

const LEVEL_MAP: Record<number, string> = {
  301: 'level.p3', 302: 'level.p4', 303: 'level.p5', 304: 'level.p6', 305: 'level.p7',
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
        <button className="btn-primary">+ {t('btn.add')}</button>
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
                  <td>{t(DEPT_MAP[user.departmentId] || 'dept.frontend')}</td>
                  <td>{t(TEAM_MAP[user.teamId] || 'team.commerce-web')}</td>
                  <td>{t(ROLE_MAP[user.roleId] || 'role.frontend-developer')}</td>
                  <td className="level">{t(LEVEL_MAP[user.levelId] || 'level.p4')}</td>
                  <td>
                    <span className={`status ${user.status}`}>{t(`status.${user.status}`)}</span>
                  </td>
                  <td className="action">
                    <button className="btn-sm">{t('btn.edit')}</button>
                    <button className="btn-sm danger">{t('btn.delete')}</button>
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
