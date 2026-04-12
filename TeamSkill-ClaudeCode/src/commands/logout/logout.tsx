import * as React from 'react'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { Text } from '../../ink.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import { reportAuditLog } from '../../bootstrap/teamccAudit.js'
import { clearTeamCCRuntimeState } from '../../bootstrap/teamccRuntime.js'
import { gracefulShutdownSync } from '../../utils/gracefulShutdown.js'
import { logoutFromTeamCC } from '../../bootstrap/teamccAuth.js'
import { getTeamCCProjectCacheDir } from '../../utils/teamccPaths.js'

export async function performLogout({
  clearOnboarding: _clearOnboarding = false,
} = {}): Promise<void> {
  await reportAuditLog(
    process.cwd(),
    'logout',
    { reason: 'user_initiated_logout' },
    { refreshToken: false },
  )

  // 1. Wipe TeamCC config
  await logoutFromTeamCC(process.cwd())

  // 2. Erase cached identity and permissions
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const cacheDir = getTeamCCProjectCacheDir(process.cwd())

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
  _onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  await performLogout()
  clearTeamCCRuntimeState(context)

  const message = <Text>已成功登出 TeamCC 账号。</Text>

  setTimeout(() => {
    gracefulShutdownSync(0, 'logout')
  }, 200)

  return message
}
