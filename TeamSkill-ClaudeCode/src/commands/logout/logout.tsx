import * as React from 'react'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import { reportAuditLog } from '../../bootstrap/teamccAudit.js'
import { clearTeamCCRuntimeState } from '../../bootstrap/teamccRuntime.js'
import { gracefulShutdownSync } from '../../utils/gracefulShutdown.js'
import { logoutFromTeamCC } from '../../bootstrap/teamccAuth.js'
import { stripSignatureBlocks } from '../../utils/messages.js'
import { getCwd } from '../../utils/cwd.js'
import { getTeamCCProjectCacheDir } from '../../utils/teamccPaths.js'
import { Login, applySuccessfulTeamCCLogin } from '../login/login.js'

export async function performLogout({
  clearOnboarding: _clearOnboarding = false,
} = {}): Promise<void> {
  const cwd = getCwd()
  await reportAuditLog(
    cwd,
    'logout',
    { reason: 'user_initiated_logout' },
    { refreshToken: false },
  )

  // 1. Wipe TeamCC config
  await logoutFromTeamCC(cwd)

  // 2. Erase cached identity and permissions
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const cacheDir = getTeamCCProjectCacheDir(cwd)

    const files = await fs.readdir(cacheDir)
    for (const file of files) {
      if (file === 'identity.json' || file.startsWith('permission-bundle-')) {
        await fs.unlink(path.join(cacheDir, file))
      }
    }
  } catch {
    // Ignore if cache dir doesn't exist or other io error
  }
}

// Kept for signature compatibility if it's imported elsewhere
export async function clearAuthRelatedCaches(): Promise<void> {
  // No-op for TeamCC
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  await performLogout()
  clearTeamCCRuntimeState(context)

  return (
    <Login
      startingMessage="已成功登出 TeamCC 账号，请重新登录。"
      onDone={async ({ success, session }) => {
        if (success) {
          if (!session) {
            onDone('重新登录失败：缺少 TeamCC 会话结果')
            return
          }

          context.onChangeAPIKey()
          context.setMessages(stripSignatureBlocks)
          await applySuccessfulTeamCCLogin(context, session)
          const successMessage =
            session.status === 'authenticated_restricted'
              ? '已重新登录 TeamCC，但当前项目权限未加载，处于 restricted mode'
              : '已重新登录 TeamCC'
          onDone(successMessage)
          return
        }

        onDone('登录已取消，已退出 TeamCC。')
        setTimeout(() => {
          gracefulShutdownSync(0, 'logout')
        }, 200)
      }}
    />
  )
}
