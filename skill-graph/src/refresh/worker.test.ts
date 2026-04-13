import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createSkillFactEvent } from '../events/skillFacts.js'
import {
  closeSkillFactPgPool,
  ensureSkillFactEventsTable,
  querySkillFactPg,
} from '../events/storage.js'
import {
  claimSkillGraphRefreshRequest,
  ensureSkillGraphRefreshRequestsTable,
  insertSkillFactEventAndRequestRefresh,
  querySkillGraphRefreshRequests,
} from './storage.js'
import { runSkillGraphRefreshJob } from './worker.js'

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
    sourceHash: 'sha256:worker-test',
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

describe('skill graph refresh worker', () => {
  beforeEach(async () => {
    process.env.SKILL_GRAPH_REFRESH_WINDOW = '30d'
    await resetTables()
  })

  afterEach(async () => {
    await closeSkillFactPgPool().catch(() => {})
  })

  test('marks claimed job as succeeded after executor completes', async () => {
    await insertSkillFactEventAndRequestRefresh(makeEvent('evt-worker-success'))
    const claim = await claimSkillGraphRefreshRequest('refresh:30d')
    const executor = mock(async () => {})

    await runSkillGraphRefreshJob(claim!, executor)

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith('30d')

    const [request] = await querySkillGraphRefreshRequests({ limit: 1 })
    expect(request?.status).toBe('succeeded')
    expect(request?.lastError).toBeNull()
  })

  test('marks claimed job as failed when executor throws', async () => {
    await insertSkillFactEventAndRequestRefresh(makeEvent('evt-worker-failed'))
    const claim = await claimSkillGraphRefreshRequest('refresh:30d')

    await expect(
      runSkillGraphRefreshJob(claim!, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    const [request] = await querySkillGraphRefreshRequests({ limit: 1 })
    expect(request?.status).toBe('failed')
    expect(request?.lastError).toContain('boom')
  })
})
