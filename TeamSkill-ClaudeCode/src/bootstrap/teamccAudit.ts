/**
 * TeamCC Security Audit Trail Module
 * 
 * Provides non-blocking telemetry to the TeamCC Admin backend for sensitive operations.
 */
import { logForDebugging } from '../utils/debug.js'
import type { TeamCCConfig } from './teamccAuth.js'
import { loadTeamCCConfig, getPersistedValidAccessToken } from './teamccAuth.js'
import {
  getIdentityProfile,
  getSessionId,
  getTeamCCSessionFailureReason,
  getTeamCCSessionState,
} from './state.js'

export type AuditEventType =
  | 'boot'
  | 'login'
  | 'logout'
  | 'exit'
  | 'bash_command'
  | 'file_write'
  | 'tool_permission_decision'

type AuditOptions = {
  allowCachedConfigFallback?: boolean
  refreshToken?: boolean
}

type AuditIdentitySnapshot = {
  userId: number
  departmentId: number
  projectId: number
}

let lastKnownAuditConfig: TeamCCConfig | null = null
let lastKnownAuditIdentity: AuditIdentitySnapshot | null = null

function rememberAuditConfig(config: TeamCCConfig | null): void {
  if (!config?.apiBase) {
    return
  }

  lastKnownAuditConfig = {
    apiBase: config.apiBase,
    username: config.username,
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
    tokenExpiry: config.tokenExpiry,
    configPath: config.configPath,
    configSource: config.configSource,
  }
}

function rememberAuditIdentity(identity: ReturnType<typeof getIdentityProfile>): void {
  if (!identity) {
    return
  }

  lastKnownAuditIdentity = {
    userId: identity.userId,
    departmentId: identity.departmentId,
    projectId: identity.projectId,
  }
}

export async function reportAuditLog(
  cwd: string,
  eventType: AuditEventType,
  payload: Record<string, unknown>,
  options: AuditOptions = {},
): Promise<void> {
  try {
    const loadedConfig = await loadTeamCCConfig(cwd)
    const config =
      loadedConfig?.apiBase
        ? loadedConfig
        : options.allowCachedConfigFallback
          ? lastKnownAuditConfig
          : null
    if (!config || !config.apiBase) return
    rememberAuditConfig(config)

    // Enrich with current runtime identity and retain the last verified snapshot
    // so exit-after-logout can still be attributed.
    const identity = getIdentityProfile()
    rememberAuditIdentity(identity)
    const effectiveIdentity =
      identity ??
      (options.allowCachedConfigFallback ? lastKnownAuditIdentity : null)
    const sessionId = getSessionId()
    const teamccSessionStatus = getTeamCCSessionState()
    const teamccSessionFailureReason = getTeamCCSessionFailureReason()
    
    // Attempt to grab token securely
    let token = config.accessToken
    if (token && options.refreshToken !== false) {
      try {
        const validTokenObj = await getPersistedValidAccessToken(cwd, config)
        token = validTokenObj.token
        rememberAuditConfig(validTokenObj.updatedConfig)
      } catch {
        // Token might be expired and refresh failed, keep best-effort token
      }
    }

    const auditData = {
      timestamp: new Date().toISOString(),
      userId: effectiveIdentity?.userId,
      departmentId: effectiveIdentity?.departmentId,
      projectId: effectiveIdentity?.projectId,
      sessionId,
      eventType,
      details: {
        sessionId,
        projectId: effectiveIdentity?.projectId,
        teamccSessionStatus,
        ...(teamccSessionFailureReason && {
          teamccSessionFailureReason,
        }),
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
        const text = await res.text();
        logForDebugging(`[teamcc-audit] Backend rejected audit log: ${res.status} ${text}`, { level: 'error' })
      } else {
        logForDebugging(`[teamcc-audit] Successfully submitted audit log for event ${eventType}`);
      }
    })
    .catch((e) => {
      // Quietly swallow network errors to prevent interrupting user workflows
      logForDebugging(`[teamcc-audit] Failed to send audit log: ${(e as Error).message}`, { level: 'error' })
    })

  } catch (error) {
    // Top level swallow to prevent breaking normal execution flows
    logForDebugging(`[teamcc-audit] Internal error during audit reporting: ${(error as Error).message}`, { level: 'error' })
  }
}
