export const API_BASE = 'http://localhost:3000'
export const AUTH_INVALID_EVENT = 'teamcc-auth-invalid'
export const AUTH_REFRESHED_EVENT = 'teamcc-auth-refreshed'

interface RefreshedAuthDetail {
  accessToken: string
  refreshToken: string
}

let refreshInFlight: Promise<RefreshedAuthDetail> | null = null

class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function notifyAuthInvalid(status = 401) {
  if (status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_INVALID_EVENT))
  }
}

function notifyAuthRefreshed(detail: RefreshedAuthDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<RefreshedAuthDetail>(AUTH_REFRESHED_EVENT, { detail }))
  }
}

async function throwApiError(
  response: Response,
  fallback: string,
  notifyOnUnauthorized = true,
): Promise<never> {
  if (notifyOnUnauthorized) {
    notifyAuthInvalid(response.status)
  }
  const body = await response.json().catch(() => ({}))
  throw new ApiError(body.error || body.message || fallback, response.status)
}

async function refreshAccessToken(): Promise<RefreshedAuthDetail> {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    const storedRefreshToken =
      typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null

    if (!storedRefreshToken) {
      notifyAuthInvalid(401)
      throw new ApiError('Missing refresh token', 401)
    }

    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: storedRefreshToken }),
    })

    if (!response.ok) {
      notifyAuthInvalid(response.status)
      const body = await response.json().catch(() => ({}))
      throw new ApiError(body.error || body.message || 'Refresh failed', response.status)
    }

    const data = await response.json()
    const detail = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? storedRefreshToken,
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', detail.accessToken)
      localStorage.setItem('refreshToken', detail.refreshToken)
    }

    notifyAuthRefreshed(detail)
    return detail
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

async function performAuthorizedFetch(
  url: string,
  token: string,
  options?: RequestInit,
  allowRefresh = true,
) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })

  if (response.status === 401 && allowRefresh) {
    const refreshed = await refreshAccessToken()
    return performAuthorizedFetch(url, refreshed.accessToken, options, false)
  }

  if (!response.ok) {
    await throwApiError(response, `HTTP ${response.status}`, !allowRefresh)
  }

  return response
}

async function apiFetch(url: string, token: string, options?: RequestInit) {
  const res = await performAuthorizedFetch(url, token, options)
  return res.json()
}

export async function login(username: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    throw new Error('Login failed')
  }

  return response.json()
}

export async function refreshToken(token: string) {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
  })

  if (!response.ok) {
    throw new Error('Refresh failed')
  }

  return response.json()
}

export async function logout(token: string) {
  return fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
  })
}

export async function getIdentity(accessToken: string) {
  const response = await performAuthorizedFetch(`${API_BASE}/identity/me`, accessToken)
  return response.json()
}

// ─── Admin: Dictionaries ────────────────────────────────────────────────────

export const getDictionaries = (token: string) =>
  apiFetch(`${API_BASE}/admin/dictionaries`, token)

// ─── Admin: Users ────────────────────────────────────────────────────────────

export const getUsers = (token: string) =>
  apiFetch(`${API_BASE}/admin/users`, token)

export const getEffectivePolicyPreview = (token: string, userId: number, projectId?: number) => {
  const qs = new URLSearchParams()
  if (projectId !== undefined) qs.set('projectId', String(projectId))
  const suffix = qs.size > 0 ? `?${qs}` : ''
  return apiFetch(`${API_BASE}/admin/users/${userId}/effective-policy${suffix}`, token)
}

export const createUser = (token: string, body: Record<string, unknown>) =>
  apiFetch(`${API_BASE}/admin/users`, token, { method: 'POST', body: JSON.stringify(body) })

export const updateUser = (token: string, id: number, body: Record<string, unknown>) =>
  apiFetch(`${API_BASE}/admin/users/${id}`, token, { method: 'PUT', body: JSON.stringify(body) })

export const deleteUser = (token: string, id: number) =>
  apiFetch(`${API_BASE}/admin/users/${id}`, token, { method: 'DELETE' })

// ─── Admin: Templates ────────────────────────────────────────────────────────

export const getTemplates = (token: string) =>
  apiFetch(`${API_BASE}/admin/templates`, token)

export const createTemplate = (token: string, body: Record<string, unknown>) =>
  apiFetch(`${API_BASE}/admin/templates`, token, { method: 'POST', body: JSON.stringify(body) })

export const updateTemplate = (token: string, id: number, body: Record<string, unknown>) =>
  apiFetch(`${API_BASE}/admin/templates/${id}`, token, { method: 'PUT', body: JSON.stringify(body) })

export const deleteTemplate = (token: string, id: number) =>
  apiFetch(`${API_BASE}/admin/templates/${id}`, token, { method: 'DELETE' })

// ─── Admin: Assignments ──────────────────────────────────────────────────────

export const getUserAssignments = (token: string, userId: number) =>
  apiFetch(`${API_BASE}/admin/users/${userId}/assignments`, token)

export const getAllAssignments = (token: string) =>
  apiFetch(`${API_BASE}/admin/assignments`, token)

export const upsertAssignment = (token: string, userId: number, body: Record<string, unknown>) =>
  apiFetch(`${API_BASE}/admin/users/${userId}/assignments`, token, { method: 'POST', body: JSON.stringify(body) })

export const deleteAssignment = (token: string, userId: number, projectId: number) =>
  apiFetch(`${API_BASE}/admin/users/${userId}/assignments/${projectId}`, token, { method: 'DELETE' })

// ─── Admin: Department Policies ──────────────────────────────────────────────

export const getDepartmentPolicies = (token: string, departmentId?: number) => {
  const qs = departmentId ? `?departmentId=${departmentId}` : ''
  return apiFetch(`${API_BASE}/admin/department-policies${qs}`, token)
}

export const createDepartmentPolicy = (token: string, body: Record<string, unknown>) =>
  apiFetch(`${API_BASE}/admin/department-policies`, token, { method: 'POST', body: JSON.stringify(body) })

export const updateDepartmentPolicy = (token: string, id: number, body: Record<string, unknown>) =>
  apiFetch(`${API_BASE}/admin/department-policies/${id}`, token, { method: 'PUT', body: JSON.stringify(body) })

export const deleteDepartmentPolicy = (token: string, id: number) =>
  apiFetch(`${API_BASE}/admin/department-policies/${id}`, token, { method: 'DELETE' })

// ─── Admin: Audit ─────────────────────────────────────────────────────────────

export const getAuditLogs = (
  token: string,
  params?: {
    limit?: number
    offset?: number
    action?: string
    actions?: string[]
    targetType?: string
    severity?: 'info' | 'warning' | 'critical'
  },
) => {
  const qs = new URLSearchParams()
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  if (params?.action) qs.set('action', params.action)
  if (params?.actions?.length) qs.set('actions', params.actions.join(','))
  if (params?.targetType) qs.set('targetType', params.targetType)
  if (params?.severity) qs.set('severity', params.severity)
  return apiFetch(`${API_BASE}/admin/audit?${qs}`, token)
}

// ─── Admin: Skill Graph Integration (Reserved) ──────────────────────────────

export interface SkillGraphCapabilityEntry {
  implemented: boolean
  endpoint: string
  method: 'GET' | 'POST'
}

export interface SkillGraphCapabilitiesResponse {
  service: 'skill-graph'
  status: 'reserved'
  capabilities: {
    import: SkillGraphCapabilityEntry
    weightExport: SkillGraphCapabilityEntry
    executionStats: SkillGraphCapabilityEntry
  }
}

export interface ReservedSkillResponse {
  ok: false
  status: 'not_implemented'
  capability: 'skill_import' | 'weight_export' | 'execution_stats'
  service: 'skill-graph'
  message: string
  input: Record<string, unknown> | null
}

export const getSkillGraphCapabilities = (token: string) =>
  apiFetch(`${API_BASE}/admin/skills/capabilities`, token) as Promise<SkillGraphCapabilitiesResponse>

export const importSkills = (
  token: string,
  body: {
    sourceType?: string
    sourceRef?: string
    dryRun?: boolean
  },
) =>
  apiFetch(`${API_BASE}/admin/skills/import`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<ReservedSkillResponse>

export const exportSkillWeights = (
  token: string,
  params?: {
    format?: string
    scope?: string
    window?: string
  },
) => {
  const qs = new URLSearchParams()
  if (params?.format) qs.set('format', params.format)
  if (params?.scope) qs.set('scope', params.scope)
  if (params?.window) qs.set('window', params.window)
  return apiFetch(`${API_BASE}/admin/skills/weights/export?${qs}`, token) as Promise<ReservedSkillResponse>
}

export const getSkillExecutionStats = (
  token: string,
  params?: {
    window?: string
    groupBy?: string
    skillId?: string
  },
) => {
  const qs = new URLSearchParams()
  if (params?.window) qs.set('window', params.window)
  if (params?.groupBy) qs.set('groupBy', params.groupBy)
  if (params?.skillId) qs.set('skillId', params.skillId)
  return apiFetch(`${API_BASE}/admin/skills/execution-stats?${qs}`, token) as Promise<ReservedSkillResponse>
}

// ─── Policy Bundle (for Claude Code) ───────────────────────────────────────────

export const getPolicyBundle = (token: string, projectId: number, userId?: number) => {
  const qs = new URLSearchParams()
  qs.set('projectId', String(projectId))
  if (userId) qs.set('userId', String(userId))
  return apiFetch(`${API_BASE}/policy/bundle?${qs}`, token)
}
