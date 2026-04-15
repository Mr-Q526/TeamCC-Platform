import { feature } from 'bun:bundle'
import * as React from 'react'
import { reportAuditLog } from '../../bootstrap/teamccAudit.js'
import { resetCostState } from '../../bootstrap/state.js'
import { applyTeamCCSessionToRuntime } from '../../bootstrap/teamccRuntime.js'
import {
  clearTrustedDeviceToken,
  enrollTrustedDevice,
} from '../../bridge/trustedDevice.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { Text } from '../../ink.js'
import { refreshGrowthBookAfterAuthChange } from '../../services/analytics/growthbook.js'
import { refreshPolicyLimits } from '../../services/policyLimits/index.js'
import { refreshRemoteManagedSettings } from '../../services/remoteManagedSettings/index.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { gracefulShutdownSync } from '../../utils/gracefulShutdown.js'
import { stripSignatureBlocks } from '../../utils/messages.js'
import { getCwd } from '../../utils/cwd.js'
import {
  checkAndDisableAutoModeIfNeeded,
  checkAndDisableBypassPermissionsIfNeeded,
  resetAutoModeGateCheck,
  resetBypassPermissionsCheck,
} from '../../utils/permissions/bypassPermissionsKillswitch.js'
import { resetUserCache } from '../../utils/user.js'
import { TeamCCLogin } from './teamccLogin.js'

export async function applySuccessfulTeamCCLogin(
  context: LocalJSXCommandContext,
  session: import('../../bootstrap/teamccSession.js').TeamCCBootstrapResult,
): Promise<void> {
  applyTeamCCSessionToRuntime(context, session)
  void reportAuditLog(getCwd(), 'login', {
    status: session.status,
    warning: session.warning,
    failureReason: session.failureReason,
    projectId: session.identityProfile?.projectId,
  })
  resetCostState()
  void refreshRemoteManagedSettings()
  void refreshPolicyLimits()
  resetUserCache()
  refreshGrowthBookAfterAuthChange()
  clearTrustedDeviceToken()
  void enrollTrustedDevice()
  resetBypassPermissionsCheck()

  const appState = context.getAppState()
  void checkAndDisableBypassPermissionsIfNeeded(
    appState.toolPermissionContext,
    context.setAppState,
  )
  if (feature('TRANSCRIPT_CLASSIFIER')) {
    resetAutoModeGateCheck()
    void checkAndDisableAutoModeIfNeeded(
      appState.toolPermissionContext,
      context.setAppState,
      appState.fastMode,
    )
  }

  context.setAppState(prev => ({
    ...prev,
    authVersion: prev.authVersion + 1,
  }))
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return (
    <Login
      onDone={async ({ success, session }) => {
        context.onChangeAPIKey()
        context.setMessages(stripSignatureBlocks)
        if (success) {
          if (!session) {
            onDone('登录失败：缺少 TeamCC 会话结果')
            return
          }

          await applySuccessfulTeamCCLogin(context, session)
          delete process.env.TEAMCC_LOGIN_ENTRYPOINT
        }
        const successMessage =
          success && session?.status === 'authenticated_restricted'
            ? '已成功登录 TeamCC，但当前项目权限未加载，处于 restricted mode'
            : '已成功登录 TeamCC'
        onDone(success ? successMessage : '登录已取消')

        if (!success && process.env.TEAMCC_LOGIN_ENTRYPOINT === '1') {
          setTimeout(() => {
            gracefulShutdownSync(1, 'login_cancelled')
          }, 200)
        }
      }}
    />
  )
}

function exitGuide(exitState: any) {
  return exitState.pending ? (
    <Text>Press {exitState.keyName} again to exit</Text>
  ) : (
    <ConfigurableShortcutHint
      action="confirm:no"
      context="Confirmation"
      fallback="Esc"
      description="取消"
    />
  )
}

export function Login(props: {
  onDone: (result: {
    success: boolean
    session?: import('../../bootstrap/teamccSession.js').TeamCCBootstrapResult
  }) => void
  startingMessage?: string
}): React.ReactNode {
  return (
    <Dialog
      title="TeamCC Login"
      onCancel={() => props.onDone({ success: false })}
      color="permission"
      inputGuide={exitGuide}
      isCancelActive={false}
    >
      {props.startingMessage ? <Text>{props.startingMessage}</Text> : null}
      <TeamCCLogin onDone={props.onDone} />
    </Dialog>
  )
}
