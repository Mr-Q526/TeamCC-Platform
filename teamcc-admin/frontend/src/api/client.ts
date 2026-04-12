export const API_BASE = 'http://localhost:3000'

async function apiFetch(url: string, token: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
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
  const response = await fetch(`${API_BASE}/identity/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch identity')
  }

  return response.json()
}

// ─── Admin: Dictionaries ────────────────────────────────────────────────────

export const getDictionaries = (token: string) =>
  apiFetch(`${API_BASE}/admin/dictionaries`, token)

// ─── Admin: Users ────────────────────────────────────────────────────────────

export const getUsers = (token: string) =>
  apiFetch(`${API_BASE}/admin/users`, token)

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

export const getAuditLogs = (token: string, params?: { limit?: number; offset?: number }) => {
  const qs = new URLSearchParams()
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  return apiFetch(`${API_BASE}/admin/audit?${qs}`, token)
}

// ─── Policy Bundle (for Claude Code) ───────────────────────────────────────────

export const getPolicyBundle = (token: string, projectId: number, userId?: number) => {
  const qs = new URLSearchParams()
  qs.set('projectId', String(projectId))
  if (userId) qs.set('userId', String(userId))
  return apiFetch(`${API_BASE}/policy/bundle?${qs}`, token)
}
