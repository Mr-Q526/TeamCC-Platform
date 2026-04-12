import { describe, expect, test } from 'bun:test'
import type { SkillFeedbackAggregateManifest } from './skillFactAggregates.js'
import {
  buildSkillFeedbackAggregatesQuery,
  mapSkillFeedbackAggregateRowToAggregate,
  mapSkillFeedbackAggregateToInsertRow,
} from './storage.js'

const manifest: SkillFeedbackAggregateManifest = {
  schemaVersion: '2026-04-12',
  generatedAt: '2026-04-12T12:00:00.000Z',
  window: '30d',
  windowDays: 30,
  source: 'skill_fact_events',
  itemCount: 1,
  items: [
    {
      aggregateKey: 'agg:skill:frontend/admin-dashboard-design:global:global:30d',
      scopeType: 'global',
      scopeId: 'global',
      skillId: 'frontend/admin-dashboard-design',
      skillVersion: null,
      sourceHash: null,
      department: null,
      scene: null,
      window: '30d',
      sampleCount: 4,
      exposureCount: 10,
      selectionCount: 6,
      invocationCount: 4,
      terminalCount: 4,
      successCount: 3,
      failureCount: 1,
      verificationPassCount: 3,
      feedbackCount: 2,
      explicitPositiveCount: 1,
      explicitNegativeCount: 0,
      selectionRate: 0.6,
      invocationRate: 0.666667,
      successRate: 0.75,
      verificationPassRate: 0.75,
      userSatisfaction: 0.9,
      avgRankWhenShown: 1.8,
      freshnessScore: 1,
      failurePenalty: 0.25,
      costPenalty: 0,
      qualityScore: 0.8,
      confidence: 0.5,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
  ],
}

describe('skill feedback aggregate storage mapping', () => {
  test('maps aggregate manifest rows to insert rows and back', () => {
    const aggregate = manifest.items[0]!
    const insertRow = mapSkillFeedbackAggregateToInsertRow(aggregate, manifest)
    const roundTripped = mapSkillFeedbackAggregateRowToAggregate({
      aggregate_key: insertRow.aggregateKey,
      schema_version: insertRow.schemaVersion,
      generated_at: insertRow.generatedAt,
      window: insertRow.window,
      window_days: insertRow.windowDays,
      scope_type: insertRow.scopeType,
      scope_id: insertRow.scopeId,
      skill_id: insertRow.skillId,
      skill_version: insertRow.skillVersion,
      source_hash: insertRow.sourceHash,
      department: insertRow.department,
      scene: insertRow.scene,
      sample_count: insertRow.sampleCount,
      exposure_count: insertRow.exposureCount,
      selection_count: insertRow.selectionCount,
      invocation_count: insertRow.invocationCount,
      terminal_count: insertRow.terminalCount,
      success_count: insertRow.successCount,
      failure_count: insertRow.failureCount,
      verification_pass_count: insertRow.verificationPassCount,
      feedback_count: insertRow.feedbackCount,
      explicit_positive_count: insertRow.explicitPositiveCount,
      explicit_negative_count: insertRow.explicitNegativeCount,
      selection_rate: insertRow.selectionRate,
      invocation_rate: insertRow.invocationRate,
      success_rate: insertRow.successRate,
      verification_pass_rate: insertRow.verificationPassRate,
      user_satisfaction: insertRow.userSatisfaction,
      avg_rank_when_shown: insertRow.avgRankWhenShown,
      freshness_score: insertRow.freshnessScore,
      failure_penalty: insertRow.failurePenalty,
      cost_penalty: insertRow.costPenalty,
      quality_score: insertRow.qualityScore,
      confidence: insertRow.confidence,
      first_event_at: insertRow.firstEventAt,
      last_event_at: insertRow.lastEventAt,
      computed_at: insertRow.computedAt,
    })

    expect(roundTripped).toEqual(aggregate)
  })
})

describe('skill feedback aggregate query builder', () => {
  test('builds filtered query and clamps limit', () => {
    const query = buildSkillFeedbackAggregatesQuery({
      window: '30d',
      scopeType: 'scene',
      scopeId: 'admin-console',
      skillId: 'frontend/admin-dashboard-design',
      skillVersion: '2.2.0-pro',
      sourceHash: 'sha256:abcdef',
      limit: 5000,
    })

    expect(query.text).toContain('"window" = $1')
    expect(query.text).toContain('scope_type = $2')
    expect(query.text).toContain('skill_id = $4')
    expect(query.text).toContain('LIMIT $7')
    expect(query.values).toEqual([
      '30d',
      'scene',
      'admin-console',
      'frontend/admin-dashboard-design',
      '2.2.0-pro',
      'sha256:abcdef',
      1000,
    ])
  })
})
