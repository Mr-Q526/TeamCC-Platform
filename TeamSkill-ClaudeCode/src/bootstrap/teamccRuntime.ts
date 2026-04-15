import type { ToolUseContext } from '../Tool.js'
import { clearContextCaches } from '../context.js'
import type { TeamCCBootstrapResult } from './teamccSession.js'
import {
  applyTeamCCSessionToPermissionContext,
  clearTeamCCRulesFromPermissionContext,
} from '../utils/permissions/permissionSetup.js'
import { setIdentityProfile, setTeamCCSessionState } from './state.js'

type TeamCCRuntimeContext = Pick<ToolUseContext, 'getAppState' | 'setAppState'>

export function applyTeamCCSessionToRuntime(
  context: TeamCCRuntimeContext,
  session: TeamCCBootstrapResult,
): void {
  setIdentityProfile(session.identityProfile)
  setTeamCCSessionState(session.status, session.failureReason)
  clearContextCaches()

  context.setAppState(prev => ({
    ...prev,
    toolPermissionContext: applyTeamCCSessionToPermissionContext(
      prev.toolPermissionContext,
      session,
    ),
  }))
}

export function clearTeamCCRuntimeState(
  context: TeamCCRuntimeContext,
  failureReason: string | null = null,
): void {
  setIdentityProfile(null)
  setTeamCCSessionState('unauthenticated', failureReason)
  clearContextCaches()

  context.setAppState(prev => ({
    ...prev,
    toolPermissionContext: clearTeamCCRulesFromPermissionContext(
      prev.toolPermissionContext,
    ),
  }))
}
