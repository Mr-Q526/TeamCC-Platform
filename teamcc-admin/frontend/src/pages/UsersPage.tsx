import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createUser,
  deleteUser,
  getEffectivePolicyPreview,
  getDictionaries,
  getUsers,
  updateUser,
} from '../api/client'
import AppIcon from '../components/AppIcon'
import '../styles/UsersPage.css'

interface User {
  id: number
  username: string
  email: string
  orgId: number | null
  departmentId: number | null
  teamId: number | null
  roleId: number | null
  levelId: number | null
  defaultProjectId: number | null
  roles: string
  status: string
}

interface DictEntry {
  id: number
  name: string
}

interface Dicts {
  orgs: DictEntry[]
  departments: DictEntry[]
  teams: DictEntry[]
  roles: DictEntry[]
  levels: DictEntry[]
  projects: DictEntry[]
}

interface PermissionRule {
  behavior: 'deny' | 'allow' | 'ask'
  tool: string
  content?: string
}

interface RuleTrace extends PermissionRule {
  key: string
  sourceType: 'department_policy' | 'template' | 'assignment_extra'
  sourceId: number | null
  sourceLabel: string
}

interface SuppressedRuleTrace extends RuleTrace {
  suppressedBy: RuleTrace
}

interface PolicyAssignmentPreview {
  userId: number
  projectId: number
  templateIds: string
  extraRulesJson: string | null
  expiresAt: string | null
}

interface PolicyTemplatePreview {
  id: number
  name: string
  description: string | null
  version: number
  status: string
  applied: boolean
}

interface DepartmentPolicyPreview {
  id: number
  departmentId: number
  policyType: string
  toolCategory: string
  resourcePattern: string
  description: string | null
  status: string
}

interface EffectivePolicyPreview {
  subject: {
    userId: number
    username: string
    orgId: number | null
    departmentId: number
    teamId: number
    roleId: number
    levelId: number
    defaultProjectId: number
  }
  projectId: number
  assignment: PolicyAssignmentPreview | null
  templates: PolicyTemplatePreview[]
  departmentPolicies: DepartmentPolicyPreview[]
  effective: {
    rules: PermissionRule[]
    capabilities: string[]
    envOverrides: Record<string, string>
    expiresAt: string
  }
  effectiveRules: RuleTrace[]
  suppressedRules: SuppressedRuleTrace[]
}


interface UsersPageProps {
  accessToken: string
  onDataChange?: () => void
}

const EMPTY_FORM = {
  username: '',
  email: '',
  password: '',
  orgId: '',
  departmentId: '',
  teamId: '',
  roleId: '',
  levelId: '',
  defaultProjectId: '',
  status: 'active',
  roles: 'viewer',
}

export default function UsersPage({ accessToken, onDataChange }: UsersPageProps) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'

  const copy = isZh
    ? {
        eyebrow: 'Identity Registry',
        subtitle: '统一维护员工帐号、组织归属、系统角色和项目权限分配。',
        totalUsers: '员工总数',
        activeUsers: '活跃帐号',
        suspendedUsers: '停用帐号',
        selectedAssignments: '当前选中授权',
        searchPlaceholder: '搜索用户名、邮箱、部门或团队',
        allStatus: '全部状态',
        active: '活跃',
        suspended: '已停用',
        refresh: '刷新列表',
        empty: '没有匹配的员工记录。',
        loading: '正在读取员工目录...',
        countLabel: '名员工',
        detailAction: '详情',
        table: {
          user: '员工',
          org: '组织归属',
          position: '岗位',
          level: '等级',
          systemRole: '系统角色',
          status: '状态',
          actions: '操作',
        },
        detail: {
          title: '员工详情',
          subtitle: '点击左侧成员查看组织信息与项目授权。',
          organization: '组织',
          department: '部门',
          team: '团队',
          role: '业务角色',
          level: '等级',
          defaultProject: '默认项目',
          email: '邮箱',
          noSelection: '选择一名员工后，这里会显示他的完整配置。',
          assignmentTitle: '项目权限分配',
          assignmentSubtitle: '把模板集合绑定到具体项目。',
          noAssignment: '当前没有项目授权，新增分配即可开始配置。',
          project: '项目',
          templates: '模板 ID',
          expiresAt: '过期时间',
          permanent: '永久',
          addAssignment: '新增分配',
          previewTitle: '生效权限预览',
          previewSubtitle: '按项目查看最终结算后的规则、能力与来源。',
          previewProject: '结算项目',
          previewLoading: '正在结算生效权限...',
          noPreviewProject: '当前没有可用于结算的项目。',
          noActiveAssignment: '当前项目没有有效授权，以下结果仅包含部门策略。',
          finalRules: '最终规则',
          noRules: '当前没有生效规则。',
          capabilitiesTitle: '能力',
          noCapabilities: '当前没有能力开关。',
          envTitle: '环境变量',
          noEnv: '当前没有环境变量覆盖。',
          assignmentPreviewTitle: '当前授权',
          templatesPreviewTitle: '命中模板',
          departmentPoliciesTitle: '部门策略',
          suppressedRulesTitle: '被压制规则',
          noSuppressedRules: '当前没有规则冲突。',
          noDepartmentPolicies: '当前没有启用的部门策略。',
          noTemplates: '当前没有命中模板。',
          noAssignmentDetail: '当前项目没有有效 assignment。',
          source: '来源',
          suppressedBy: '被压制于',
          statusApplied: '已生效',
          statusIgnored: '已忽略',
          statusMissing: '未找到',
          extraRules: '附加规则',
        },
        modal: {
          createTitle: '新增员工',
          editTitle: '编辑员工',
          createSubtitle: '创建新的后台成员并配置初始组织信息。',
          editSubtitle: '更新员工的组织归属、系统角色与账号状态。',
          username: '用户名 *',
          email: '邮箱 *',
          password: '密码 *',
          passwordOptional: '新密码（留空保持不变）',
          org: '组织',
          department: '部门',
          team: '团队',
          role: '业务角色',
          level: '等级',
          defaultProject: '默认项目',
          accountStatus: '帐号状态',
          systemRole: '系统角色',
          chooseNone: '未设置',
          usernamePlaceholder: '唯一用户名',
          emailPlaceholder: '邮箱地址',
          passwordPlaceholder: '请输入密码',
          passwordOptionalPlaceholder: '不修改请留空',
        },
        assignModal: {
          title: '新增项目权限分配',
          subtitle: '为指定项目绑定模板集合。',
          project: '项目 *',
          templates: '选择权限模板 *',
          templatePlaceholder: '',
          expiresAt: '过期时间（可选）',
          chooseProject: '选择项目',
          confirm: '确认分配',
        },
        errors: {
          userRequired: '用户名和邮箱不能为空',
          passwordRequired: '创建员工时密码不能为空',
          assignRequired: '请填写项目和模板 ID',
          deleteUser: '确认停用用户 "{{name}}"？',
          deleteAssignment: '确认删除项目 "{{name}}" 的权限分配？',
        },
      }
    : {
        eyebrow: 'Identity Registry',
        subtitle: 'Maintain user accounts, org mapping, system roles, and project-level assignments from one place.',
        totalUsers: 'Total users',
        activeUsers: 'Active accounts',
        suspendedUsers: 'Suspended accounts',
        selectedAssignments: 'Selected assignments',
        searchPlaceholder: 'Search by username, email, department, or team',
        allStatus: 'All status',
        active: 'Active',
        suspended: 'Suspended',
        refresh: 'Refresh list',
        empty: 'No users match the current filter.',
        loading: 'Loading user directory...',
        countLabel: 'users',
        detailAction: 'Details',
        table: {
          user: 'User',
          org: 'Org mapping',
          position: 'Business role',
          level: 'Level',
          systemRole: 'System role',
          status: 'Status',
          actions: 'Actions',
        },
        detail: {
          title: 'Member Detail',
          subtitle: 'Select a person from the table to inspect identity and project access.',
          organization: 'Organization',
          department: 'Department',
          team: 'Team',
          role: 'Business role',
          level: 'Level',
          defaultProject: 'Default project',
          email: 'Email',
          noSelection: 'Choose a user to review the complete profile and project assignments.',
          assignmentTitle: 'Project Assignments',
          assignmentSubtitle: 'Bind template sets to specific projects.',
          noAssignment: 'No project assignment yet. Add one to configure access.',
          project: 'Project',
          templates: 'Template IDs',
          expiresAt: 'Expires at',
          permanent: 'Never',
          addAssignment: 'Add assignment',
          previewTitle: 'Effective Permissions',
          previewSubtitle: 'Review the final computed rules, capabilities, and sources by project.',
          previewProject: 'Project Context',
          previewLoading: 'Computing effective policy...',
          noPreviewProject: 'No project is available for preview.',
          noActiveAssignment: 'No active assignment for this project. Results below only include department policy.',
          finalRules: 'Final Rules',
          noRules: 'No effective rules for this project.',
          capabilitiesTitle: 'Capabilities',
          noCapabilities: 'No capability flags configured.',
          envTitle: 'Environment',
          noEnv: 'No env overrides configured.',
          assignmentPreviewTitle: 'Active Assignment',
          templatesPreviewTitle: 'Matched Templates',
          departmentPoliciesTitle: 'Department Policies',
          suppressedRulesTitle: 'Suppressed Rules',
          noSuppressedRules: 'No rule conflicts were detected.',
          noDepartmentPolicies: 'No active department policies.',
          noTemplates: 'No templates matched this assignment.',
          noAssignmentDetail: 'No active assignment for this project.',
          source: 'Source',
          suppressedBy: 'Suppressed by',
          statusApplied: 'Applied',
          statusIgnored: 'Ignored',
          statusMissing: 'Missing',
          extraRules: 'Extra rules',
        },
        modal: {
          createTitle: 'Create user',
          editTitle: 'Edit user',
          createSubtitle: 'Create a new admin member and configure initial org mapping.',
          editSubtitle: 'Update org placement, system role, and account state.',
          username: 'Username *',
          email: 'Email *',
          password: 'Password *',
          passwordOptional: 'New password (leave blank to keep current)',
          org: 'Organization',
          department: 'Department',
          team: 'Team',
          role: 'Business role',
          level: 'Level',
          defaultProject: 'Default project',
          accountStatus: 'Account status',
          systemRole: 'System role',
          chooseNone: 'Not set',
          usernamePlaceholder: 'Unique username',
          emailPlaceholder: 'Email address',
          passwordPlaceholder: 'Enter password',
          passwordOptionalPlaceholder: 'Leave blank to keep current',
        },
        assignModal: {
          title: 'Add project assignment',
          subtitle: 'Attach template sets to a specific project.',
          project: 'Project *',
          templates: 'Choose templates *',
          templatePlaceholder: '',
          expiresAt: 'Expires at (optional)',
          chooseProject: 'Select a project',
          confirm: 'Assign',
        },
        errors: {
          userRequired: 'Username and email are required',
          passwordRequired: 'Password is required when creating a user',
          assignRequired: 'Project and template IDs are required',
          deleteUser: 'Suspend user "{{name}}"?',
          deleteAssignment: 'Delete the assignment for project "{{name}}"?',
        },
      }

  const [users, setUsers] = useState<User[]>([])
  const [dicts, setDicts] = useState<Dicts>({
    orgs: [],
    departments: [],
    teams: [],
    roles: [],
    levels: [],
    projects: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [previewProjectId, setPreviewProjectId] = useState('')
  const [policyPreview, setPolicyPreview] = useState<EffectivePolicyPreview | null>(null)
  const [policyPreviewLoading, setPolicyPreviewLoading] = useState(false)
  const [policyPreviewError, setPolicyPreviewError] = useState('')

  const loadAll = async () => {
    setLoading(true)
    setError('')

    try {
      const [usersData, dictsData] = await Promise.all([
        getUsers(accessToken),
        getDictionaries(accessToken),
      ])
      setUsers(usersData.users ?? [])
      setDicts(dictsData)
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
        const [usersData, dictsData] = await Promise.all([
          getUsers(accessToken),
          getDictionaries(accessToken),
        ])
        if (cancelled) return
        setUsers(usersData.users ?? [])
        setDicts(dictsData)
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

  useEffect(() => {
    if (!selectedUser) return

    const nextSelectedUser = users.find((user) => user.id === selectedUser.id)
    if (!nextSelectedUser) {
      setSelectedUser(null)
      return
    }

    if (nextSelectedUser !== selectedUser) {
      setSelectedUser(nextSelectedUser)
    }
  }, [selectedUser, users])

  useEffect(() => {
    if (!selectedUser) {
      setPreviewProjectId('')
      setPolicyPreview(null)
      setPolicyPreviewError('')
      setPolicyPreviewLoading(false)
      return
    }

    setPreviewProjectId(selectedUser.defaultProjectId?.toString() ?? '')
    setPolicyPreview(null)
    setPolicyPreviewError('')
  }, [selectedUser?.id])

  useEffect(() => {
    if (!selectedUser || previewProjectId || dicts.projects.length === 0) return
    setPreviewProjectId(String(dicts.projects[0].id))
  }, [selectedUser?.id, previewProjectId, dicts.projects])

  useEffect(() => {
    let cancelled = false

    const loadPolicyPreview = async () => {
      if (!selectedUser || !previewProjectId) {
        setPolicyPreview(null)
        setPolicyPreviewError('')
        setPolicyPreviewLoading(false)
        return
      }

      setPolicyPreviewLoading(true)
      setPolicyPreviewError('')

      try {
        const preview = await getEffectivePolicyPreview(
          accessToken,
          selectedUser.id,
          parseInt(previewProjectId, 10)
        )

        if (cancelled) return
        setPolicyPreview(preview as EffectivePolicyPreview)
      } catch (e) {
        if (cancelled) return
        setPolicyPreview(null)
        setPolicyPreviewError((e as Error).message)
      } finally {
        if (!cancelled) {
          setPolicyPreviewLoading(false)
        }
      }
    }

    void loadPolicyPreview()

    return () => {
      cancelled = true
    }
  }, [accessToken, selectedUser?.id, previewProjectId])

  const resolveName = (list: DictEntry[], id: number | null) =>
    id ? list.find((entry) => entry.id === id)?.name ?? String(id) : '—'

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return copy.detail.permanent

    return new Date(value).toLocaleString(isZh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatRule = (rule: PermissionRule) => `${rule.tool}${rule.content ? ` · ${rule.content}` : ''}`

  const getOrgSummary = (user: User) => {
    const department = resolveName(dicts.departments, user.departmentId)
    const team = resolveName(dicts.teams, user.teamId)
    return `${department}${team !== '—' ? ` / ${team}` : ''}`
  }

  const filteredUsers = users.filter((user) => {
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    const search = query.trim().toLowerCase()
    if (!matchesStatus) return false
    if (!search) return true

    const haystack = [
      user.username,
      user.email,
      resolveName(dicts.orgs, user.orgId),
      resolveName(dicts.departments, user.departmentId),
      resolveName(dicts.teams, user.teamId),
      resolveName(dicts.roles, user.roleId),
      resolveName(dicts.levels, user.levelId),
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(search)
  })

  const openAdd = () => {
    setEditUser(null)
    setForm({ ...EMPTY_FORM })
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (user: User) => {
    setEditUser(user)
    setForm({
      username: user.username,
      email: user.email,
      password: '',
      orgId: user.orgId?.toString() ?? '',
      departmentId: user.departmentId?.toString() ?? '',
      teamId: user.teamId?.toString() ?? '',
      roleId: user.roleId?.toString() ?? '',
      levelId: user.levelId?.toString() ?? '',
      defaultProjectId: user.defaultProjectId?.toString() ?? '',
      status: user.status,
      roles: user.roles,
    })
    setFormError('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditUser(null)
    setFormError('')
  }

  const handleSave = async () => {
    setFormError('')

    if (!form.username.trim() || !form.email.trim()) {
      setFormError(copy.errors.userRequired)
      return
    }

    if (!editUser && !form.password.trim()) {
      setFormError(copy.errors.passwordRequired)
      return
    }

    setSaving(true)

    try {
      const body: Record<string, unknown> = {
        email: form.email,
        orgId: form.orgId ? parseInt(form.orgId, 10) : null,
        departmentId: form.departmentId ? parseInt(form.departmentId, 10) : null,
        teamId: form.teamId ? parseInt(form.teamId, 10) : null,
        roleId: form.roleId ? parseInt(form.roleId, 10) : null,
        levelId: form.levelId ? parseInt(form.levelId, 10) : null,
        defaultProjectId: form.defaultProjectId ? parseInt(form.defaultProjectId, 10) : null,
        status: form.status,
        roles: form.roles,
      }

      if (form.password) {
        body.password = form.password
      }

      if (editUser) {
        await updateUser(accessToken, editUser.id, body)
      } else {
        body.username = form.username
        await createUser(accessToken, body)
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

  const handleDelete = async (user: User) => {
    const confirmed = confirm(copy.errors.deleteUser.replace('{{name}}', user.username))
    if (!confirmed) return

    try {
      await deleteUser(accessToken, user.id)
      await loadAll()
      if (selectedUser?.id === user.id) {
        setSelectedUser(null)
      }
      onDataChange?.()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const openDetail = (user: User) => {
    setSelectedUser(user)
  }

  const closeDetail = () => {
    setSelectedUser(null)
  }

  const selectedPreviewProject = previewProjectId
    ? dicts.projects.find((project) => String(project.id) === previewProjectId) ?? null
    : null

  return (
    <div className="page-stack users-page">

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
              className="users-filter"
            >
              <option value="all">{copy.allStatus}</option>
              <option value="active">{copy.active}</option>
              <option value="suspended">{copy.suspended}</option>
            </select>
            <span className="chip">
              {filteredUsers.length} / {users.length} {copy.countLabel}
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
        <section className="surface users-table-card">
          {filteredUsers.length === 0 ? (
            <div className="empty-state users-empty">{copy.empty}</div>
          ) : (
            <div className="table-shell">
              <table className="data-table users-table">
                <thead>
                  <tr>
                    <th>{copy.table.user}</th>
                    <th>{copy.table.org}</th>
                    <th>{copy.table.position}</th>
                    <th>{copy.table.level}</th>
                    <th>{copy.table.systemRole}</th>
                    <th>{copy.table.status}</th>
                    <th>{copy.table.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-cell">
                          <strong>{user.username}</strong>
                          <span>{user.email}</span>
                        </div>
                      </td>
                      <td>
                        <div className="org-cell">
                          <strong>{resolveName(dicts.orgs, user.orgId)}</strong>
                          <span>{getOrgSummary(user)}</span>
                        </div>
                      </td>
                      <td>{resolveName(dicts.roles, user.roleId)}</td>
                      <td>
                        <span className="level-chip">{resolveName(dicts.levels, user.levelId)}</span>
                      </td>
                      <td>
                        <span className={`role-pill ${user.roles.includes('admin') ? 'admin' : 'viewer'}`}>
                          {user.roles.includes('admin')
                            ? isZh ? '管理员' : 'Admin'
                            : isZh ? '查看者' : 'Viewer'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${user.status}`}>{t(`status.${user.status}`)}</span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="button button-secondary button-sm" onClick={() => openDetail(user)}>
                            {copy.detailAction}
                          </button>
                          <button className="button button-secondary button-sm" onClick={() => openEdit(user)}>
                            {t('btn.edit')}
                          </button>
                          <button className="button button-danger button-sm" onClick={() => handleDelete(user)}>
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
      )}

      {selectedUser && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal-panel modal-user-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{`${copy.detail.title} · ${selectedUser.username}`}</h3>
                <p className="modal-subtitle">{copy.detail.subtitle}</p>
              </div>
              <button
                className="button button-ghost icon-button"
                onClick={closeDetail}
                aria-label={isZh ? '关闭' : 'Close'}
              >
                <AppIcon name="close" size={16} />
              </button>
            </div>

            <div className="modal-body modal-user-detail-body">
              <div className="user-detail-topbar">
                <div className="stack-sm">
                  <span className="page-kicker">
                    <AppIcon name="shield" size={16} />
                    {copy.detail.title}
                  </span>
                  <h4>{selectedUser.username}</h4>
                  <p className="muted">{selectedUser.email}</p>
                </div>
                <div className="toolbar-group">
                  <button
                    className="button button-secondary button-sm"
                    onClick={() => {
                      closeDetail()
                      openEdit(selectedUser)
                    }}
                  >
                    {t('btn.edit')}
                  </button>
                </div>
              </div>

              <div className="detail-grid">
                <div className="detail-card">
                  <span>{copy.detail.organization}</span>
                  <strong>{resolveName(dicts.orgs, selectedUser.orgId)}</strong>
                </div>
                <div className="detail-card">
                  <span>{copy.detail.department}</span>
                  <strong>{resolveName(dicts.departments, selectedUser.departmentId)}</strong>
                </div>
                <div className="detail-card">
                  <span>{copy.detail.team}</span>
                  <strong>{resolveName(dicts.teams, selectedUser.teamId)}</strong>
                </div>
                <div className="detail-card">
                  <span>{copy.detail.role}</span>
                  <strong>{resolveName(dicts.roles, selectedUser.roleId)}</strong>
                </div>
                <div className="detail-card">
                  <span>{copy.detail.level}</span>
                  <strong>{resolveName(dicts.levels, selectedUser.levelId)}</strong>
                </div>
                <div className="detail-card">
                  <span>{copy.detail.defaultProject}</span>
                  <strong>{resolveName(dicts.projects, selectedUser.defaultProjectId)}</strong>
                </div>
              </div>

              <div className="effective-permissions-sandbox">
                <div className="assignment-section-header">
                  <div className="stack-sm">
                    <h4>{copy.detail.previewTitle}</h4>
                    <p className="panel-subtitle">{copy.detail.previewSubtitle}</p>
                  </div>
                </div>
                <div className="policy-preview-toolbar">
                  <div className="field preview-project-field">
                    <label>{copy.detail.previewProject}</label>
                    <select
                      value={previewProjectId}
                      onChange={(e) => setPreviewProjectId(e.target.value)}
                      disabled={dicts.projects.length === 0}
                    >
                      {dicts.projects.length === 0 ? (
                        <option value="">{copy.detail.noPreviewProject}</option>
                      ) : (
                        dicts.projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  {selectedPreviewProject && (
                    <span className="chip preview-project-chip">
                      {selectedPreviewProject.name}
                    </span>
                  )}
                </div>

                {policyPreviewLoading ? (
                  <div className="loading-state">{copy.detail.previewLoading}</div>
                ) : policyPreviewError ? (
                  <div className="error-banner">{policyPreviewError}</div>
                ) : !previewProjectId ? (
                  <div className="empty-state">{copy.detail.noPreviewProject}</div>
                ) : policyPreview ? (
                  <div className="policy-preview-stack">
                    {!policyPreview.assignment && (
                      <div className="surface-muted preview-note">
                        {copy.detail.noActiveAssignment}
                      </div>
                    )}

                    <section className="preview-section">
                      <div className="preview-section-header">
                        <h5>{copy.detail.finalRules}</h5>
                        <span className="chip">{policyPreview.effectiveRules.length}</span>
                      </div>
                      {policyPreview.effectiveRules.length === 0 ? (
                        <div className="empty-state">{copy.detail.noRules}</div>
                      ) : (
                        <div className="preview-rule-list">
                          {policyPreview.effectiveRules.map((rule) => (
                            <article key={`${rule.key}-${rule.sourceType}-${rule.sourceId ?? 'na'}`} className="preview-rule-card">
                              <div className="preview-rule-meta">
                                <span className={`policy-behavior-pill ${rule.behavior}`}>{rule.behavior.toUpperCase()}</span>
                                <span className="mono-pill">{formatRule(rule)}</span>
                              </div>
                              <div className="preview-rule-source">
                                <span>{copy.detail.source}</span>
                                <strong>{rule.sourceLabel}</strong>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>

                    <div className="preview-split-grid">
                      <section className="preview-section">
                        <div className="preview-section-header">
                          <h5>{copy.detail.capabilitiesTitle}</h5>
                          <span className="chip">{policyPreview.effective.capabilities.length}</span>
                        </div>
                        {policyPreview.effective.capabilities.length === 0 ? (
                          <div className="empty-state">{copy.detail.noCapabilities}</div>
                        ) : (
                          <div className="preview-pill-list">
                            {policyPreview.effective.capabilities.map((capability) => (
                              <code key={capability} className="mono-pill">{capability}</code>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="preview-section">
                        <div className="preview-section-header">
                          <h5>{copy.detail.envTitle}</h5>
                          <span className="chip">{Object.keys(policyPreview.effective.envOverrides).length}</span>
                        </div>
                        {Object.keys(policyPreview.effective.envOverrides).length === 0 ? (
                          <div className="empty-state">{copy.detail.noEnv}</div>
                        ) : (
                          <div className="preview-env-list">
                            {Object.entries(policyPreview.effective.envOverrides).map(([key, value]) => (
                              <div key={key} className="preview-env-row">
                                <code>{key}</code>
                                <strong>{value}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="preview-expiry">
                          <span>{copy.detail.expiresAt}</span>
                          <strong>{formatDateTime(policyPreview.effective.expiresAt)}</strong>
                        </div>
                      </section>
                    </div>

                    <section className="preview-section">
                      <div className="preview-section-header">
                        <h5>{copy.detail.assignmentPreviewTitle}</h5>
                      </div>
                      {policyPreview.assignment ? (
                        <div className="preview-assignment-card">
                          <div className="preview-assignment-row">
                            <span>{copy.detail.project}</span>
                            <strong>{resolveName(dicts.projects, policyPreview.assignment.projectId)}</strong>
                          </div>
                          <div className="preview-assignment-row">
                            <span>{copy.detail.templates}</span>
                            <code className="mono-pill">{policyPreview.assignment.templateIds}</code>
                          </div>
                          <div className="preview-assignment-row">
                            <span>{copy.detail.extraRules}</span>
                            <strong>
                              {policyPreview.assignment.extraRulesJson
                                ? `${JSON.parse(policyPreview.assignment.extraRulesJson).length}`
                                : '0'}
                            </strong>
                          </div>
                          <div className="preview-assignment-row">
                            <span>{copy.detail.expiresAt}</span>
                            <strong>{formatDateTime(policyPreview.assignment.expiresAt)}</strong>
                          </div>
                        </div>
                      ) : (
                        <div className="empty-state">{copy.detail.noAssignmentDetail}</div>
                      )}
                    </section>

                    <div className="preview-split-grid">
                      <section className="preview-section">
                        <div className="preview-section-header">
                          <h5>{copy.detail.templatesPreviewTitle}</h5>
                          <span className="chip">{policyPreview.templates.length}</span>
                        </div>
                        {policyPreview.templates.length === 0 ? (
                          <div className="empty-state">{copy.detail.noTemplates}</div>
                        ) : (
                          <div className="preview-source-list">
                            {policyPreview.templates.map((template) => (
                              <div key={`${template.id}-${template.status}`} className="preview-source-card">
                                <div className="preview-source-head">
                                  <strong>{template.name}</strong>
                                  <span className={`status-pill ${template.status === 'missing' ? 'missing' : template.status}`}>
                                    {template.status === 'missing'
                                      ? copy.detail.statusMissing
                                      : template.applied
                                        ? copy.detail.statusApplied
                                        : copy.detail.statusIgnored}
                                  </span>
                                </div>
                                <p className="muted">
                                  {template.description || (isZh ? '无描述' : 'No description')}
                                </p>
                                <div className="preview-source-meta">
                                  <span>v{template.version}</span>
                                  <span>{template.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="preview-section">
                        <div className="preview-section-header">
                          <h5>{copy.detail.departmentPoliciesTitle}</h5>
                          <span className="chip">{policyPreview.departmentPolicies.length}</span>
                        </div>
                        {policyPreview.departmentPolicies.length === 0 ? (
                          <div className="empty-state">{copy.detail.noDepartmentPolicies}</div>
                        ) : (
                          <div className="preview-source-list">
                            {policyPreview.departmentPolicies.map((policy) => (
                              <div key={policy.id} className="preview-source-card">
                                <div className="preview-source-head">
                                  <strong>{`${policy.policyType.toUpperCase()} · ${policy.toolCategory}`}</strong>
                                  <span className={`policy-behavior-pill ${policy.policyType}`}>{policy.policyType.toUpperCase()}</span>
                                </div>
                                <code className="mono-pill">{policy.resourcePattern}</code>
                                {policy.description && <p className="muted">{policy.description}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>

                    <section className="preview-section">
                      <div className="preview-section-header">
                        <h5>{copy.detail.suppressedRulesTitle}</h5>
                        <span className="chip">{policyPreview.suppressedRules.length}</span>
                      </div>
                      {policyPreview.suppressedRules.length === 0 ? (
                        <div className="empty-state">{copy.detail.noSuppressedRules}</div>
                      ) : (
                        <div className="preview-source-list">
                          {policyPreview.suppressedRules.map((rule, index) => (
                            <div key={`${rule.key}-${rule.sourceType}-${index}`} className="preview-source-card">
                              <div className="preview-source-head">
                                <strong>{formatRule(rule)}</strong>
                                <span className={`policy-behavior-pill ${rule.behavior}`}>{rule.behavior.toUpperCase()}</span>
                              </div>
                              <p className="muted">
                                {copy.detail.source}: {rule.sourceLabel}
                              </p>
                              <p className="muted">
                                {copy.detail.suppressedBy}: {rule.suppressedBy.sourceLabel} · {rule.suppressedBy.behavior.toUpperCase()}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                ) : (
                  <div className="empty-state">{copy.detail.noRules}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-panel modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  {editUser ? `${copy.modal.editTitle} · ${editUser.username}` : copy.modal.createTitle}
                </h3>
                <p className="modal-subtitle">
                  {editUser ? copy.modal.editSubtitle : copy.modal.createSubtitle}
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
                  <label>{copy.modal.username}</label>
                  <input
                    type="text"
                    value={form.username}
                    disabled={!!editUser}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder={copy.modal.usernamePlaceholder}
                  />
                </div>

                <div className="field">
                  <label>{copy.modal.email}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={copy.modal.emailPlaceholder}
                  />
                </div>

                <div className="field">
                  <label>{editUser ? copy.modal.passwordOptional : copy.modal.password}</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editUser ? copy.modal.passwordOptionalPlaceholder : copy.modal.passwordPlaceholder}
                  />
                </div>

                <div className="field">
                  <label>{copy.modal.org}</label>
                  <select value={form.orgId} onChange={(e) => setForm({ ...form, orgId: e.target.value })}>
                    <option value="">{copy.modal.chooseNone}</option>
                    {dicts.orgs.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>{copy.modal.department}</label>
                  <select
                    value={form.departmentId}
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
                  <label>{copy.modal.team}</label>
                  <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                    <option value="">{copy.modal.chooseNone}</option>
                    {dicts.teams.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>{copy.modal.role}</label>
                  <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                    <option value="">{copy.modal.chooseNone}</option>
                    {dicts.roles.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>{copy.modal.level}</label>
                  <select value={form.levelId} onChange={(e) => setForm({ ...form, levelId: e.target.value })}>
                    <option value="">{copy.modal.chooseNone}</option>
                    {dicts.levels.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>{copy.modal.defaultProject}</label>
                  <select
                    value={form.defaultProjectId}
                    onChange={(e) => setForm({ ...form, defaultProjectId: e.target.value })}
                  >
                    <option value="">{copy.modal.chooseNone}</option>
                    {dicts.projects.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>{copy.modal.accountStatus}</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="active">{copy.active}</option>
                    <option value="suspended">{copy.suspended}</option>
                  </select>
                </div>

                <div className="field">
                  <label>{copy.modal.systemRole}</label>
                  <select value={form.roles} onChange={(e) => setForm({ ...form, roles: e.target.value })}>
                    <option value="viewer">{isZh ? '查看者' : 'Viewer'}</option>
                    <option value="admin">{isZh ? '管理员' : 'Admin'}</option>
                    <option value="admin,viewer">{isZh ? '管理员 + 查看者' : 'Admin + Viewer'}</option>
                  </select>
                </div>
              </div>

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
