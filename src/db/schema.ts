import {
  pgTable as table,
  serial,
  varchar,
  text,
  timestamp,
  primaryKey,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Dictionary tables
 */

export const orgs = table('orgs', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  description: text('description'),
})

export const departments = table('departments', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  description: text('description'),
})

export const teams = table('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  description: text('description'),
})

export const roles = table('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  description: text('description'),
})

export const levels = table('levels', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  description: text('description'),
})

export const projects = table('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  code: varchar('code').notNull().unique(),
  status: varchar('status').notNull().default('active'), // active, archived
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

/**
 * User management
 */

export const users = table(
  'users',
  {
    id: serial('id').primaryKey(),
    username: varchar('username').notNull().unique(),
    email: varchar('email').notNull().unique(),
    passwordHash: varchar('password_hash').notNull(),
    orgId: integer('org_id'),
    departmentId: integer('department_id'),
    teamId: integer('team_id'),
    roleId: integer('role_id'),
    levelId: integer('level_id'),
    defaultProjectId: integer('default_project_id'),
    status: varchar('status').notNull().default('active'), // active, suspended
    roles: varchar('roles').notNull().default('viewer'), // comma-separated: admin, viewer
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    usernameIdx: uniqueIndex('users_username_idx').on(table.username),
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  })
)

export const apiTokens = table(
  'api_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull(),
    tokenHash: varchar('token_hash').notNull().unique(),
    deviceLabel: varchar('device_label'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex('api_tokens_hash_idx').on(table.tokenHash),
  })
)

/**
 * Permission management
 */

export const permissionTemplates = table(
  'permission_templates',
  {
    id: serial('id').primaryKey(),
    name: varchar('name').notNull(),
    description: text('description'),
    version: integer('version').notNull().default(1),
    rulesJson: text('rules_json').notNull(), // PermissionRule[] as JSON
    capabilitiesJson: text('capabilities_json').notNull(), // string[] as JSON
    envOverridesJson: text('env_overrides_json').notNull(), // Record<string, string> as JSON
    status: varchar('status').notNull().default('active'), // active, archived
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    nameIdx: uniqueIndex('permission_templates_name_idx').on(table.name),
  })
)

export const departmentPolicies = table(
  'department_policies',
  {
    id: serial('id').primaryKey(),
    departmentId: integer('department_id').notNull(),
    policyType: varchar('policy_type').notNull().default('deny'), // deny, allow, ask
    toolCategory: varchar('tool_category').notNull(), // Read, Write, Edit, Glob, Bash, WebFetch, WebSearch, etc.
    resourcePattern: varchar('resource_pattern').notNull(), // glob pattern, supports {{VARIABLE}}
    description: text('description'),
    status: varchar('status').notNull().default('active'), // active, disabled
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    deptIdx: uniqueIndex('dept_policies_dept_idx').on(table.departmentId),
  })
)

export const userAssignments = table(
  'user_assignments',
  {
    userId: integer('user_id').notNull(),
    projectId: integer('project_id').notNull(),
    templateIds: varchar('template_ids').notNull(), // comma-separated IDs
    extraRulesJson: text('extra_rules_json'), // PermissionRule[] as JSON
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.projectId] }),
  })
)

/**
 * Audit logging
 */

export const auditLog = table('audit_log', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id'),
  action: varchar('action').notNull(), // create, update, delete, login, logout
  targetType: varchar('target_type'), // user, template, assignment
  targetId: integer('target_id'),
  beforeJson: text('before_json'),
  afterJson: text('after_json'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})

/**
 * TeamCC client audit logs (security audit trail)
 */

export const teamccAuditLogs = table('teamcc_audit_logs', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp', { withTimezone: true })
    .notNull(),
  userId: integer('user_id').notNull(),
  departmentId: integer('department_id'),
  eventType: varchar('event_type').notNull(), // boot, login, bash_command, file_write
  detailsJson: text('details_json').notNull(), // JSON object with command, exitCode, etc.
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
})
