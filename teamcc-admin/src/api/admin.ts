import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import {
  users,
  permissionTemplates,
  userAssignments,
  auditLog,
  departmentPolicies,
  orgs,
  departments,
  teams,
  roles,
  levels,
  projects,
} from '../db/schema.js'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { JWT_SECRET, hashPassword, requireActiveUserById } from '../services/auth.js'
import {
  buildEffectivePolicyPreview,
  getDefaultProjectIdForUser,
} from '../services/policy.js'
import crypto from 'crypto'

/**
 * Verify JWT and assert the user has admin role
 */
async function requireAdmin(request: any): Promise<number> {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header')
  }

  const token = authHeader.slice(7)
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')

  const [header, payload, signature] = parts
  const message = header + '.' + payload

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(message)
    .digest('base64url')

  if (signature !== expectedSignature) throw new Error('Invalid signature')

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
  const now = Math.floor(Date.now() / 1000)
  if (decoded.exp && decoded.exp < now) throw new Error('Token expired')

  const userId = decoded.userId
  const user = await requireActiveUserById(userId)

  const userRoles = (user.roles || '').split(',').map((r: string) => r.trim())
  if (!userRoles.includes('admin')) throw new Error('Admin role required')

  return userId
}

/**
 * Write a record to audit_log
 */
async function writeAudit(
  actorUserId: number,
  action: string,
  targetType: string,
  targetId: number | null,
  before?: unknown,
  after?: unknown
) {
  await db.insert(auditLog).values({
    actorUserId,
    action,
    targetType,
    targetId: targetId ?? undefined,
    beforeJson: before ? JSON.stringify(before) : null,
    afterJson: after ? JSON.stringify(after) : null,
  })
}

function sendReservedSkillResponse(
  reply: { status: (code: number) => { send: (payload: unknown) => unknown } },
  capability: 'skill_import' | 'weight_export' | 'execution_stats',
  input?: Record<string, unknown>,
) {
  return reply.status(501).send({
    ok: false,
    status: 'not_implemented',
    capability,
    service: 'skill-graph',
    message: 'Reserved for future skill-graph service integration',
    input: input ?? null,
  })
}

export async function registerAdminRoutes(fastify: FastifyInstance) {
  // ─────────────────────────────────────────────
  //  Dictionaries
  // ─────────────────────────────────────────────

  fastify.get('/admin/dictionaries', async (request, reply) => {
    try {
      await requireAdmin(request)
      const [orgList, deptList, teamList, roleList, levelList, projectList] = await Promise.all([
        db.select().from(orgs),
        db.select().from(departments),
        db.select().from(teams),
        db.select().from(roles),
        db.select().from(levels),
        db.select().from(projects),
      ])
      return reply.send({ orgs: orgList, departments: deptList, teams: teamList, roles: roleList, levels: levelList, projects: projectList })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  // ─────────────────────────────────────────────
  //  Users
  // ─────────────────────────────────────────────

  /** GET /admin/users */
  fastify.get('/admin/users', async (request, reply) => {
    try {
      await requireAdmin(request)
      const list = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        orgId: users.orgId,
        departmentId: users.departmentId,
        teamId: users.teamId,
        roleId: users.roleId,
        levelId: users.levelId,
        defaultProjectId: users.defaultProjectId,
        status: users.status,
        roles: users.roles,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      }).from(users).orderBy(users.id)
      return reply.send({ users: list })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  /** POST /admin/users */
  fastify.post<{
    Body: {
      username: string
      email: string
      password: string
      orgId?: number
      departmentId?: number
      teamId?: number
      roleId?: number
      levelId?: number
      defaultProjectId?: number
      status?: string
      roles?: string
    }
  }>('/admin/users', async (request, reply) => {
    try {
      const actorId = await requireAdmin(request)
      const { username, email, password, orgId, departmentId, teamId, roleId, levelId, defaultProjectId, status, roles: userRoles } = request.body

      if (!username || !email || !password) {
        return reply.status(400).send({ error: 'username, email, and password are required' })
      }

      const passwordHash = await hashPassword(password)
      const [newUser] = await db.insert(users).values({
        username,
        email,
        passwordHash,
        orgId: orgId ?? null,
        departmentId: departmentId ?? null,
        teamId: teamId ?? null,
        roleId: roleId ?? null,
        levelId: levelId ?? null,
        defaultProjectId: defaultProjectId ?? null,
        status: status ?? 'active',
        roles: userRoles ?? 'viewer',
      }).returning()

      await writeAudit(actorId, 'create', 'user', newUser.id, null, { username, email })

      const { passwordHash: _, ...safeUser } = newUser
      return reply.status(201).send({ user: safeUser })
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('unique')) return reply.status(409).send({ error: 'Username or email already exists' })
      return reply.status(msg.includes('required') ? 400 : 401).send({ error: msg })
    }
  })

  /** PUT /admin/users/:id */
  fastify.put<{
    Params: { id: string }
    Body: {
      email?: string
      password?: string
      orgId?: number | null
      departmentId?: number | null
      teamId?: number | null
      roleId?: number | null
      levelId?: number | null
      defaultProjectId?: number | null
      status?: string
      roles?: string
    }
  }>('/admin/users/:id', async (request, reply) => {
    try {
      const actorId = await requireAdmin(request)
      const userId = parseInt(request.params.id)
      if (isNaN(userId)) return reply.status(400).send({ error: 'Invalid user id' })

      const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1).then((r) => r[0])
      if (!existing) return reply.status(404).send({ error: 'User not found' })

      const { email, password, orgId, departmentId, teamId, roleId, levelId, defaultProjectId, status, roles: userRoles } = request.body

      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (email !== undefined) updates.email = email
      if (orgId !== undefined) updates.orgId = orgId
      if (departmentId !== undefined) updates.departmentId = departmentId
      if (teamId !== undefined) updates.teamId = teamId
      if (roleId !== undefined) updates.roleId = roleId
      if (levelId !== undefined) updates.levelId = levelId
      if (defaultProjectId !== undefined) updates.defaultProjectId = defaultProjectId
      if (status !== undefined) updates.status = status
      if (userRoles !== undefined) updates.roles = userRoles
      if (password) updates.passwordHash = await hashPassword(password)

      const [updated] = await db.update(users).set(updates as any).where(eq(users.id, userId)).returning()

      await writeAudit(actorId, 'update', 'user', userId, {
        email: existing.email, status: existing.status, roles: existing.roles,
      }, {
        email: updated.email, status: updated.status, roles: updated.roles,
      })

      const { passwordHash: _, ...safeUser } = updated
      return reply.send({ user: safeUser })
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message })
    }
  })

  /** DELETE /admin/users/:id */
  fastify.delete<{ Params: { id: string } }>('/admin/users/:id', async (request, reply) => {
    try {
      const actorId = await requireAdmin(request)
      const userId = parseInt(request.params.id)
      if (isNaN(userId)) return reply.status(400).send({ error: 'Invalid user id' })

      const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1).then((r) => r[0])
      if (!existing) return reply.status(404).send({ error: 'User not found' })

      // Soft-delete: set status = suspended
      await db.update(users).set({ status: 'suspended', updatedAt: new Date() }).where(eq(users.id, userId))
      await writeAudit(actorId, 'delete', 'user', userId, { username: existing.username }, null)

      return reply.send({ ok: true })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  // ─────────────────────────────────────────────
  //  Permission Templates
  // ─────────────────────────────────────────────

  /** GET /admin/templates */
  fastify.get('/admin/templates', async (request, reply) => {
    try {
      await requireAdmin(request)
      const list = await db.select().from(permissionTemplates).orderBy(permissionTemplates.id)
      return reply.send({ templates: list })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  /** POST /admin/templates */
  fastify.post<{
    Body: {
      name: string
      description?: string
      rulesJson?: string
      capabilitiesJson?: string
      envOverridesJson?: string
      status?: string
    }
  }>('/admin/templates', async (request, reply) => {
    try {
      const actorId = await requireAdmin(request)
      const { name, description, rulesJson, capabilitiesJson, envOverridesJson, status } = request.body
      const normalizedName = name?.trim()

      if (!normalizedName) return reply.status(400).send({ error: 'name is required' })

      const duplicate = await db
        .select({ id: permissionTemplates.id })
        .from(permissionTemplates)
        .where(eq(permissionTemplates.name, normalizedName))
        .limit(1)
        .then((rows) => rows[0])

      if (duplicate) {
        return reply.status(409).send({ error: 'Template name already exists' })
      }

      // Validate JSON fields
      for (const [field, value] of [['rulesJson', rulesJson], ['capabilitiesJson', capabilitiesJson], ['envOverridesJson', envOverridesJson]] as const) {
        if (value) {
          try { JSON.parse(value) } catch {
            return reply.status(400).send({ error: `Invalid JSON in ${field}` })
          }
        }
      }

      const [newTemplate] = await db.insert(permissionTemplates).values({
        name: normalizedName,
        description: description ?? '',
        rulesJson: rulesJson ?? '[]',
        capabilitiesJson: capabilitiesJson ?? '[]',
        envOverridesJson: envOverridesJson ?? '{}',
        status: status ?? 'active',
      }).returning()

      await writeAudit(actorId, 'create', 'template', newTemplate.id, null, { name })

      return reply.status(201).send({ template: newTemplate })
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message })
    }
  })

  /** PUT /admin/templates/:id */
  fastify.put<{
    Params: { id: string }
    Body: {
      name?: string
      description?: string
      rulesJson?: string
      capabilitiesJson?: string
      envOverridesJson?: string
      status?: string
    }
  }>('/admin/templates/:id', async (request, reply) => {
    try {
      const actorId = await requireAdmin(request)
      const templateId = parseInt(request.params.id)
      if (isNaN(templateId)) return reply.status(400).send({ error: 'Invalid template id' })

      const existing = await db.select().from(permissionTemplates).where(eq(permissionTemplates.id, templateId)).limit(1).then((r) => r[0])
      if (!existing) return reply.status(404).send({ error: 'Template not found' })

      const { name, description, rulesJson, capabilitiesJson, envOverridesJson, status } = request.body
      const normalizedName = name?.trim()

      if (name !== undefined && !normalizedName) {
        return reply.status(400).send({ error: 'name is required' })
      }

      if (normalizedName && normalizedName !== existing.name) {
        const duplicate = await db
          .select({ id: permissionTemplates.id })
          .from(permissionTemplates)
          .where(eq(permissionTemplates.name, normalizedName))
          .limit(1)
          .then((rows) => rows[0])

        if (duplicate) {
          return reply.status(409).send({ error: 'Template name already exists' })
        }
      }

      // Validate JSON fields
      for (const [field, value] of [['rulesJson', rulesJson], ['capabilitiesJson', capabilitiesJson], ['envOverridesJson', envOverridesJson]] as const) {
        if (value) {
          try { JSON.parse(value) } catch {
            return reply.status(400).send({ error: `Invalid JSON in ${field}` })
          }
        }
      }

      const updates: Record<string, unknown> = { updatedAt: new Date(), version: existing.version + 1 }
      if (normalizedName !== undefined) updates.name = normalizedName
      if (description !== undefined) updates.description = description
      if (rulesJson !== undefined) updates.rulesJson = rulesJson
      if (capabilitiesJson !== undefined) updates.capabilitiesJson = capabilitiesJson
      if (envOverridesJson !== undefined) updates.envOverridesJson = envOverridesJson
      if (status !== undefined) updates.status = status

      const [updated] = await db.update(permissionTemplates).set(updates as any).where(eq(permissionTemplates.id, templateId)).returning()

      await writeAudit(actorId, 'update', 'template', templateId, { name: existing.name, status: existing.status }, { name: updated.name, status: updated.status })

      return reply.send({ template: updated })
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message })
    }
  })

  /** DELETE /admin/templates/:id */
  fastify.delete<{ Params: { id: string } }>('/admin/templates/:id', async (request, reply) => {
    try {
      const actorId = await requireAdmin(request)
      const templateId = parseInt(request.params.id)
      if (isNaN(templateId)) return reply.status(400).send({ error: 'Invalid template id' })

      const existing = await db.select().from(permissionTemplates).where(eq(permissionTemplates.id, templateId)).limit(1).then((r) => r[0])
      if (!existing) return reply.status(404).send({ error: 'Template not found' })

      await db.update(permissionTemplates).set({ status: 'archived', updatedAt: new Date() }).where(eq(permissionTemplates.id, templateId))
      await writeAudit(actorId, 'delete', 'template', templateId, { name: existing.name }, null)

      return reply.send({ ok: true })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  // ─────────────────────────────────────────────
  //  User Assignments
  // ─────────────────────────────────────────────

  /** GET /admin/users/:id/assignments */
  fastify.get<{ Params: { id: string } }>('/admin/users/:id/assignments', async (request, reply) => {
    try {
      await requireAdmin(request)
      const userId = parseInt(request.params.id)
      if (isNaN(userId)) return reply.status(400).send({ error: 'Invalid user id' })

      const list = await db.select().from(userAssignments).where(eq(userAssignments.userId, userId))
      return reply.send({ assignments: list })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  /** GET /admin/users/:id/effective-policy?projectId=1 */
  fastify.get<{
    Params: { id: string }
    Querystring: { projectId?: string }
  }>('/admin/users/:id/effective-policy', async (request, reply) => {
    try {
      await requireAdmin(request)
      const userId = parseInt(request.params.id)
      if (isNaN(userId)) return reply.status(400).send({ error: 'Invalid user id' })

      const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1).then((rows) => rows[0])
      if (!existing) return reply.status(404).send({ error: 'User not found' })
      if (existing.status !== 'active') {
        return reply.status(400).send({ error: 'User must be active to preview policy' })
      }

      const projectId = request.query.projectId
        ? parseInt(request.query.projectId, 10)
        : await getDefaultProjectIdForUser(userId)

      if (isNaN(projectId)) {
        return reply.status(400).send({ error: 'Invalid projectId' })
      }

      const preview = await buildEffectivePolicyPreview(userId, projectId)
      return reply.send(preview)
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  /** GET /admin/assignments */
  fastify.get('/admin/assignments', async (request, reply) => {
    try {
      await requireAdmin(request)
      const list = await db.select().from(userAssignments).orderBy(userAssignments.userId)
      return reply.send({ assignments: list })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  /** POST /admin/users/:id/assignments */
  fastify.post<{
    Params: { id: string }
    Body: {
      projectId: number
      templateIds: string
      extraRulesJson?: string
      expiresAt?: string
    }
  }>('/admin/users/:id/assignments', async (request, reply) => {
    try {
      const actorId = await requireAdmin(request)
      const userId = parseInt(request.params.id)
      if (isNaN(userId)) return reply.status(400).send({ error: 'Invalid user id' })

      const { projectId, templateIds, extraRulesJson, expiresAt } = request.body
      if (!projectId || !templateIds) return reply.status(400).send({ error: 'projectId and templateIds are required' })

      // Upsert: insert or update on conflict
      const existing = await db.select().from(userAssignments)
        .where(and(eq(userAssignments.userId, userId), eq(userAssignments.projectId, projectId)))
        .limit(1).then((r) => r[0])

      if (existing) {
        await db.update(userAssignments).set({
          templateIds,
          extraRulesJson: extraRulesJson ?? null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          updatedAt: new Date(),
        }).where(and(eq(userAssignments.userId, userId), eq(userAssignments.projectId, projectId)))
        await writeAudit(actorId, 'update', 'assignment', userId, existing, { projectId, templateIds })
      } else {
        await db.insert(userAssignments).values({
          userId,
          projectId,
          templateIds,
          extraRulesJson: extraRulesJson ?? null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        })
        await writeAudit(actorId, 'create', 'assignment', userId, null, { projectId, templateIds })
      }

      return reply.status(201).send({ ok: true })
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message })
    }
  })

  /** DELETE /admin/users/:id/assignments/:projectId */
  fastify.delete<{
    Params: { id: string; projectId: string }
  }>('/admin/users/:id/assignments/:projectId', async (request, reply) => {
    try {
      const actorId = await requireAdmin(request)
      const userId = parseInt(request.params.id)
      const projectId = parseInt(request.params.projectId)
      if (isNaN(userId) || isNaN(projectId)) return reply.status(400).send({ error: 'Invalid ids' })

      await db.delete(userAssignments).where(
        and(eq(userAssignments.userId, userId), eq(userAssignments.projectId, projectId))
      )
      await writeAudit(actorId, 'delete', 'assignment', userId, { projectId }, null)

      return reply.send({ ok: true })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  // ─────────────────────────────────────────────
  //  Audit Log
  // ─────────────────────────────────────────────

  /** GET /admin/audit?limit=50&offset=0&action=&targetType= */
  fastify.get<{
    Querystring: {
      limit?: string
      offset?: string
      action?: string
      actions?: string
      targetType?: string
      severity?: string
    }
  }>('/admin/audit', async (request, reply) => {
    try {
      await requireAdmin(request)
      const limit = Math.min(parseInt(request.query.limit || '50'), 200)
      const offset = parseInt(request.query.offset || '0')
      const conditions: any[] = []

      if (request.query.action) {
        conditions.push(eq(auditLog.action, request.query.action))
      }

      if (request.query.actions) {
        const actions = request.query.actions
          .split(',')
          .map((action) => action.trim())
          .filter(Boolean)
        if (actions.length > 0) {
          conditions.push(inArray(auditLog.action, actions))
        }
      }

      if (request.query.targetType) {
        conditions.push(eq(auditLog.targetType, request.query.targetType))
      }

      if (request.query.severity) {
        conditions.push(
          sql`coalesce(${auditLog.afterJson}::jsonb ->> 'severity', 'info') = ${request.query.severity}`,
        )
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      const auditQuery = db.select({
        id: auditLog.id,
        actorUserId: auditLog.actorUserId,
        action: auditLog.action,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        beforeJson: auditLog.beforeJson,
        afterJson: auditLog.afterJson,
        createdAt: auditLog.createdAt,
        actorUsername: users.username,
      })
        .from(auditLog)
        .leftJoin(users, eq(auditLog.actorUserId, users.id))
        .orderBy(desc(auditLog.createdAt))
        .limit(limit)
        .offset(offset)

      const logs = whereClause ? await auditQuery.where(whereClause) : await auditQuery

      const countQuery = db.select({ count: sql<number>`count(*)` }).from(auditLog)
      const [{ count }] = whereClause ? await countQuery.where(whereClause) : await countQuery

      return reply.send({ logs, total: Number(count), limit, offset })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  // ─────────────────────────────────────────────
  //  Department Policies
  // ─────────────────────────────────────────────

  /** GET /admin/department-policies?departmentId=101 */
  fastify.get<{
    Querystring: { departmentId?: string }
  }>('/admin/department-policies', async (request, reply) => {
    try {
      await requireAdmin(request)
      let policies: any[] = []

      if (request.query.departmentId) {
        const deptId = parseInt(request.query.departmentId)
        if (!isNaN(deptId)) {
          policies = await db.select().from(departmentPolicies).where(eq(departmentPolicies.departmentId, deptId))
        }
      } else {
        policies = await db.select().from(departmentPolicies)
      }

      return reply.send({ policies })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  /** POST /admin/department-policies */
  fastify.post<{
    Body: { departmentId: number; policyType: string; toolCategory: string; resourcePattern: string; description?: string }
  }>('/admin/department-policies', async (request, reply) => {
    try {
      const actorId = await requireAdmin(request)
      const { departmentId, policyType, toolCategory, resourcePattern, description } = request.body

      if (!departmentId || !toolCategory || !resourcePattern) {
        return reply.status(400).send({ error: 'departmentId, toolCategory, and resourcePattern are required' })
      }

      await db.insert(departmentPolicies).values({
        departmentId,
        policyType: policyType || 'deny',
        toolCategory,
        resourcePattern,
        description: description || null,
      })
      await writeAudit(actorId, 'create', 'department_policy', departmentId, null, { toolCategory, resourcePattern })

      return reply.status(201).send({ ok: true })
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message })
    }
  })

  /** PUT /admin/department-policies/:id */
  fastify.put<{
    Params: { id: string }
    Body: { policyType?: string; toolCategory?: string; resourcePattern?: string; description?: string; status?: string }
  }>('/admin/department-policies/:id', async (request, reply) => {
    try {
      const actorId = await requireAdmin(request)
      const policyId = parseInt(request.params.id)
      if (isNaN(policyId)) return reply.status(400).send({ error: 'Invalid policy ID' })

      const existing = await db.select().from(departmentPolicies).where(eq(departmentPolicies.id, policyId)).limit(1).then((r) => r[0])
      if (!existing) return reply.status(404).send({ error: 'Policy not found' })

      const updates: Record<string, any> = {}
      if (request.body.policyType) updates.policyType = request.body.policyType
      if (request.body.toolCategory) updates.toolCategory = request.body.toolCategory
      if (request.body.resourcePattern) updates.resourcePattern = request.body.resourcePattern
      if (request.body.description !== undefined) updates.description = request.body.description
      if (request.body.status) updates.status = request.body.status
      updates.updatedAt = new Date()

      await db.update(departmentPolicies).set(updates).where(eq(departmentPolicies.id, policyId))
      await writeAudit(actorId, 'update', 'department_policy', policyId, existing, updates)

      return reply.send({ ok: true })
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message })
    }
  })

  /** DELETE /admin/department-policies/:id (soft delete) */
  fastify.delete<{
    Params: { id: string }
  }>('/admin/department-policies/:id', async (request, reply) => {
    try {
      const actorId = await requireAdmin(request)
      const policyId = parseInt(request.params.id)
      if (isNaN(policyId)) return reply.status(400).send({ error: 'Invalid policy ID' })

      const existing = await db.select().from(departmentPolicies).where(eq(departmentPolicies.id, policyId)).limit(1).then((r) => r[0])
      if (!existing) return reply.status(404).send({ error: 'Policy not found' })

      await db.update(departmentPolicies).set({ status: 'disabled', updatedAt: new Date() }).where(eq(departmentPolicies.id, policyId))
      await writeAudit(actorId, 'delete', 'department_policy', policyId, existing, { status: 'disabled' })

      return reply.send({ ok: true })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  // ─────────────────────────────────────────────
  //  Skill Graph Integration (Reserved)
  // ─────────────────────────────────────────────

  fastify.get('/admin/skills/capabilities', async (request, reply) => {
    try {
      await requireAdmin(request)
      return reply.send({
        service: 'skill-graph',
        status: 'reserved',
        capabilities: {
          import: {
            implemented: false,
            endpoint: '/admin/skills/import',
            method: 'POST',
          },
          weightExport: {
            implemented: false,
            endpoint: '/admin/skills/weights/export',
            method: 'GET',
          },
          executionStats: {
            implemented: false,
            endpoint: '/admin/skills/execution-stats',
            method: 'GET',
          },
        },
      })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  fastify.post<{
    Body: {
      sourceType?: string
      sourceRef?: string
      dryRun?: boolean
    }
  }>('/admin/skills/import', async (request, reply) => {
    try {
      await requireAdmin(request)
      return sendReservedSkillResponse(reply, 'skill_import', {
        sourceType: request.body?.sourceType ?? null,
        sourceRef: request.body?.sourceRef ?? null,
        dryRun: request.body?.dryRun ?? false,
      })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  fastify.get<{
    Querystring: {
      format?: string
      scope?: string
      window?: string
    }
  }>('/admin/skills/weights/export', async (request, reply) => {
    try {
      await requireAdmin(request)
      return sendReservedSkillResponse(reply, 'weight_export', {
        format: request.query?.format ?? 'json',
        scope: request.query?.scope ?? 'global',
        window: request.query?.window ?? '30d',
      })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

  fastify.get<{
    Querystring: {
      window?: string
      groupBy?: string
      skillId?: string
    }
  }>('/admin/skills/execution-stats', async (request, reply) => {
    try {
      await requireAdmin(request)
      return sendReservedSkillResponse(reply, 'execution_stats', {
        window: request.query?.window ?? '30d',
        groupBy: request.query?.groupBy ?? 'skill',
        skillId: request.query?.skillId ?? null,
      })
    } catch (e) {
      return reply.status(401).send({ error: (e as Error).message })
    }
  })

}
