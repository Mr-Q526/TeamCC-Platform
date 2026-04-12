import type { Command } from '../commands.js'
import type { LocalCommandCall } from '../types/command.js'
import {
  getIdentityProfile,
  getTeamCCSessionFailureReason,
  getTeamCCSessionState,
} from '../bootstrap/state.js'
import {
  applyTeamCCSessionToRuntime,
  clearTeamCCRuntimeState,
} from '../bootstrap/teamccRuntime.js'
import {
  bootstrapTeamCCSession,
  TEAMCC_RESTRICTED_MODE_MESSAGE,
} from '../bootstrap/teamccSession.js'
import { mapDepartment, mapRole, mapLevel, mapTeam } from '../utils/identity.js'

const call: LocalCommandCall = async (args, context) => {
  const arg = args.trim().toLowerCase()

  // Import required modules
  const { loadTeamCCConfig } = await import('../bootstrap/teamccAuth.js')
  const { getCwd } = await import('../utils/cwd.js')

  const cwd = getCwd()
  const apiBase = process.env.TEAMCC_ADMIN_URL || 'http://localhost:3000'

  // Check if user wants to logout
  if (arg === 'logout' || arg === 'clear') {
    try {
      const { performLogout } = await import('./logout/logout.js')
      await performLogout()
      clearTeamCCRuntimeState(context)
      context.setAppState(prev => ({
        ...prev,
        authVersion: prev.authVersion + 1,
      }))
      return {
        type: 'text',
        value: '✓ Logged out.\n\n当前 runtime 身份与 TeamCC 权限已清空。',
      }
    } catch (e) {
      return {
        type: 'text',
        value: `Failed to logout: ${(e as Error).message}`,
      }
    }
  }

  // Check if user wants to refresh permissions
  if (arg === 'refresh-perms' || arg === 'refresh') {
    try {
      const session = await bootstrapTeamCCSession(cwd)
      if (session.status === 'unauthenticated') {
        clearTeamCCRuntimeState(context, session.failureReason)
        return {
          type: 'text',
          value: '❌ Not logged in.\n\nRun: /auth\nto authenticate first.',
        }
      }

      applyTeamCCSessionToRuntime(context, session)
      context.setAppState(prev => ({
        ...prev,
        authVersion: prev.authVersion + 1,
      }))

      const modeLine =
        session.status === 'authenticated_restricted'
          ? `\n\n${TEAMCC_RESTRICTED_MODE_MESSAGE}`
          : ''
      return {
        type: 'text',
        value: `✓ TeamCC session refreshed\n\n${session.permissionRules.length} TeamCC rules loaded${modeLine}`,
      }
    } catch (e) {
      return {
        type: 'text',
        value: `Failed to refresh permissions: ${(e as Error).message}`,
      }
    }
  }

  // Check current status
  if (arg === 'status') {
    try {
      const config = await loadTeamCCConfig(cwd)
      const identity = getIdentityProfile()
      const sessionState = getTeamCCSessionState()
      const failureReason = getTeamCCSessionFailureReason()

      if (!config?.accessToken && !identity) {
        return {
          type: 'text',
          value:
            '❌ Not authenticated\n\n' +
            'Run: /auth\n' +
            'to login with TeamCC Admin platform.',
        }
      }

      let status =
        sessionState === 'unauthenticated'
          ? '❌ Not authenticated\n\n'
          : '✅ Authenticated\n\n'
      status += `🧭 Session:\n`
      status += `   State: ${sessionState}\n`
      if (failureReason) {
        status += `   Reason: ${failureReason}\n`
      }
      status += '\n'

      if (identity) {
        status += `👤 Identity:\n`
        status += `   User ID: ${identity.userId}\n`
        status += `   Department: ${mapDepartment(identity.departmentId, identity.departmentLabel)}\n`
        status += `   Team: ${mapTeam(identity.teamId, identity.teamLabel)}\n`
        status += `   Role: ${mapRole(identity.roleId, identity.roleLabel)}\n`
        status += `   Level: ${mapLevel(identity.levelId, identity.levelLabel)}\n\n`
      }

      if (config?.accessToken) {
        status += `🔐 Configuration:\n`
        status += `   API: ${config.apiBase}\n`
        if (config.username) {
          status += `   User: ${config.username}\n`
        }
        if (config.tokenExpiry) {
          const minutesLeft = Math.round(
            (config.tokenExpiry - Date.now()) / 60000,
          )
          const timeStr =
            minutesLeft > 60
              ? `${Math.round(minutesLeft / 60)}h`
              : `${minutesLeft}m`
          status += `   Token expires: ${timeStr} left\n`
        }
      }

      if (sessionState === 'authenticated_restricted') {
        status += `\n⚠️ ${TEAMCC_RESTRICTED_MODE_MESSAGE}\n`
      }

      return { type: 'text', value: status }
    } catch (e) {
      return {
        type: 'text',
        value: `Error checking status: ${(e as Error).message}`,
      }
    }
  }

  // Show help
  if (arg === 'help' || arg === '') {
    const config = await loadTeamCCConfig(cwd)
    const isLoggedIn =
      getTeamCCSessionState() !== 'unauthenticated' || !!config?.accessToken

    if (isLoggedIn) {
      return {
        type: 'text',
        value:
          '✅ You are logged in to TeamCC Admin\n\n' +
          'Commands:\n' +
          '  /auth status              Show login status\n' +
          '  /auth refresh             Refresh permission rules\n' +
          '  /auth logout              Logout\n' +
          '\nUse /login to authenticate again as a different TeamCC user.',
      }
    }

    return {
      type: 'text',
      value:
        '❌ Not logged in\n\n' +
        'Commands:\n' +
        '  /login                    Login with TeamCC credentials\n' +
        '  /auth status              Show login status\n' +
        '  /auth help                Show this help\n\n' +
        `API Base: ${apiBase}`,
    }
  }

  return {
    type: 'text',
    value:
      'Use /login to authenticate with TeamCC credentials.\n\n' +
      'The /auth command is reserved for status, refresh, and logout operations.',
  }
}

const auth = {
  type: 'local',
  name: 'auth',
  description: 'Authenticate with TeamCC Admin platform',
  argumentHint: '[status|logout|refresh|help]',
  isEnabled: () => true,
  supportsNonInteractive: false,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default auth
