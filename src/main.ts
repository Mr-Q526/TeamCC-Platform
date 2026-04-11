import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import { initializeDatabase } from './db/index.js'
import { registerAuthRoutes } from './api/auth.js'
import { registerClientRoutes } from './api/client.js'

const PORT = parseInt(process.env.PORT || '3000')
const HOST = process.env.HOST || '127.0.0.1'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

async function start() {
  // Initialize database connection
  await initializeDatabase()

  const fastify = Fastify({
    logger: true,
  })

  // Register plugins
  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  })
  await fastify.register(fastifyJwt, {
    secret: JWT_SECRET,
  })

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }))

  // Register route groups
  await registerAuthRoutes(fastify)
  await registerClientRoutes(fastify)
  // TODO: Register admin routes

  try {
    await fastify.listen({ port: PORT, host: HOST })
    console.log(`✓ Server listening on http://${HOST}:${PORT}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
