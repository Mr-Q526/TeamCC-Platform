import { describe, expect, test } from 'bun:test'
import { createSkillFactEvent } from '../events/skillFacts.js'
import {
  buildSkillFactAggregates,
} from './skillFactAggregates.js'

describe('skill fact aggregates', () => {
  test('builds global, department, scene, and version aggregates', () => {
    const base = {
      source: 'model' as const,
      traceId: 'trace-1',
      taskId: 'task-1',
      retrievalRoundId: 'round-1',
      skillId: 'frontend/admin-dashboard-design',
      skillName: 'admin-dashboard-design',
      skillVersion: '2.2.0-pro',
      sourceHash: 'sha256:pro',
      context: {
        cwd: '/tmp/demo',
        projectId: 'project:ops-console',
        department: 'frontend-platform',
        scene: 'admin-console',
        domain: 'frontend',
      },
    }

    const events = [
      createSkillFactEvent({
        eventId: 'evt-1',
        factKind: 'skill_exposed',
        createdAt: '2026-04-12T10:00:00.000Z',
        ...base,
        retrieval: {
          rank: 1,
        },
      }),
      createSkillFactEvent({
        eventId: 'evt-2',
        factKind: 'skill_selected',
        createdAt: '2026-04-12T10:01:00.000Z',
        ...base,
      }),
      createSkillFactEvent({
        eventId: 'evt-3',
        factKind: 'skill_invoked',
        createdAt: '2026-04-12T10:02:00.000Z',
        ...base,
      }),
      createSkillFactEvent({
        eventId: 'evt-4',
        factKind: 'skill_completed',
        createdAt: '2026-04-12T10:03:00.000Z',
        ...base,
        outcome: {
          success: true,
          verificationPassed: true,
        },
      }),
      createSkillFactEvent({
        eventId: 'evt-5',
        factKind: 'skill_feedback',
        createdAt: '2026-04-12T10:04:00.000Z',
        source: 'user',
        ...base,
        feedback: {
          rating: 5,
          sentiment: 'positive',
          comment: 'works',
        },
      }),
    ]

    const manifest = buildSkillFactAggregates(events, {
      now: '2026-04-12T10:05:00.000Z',
      windowDays: 30,
      targetSampleCount: 20,
    })

    expect(manifest.itemCount).toBe(4)

    const globalAggregate = manifest.items.find(
      item =>
        item.scopeType === 'global' &&
        item.skillId === 'frontend/admin-dashboard-design',
    )
    const departmentAggregate = manifest.items.find(
      item =>
        item.scopeType === 'department' &&
        item.scopeId === 'frontend-platform',
    )
    const sceneAggregate = manifest.items.find(
      item =>
        item.scopeType === 'scene' &&
        item.scopeId === 'admin-console',
    )
    const versionAggregate = manifest.items.find(
      item =>
        item.scopeType === 'version' &&
        item.scopeId === '2.2.0-pro#sha256:pro',
    )

    expect(globalAggregate).toBeDefined()
    expect(globalAggregate?.selectionRate).toBe(1)
    expect(globalAggregate?.invocationRate).toBe(1)
    expect(globalAggregate?.successRate).toBe(1)
    expect(globalAggregate?.verificationPassRate).toBe(1)
    expect(globalAggregate?.userSatisfaction).toBe(1)
    expect(globalAggregate?.avgRankWhenShown).toBe(1)
    expect(globalAggregate?.sampleCount).toBe(1)
    expect(globalAggregate?.qualityScore).toBeGreaterThan(0.9)
    expect(globalAggregate?.confidence).toBeGreaterThan(0)

    expect(departmentAggregate?.department).toBe('frontend-platform')
    expect(sceneAggregate?.scene).toBe('admin-console')
    expect(versionAggregate?.skillVersion).toBe('2.2.0-pro')
    expect(versionAggregate?.sourceHash).toBe('sha256:pro')
  })

  test('ignores unresolved skill facts and keeps neutral fallback satisfaction', () => {
    const events = [
      createSkillFactEvent({
        eventId: 'evt-neutral',
        factKind: 'skill_exposed',
        source: 'system',
        createdAt: '2026-04-12T11:00:00.000Z',
        traceId: 'trace-2',
        taskId: 'task-2',
        retrievalRoundId: 'round-2',
        skillId: 'backend/rest-api-implementation',
        skillName: 'rest-api-implementation',
        skillVersion: '1.0.0',
        sourceHash: 'sha256:api',
      }),
      createSkillFactEvent({
        eventId: 'evt-unresolved',
        factKind: 'skill_feedback',
        source: 'user',
        createdAt: '2026-04-12T11:05:00.000Z',
        traceId: 'trace-2',
        taskId: 'task-2',
        retrievalRoundId: 'round-2',
        skillName: 'missing',
      }),
    ]

    const manifest = buildSkillFactAggregates(events, {
      now: '2026-04-12T11:10:00.000Z',
    })

    expect(manifest.itemCount).toBe(2)
    const globalAggregate = manifest.items.find(item => item.scopeType === 'global')
    expect(globalAggregate?.userSatisfaction).toBe(0.5)
    expect(globalAggregate?.feedbackCount).toBe(0)
  })
})
