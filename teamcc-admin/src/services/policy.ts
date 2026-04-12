import { db } from '../db/index.js'
import {
  departments,
  levels,
  orgs,
  permissionTemplates,
  projects,
  roles,
  teams,
  userAssignments,
  departmentPolicies,
} from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { requireActiveUserById } from './auth.js'
import type {
  IdentityEnvelope,
  IdentitySubject,
  PermissionBundle,
  PermissionRule,
  ResolvedPolicy,
} from '../types/wire.js'

type PolicyRuleSourceType = 'department_policy' | 'template' | 'assignment_extra'

export interface PolicyRuleTrace extends PermissionRule {
  key: string
  sourceType: PolicyRuleSourceType
  sourceId: number | null
  sourceLabel: string
}

export interface SuppressedPolicyRuleTrace extends PolicyRuleTrace {
  suppressedBy: PolicyRuleTrace
}

export interface PolicyTemplatePreview {
  id: number
  name: string
  description: string | null
  version: number
  status: string
  applied: boolean
}

export interface PolicyAssignmentPreview {
  userId: number
  projectId: number
  templateIds: string
  extraRulesJson: string | null
  expiresAt: string | null
}

export interface DepartmentPolicyPreview {
  id: number
  departmentId: number
  policyType: string
  toolCategory: string
  resourcePattern: string
  description: string | null
  status: string
}

export interface EffectivePolicyPreview {
  subject: IdentitySubject
  projectId: number
  assignment: PolicyAssignmentPreview | null
  templates: PolicyTemplatePreview[]
  departmentPolicies: DepartmentPolicyPreview[]
  effective: ResolvedPolicy
  effectiveRules: PolicyRuleTrace[]
  suppressedRules: SuppressedPolicyRuleTrace[]
}

/**
 * Build identity envelope for a user
 */
export async function buildIdentityEnvelope(
  userId: number
): Promise<IdentityEnvelope> {
  const user = await requireActiveUserById(userId)
  const subject = await buildIdentitySubject(user)

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour

  return {
    schema: 'teamskill.identity/v1',
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    subject,
  }
}

export async function getDefaultProjectIdForUser(userId: number): Promise<number> {
  const user = await requireActiveUserById(userId)
  return user.defaultProjectId || 1
}

async function buildIdentitySubject(
  user: Awaited<ReturnType<typeof requireActiveUserById>>
): Promise<IdentitySubject> {
  const [org, department, team, role, level, defaultProject] = await Promise.all([
    findNameById(orgs, user.orgId),
    findNameById(departments, user.departmentId),
    findNameById(teams, user.teamId),
    findNameById(roles, user.roleId),
    findNameById(levels, user.levelId),
    findNameById(projects, user.defaultProjectId),
  ])

  return {
    userId: user.id,
    username: user.username,
    orgId: user.orgId,
    departmentId: user.departmentId || 0,
    teamId: user.teamId || 0,
    roleId: user.roleId || 0,
    levelId: user.levelId || 0,
    defaultProjectId: user.defaultProjectId || 1,
    display: {
      org,
      department,
      team,
      role,
      level,
      defaultProject,
    },
  }
}

async function findNameById(
  table:
    | typeof orgs
    | typeof departments
    | typeof teams
    | typeof roles
    | typeof levels
    | typeof projects,
  id: number | null | undefined,
): Promise<string | null> {
  if (!id) return null

  const row = await db
    .select({ name: table.name })
    .from(table)
    .where(eq(table.id, id))
    .limit(1)
    .then((rows) => rows[0])

  return row?.name ?? null
}

/**
 * Build permission bundle for user + project
 * Merges rules from: department policies (deny baseline) > templates > extra assignment rules
 */
export async function buildPermissionBundle(
  userId: number,
  projectId: number
): Promise<PermissionBundle> {
  const preview = await buildEffectivePolicyPreview(userId, projectId)

  const now = new Date()
  const bundleId = `b_${now.getTime()}_${userId}_${projectId}`

  return {
    schema: 'teamskill.permissions/v1',
    bundleId,
    issuedAt: now.toISOString(),
    expiresAt: preview.effective.expiresAt,
    subjectRef: {
      userId,
      projectId,
    },
    rules: preview.effective.rules,
    capabilities: preview.effective.capabilities,
    envOverrides: preview.effective.envOverrides,
  }
}

export async function buildEffectivePolicyPreview(
  userId: number,
  projectId: number
): Promise<EffectivePolicyPreview> {
  const user = await requireActiveUserById(userId)
  const now = new Date()
  const subject = await buildIdentitySubject(user)

  const allCapabilities: Set<string> = new Set()
  const allEnvOverrides: Record<string, string> = {}
  const ruleTraces: PolicyRuleTrace[] = []

  // 1. Load department-level baseline deny rules (if user has a department)
  const deptPolicies = user.departmentId
    ? await db
      .select()
      .from(departmentPolicies)
      .where(
        and(
          eq(departmentPolicies.departmentId, user.departmentId),
          eq(departmentPolicies.status, 'active')
        )
      )
    : []

  const departmentPolicyItems: DepartmentPolicyPreview[] = deptPolicies.map((policy) => ({
    id: policy.id,
    departmentId: policy.departmentId,
    policyType: policy.policyType,
    toolCategory: policy.toolCategory,
    resourcePattern: policy.resourcePattern,
    description: policy.description ?? null,
    status: policy.status,
  }))

  for (const policy of deptPolicies) {
    ruleTraces.push(
      createRuleTrace(
        {
          behavior: policy.policyType as 'allow' | 'deny' | 'ask',
          tool: policy.toolCategory,
          content: policy.resourcePattern,
        },
        'department_policy',
        policy.id,
        policy.description?.trim() || `Department policy #${policy.id}`
      )
    )
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

  const activeAssignment =
    assignment && (!assignment.expiresAt || assignment.expiresAt >= now)
      ? assignment
      : null

  const templateIds = activeAssignment
    ? activeAssignment.templateIds
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id))
    : []

  const templateRecords = templateIds.length > 0
    ? await Promise.all(
        templateIds.map(async (id) => {
          const template = await db
            .select()
            .from(permissionTemplates)
            .where(eq(permissionTemplates.id, id))
            .limit(1)
            .then((rows) => rows[0])

          return template ?? null
        })
      )
    : []

  const templates: PolicyTemplatePreview[] = templateIds.map((id, index) => {
    const template = templateRecords[index]
    if (!template) {
      return {
        id,
        name: `#${id}`,
        description: null,
        version: 0,
        status: 'missing',
        applied: false,
      }
    }

    return {
      id: template.id,
      name: template.name,
      description: template.description ?? null,
      version: template.version,
      status: template.status,
      applied: template.status === 'active',
    }
  })

  for (const template of templateRecords) {
    if (!template || template.status !== 'active') continue

    try {
      const templateRules = JSON.parse(template.rulesJson) as PermissionRule[]
      for (const rule of templateRules) {
        ruleTraces.push(
          createRuleTrace(
            rule,
            'template',
            template.id,
            template.name
          )
        )
      }
    } catch {
      // Ignore parse errors
    }

    try {
      const caps = JSON.parse(template.capabilitiesJson) as string[]
      caps.forEach((cap) => allCapabilities.add(cap))
    } catch {
      // Ignore parse errors
    }

    try {
      const overrides = JSON.parse(template.envOverridesJson) as Record<string, string>
      Object.assign(allEnvOverrides, overrides)
    } catch {
      // Ignore parse errors
    }
  }

  if (activeAssignment?.extraRulesJson) {
    try {
      const extraRules = JSON.parse(activeAssignment.extraRulesJson) as PermissionRule[]
      for (const rule of extraRules) {
        ruleTraces.push(
          createRuleTrace(
            rule,
            'assignment_extra',
            null,
            'Assignment extra rules'
          )
        )
      }
    } catch {
      // Ignore parse errors
    }
  }

  const { effectiveRules, suppressedRules } = mergePolicyRuleTraces(ruleTraces)

  const defaultExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const expiresAt =
    activeAssignment?.expiresAt && activeAssignment.expiresAt < defaultExpiresAt
      ? activeAssignment.expiresAt
      : defaultExpiresAt
  const effective: ResolvedPolicy = {
    rules: effectiveRules.map(({ key: _key, sourceType: _sourceType, sourceId: _sourceId, sourceLabel: _sourceLabel, ...rule }) => rule),
    capabilities: Array.from(allCapabilities),
    envOverrides: allEnvOverrides,
    expiresAt: expiresAt.toISOString(),
  }

  return {
    subject,
    projectId,
    assignment: activeAssignment
      ? {
          userId: activeAssignment.userId,
          projectId: activeAssignment.projectId,
          templateIds: activeAssignment.templateIds,
          extraRulesJson: activeAssignment.extraRulesJson ?? null,
          expiresAt: activeAssignment.expiresAt?.toISOString() ?? null,
        }
      : null,
    templates,
    departmentPolicies: departmentPolicyItems,
    effective,
    effectiveRules,
    suppressedRules,
  }
}

function createRuleTrace(
  rule: PermissionRule,
  sourceType: PolicyRuleSourceType,
  sourceId: number | null,
  sourceLabel: string
): PolicyRuleTrace {
  return {
    ...rule,
    key: getRuleKey(rule),
    sourceType,
    sourceId,
    sourceLabel,
  }
}

function getRuleKey(rule: PermissionRule): string {
  return `${rule.tool}::${rule.content || '*'}`
}

function mergePolicyRuleTraces(ruleTraces: PolicyRuleTrace[]): {
  effectiveRules: PolicyRuleTrace[]
  suppressedRules: SuppressedPolicyRuleTrace[]
} {
  const ruleMap = new Map<string, PolicyRuleTrace>()
  const suppressedRules: SuppressedPolicyRuleTrace[] = []
  const priority: Record<string, number> = { deny: 3, ask: 2, allow: 1 }

  for (const trace of ruleTraces) {
    const existing = ruleMap.get(trace.key)

    if (!existing) {
      ruleMap.set(trace.key, trace)
      continue
    }

    if (priority[trace.behavior] > priority[existing.behavior]) {
      suppressedRules.push({
        ...existing,
        suppressedBy: trace,
      })
      ruleMap.set(trace.key, trace)
    } else {
      suppressedRules.push({
        ...trace,
        suppressedBy: existing,
      })
    }
  }

  return {
    effectiveRules: Array.from(ruleMap.values()),
    suppressedRules,
  }
}

/**
 * Merge rules by tool+content, keeping most restrictive (deny > ask > allow)
 */
function mergePermissionRules(rules: PermissionRule[]): PermissionRule[] {
  const traces = rules.map((rule) =>
    createRuleTrace(rule, 'assignment_extra', null, 'merge-only')
  )

  return mergePolicyRuleTraces(traces).effectiveRules.map(
    ({ key: _key, sourceType: _sourceType, sourceId: _sourceId, sourceLabel: _sourceLabel, ...rule }) => rule
  )
}
