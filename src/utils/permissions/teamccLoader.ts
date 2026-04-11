/**
 * TeamCC Admin Permission Loader
 *
 * Fetches permission bundles from teamcc-admin and converts them to
 * Claude Code's PermissionRule format.
 */

import type { PermissionBehavior, PermissionRule } from '../../types/permissions.js'
import type { TeamCCConfig } from '../../bootstrap/teamccAuth.js'
import { getValidAccessToken } from '../../bootstrap/teamccAuth.js'
import { logForDebugging } from '../debug.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PermissionBundleRule = {
  behavior: PermissionBehavior
  tool: string
  content?: string
}

export type PermissionBundle = {
  schema?: string
  bundleId: string
  projectId?: number
  subject?: {
    userId: number
    username: string
  }
  subjectRef?: {
    userId: number
    projectId: number
  }
  rules: PermissionBundleRule[]
  capabilities: string[]
  envOverrides: Record<string, string>
  timestamp?: string
  expiry?: string
  issuedAt?: string
  expiresAt?: string
}

export type RuleWithSource = PermissionRule & {
  /**
   * The project ID this rule applies to, if any
   */
  projectId?: number
  /**
   * Additional context (used for logging/debugging)
   */
  context?: string
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

const CACHE_DIR_PATH = (cwd: string) => `${cwd}/.claude/cache`

function getBundleProjectId(
  bundle: PermissionBundle,
  fallbackProjectId?: number,
): number {
  return bundle.projectId ?? bundle.subjectRef?.projectId ?? fallbackProjectId ?? 1
}

function isPermissionBundleValid(bundle: PermissionBundle): boolean {
  const expiry = bundle.expiry ?? bundle.expiresAt
  if (!expiry) return false

  try {
    return new Date(expiry).getTime() > Date.now()
  } catch {
    return false
  }
}

async function cachePermissionBundle(
  cwd: string,
  projectId: number,
  bundle: PermissionBundle,
): Promise<void> {
  const fs = await import('fs/promises')
  const cacheDir = CACHE_DIR_PATH(cwd)
  const cachePath = `${cacheDir}/permission-bundle-${projectId}.json`

  try {
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.writeFile(cachePath, JSON.stringify(bundle, null, 2), 'utf-8')
  } catch (e) {
    logForDebugging(
      `[teamcc-loader] Failed to cache permission bundle: ${(e as Error).message}`,
      { level: 'warn' },
    )
  }
}

async function loadCachedPermissionBundle(
  cwd: string,
  projectId: number,
): Promise<PermissionBundle | null> {
  const fs = await import('fs/promises')
  const cachePath = `${CACHE_DIR_PATH(cwd)}/permission-bundle-${projectId}.json`

  try {
    const raw = await fs.readFile(cachePath, 'utf-8')
    return JSON.parse(raw) as PermissionBundle
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Remote Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch permission bundle from teamcc-admin /policy/bundle endpoint
 */
export async function fetchPermissionBundleFromTeamCC(
  config: TeamCCConfig,
  projectId: number,
): Promise<PermissionBundle | null> {
  if (!config.accessToken) {
    logForDebugging('[teamcc-loader] No access token, skipping remote fetch')
    return null
  }

  try {
    const { token } = await getValidAccessToken(config)

    const url = new URL(`${config.apiBase}/policy/bundle`)
    url.searchParams.set('projectId', String(projectId))

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      logForDebugging(
        `[teamcc-loader] Failed to fetch permission bundle: ${response.status}`,
        { level: 'warn' },
      )
      return null
    }

    const raw = (await response.json()) as Partial<PermissionBundle>
    const bundle: PermissionBundle = {
      bundleId: raw.bundleId ?? `teamcc-${projectId}`,
      projectId: raw.projectId ?? raw.subjectRef?.projectId ?? projectId,
      subject: raw.subject,
      subjectRef: raw.subjectRef,
      rules: Array.isArray(raw.rules) ? raw.rules : [],
      capabilities: Array.isArray(raw.capabilities) ? raw.capabilities : [],
      envOverrides:
        raw.envOverrides && typeof raw.envOverrides === 'object'
          ? raw.envOverrides
          : {},
      schema: raw.schema,
      timestamp: raw.timestamp,
      expiry: raw.expiry,
      issuedAt: raw.issuedAt,
      expiresAt: raw.expiresAt,
    }
    logForDebugging(
      `[teamcc-loader] Fetched permission bundle for project ${projectId}`,
    )
    return bundle
  } catch (e) {
    logForDebugging(
      `[teamcc-loader] Error fetching permission bundle: ${(e as Error).message}`,
      { level: 'warn' },
    )
    return null
  }
}

// ---------------------------------------------------------------------------
// Rule Conversion
// ---------------------------------------------------------------------------

/**
 * Convert TeamCC PermissionBundleRule to Claude Code PermissionRule
 */
function bundleRuleToPermissionRule(
  bundleRule: PermissionBundleRule,
  source: 'teamccAdmin',
  projectId?: number,
): RuleWithSource {
  return {
    source,
    ruleBehavior: bundleRule.behavior,
    ruleValue: {
      toolName: bundleRule.tool,
      ruleContent: bundleRule.content,
    },
    projectId,
    context: `from teamcc-admin bundle for project ${projectId}`,
  }
}

/**
 * Convert an entire PermissionBundle to PermissionRules
 */
export function bundleToRules(
  bundle: PermissionBundle,
): RuleWithSource[] {
  const projectId = getBundleProjectId(bundle)
  return bundle.rules.map((rule) =>
    bundleRuleToPermissionRule(rule, 'teamccAdmin', projectId),
  )
}

// ---------------------------------------------------------------------------
// Loading with Fallback Chain
// ---------------------------------------------------------------------------

/**
 * Load permission bundle with fallback chain:
 * 1. Try to fetch from remote
 * 2. Fallback to local cache if remote fails
 * 3. Return null if both fail
 */
export async function loadPermissionBundleWithFallback(
  cwd: string,
  config: TeamCCConfig | null,
  projectId: number,
): Promise<PermissionBundle | null> {
  let bundle: PermissionBundle | null = null

  // Try to fetch from remote
  if (config?.accessToken) {
    try {
      bundle = await fetchPermissionBundleFromTeamCC(config, projectId)
      if (bundle) {
        // Cache it for offline use
        await cachePermissionBundle(cwd, projectId, bundle)
        return bundle
      }
    } catch (e) {
      logForDebugging(
        `[teamcc-loader] Remote fetch failed: ${(e as Error).message}`,
        { level: 'debug' },
      )
    }
  }

  // Try to load from cache
  const cached = await loadCachedPermissionBundle(cwd, projectId)
  if (cached && isPermissionBundleValid(cached)) {
    logForDebugging(
      `[teamcc-loader] Using cached permission bundle for project ${projectId}`,
    )
    return cached
  }

  return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get permission rules from TeamCC Admin for a specific project
 * Returns empty array if TeamCC Admin is not available
 */
export async function getTeamCCPermissionRules(
  cwd: string,
  config: TeamCCConfig | null,
  projectId: number,
): Promise<RuleWithSource[]> {
  if (!config) {
    return []
  }

  const bundle = await loadPermissionBundleWithFallback(cwd, config, projectId)
  if (!bundle) {
    return []
  }

  return bundleToRules(bundle)
}

/**
 * Get capabilities from TeamCC Admin for a specific project
 * (For future use in cross-project permission checking)
 */
export async function getTeamCCCapabilities(
  cwd: string,
  config: TeamCCConfig | null,
  projectId: number,
): Promise<string[]> {
  if (!config) {
    return []
  }

  const bundle = await loadPermissionBundleWithFallback(cwd, config, projectId)
  if (!bundle) {
    return []
  }

  return bundle.capabilities
}

/**
 * Get environment overrides from TeamCC Admin for a specific project
 * (For future use in environment variable injection)
 */
export async function getTeamCCEnvOverrides(
  cwd: string,
  config: TeamCCConfig | null,
  projectId: number,
): Promise<Record<string, string>> {
  if (!config) {
    return {}
  }

  const bundle = await loadPermissionBundleWithFallback(cwd, config, projectId)
  if (!bundle) {
    return {}
  }

  return bundle.envOverrides
}
