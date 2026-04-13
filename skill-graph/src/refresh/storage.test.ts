import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createSkillFactEvent } from '../events/skillFacts.js'
import {
  closeSkillFactPgPool,
  ensureSkillFactEventsTable,
  querySkillFactEvents,
  querySkillFactPg,
} from '../events/storage.js'
import {
  claimSkillGraphRefreshRequest,
  ensureSkillGraphRefreshRequestsTable,
  finalizeSkillGraphRefreshRequest,
  insertSkillFactEventAndRequestRefresh,
  querySkillGraphRefreshRequests,
  resolveSkillGraphRefreshWindow,
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
    sourceHash: 'sha256:refresh-test',
    context: {
      projectId: 'project:refresh-test',
      department: 'frontend-platform',
      scene: 'admin-console',
      domain: 'frontend',
    },
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

describe('skill graph refresh storage', () => {
  beforeEach(async () => {
    restoreEnv()
    process.env.SKILL_GRAPH_REFRESH_WINDOW = '30d'
    await resetTables()
  })

  afterEach(async () => {
    restoreEnv()
    await closeSkillFactPgPool().catch(() => {})
  })

  test('writes fact event and refresh request in one transaction', async () => {
    const first = await insertSkillFactEventAndRequestRefresh(makeEvent('evt-1'))
    const second = await insertSkillFactEventAndRequestRefresh(makeEvent('evt-2'))

    expect(first.eventInserted).toBe(true)
    expect(second.eventInserted).toBe(true)

    const events = await querySkillFactEvents({
      factKinds: ['skill_feedback'],
      limit: 10,
    })
    const requests = await querySkillGraphRefreshRequests({ limit: 10 })

    expect(events).toHaveLength(2)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      jobKey: `refresh:${resolveSkillGraphRefreshWindow()}`,
      window: '30d',
      status: 'pending',
      lastEventId: 'evt-2',
      lastFactKind: 'skill_feedback',
      requestCount: 2,
    })
  })

  test('keeps request pending when newer feedback arrives during a running job', async () => {
    await insertSkillFactEventAndRequestRefresh(makeEvent('evt-1'))
    const claim = await claimSkillGraphRefreshRequest('refresh:30d')
    expect(claim).not.toBeNull()

    await insertSkillFactEventAndRequestRefresh(makeEvent('evt-2'))
    const finalized = await finalizeSkillGraphRefreshRequest(claim!, {
      succeeded: true,
    })

    expect(finalized?.status).toBe('pending')
    expect(finalized?.requestCount).toBe(2)
    expect(finalized?.lastEventId).toBe('evt-2')
  })

  test('reclaims timed-out running jobs', async () => {
    await insertSkillFactEventAndRequestRefresh(makeEvent('evt-1'))
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

    const claim = await claimSkillGraphRefreshRequest('refresh:30d', {
      runningTimeoutMs: 60_000,
    })

    expect(claim).not.toBeNull()
    expect(claim?.request.status).toBe('running')
    expect(claim?.request.attemptCount).toBe(1)
  })
})
