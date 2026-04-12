import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAuditLogs } from '../api/client'
import AppIcon from '../components/AppIcon'
import '../styles/AuditPage.css'

interface AuditLog {
  id: number
  actorUserId: number | null
  actorUsername: string | null
  action: string
  targetType: string | null
  targetId: number | null
  beforeJson: string | null
  afterJson: string | null
  createdAt: string
}

interface AuditPageProps {
  accessToken: string
}

const PAGE_SIZE = 20
type AuditSeverity = 'info' | 'warning' | 'critical'
type ParsedAuditDetails = Record<string, unknown> & {
  severity?: AuditSeverity
  toolName?: string
  target?: string
  rulePattern?: string
  decision?: string
  command?: string
  commandType?: string
  exitCode?: number
  reason?: string
}

export default function AuditPage({ accessToken }: AuditPageProps) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'

  const copy = isZh
    ? {
        eyebrow: 'Trace Center',
        title: '审计日志',
        subtitle: '追踪关键权限变更，快速确认操作者、对象和前后差异。',
        totalEvents: '累计事件',
        currentPage: '当前页记录',
        accessEvents: '访问事件',
        changedResources: '操作事件',
        securityViolations: '安全违反',
        searchPlaceholder: '搜索操作者、对象类型或目标 ID',
        allActions: '全部动作',
        refresh: '刷新日志',
        loading: '正在读取审计日志...',
        empty: '当前筛选条件下没有审计记录。',
        time: '时间',
        actor: '操作者',
        action: '动作',
        target: '对象',
        details: '详情',
        viewDiff: '查看变更',
        hideDiff: '收起',
        before: '变更前',
        after: '变更后',
        pagination: '共 {{total}} 条 / 第 {{page}} / {{pages}} 页',
        prev: '上一页',
        next: '下一页',
      }
    : {
        eyebrow: 'Trace Center',
        title: 'Audit Log',
        subtitle: 'Track privileged changes and inspect the actor, target, and before/after diff quickly.',
        totalEvents: 'Total events',
        currentPage: 'Rows on page',
        accessEvents: 'Access events',
        changedResources: 'Mutation events',
        securityViolations: 'Security Violations',
        searchPlaceholder: 'Search by actor, target type, or target ID',
        allActions: 'All actions',
        refresh: 'Refresh',
        loading: 'Loading audit trail...',
        empty: 'No audit logs match the current filter.',
        time: 'Time',
        actor: 'Actor',
        action: 'Action',
        target: 'Target',
        details: 'Details',
        viewDiff: 'View diff',
        hideDiff: 'Hide',
        before: 'Before',
        after: 'After',
        pagination: '{{total}} total / page {{page}} of {{pages}}',
        prev: 'Previous',
        next: 'Next',
      }

  const actionLabels = isZh
    ? {
        create: '创建', update: '更新', delete: '删除', login: '登录', logout: '登出',
        boot: '客户端启动', bash_command: '终端命令', file_write: '文件写入',
        command_execution_error: '命令错误', tool_access: '工具访问', policy_violation: '策略违反',
        permission_allow: '已放行工具使用',
        permission_ask: '触发权限确认',
        permission_deny: '尝试使用被禁止的工具',
        exit: '会话退出',
      }
    : {
        create: 'Create', update: 'Update', delete: 'Delete', login: 'Login', logout: 'Logout',
        boot: 'Boot', bash_command: 'Bash Command', file_write: 'File Write',
        command_execution_error: 'Command Error', tool_access: 'Tool Access', policy_violation: 'Policy Violation',
        permission_allow: 'Tool Allowed',
        permission_ask: 'Permission Prompted',
        permission_deny: 'Blocked Tool Attempt',
        exit: 'Session Exit',
      }

  const targetLabels = isZh
    ? {
        user: '员工',
        template: '模板',
        assignment: '授权',
        cli_event: 'CLI 事件',
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
        cli_event: 'CLI Event',
        department_policy: 'Department Policy',
        session: 'Session',
        command: 'Command',
        file: 'File',
        tool: 'Tool',
        policy: 'Policy',
      }

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  const loadLogs = async () => {
    setLoading(true)
    setError('')

    try {
      const data = await getAuditLogs(accessToken, { limit: PAGE_SIZE, offset })
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
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
        const data = await getAuditLogs(accessToken, { limit: PAGE_SIZE, offset })
        if (cancelled) return
        setLogs(data.logs ?? [])
        setTotal(data.total ?? 0)
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
  }, [accessToken, offset])

  const filteredLogs = logs.filter((log) => {
    const matchesAction = actionFilter === 'all' || log.action === actionFilter
    const search = query.trim().toLowerCase()
    if (!matchesAction) return false
    if (!search) return true

    const haystack = [
      log.actorUsername ?? '',
      log.actorUserId ? `user ${log.actorUserId}` : '',
      log.action,
      log.targetType ?? '',
      log.targetId ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(search)
  })

  const parseChange = (before: string | null, after: string | null) => {
    try {
      return {
        before: before ? JSON.parse(before) : null,
        after: after ? JSON.parse(after) : null,
      }
    } catch {
      return { before, after }
    }
  }

  const parseAfterDetails = (log: AuditLog): ParsedAuditDetails => {
    try {
      return (log.afterJson ? JSON.parse(log.afterJson) : {}) as ParsedAuditDetails
    } catch {
      return {}
    }
  }

  const getSeverity = (log: AuditLog): AuditSeverity => {
    const details = parseAfterDetails(log)
    if (log.action === 'policy_violation') return 'critical'
    if (log.action === 'tool_permission_decision') {
      if (details.decision === 'deny') {
        return ['Edit', 'Write', 'Bash', 'WebFetch', 'WebSearch', 'NotebookEdit'].includes(String(details.toolName || ''))
          ? 'critical'
          : 'warning'
      }
      if (details.decision === 'ask') return 'warning'
    }
    return details.severity || 'info'
  }

  const getActionLabel = (log: AuditLog, details: ParsedAuditDetails) => {
    if (log.action === 'tool_permission_decision') {
      if (details.decision === 'allow') return actionLabels.permission_allow
      if (details.decision === 'ask') return actionLabels.permission_ask
      if (details.decision === 'deny') return actionLabels.permission_deny
    }

    return actionLabels[log.action as keyof typeof actionLabels] ?? log.action
  }

  const getTargetLabel = (log: AuditLog) =>
    targetLabels[log.targetType as keyof typeof targetLabels] ?? log.targetType ?? '—'

  const getTargetMeta = (log: AuditLog, details: ParsedAuditDetails) => {
    if (log.targetType === 'tool') return String(details.toolName || details.target || '—')
    if (log.targetType === 'command') return String(details.commandType || details.command || '—')
    if (log.targetType === 'file') return String(details.target || '—')
    if (log.targetType === 'policy') return String(details.rulePattern || details.policy || '—')
    if (log.targetType === 'session') return String(details.sessionId || '—')
    return log.targetId ? `#${log.targetId}` : '—'
  }

  const getDetailSummary = (log: AuditLog, details: ParsedAuditDetails) => {
    switch (log.action) {
      case 'permission_allow':
        return isZh
          ? `${details.toolName || 'Tool'} 已自动放行`
          : `${details.toolName || 'Tool'} was allowed`
      case 'permission_ask':
        return isZh
          ? `${details.toolName || 'Tool'} 触发权限确认`
          : `${details.toolName || 'Tool'} required confirmation`
      case 'permission_deny':
        return isZh
          ? `${details.toolName || 'Tool'} 命中规则 ${details.rulePattern || '—'}`
          : `${details.toolName || 'Tool'} matched ${details.rulePattern || '—'}`
      case 'command_execution_error':
        return String(details.reason || details.error || details.command || '—')
      case 'bash_command':
        return isZh
          ? `${details.commandType || 'command'} · 退出码 ${details.exitCode ?? '—'}`
          : `${details.commandType || 'command'} · exit ${details.exitCode ?? '—'}`
      case 'file_write':
        return String(details.target || details.path || '—')
      case 'policy_violation':
        return String(details.reason || details.policy || details.tool || '—')
      case 'exit':
        return isZh
          ? `退出原因：${details.reason || 'other'}`
          : `Exit reason: ${details.reason || 'other'}`
      case 'tool_permission_decision':
        if (details.decision === 'deny') {
          return isZh
            ? `${details.toolName || 'Tool'} 命中规则 ${details.rulePattern || '—'}`
            : `${details.toolName || 'Tool'} matched ${details.rulePattern || '—'}`
        }
        if (details.decision === 'ask') {
          return isZh
            ? `${details.toolName || 'Tool'} 触发权限确认`
            : `${details.toolName || 'Tool'} required confirmation`
        }
        if (details.decision === 'allow') {
          return isZh
            ? `${details.toolName || 'Tool'} 已自动放行`
            : `${details.toolName || 'Tool'} was allowed`
        }
        return '—'
      default:
        return '—'
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const accessCount = logs.filter((log) =>
    log.action === 'login' || log.action === 'logout' || log.action === 'boot' || log.action === 'exit',
  ).length
  const changeCount = logs.filter((log) =>
    log.action === 'create' || log.action === 'update' || log.action === 'delete' ||
    log.action === 'bash_command' || log.action === 'file_write' ||
    log.action === 'command_execution_error' || log.action === 'tool_access',
  ).length
  const violationCount = logs.filter((log) =>
    log.action === 'policy_violation' ||
    (log.action === 'permission_deny' && getSeverity(log) === 'critical') ||
    (log.action === 'tool_permission_decision' &&
      parseAfterDetails(log).decision === 'deny' &&
      getSeverity(log) === 'critical'),
  ).length

  return (
    <div className="page-stack audit-page">


      <section className="metric-grid">
        <article className="surface metric-card">
          <div className="metric-label">{copy.totalEvents}</div>
          <div className="metric-value">{total}</div>
          <div className="metric-meta">{isZh ? '全量审计轨迹中的记录总数。' : 'All events in the audit trail.'}</div>
        </article>
        <article className="surface metric-card">
          <div className="metric-label">{copy.currentPage}</div>
          <div className="metric-value">{logs.length}</div>
          <div className="metric-meta">{isZh ? '当前分页请求返回的记录数。' : 'Events returned for the current page request.'}</div>
        </article>
        <article className="surface metric-card">
          <div className="metric-label">{copy.accessEvents}</div>
          <div className="metric-value">{accessCount}</div>
          <div className="metric-meta">{isZh ? '登录、登出与客户端启动事件。' : 'Login, logout and boot events on this page.'}</div>
        </article>
        <article className="surface metric-card">
          <div className="metric-label">{copy.changedResources}</div>
          <div className="metric-value">{changeCount}</div>
          <div className="metric-meta">{isZh ? '增删改及终端命令、文件写入等 CLI 操作。' : 'CRUD and CLI operations (bash, file write) on this page.'}</div>
        </article>
        <article className="surface metric-card" style={violationCount > 0 ? { borderLeft: '4px solid #d32f2f' } : {}}>
          <div className="metric-label">{copy.securityViolations}</div>
          <div className="metric-value" style={violationCount > 0 ? { color: '#d32f2f' } : {}}>{violationCount}</div>
          <div className="metric-meta">{isZh ? '策略违反、权限拒绝等安全事件。' : 'Policy violations and security events on this page.'}</div>
        </article>
      </section>

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
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="audit-filter"
            >
              <option value="all">{copy.allActions}</option>
              {Object.entries(actionLabels).map(([action, label]) => (
                <option key={action} value={action}>
                  {label}
                </option>
              ))}
            </select>
            <span className="chip">{filteredLogs.length}</span>
            <button className="button button-secondary button-sm" onClick={loadLogs}>
              <AppIcon name="refresh" size={14} />
              {copy.refresh}
            </button>
          </div>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      <section className="surface audit-table-card">
        {loading ? (
          <div className="loading-state">{copy.loading}</div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">{copy.empty}</div>
        ) : (
          <div className="table-shell">
            <table className="data-table audit-table">
              <thead>
                <tr>
                  <th>{copy.time}</th>
                  <th>{copy.actor}</th>
                  <th>{copy.action}</th>
                  <th>{copy.target}</th>
                  <th>{copy.details}</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const { before, after } = parseChange(log.beforeJson, log.afterJson)
                  const details = parseAfterDetails(log)
                  const isExpanded = expandedId === log.id
                  const severity = getSeverity(log)
                  const isCritical = severity === 'critical'
                  const isWarning = severity === 'warning'
                  const rowStyle = isCritical
                    ? { backgroundColor: 'rgba(211, 47, 47, 0.05)', borderLeft: '3px solid #d32f2f' }
                    : isWarning
                      ? { backgroundColor: 'rgba(217, 138, 44, 0.08)', borderLeft: '3px solid #d97706' }
                      : {}

                  return (
                    <Fragment key={log.id}>
                      <tr className={isExpanded ? 'audit-row-expanded' : ''} style={rowStyle}>
                        <td className="audit-time">
                          {new Date(log.createdAt).toLocaleString(isZh ? 'zh-CN' : 'en-US')}
                        </td>
                        <td>
                          <div className="stack-sm">
                            <strong className="audit-actor">
                              {log.actorUsername ?? `${isZh ? '用户' : 'User'} #${log.actorUserId ?? '?'}`}
                            </strong>
                            <span className="soft">
                              {log.actorUserId ? `ID ${log.actorUserId}` : isZh ? '匿名动作' : 'Anonymous action'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`action-badge tone-${log.action}${isCritical ? ' tone-critical' : ''}`}>
                            {getActionLabel(log, details)}
                          </span>
                        </td>
                        <td>
                          <div className="stack-sm">
                            <strong>
                              {getTargetLabel(log)}
                            </strong>
                            <span className="soft">{getTargetMeta(log, details)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="stack-sm audit-detail-cell">
                            <span className="audit-summary">{getDetailSummary(log, details)}</span>
                          {(before || after) ? (
                            <button
                              className="button button-secondary button-sm"
                              onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            >
                              {isExpanded ? copy.hideDiff : copy.viewDiff}
                            </button>
                          ) : (
                            <span className="soft">—</span>
                          )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="audit-detail-row">
                          <td colSpan={5}>
                            <div className="diff-panel">
                              {before ? (
                                <div className="diff-col diff-before">
                                  <div className="diff-heading">{copy.before}</div>
                                  <pre>{JSON.stringify(before, null, 2)}</pre>
                                </div>
                              ) : null}
                              {after ? (
                                <div className="diff-col diff-after">
                                  <div className="diff-heading">{copy.after}</div>
                                  <pre>{JSON.stringify(after, null, 2)}</pre>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination-bar">
          <span>
            {copy.pagination
              .replace('{{total}}', String(total))
              .replace('{{page}}', String(currentPage))
              .replace('{{pages}}', String(totalPages))}
          </span>
          <div className="toolbar-group">
            <button
              className="button button-secondary button-sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              {copy.prev}
            </button>
            <button
              className="button button-secondary button-sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              {copy.next}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
