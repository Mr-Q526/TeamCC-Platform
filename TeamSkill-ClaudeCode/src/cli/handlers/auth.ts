import {
  logoutFromTeamCC,
  loginToTeamCC,
  saveTeamCCConfig,
  fetchIdentityFromTeamCC,
  cacheIdentity,
  loadCachedIdentity,
} from '../../bootstrap/teamccAuth.js'
import { getTeamCCProjectCacheDir } from '../../utils/teamccPaths.js'
import { getAPIProvider } from '../../utils/model/providers.js'
import { jsonStringify } from '../../utils/slowOperations.js'

// No-op shim for backwards compatibility with VSC plugin / background OAuth flows
// Since Anthropic OAuth has been fully decoupled and transitioned to TeamCC Local Auth,
// this function is intentionally left empty to prevent breaking legacy imports in
// src/cli/print.ts and src/services/oauth/client.ts.
export async function installOAuthTokens(tokens: any): Promise<void> {
  return Promise.resolve()
}

export async function authLogin({
  email,
  sso,
  console: useConsole,
  claudeai,
}: {
  email?: string
  sso?: boolean
  console?: boolean
  claudeai?: boolean
}): Promise<void> {
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (query: string): Promise<string> =>
    new Promise(resolve => rl.question(query, resolve))

  try {
    process.stdout.write('--- TeamCC Login ---\n')
    const username = await question('Username: ')
    const password = await question('Password: ') // NOTE: in a real CLI this should mask input
    rl.close()

    if (!username || !password) {
      process.stderr.write('Username and password are required.\n')
      process.exit(1)
    }

    const adminUrl = process.env.TEAMCC_ADMIN_URL || 'http://127.0.0.1:3000'
    const { config } = await loginToTeamCC(username, password, adminUrl)
    await saveTeamCCConfig(process.cwd(), config)

    const identity = await fetchIdentityFromTeamCC(config)
    await cacheIdentity(process.cwd(), identity)
    const { reportAuditLog } = await import('../../bootstrap/teamccAudit.js')
    void reportAuditLog(process.cwd(), 'login', 'session', {
      username: identity.subject.username,
    })

    process.stdout.write('Login successful.\n')
    process.exit(0)
  } catch (err) {
    rl.close()
    process.stderr.write(`Login failed: ${(err as Error).message}\n`)
    process.exit(1)
  }
}

export async function authStatus(opts: {
  json?: boolean
  text?: boolean
}): Promise<void> {
  const identity = await loadCachedIdentity(process.cwd())
  const apiProvider = getAPIProvider()

  if (opts.text) {
    if (identity) {
      process.stdout.write(`Logged in as: ${identity.subject.username}\n`)
      process.stdout.write(
        `Department ID: ${identity.subject.departmentId}\n`,
      )
      process.stdout.write(`Role ID: ${identity.subject.roleId}\n`)
    } else {
      process.stdout.write(
        'Not logged in to TeamCC. Run claude auth login to authenticate.\n',
      )
    }
    process.stdout.write(`API Provider: ${apiProvider}\n`)
  } else {
    const output = {
      loggedIn: !!identity,
      apiProvider,
      identity: identity ? identity.subject : null,
    }
    process.stdout.write(jsonStringify(output, null, 2) + '\n')
  }
  process.exit(identity ? 0 : 1)
}

export async function authLogout(): Promise<void> {
  try {
    await logoutFromTeamCC(process.cwd())
    // also remove cache
    const fs = await import('fs/promises')
    const path = await import('path')
    const cacheDir = getTeamCCProjectCacheDir(process.cwd())
    try {
      const files = await fs.readdir(cacheDir)
      for (const file of files) {
        if (file === 'identity.json' || file.startsWith('permission-bundle-')) {
          await fs.unlink(path.join(cacheDir, file))
        }
      }
    } catch (e) {}
  } catch {
    process.stderr.write('Failed to log out.\n')
    process.exit(1)
  }
  process.stdout.write('Successfully logged out from TeamCC.\n')
  process.exit(0)
}
