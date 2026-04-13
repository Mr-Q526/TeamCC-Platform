import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { randomUUID } from 'crypto'
import { createSkillFactEvent } from '../events/skillFacts.js'
import {
  closeSkillFactPgPool,
  ensureSkillFactEventsTable,
  querySkillFactPg,
} from '../events/storage.js'
import {
  acknowledgeRefreshStreamMessage,
  closeSkillRedisClient,
  readRefreshStreamMessages,
} from './redis.js'
import { reconcileRefreshRequests } from './reconcile.js'
import {
  ensureSkillGraphRefreshRequestsTable,
  insertSkillFactEventAndRequestRefresh,
  querySkillGraphRefreshRequests,
} from './storage.js'

function makeEvent(eventId: string) {
  return createSkillFactEvent({
    eventId,
    factKind: 'skill_feedback',
    source: 'user',
    traceId: `trace-${eventId}`,
    taskId: `task-${eventId}`,
    retrievalRoundId: `round-${eventId}`,
    skillId: 'frontend/admin-dashboard-design',
    skillName: 'admin-dashboard-design',
    skillVersion: '2.2.0-pro',
    sourceHash: 'sha256:reconcile-test',
    feedback: {
      rating: 5,
      sentiment: 'positive',
      comment: 'great',
    },
  })
}

async function resetTables(): Promise<void> {
  await ensureSkillFactEventsTable()
  await ensureSkillGraphRefreshRequestsTable()
  await querySkillFactPg('DELETE FROM skill_graph_refresh_requests')
  await querySkillFactPg('DELETE FROM skill_fact_events')
}

describe('skill graph refresh reconciliation', () => {
  beforeEach(async () => {
    process.env.SKILL_GRAPH_REFRESH_WINDOW = '30d'
    process.env.SKILL_GRAPH_REFRESH_STREAM = `skill-graph-test-${randomUUID()}`
    process.env.SKILL_GRAPH_REFRESH_GROUP = `group-${randomUUID()}`
    await resetTables()
  })

  afterEach(async () => {
    await closeSkillRedisClient().catch(() => {})
    await closeSkillFactPgPool().catch(() => {})
  })

  test('republishes timed-out running jobs', async () => {
    await insertSkillFactEventAndRequestRefresh(makeEvent('evt-reconcile'))
    await querySkillFactPg(
      `
UPDATE skill_graph_refresh_requests
SET
  status = 'running',
  started_at = now() - interval '10 minutes',
  updated_at = now() - interval '10 minutes'
WHERE job_key = 'refresh:30d'
`,
    )

    const result = await reconcileRefreshRequests({
      runningTimeoutMs: 1000,
      limit: 10,
    })
    expect(result.republished).toBe(1)

    const messages = await readRefreshStreamMessages({
      consumerName: 'reconcile-consumer',
      blockMs: 50,
      count: 1,
    })
    expect(messages).toHaveLength(1)
    expect(messages[0]?.jobKey).toBe('refresh:30d')
    await acknowledgeRefreshStreamMessage(messages[0]!.id)

    const [stored] = await querySkillGraphRefreshRequests({ limit: 1 })
    expect(stored?.status).toBe('published')
  })
})
