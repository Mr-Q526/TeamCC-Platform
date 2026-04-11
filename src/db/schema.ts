import {
  sqliteTable,
  integer,
  text,
  real,
  primaryKey,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * Dictionary tables
 */

export const orgs = sqliteTable('orgs', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
})

export const departments = sqliteTable('departments', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
})

export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
})

export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
})

export const levels = sqliteTable('levels', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
})

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  status: text('status').notNull().default('active'), // active, archived
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`current_timestamp`),
})

/**
 * User management
 */

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  orgId: integer('org_id'),
  departmentId: integer('department_id'),
  teamId: integer('team_id'),
  roleId: integer('role_id'),
  levelId: integer('level_id'),
  defaultProjectId: integer('default_project_id'),
  status: text('status').notNull().default('active'), // active, suspended
  roles: text('roles').notNull().default('viewer'), // comma-separated: admin, viewer
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`current_timestamp`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`current_timestamp`),
})

export const apiTokens = sqliteTable('api_tokens', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  deviceLabel: text('device_label'),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`current_timestamp`),
})

/**
 * Permission management
 */

export const permissionTemplates = sqliteTable('permission_templates', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  version: integer('version').notNull().default(1),
  rulesJson: text('rules_json').notNull(), // PermissionRule[] as JSON
  capabilitiesJson: text('capabilities_json').notNull(), // string[] as JSON
  envOverridesJson: text('env_overrides_json').notNull(), // Record<string, string> as JSON
  status: text('status').notNull().default('active'), // active, archived
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`current_timestamp`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`current_timestamp`),
})

export const userAssignments = sqliteTable(
  'user_assignments',
  {
    userId: integer('user_id').notNull(),
    projectId: integer('project_id').notNull(),
    templateIds: text('template_ids').notNull(), // comma-separated IDs
    extraRulesJson: text('extra_rules_json'), // PermissionRule[] as JSON
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`current_timestamp`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`current_timestamp`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.projectId] }),
  })
)

/**
 * Audit logging
 */

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey(),
  actorUserId: integer('actor_user_id'),
  action: text('action').notNull(), // create, update, delete, login, logout
  targetType: text('target_type'), // user, template, assignment
  targetId: integer('target_id'),
  beforeJson: text('before_json'),
  afterJson: text('after_json'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`current_timestamp`),
})
