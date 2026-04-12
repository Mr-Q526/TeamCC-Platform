import { getIdentityProfile } from '../../bootstrap/state.js'
import { reportAuditLog } from '../../bootstrap/teamccAudit.js'
import {
  logEvent,
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
} from '../../services/analytics/index.js'
import { logForDebugging } from '../debug.js'
import { getCwd } from '../cwd.js'

export function isEnterprisePermissionSource(source: string): boolean {
  return source === 'policySettings' || source === 'teamccAdmin'
}

export function logPermissionDecision(
  toolName: string,
  decision: 'deny' | 'ask' | 'allow',
  ruleSource: string,
  targetValue: string,
  rulePattern: string,
) {
  const profile = getIdentityProfile()

  logForDebugging(
    `[audit] Logging ${decision} for tool ${toolName} on target ${targetValue}${profile ? ` (profile department=${profile.departmentId})` : ''}`,
  )

  if (profile) {
    logEvent('tool_permission_decision', {
      user_id: profile.userId,
      department_id: profile.departmentId,
      project_id: profile.projectId,
      tool_name: toolName as unknown as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      decision: decision as unknown as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      rule_source: ruleSource as unknown as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      blocked_target: targetValue as unknown as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      rule_pattern: rulePattern as unknown as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
  }

  void reportAuditLog(getCwd(), 'tool_permission_decision', {
    toolName,
    decision,
    ruleSource,
    rulePattern,
    target: targetValue,
  })
}
