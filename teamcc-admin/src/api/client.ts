import type { FastifyInstance } from 'fastify'
import {
  buildIdentityEnvelope,
  buildPermissionBundle,
  getDefaultProjectIdForUser,
} from '../services/policy.js'
import { JWT_SECRET, requireActiveUserById } from '../services/auth.js'
import crypto from 'crypto'

/**
 * Middleware to verify JWT token and extract userId
 */
async function verifyToken(request: any) {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header')
  }

  const token = authHeader.slice(7)
  const parts = token.split('.')

  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }

  try {
    // Verify signature
    const [header, payload, signature] = parts
    const message = header + '.' + payload

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(message)
      .digest('base64url')

    if (signature !== expectedSignature) {
      throw new Error('Invalid signature')
    }

    // Decode payload
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf-8')
    )

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (decoded.exp && decoded.exp < now) {
      throw new Error('Token expired')
    }

    await requireActiveUserById(decoded.userId)

    return decoded.userId
  } catch (error) {
    throw new Error('Invalid token: ' + (error as any).message)
  }
}

export async function registerClientRoutes(fastify: FastifyInstance) {
  /**
   * GET /identity/me
   * Get current user's identity envelope
   * Requires: Authorization header with valid access token
   */
  fastify.get('/identity/me', async (request, reply) => {
    try {
      const userId = await verifyToken(request)
      const envelope = await buildIdentityEnvelope(userId)
      return reply.send(envelope)
    } catch (error) {
      return reply.status(401).send({ error: 'Unauthorized', message: (error as any).message })
    }
  })

  /**
   * GET /policy/bundle
   * Get permission bundle for user + project
   * Query params: projectId (optional, defaults to user's default project)
   * Requires: Authorization header with valid access token
   */
  fastify.get<{ Querystring: { projectId?: string } }>(
    '/policy/bundle',
    async (request, reply) => {
      try {
        const userId = await verifyToken(request)
        const projectId = request.query.projectId
          ? parseInt(request.query.projectId)
          : await getDefaultProjectIdForUser(userId)

        if (isNaN(projectId)) {
          return reply.status(400).send({ error: 'Invalid projectId' })
        }

        const bundle = await buildPermissionBundle(userId, projectId)
        return reply.send(bundle)
      } catch (error) {
        return reply.status(401).send({ error: 'Unauthorized', message: (error as any).message })
      }
    }
  )
}
