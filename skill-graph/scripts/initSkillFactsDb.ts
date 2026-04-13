import {
  closeSkillFactPgPool,
  ensureSkillFactEventsTable,
  resolveSkillFactPgConfig,
} from '../src/events/storage.js'
import { ensureSkillGraphRefreshRequestsTable } from '../src/refresh/storage.js'
import { ensureSkillFeedbackAggregatesTable } from '../src/aggregates/storage.js'

async function main(): Promise<void> {
  const config = resolveSkillFactPgConfig()
  await ensureSkillFactEventsTable()
  await ensureSkillGraphRefreshRequestsTable()
  await ensureSkillFeedbackAggregatesTable()
  const connectionString = config.connectionString
    ? config.connectionString.replace(/:(.*?)@/, ':***@')
    : '<unknown>'
  console.log(
    `Initialized skill_fact_events, skill_graph_refresh_requests, and skill_feedback_aggregates tables using ${connectionString}`,
  )
  await closeSkillFactPgPool()
}

main().catch(async error => {
  console.error(error instanceof Error ? error.message : String(error))
  await closeSkillFactPgPool().catch(() => {})
  process.exit(1)
})
