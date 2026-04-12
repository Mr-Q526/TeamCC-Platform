/**
 * Identity Profile loader and ID-to-label mapping cache.
 *
 * Reads `.claude/identity/active.md` (YAML frontmatter only), parses the
 * numeric ID fields into a typed IdentityProfile, and provides a cached
 * mapping layer that converts IDs to human-readable labels for Skill
 * retrieval and model context injection.
 */

import { join } from 'path'
import { getFsImplementation } from './fsOperations.js'
import { logForDebugging } from './debug.js'
import { logForDiagnosticsNoPII } from './diagLogs.js'
import type { IdentityEnvelope } from '../bootstrap/teamccAuth.js'
import { getTeamCCIdentityPath } from './teamccPaths.js'
import { loadCachedIdentity } from '../bootstrap/teamccAuth.js'

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
  orgLabel?: string | null
  departmentLabel?: string | null
  teamLabel?: string | null
  roleLabel?: string | null
  levelLabel?: string | null
  projectLabel?: string | null
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

export function mapDepartment(id: number, explicitLabel?: string | null): string {
  return explicitLabel ?? DEPARTMENT_MAP[id] ?? `unknown_dept(${id})`
}

export function mapRole(id: number, explicitLabel?: string | null): string {
  return explicitLabel ?? ROLE_MAP[id] ?? `unknown_role(${id})`
}

export function mapLevel(id: number, explicitLabel?: string | null): string {
  return explicitLabel ?? LEVEL_MAP[id] ?? `unknown_level(${id})`
}

export function mapOrg(id: number, explicitLabel?: string | null): string {
  return explicitLabel ?? ORG_MAP[id] ?? `unknown_org(${id})`
}

export function mapTeam(id: number, explicitLabel?: string | null): string {
  return explicitLabel ?? TEAM_MAP[id] ?? `unknown_team(${id})`
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads the active identity profile from the local cache.
 * Returns null if the cache is missing or malformed.
 */
export async function loadIdentityProfile(
  cwd: string,
): Promise<IdentityProfile | null> {
  const startTime = Date.now()

  try {
    const envelope = await loadCachedIdentity(cwd)
    if (!envelope) {
      logForDebugging(`[identity] No cached identity found in ${cwd}`)
      return null
    }

    const profile = envelopeToProfile(envelope)

    logForDiagnosticsNoPII('info', 'identity_profile_loaded', {
      duration_ms: Date.now() - startTime,
      department_id: profile.departmentId,
      role_id: profile.roleId,
      level_id: profile.levelId,
    })

    return profile
  } catch (error) {
    logForDebugging(`[identity] Failed to load identity profile: ${(error as Error).message}`)
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
  const display = subject.display

  return {
    userId: subject.userId,
    orgId: subject.orgId ?? null,
    departmentId: subject.departmentId,
    teamId: subject.teamId,
    roleId: subject.roleId,
    levelId: subject.levelId,
    projectId: projectId ?? subject.defaultProjectId ?? 1,
    orgLabel: display?.org ?? null,
    departmentLabel: display?.department ?? null,
    teamLabel: display?.team ?? null,
    roleLabel: display?.role ?? null,
    levelLabel: display?.level ?? null,
    projectLabel: display?.defaultProject ?? null,
  }
}

/**
 * Loads identity from local cache with fallback support
 */
export async function loadLocalIdentityProfile(
  cwd: string,
): Promise<IdentityProfile | null> {
  return loadIdentityProfile(cwd)
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
    `department=${mapDepartment(profile.departmentId, profile.departmentLabel)}`,
    `team=${mapTeam(profile.teamId, profile.teamLabel)}`,
    `role=${mapRole(profile.roleId, profile.roleLabel)}`,
    `level=${mapLevel(profile.levelId, profile.levelLabel)}`,
  ]
  if (profile.orgId !== null) {
    parts.unshift(`org=${mapOrg(profile.orgId, profile.orgLabel)}`)
  }
  return `Current operator identity: ${parts.join(', ')} (user_id=${profile.userId}, project_id=${profile.projectId})`
}
