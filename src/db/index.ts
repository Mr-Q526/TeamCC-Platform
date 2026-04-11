import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

const dbPath = process.env.DATABASE_PATH || './teamcc-admin.db'
const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')

export const db = drizzle(sqlite, { schema })

export async function initializeDatabase() {
  // TODO: Run migrations using drizzle-kit
  // For now, tables will be created on-demand by drizzle
  console.log(`✓ Database initialized at ${dbPath}`)
}

export { sqlite }
