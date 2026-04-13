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
  publishRefreshRequest,
  readRefreshStreamMessages,
} from './redis.js'
import {
  ensureSkillGraphRefreshRequestsTable,
  insertSkillFactEventAndRequestRefresh,
  querySkillGraphRefreshRequests,
} from './storage.js'

const ORIGINAL_ENV = { ...process.env }

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key]
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

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
    sourceHash: 'sha256:redis-test',
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

describe('skill graph refresh redis publishing', () => {
  beforeEach(async () => {
    restoreEnv()
    process.env.SKILL_GRAPH_REFRESH_WINDOW = '30d'
    await resetTables()
  })

  afterEach(async () => {
    restoreEnv()
    await closeSkillRedisClient().catch(() => {})
    await closeSkillFactPgPool().catch(() => {})
  })

  test('publishes refresh requests to redis stream and marks them published', async () => {
    process.env.SKILL_GRAPH_REFRESH_STREAM = `skill-graph-test-${randomUUID()}`
    process.env.SKILL_GRAPH_REFRESH_GROUP = `group-${randomUUID()}`

    const { request } = await insertSkillFactEventAndRequestRefresh(
      makeEvent('evt-redis-success'),
    )

    await publishRefreshRequest(request)
    const messages = await readRefreshStreamMessages({
      consumerName: 'test-consumer',
      count: 1,
      blockMs: 50,
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      jobKey: 'refresh:30d',
      window: '30d',
      requestedAt: request.requestedAt,
      lastEventId: 'evt-redis-success',
    })
    await acknowledgeRefreshStreamMessage(messages[0]!.id)

    const [stored] = await querySkillGraphRefreshRequests({ limit: 1 })
    expect(stored?.status).toBe('published')
  })

  test('returns request to pending when redis publish fails', async () => {
    process.env.SKILL_GRAPH_REFRESH_STREAM = `skill-graph-test-${randomUUID()}`
    process.env.SKILL_GRAPH_REFRESH_GROUP = `group-${randomUUID()}`
    process.env.SKILL_REDIS_PORT = '1'

    const { request } = await insertSkillFactEventAndRequestRefresh(
      makeEvent('evt-redis-failed'),
    )

    await expect(publishRefreshRequest(request)).rejects.toBeDefined()

    const [stored] = await querySkillGraphRefreshRequests({ limit: 1 })
    expect(stored?.status).toBe('pending')
  })
})
