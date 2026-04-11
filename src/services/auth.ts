import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { users, apiTokens } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const SALT_ROUNDS = 10

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Compare password with hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Find user by username and verify password
 */
export async function authenticateUser(
  username: string,
  password: string
) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
    .then((rows) => rows[0])

  if (!user) {
    throw new Error('User not found')
  }

  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) {
    throw new Error('Invalid password')
  }

  return user
}

/**
 * Generate JWT access token
 * Note: fastify-jwt expects payload to have standard claims
 */
export function generateAccessToken(userId: number, username: string): string {
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = 900 // 15 minutes
  const exp = now + expiresIn

  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    sub: String(userId), // Standard JWT claim for subject
    userId,
    username,
    iat: now,
    exp,
  }

  // Simple JWT encoding
  const encoded = Buffer.from(JSON.stringify(header)).toString('base64url') +
    '.' +
    Buffer.from(JSON.stringify(payload)).toString('base64url')

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(encoded)
    .digest('base64url')

  return encoded + '.' + signature
}

/**
 * Generate opaque refresh token and store in database
 */
export async function generateRefreshToken(
  userId: number,
  deviceLabel?: string
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await db.insert(apiTokens).values({
    userId,
    tokenHash,
    deviceLabel,
    expiresAt,
  })

  return token
}

/**
 * Verify and redeem refresh token
 */
export async function verifyRefreshToken(token: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const storedToken = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, tokenHash))
    .limit(1)
    .then((rows) => rows[0])

  if (!storedToken) {
    throw new Error('Invalid refresh token')
  }

  if (storedToken.revokedAt) {
    throw new Error('Token revoked')
  }

  if (storedToken.expiresAt && storedToken.expiresAt < new Date()) {
    throw new Error('Token expired')
  }

  // Update last used time
  await db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, storedToken.id))

  return storedToken.userId
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(eq(apiTokens.tokenHash, tokenHash))
}
