import type { PermissionRule } from '../types/permissions.js'
import { cacheIdentity, fetchIdentityFromTeamCC, loadTeamCCConfig } from './teamccAuth.js'
import { logForDebugging } from '../utils/debug.js'
import {
  envelopeToProfile,
  type IdentityProfile,
} from '../utils/identity.js'
import {
  bundleToRules,
  fetchPermissionBundleFromTeamCC,
} from '../utils/permissions/teamccLoader.js'

export type TeamCCSessionStatus =
  | 'unauthenticated'
  | 'authenticated_scoped'
  | 'authenticated_restricted'

export const TEAMCC_RESTRICTED_MODE_MESSAGE =
  '身份已确认，但当前项目权限未加载，处于 restricted mode。'

type TeamCCBootstrapBase = {
  status: TeamCCSessionStatus
  identityProfile: IdentityProfile | null
  permissionRules: PermissionRule[]
  failureReason: string | null
  warning: string | null
}

export type TeamCCBootstrapResult =
  | (TeamCCBootstrapBase & {
      status: 'unauthenticated'
      identityProfile: null
      permissionRules: []
    })
  | (TeamCCBootstrapBase & {
      status: 'authenticated_scoped'
      identityProfile: IdentityProfile
    })
  | (TeamCCBootstrapBase & {
      status: 'authenticated_restricted'
      identityProfile: IdentityProfile
      permissionRules: []
    })

export function isTeamCCAuthEntrypoint(argv: string[] = process.argv): boolean {
  const authCommands = new Set(['auth', 'login', 'logout'])
  return argv.some(arg => authCommands.has(arg))
}

export function getTeamCCLoginRequiredMessage(reason?: string | null): string {
  const detail = reason ? `\n原因: ${reason}` : ''
  return `❌ TeamCC 身份鉴权未通过，无法进入企业运行态。${detail}\n请先使用 TeamCC 登录入口（login/auth）完成认证。`
}

export async function bootstrapTeamCCSession(
  cwd: string,
): Promise<TeamCCBootstrapResult> {
  const config = await loadTeamCCConfig(cwd)

  if (!config?.apiBase) {
    return {
      status: 'unauthenticated',
      identityProfile: null,
      permissionRules: [],
      failureReason: '未检测到 TeamCC 配置。',
      warning: null,
    }
  }

  if (!config.accessToken) {
    return {
      status: 'unauthenticated',
      identityProfile: null,
      permissionRules: [],
      failureReason: '未检测到有效的 TeamCC 登录态。',
      warning: null,
    }
  }

  try {
    const envelope = await fetchIdentityFromTeamCC(cwd, config)
    await cacheIdentity(cwd, envelope)

    const identityProfile = envelopeToProfile(envelope)
    const projectId = identityProfile.projectId ?? 1

    try {
      const bundle = await fetchPermissionBundleFromTeamCC(
        cwd,
        config,
        projectId,
        { throwOnFailure: true },
      )

      if (!bundle) {
        return {
          status: 'authenticated_restricted',
          identityProfile,
          permissionRules: [],
          failureReason: 'Permission bundle was empty.',
          warning: TEAMCC_RESTRICTED_MODE_MESSAGE,
        }
      }

      return {
        status: 'authenticated_scoped',
        identityProfile,
        permissionRules: bundleToRules(bundle),
        failureReason: null,
        warning: null,
      }
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : String(error)
      logForDebugging(
        `[teamcc-session] Permission bundle unavailable: ${failureReason}`,
        { level: 'warn' },
      )

      return {
        status: 'authenticated_restricted',
        identityProfile,
        permissionRules: [],
        failureReason,
        warning: TEAMCC_RESTRICTED_MODE_MESSAGE,
      }
    }
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error)
    logForDebugging(`[teamcc-session] Identity verification failed: ${failureReason}`, {
      level: 'warn',
    })

    return {
      status: 'unauthenticated',
      identityProfile: null,
      permissionRules: [],
      failureReason,
      warning: null,
    }
  }
}
