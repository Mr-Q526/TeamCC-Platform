import type { FastifyInstance } from 'fastify'
import { buildIdentityEnvelope, buildPermissionBundle } from '../services/policy.js'

/**
 * Middleware to verify JWT token and extract userId
 */
async function verifyToken(fastify: FastifyInstance, request: any) {
  try {
    await request.jwtVerify()
    return (request.user as any).userId
  } catch (error) {
    throw new Error('Invalid token')
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
      const userId = await verifyToken(fastify, request)
      const envelope = await buildIdentityEnvelope(userId)
      return reply.send(envelope)
    } catch (error) {
      return reply.status(401).send({ error: 'Unauthorized' })
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
        const userId = await verifyToken(fastify, request)
        const projectId = request.query.projectId
          ? parseInt(request.query.projectId)
          : 1 // Default to project 1

        if (isNaN(projectId)) {
          return reply.status(400).send({ error: 'Invalid projectId' })
        }

        const bundle = await buildPermissionBundle(userId, projectId)
        return reply.send(bundle)
      } catch (error) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }
    }
  )
}
