import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createDepartmentPolicy,
  deleteDepartmentPolicy,
  getDepartmentPolicies,
  getDictionaries,
  updateDepartmentPolicy,
} from '../api/client'
import AppIcon from '../components/AppIcon'
import '../styles/PoliciesPage.css'

interface DepartmentPolicy {
  id: number
  departmentId: number
  policyType: 'deny' | 'allow' | 'ask'
  toolCategory: string
  resourcePattern: string
  description: string | null
  status: string
}

interface DictEntry {
  id: number
  name: string
}

interface Dicts {
  departments: DictEntry[]
}

const TOOL_CATEGORIES = [
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Bash',
  'WebFetch',
  'WebSearch',
  'Skill',
  'NotebookEdit',
]

const POLICY_TYPES = [
  { value: 'deny', label: '拒绝 / Deny', color: 'red' },
  { value: 'allow', label: '允许 / Allow', color: 'green' },
  { value: 'ask', label: '询问 / Ask', color: 'orange' },
]

interface PoliciesPageProps {
  accessToken: string
  onDataChange?: () => void
}

export default function PoliciesPage({ accessToken, onDataChange }: PoliciesPageProps) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'

  const copy = isZh
    ? {
        eyebrow: 'Department Policies',
        subtitle: '为各部门配置基础权限策略（部门级 Deny 规则）。',
        totalPolicies: '总策略数',
        activePolicies: '启用中',
        disabledPolicies: '已禁用',
        searchPlaceholder: '搜索部门、工具或规则',
        allStatus: '全部状态',
        active: '启用',
        disabled: '禁用',
        refresh: '刷新',
        empty: '没有匹配的策略记录。',
        loading: '正在读取部门策略...',
        countLabel: '条策略',
        table: {
          department: '部门',
          policyType: '策略类型',
          tool: '工具',
          pattern: '资源模式',
          description: '说明',
          status: '状态',
          actions: '操作',
        },
        detail: {
          title: '策略详情',
          subtitle: '点击左侧策略查看配置详情。',
          noSelection: '选择一条策略后，这里会显示完整配置。',
        },
        modal: {
          createTitle: '新增部门策略',
          editTitle: '编辑部门策略',
          createSubtitle: '为指定部门添加访问控制规则。',
          editSubtitle: '更新部门策略的规则与说明。',
          department: '部门 *',
          policyType: '策略类型 *',
          tool: '工具 *',
          pattern: '资源模式 *',
          description: '说明（可选）',
          chooseNone: '选择部门',
          patternPlaceholder: '如 */src/** 或 {{BACKEND_DIR}}/**',
          descriptionPlaceholder: '简要说明这条规则的目的',
          confirm: '保存策略',
          tip: '资源模式支持 * 通配符和 {{变量}} 插值，如 {{BACKEND_DIR}}/**',
        },
        errors: {
          deletePolicy: '确认删除这条策略吗？',
        },
      }
    : {
        eyebrow: 'Department Policies',
        subtitle: 'Configure baseline permission policies for departments (department-level deny rules).',
        totalPolicies: 'Total policies',
        activePolicies: 'Active',
        disabledPolicies: 'Disabled',
        searchPlaceholder: 'Search by department, tool, or pattern',
        allStatus: 'All status',
        active: 'Active',
        disabled: 'Disabled',
        refresh: 'Refresh',
        empty: 'No policies match the current filter.',
        loading: 'Loading department policies...',
        countLabel: 'policies',
        table: {
          department: 'Department',
          policyType: 'Policy Type',
          tool: 'Tool',
          pattern: 'Resource Pattern',
          description: 'Description',
          status: 'Status',
          actions: 'Actions',
        },
        detail: {
          title: 'Policy Detail',
          subtitle: 'Select a policy to view its complete configuration.',
          noSelection: 'Choose a policy to inspect and edit details.',
        },
        modal: {
          createTitle: 'Create department policy',
          editTitle: 'Edit policy',
          createSubtitle: 'Add an access control rule for a department.',
          editSubtitle: 'Update the policy rule and description.',
          department: 'Department *',
          policyType: 'Policy Type *',
          tool: 'Tool *',
          pattern: 'Resource Pattern *',
          description: 'Description (optional)',
          chooseNone: 'Select a department',
          patternPlaceholder: 'e.g. */src/** or {{BACKEND_DIR}}/**',
          descriptionPlaceholder: 'Brief explanation of this rule',
          confirm: 'Save policy',
          tip: 'Patterns support * wildcards and {{variables}}, e.g. {{BACKEND_DIR}}/**',
        },
        errors: {
          deletePolicy: 'Delete this policy?',
        },
      }

  const [policies, setPolicies] = useState<DepartmentPolicy[]>([])
  const [dicts, setDicts] = useState<Dicts>({ departments: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [showModal, setShowModal] = useState(false)
  const [editPolicy, setEditPolicy] = useState<DepartmentPolicy | null>(null)
  const [form, setForm] = useState({
    departmentId: '',
    policyType: 'deny',
    toolCategory: '',
    resourcePattern: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [selectedPolicy, setSelectedPolicy] = useState<DepartmentPolicy | null>(null)

  const loadAll = async () => {
    setLoading(true)
    setError('')

    try {
      const [policiesData, dictsData] = await Promise.all([
        getDepartmentPolicies(accessToken),
        getDictionaries(accessToken),
      ])
      setPolicies(policiesData.policies ?? [])
      setDicts(dictsData)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [accessToken])

  const resolveName = (list: DictEntry[], id: number | null) =>
    id ? list.find((entry) => entry.id === id)?.name ?? String(id) : '—'

  const filteredPolicies = policies.filter((policy) => {
    const matchesStatus = statusFilter === 'all' || policy.status === statusFilter
    const search = query.trim().toLowerCase()
    if (!matchesStatus) return false
    if (!search) return true

    const haystack = [
      resolveName(dicts.departments, policy.departmentId),
      policy.toolCategory,
      policy.resourcePattern,
      policy.policyType,
      policy.description || '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(search)
  })

  const openAdd = () => {
    setEditPolicy(null)
    setForm({
      departmentId: '',
      policyType: 'deny',
      toolCategory: '',
      resourcePattern: '',
      description: '',
    })
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (policy: DepartmentPolicy) => {
    setEditPolicy(policy)
    setForm({
      departmentId: policy.departmentId.toString(),
      policyType: policy.policyType,
      toolCategory: policy.toolCategory,
      resourcePattern: policy.resourcePattern,
      description: policy.description || '',
    })
    setFormError('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditPolicy(null)
    setFormError('')
  }

  const handleSave = async () => {
    setFormError('')

    if (!form.departmentId || !form.toolCategory || !form.resourcePattern) {
      setFormError(isZh ? '请填写必填字段' : 'Please fill in required fields')
      return
    }

    setSaving(true)

    try {
      const body = {
        departmentId: parseInt(form.departmentId, 10),
        policyType: form.policyType,
        toolCategory: form.toolCategory,
        resourcePattern: form.resourcePattern,
        description: form.description || undefined,
      }

      if (editPolicy) {
        await updateDepartmentPolicy(accessToken, editPolicy.id, body)
      } else {
        await createDepartmentPolicy(accessToken, body)
      }

      closeModal()
      await loadAll()
      onDataChange?.()
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (policy: DepartmentPolicy) => {
    const confirmed = confirm(copy.errors.deletePolicy)
    if (!confirmed) return

    try {
      await deleteDepartmentPolicy(accessToken, policy.id)
      await loadAll()
      if (selectedPolicy?.id === policy.id) {
        setSelectedPolicy(null)
      }
      onDataChange?.()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const getPolicyTypeLabel = (type: string) => {
    return POLICY_TYPES.find((p) => p.value === type)?.label ?? type
  }

  return (
    <div className="page-stack policies-page">


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
              className="policies-filter"
            >
              <option value="all">{copy.allStatus}</option>
              <option value="active">{copy.active}</option>
              <option value="disabled">{copy.disabled}</option>
            </select>
            <span className="chip">
              {filteredPolicies.length} / {policies.length} {copy.countLabel}
            </span>
            <button className="button button-secondary button-sm" onClick={loadAll}>
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
        <div className="policies-layout">
          <section className="surface policies-table-card">
            {filteredPolicies.length === 0 ? (
              <div className="empty-state policies-empty">{copy.empty}</div>
            ) : (
              <div className="table-shell">
                <table className="data-table policies-table">
                  <thead>
                    <tr>
                      <th>{copy.table.department}</th>
                      <th>{copy.table.policyType}</th>
                      <th>{copy.table.tool}</th>
                      <th>{copy.table.pattern}</th>
                      <th>{copy.table.description}</th>
                      <th>{copy.table.status}</th>
                      <th>{copy.table.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPolicies.map((policy) => (
                      <tr
                        key={policy.id}
                        className={selectedPolicy?.id === policy.id ? 'policies-row-selected' : ''}
                        onClick={() => setSelectedPolicy(policy)}
                      >
                        <td>{resolveName(dicts.departments, policy.departmentId)}</td>
                        <td>
                          <span className={`policy-type-pill ${policy.policyType}`}>
                            {getPolicyTypeLabel(policy.policyType)}
                          </span>
                        </td>
                        <td>
                          <code className="tool-code">{policy.toolCategory}</code>
                        </td>
                        <td>
                          <code className="pattern-code">{policy.resourcePattern}</code>
                        </td>
                        <td className="description-cell">{policy.description || '—'}</td>
                        <td>
                          <span className={`status-pill ${policy.status}`}>{t(`status.${policy.status}`)}</span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="table-actions">
                            <button className="button button-secondary button-sm" onClick={() => openEdit(policy)}>
                              {t('btn.edit')}
                            </button>
                            <button className="button button-danger button-sm" onClick={() => handleDelete(policy)}>
                              {t('btn.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="surface policy-inspector">
            <div className="stack-sm">
              <span className="page-kicker">
                <AppIcon name="shield" size={16} />
                {copy.detail.title}
              </span>
              <h3>{copy.detail.title}</h3>
              <p className="panel-subtitle">{copy.detail.subtitle}</p>
            </div>

            {selectedPolicy ? (
              <div className="policy-detail">
                <div className="detail-group">
                  <label>{copy.table.department}</label>
                  <strong>{resolveName(dicts.departments, selectedPolicy.departmentId)}</strong>
                </div>
                <div className="detail-group">
                  <label>{copy.table.policyType}</label>
                  <span className={`policy-type-pill ${selectedPolicy.policyType}`}>
                    {getPolicyTypeLabel(selectedPolicy.policyType)}
                  </span>
                </div>
                <div className="detail-group">
                  <label>{copy.table.tool}</label>
                  <code className="tool-code">{selectedPolicy.toolCategory}</code>
                </div>
                <div className="detail-group">
                  <label>{copy.table.pattern}</label>
                  <code className="pattern-code">{selectedPolicy.resourcePattern}</code>
                </div>
                {selectedPolicy.description && (
                  <div className="detail-group">
                    <label>{copy.table.description}</label>
                    <p>{selectedPolicy.description}</p>
                  </div>
                )}
                <div className="detail-group">
                  <label>{copy.table.status}</label>
                  <span className={`status-pill ${selectedPolicy.status}`}>{t(`status.${selectedPolicy.status}`)}</span>
                </div>

                <div className="detail-actions">
                  <button className="button button-secondary" onClick={() => openEdit(selectedPolicy)}>
                    {t('btn.edit')}
                  </button>
                  <button className="button button-danger" onClick={() => handleDelete(selectedPolicy)}>
                    {t('btn.delete')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-state">{copy.detail.noSelection}</div>
            )}
          </aside>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  {editPolicy ? copy.modal.editTitle : copy.modal.createTitle}
                </h3>
                <p className="modal-subtitle">
                  {editPolicy ? copy.modal.editSubtitle : copy.modal.createSubtitle}
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

              <div className="form-grid">
                <div className="field">
                  <label>{copy.modal.department}</label>
                  <select
                    value={form.departmentId}
                    disabled={!!editPolicy}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  >
                    <option value="">{copy.modal.chooseNone}</option>
                    {dicts.departments.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>{copy.modal.policyType}</label>
                  <select
                    value={form.policyType}
                    onChange={(e) => setForm({ ...form, policyType: e.target.value })}
                  >
                    {POLICY_TYPES.map((pt) => (
                      <option key={pt.value} value={pt.value}>
                        {pt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>{copy.modal.tool}</label>
                  <select
                    value={form.toolCategory}
                    onChange={(e) => setForm({ ...form, toolCategory: e.target.value })}
                  >
                    <option value="">选择工具 / Select tool</option>
                    {TOOL_CATEGORIES.map((tool) => (
                      <option key={tool} value={tool}>
                        {tool}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>{copy.modal.pattern}</label>
                  <input
                    type="text"
                    value={form.resourcePattern}
                    onChange={(e) => setForm({ ...form, resourcePattern: e.target.value })}
                    placeholder={copy.modal.patternPlaceholder}
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: 6, display: 'block' }}>
                    {copy.modal.tip}
                  </small>
                </div>

                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>{copy.modal.description}</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder={copy.modal.descriptionPlaceholder}
                    rows={3}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button className="button button-secondary" onClick={closeModal}>
                  {t('btn.cancel')}
                </button>
                <button className="button button-primary" onClick={handleSave} disabled={saving}>
                  {saving ? (isZh ? '保存中...' : 'Saving...') : copy.modal.confirm}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
