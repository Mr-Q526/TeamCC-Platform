import { feature } from 'bun:bundle'
import * as React from 'react'
import { resetCostState } from '../../bootstrap/state.js'
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
      onDone={async success => {
        context.onChangeAPIKey()
        context.setMessages(stripSignatureBlocks)
        if (success) {
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
        onDone(success ? '已成功登录 TeamCC' : '登录已取消')
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
  onDone: (success: boolean) => void
  startingMessage?: string
}): React.ReactNode {
  return (
    <Dialog
      title="TeamCC Login"
      onCancel={() => props.onDone(false)}
      color="permission"
      inputGuide={exitGuide}
      isCancelActive={false}
    >
      <TeamCCLogin onDone={props.onDone} />
    </Dialog>
  )
}