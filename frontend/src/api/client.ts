export const API_BASE = 'http://localhost:3000'

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
