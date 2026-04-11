/**
 * Permission Rules Merger
 *
 * Merges permission rules from multiple sources using the "most restrictive" principle:
 * deny > ask > allow
 */

import type { PermissionBehavior, PermissionRule } from '../../types/permissions.js'
import { logForDebugging } from '../debug.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MergedRule = PermissionRule & {
  /**
   * The sources that contributed to this rule (for debugging)
   */
  mergedFrom: PermissionRule[]
}

// ---------------------------------------------------------------------------
// Merging Logic
// ---------------------------------------------------------------------------

/**
 * Priority order for permission behaviors (higher = more restrictive)
 */
const BEHAVIOR_PRIORITY: Record<PermissionBehavior, number> = {
  allow: 1,
  ask: 2,
  deny: 3,
}

/**
 * Merge multiple rules for the same tool+content combination
 * Uses "most restrictive" principle: deny > ask > allow
 */
function mergeRulesForTarget(rules: PermissionRule[]): MergedRule {
  if (rules.length === 0) {
    throw new Error('Cannot merge empty rule list')
  }

  if (rules.length === 1) {
    return {
      ...rules[0],
      mergedFrom: rules,
    }
  }

  // Find the most restrictive behavior
  const mostRestrictive = rules.reduce((prev, curr) => {
    const prevPriority = BEHAVIOR_PRIORITY[prev.ruleBehavior]
    const currPriority = BEHAVIOR_PRIORITY[curr.ruleBehavior]
    return currPriority > prevPriority ? curr : prev
  })

  logForDebugging(
    `[rules-merger] Merged ${rules.length} rules for ${mostRestrictive.ruleValue.toolName}:` +
      `${mostRestrictive.ruleValue.ruleContent ?? '*'}. ` +
      `Chosen: ${mostRestrictive.ruleBehavior} from ${mostRestrictive.source}`,
    { level: 'debug' },
  )

  return {
    ...mostRestrictive,
    mergedFrom: rules,
  }
}

/**
 * Create a unique key for a rule target (tool + content)
 */
function getRuleTargetKey(rule: PermissionRule): string {
  const { toolName, ruleContent } = rule.ruleValue
  return `${toolName}::${ruleContent ?? '*'}`
}

/**
 * Merge rules from multiple sources using "most restrictive" principle
 *
 * Algorithm:
 * 1. Group rules by (tool, content) combination
 * 2. For each group, select the most restrictive behavior
 * 3. Return merged rules, preserving source information
 */
export function mergeRules(rules: PermissionRule[]): MergedRule[] {
  if (rules.length === 0) {
    return []
  }

  // Group rules by tool+content
  const grouped = new Map<string, PermissionRule[]>()
  for (const rule of rules) {
    const key = getRuleTargetKey(rule)
    const group = grouped.get(key) || []
    group.push(rule)
    grouped.set(key, group)
  }

  // Merge each group
  const merged: MergedRule[] = []
  for (const group of grouped.values()) {
    merged.push(mergeRulesForTarget(group))
  }

  return merged
}

// ---------------------------------------------------------------------------
// Rule Filtering
// ---------------------------------------------------------------------------

/**
 * Filter rules to only include those that would affect the given tool
 */
export function filterRulesForTool(
  rules: PermissionRule[],
  toolName: string,
): PermissionRule[] {
  return rules.filter((rule) => {
    const { toolName: ruleTool, ruleContent } = rule.ruleValue

    // Exact tool match
    if (ruleTool === toolName) {
      return true
    }

    // Wildcard matching (e.g., "Read*" matches "ReadFile", "ReadDir")
    if (ruleTool.includes('*')) {
      const pattern = ruleTool.replace(/\*/g, '.*')
      const regex = new RegExp(`^${pattern}$`)
      return regex.test(toolName)
    }

    return false
  })
}

/**
 * Filter rules to only include those that would affect the given file/content
 */
export function filterRulesForContent(
  rules: PermissionRule[],
  content: string,
): PermissionRule[] {
  return rules.filter((rule) => {
    const ruleContent = rule.ruleValue.ruleContent
    if (!ruleContent) {
      // Wildcard rule applies to all content
      return true
    }

    // Exact match
    if (ruleContent === content) {
      return true
    }

    // Glob pattern matching (simple version)
    // e.g., "*.ts" or "*src/**"
    if (ruleContent.includes('*') || ruleContent.includes('?')) {
      const pattern = ruleContent
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
      const regex = new RegExp(`^${pattern}$`)
      return regex.test(content)
    }

    return false
  })
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable summary of merged rules
 */
export function describeMergedRules(merged: MergedRule[]): string {
  const lines: string[] = []

  for (const rule of merged) {
    const { toolName, ruleContent } = rule.ruleValue
    const target = ruleContent ? `${toolName}:${ruleContent}` : toolName
    const sources = rule.mergedFrom
      .map((r) => `${r.source}(${r.ruleBehavior})`)
      .join(', ')

    lines.push(`  ${rule.ruleBehavior.toUpperCase()}: ${target} [${sources}]`)
  }

  if (lines.length === 0) {
    return '  (no rules merged)'
  }

  return lines.join('\n')
}
