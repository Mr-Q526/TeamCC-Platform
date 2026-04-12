import {
  closeSkillFactPgPool,
  ensureSkillFactEventsTable,
  resolveSkillFactPgConfig,
} from '../src/events/storage.js'

async function main(): Promise<void> {
  const config = resolveSkillFactPgConfig()
  await ensureSkillFactEventsTable()
  const connectionString = config.connectionString
    ? config.connectionString.replace(/:(.*?)@/, ':***@')
    : '<unknown>'
  console.log(
    `Initialized skill_fact_events table using ${connectionString}`,
  )
  await closeSkillFactPgPool()
}

main().catch(async error => {
  console.error(error instanceof Error ? error.message : String(error))
  await closeSkillFactPgPool().catch(() => {})
  process.exit(1)
})
