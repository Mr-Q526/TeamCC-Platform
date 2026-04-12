import type { Command } from '../commands.js'
import type { LocalCommandCall } from '../types/command.js'
import {
  getIdentityProfile,
  getTeamCCSessionFailureReason,
  getTeamCCSessionState,
} from '../bootstrap/state.js'
import {
  mapDepartment,
  mapRole,
  mapLevel,
  mapTeam,
  mapOrg,
} from '../utils/identity.js'

const call: LocalCommandCall = async (args, _context) => {
  const arg = args.trim().toLowerCase()

  // /identity - show current identity
  if (!arg) {
    const profile = getIdentityProfile()
    const sessionState = getTeamCCSessionState()
    const failureReason = getTeamCCSessionFailureReason()

    if (!profile) {
      return {
        type: 'text',
        value:
          '当前未建立企业身份。\n\n' +
          `Session State: ${sessionState}\n` +
          (failureReason ? `Reason: ${failureReason}\n\n` : '\n') +
          '请先使用 TeamCC 登录入口完成远端身份鉴权。',
      }
    }

    const parts = [
      `Session State: ${sessionState}`,
      `User ID: ${profile.userId}`,
      `Department: ${mapDepartment(profile.departmentId)}`,
      `Team: ${mapTeam(profile.teamId)}`,
      `Role: ${mapRole(profile.roleId)}`,
      `Level: ${mapLevel(profile.levelId)}`,
      `Project ID: ${profile.projectId}`,
    ]

    if (profile.orgId !== null) {
      parts.unshift(`Org: ${mapOrg(profile.orgId)}`)
    }

    if (sessionState === 'authenticated_restricted') {
      parts.push(
        'Mode: restricted mode（身份已确认，但当前项目权限未加载）',
      )
    }

    return {
      type: 'text',
      value: `Current Identity:\n\n${parts.map((p) => `  ${p}`).join('\n')}`,
    }
  }

  if (arg === 'clear' || arg === 'logout') {
    return {
      type: 'text',
      value:
        '/identity clear 已移除。\n\n请使用 /logout 或 /auth logout 登出 TeamCC 账号。',
    }
  }

  return {
    type: 'text',
    value:
      'Usage:\n' +
      '  /identity         — Show current identity\n' +
      '  /identity clear   — Removed, use /logout\n' +
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
