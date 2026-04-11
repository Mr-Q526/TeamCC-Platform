/**
 * TeamCC Integration for Permission System
 *
 * Provides the main entry point for loading and merging permissions
 * from TeamCC Admin with local settings.
 */

import type { PermissionRule } from '../../types/permissions.js'
import type { TeamCCConfig } from '../../bootstrap/teamccAuth.js'
import { loadTeamCCConfig } from '../../bootstrap/teamccAuth.js'
import { getTeamCCPermissionRules } from './teamccLoader.js'
import { loadAllPermissionRulesFromDisk } from './permissionsLoader.js'
import { mergeRules, type MergedRule, describeMergedRules } from './rulesMerger.js'
import { logForDebugging } from '../debug.js'
import { getCwd } from '../cwd.js'

// ---------------------------------------------------------------------------
// Main Integration
// ---------------------------------------------------------------------------

/**
 * Load and merge permission rules from all sources:
 * 1. TeamCC Admin (if available)
 * 2. Local settings.json / CLAUDE.md
 *
 * Returns merged rules using "most restrictive" principle (deny > ask > allow)
 */
export async function loadAndMergeAllPermissionRules(
  projectId: number = 1,
): Promise<MergedRule[]> {
  const cwd = getCwd()
  const rules: PermissionRule[] = []

  try {
    // 1. Load from TeamCC Admin (if configured)
    let teamccConfig: TeamCCConfig | null = null
    try {
      teamccConfig = await loadTeamCCConfig(cwd)
    } catch (e) {
      logForDebugging(
        `[teamcc-integration] Failed to load TeamCC config: ${(e as Error).message}`,
        { level: 'debug' },
      )
    }

    if (teamccConfig?.accessToken) {
      try {
        const teamccRules = await getTeamCCPermissionRules(
          cwd,
          teamccConfig,
          projectId,
        )
        rules.push(...teamccRules)
        logForDebugging(
          `[teamcc-integration] Loaded ${teamccRules.length} rules from TeamCC Admin`,
        )
      } catch (e) {
        logForDebugging(
          `[teamcc-integration] Failed to load TeamCC rules: ${(e as Error).message}`,
          { level: 'warn' },
        )
      }
    }

    // 2. Load from local settings
    const localRules = loadAllPermissionRulesFromDisk()
    rules.push(...localRules)
    logForDebugging(
      `[teamcc-integration] Loaded ${localRules.length} rules from local settings`,
    )

    // 3. Merge rules
    const merged = mergeRules(rules)
    logForDebugging(
      `[teamcc-integration] Merged ${rules.length} rules into ${merged.length} merged rules`,
    )

    if (logForDebugging.enabled) {
      const description = describeMergedRules(merged)
      logForDebugging(`[teamcc-integration] Merged rules:\n${description}`)
    }

    return merged
  } catch (e) {
    logForDebugging(
      `[teamcc-integration] Unexpected error: ${(e as Error).message}`,
      { level: 'error' },
    )
    // Fallback to local rules only
    const localRules = loadAllPermissionRulesFromDisk()
    return mergeRules(localRules)
  }
}

/**
 * Get the summary of how rules were merged for a specific tool
 */
export function getRuleMergeSummary(
  merged: MergedRule[],
  toolName: string,
): string {
  const toolRules = merged.filter((r) => r.ruleValue.toolName === toolName)

  if (toolRules.length === 0) {
    return `No rules found for ${toolName}`
  }

  return toolRules
    .map((rule) => {
      const sources = rule.mergedFrom.map((r) => r.source).join(', ')
      return `${rule.ruleBehavior.toUpperCase()}: ${toolName} [from: ${sources}]`
    })
    .join('\n')
}
