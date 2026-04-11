/**
 * TeamCC Admin Authentication Module
 *
 * Handles:
 * - Configuration loading and saving (tokens, API endpoint)
 * - Remote identity fetching from teamcc-admin
 * - Token refresh logic
 * - Local caching for offline support
 */

import { join } from 'path'
import { homedir } from 'os'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { logForDebugging } from '../utils/debug.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TeamCCConfig = {
  apiBase: string       // teamcc-admin 服务地址，默认 http://localhost:3000
  username?: string     // 用户名（可选，用于重新认证）
  accessToken?: string  // 当前有效的 access token
  refreshToken?: string // 用于刷新的 refresh token
  tokenExpiry?: number  // token 过期时间戳 (ms)
  cacheDir?: string     // 缓存目录
}

export type IdentityEnvelope = {
  schema: string
  subject: {
    userId: number
    username: string
    email: string
    departmentId: number
    teamId: number
    roleId: number
    levelId: number
    defaultProjectId: number
  }
  timestamp: string
  expiry: string
}

export type LoginResponse = {
  accessToken: string
  refreshToken: string
  expiresIn: number // seconds
}

// ---------------------------------------------------------------------------
// Configuration Management
// ---------------------------------------------------------------------------

const CONFIG_SEARCH_PATHS = [
  // 项目级配置（可提交到 git）
  (cwd: string) => join(cwd, '.claude', 'teamcc.json'),
  // 用户级配置（敏感信息，应该 gitignore）
  () => join(homedir(), '.teamcc', 'config.json'),
]

const CACHE_DIR_PATH = (cwd: string) => join(cwd, '.claude', 'cache')

/**
 * 从配置文件加载 TeamCC 配置
 * 优先级：项目级 > 用户级
 */
export async function loadTeamCCConfig(
  cwd: string,
): Promise<TeamCCConfig | null> {
  for (const pathFn of CONFIG_SEARCH_PATHS) {
    const configPath = pathFn(cwd)
    if (!existsSync(configPath)) continue

    try {
      const content = await readFile(configPath, 'utf-8')
      const config = JSON.parse(content) as TeamCCConfig
      logForDebugging(`[teamcc] Loaded config from ${configPath}`)
      return config
    } catch (e) {
      logForDebugging(
        `[teamcc] Failed to parse config at ${configPath}: ${(e as Error).message}`,
        { level: 'warn' },
      )
    }
  }

  // 尝试从环境变量
  if (process.env.TEAMCC_ADMIN_URL) {
    return {
      apiBase: process.env.TEAMCC_ADMIN_URL,
      accessToken: process.env.TEAMCC_ACCESS_TOKEN,
      refreshToken: process.env.TEAMCC_REFRESH_TOKEN,
    }
  }

  return null
}

/**
 * 保存 TeamCC 配置到项目级配置文件
 */
export async function saveTeamCCConfig(
  cwd: string,
  config: TeamCCConfig,
): Promise<void> {
  const configPath = CONFIG_SEARCH_PATHS[0](cwd)
  const dir = join(configPath, '..')

  // 确保目录存在
  await mkdir(dir, { recursive: true })

  // 写入配置（不包含敏感信息，如实际密码）
  const configToSave = {
    apiBase: config.apiBase,
    username: config.username,
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
    tokenExpiry: config.tokenExpiry,
  }

  await writeFile(configPath, JSON.stringify(configToSave, null, 2), 'utf-8')
  logForDebugging(`[teamcc] Saved config to ${configPath}`)
}

// ---------------------------------------------------------------------------
// Remote Authentication
// ---------------------------------------------------------------------------

/**
 * 向 teamcc-admin 进行用户认证
 */
export async function loginToTeamCC(
  username: string,
  password: string,
  apiBase: string = 'http://localhost:3000',
): Promise<{ tokens: LoginResponse; config: TeamCCConfig }> {
  try {
    const response = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!response.ok) {
      throw new Error(
        `Login failed with status ${response.status}: ${response.statusText}`,
      )
    }

    const tokens = (await response.json()) as LoginResponse
    logForDebugging(`[teamcc] Login successful for user ${username}`)

    const config: TeamCCConfig = {
      apiBase,
      username,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry: Date.now() + tokens.expiresIn * 1000,
    }

    return { tokens, config }
  } catch (e) {
    logForDebugging(`[teamcc] Login failed: ${(e as Error).message}`, {
      level: 'error',
    })
    throw e
  }
}

/**
 * 刷新 access token
 */
export async function refreshAccessToken(
  config: TeamCCConfig,
): Promise<{ tokens: LoginResponse; updatedConfig: TeamCCConfig }> {
  if (!config.refreshToken) {
    throw new Error('No refresh token available')
  }

  try {
    const response = await fetch(`${config.apiBase}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: config.refreshToken }),
    })

    if (!response.ok) {
      throw new Error(
        `Token refresh failed with status ${response.status}`,
      )
    }

    const tokens = (await response.json()) as LoginResponse
    logForDebugging('[teamcc] Token refreshed successfully')

    const updatedConfig: TeamCCConfig = {
      ...config,
      accessToken: tokens.accessToken,
      tokenExpiry: Date.now() + tokens.expiresIn * 1000,
    }

    return { tokens, updatedConfig }
  } catch (e) {
    logForDebugging(`[teamcc] Token refresh failed: ${(e as Error).message}`, {
      level: 'error',
    })
    throw e
  }
}

/**
 * 获取有效的 access token
 * 如果当前 token 即将过期，自动刷新
 */
export async function getValidAccessToken(
  config: TeamCCConfig,
): Promise<{ token: string; updatedConfig: TeamCCConfig }> {
  // 如果没有 token，直接抛出错误
  if (!config.accessToken) {
    throw new Error('No access token available. Run /login first.')
  }

  // 如果 token 还有效（至少还有 5 分钟），直接返回
  if (
    config.tokenExpiry &&
    config.tokenExpiry > Date.now() + 5 * 60 * 1000
  ) {
    return { token: config.accessToken, updatedConfig: config }
  }

  // Token 即将过期，尝试刷新
  const { updatedConfig } = await refreshAccessToken(config)
  return { token: updatedConfig.accessToken!, updatedConfig }
}

// ---------------------------------------------------------------------------
// Remote Identity Fetching
// ---------------------------------------------------------------------------

/**
 * 从 teamcc-admin 的 /identity/me 端点获取身份信息
 */
export async function fetchIdentityFromTeamCC(
  config: TeamCCConfig,
): Promise<IdentityEnvelope> {
  const { token, updatedConfig } = await getValidAccessToken(config)

  try {
    const response = await fetch(`${config.apiBase}/identity/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch identity: ${response.status} ${response.statusText}`,
      )
    }

    const envelope = (await response.json()) as IdentityEnvelope
    logForDebugging('[teamcc] Identity fetched successfully')

    // 更新配置以反映刷新后的 token
    if (updatedConfig !== config) {
      return envelope
    }

    return envelope
  } catch (e) {
    logForDebugging(
      `[teamcc] Failed to fetch identity: ${(e as Error).message}`,
      { level: 'error' },
    )
    throw e
  }
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

/**
 * 保存身份信息到本地缓存
 */
export async function cacheIdentity(
  cwd: string,
  envelope: IdentityEnvelope,
): Promise<void> {
  const cacheDir = CACHE_DIR_PATH(cwd)
  const cachePath = join(cacheDir, 'identity.json')

  try {
    await mkdir(cacheDir, { recursive: true })
    await writeFile(cachePath, JSON.stringify(envelope, null, 2), 'utf-8')
    logForDebugging(`[teamcc] Cached identity to ${cachePath}`)
  } catch (e) {
    logForDebugging(
      `[teamcc] Failed to cache identity: ${(e as Error).message}`,
      { level: 'warn' },
    )
  }
}

/**
 * 从本地缓存加载身份信息
 */
export async function loadCachedIdentity(
  cwd: string,
): Promise<IdentityEnvelope | null> {
  const cacheDir = CACHE_DIR_PATH(cwd)
  const cachePath = join(cacheDir, 'identity.json')

  if (!existsSync(cachePath)) {
    return null
  }

  try {
    const content = await readFile(cachePath, 'utf-8')
    const envelope = JSON.parse(content) as IdentityEnvelope
    logForDebugging(`[teamcc] Loaded cached identity from ${cachePath}`)
    return envelope
  } catch (e) {
    logForDebugging(
      `[teamcc] Failed to load cached identity: ${(e as Error).message}`,
      { level: 'warn' },
    )
    return null
  }
}

/**
 * 检查缓存是否仍然有效（基于 expiry）
 */
export function isCacheValid(envelope: IdentityEnvelope): boolean {
  if (!envelope.expiry) return false

  try {
    const expiryTime = new Date(envelope.expiry).getTime()
    return expiryTime > Date.now()
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

/**
 * 清除本地 TeamCC 配置
 */
export async function logoutFromTeamCC(cwd: string): Promise<void> {
  const configPath = CONFIG_SEARCH_PATHS[0](cwd)

  try {
    if (existsSync(configPath)) {
      await writeFile(configPath, JSON.stringify({ apiBase: '' }, null, 2), 'utf-8')
      logForDebugging(`[teamcc] Cleared config at ${configPath}`)
    }
  } catch (e) {
    logForDebugging(
      `[teamcc] Failed to clear config: ${(e as Error).message}`,
      { level: 'warn' },
    )
  }
}
