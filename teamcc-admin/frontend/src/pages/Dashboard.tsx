import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getAllAssignments,
  getAuditLogs,
  getTemplates,
  getUsers,
} from '../api/client'
import AppIcon from '../components/AppIcon'
import UsersPage from './UsersPage'
import TemplatesPage from './TemplatesPage'
import AuditPage from './AuditPage'
import PoliciesPage from './PoliciesPage'
import AssignmentsPage from './AssignmentsPage'
import Neo4jPage from './Neo4jPage'
import '../styles/Dashboard.css'

interface DashboardProps {
  accessToken: string
  onLogout: () => void
}

type ViewKey = 'home' | 'users' | 'assignments' | 'templates' | 'audit' | 'policies' | 'neo4j'

interface RecentActivity {
  id: number
  action: string
  actorUsername: string | null
  targetId: number | null
  targetType: string | null
  createdAt: string
}

interface OverviewState {
  userTotal: number
  userActive: number
  userSuspended: number
  templateTotal: number
  templateActive: number
  templateArchived: number
  assignmentTotal: number
  auditTotal: number
  securityViolationTotal: number
  recentLogs: RecentActivity[]
}

const EMPTY_OVERVIEW: OverviewState = {
  userTotal: 0,
  userActive: 0,
  userSuspended: 0,
  templateTotal: 0,
  templateActive: 0,
  templateArchived: 0,
  assignmentTotal: 0,
  auditTotal: 0,
  securityViolationTotal: 0,
  recentLogs: [],
}

export default function Dashboard({ accessToken, onLogout }: DashboardProps) {
      const { t, i18n } = useTranslation()
      const isZh = i18n.language === 'zh'
  const neo4jBrowserUrl = import.meta.env.VITE_NEO4J_BROWSER_URL?.trim() || 'http://127.0.0.1:7474/browser/'

  const copy = isZh
    ? {
        brandLabel: 'Access Control Command',
        brandBody: '用更清晰的节奏管理身份、模板与审计。',
        sidebarHelpLabel: '平台说明',
        sidebarHelpHint: '查看如何配置权限',
        sidebarToggleShow: '展开导航',
        sidebarToggleHide: '隐藏导航',
        help: {
          title: 'TeamCC 管理平台使用说明',
          intro:
            '这个平台用于维护员工身份、权限模板、部门基线策略和项目授权，最终生成用户在具体项目下的生效权限。',
          sections: [
            {
              title: '1. 先维护员工身份',
              body: '在“员工管理”里维护部门、团队、角色、职级、默认项目和账号状态。这里决定身份基线和默认取哪个项目查看权限。',
            },
            {
              title: '2. 再维护权限模板',
              body: '在“权限模板”里配置规则、能力和环境变量。模板适合复用，避免为每个人重复手工配置。',
            },
            {
              title: '3. 按项目做授权绑定',
              body: '在“项目授权”里把员工、项目和模板绑定起来。需要例外时，再追加额外规则，不要直接把所有差异都写进模板。',
            },
            {
              title: '4. 用生效权限预览验收',
              body: '回到员工详情，查看指定项目下的最终生效规则、能力、环境变量和规则来源，确认实际权限是否符合预期。',
            },
          ],
          notesTitle: '结算规则',
          notes: [
            '权限按“部门策略 -> 项目授权 -> 模板 -> 额外规则”合成。',
            '冲突优先级是 deny > ask > allow。',
            '停用用户、过期授权和已归档模板不会参与最终生效结果。',
          ],
          close: '知道了',
        },
        pages: {
          home: {
            eyebrow: 'Control Tower',
            title: t('nav.dashboard'),
            description: '集中查看组织权限健康度、模板状态和最近的变更痕迹。',
          },
          users: {
            eyebrow: 'Identity Registry',
            title: t('nav.users'),
            description: '统一维护员工身份档案与组织归属，作为后续自动策略分发的基础。',
          },
          assignments: {
            eyebrow: 'Access Dispatch',
            title: '项目授权',
            description: '跨越部门边界，为具体项目单独分配能力模板和越权例外规则。',
          },
          templates: {
            eyebrow: 'Policy Library',
            title: t('nav.templates'),
            description: '设计和维护可复用的权限模板，降低重复配置成本。',
          },
          audit: {
            eyebrow: 'Trace Center',
            title: t('nav.audit'),
            description: '追踪关键操作，快速定位变更来源与影响范围。',
          },
          policies: {
            eyebrow: 'Policy Governance',
            title: '部门策略',
            description: '为各部门配置基础访问控制规则（部门级 Deny 规则）。',
          },
          neo4j: {
            eyebrow: 'Graph Browser',
            title: 'Neo4j 图谱',
            description: '在管理后台里直接打开本地 Neo4j Browser，查看 Skill、版本和效果关系。',
          },
        },
        hero: {
          kicker: 'Policy Control Center',
          title: '权限治理，一眼看清',
          description:
            '从一个工作台同时掌握员工身份、模板版本和审计轨迹，让最小权限真正落地。',
          chips: ['可审计', '跨项目授权', '模板化治理'],
          primaryCta: '进入员工目录',
          secondaryCta: '刷新总览',
        },
        snapshotTitle: '系统快照',
        snapshotSubtitle: '这里展示的数字来自当前后台实时数据。',
        activityTitle: '最近活动',
        activitySubtitle: '最近 5 条审计事件',
        activityEmpty: '当前还没有可展示的审计记录。',
        quickTitle: '高频入口',
        quickSubtitle: '直接跳到最常用的管理动作。',
        partialError: '部分概览数据加载失败，以下内容可能不完整。',
        metrics: {
          users: '员工账户',
          templates: '权限模板',
          assignments: '项目授权',
          securityViolations: '安全违反',
          activeUsers: '活跃帐号',
          archivedTemplates: '归档模板',
          activeAssignments: '已配置授权',
          latestAudit: '最近事件',
        },
        navHints: {
          home: '总览与风险状态',
          users: '基础组织身份档案',
          assignments: '跨项目的模板分配与绑定',
          templates: '规则、能力与环境变量',
          audit: '全链路变更轨迹',
          policies: '部门级访问控制规则',
          neo4j: '本地图谱浏览入口',
        },
        quickCards: {
          users: '批量查看组织成员、身份状态和授权详情。',
          templates: '统一维护模板规则、能力和版本信息。',
          audit: '快速核查最近权限动作和对象变更。',
        },
        actionLabel: '前往',
      }
    : {
        brandLabel: 'Access Control Command',
        brandBody: 'Run identity, templates, and audit flow with more clarity.',
        sidebarHelpLabel: 'Platform Help',
        sidebarHelpHint: 'How to configure permissions',
        sidebarToggleShow: 'Show Navigation',
        sidebarToggleHide: 'Hide Navigation',
        help: {
          title: 'How to use the TeamCC admin console',
          intro:
            'This platform manages employee identity, permission templates, department baselines, and project assignments to produce the effective policy for a user in a specific project.',
          sections: [
            {
              title: '1. Maintain employee identity first',
              body: 'Use Users to keep department, team, role, level, default project, and account status accurate. These fields establish the subject baseline.',
            },
            {
              title: '2. Create reusable permission templates',
              body: 'Use Templates to define rules, capabilities, and env overrides. Keep reusable policy logic here instead of duplicating per-user setup.',
            },
            {
              title: '3. Bind users to templates per project',
              body: 'Use Assignments to connect a user, a project, and one or more templates. Add extra rules only for exceptions, not as the main source of policy.',
            },
            {
              title: '4. Validate in effective policy preview',
              body: 'Open a user detail panel and inspect the effective rules, capabilities, env overrides, and rule sources for the selected project before finalizing changes.',
            },
          ],
          notesTitle: 'Resolution rules',
          notes: [
            'Policies are merged in the order: department policy -> assignment -> template -> extra rules.',
            'Conflicts resolve with deny > ask > allow.',
            'Suspended users, expired assignments, and archived templates do not contribute to the final effective result.',
          ],
          close: 'Close',
        },
        pages: {
          home: {
            eyebrow: 'Control Tower',
            title: t('nav.dashboard'),
            description: 'Review identity coverage, template health, and the latest operational changes in one place.',
          },
          users: {
            eyebrow: 'Identity Registry',
            title: t('nav.users'),
            description: 'Maintain people records and org mapping for automated policy baselines.',
          },
          assignments: {
            eyebrow: 'Access Dispatch',
            title: 'Assignments',
            description: 'Dispatch template capacities and handle extra overrides for specific project scopes.',
          },
          templates: {
            eyebrow: 'Policy Library',
            title: t('nav.templates'),
            description: 'Design reusable permission templates and reduce policy drift.',
          },
          audit: {
            eyebrow: 'Trace Center',
            title: t('nav.audit'),
            description: 'Inspect privileged changes and trace their impact quickly.',
          },
          policies: {
            eyebrow: 'Policy Governance',
            title: 'Department Policies',
            description: 'Configure baseline access control rules for each department (department-level deny rules).',
          },
          neo4j: {
            eyebrow: 'Graph Browser',
            title: 'Neo4j Graph',
            description: 'Open the local Neo4j Browser inside admin to inspect Skill, version, and effect relationships.',
          },
        },
        hero: {
          kicker: 'Policy Control Center',
          title: 'Permission governance at a glance',
          description:
            'Operate identity records, template versions, and audit trails from a single workspace built for low-friction control.',
          chips: ['Auditable', 'Cross-project access', 'Template governance'],
          primaryCta: 'Open user directory',
          secondaryCta: 'Refresh overview',
        },
        snapshotTitle: 'System Snapshot',
        snapshotSubtitle: 'These figures are pulled from live admin data.',
        activityTitle: 'Recent Activity',
        activitySubtitle: 'Latest 5 audit events',
        activityEmpty: 'No recent audit events to display yet.',
        quickTitle: 'Quick Access',
        quickSubtitle: 'Jump straight into the most common admin actions.',
        partialError: 'Part of the overview failed to load, so some numbers may be incomplete.',
        metrics: {
          users: 'User Accounts',
          templates: 'Templates',
          assignments: 'Assignments',
          securityViolations: 'Security Violations',
          activeUsers: 'Active accounts',
          archivedTemplates: 'Archived templates',
          activeAssignments: 'Configured assignments',
          latestAudit: 'Latest event',
        },
        navHints: {
          home: 'Overview and risk posture',
          users: 'Employee identity records',
          assignments: 'Cross-project template binding',
          templates: 'Rules, capabilities, and env overrides',
          audit: 'Full change trail',
          policies: 'Department-level access control',
          neo4j: 'Local graph browser entry',
        },
        quickCards: {
          users: 'Review org members, account states, and assignment details.',
          templates: 'Maintain rules, capabilities, and template versions.',
          audit: 'Inspect the latest permission actions and target changes.',
        },
        actionLabel: 'Open',
      }

  const [currentPage, setCurrentPage] = useState<ViewKey>('home')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [overview, setOverview] = useState<OverviewState>(EMPTY_OVERVIEW)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState('')
  const partialErrorText = copy.partialError

  const toggleLanguage = () => {
    const nextLang = isZh ? 'en' : 'zh'
    i18n.changeLanguage(nextLang)
  }

  const collectOverviewSnapshot = async () => {
    const [usersResult, templatesResult, assignmentsResult, auditResult, securityAuditResult] =
      await Promise.allSettled([
        getUsers(accessToken),
        getTemplates(accessToken),
        getAllAssignments(accessToken),
        getAuditLogs(accessToken, { limit: 5, offset: 0 }),
        getAuditLogs(accessToken, {
          limit: 1,
          offset: 0,
          actions: ['permission_deny', 'policy_violation'],
          severity: 'critical',
        }),
      ])

    const nextOverview: OverviewState = { ...EMPTY_OVERVIEW }
    let successCount = 0

    if (usersResult.status === 'fulfilled') {
      const users = usersResult.value.users ?? []
      nextOverview.userTotal = users.length
      nextOverview.userActive = users.filter((user: { status: string }) => user.status === 'active').length
      nextOverview.userSuspended = users.filter((user: { status: string }) => user.status === 'suspended').length
      successCount += 1
    }

    if (templatesResult.status === 'fulfilled') {
      const templates = templatesResult.value.templates ?? []
      nextOverview.templateTotal = templates.length
      nextOverview.templateActive = templates.filter((template: { status: string }) => template.status === 'active').length
      nextOverview.templateArchived = templates.filter((template: { status: string }) => template.status === 'archived').length
      successCount += 1
    }

    if (assignmentsResult.status === 'fulfilled') {
      nextOverview.assignmentTotal = assignmentsResult.value.assignments?.length ?? 0
      successCount += 1
    }

    if (auditResult.status === 'fulfilled') {
      nextOverview.auditTotal = auditResult.value.total ?? 0
      nextOverview.recentLogs = auditResult.value.logs ?? []
      successCount += 1
    }

    if (securityAuditResult.status === 'fulfilled') {
      nextOverview.securityViolationTotal = securityAuditResult.value.total ?? 0
      successCount += 1
    }

    return {
      failed: successCount === 0 || successCount < 5,
      overview: nextOverview,
    }
  }

  const loadOverview = async () => {
    setOverviewLoading(true)
    setOverviewError('')

    const { failed, overview: nextOverview } = await collectOverviewSnapshot()
    setOverview(nextOverview)
    setOverviewError(failed ? copy.partialError : '')
    setOverviewLoading(false)
  }

  useEffect(() => {
    if (currentPage !== 'home') {
      return
    }

    let cancelled = false

    const syncOverview = async () => {
      const [usersResult, templatesResult, assignmentsResult, auditResult, securityAuditResult] =
        await Promise.allSettled([
          getUsers(accessToken),
          getTemplates(accessToken),
          getAllAssignments(accessToken),
          getAuditLogs(accessToken, { limit: 5, offset: 0 }),
          getAuditLogs(accessToken, {
            limit: 1,
            offset: 0,
            actions: ['permission_deny', 'policy_violation'],
            severity: 'critical',
          }),
        ])

      const nextOverview: OverviewState = { ...EMPTY_OVERVIEW }
      let successCount = 0

      if (usersResult.status === 'fulfilled') {
        const users = usersResult.value.users ?? []
        nextOverview.userTotal = users.length
        nextOverview.userActive = users.filter((user: { status: string }) => user.status === 'active').length
        nextOverview.userSuspended = users.filter((user: { status: string }) => user.status === 'suspended').length
        successCount += 1
      }

      if (templatesResult.status === 'fulfilled') {
        const templates = templatesResult.value.templates ?? []
        nextOverview.templateTotal = templates.length
        nextOverview.templateActive = templates.filter((template: { status: string }) => template.status === 'active').length
        nextOverview.templateArchived = templates.filter((template: { status: string }) => template.status === 'archived').length
        successCount += 1
      }

      if (assignmentsResult.status === 'fulfilled') {
        nextOverview.assignmentTotal = assignmentsResult.value.assignments?.length ?? 0
        successCount += 1
      }

      if (auditResult.status === 'fulfilled') {
        nextOverview.auditTotal = auditResult.value.total ?? 0
        nextOverview.recentLogs = auditResult.value.logs ?? []
        successCount += 1
      }

      if (securityAuditResult.status === 'fulfilled') {
        nextOverview.securityViolationTotal = securityAuditResult.value.total ?? 0
        successCount += 1
      }

      if (cancelled) return
      setOverview(nextOverview)
      setOverviewError(successCount === 0 || successCount < 5 ? partialErrorText : '')
      setOverviewLoading(false)
    }

    void syncOverview()

    return () => {
      cancelled = true
    }
  }, [accessToken, currentPage, partialErrorText])

  const pageMeta = copy.pages[currentPage]
  const actionLabels = isZh
    ? {
        create: '创建',
        update: '更新',
        delete: '删除',
        login: '登录',
        logout: '登出',
        boot: '客户端启动',
        exit: '会话退出',
        permission_allow: '已放行工具使用',
        permission_ask: '触发权限确认',
        permission_deny: '尝试使用被禁止的工具',
        policy_violation: '策略违反',
        bash_command: '终端命令',
        file_write: '文件写入',
        command_execution_error: '命令错误',
      }
    : {
        create: 'Created',
        update: 'Updated',
        delete: 'Deleted',
        login: 'Login',
        logout: 'Logout',
        boot: 'Boot',
        exit: 'Session Exit',
        permission_allow: 'Tool Allowed',
        permission_ask: 'Permission Prompted',
        permission_deny: 'Blocked Tool Attempt',
        policy_violation: 'Policy Violation',
        bash_command: 'Bash Command',
        file_write: 'File Write',
        command_execution_error: 'Command Error',
      }

  const targetLabels = isZh
    ? {
        user: '员工',
        template: '模板',
        assignment: '授权',
        department_policy: '部门策略',
        session: '会话',
        command: '命令',
        file: '文件',
        tool: '工具',
        policy: '策略',
      }
    : {
        user: 'User',
        template: 'Template',
        assignment: 'Assignment',
        department_policy: 'Department Policy',
        session: 'Session',
        command: 'Command',
        file: 'File',
        tool: 'Tool',
        policy: 'Policy',
      }

  const navItems: Array<{
    key: ViewKey
    icon: 'dashboard' | 'users' | 'templates' | 'audit' | 'shield' | 'spark' | 'graph'
    label: string
  }> = [
    { key: 'home', icon: 'dashboard', label: t('nav.dashboard') },
    { key: 'users', icon: 'users', label: t('nav.users') },
    { key: 'assignments', icon: 'spark', label: isZh ? '项目授权' : 'Assignments' },
    { key: 'templates', icon: 'templates', label: t('nav.templates') },
    { key: 'policies', icon: 'shield', label: isZh ? '部门策略' : 'Policies' },
    { key: 'neo4j', icon: 'graph', label: isZh ? 'Neo4j 图谱' : 'Neo4j Graph' },
    { key: 'audit', icon: 'audit', label: t('nav.audit') },
  ]

  const quickCards: Array<{ key: Exclude<ViewKey, 'home'>; icon: 'users' | 'templates' | 'audit' | 'shield'; label: string; body: string }> = [
    { key: 'users', icon: 'users', label: t('nav.users'), body: copy.quickCards.users },
    { key: 'templates', icon: 'templates', label: t('nav.templates'), body: copy.quickCards.templates },
    { key: 'policies', icon: 'shield', label: isZh ? '部门策略' : 'Policies', body: isZh ? '统一配置部门级访问控制规则与管制策略。' : 'Manage department-level access control rules.' },
    { key: 'audit', icon: 'audit', label: t('nav.audit'), body: copy.quickCards.audit },
  ]

  const navigateTo = (page: ViewKey) => {
    if (page === 'home') {
      setOverviewLoading(true)
    }
    setCurrentPage(page)
  }

  const renderHome = () => (
    <div className="page-stack">
      <section className="overview-hero">
        <div className="surface overview-banner">
          <span className="page-kicker">
            <AppIcon name="shield" size={16} />
            {copy.hero.kicker}
          </span>
          <h2 className="overview-title">{copy.hero.title}</h2>
          <p className="overview-description">{copy.hero.description}</p>
          <div className="hero-chip-row">
            {copy.hero.chips.map((chip) => (
              <span key={chip} className="hero-chip">
                {chip}
              </span>
            ))}
          </div>
          <div className="hero-action-row">
            <button className="button button-primary" onClick={() => navigateTo('users')}>
              <AppIcon name="users" size={16} />
              {copy.hero.primaryCta}
            </button>
            <button className="button button-secondary" onClick={loadOverview}>
              <AppIcon name="refresh" size={16} />
              {copy.hero.secondaryCta}
            </button>
          </div>
        </div>

        <div className="surface overview-snapshot">
          <div className="stack-sm">
            <span className="page-kicker">
              <AppIcon name="spark" size={16} />
              {copy.snapshotTitle}
            </span>
            <h3>{copy.snapshotTitle}</h3>
            <p className="overview-snapshot-copy">{copy.snapshotSubtitle}</p>
          </div>

          {overviewLoading ? (
            <div className="loading-state">{isZh ? '正在汇总后台数据...' : 'Collecting admin metrics...'}</div>
          ) : (
            <div className="snapshot-grid">
              <div className="snapshot-item">
                <span>{copy.metrics.activeUsers}</span>
                <strong>{overview.userActive}</strong>
              </div>
              <div className="snapshot-item">
                <span>{copy.metrics.archivedTemplates}</span>
                <strong>{overview.templateArchived}</strong>
              </div>
              <div className="snapshot-item">
                <span>{copy.metrics.activeAssignments}</span>
                <strong>{overview.assignmentTotal}</strong>
              </div>
              <div className="snapshot-item">
                <span>{copy.metrics.latestAudit}</span>
                <strong>{overview.recentLogs[0] ? new Date(overview.recentLogs[0].createdAt).toLocaleDateString(isZh ? 'zh-CN' : 'en-US') : '—'}</strong>
              </div>
            </div>
          )}
        </div>
      </section>

      {overviewError && <div className="error-banner">{overviewError}</div>}

      <section className="metric-grid">
        <article className="surface metric-card">
          <div className="metric-label">{copy.metrics.users}</div>
          <div className="metric-value">{overview.userTotal}</div>
          <div className="metric-meta">
            {isZh
              ? `${overview.userActive} 活跃 / ${overview.userSuspended} 停用`
              : `${overview.userActive} active / ${overview.userSuspended} suspended`}
          </div>
        </article>
        <article className="surface metric-card">
          <div className="metric-label">{copy.metrics.templates}</div>
          <div className="metric-value">{overview.templateTotal}</div>
          <div className="metric-meta">
            {isZh
              ? `${overview.templateActive} 启用 / ${overview.templateArchived} 归档`
              : `${overview.templateActive} active / ${overview.templateArchived} archived`}
          </div>
        </article>
        <article className="surface metric-card">
          <div className="metric-label">{copy.metrics.assignments}</div>
          <div className="metric-value">{overview.assignmentTotal}</div>
          <div className="metric-meta">
            {isZh ? '跨项目权限已结构化配置。' : 'Cross-project access is centrally configured.'}
          </div>
        </article>
        <article className="surface metric-card">
          <div className="metric-label">{copy.metrics.securityViolations}</div>
          <div className="metric-value">{overview.securityViolationTotal}</div>
          <div className="metric-meta">
            {isZh ? '统计 critical 的策略违反与高风险 deny。' : 'Critical policy violations and blocked high-risk tools.'}
          </div>
        </article>
      </section>

      <section className="overview-columns">
        <div className="surface overview-panel">
          <div className="panel-header">
            <div className="stack-sm">
              <span className="page-kicker">
                <AppIcon name="activity" size={16} />
                {copy.activityTitle}
              </span>
              <h3>{copy.activityTitle}</h3>
              <p className="panel-subtitle">{copy.activitySubtitle}</p>
            </div>
          </div>

          <div className="activity-feed">
            {overviewLoading ? (
              <div className="loading-state">{isZh ? '正在读取最近活动...' : 'Loading recent activity...'}</div>
            ) : overview.recentLogs.length === 0 ? (
              <div className="empty-state">{copy.activityEmpty}</div>
            ) : (
              overview.recentLogs.map((log) => (
                <div key={log.id} className="activity-item">
                  <div className={`activity-dot tone-${log.action}`} />
                  <div className="activity-copy">
                    <strong>
                      {actionLabels[log.action as keyof typeof actionLabels] ?? log.action}
                      {' · '}
                      {targetLabels[log.targetType as keyof typeof targetLabels] ?? log.targetType ?? '—'}
                    </strong>
                    <span>
                      {(log.actorUsername ?? (isZh ? '未知操作者' : 'Unknown actor'))}
                      {log.targetId ? ` #${log.targetId}` : ''}
                    </span>
                  </div>
                  <time className="activity-time">
                    {new Date(log.createdAt).toLocaleString(isZh ? 'zh-CN' : 'en-US')}
                  </time>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="surface overview-panel">
          <div className="panel-header">
            <div className="stack-sm">
              <span className="page-kicker">
                <AppIcon name="spark" size={16} />
                {copy.quickTitle}
              </span>
              <h3>{copy.quickTitle}</h3>
              <p className="panel-subtitle">{copy.quickSubtitle}</p>
            </div>
          </div>
          <div className="quick-card-grid">
            {quickCards.map((card) => (
              <button
                key={card.key}
                className="quick-card"
                onClick={() => navigateTo(card.key)}
              >
                <span className="quick-card-icon">
                  <AppIcon name={card.icon} size={18} />
                </span>
                <div className="quick-card-copy">
                  <strong>{card.label}</strong>
                  <p>{card.body}</p>
                </div>
                <span className="quick-card-link">
                  {copy.actionLabel}
                  <AppIcon name="arrowRight" size={16} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )

  return (
    <>
      <div className={`admin-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className="admin-sidebar">
          <div className="sidebar-header">
            <div className="brand-block">
              <div className="brand-mark">TC</div>
              <div className="brand-copy">
                <strong>{t('app.title')}</strong>
                <p>{copy.brandLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              className={`sidebar-toggle-button ${sidebarCollapsed ? 'collapsed' : ''}`}
              aria-label={sidebarCollapsed ? copy.sidebarToggleShow : copy.sidebarToggleHide}
              title={sidebarCollapsed ? copy.sidebarToggleShow : copy.sidebarToggleHide}
            >
              <AppIcon name="arrowRight" size={16} />
            </button>
          </div>

          <nav className="admin-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`nav-button ${currentPage === item.key ? 'active' : ''}`}
                onClick={() => navigateTo(item.key)}
                title={item.label}
              >
                <span className="nav-icon">
                  <AppIcon name={item.icon} size={18} />
                </span>
                <span className="nav-copy">
                  <strong>{item.label}</strong>
                  <small>{copy.navHints[item.key]}</small>
                </span>
              </button>
            ))}
          </nav>

          <button
            type="button"
            className="sidebar-help-button"
            onClick={() => setHelpOpen(true)}
            aria-label={copy.sidebarHelpLabel}
            title={copy.sidebarHelpLabel}
          >
            <span className="sidebar-help-icon" aria-hidden="true">?</span>
            <span className="sidebar-help-copy">
              <strong>{copy.sidebarHelpLabel}</strong>
              <small>{copy.sidebarHelpHint}</small>
            </span>
          </button>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <div className="topbar-copy">
              <span className="page-kicker">{pageMeta.eyebrow}</span>
              <h1>{pageMeta.title}</h1>
              <p>{pageMeta.description}</p>
            </div>

            <div className="topbar-actions">
              <button onClick={toggleLanguage} className="button button-secondary">
                <AppIcon name="globe" size={16} />
                {isZh ? 'English' : '中文'}
              </button>
              <button onClick={onLogout} className="button button-danger">
                <AppIcon name="logout" size={16} />
                {t('nav.logout')}
              </button>
            </div>
          </header>

          <main className="admin-stage">
            {currentPage === 'home' && renderHome()}
            {currentPage === 'users' && (
              <UsersPage accessToken={accessToken} onDataChange={loadOverview} />
            )}
            {currentPage === 'assignments' && (
              <AssignmentsPage accessToken={accessToken} onDataChange={loadOverview} />
            )}
            {currentPage === 'templates' && (
              <TemplatesPage accessToken={accessToken} onDataChange={loadOverview} />
            )}
            {currentPage === 'policies' && (
              <PoliciesPage accessToken={accessToken} onDataChange={loadOverview} />
            )}
            {currentPage === 'neo4j' && (
              <Neo4jPage accessToken={accessToken} browserUrl={neo4jBrowserUrl} />
            )}
            {currentPage === 'audit' && <AuditPage accessToken={accessToken} />}
          </main>
        </div>
      </div>

      {helpOpen ? (
        <div className="help-modal-backdrop" role="presentation" onClick={() => setHelpOpen(false)}>
          <div
            className="help-modal surface"
            role="dialog"
            aria-modal="true"
            aria-labelledby="platform-help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-modal-header">
              <div>
                <span className="page-kicker">{copy.sidebarHelpLabel}</span>
                <h2 id="platform-help-title">{copy.help.title}</h2>
              </div>
              <button
                type="button"
                className="help-modal-close"
                onClick={() => setHelpOpen(false)}
                aria-label={copy.help.close}
              >
                <AppIcon name="close" size={18} />
              </button>
            </div>

            <p className="help-modal-intro">{copy.help.intro}</p>

            <div className="help-section-list">
              {copy.help.sections.map((section) => (
                <section key={section.title} className="help-section">
                  <h3>{section.title}</h3>
                  <p>{section.body}</p>
                </section>
              ))}
            </div>

            <section className="help-notes">
              <h3>{copy.help.notesTitle}</h3>
              <ul>
                {copy.help.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>

            <div className="help-modal-footer">
              <button type="button" className="button button-primary" onClick={() => setHelpOpen(false)}>
                {copy.help.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
