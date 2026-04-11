import * as React from 'react'
import { Text } from '../../ink.js'
import { gracefulShutdownSync } from '../../utils/gracefulShutdown.js'
import { logoutFromTeamCC } from '../../bootstrap/teamccAuth.js'
import { getTeamCCProjectCacheDir } from '../../utils/teamccPaths.js'

export async function performLogout({
  clearOnboarding = false,
} = {}): Promise<void> {
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
  } catch (e) {
    // Ignore if cache dir doesn't exist or other io error
  }
}

// Kept for signature compatibility if it's imported elsewhere
export async function clearAuthRelatedCaches(): Promise<void> {
  // No-op for TeamCC
}

export async function call(): Promise<React.ReactNode> {
  await performLogout()

  const message = <Text>已成功登出 TeamCC 账号。</Text>

  setTimeout(() => {
    gracefulShutdownSync(0, 'logout')
  }, 200)

  return message
}
