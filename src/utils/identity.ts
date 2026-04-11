/**
 * Identity Profile loader and ID-to-label mapping cache.
 *
 * Reads `.claude/identity/active.md` (YAML frontmatter only), parses the
 * numeric ID fields into a typed IdentityProfile, and provides a cached
 * mapping layer that converts IDs to human-readable labels for Skill
 * retrieval and model context injection.
 */

import { join } from 'path'
import { parseFrontmatter } from './frontmatterParser.js'
import { getFsImplementation } from './fsOperations.js'
import { logForDebugging } from './debug.js'
import { logForDiagnosticsNoPII } from './diagLogs.js'
import type { IdentityEnvelope } from '../bootstrap/teamccAuth.js'
import { getTeamCCIdentityPath } from './teamccPaths.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IdentityProfile = {
  userId: number
  orgId: number | null
  departmentId: number
  teamId: number
  roleId: number
  levelId: number
  projectId: number
}

// ---------------------------------------------------------------------------
// ID → Label mapping dictionaries (in-memory cache)
// ---------------------------------------------------------------------------

const DEPARTMENT_MAP: Record<number, string> = {
  101: 'frontend',
  102: 'backend',
  103: 'qa',
  104: 'sre',
  105: 'data',
  106: 'mobile',
  107: 'product',
  108: 'operations',
  109: 'hr',
  110: 'finance',
  111: 'security',
  112: 'design',
}

const ROLE_MAP: Record<number, string> = {
  201: 'frontend-developer',
  202: 'java-developer',
  203: 'test-automation',
  204: 'devops-sre',
}

const LEVEL_MAP: Record<number, string> = {
  301: 'p3',
  302: 'p4',
  303: 'p5',
  304: 'p6',
  305: 'p7',
}

const ORG_MAP: Record<number, string> = {
  10: 'org_tech_hub',
  20: 'org_business',
}

const TEAM_MAP: Record<number, string> = {
  1011: 'commerce-web',
  1012: 'growth-mobile',
  1013: 'admin-portal',
  1021: 'payment-infra',
  1022: 'order-service',
  1051: 'data-platform',
  1052: 'algorithm',
  1071: 'product-growth',
  1072: 'product-platform',
  1081: 'content-ops',
  1082: 'user-ops',
  1091: 'talent-acquisition',
  1092: 'hrbp',
}

// ---------------------------------------------------------------------------
// Mapping helpers (cache-friendly — the maps ARE the cache)
// ---------------------------------------------------------------------------

export function mapDepartment(id: number): string {
  return DEPARTMENT_MAP[id] ?? `unknown_dept(${id})`
}

export function mapRole(id: number): string {
  return ROLE_MAP[id] ?? `unknown_role(${id})`
}

export function mapLevel(id: number): string {
  return LEVEL_MAP[id] ?? `unknown_level(${id})`
}

export function mapOrg(id: number): string {
  return ORG_MAP[id] ?? `unknown_org(${id})`
}

export function mapTeam(id: number): string {
  return TEAM_MAP[id] ?? `unknown_team(${id})`
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads and parses `.claude/identity/active.md` from the given working
 * directory. Returns null if the file is missing or malformed.
 */
export async function loadIdentityProfile(
  cwd: string,
): Promise<IdentityProfile | null> {
  const identityPath = getTeamCCIdentityPath(cwd)
  const startTime = Date.now()

  try {
    const raw = await getFsImplementation().readFile(identityPath, {
      encoding: 'utf-8',
    })
    const { frontmatter } = parseFrontmatter(raw, identityPath)

    const userId = Number(frontmatter.user_id)
    const projectId = frontmatter.project_id !== undefined ? Number(frontmatter.project_id) : 1000
    const departmentId = Number(frontmatter.department_id)
    const teamId = Number(frontmatter.team_id)
    const roleId = Number(frontmatter.role_id)
    const levelId = Number(frontmatter.level_id)

    // Validate required fields are actual numbers
    if (
      [userId, departmentId, teamId, roleId, levelId].some(
        (v) => isNaN(v) || v <= 0,
      )
    ) {
      logForDebugging(
        `[identity] Invalid numeric fields in ${identityPath} — skipping identity injection`,
        { level: 'warn' },
      )
      return null
    }

    const orgId = frontmatter.org_id ? Number(frontmatter.org_id) : null

    const profile: IdentityProfile = {
      userId,
      orgId,
      departmentId,
      teamId,
      roleId,
      levelId,
      projectId,
    }

    logForDiagnosticsNoPII('info', 'identity_profile_loaded', {
      duration_ms: Date.now() - startTime,
      department_id: departmentId,
      role_id: roleId,
      level_id: levelId,
    })

    return profile
  } catch {
    // File does not exist or is unreadable — identity is optional in V1
    logForDebugging(`[identity] No active identity file at ${identityPath}`)
    return null
  }
}

/**
 * Converts a TeamCC Admin IdentityEnvelope to an IdentityProfile
 */
export function envelopeToProfile(
  envelope: IdentityEnvelope,
  projectId?: number,
): IdentityProfile {
  const subject = envelope.subject
  return {
    userId: subject.userId,
    orgId: subject.orgId ?? null,
    departmentId: subject.departmentId,
    teamId: subject.teamId,
    roleId: subject.roleId,
    levelId: subject.levelId,
    projectId: projectId ?? subject.defaultProjectId ?? 1,
  }
}

/**
 * Loads identity from local file with fallback support
 */
export async function loadLocalIdentityProfile(
  cwd: string,
): Promise<IdentityProfile | null> {
  const identityPath = getTeamCCIdentityPath(cwd)

  try {
    const raw = await getFsImplementation().readFile(identityPath, {
      encoding: 'utf-8',
    })
    const { frontmatter } = parseFrontmatter(raw, identityPath)

    const userId = Number(frontmatter.user_id)
    const projectId = frontmatter.project_id !== undefined ? Number(frontmatter.project_id) : 1000
    const departmentId = Number(frontmatter.department_id)
    const teamId = Number(frontmatter.team_id)
    const roleId = Number(frontmatter.role_id)
    const levelId = Number(frontmatter.level_id)

    if (
      [userId, departmentId, teamId, roleId, levelId].some(
        (v) => isNaN(v) || v <= 0,
      )
    ) {
      return null
    }

    const orgId = frontmatter.org_id ? Number(frontmatter.org_id) : null

    const profile: IdentityProfile = {
      userId,
      orgId,
      departmentId,
      teamId,
      roleId,
      levelId,
      projectId,
    }

    logForDebugging(`[identity] Loaded local identity from ${identityPath}`)
    return profile
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Context string builder (for System Prompt injection)
// ---------------------------------------------------------------------------

/**
 * Generates a human-readable identity context string from a profile,
 * suitable for injection into the model's system prompt.
 */
export function buildIdentityContextString(
  profile: IdentityProfile,
): string {
  const parts = [
    `department=${mapDepartment(profile.departmentId)}`,
    `team=${mapTeam(profile.teamId)}`,
    `role=${mapRole(profile.roleId)}`,
    `level=${mapLevel(profile.levelId)}`,
  ]
  if (profile.orgId !== null) {
    parts.unshift(`org=${mapOrg(profile.orgId)}`)
  }
  return `Current operator identity: ${parts.join(', ')} (user_id=${profile.userId}, project_id=${profile.projectId})`
}

/**
 * Identify if a profile has cross-project privileges
 */
export function isCrossProject(profile: IdentityProfile): boolean {
  return profile.projectId === 0
}
