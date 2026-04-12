import { describe, expect, test } from 'bun:test'
import { createSkillFactEvent } from './skillFacts.js'
import {
  buildSkillFactEventsQuery,
  mapSkillFactEventToInsertRow,
  mapSkillFactRowToEvent,
} from './storage.js'

describe('skill fact storage mapping', () => {
  test('round-trips event fields through row mapping', () => {
    const event = createSkillFactEvent({
      eventId: 'evt-1',
      factKind: 'skill_completed',
      source: 'model',
      createdAt: '2026-04-12T10:00:00.000Z',
      runId: 'run-1',
      traceId: 'trace-1',
      taskId: 'task-1',
      retrievalRoundId: 'retrieval-1',
      skillId: 'frontend/admin-dashboard-design',
      skillName: 'admin-dashboard-design',
      skillVersion: '2.2.0-pro',
      sourceHash: 'sha256:abcdef',
      context: {
        cwd: '/tmp/demo',
        projectId: 'project:ops-console',
        department: 'frontend-platform',
        scene: 'admin-console',
        domain: 'frontend',
      },
      retrieval: {
        rank: 1,
        candidateCount: 5,
        retrievalSource: 'local_hybrid',
        score: 42.5,
        scoreBreakdown: {
          bm25: 10,
          vector: 20.5,
          graph: 12,
        },
        selectedBy: 'model',
      },
      outcome: {
        success: true,
        verificationPassed: true,
        failureReason: null,
        durationMs: 1500,
      },
      feedback: {
        rating: 5,
        sentiment: 'positive',
        comment: 'great',
      },
      resolutionError: null,
      payload: {
        commandName: 'admin-dashboard-design',
        loadedFrom: 'local',
      },
    })

    const row = mapSkillFactEventToInsertRow(event)
    const roundTripped = mapSkillFactRowToEvent({
      event_id: row.eventId,
      schema_version: row.schemaVersion,
      fact_kind: row.factKind,
      source: row.source,
      created_at: row.createdAt,
      run_id: row.runId,
      trace_id: row.traceId,
      task_id: row.taskId,
      retrieval_round_id: row.retrievalRoundId,
      skill_id: row.skillId,
      skill_name: row.skillName,
      skill_version: row.skillVersion,
      source_hash: row.sourceHash,
      cwd: row.cwd,
      project_id: row.projectId,
      department: row.department,
      scene: row.scene,
      domain: row.domain,
      retrieval_rank: row.retrievalRank,
      retrieval_candidate_count: row.retrievalCandidateCount,
      retrieval_source: row.retrievalSource,
      retrieval_score: row.retrievalScore,
      retrieval_selected_by: row.retrievalSelectedBy,
      outcome_success: row.outcomeSuccess,
      outcome_verification_passed: row.outcomeVerificationPassed,
      outcome_failure_reason: row.outcomeFailureReason,
      outcome_duration_ms: row.outcomeDurationMs,
      feedback_rating: row.feedbackRating,
      feedback_sentiment: row.feedbackSentiment,
      feedback_comment: row.feedbackComment,
      score_breakdown: row.scoreBreakdown ? JSON.parse(row.scoreBreakdown) : null,
      payload: row.payload ? JSON.parse(row.payload) : null,
      resolution_error: row.resolutionError,
    })

    expect(roundTripped).toEqual(event)
  })
})

describe('skill fact query builder', () => {
  test('builds filtered query and clamps limit', () => {
    const query = buildSkillFactEventsQuery({
      factKinds: ['skill_exposed', 'skill_selected'],
      skillId: 'frontend/admin-dashboard-design',
      skillVersion: '2.2.0-pro',
      sourceHash: 'sha256:abcdef',
      taskId: 'task-1',
      traceId: 'trace-1',
      projectId: 'project:ops-console',
      department: 'frontend-platform',
      scene: 'admin-console',
      domain: 'frontend',
      createdAfter: '2026-04-01T00:00:00.000Z',
      createdBefore: '2026-04-30T23:59:59.999Z',
      limit: 5000,
    })

    expect(query.text).toContain('fact_kind = ANY($1)')
    expect(query.text).toContain('skill_id = $2')
    expect(query.text).toContain('created_at >= $11::timestamptz')
    expect(query.text).toContain('created_at <= $12::timestamptz')
    expect(query.text).toContain('LIMIT $13')
    expect(query.values).toEqual([
      ['skill_exposed', 'skill_selected'],
      'frontend/admin-dashboard-design',
      '2.2.0-pro',
      'sha256:abcdef',
      'task-1',
      'trace-1',
      'project:ops-console',
      'frontend-platform',
      'admin-console',
      'frontend',
      '2026-04-01T00:00:00.000Z',
      '2026-04-30T23:59:59.999Z',
      1000,
    ])
  })

  test('uses default limit when none is provided', () => {
    const query = buildSkillFactEventsQuery()
    expect(query.values).toEqual([100])
    expect(query.text).toContain('ORDER BY created_at DESC')
  })
})
