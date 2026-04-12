import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  updateTemplate,
} from '../api/client'
import AppIcon from '../components/AppIcon'
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
  grantsJson: string
  envOverridesJson: string
  status: string
}

interface TemplatesPageProps {
  accessToken: string
  onDataChange?: () => void
}

const TOOLS = ['Read', 'Edit', 'Write', 'Bash', 'WebFetch', 'WebSearch', 'Glob', 'Grep']

const EMPTY_FORM = {
  name: '',
  description: '',
  status: 'active',
  rulesJson: '[]',
  capabilitiesJson: '[]',
  grantsJson: '[]',
  envOverridesJson: '{}',
}

const parseJson = <T,>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

export default function TemplatesPage({ accessToken, onDataChange }: TemplatesPageProps) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'

  const copy = isZh
    ? {
        eyebrow: 'Policy Library',
        subtitle: '维护可复用的权限模板，把规则、能力和环境变量封装成稳定策略。',
        totalTemplates: '模板总数',
        activeTemplates: '启用模板',
        archivedTemplates: '归档模板',
        totalRules: '累计规则',
        searchPlaceholder: '搜索模板名称或描述',
        allStatus: '全部状态',
        active: '启用',
        archived: '归档',
        refresh: '刷新模板库',
        empty: '没有符合当前筛选条件的模板。',
        loading: '正在读取模板库...',
        countLabel: '个模板',
        detail: {
          title: '模板检视器',
          subtitle: '查看模板的规则、能力和环境变量结构。',
          noSelection: '从左侧选择模板后，这里会展示完整的配置细节。',
          rules: '权限规则',
          capabilities: '能力',
          env: '环境变量',
          version: '版本',
          status: '状态',
          description: '描述',
          noRules: '当前模板没有规则。',
          noCapabilities: '当前模板没有能力配置。',
          noEnv: '当前模板没有环境变量覆盖。',
        },
        modal: {
          createTitle: '新增权限模板',
          editTitle: '编辑模板',
          createSubtitle: '创建新的模板并定义默认规则。',
          editSubtitle: '维护模板版本、规则、能力和环境变量。',
          name: '模板名称 *',
          description: '描述',
          status: '状态',
          tabs: {
            basic: '基本信息',
            rules: '工具拦截规则',
            caps: '能力开关 (Caps)',
            grants: '授权拓展 (Grants)',
            env: '环境变量',
          },
          addRule: '添加规则',
          addCapability: '添加能力开关',
          addGrant: '添加权限分配',
          addEnv: '添加变量',
          rulePattern: '文件路径模式（可选）',
          capabilityPlaceholder: '如: policy.read.crossProject:7,14',
          envKeyPlaceholder: '变量名',
          envValuePlaceholder: '值',
        },
        confirmDelete: '确认归档模板 "{{name}}"？',
        errors: {
          nameRequired: '模板名称不能为空',
        },
      }
    : {
        eyebrow: 'Policy Library',
        subtitle: 'Maintain reusable permission templates so rules, capabilities, and env overrides stay structured.',
        totalTemplates: 'Total templates',
        activeTemplates: 'Active templates',
        archivedTemplates: 'Archived templates',
        totalRules: 'Total rules',
        searchPlaceholder: 'Search by template name or description',
        allStatus: 'All status',
        active: 'Active',
        archived: 'Archived',
        refresh: 'Refresh library',
        empty: 'No templates match the current filter.',
        loading: 'Loading template library...',
        countLabel: 'templates',
        detail: {
          title: 'Template Inspector',
          subtitle: 'Review rules, capabilities, and env overrides in one place.',
          noSelection: 'Choose a template from the library to inspect its full configuration.',
          rules: 'Rules',
          capabilities: 'Capabilities',
          env: 'Environment',
          version: 'Version',
          status: 'Status',
          description: 'Description',
          noRules: 'This template has no rules yet.',
          noCapabilities: 'This template has no capabilities configured.',
          noEnv: 'This template has no env overrides.',
        },
        modal: {
          createTitle: 'Create template',
          editTitle: 'Edit template',
          createSubtitle: 'Create a new template and define its baseline policy.',
          editSubtitle: 'Maintain template versions, rules, capabilities, and env overrides.',
          name: 'Template name *',
          description: 'Description',
          status: 'Status',
          tabs: {
            basic: 'Basic',
            rules: 'Rules (Tools)',
            caps: 'Capabilities',
            grants: 'Grants',
            env: 'Environment',
          },
          addRule: 'Add rule',
          addCapability: 'Add flag',
          addGrant: 'Add grant',
          addEnv: 'Add variable',
          rulePattern: 'Optional file path pattern',
          capabilityPlaceholder: 'Example: policy.read.crossProject:7,14',
          envKeyPlaceholder: 'Variable name',
          envValuePlaceholder: 'Value',
        },
        confirmDelete: 'Archive template "{{name}}"?',
        errors: {
          nameRequired: 'Template name is required',
        },
      }

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editTemplate, setEditTemplate] = useState<Template | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [activeTab, setActiveTab] = useState<'basic' | 'rules' | 'caps' | 'grants' | 'env'>('basic')

  const [rules, setRules] = useState<PermissionRule[]>([])
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [grants, setGrants] = useState<string[]>([])
  const [envOverrides, setEnvOverrides] = useState<Record<string, string>>({})
  const [newCapability, setNewCapability] = useState('')
  const [newGrant, setNewGrant] = useState('')
  const [newEnvKey, setNewEnvKey] = useState('')
  const [newEnvValue, setNewEnvValue] = useState('')

  const loadTemplates = async () => {
    setLoading(true)
    setError('')

    try {
      const data = await getTemplates(accessToken)
      const nextTemplates = data.templates ?? []
      setTemplates(nextTemplates)
      setSelectedTemplateId((current) =>
        current && nextTemplates.some((template: Template) => template.id === current) ? current : nextTemplates[0]?.id ?? null
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      setLoading(true)
      setError('')

      try {
        const data = await getTemplates(accessToken)
        const nextTemplates = data.templates ?? []
        if (cancelled) return
        setTemplates(nextTemplates)
        setSelectedTemplateId((current) =>
          current && nextTemplates.some((template: Template) => template.id === current)
            ? current
            : nextTemplates[0]?.id ?? null,
        )
      } catch (e) {
        if (cancelled) return
        setError((e as Error).message)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void initialize()

    return () => {
      cancelled = true
    }
  }, [accessToken])

  const filteredTemplates = templates.filter((template) => {
    const matchesStatus = statusFilter === 'all' || template.status === statusFilter
    const search = query.trim().toLowerCase()
    if (!matchesStatus) return false
    if (!search) return true
    return `${template.name} ${template.description}`.toLowerCase().includes(search)
  })

  const selectedTemplate =
    filteredTemplates.find((template) => template.id === selectedTemplateId) ??
    templates.find((template) => template.id === selectedTemplateId) ??
    null

  const activeCount = templates.filter((template) => template.status === 'active').length
  const archivedCount = templates.filter((template) => template.status === 'archived').length
  const totalRuleCount = templates.reduce(
    (sum, template) => sum + parseJson<PermissionRule[]>(template.rulesJson, []).length,
    0,
  )

  const openAdd = () => {
    setEditTemplate(null)
    setForm({ ...EMPTY_FORM })
    setRules([])
    setCapabilities([])
    setGrants([])
    setEnvOverrides({})
    setNewCapability('')
    setNewGrant('')
    setNewEnvKey('')
    setNewEnvValue('')
    setFormError('')
    setActiveTab('basic')
    setShowModal(true)
  }

  const openEdit = (template: Template) => {
    setEditTemplate(template)
    setForm({
      name: template.name,
      description: template.description,
      status: template.status,
      rulesJson: template.rulesJson,
      capabilitiesJson: template.capabilitiesJson,
      grantsJson: template.grantsJson ?? '[]',
      envOverridesJson: template.envOverridesJson,
    })
    setRules(parseJson<PermissionRule[]>(template.rulesJson, []))
    setCapabilities(parseJson<string[]>(template.capabilitiesJson, []))
    setGrants(parseJson<string[]>(template.grantsJson, []))
    setEnvOverrides(parseJson<Record<string, string>>(template.envOverridesJson, {}))
    setNewCapability('')
    setNewGrant('')
    setNewEnvKey('')
    setNewEnvValue('')
    setFormError('')
    setActiveTab('basic')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditTemplate(null)
    setFormError('')
  }

  const handleSave = async () => {
    setFormError('')

    if (!form.name.trim()) {
      setFormError(copy.errors.nameRequired)
      return
    }

    setSaving(true)

    try {
      const body = {
        name: form.name,
        description: form.description,
        status: form.status,
        rulesJson: JSON.stringify(rules),
        capabilitiesJson: JSON.stringify(capabilities),
        grantsJson: JSON.stringify(grants),
        envOverridesJson: JSON.stringify(envOverrides),
      }

      if (editTemplate) {
        await updateTemplate(accessToken, editTemplate.id, body)
      } else {
        await createTemplate(accessToken, body)
      }

      closeModal()
      await loadTemplates()
      onDataChange?.()
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (template: Template) => {
    const confirmed = confirm(copy.confirmDelete.replace('{{name}}', template.name))
    if (!confirmed) return

    try {
      await deleteTemplate(accessToken, template.id)
      await loadTemplates()
      onDataChange?.()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const updateRule = (index: number, field: keyof PermissionRule, value: string) => {
    setRules(rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, [field]: value } : rule)))
  }

  const selectedRules = selectedTemplate ? parseJson<PermissionRule[]>(selectedTemplate.rulesJson, []) : []
  const selectedCapabilities = selectedTemplate ? parseJson<string[]>(selectedTemplate.capabilitiesJson, []) : []
  const selectedGrants = selectedTemplate ? parseJson<string[]>(selectedTemplate.grantsJson ?? '[]', []) : []
  const selectedEnv = selectedTemplate ? parseJson<Record<string, string>>(selectedTemplate.envOverridesJson, {}) : {}

  const behaviorLabel = (behavior: PermissionRule['behavior']) => behavior.toUpperCase()

  return (
    <div className="page-stack templates-page">

      <section className="surface">
        <div className="toolbar">
          <div className="search-field">
            <AppIcon name="search" size={18} className="search-icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
            />
          </div>
          <div className="toolbar-actions">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="templates-filter"
            >
              <option value="all">{copy.allStatus}</option>
              <option value="active">{copy.active}</option>
              <option value="archived">{copy.archived}</option>
            </select>
            <span className="chip">
              {filteredTemplates.length} / {templates.length} {copy.countLabel}
            </span>
            <button className="button button-secondary button-sm" onClick={loadTemplates}>
              <AppIcon name="refresh" size={14} />
            </button>
            <button className="button button-primary button-sm" onClick={openAdd}>
              <AppIcon name="plus" size={14} />
              {t('btn.add')}
            </button>
          </div>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="surface loading-state">{copy.loading}</div>
      ) : (
        <div className="templates-layout">
          <section className="surface templates-library">
            {filteredTemplates.length === 0 ? (
              <div className="empty-state">{copy.empty}</div>
            ) : (
              <div className="templates-grid">
                {filteredTemplates.map((template) => {
                  const templateRules = parseJson<PermissionRule[]>(template.rulesJson, [])
                  const templateCapabilities = parseJson<string[]>(template.capabilitiesJson, [])
                  const envCount = Object.keys(parseJson<Record<string, string>>(template.envOverridesJson, {})).length
                  const isSelected = selectedTemplate?.id === template.id

                  return (
                    <button
                      key={template.id}
                      className={`template-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedTemplateId(isSelected ? null : template.id)}
                    >
                      <div className="template-card-head">
                        <div className="stack-sm">
                          <strong>{template.name}</strong>
                          <span className="soft">{copy.detail.version} · v{template.version}</span>
                        </div>
                        <span className={`status-pill ${template.status}`}>
                          {template.status === 'active' ? copy.active : copy.archived}
                        </span>
                      </div>
                      <p>{template.description || '—'}</p>
                      <div className="template-card-stats">
                        <div>
                          <span>{copy.detail.rules}</span>
                          <strong>{templateRules.length}</strong>
                        </div>
                        <div>
                          <span>{copy.detail.capabilities}</span>
                          <strong>{templateCapabilities.length}</strong>
                        </div>
                        <div>
                          <span>{copy.detail.env}</span>
                          <strong>{envCount}</strong>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <aside className="surface template-inspector">
            <div className="stack-sm">
              <span className="page-kicker">
                <AppIcon name="shield" size={16} />
                {copy.detail.title}
              </span>
              <h3>{copy.detail.title}</h3>
              <p className="panel-subtitle">{copy.detail.subtitle}</p>
            </div>

            {selectedTemplate ? (
              <>
                <div className="template-inspector-head">
                  <div className="stack-sm">
                    <h4>{selectedTemplate.name}</h4>
                    <p className="muted">{selectedTemplate.description || '—'}</p>
                  </div>
                  <div className="template-actions">
                    <button className="button button-secondary button-sm" onClick={() => openEdit(selectedTemplate)}>
                      {t('btn.edit')}
                    </button>
                    <button className="button button-danger button-sm" onClick={() => handleDelete(selectedTemplate)}>
                      {t('btn.delete')}
                    </button>
                  </div>
                </div>

                <div className="template-meta-grid">
                  <div className="detail-card">
                    <span>{copy.detail.version}</span>
                    <strong>v{selectedTemplate.version}</strong>
                  </div>
                  <div className="detail-card">
                    <span>{copy.detail.status}</span>
                    <strong>{selectedTemplate.status === 'active' ? copy.active : copy.archived}</strong>
                  </div>
                  <div className="detail-card template-meta-wide">
                    <span>{copy.detail.description}</span>
                    <strong>{selectedTemplate.description || '—'}</strong>
                  </div>
                </div>

                <div className="template-section">
                  <div className="section-heading">
                    <h4>{copy.detail.rules}</h4>
                    <span className="chip">{selectedRules.length}</span>
                  </div>
                  {selectedRules.length === 0 ? (
                    <div className="empty-state">{copy.detail.noRules}</div>
                  ) : (
                    <div className="rule-list">
                      {selectedRules.map((rule, index) => (
                        <div key={`${rule.tool}-${index}`} className="rule-card">
                          <span className={`behavior-chip ${rule.behavior}`}>{behaviorLabel(rule.behavior)}</span>
                          <span className="mono-pill">{rule.tool}</span>
                          {rule.content ? <code className="rule-content">{rule.content}</code> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="template-section">
                  <div className="section-heading">
                    <h4>{copy.modal.tabs.caps}</h4>
                    <span className="chip">{selectedCapabilities.length}</span>
                  </div>
                  {selectedCapabilities.length === 0 ? (
                    <div className="empty-state">{isZh ? '当前模板未设定特性。' : 'No feature flags set.'}</div>
                  ) : (
                    <div className="capability-list">
                      {selectedCapabilities.map((capability) => (
                        <code key={capability} className="capability-pill">
                          {capability} = true
                        </code>
                      ))}
                    </div>
                  )}
                </div>

                <div className="template-section">
                  <div className="section-heading">
                    <h4>{copy.modal.tabs.grants}</h4>
                    <span className="chip">{selectedGrants.length}</span>
                  </div>
                  {selectedGrants.length === 0 ? (
                    <div className="empty-state">{isZh ? '当前模板没有任何访问授权。' : 'No access grants set.'}</div>
                  ) : (
                    <div className="capability-list">
                      {selectedGrants.map((grant) => (
                        <code key={grant} className="capability-pill grants-pill">
                          {grant}
                        </code>
                      ))}
                    </div>
                  )}
                </div>

                <div className="template-section">
                  <div className="section-heading">
                    <h4>{copy.detail.env}</h4>
                    <span className="chip">{Object.keys(selectedEnv).length}</span>
                  </div>
                  {Object.keys(selectedEnv).length === 0 ? (
                    <div className="empty-state">{copy.detail.noEnv}</div>
                  ) : (
                    <div className="env-list">
                      {Object.entries(selectedEnv).map(([key, value]) => (
                        <div key={key} className="env-card">
                          <code>{key}</code>
                          <span>=</span>
                          <code>{String(value)}</code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">{copy.detail.noSelection}</div>
            )}
          </aside>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  {editTemplate ? `${copy.modal.editTitle} · ${editTemplate.name}` : copy.modal.createTitle}
                </h3>
                <p className="modal-subtitle">
                  {editTemplate ? copy.modal.editSubtitle : copy.modal.createSubtitle}
                </p>
              </div>
              <button
                className="button button-ghost icon-button"
                onClick={closeModal}
                aria-label={isZh ? '关闭' : 'Close'}
              >
                <AppIcon name="close" size={16} />
              </button>
            </div>

            <div className="modal-body">
              {formError && <div className="error-banner">{formError}</div>}

              <div className="tab-list">
                {(['basic', 'rules', 'caps', 'grants', 'env'] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`tab-button ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {{
                      basic: copy.modal.tabs.basic,
                      rules: `${copy.modal.tabs.rules} (${rules.length})`,
                      caps: `${copy.modal.tabs.caps} (${capabilities.length})`,
                      grants: `${copy.modal.tabs.grants} (${grants.length})`,
                      env: `${copy.modal.tabs.env} (${Object.keys(envOverrides).length})`,
                    }[tab]}
                  </button>
                ))}
              </div>

              {activeTab === 'basic' && (
                <div className="template-form-panel">
                  <div className="field">
                    <label>{copy.modal.name}</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>{copy.modal.description}</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <div className="field">
                    <label>{copy.modal.status}</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="active">{copy.active}</option>
                      <option value="archived">{copy.archived}</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'rules' && (
                <div className="template-form-panel">
                  <div className="editor-list">
                    {rules.map((rule, index) => (
                      <div key={`${rule.tool}-${index}`} className="rule-editor-row">
                        <select
                          value={rule.behavior}
                          onChange={(e) => updateRule(index, 'behavior', e.target.value)}
                        >
                          <option value="allow">ALLOW</option>
                          <option value="deny">DENY</option>
                          <option value="ask">ASK</option>
                        </select>
                        <select
                          value={rule.tool}
                          onChange={(e) => updateRule(index, 'tool', e.target.value)}
                        >
                          {TOOLS.map((tool) => (
                            <option key={tool} value={tool}>
                              {tool}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={rule.content ?? ''}
                          onChange={(e) => updateRule(index, 'content', e.target.value)}
                          placeholder={copy.modal.rulePattern}
                        />
                        <button
                          className="button button-ghost icon-button"
                          onClick={() => setRules(rules.filter((_, ruleIndex) => ruleIndex !== index))}
                          aria-label={isZh ? '删除规则' : 'Remove rule'}
                        >
                          <AppIcon name="close" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="button button-secondary"
                    onClick={() => setRules([...rules, { behavior: 'allow', tool: 'Read', content: '' }])}
                  >
                    <AppIcon name="plus" size={16} />
                    {copy.modal.addRule}
                  </button>
                </div>
              )}

              {activeTab === 'caps' && (
                <div className="template-form-panel">
                  <div className="editor-list">
                    {capabilities.map((capability, index) => (
                      <div key={`${capability}-${index}`} className="caps-editor-row">
                        <code>{capability}</code>
                        <span>= true</span>
                        <button
                          className="button button-ghost icon-button"
                          onClick={() => setCapabilities(capabilities.filter((_, capIndex) => capIndex !== index))}
                          aria-label={isZh ? '删除能力' : 'Remove capability'}
                        >
                          <AppIcon name="close" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="add-row">
                    <input
                      type="text"
                      value={newCapability}
                      onChange={(e) => setNewCapability(e.target.value)}
                      placeholder={isZh ? '输入布尔开关名，例如 core.logging.enable' : 'Boolean config flag'}
                    />
                    <button
                      className="button button-secondary"
                      onClick={() => {
                        if (!newCapability.trim()) return
                        setCapabilities([...capabilities, newCapability.trim()])
                        setNewCapability('')
                      }}
                    >
                      <AppIcon name="plus" size={16} />
                      {copy.modal.addCapability}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'grants' && (
                <div className="template-form-panel">
                  <div className="editor-list">
                    {grants.map((grant, index) => (
                      <div key={`${grant}-${index}`} className="caps-editor-row">
                        <code>{grant}</code>
                        <button
                          className="button button-ghost icon-button"
                          onClick={() => setGrants(grants.filter((_, gIndex) => gIndex !== index))}
                          aria-label={isZh ? '删除授权' : 'Remove grant'}
                        >
                          <AppIcon name="close" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="add-row">
                    <input
                      type="text"
                      value={newGrant}
                      onChange={(e) => setNewGrant(e.target.value)}
                      placeholder={copy.modal.capabilityPlaceholder}
                    />
                    <button
                      className="button button-secondary"
                      onClick={() => {
                        if (!newGrant.trim()) return
                        setGrants([...grants, newGrant.trim()])
                        setNewGrant('')
                      }}
                    >
                      <AppIcon name="plus" size={16} />
                      {copy.modal.addGrant}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'env' && (
                <div className="template-form-panel">
                  <div className="editor-list">
                    {Object.entries(envOverrides).map(([key, value]) => (
                      <div key={key} className="env-editor-row">
                        <code>{key}</code>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => setEnvOverrides({ ...envOverrides, [key]: e.target.value })}
                        />
                        <button
                          className="button button-ghost icon-button"
                          onClick={() => {
                            const nextOverrides = { ...envOverrides }
                            delete nextOverrides[key]
                            setEnvOverrides(nextOverrides)
                          }}
                          aria-label={isZh ? '删除变量' : 'Remove variable'}
                        >
                          <AppIcon name="close" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="env-add-row">
                    <input
                      type="text"
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value)}
                      placeholder={copy.modal.envKeyPlaceholder}
                    />
                    <input
                      type="text"
                      value={newEnvValue}
                      onChange={(e) => setNewEnvValue(e.target.value)}
                      placeholder={copy.modal.envValuePlaceholder}
                    />
                    <button
                      className="button button-secondary"
                      onClick={() => {
                        if (!newEnvKey.trim()) return
                        setEnvOverrides({ ...envOverrides, [newEnvKey.trim()]: newEnvValue })
                        setNewEnvKey('')
                        setNewEnvValue('')
                      }}
                    >
                      <AppIcon name="plus" size={16} />
                      {copy.modal.addEnv}
                    </button>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button className="button button-secondary" onClick={closeModal}>
                  {t('btn.cancel')}
                </button>
                <button className="button button-primary" onClick={handleSave} disabled={saving}>
                  {saving ? (isZh ? '保存中...' : 'Saving...') : t('btn.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
