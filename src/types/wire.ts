/**
 * Shared wire schema between teamcc-admin and teamcc client
 * Version: v1
 */

export interface IdentitySubject {
  userId: number
  username: string
  orgId: number | null
  departmentId: number
  teamId: number
  roleId: number
  levelId: number
  defaultProjectId: number
}

export interface IdentityEnvelope {
  schema: 'teamskill.identity/v1'
  issuedAt: string // ISO 8601
  expiresAt: string // ISO 8601
  subject: IdentitySubject
  signature?: string // ed25519:... V1 optional, V2 required
}

export interface PermissionRule {
  behavior: 'deny' | 'allow' | 'ask'
  tool: string
  content?: string
}

export interface PermissionBundle {
  schema: 'teamskill.permissions/v1'
  bundleId: string
  issuedAt: string // ISO 8601
  expiresAt: string // ISO 8601
  subjectRef: {
    userId: number
    projectId: number
  }
  rules: PermissionRule[]
  capabilities: string[] // e.g. ["policy.read.crossProject:14,21"]
  envOverrides: Record<string, string> // e.g. { "BACKEND_DIR": "src/server/" }
  signature?: string // ed25519:... V1 optional, V2 required
}

export interface AuthResponse {
  accessToken: string // JWT, TTL ~15 min
  refreshToken: string // Opaque, TTL ~7 days, can be revoked
  expiresIn: number // seconds
}

export interface ResolvedPolicy {
  rules: PermissionRule[]
  capabilities: string[]
  envOverrides: Record<string, string>
  expiresAt: string
}
