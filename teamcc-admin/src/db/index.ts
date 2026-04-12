import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema.js'

const databaseUrl = process.env.DATABASE_URL || 'postgresql://teamcc_admin:teamcc_admin_dev_password@localhost:5432/teamcc_admin'

const pool = new Pool({
  connectionString: databaseUrl,
})

export const db = drizzle(pool, { schema })

export async function initializeDatabase() {
  try {
    // Test connection
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    console.log('✓ Database connection established')
  } catch (error) {
    console.error('✗ Database connection failed:', error)
    throw error
  }
}

export { pool }
