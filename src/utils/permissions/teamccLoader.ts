/**
 * TeamCC Admin Permission Loader
 *
 * Fetches permission bundles from teamcc-admin and converts them to
 * Claude Code's PermissionRule format.
 */

import type { PermissionBehavior, PermissionRule } from '../../types/permissions.js'
import type { TeamCCConfig } from '../../bootstrap/teamccAuth.js'
import {
  getValidAccessToken,
  cacheIdentity,
  loadCachedIdentity,
  isCacheValid,
} from '../../bootstrap/teamccAuth.js'
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
  bundleId: string
  projectId: number
  subject: {
    userId: number
    username: string
  }
  rules: PermissionBundleRule[]
  capabilities: string[]
  envOverrides: Record<string, string>
  timestamp: string
  expiry: string
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

async function cachePermissionBundle(
  cwd: string,
  projectId: number,
  bundle: PermissionBundle,
): Promise<void> {
  // Not implemented yet - would cache the bundle JSON
  logForDebugging(
    `[teamcc-loader] Permission bundle caching not yet implemented`,
  )
}

async function loadCachedPermissionBundle(
  cwd: string,
  projectId: number,
): Promise<PermissionBundle | null> {
  // Not implemented yet - would load the cached bundle JSON
  return null
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

    const bundle = (await response.json()) as PermissionBundle
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
  return bundle.rules.map((rule) =>
    bundleRuleToPermissionRule(rule, 'teamccAdmin', bundle.projectId),
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
  if (cached && isCacheValid(cached as any)) {
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
