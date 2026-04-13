import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createSkillFactEvent } from '../../skill-graph/src/events/skillFacts.js'
import {
  closeSkillFactPgPool,
  querySkillFactEvents,
  querySkillFactPg,
} from '../../skill-graph/src/events/storage.js'
import { closeSkillRedisClient } from '../../skill-graph/src/refresh/redis.js'
import {
  ensureSkillGraphRefreshRequestsTable,
  querySkillGraphRefreshRequests,
} from '../../skill-graph/src/refresh/storage.js'
import {
  logSkillFactEvent,
  resolveSkillFactSinkMode,
} from '../src/services/skillSearch/telemetry.js'

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

describe('skill fact telemetry sink mode', () => {
  beforeEach(async () => {
    restoreEnv()
    await ensureSkillGraphRefreshRequestsTable().catch(() => {})
    await querySkillFactPg('DELETE FROM skill_graph_refresh_requests').catch(() => {})
    await querySkillFactPg('DELETE FROM skill_fact_events').catch(() => {})
    await closeSkillFactPgPool().catch(() => {})
  })

  afterEach(async () => {
    restoreEnv()
    await closeSkillRedisClient().catch(() => {})
    await closeSkillFactPgPool().catch(() => {})
  })

  test('returns off when eval telemetry is disabled', () => {
    process.env.SKILL_EVAL_TELEMETRY = 'off'
    expect(resolveSkillFactSinkMode()).toBe('off')
  })

  test('respects explicit sink mode', () => {
    process.env.SKILL_FACT_SINK = 'jsonl'
    expect(resolveSkillFactSinkMode()).toBe('jsonl')

    process.env.SKILL_FACT_SINK = 'postgres'
    expect(resolveSkillFactSinkMode()).toBe('postgres')
  })

  test('defaults to postgres when PG config can be resolved', () => {
    delete process.env.SKILL_FACT_SINK
    delete process.env.SKILL_EVAL_TELEMETRY
    expect(resolveSkillFactSinkMode()).toBe('postgres')
  })

  test('falls back to JSONL when postgres sink write fails', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'skill-facts-'))
    const filePath = join(tempDir, 'events.jsonl')

    process.env.SKILL_FACT_SINK = 'postgres'
    process.env.SKILL_PG_URL = 'postgres://skills:skills_dev_password@127.0.0.1:1/skills'
    process.env.SKILL_FACT_EVENTS_PATH = filePath

    const event = createSkillFactEvent({
      eventId: 'evt-fallback',
      factKind: 'skill_feedback',
      source: 'user',
      traceId: 'trace-fallback',
      taskId: 'task-fallback',
      retrievalRoundId: 'retrieval-fallback',
      skillId: 'frontend/admin-dashboard-design',
      skillName: 'admin-dashboard-design',
      skillVersion: '2.2.0-pro',
      sourceHash: 'sha256:fallback',
      feedback: {
        rating: 1,
        sentiment: 'negative',
        comment: 'fallback',
      },
    })

    await logSkillFactEvent(event)

    const contents = await readFile(filePath, 'utf-8')
    expect(contents).toContain('"eventId":"evt-fallback"')

    await rm(tempDir, { recursive: true, force: true })
  })

  test('shadow mode keeps PG as source of truth when redis publish fails', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'skill-facts-shadow-'))
    const filePath = join(tempDir, 'events.jsonl')

    process.env.SKILL_FACT_SINK = 'postgres'
    process.env.SKILL_GRAPH_REFRESH_MODE = 'shadow'
    process.env.SKILL_REDIS_PORT = '1'
    process.env.SKILL_FACT_EVENTS_PATH = filePath

    const event = createSkillFactEvent({
      eventId: 'evt-shadow',
      factKind: 'skill_feedback',
      source: 'user',
      traceId: 'trace-shadow',
      taskId: 'task-shadow',
      retrievalRoundId: 'retrieval-shadow',
      skillId: 'frontend/admin-dashboard-design',
      skillName: 'admin-dashboard-design',
      skillVersion: '2.2.0-pro',
      sourceHash: 'sha256:shadow',
      feedback: {
        rating: 5,
        sentiment: 'positive',
        comment: 'shadow',
      },
    })

    await logSkillFactEvent(event)

    const requests = await querySkillGraphRefreshRequests({ limit: 10 })
    const events = await querySkillFactEvents({
      factKinds: ['skill_feedback'],
      limit: 10,
    })

    expect(events.some(item => item.eventId === 'evt-shadow')).toBe(true)
    expect(requests[0]?.status).toBe('pending')
    await expect(readFile(filePath, 'utf-8')).rejects.toBeDefined()

    await rm(tempDir, { recursive: true, force: true })
  })
})
