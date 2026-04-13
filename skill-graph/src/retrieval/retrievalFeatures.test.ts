import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { SkillFeedbackAggregateManifest } from '../aggregates/skillFactAggregates.js'
import type { SkillRegistryManifest } from '../registry/registry.js'
import {
  buildSkillRetrievalFeatures,
  getSkillGraphFeatures,
  readSkillRetrievalFeatures,
} from './retrievalFeatures.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })),
  )
})

const registryManifest: SkillRegistryManifest = {
  schemaVersion: '2026-04-11',
  generatedAt: '2026-04-12T00:00:00.000Z',
  registryVersion: 'sha256:registry',
  skillCount: 3,
  source: 'skills-flat',
  skills: [
    {
      skillId: 'frontend/website-homepage-design-basic',
      name: 'website-homepage-design-basic',
      displayName: 'Website Homepage Design Basic',
      description: 'Basic homepage design',
      aliases: ['官网首页', '首页', '基础版'],
      version: '0.1.0',
      sourceHash: 'sha256:basic',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['design', 'homepage'],
      targetDir: 'website-homepage-design-basic',
      skillFile: 'website-homepage-design-basic/SKILL.md',
    },
    {
      skillId: 'frontend/website-homepage-design-pro',
      name: 'website-homepage-design-pro',
      displayName: 'Website Homepage Design PRO',
      description: 'Pro homepage design',
      aliases: ['高端官网', '首页设计', '专业版'],
      version: '0.1.0',
      sourceHash: 'sha256:pro',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['design', 'homepage'],
      targetDir: 'website-homepage-design-pro',
      skillFile: 'website-homepage-design-pro/SKILL.md',
    },
    {
      skillId: 'frontend/admin-dashboard-design',
      name: 'admin-dashboard-design',
      displayName: 'Admin Dashboard Design',
      description: 'Admin dashboard design',
      aliases: ['管理后台设计'],
      version: '0.1.0',
      sourceHash: 'sha256:admin',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['design'],
      targetDir: 'admin-dashboard-design',
      skillFile: 'admin-dashboard-design/SKILL.md',
    },
  ],
}

const aggregateManifest: SkillFeedbackAggregateManifest = {
  schemaVersion: '2026-04-12',
  generatedAt: '2026-04-12T12:00:00.000Z',
  window: '30d',
  windowDays: 30,
  source: 'skill_fact_events',
  itemCount: 8,
  items: [
    {
      aggregateKey: 'agg:skill:frontend/website-homepage-design-basic:global:global:30d',
      scopeType: 'global',
      scopeId: 'global',
      skillId: 'frontend/website-homepage-design-basic',
      skillVersion: null,
      sourceHash: null,
      department: null,
      scene: null,
      window: '30d',
      sampleCount: 8,
      exposureCount: 12,
      selectionCount: 6,
      invocationCount: 5,
      terminalCount: 5,
      successCount: 3,
      failureCount: 2,
      verificationPassCount: 3,
      feedbackCount: 2,
      explicitPositiveCount: 1,
      explicitNegativeCount: 1,
      selectionRate: 0.5,
      invocationRate: 0.833333,
      successRate: 0.6,
      verificationPassRate: 0.6,
      userSatisfaction: 0.66,
      avgRankWhenShown: 1.5,
      freshnessScore: 1,
      failurePenalty: 0.4,
      costPenalty: 0,
      qualityScore: 0.59,
      confidence: 0.67,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
    {
      aggregateKey: 'agg:skill:frontend/website-homepage-design-basic:department:frontend-platform:30d',
      scopeType: 'department',
      scopeId: 'frontend-platform',
      skillId: 'frontend/website-homepage-design-basic',
      skillVersion: null,
      sourceHash: null,
      department: 'frontend-platform',
      scene: null,
      window: '30d',
      sampleCount: 6,
      exposureCount: 8,
      selectionCount: 5,
      invocationCount: 4,
      terminalCount: 4,
      successCount: 2,
      failureCount: 2,
      verificationPassCount: 2,
      feedbackCount: 2,
      explicitPositiveCount: 1,
      explicitNegativeCount: 1,
      selectionRate: 0.625,
      invocationRate: 0.8,
      successRate: 0.5,
      verificationPassRate: 0.5,
      userSatisfaction: 0.68,
      avgRankWhenShown: 1.6,
      freshnessScore: 1,
      failurePenalty: 0.5,
      costPenalty: 0,
      qualityScore: 0.61,
      confidence: 0.63,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
    {
      aggregateKey: 'agg:skill:frontend/website-homepage-design-basic:scene:homepage:30d',
      scopeType: 'scene',
      scopeId: 'homepage',
      skillId: 'frontend/website-homepage-design-basic',
      skillVersion: null,
      sourceHash: null,
      department: null,
      scene: 'homepage',
      window: '30d',
      sampleCount: 5,
      exposureCount: 7,
      selectionCount: 4,
      invocationCount: 4,
      terminalCount: 4,
      successCount: 2,
      failureCount: 2,
      verificationPassCount: 2,
      feedbackCount: 2,
      explicitPositiveCount: 1,
      explicitNegativeCount: 1,
      selectionRate: 0.571429,
      invocationRate: 1,
      successRate: 0.5,
      verificationPassRate: 0.5,
      userSatisfaction: 0.7,
      avgRankWhenShown: 1.7,
      freshnessScore: 1,
      failurePenalty: 0.5,
      costPenalty: 0,
      qualityScore: 0.64,
      confidence: 0.61,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
    {
      aggregateKey: 'agg:skill:frontend/website-homepage-design-basic:version:0.1.0#sha256:basic:30d',
      scopeType: 'version',
      scopeId: '0.1.0#sha256:basic',
      skillId: 'frontend/website-homepage-design-basic',
      skillVersion: '0.1.0',
      sourceHash: 'sha256:basic',
      department: null,
      scene: null,
      window: '30d',
      sampleCount: 8,
      exposureCount: 12,
      selectionCount: 6,
      invocationCount: 5,
      terminalCount: 5,
      successCount: 3,
      failureCount: 2,
      verificationPassCount: 3,
      feedbackCount: 2,
      explicitPositiveCount: 1,
      explicitNegativeCount: 1,
      selectionRate: 0.5,
      invocationRate: 0.833333,
      successRate: 0.6,
      verificationPassRate: 0.6,
      userSatisfaction: 0.66,
      avgRankWhenShown: 1.5,
      freshnessScore: 1,
      failurePenalty: 0.4,
      costPenalty: 0,
      qualityScore: 0.59,
      confidence: 0.67,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
    {
      aggregateKey: 'agg:skill:frontend/website-homepage-design-pro:global:global:30d',
      scopeType: 'global',
      scopeId: 'global',
      skillId: 'frontend/website-homepage-design-pro',
      skillVersion: null,
      sourceHash: null,
      department: null,
      scene: null,
      window: '30d',
      sampleCount: 15,
      exposureCount: 18,
      selectionCount: 14,
      invocationCount: 12,
      terminalCount: 12,
      successCount: 11,
      failureCount: 1,
      verificationPassCount: 11,
      feedbackCount: 4,
      explicitPositiveCount: 4,
      explicitNegativeCount: 0,
      selectionRate: 0.777778,
      invocationRate: 0.857143,
      successRate: 0.916667,
      verificationPassRate: 0.916667,
      userSatisfaction: 0.93,
      avgRankWhenShown: 1.2,
      freshnessScore: 1,
      failurePenalty: 0.083333,
      costPenalty: 0,
      qualityScore: 0.91,
      confidence: 0.82,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
    {
      aggregateKey: 'agg:skill:frontend/website-homepage-design-pro:department:frontend-platform:30d',
      scopeType: 'department',
      scopeId: 'frontend-platform',
      skillId: 'frontend/website-homepage-design-pro',
      skillVersion: null,
      sourceHash: null,
      department: 'frontend-platform',
      scene: null,
      window: '30d',
      sampleCount: 12,
      exposureCount: 14,
      selectionCount: 11,
      invocationCount: 10,
      terminalCount: 10,
      successCount: 9,
      failureCount: 1,
      verificationPassCount: 9,
      feedbackCount: 3,
      explicitPositiveCount: 3,
      explicitNegativeCount: 0,
      selectionRate: 0.785714,
      invocationRate: 0.909091,
      successRate: 0.9,
      verificationPassRate: 0.9,
      userSatisfaction: 0.94,
      avgRankWhenShown: 1.1,
      freshnessScore: 1,
      failurePenalty: 0.1,
      costPenalty: 0,
      qualityScore: 0.93,
      confidence: 0.79,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
    {
      aggregateKey: 'agg:skill:frontend/website-homepage-design-pro:scene:homepage:30d',
      scopeType: 'scene',
      scopeId: 'homepage',
      skillId: 'frontend/website-homepage-design-pro',
      skillVersion: null,
      sourceHash: null,
      department: null,
      scene: 'homepage',
      window: '30d',
      sampleCount: 11,
      exposureCount: 12,
      selectionCount: 10,
      invocationCount: 10,
      terminalCount: 10,
      successCount: 9,
      failureCount: 1,
      verificationPassCount: 9,
      feedbackCount: 3,
      explicitPositiveCount: 3,
      explicitNegativeCount: 0,
      selectionRate: 0.833333,
      invocationRate: 1,
      successRate: 0.9,
      verificationPassRate: 0.9,
      userSatisfaction: 0.95,
      avgRankWhenShown: 1.1,
      freshnessScore: 1,
      failurePenalty: 0.1,
      costPenalty: 0,
      qualityScore: 0.95,
      confidence: 0.8,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
    {
      aggregateKey: 'agg:skill:frontend/website-homepage-design-pro:version:0.1.0#sha256:pro:30d',
      scopeType: 'version',
      scopeId: '0.1.0#sha256:pro',
      skillId: 'frontend/website-homepage-design-pro',
      skillVersion: '0.1.0',
      sourceHash: 'sha256:pro',
      department: null,
      scene: null,
      window: '30d',
      sampleCount: 15,
      exposureCount: 18,
      selectionCount: 14,
      invocationCount: 12,
      terminalCount: 12,
      successCount: 11,
      failureCount: 1,
      verificationPassCount: 11,
      feedbackCount: 4,
      explicitPositiveCount: 4,
      explicitNegativeCount: 0,
      selectionRate: 0.777778,
      invocationRate: 0.857143,
      successRate: 0.916667,
      verificationPassRate: 0.916667,
      userSatisfaction: 0.93,
      avgRankWhenShown: 1.2,
      freshnessScore: 1,
      failurePenalty: 0.083333,
      costPenalty: 0,
      qualityScore: 0.91,
      confidence: 0.82,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
  ],
}

describe('retrieval features', () => {
  test('builds retrieval snapshot from registry and aggregates', () => {
    const manifest = buildSkillRetrievalFeatures(
      aggregateManifest,
      registryManifest,
    )

    expect(manifest.itemCount).toBe(3)
    expect(manifest.registryVersion).toBe('sha256:registry')
    expect(manifest.aggregateGeneratedAt).toBe('2026-04-12T12:00:00.000Z')
    expect(manifest.window).toBe('30d')
    expect(manifest.scoring.graphFeatureWeights.version).toBe(0.35)
    expect(manifest.scoring.graphFeatureScoreFormula).toContain(
      'version(qualityScore * confidence)',
    )

    const homepageBasic = manifest.items.find(
      item => item.skillId === 'frontend/website-homepage-design-basic',
    )
    const admin = manifest.items.find(
      item => item.skillId === 'frontend/admin-dashboard-design',
    )

    expect(homepageBasic?.global?.score).toBe(0.59)
    expect(homepageBasic?.versions).toHaveLength(1)
    expect(homepageBasic?.departments['frontend-platform']?.score).toBe(0.61)
    expect(homepageBasic?.scenes.homepage?.score).toBe(0.64)
    expect(admin?.global).toBeNull()
    expect(admin?.departments).toEqual({})
    expect(admin?.scenes).toEqual({})
  })

  test('reads valid snapshot and ignores invalid files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'retrieval-features-'))
    tempDirs.push(dir)

    const filePath = join(dir, 'skill-retrieval-features.json')
    const manifest = buildSkillRetrievalFeatures(
      aggregateManifest,
      registryManifest,
    )
    await writeFile(filePath, JSON.stringify(manifest, null, 2), 'utf-8')

    const parsed = await readSkillRetrievalFeatures(filePath)
    expect(parsed?.itemCount).toBe(3)

    const invalidPath = join(dir, 'invalid.json')
    await writeFile(invalidPath, '{"schemaVersion":"2026-04-12","items":"nope"}', 'utf-8')
    const invalid = await readSkillRetrievalFeatures(invalidPath)
    expect(invalid).toBeNull()
  })

  test('prefers version features, matches department and scene, and scores pro above basic', async () => {
    const manifest = buildSkillRetrievalFeatures(
      aggregateManifest,
      registryManifest,
    )

    const response = await getSkillGraphFeatures(
      {
        queryText: '官网首页设计',
        department: 'frontend-platform',
        sceneHints: ['homepage'],
        domainHints: ['frontend'],
        candidates: [
          {
            skillId: 'frontend/website-homepage-design-basic',
            version: '0.1.0',
            sourceHash: 'sha256:basic',
          },
          {
            skillId: 'frontend/website-homepage-design-pro',
            version: '0.1.0',
            sourceHash: 'sha256:pro',
          },
          {
            skillId: 'frontend/admin-dashboard-design',
            version: '0.1.0',
            sourceHash: 'sha256:admin',
          },
        ],
      },
      manifest,
    )

    expect(response.items).toHaveLength(3)

    const basic = response.items[0]
    const pro = response.items[1]
    const admin = response.items[2]

    expect(basic.versionQualityScore).toBe(0.59)
    expect(basic.departmentScore).toBe(0.61)
    expect(basic.sceneScore).toBe(0.64)
    expect(basic.invocationCount).toBe(5)
    expect(basic.successRate).toBe(0.6)

    expect(pro.versionQualityScore).toBe(0.91)
    expect(pro.departmentScore).toBe(0.93)
    expect(pro.sceneScore).toBe(0.95)
    expect(pro.graphFeatureScore).toBeGreaterThan(basic.graphFeatureScore)
    expect(pro.graphFeatureExplanation.signals).toHaveLength(4)
    expect(pro.graphFeatureExplanation.missingSignals).toEqual([])
    expect(pro.graphFeatureExplanation.signals.find(signal => signal.scope === 'scene')).toMatchObject({
      matched: true,
      matchedKey: 'homepage',
      weight: 0.2,
      sampleCount: 11,
    })

    expect(admin.globalQualityScore).toBeNull()
    expect(admin.versionQualityScore).toBeNull()
    expect(admin.departmentScore).toBeNull()
    expect(admin.sceneScore).toBeNull()
    expect(admin.graphFeatureScore).toBe(0)
    expect(admin.graphFeatureExplanation.missingSignals.length).toBeGreaterThan(0)
  })
})
