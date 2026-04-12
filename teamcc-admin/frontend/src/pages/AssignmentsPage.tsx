import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  deleteAssignment,
  getAllAssignments,
  getDictionaries,
  getTemplates,
  getUsers,
  upsertAssignment,
} from '../api/client'
import AppIcon from '../components/AppIcon'
import '../styles/AssignmentsPage.css'

interface Assignment {
  userId: number
  projectId: number
  templateIds: string
  extraRulesJson: string | null
  expiresAt: string | null
}

interface User {
  id: number
  username: string
  email: string
  status: string
}

interface TemplateOption {
  id: number
  name: string
  description: string
  status: string
  rulesJson: string
}

interface DictEntry {
  id: number
  name: string
}

interface AssignmentsPageProps {
  accessToken: string
  onDataChange?: () => void
}

type ViewMode = 'user' | 'project' | 'template'

export default function AssignmentsPage({ accessToken, onDataChange }: AssignmentsPageProps) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'

  const copy = isZh
    ? {
        eyebrow: 'Access Dispatch',
        title: '项目授权',
        subtitle: '跨项目管理用户的模板分配和例外授权，提供多维视角的安全梳理。',
        views: {
          user: '员工视角',
          project: '项目视角',
          template: '模板视角'
        },
        search: '搜索分配数据...',
        empty: '找不到相关的授权分配。',
        loading: '正在加载授权数据...',
        noSelection: '请在左侧选择一项以查看详细分配信息。',
        fields: {
          employee: '员工',
          project: '所属项目',
          templates: '绑定模板',
          expiresAt: '过期时间',
          permanent: '永久有效',
          rulesCnt: '条规则'
        },
        actions: {
          add: '新增授权',
          edit: '编辑规则',
          revoke: '撤销分配'
        },
        errors: {
          deleteConfirm: '确实要撤销此项分配及其附加规则吗？',
          assignRequired: '员工、项目和模板必须选择填写。'
        },
        assignModal: {
          title: '新建分发任务',
          subtitle: '选择对象并组合访问能力集合',
          user: '目标员工 *',
          project: '目标项目 *',
          templates: '选择权限模板 *',
          expiresAt: 'TTL (可选，默认永久)',
          chooseUser: '下拉选择目标用户',
          chooseProject: '下拉选择目标项目',
          confirm: '确定授予'
        }
      }
    : {
        eyebrow: 'Access Dispatch',
        title: 'Assignments',
        subtitle: 'Dispatch template capacities globally and manage project-level overrides.',
        views: {
          user: 'By Employee',
          project: 'By Project',
          template: 'By Template'
        },
        search: 'Search assignments...',
        empty: 'No assignments matched the current context.',
        loading: 'Loading assignments landscape...',
        noSelection: 'Select an entity from the list to inspect assignments.',
        fields: {
          employee: 'Employee',
          project: 'Project Context',
          templates: 'Bound Templates',
          expiresAt: 'TTL Expiry',
          permanent: 'Permanent',
          rulesCnt: 'rules'
        },
        actions: {
          add: 'New Assignment',
          edit: 'Edit override',
          revoke: 'Revoke bind'
        },
        errors: {
          deleteConfirm: 'Are you sure you want to revoke this assignment and its rules?',
          assignRequired: 'User, project and templates are required.'
        },
        assignModal: {
          title: 'Dispatch Assignment',
          subtitle: 'Bind target entity to a specific set of rules.',
          user: 'Target Employee *',
          project: 'Target Project *',
          templates: 'Select Templates *',
          expiresAt: 'TTL Expiry (optional)',
          chooseUser: 'Choose a target user',
          chooseProject: 'Choose a project context',
          confirm: 'Grant Access'
        }
      }

  const [mode, setMode] = useState<ViewMode>('project')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<DictEntry[]>([])
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignForm, setAssignForm] = useState({ userId: '', projectId: '', expiresAt: '' })
  const [assignSelectedTplIds, setAssignSelectedTplIds] = useState<number[]>([])
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState('')

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [uRes, dRes, tRes, aRes] = await Promise.all([
        getUsers(accessToken),
        getDictionaries(accessToken),
        getTemplates(accessToken),
        getAllAssignments(accessToken)
      ])
      setUsers((uRes.users ?? []).filter((u: User) => u.status === 'active'))
      setProjects(dRes.projects ?? [])
      setTemplates((tRes.templates ?? []).filter((t: TemplateOption) => t.status === 'active'))
      setAssignments(aRes.assignments ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [accessToken])

  const resolveTemplateNames = (templateIds: string): string => {
    const ids = templateIds.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean)
    if (ids.length === 0) return templateIds
    return ids.map((id) => templates.find((t) => t.id === id)?.name ?? `#${id}`).join(' · ')
  }

  const handleDeleteAssignment = async (assignment: Assignment) => {
    if (!confirm(copy.errors.deleteConfirm)) return
    try {
      await deleteAssignment(accessToken, assignment.userId, assignment.projectId)
      await loadAll()
      onDataChange?.()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleAddAssignment = async () => {
    setAssignError('')
    if (!assignForm.userId || !assignForm.projectId || assignSelectedTplIds.length === 0) {
      setAssignError(copy.errors.assignRequired)
      return
    }
    setAssignSaving(true)
    try {
      await upsertAssignment(accessToken, parseInt(assignForm.userId, 10), {
        projectId: parseInt(assignForm.projectId, 10),
        templateIds: assignSelectedTplIds.join(','),
        expiresAt: assignForm.expiresAt || undefined,
      })
      setShowAssignModal(false)
      setAssignForm({ userId: '', projectId: '', expiresAt: '' })
      setAssignSelectedTplIds([])
      await loadAll()
      onDataChange?.()
    } catch (e) {
      setAssignError((e as Error).message)
    } finally {
      setAssignSaving(false)
    }
  }

  const toggleAssignTpl = (id: number) => {
    setAssignSelectedTplIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Generate lists block based on selected mode
  let listItems: Array<{ id: number, title: string, subtitle: string, meta: string }> = []
  
  if (mode === 'user') {
    listItems = users.map(u => {
      const grants = assignments.filter(a => a.userId === u.id)
      return { id: u.id, title: u.username, subtitle: u.email, meta: `${grants.length} projects` }
    }).filter(i => (i.title + i.subtitle).toLowerCase().includes(query.toLowerCase()))
  } else if (mode === 'project') {
    listItems = projects.map(p => {
      const grants = assignments.filter(a => a.projectId === p.id)
      return { id: p.id, title: p.name, subtitle: `ID: ${p.id}`, meta: `${grants.length} users` }
    }).filter(i => i.title.toLowerCase().includes(query.toLowerCase()))
  } else {
    listItems = templates.map(t => {
      const grants = assignments.filter(a => a.templateIds.split(',').includes(t.id.toString()))
      let rc = 0
      try { rc = JSON.parse(t.rulesJson ?? '[]').length } catch { /* empty */ }
      return { id: t.id, title: t.name, subtitle: `${rc} rules`, meta: `${grants.length} usage` }
    }).filter(i => i.title.toLowerCase().includes(query.toLowerCase()))
  }

  // Assignments filtered for Inspector
  const filteredAssignments = assignments.filter(a => {
    if (selectedId === null) return false
    if (mode === 'user') return a.userId === selectedId
    if (mode === 'project') return a.projectId === selectedId
    if (mode === 'template') return a.templateIds.split(',').includes(selectedId.toString())
    return false
  })

  const getEntityTitle = () => {
    if (selectedId === null) return ''
    if (mode === 'user') return users.find(u => u.id === selectedId)?.username
    if (mode === 'project') return projects.find(p => p.id === selectedId)?.name
    if (mode === 'template') return templates.find(t => t.id === selectedId)?.name
  }

  return (
    <div className="page-stack assignments-page">


      <section className="surface">
        <div className="toolbar">
          <div className="segment-control">
            <button className={`segment-btn ${mode === 'user' ? 'active' : ''}`} onClick={() => {setMode('user'); setSelectedId(null)}}>
              <AppIcon name="users" size={14} />
              {copy.views.user}
            </button>
            <button className={`segment-btn ${mode === 'project' ? 'active' : ''}`} onClick={() => {setMode('project'); setSelectedId(null)}}>
              <AppIcon name="dashboard" size={14} />
              {copy.views.project}
            </button>
            <button className={`segment-btn ${mode === 'template' ? 'active' : ''}`} onClick={() => {setMode('template'); setSelectedId(null)}}>
              <AppIcon name="templates" size={14} />
              {copy.views.template}
            </button>
          </div>
          
          <div className="search-field">
            <AppIcon name="search" size={18} className="search-icon" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.search} />
          </div>

          <div className="toolbar-actions" style={{ marginLeft: 'auto' }}>
            <button className="button button-primary button-sm" onClick={() => {
              setAssignForm({ userId: mode === 'user' && selectedId ? String(selectedId) : '', projectId: mode === 'project' && selectedId ? String(selectedId) : '', expiresAt: '' })
              setAssignSelectedTplIds(mode === 'template' && selectedId ? [selectedId] : [])
              setShowAssignModal(true)
            }}>
              <AppIcon name="plus" size={14} />
              {copy.actions.add}
            </button>
          </div>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="surface loading-state">{copy.loading}</div>
      ) : (
        <div className="assignments-layout">
          <section className="surface a-list-section">
            <div className="a-list">
              {listItems.map(item => (
                <button 
                  key={item.id} 
                  className={`a-list-item ${selectedId === item.id ? 'active' : ''}`} 
                  onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                >
                  <div className="a-list-info">
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </div>
                  <span className="chip">{item.meta}</span>
                </button>
              ))}
              {listItems.length === 0 && <div className="empty-state">{copy.empty}</div>}
            </div>
          </section>

          <aside className="surface a-inspector">
            {selectedId ? (
              <div className="a-inspector-inner">
                <div className="a-inspector-header">
                  <h3>{getEntityTitle()}</h3>
                  <p className="panel-subtitle">{filteredAssignments.length} bounds in total.</p>
                </div>
                
                {filteredAssignments.length > 0 ? (
                  <div className="a-bounds-list">
                    {filteredAssignments.map(a => {
                      const u = users.find(x => x.id === a.userId)
                      const p = projects.find(x => x.id === a.projectId)
                      return (
                        <article key={`${a.userId}-${a.projectId}`} className="a-bound-card">
                          <div className="a-bound-head">
                            <div className="a-bound-path">
                              <span className="soft">{u?.username ?? `User ${a.userId}`}</span>
                              <span className="arrow-sep">→</span>
                              <strong className="target-proj">{p?.name ?? `Project ${a.projectId}`}</strong>
                            </div>
                            <button className="button button-danger button-sm" onClick={() => handleDeleteAssignment(a)}>{copy.actions.revoke}</button>
                          </div>
                          
                          <div className="a-bound-tags">
                            <code className="mono-pill">{resolveTemplateNames(a.templateIds)}</code>
                          </div>
                          
                          <div className="a-bound-meta">
                            {a.expiresAt ? (
                              <span className="time-badge expiring">TTL: {new Date(a.expiresAt).toLocaleDateString()}</span>
                            ) : (
                              <span className="time-badge permanent">{copy.fields.permanent}</span>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <div className="empty-state">{copy.empty}</div>
                )}
              </div>
            ) : (
              <div className="empty-state">{copy.noSelection}</div>
            )}
          </aside>
        </div>
      )}

      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{copy.assignModal.title}</h3>
                <p className="modal-subtitle">{copy.assignModal.subtitle}</p>
              </div>
              <button className="button button-ghost icon-button" onClick={() => setShowAssignModal(false)}><AppIcon name="close" size={16} /></button>
            </div>
            
            <div className="modal-body">
              {assignError && <div className="error-banner">{assignError}</div>}
              
              <div className="field">
                <label>{copy.assignModal.user}</label>
                <select value={assignForm.userId} onChange={e => setAssignForm({...assignForm, userId: e.target.value})}>
                  <option value="">{copy.assignModal.chooseUser}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>

              <div className="field">
                <label>{copy.assignModal.project}</label>
                <select value={assignForm.projectId} onChange={e => setAssignForm({...assignForm, projectId: e.target.value})}>
                  <option value="">{copy.assignModal.chooseProject}</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              
              <div className="field">
                <label>{copy.assignModal.templates}</label>
                <div className="a-tpl-picker">
                  {templates.map(tpl => {
                    const checked = assignSelectedTplIds.includes(tpl.id)
                    return (
                      <button key={tpl.id} className={`a-tpl-card ${checked ? 'active' : ''}`} onClick={() => toggleAssignTpl(tpl.id)}>
                        <div className="checkbox">{checked ? '✓' : ''}</div>
                        <strong>{tpl.name}</strong>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="field">
                <label>{copy.assignModal.expiresAt}</label>
                <input type="datetime-local" value={assignForm.expiresAt} onChange={e => setAssignForm({...assignForm, expiresAt: e.target.value})} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="button button-secondary" onClick={() => setShowAssignModal(false)}>{t('btn.cancel')}</button>
              <button className="button button-primary" onClick={handleAddAssignment} disabled={assignSaving}>{assignSaving ? '...' : copy.assignModal.confirm}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
