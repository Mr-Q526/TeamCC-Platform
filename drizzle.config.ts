import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'teamcc_admin',
    password: process.env.DB_PASSWORD || 'teamcc_admin_dev_password',
    database: process.env.DB_NAME || 'teamcc_admin',
    ssl: false,
  },
} satisfies Config
