interface UsersPageProps {
  accessToken: string
}

export default function UsersPage({ accessToken }: UsersPageProps) {
  return (
    <div className="page">
      <h2>Users Management</h2>
      <p>Token: {accessToken.slice(0, 20)}...</p>
      <div className="coming-soon">
        <h3>Coming Soon</h3>
        <p>User management interface is being developed</p>
        <p>Features:</p>
        <ul>
          <li>List all employees</li>
          <li>Create new user accounts</li>
          <li>Edit user details (department, team, role, level)</li>
          <li>Assign permission templates to users per project</li>
          <li>View user audit history</li>
        </ul>
      </div>
    </div>
  )
}
