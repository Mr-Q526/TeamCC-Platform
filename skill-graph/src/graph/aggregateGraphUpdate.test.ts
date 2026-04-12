import { describe, expect, test } from 'bun:test'
import {
  buildSkillAggregateGraphUpdate,
  buildSkillAggregateGraphCypher,
  makeVersionKey,
  toDepartmentId,
  toSceneId,
} from './aggregateGraphUpdate.js'
import type { SkillFeedbackAggregateManifest } from '../aggregates/skillFactAggregates.js'
import type { SkillRegistryManifest } from '../registry/registry.js'

const aggregateManifest: SkillFeedbackAggregateManifest = {
  schemaVersion: '2026-04-12',
  generatedAt: '2026-04-12T12:00:00.000Z',
  window: '30d',
  windowDays: 30,
  source: 'skill_fact_events',
  itemCount: 4,
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
    {
      aggregateKey: 'agg:skill:frontend/admin-dashboard-design:department:frontend-platform:30d',
      scopeType: 'department',
      scopeId: 'frontend-platform',
      skillId: 'frontend/admin-dashboard-design',
      skillVersion: null,
      sourceHash: null,
      department: 'frontend-platform',
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
      qualityScore: 0.82,
      confidence: 0.51,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
    {
      aggregateKey: 'agg:skill:frontend/admin-dashboard-design:scene:admin-console:30d',
      scopeType: 'scene',
      scopeId: 'admin-console',
      skillId: 'frontend/admin-dashboard-design',
      skillVersion: null,
      sourceHash: null,
      department: null,
      scene: 'admin-console',
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
      qualityScore: 0.81,
      confidence: 0.52,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
    {
      aggregateKey: 'agg:skill:frontend/admin-dashboard-design:version:2.2.0-pro#sha256:abcdef1234567890:30d',
      scopeType: 'version',
      scopeId: '2.2.0-pro#sha256:abcdef1234567890',
      skillId: 'frontend/admin-dashboard-design',
      skillVersion: '2.2.0-pro',
      sourceHash: 'sha256:abcdef1234567890',
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
      qualityScore: 0.88,
      confidence: 0.6,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
  ],
}

const registryManifest: SkillRegistryManifest = {
  schemaVersion: '2026-04-11',
  generatedAt: '2026-04-12T00:00:00.000Z',
  registryVersion: 'sha256:registry',
  skillCount: 1,
  source: 'skills-flat',
  skills: [
    {
      skillId: 'frontend/admin-dashboard-design',
      name: 'admin-dashboard-design',
      displayName: 'Admin Dashboard Design',
      description: 'Design admin dashboards',
      aliases: ['管理后台设计'],
      version: '2.2.0-pro',
      sourceHash: 'sha256:abcdef1234567890',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['admin-console'],
      targetDir: 'admin-dashboard-design',
      skillFile: 'admin-dashboard-design/SKILL.md',
    },
  ],
}

describe('aggregate graph update mapping', () => {
  test('maps aggregate ids and version keys consistently', () => {
    expect(toDepartmentId('frontend-platform')).toBe('dept:frontend-platform')
    expect(toDepartmentId('dept:frontend-platform')).toBe('dept:frontend-platform')
    expect(toSceneId('admin-console')).toBe('scene:admin-console')
    expect(makeVersionKey('frontend/admin-dashboard-design', '2.2.0-pro', 'sha256:abcdef1234567890')).toBe(
      'frontend/admin-dashboard-design@2.2.0-pro#sha256:abcde',
    )
  })

  test('builds graph update manifest from aggregate results', () => {
    const manifest = buildSkillAggregateGraphUpdate(
      aggregateManifest,
      registryManifest,
    )

    expect(manifest.skillUpdates).toHaveLength(1)
    expect(manifest.versionUpdates).toHaveLength(1)
    expect(manifest.departmentEdgeUpdates).toHaveLength(1)
    expect(manifest.sceneEdgeUpdates).toHaveLength(1)
    expect(manifest.feedbackAggregates).toHaveLength(4)

    expect(manifest.skillUpdates[0]).toEqual({
      skillId: 'frontend/admin-dashboard-design',
      displayName: 'Admin Dashboard Design',
      displayNameZh: '管理后台设计',
      domain: 'frontend',
      description: 'Design admin dashboards',
      descriptionZh: 'Design admin dashboards',
      globalQualityScore: 0.8,
      globalConfidence: 0.5,
    })

    expect(manifest.versionUpdates[0]?.versionKey).toBe(
      'frontend/admin-dashboard-design@2.2.0-pro#sha256:abcde',
    )
    expect(manifest.versionUpdates[0]?.captionZh).toBe('版本 2.2.0-pro')
    expect(manifest.departmentEdgeUpdates[0]?.departmentId).toBe(
      'dept:frontend-platform',
    )
    expect(manifest.departmentEdgeUpdates[0]?.departmentNameZh).toBe('前端平台')
    expect(manifest.sceneEdgeUpdates[0]?.sceneId).toBe('scene:admin-console')
    expect(manifest.sceneEdgeUpdates[0]?.sceneNameZh).toBe('管理后台')
  })

  test('builds cypher with aggregate and edge updates', () => {
    const manifest = buildSkillAggregateGraphUpdate(
      aggregateManifest,
      registryManifest,
    )
    const cypher = buildSkillAggregateGraphCypher(manifest)

    expect(cypher).toContain('MERGE (s:Skill {skillId:')
    expect(cypher).toContain('MERGE (d)-[r:PREFERS_SKILL]->(s)')
    expect(cypher).toContain('MERGE (sc)-[r:SUCCESSFUL_WITH]->(s)')
    expect(cypher).toContain('MERGE (fa:FeedbackAggregate {aggregateKey:')
    expect(cypher).toContain('MERGE (fa)-[r:FOR_VERSION]->(sv)')
    expect(cypher).toContain('displayNameZh')
    expect(cypher).toContain('captionZh')
    expect(cypher).toContain('nameZh')
  })
})
