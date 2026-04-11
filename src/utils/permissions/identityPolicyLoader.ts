/**
 * Identity-based policy loader with variable interpolation.
 *
 * Reads `.claude/policies/{department-<deptId>.json}` and
 * `.claude/policies/{level-<levelId>.json}` for the current identity,
 * interpolates `{{VAR}}` placeholders using `.claude/project-env.json`,
 * and returns a union of deny/allow/ask PermissionRules tagged as
 * `source: 'policySettings'` so they are displayed as "managed policy" in
 * permission denial messages.
 *
 * Deny rules from different layers (department + level) are ALWAYS merged
 * with union semantics — the most restrictive combined set is enforced.
 */

import { join } from 'path'
import { logForDebugging } from '../debug.js'
import { logForDiagnosticsNoPII } from '../diagLogs.js'
import { getFsImplementation } from '../fsOperations.js'
import { safeParseJSON } from '../json.js'
import type { PermissionBehavior, PermissionRule } from './PermissionRule.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PolicyJson = {
  _comment?: string
  permissions?: {
    deny?: string[]
    allow?: string[]
    ask?: string[]
  }
}

type ProjectEnvJson = Record<string, string>

// ---------------------------------------------------------------------------
// In-memory caches (cleared on each setup invocation to stay session-fresh)
// ---------------------------------------------------------------------------

let projectEnvCache: ProjectEnvJson | null | undefined = undefined // undefined = not yet loaded

// ---------------------------------------------------------------------------
// Variable interpolation
// ---------------------------------------------------------------------------

/**
 * Replace all `{{VAR_NAME}}` occurrences in a rule string with values from
 * the project-env map. Unknown variables are left as-is so policy authors
 * get a warning rather than a silent mismatch.
 */
function interpolate(rule: string, env: ProjectEnvJson): string {
  return rule.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key: string) => {
    if (key in env) {
      return env[key]
    }
    logForDebugging(
      `[identityPolicy] Unknown template variable ${match} in rule "${rule}" – leaving as-is`,
      { level: 'warn' },
    )
    return match
  })
}

// ---------------------------------------------------------------------------
// File readers
// ---------------------------------------------------------------------------

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await getFsImplementation().readFile(path, { encoding: 'utf-8' })
    const parsed = safeParseJSON(raw as string, false)
    return parsed as T | null
  } catch {
    return null
  }
}

/**
 * Load `.claude/project-env.json` with in-memory caching.
 * Returns an empty map if the file doesn't exist (policy variables stay as-is).
 */
async function loadProjectEnv(cwd: string): Promise<ProjectEnvJson> {
  if (projectEnvCache !== undefined) {
    return projectEnvCache ?? {}
  }
  const path = join(cwd, '.claude', 'project-env.json')
  const data = await readJsonFile<ProjectEnvJson>(path)
  projectEnvCache = data ?? null
  if (data) {
    logForDebugging(
      `[identityPolicy] Loaded project-env: ${JSON.stringify(Object.keys(data))}`,
    )
  } else {
    logForDebugging(
      `[identityPolicy] No project-env.json found at ${path}, variable interpolation disabled`,
    )
  }
  return data ?? {}
}

/** Load a single department or level policy file. */
async function loadPolicyFile(
  cwd: string,
  filename: string,
): Promise<PolicyJson | null> {
  const path = join(cwd, '.claude', 'policies', filename)
  const data = await readJsonFile<PolicyJson>(path)
  if (data) {
    logForDebugging(`[identityPolicy] Loaded policy file: ${filename}`)
  }
  return data
}

// ---------------------------------------------------------------------------
// Rule builder
// ---------------------------------------------------------------------------

function buildRulesFromPolicy(
  policy: PolicyJson,
  env: ProjectEnvJson,
): PermissionRule[] {
  const rules: PermissionRule[] = []
  const behaviors: PermissionBehavior[] = ['deny', 'allow', 'ask']

  for (const behavior of behaviors) {
    const ruleStrings = policy.permissions?.[behavior] ?? []
    for (const raw of ruleStrings) {
      if (typeof raw !== 'string') continue
      const interpolated = interpolate(raw, env)
      // Parse "ToolName(content)" or "ToolName" format
      const match = interpolated.match(/^([^(]+)(?:\((.+)\))?$/)
      if (!match || !match[1]) {
        logForDebugging(
          `[identityPolicy] Cannot parse rule "${interpolated}" – skipping`,
          { level: 'warn' },
        )
        continue
      }
      rules.push({
        source: 'policySettings',
        ruleBehavior: behavior,
        ruleValue: {
          toolName: match[1].trim(),
          ...(match[2] !== undefined ? { ruleContent: match[2].trim() } : {}),
        },
      })
    }
  }
  return rules
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reset the project-env cache. Must be called when cwd changes (e.g. in tests
 * or worktree switches) so stale environment variables don't leak across sessions.
 */
export function resetIdentityPolicyCache(): void {
  projectEnvCache = undefined
}

/**
 * Load all identity-based permission rules for the current session.
 *
 * @param cwd       The working directory (used to locate `.claude/policies/`)
 * @param profile   The parsed numeric identity profile from STATE
 * @returns         Union of all PermissionRules from matching policy files,
 *                  with `{{VAR}}` placeholders replaced by project-env values.
 */
export async function loadIdentityPolicyRules(
  cwd: string,
  profile: {
    departmentId: number
    levelId: number
    roleId?: number
  },
): Promise<PermissionRule[]> {
  const startTime = Date.now()

  // Determine which policy files to load for this identity
  const filenames: string[] = [
    `department-${profile.departmentId}.json`,
    `level-${profile.levelId}.json`,
  ]
  if (profile.roleId !== undefined) {
    filenames.push(`role-${profile.roleId}.json`)
  }

  // Load env & policies in parallel
  const [env, ...policies] = await Promise.all([
    loadProjectEnv(cwd),
    ...filenames.map(f => loadPolicyFile(cwd, f)),
  ])

  // Build union of all rules (deny wins absolutely — accumulated at call site)
  const allRules: PermissionRule[] = []
  for (const policy of policies) {
    if (!policy) continue
    allRules.push(...buildRulesFromPolicy(policy, env))
  }

  const denyCount = allRules.filter(r => r.ruleBehavior === 'deny').length
  logForDiagnosticsNoPII('info', 'identity_policy_rules_loaded', {
    duration_ms: Date.now() - startTime,
    total_rules: allRules.length,
    deny_rules: denyCount,
    files_loaded: policies.filter(Boolean).length,
  })

  if (allRules.length > 0) {
    logForDebugging(
      `[identityPolicy] Injecting ${denyCount} deny rule(s) from identity policies`,
    )
  }

  return allRules
}
