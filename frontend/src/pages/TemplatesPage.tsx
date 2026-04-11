import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE } from '../api/client'
import '../styles/TemplatesPage.css'

interface PermissionRule {
  behavior: 'deny' | 'allow' | 'ask'
  tool: string
  content?: string
}

interface Template {
  id: number
  name: string
  description: string
  version: number
  rulesJson: string
  capabilitiesJson: string
  envOverridesJson: string
  status: string
}

interface TemplatesPageProps {
  accessToken: string
}

export default function TemplatesPage({ accessToken }: TemplatesPageProps) {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '' })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/admin/templates`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        if (response.status === 404) {
          setTemplates(getMockTemplates())
        } else {
          throw new Error('Failed to fetch templates')
        }
      } else {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (err) {
      setError((err as Error).message)
      setTemplates(getMockTemplates())
    } finally {
      setLoading(false)
    }
  }

  const getMockTemplates = (): Template[] => [
    {
      id: 1,
      name: '前端开发',
      description: '前端开发人员标准权限',
      version: 1,
      rulesJson: JSON.stringify([
        { behavior: 'deny', tool: 'Read', content: '*src/server/**' },
        { behavior: 'deny', tool: 'Edit', content: '*src/server/**' },
        { behavior: 'allow', tool: 'Read', content: '*src/client/**' },
        { behavior: 'allow', tool: 'Edit', content: '*src/client/**' },
      ]),
      capabilitiesJson: JSON.stringify(['policy.read.crossProject:7']),
      envOverridesJson: JSON.stringify({ BACKEND_DIR: 'src/server/', FRONTEND_DIR: 'src/client/' }),
      status: 'active',
    },
    {
      id: 2,
      name: '后端开发',
      description: '后端开发人员标准权限',
      version: 1,
      rulesJson: JSON.stringify([
        { behavior: 'allow', tool: 'Read', content: '*src/server/**' },
        { behavior: 'allow', tool: 'Edit', content: '*src/server/**' },
        { behavior: 'deny', tool: 'Read', content: '*src/client/**' },
        { behavior: 'deny', tool: 'Edit', content: '*src/client/**' },
      ]),
      capabilitiesJson: JSON.stringify(['policy.read.crossProject:14']),
      envOverridesJson: JSON.stringify({ BACKEND_DIR: 'src/server/', DATABASE_HOST: 'db.internal' }),
      status: 'active',
    },
    {
      id: 3,
      name: '测试工程师',
      description: '测试人员只读权限',
      version: 1,
      rulesJson: JSON.stringify([
        { behavior: 'allow', tool: 'Read', content: '**' },
        { behavior: 'deny', tool: 'Edit', content: '**' },
        { behavior: 'deny', tool: 'Write', content: '**' },
        { behavior: 'deny', tool: 'Bash', content: '**' },
      ]),
      capabilitiesJson: JSON.stringify([]),
      envOverridesJson: JSON.stringify({ TEST_ENV: 'true' }),
      status: 'active',
    },
    {
      id: 4,
      name: '运维工程师',
      description: '基础设施和部署权限',
      version: 1,
      rulesJson: JSON.stringify([
        { behavior: 'allow', tool: 'Read', content: '**' },
        { behavior: 'allow', tool: 'Edit', content: '*infra/**' },
        { behavior: 'allow', tool: 'Bash', content: 'docker,kubectl,terraform' },
        { behavior: 'ask', tool: 'Bash', content: 'rm -rf' },
      ]),
      capabilitiesJson: JSON.stringify(['policy.read.crossProject:7,14,21']),
      envOverridesJson: JSON.stringify({ CLUSTER: 'prod', NAMESPACE: 'default' }),
      status: 'active',
    },
    {
      id: 5,
      name: '数据分析师',
      description: '数据访问和分析权限',
      version: 1,
      rulesJson: JSON.stringify([
        { behavior: 'allow', tool: 'Read', content: '*data/**' },
        { behavior: 'allow', tool: 'Read', content: '*analytics/**' },
        { behavior: 'deny', tool: 'Edit', content: '*data/sensitive/**' },
      ]),
      capabilitiesJson: JSON.stringify([]),
      envOverridesJson: JSON.stringify({ DATABASE_READONLY: 'true' }),
      status: 'active',
    },
    {
      id: 6,
      name: '外包',
      description: '无任何权限',
      version: 1,
      rulesJson: JSON.stringify([
        { behavior: 'deny' as const, tool: 'Read', content: '**' },
        { behavior: 'deny' as const, tool: 'Edit', content: '**' },
        { behavior: 'deny' as const, tool: 'Write', content: '**' },
        { behavior: 'deny' as const, tool: 'Bash', content: '**' },
      ]),
      capabilitiesJson: JSON.stringify([]),
      envOverridesJson: JSON.stringify({}),
      status: 'active',
    },
    {
      id: 7,
      name: '运营',
      description: '运营素材文件夹权限，对demo项目无权限',
      version: 1,
      rulesJson: JSON.stringify([
        { behavior: 'allow' as const, tool: 'Read', content: '*assets/marketing/**' },
        { behavior: 'allow' as const, tool: 'Edit', content: '*assets/marketing/**' },
        { behavior: 'deny' as const, tool: 'Read', content: '**' },
        { behavior: 'deny' as const, tool: 'Edit', content: '**' },
      ]),
      capabilitiesJson: JSON.stringify([]),
      envOverridesJson: JSON.stringify({ DEMO_PROJECT_BLOCK: 'true' }),
      status: 'active',
    },
  ]

  const parseJson = (jsonStr: string) => {
    try {
      return JSON.parse(jsonStr)
    } catch {
      return []
    }
  }

  const getBehaviorColor = (behavior: string) => {
    switch (behavior) {
      case 'deny':
        return '#e74c3c'
      case 'allow':
        return '#27ae60'
      case 'ask':
        return '#f39c12'
      default:
        return '#999'
    }
  }

  const handleAdd = () => {
    setEditingTemplate(null)
    setFormData({ name: '', description: '' })
    setShowForm(true)
  }

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setFormData({ name: template.name, description: template.description })
    setShowForm(true)
  }

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert(t('template.nameRequired'))
      return
    }

    if (editingTemplate) {
      // 编辑现有模板
      setTemplates(
        templates.map((t) =>
          t.id === editingTemplate.id
            ? { ...t, name: formData.name, description: formData.description }
            : t
        )
      )
    } else {
      // 新增模板
      const newTemplate: Template = {
        id: Math.max(...templates.map((t) => t.id), 0) + 1,
        name: formData.name,
        description: formData.description,
        version: 1,
        rulesJson: JSON.stringify([]),
        capabilitiesJson: JSON.stringify([]),
        envOverridesJson: JSON.stringify({}),
        status: 'active',
      }
      setTemplates([...templates, newTemplate])
    }

    setShowForm(false)
    setSelectedTemplate(null)
  }

  const handleDelete = (id: number) => {
    if (confirm(t('template.confirmDelete'))) {
      setTemplates(templates.filter((t) => t.id !== id))
      setSelectedTemplate(null)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingTemplate(null)
    setFormData({ name: '', description: '' })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>{t('templates.title')}</h2>
        <button className="btn-primary" onClick={handleAdd}>
          + {t('btn.add')}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="templates-grid">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
              onClick={() => setSelectedTemplate(selectedTemplate?.id === template.id ? null : template)}
            >
              <div className="template-header">
                <h3>{template.name}</h3>
                <span className={`status ${template.status}`}>{template.status}</span>
              </div>
              <p className="description">{template.description}</p>

              <div className="template-info">
                <div className="info-item">
                  <strong>Rules:</strong>
                  <span>{parseJson(template.rulesJson).length}</span>
                </div>
                <div className="info-item">
                  <strong>Capabilities:</strong>
                  <span>{parseJson(template.capabilitiesJson).length}</span>
                </div>
                <div className="info-item">
                  <strong>Version:</strong>
                  <span>{template.version}</span>
                </div>
              </div>

              {selectedTemplate?.id === template.id && (
                <div className="template-details">
                  <div className="section">
                    <h4>Permission Rules</h4>
                    <div className="rules-list">
                      {parseJson(template.rulesJson).map((rule: PermissionRule, idx: number) => (
                        <div key={idx} className="rule-item">
                          <span
                            className="behavior"
                            style={{ color: getBehaviorColor(rule.behavior) }}
                          >
                            {rule.behavior.toUpperCase()}
                          </span>
                          <span className="tool">{rule.tool}</span>
                          {rule.content && <span className="content">{rule.content}</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {parseJson(template.capabilitiesJson).length > 0 && (
                    <div className="section">
                      <h4>Capabilities</h4>
                      <div className="capabilities-list">
                        {parseJson(template.capabilitiesJson).map((cap: string, idx: number) => (
                          <span key={idx} className="capability">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="section">
                    <h4>Environment Overrides</h4>
                    <div className="env-list">
                      {Object.entries(parseJson(template.envOverridesJson)).map(([key, value]) => (
                        <div key={key} className="env-item">
                          <code>{key}</code>
                          <span>=</span>
                          <code>{String(value)}</code>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="template-actions">
                    <button className="btn-sm" onClick={() => handleEdit(template)}>
                      {t('btn.edit')}
                    </button>
                    <button className="btn-sm danger" onClick={() => handleDelete(template.id)}>
                      {t('btn.delete')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="info">
        <p>总计: {templates.length} 个模板</p>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingTemplate ? t('btn.edit') : t('btn.add')}</h3>
            <div className="form-group">
              <label>模板名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入模板名称"
              />
            </div>
            <div className="form-group">
              <label>描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="输入模板描述"
                rows={3}
              />
            </div>
            <div className="form-actions">
              <button className="btn-primary" onClick={handleSave}>
                {t('btn.save')}
              </button>
              <button className="btn-secondary" onClick={handleCancel}>
                {t('btn.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
