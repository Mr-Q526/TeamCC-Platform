import type { FastifyInstance } from 'fastify'
import {
  authenticateUser,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
} from '../services/auth.js'
import type { AuthResponse } from '../types/wire.js'

export async function registerAuthRoutes(fastify: FastifyInstance) {
  /**
   * POST /auth/login
   * Login with username/password, return access + refresh tokens
   */
  fastify.post<{ Body: { username: string; password: string } }>(
    '/auth/login',
    async (request, reply) => {
      const { username, password } = request.body

      if (!username || !password) {
        return reply.status(400).send({ error: 'Missing username or password' })
      }

      try {
        const user = await authenticateUser(username, password)

        const accessToken = generateAccessToken(user.id, user.username)
        const refreshToken = await generateRefreshToken(
          user.id,
          request.headers['user-agent']
        )

        const response: AuthResponse = {
          accessToken,
          refreshToken,
          expiresIn: 900, // 15 minutes
        }

        return reply.send(response)
      } catch (error) {
        return reply.status(401).send({ error: 'Authentication failed' })
      }
    }
  )

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  fastify.post<{ Body: { refreshToken: string } }>(
    '/auth/refresh',
    async (request, reply) => {
      const { refreshToken } = request.body

      if (!refreshToken) {
        return reply.status(400).send({ error: 'Missing refreshToken' })
      }

      try {
        const userId = await verifyRefreshToken(refreshToken)
        const user = await Promise.resolve(userId) // Fetch user to get username
          .then(async (id) => {
            const { users } = await import('../db/schema.js')
            const { eq } = await import('drizzle-orm')
            const { db } = await import('../db/index.js')
            return db
              .select()
              .from(users)
              .where(eq(users.id, id))
              .limit(1)
              .then((rows) => rows[0])
          })

        if (!user) {
          throw new Error('User not found')
        }

        const accessToken = generateAccessToken(user.id, user.username)

        const response: AuthResponse = {
          accessToken,
          refreshToken, // Return same refresh token
          expiresIn: 900,
        }

        return reply.send(response)
      } catch (error) {
        return reply.status(401).send({ error: 'Invalid refresh token' })
      }
    }
  )

  /**
   * POST /auth/logout
   * Revoke refresh token
   */
  fastify.post<{ Body: { refreshToken: string } }>(
    '/auth/logout',
    async (request, reply) => {
      const { refreshToken } = request.body

      if (!refreshToken) {
        return reply.status(400).send({ error: 'Missing refreshToken' })
      }

      try {
        await revokeRefreshToken(refreshToken)
        return reply.send({ status: 'ok' })
      } catch (error) {
        return reply.status(400).send({ error: 'Logout failed' })
      }
    }
  )
}
