import { db } from '../db/index.js'
import {
  users,
  permissionTemplates,
  userAssignments,
  departmentPolicies,
} from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import type {
  IdentityEnvelope,
  IdentitySubject,
  PermissionBundle,
  PermissionRule,
} from '../types/wire.js'

/**
 * Build identity envelope for a user
 */
export async function buildIdentityEnvelope(
  userId: number
): Promise<IdentityEnvelope> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((rows) => rows[0])

  if (!user) {
    throw new Error('User not found')
  }

  const subject: IdentitySubject = {
    userId: user.id,
    username: user.username,
    orgId: user.orgId,
    departmentId: user.departmentId || 0,
    teamId: user.teamId || 0,
    roleId: user.roleId || 0,
    levelId: user.levelId || 0,
    defaultProjectId: user.defaultProjectId || 1,
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour

  return {
    schema: 'teamskill.identity/v1',
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    subject,
  }
}

/**
 * Build permission bundle for user + project
 * Merges rules from: department policies (deny baseline) > templates > extra assignment rules
 */
export async function buildPermissionBundle(
  userId: number,
  projectId: number
): Promise<PermissionBundle> {
  // Get user
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((rows) => rows[0])

  if (!user) {
    throw new Error('User not found')
  }

  const rules: PermissionRule[] = []
  const allCapabilities: Set<string> = new Set()
  const allEnvOverrides: Record<string, string> = {}

  // 1. Load department-level baseline deny rules (if user has a department)
  if (user.departmentId) {
    const deptPolicies = await db
      .select()
      .from(departmentPolicies)
      .where(
        and(
          eq(departmentPolicies.departmentId, user.departmentId),
          eq(departmentPolicies.status, 'active')
        )
      )

    // Convert department policies to PermissionRule format
    for (const policy of deptPolicies) {
      rules.push({
        behavior: policy.policyType as 'allow' | 'deny' | 'ask',
        tool: policy.toolCategory,
        content: policy.resourcePattern,
      })
    }
  }

  // 2. Load templates assigned to user for this project
  const assignment = await db
    .select()
    .from(userAssignments)
    .where(
      and(
        eq(userAssignments.userId, userId),
        eq(userAssignments.projectId, projectId)
      )
    )
    .limit(1)
    .then((rows) => rows[0])

  if (assignment) {
    // Parse template IDs
    const templateIds = assignment.templateIds
      .split(',')
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id))

    // Load all templates
    const templates = await Promise.all(
      templateIds.map((id) =>
        db
          .select()
          .from(permissionTemplates)
          .where(eq(permissionTemplates.id, id))
          .limit(1)
          .then((rows) => rows[0])
      )
    )

    // Merge rules, capabilities, and env overrides from all templates
    for (const template of templates) {
      if (!template) continue

      // Parse and add rules
      try {
        const templateRules = JSON.parse(template.rulesJson) as PermissionRule[]
        rules.push(...templateRules)
      } catch {
        // Ignore parse errors
      }

      // Parse and add capabilities
      try {
        const caps = JSON.parse(template.capabilitiesJson) as string[]
        caps.forEach((cap) => allCapabilities.add(cap))
      } catch {
        // Ignore parse errors
      }

      // Parse and merge env overrides
      try {
        const overrides = JSON.parse(
          template.envOverridesJson
        ) as Record<string, string>
        Object.assign(allEnvOverrides, overrides)
      } catch {
        // Ignore parse errors
      }
    }

    // Add extra rules if any
    if (assignment.extraRulesJson) {
      try {
        const extraRules = JSON.parse(assignment.extraRulesJson) as PermissionRule[]
        rules.push(...extraRules)
      } catch {
        // Ignore parse errors
      }
    }
  }

  // 3. Apply rule merging: most restrictive behavior wins (deny > ask > allow)
  const mergedRules = mergePermissionRules(rules)

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours
  const bundleId = `b_${now.getTime()}_${userId}_${projectId}`

  return {
    schema: 'teamskill.permissions/v1',
    bundleId,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    subjectRef: {
      userId,
      projectId,
    },
    rules: mergedRules,
    capabilities: Array.from(allCapabilities),
    envOverrides: allEnvOverrides,
  }
}

/**
 * Merge rules by tool+content, keeping most restrictive (deny > ask > allow)
 */
function mergePermissionRules(rules: PermissionRule[]): PermissionRule[] {
  const ruleMap = new Map<string, PermissionRule>()
  const priority: Record<string, number> = { deny: 3, ask: 2, allow: 1 }

  for (const rule of rules) {
    const key = `${rule.tool}::${rule.content || '*'}`
    const existing = ruleMap.get(key)

    if (!existing) {
      ruleMap.set(key, rule)
    } else {
      // Keep the more restrictive rule
      if (priority[rule.behavior] > priority[existing.behavior]) {
        ruleMap.set(key, rule)
      }
    }
  }

  return Array.from(ruleMap.values())
}
