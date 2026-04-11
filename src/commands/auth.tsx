import type { Command } from '../commands.js'
import type { LocalCommandCall } from '../types/command.js'
import { getIdentityProfile } from '../bootstrap/state.js'
import { mapDepartment, mapRole, mapLevel, mapTeam } from '../utils/identity.js'

const call: LocalCommandCall = async (args, context) => {
  const arg = args.trim().toLowerCase()

  // Import required modules
  const { loginToTeamCC, saveTeamCCConfig, loadTeamCCConfig, logoutFromTeamCC } =
    await import('../bootstrap/teamccAuth.js')
  const { getCwd } = await import('../utils/cwd.js')
  const { loadAndMergeAllPermissionRules } =
    await import('../utils/permissions/teamccIntegration.js')
  const { logForDebugging } = await import('../utils/debug.js')

  const cwd = getCwd()
  const apiBase = process.env.TEAMCC_ADMIN_URL || 'http://localhost:3000'

  // Check if user wants to logout
  if (arg === 'logout' || arg === 'clear') {
    try {
      await logoutFromTeamCC(cwd)
      return {
        type: 'text',
        value: '✓ Logged out.\n\nRestart Claude Code to apply changes.',
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
      const config = await loadTeamCCConfig(cwd)
      if (!config?.accessToken) {
        return {
          type: 'text',
          value: '❌ Not logged in.\n\nRun: /auth\nto authenticate first.',
        }
      }

      // Reload permissions
      const merged = await loadAndMergeAllPermissionRules(1)
      return {
        type: 'text',
        value: `✓ Permissions refreshed\n\n${merged.length} rules loaded from all sources`,
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

      if (!config?.accessToken && !identity) {
        return {
          type: 'text',
          value:
            '❌ Not authenticated\n\n' +
            'Run: /auth\n' +
            'to login with TeamCC Admin platform.',
        }
      }

      let status = '✅ Authenticated\n\n'

      if (identity) {
        status += `👤 Identity:\n`
        status += `   User ID: ${identity.userId}\n`
        status += `   Department: ${mapDepartment(identity.departmentId)}\n`
        status += `   Team: ${mapTeam(identity.teamId)}\n`
        status += `   Role: ${mapRole(identity.roleId)}\n`
        status += `   Level: ${mapLevel(identity.levelId)}\n\n`
      }

      if (config?.accessToken) {
        status += `🔐 Configuration:\n`
        status += `   API: ${config.apiBase}\n`
        if (config.username) {
          status += `   User: ${config.username}\n`
        }
        if (config.tokenExpiry) {
          const expiresAt = new Date(config.tokenExpiry)
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
    const isLoggedIn = !!config?.accessToken

    if (isLoggedIn) {
      return {
        type: 'text',
        value:
          '✅ You are logged in to TeamCC Admin\n\n' +
          'Commands:\n' +
          '  /auth status              Show login status\n' +
          '  /auth refresh             Refresh permission rules\n' +
          '  /auth logout              Logout\n' +
          '\nOr run /auth with username/password to login as different user',
      }
    }

    return {
      type: 'text',
      value:
        '❌ Not logged in\n\n' +
        'Commands:\n' +
        '  /auth                     Login with username/password\n' +
        '  /auth status              Show login status\n' +
        '  /auth help                Show this help\n\n' +
        `API Base: ${apiBase}`,
    }
  }

  // Login with username/password
  return {
    type: 'interactive',
    fields: [
      {
        name: 'username',
        label: 'Username',
        type: 'text',
      },
      {
        name: 'password',
        label: 'Password',
        type: 'password',
      },
    ],
    async onSubmit(values) {
      try {
        const { username, password } = values

        logForDebugging(`[auth] Attempting login for user: ${username}`)

        // Attempt login
        const { tokens, config: newConfig } = await loginToTeamCC(
          username,
          password,
          apiBase,
        )

        // Save config
        await saveTeamCCConfig(cwd, newConfig)
        logForDebugging(`[auth] Login successful, config saved`)

        // Reload permissions
        const merged = await loadAndMergeAllPermissionRules(1)
        logForDebugging(`[auth] Loaded ${merged.length} permission rules`)

        return {
          type: 'text',
          value:
            `✅ Login successful!\n\n` +
            `Welcome ${username}!\n` +
            `Token expires in ${Math.round(tokens.expiresIn / 60)} minutes\n` +
            `Loaded ${merged.length} permission rules\n\n` +
            `💾 Credentials saved. Your identity will be automatically\n` +
            `   loaded on the next startup.`,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logForDebugging(`[auth] Login failed: ${message}`)

        return {
          type: 'text',
          value:
            `❌ Login failed: ${message}\n\n` +
            `Please check:\n` +
            `  1. TeamCC Admin is running (${apiBase})\n` +
            `  2. Username and password are correct\n` +
            `  3. Network connection is available\n\n` +
            `Try again: /auth`,
        }
      }
    },
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
