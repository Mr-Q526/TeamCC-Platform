import type { Command } from '../commands.js'
import type { LocalCommandCall } from '../types/command.js'
import { getIdentityProfile } from '../bootstrap/state.js'
import {
  mapDepartment,
  mapRole,
  mapLevel,
  mapTeam,
  mapOrg,
} from '../utils/identity.js'

const call: LocalCommandCall = async (args, context) => {
  const arg = args.trim().toLowerCase()

  // /identity - show current identity
  if (!arg) {
    const profile = getIdentityProfile()

    if (!profile) {
      return {
        type: 'text',
        value:
          'No identity configured.\n\n' +
          'Identity can be loaded from:\n' +
          '1. TeamCC Admin (remote) — requires running teamcc-admin and login\n' +
          '2. Local file — .claude/identity/active.md\n\n' +
          'To authenticate with TeamCC Admin, follow these steps:\n' +
          '  1. Start teamcc-admin: cd /Users/minruiqing/MyProjects/teamcc-admin && npm run dev\n' +
          '  2. In another terminal: TEAMCC_ADMIN_URL=http://localhost:3000 claude-code [project-dir]\n' +
          '\n' +
          'Or edit .claude/identity/active.md with your identity information.',
      }
    }

    const parts = [
      `User ID: ${profile.userId}`,
      `Department: ${mapDepartment(profile.departmentId, profile.departmentLabel)}`,
      `Team: ${mapTeam(profile.teamId, profile.teamLabel)}`,
      `Role: ${mapRole(profile.roleId, profile.roleLabel)}`,
      `Level: ${mapLevel(profile.levelId, profile.levelLabel)}`,
      `Project ID: ${profile.projectId}`,
    ]

    if (profile.orgId !== null) {
      parts.unshift(`Org: ${mapOrg(profile.orgId, profile.orgLabel)}`)
    }

    return {
      type: 'text',
      value: `Current Identity:\n\n${parts.map((p) => `  ${p}`).join('\n')}`,
    }
  }

  // /identity clear - remove identity
  if (arg === 'clear' || arg === 'logout') {
    context.setAppState((s) => {
      const newState = { ...s }
      // Note: we can't directly modify identity here, but we can clear it via setIdentityProfile
      return newState
    })

    return {
      type: 'text',
      value:
        'Identity cleared. Restart Claude Code to reload identity from local file or TeamCC Admin.',
    }
  }

  return {
    type: 'text',
    value:
      'Usage:\n' +
      '  /identity         — Show current identity\n' +
      '  /identity clear   — Clear identity\n' +
      '  /identity logout  — Alias for clear',
  }
}

const identity = {
  type: 'local',
  name: 'identity',
  description: 'View and manage identity information',
  argumentHint: '[clear|logout]',
  isEnabled: () => true,
  supportsNonInteractive: true,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default identity
