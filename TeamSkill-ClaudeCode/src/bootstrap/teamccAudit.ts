/**
 * TeamCC Security Audit Trail Module
 *
 * Provides non-blocking telemetry to the TeamCC Admin backend for sensitive operations.
 */
import { getSessionId } from '../bootstrap/state.js'
import { logForDebugging } from '../utils/debug.js'
import { loadTeamCCConfig, getPersistedValidAccessToken } from './teamccAuth.js'
import { getIdentityProfile } from './state.js'

export type AuditEventType =
  | 'boot'
  | 'login'
  | 'logout'
  | 'exit'
  | 'bash_command'
  | 'file_write'
  | 'command_execution_error'
  | 'permission_allow'
  | 'permission_ask'
  | 'permission_deny'
  | 'policy_violation'

export type AuditTargetType =
  | 'session'
  | 'command'
  | 'file'
  | 'tool'
  | 'policy'

export type AuditSeverity = 'info' | 'warning' | 'critical'

function getTeamCCSessionStatus(hasConfig: boolean, hasToken: boolean, hasIdentity: boolean): string {
  if (hasToken && hasIdentity) return 'authenticated_scoped'
  if (hasToken) return 'authenticated_unscoped'
  if (hasConfig) return 'configured_unauthed'
  return 'disabled'
}

export async function reportAuditLog(
  cwd: string,
  eventType: AuditEventType,
  targetType: AuditTargetType,
  payload: Record<string, unknown>,
  severity?: AuditSeverity,
): Promise<void> {
  try {
    const config = await loadTeamCCConfig(cwd)
    if (!config || !config.apiBase) return

    // Enrich with current runtime identity only.
    const identity = getIdentityProfile()
    // Attempt to grab token securely
    let token = config.accessToken
    if (token) {
      try {
        const validTokenObj = await getPersistedValidAccessToken(cwd, config)
        token = validTokenObj.token
      } catch {
        // Token might be expired and refresh failed, keep best-effort token
      }
    }

    const auditData = {
      timestamp: new Date().toISOString(),
      userId: identity?.userId ?? 0,
      departmentId: identity?.departmentId ?? 0,
      eventType,
      targetType,
      severity,
      details: {
        sessionId: getSessionId(),
        projectId: identity?.projectId ?? null,
        teamccSessionStatus: getTeamCCSessionStatus(!!config, !!token, !!identity),
        ...payload,
      },
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Fire and forget, don't await the fetch so it doesn't block the AI
    fetch(`${config.apiBase}/api/audit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(auditData),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          logForDebugging(
            `[teamcc-audit] Backend rejected audit log: ${res.status} ${text}`,
            { level: 'error' },
          )
        } else {
          logForDebugging(
            `[teamcc-audit] Successfully submitted audit log for event ${eventType}`,
          )
        }
      })
      .catch((e) => {
        // Quietly swallow network errors to prevent interrupting user workflows
        logForDebugging(
          `[teamcc-audit] Failed to send audit log: ${(e as Error).message}`,
          { level: 'error' },
        )
      })
  } catch (error) {
    // Top level swallow to prevent breaking normal execution flows
    logForDebugging(
      `[teamcc-audit] Internal error during audit reporting: ${(error as Error).message}`,
      { level: 'error' },
    )
  }
}
