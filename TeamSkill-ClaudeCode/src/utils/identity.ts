/**
 * Identity profile loader.
 *
 * Converts verified TeamCC identity payloads into runtime IdentityProfile
 * objects and exposes optional display labels when TeamCC provides them.
 */

import { logForDebugging } from './debug.js'
import { logForDiagnosticsNoPII } from './diagLogs.js'
import type { IdentityEnvelope } from '../bootstrap/teamccAuth.js'
import { loadCachedIdentity } from '../bootstrap/teamccAuth.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IdentityProfile = {
  userId: number
  username?: string
  orgId: number | null
  departmentId: number
  teamId: number
  roleId: number
  levelId: number
  projectId: number
  orgLabel?: string | null
  departmentLabel?: string
  teamLabel?: string
  roleLabel?: string
  levelLabel?: string
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function normalizeIdentityLabel(value: string | null | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function formatIdentityFallback(kind: string, id: number | null | undefined): string {
  return id === null || id === undefined ? `${kind}=unknown` : `${kind}_id=${id}`
}

function formatIdentityContextValue(
  kind: string,
  id: number | null | undefined,
  label?: string | null,
): string {
  const normalized = normalizeIdentityLabel(label)
  return normalized ? `${kind}=${normalized}` : formatIdentityFallback(kind, id)
}

export function mapDepartment(
  id: number,
  label?: string | null,
): string {
  return normalizeIdentityLabel(label) ?? formatIdentityFallback('department', id)
}

export function mapRole(
  id: number,
  label?: string | null,
): string {
  return normalizeIdentityLabel(label) ?? formatIdentityFallback('role', id)
}

export function mapLevel(
  id: number,
  label?: string | null,
): string {
  return normalizeIdentityLabel(label) ?? formatIdentityFallback('level', id)
}

export function mapOrg(
  id: number | null,
  label?: string | null,
): string {
  return normalizeIdentityLabel(label) ?? formatIdentityFallback('org', id)
}

export function mapTeam(
  id: number,
  label?: string | null,
): string {
  return normalizeIdentityLabel(label) ?? formatIdentityFallback('team', id)
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
  const labels = envelope.labels
  return {
    userId: subject.userId,
    username: normalizeIdentityLabel(subject.username),
    orgId: subject.orgId ?? null,
    departmentId: subject.departmentId,
    teamId: subject.teamId,
    roleId: subject.roleId,
    levelId: subject.levelId,
    projectId: projectId ?? subject.defaultProjectId ?? 1,
    orgLabel:
      normalizeIdentityLabel(labels?.org) ??
      normalizeIdentityLabel(subject.orgLabel) ??
      normalizeIdentityLabel(subject.orgName) ??
      null,
    departmentLabel:
      normalizeIdentityLabel(labels?.department) ??
      normalizeIdentityLabel(subject.departmentLabel) ??
      normalizeIdentityLabel(subject.departmentName),
    teamLabel:
      normalizeIdentityLabel(labels?.team) ??
      normalizeIdentityLabel(subject.teamLabel) ??
      normalizeIdentityLabel(subject.teamName),
    roleLabel:
      normalizeIdentityLabel(labels?.role) ??
      normalizeIdentityLabel(subject.roleLabel) ??
      normalizeIdentityLabel(subject.roleName),
    levelLabel:
      normalizeIdentityLabel(labels?.level) ??
      normalizeIdentityLabel(subject.levelLabel) ??
      normalizeIdentityLabel(subject.levelName),
  }
}

/**
 * Backwards-compatible alias for cached TeamCC identity loading.
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
    formatIdentityContextValue(
      'department',
      profile.departmentId,
      profile.departmentLabel,
    ),
    formatIdentityContextValue('team', profile.teamId, profile.teamLabel),
    formatIdentityContextValue('role', profile.roleId, profile.roleLabel),
    formatIdentityContextValue('level', profile.levelId, profile.levelLabel),
  ]
  if (profile.orgId !== null) {
    parts.unshift(formatIdentityContextValue('org', profile.orgId, profile.orgLabel))
  }
  return `Current operator identity: ${parts.join(', ')} (user_id=${profile.userId}, project_id=${profile.projectId})`
}
