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
import { stripSignatureBlocks } from '../../utils/messages.js'
import {
  checkAndDisableAutoModeIfNeeded,
  checkAndDisableBypassPermissionsIfNeeded,
  resetAutoModeGateCheck,
  resetBypassPermissionsCheck,
} from '../../utils/permissions/bypassPermissionsKillswitch.js'
import { resetUserCache } from '../../utils/user.js'
import { TeamCCLogin } from './teamccLogin.js'

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

          applyTeamCCSessionToRuntime(context, session)
          void reportAuditLog(process.cwd(), 'login', {
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
        const successMessage =
          success && session?.status === 'authenticated_restricted'
            ? '已成功登录 TeamCC，但当前项目权限未加载，处于 restricted mode'
            : '已成功登录 TeamCC'
        onDone(success ? successMessage : '登录已取消')
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
      <TeamCCLogin onDone={props.onDone} />
    </Dialog>
  )
}
