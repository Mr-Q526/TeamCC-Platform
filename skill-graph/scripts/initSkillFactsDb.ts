import {
  closeSkillFactPgPool,
  ensureSkillFactEventsTable,
  resolveSkillFactPgConfig,
} from '../src/events/storage.js'
import { ensureSkillFeedbackAggregatesTable } from '../src/aggregates/storage.js'

async function main(): Promise<void> {
  const config = resolveSkillFactPgConfig()
  await ensureSkillFactEventsTable()
  await ensureSkillFeedbackAggregatesTable()
  const connectionString = config.connectionString
    ? config.connectionString.replace(/:(.*?)@/, ':***@')
    : '<unknown>'
  console.log(
    `Initialized skill_fact_events and skill_feedback_aggregates tables using ${connectionString}`,
  )
  await closeSkillFactPgPool()
}

main().catch(async error => {
  console.error(error instanceof Error ? error.message : String(error))
  await closeSkillFactPgPool().catch(() => {})
  process.exit(1)
})
