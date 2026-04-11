interface TemplatesPageProps {
  accessToken: string
}

export default function TemplatesPage({ accessToken }: TemplatesPageProps) {
  return (
    <div className="page">
      <h2>Permission Templates</h2>
      <p>Token: {accessToken.slice(0, 20)}...</p>
      <div className="coming-soon">
        <h3>Coming Soon</h3>
        <p>Permission template editor is being developed</p>
        <p>Features:</p>
        <ul>
          <li>List all permission templates</li>
          <li>Create new templates</li>
          <li>Edit permission rules (deny/allow/ask)</li>
          <li>Configure capabilities (cross-project, etc.)</li>
          <li>Set environment variable overrides</li>
          <li>Version management</li>
        </ul>
      </div>
    </div>
  )
}
