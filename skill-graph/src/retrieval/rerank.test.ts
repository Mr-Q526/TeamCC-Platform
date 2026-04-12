import { describe, expect, test } from 'bun:test'
import { rerankSkills } from './rerank.js'
import type {
  SkillGraphFeatures,
  SkillRecallCandidate,
  SkillRetrievalRequest,
} from './types.js'

const request: SkillRetrievalRequest = {
  queryText: '官网首页',
  cwd: '/tmp/demo',
  department: 'dept:frontend-platform',
  sceneHints: ['scene:homepage'],
  limit: 3,
}

const recallCandidates: SkillRecallCandidate[] = [
  {
    skillId: 'frontend/basic',
    name: 'basic',
    displayName: 'Basic',
    description: 'basic',
    aliases: [],
    version: '0.1.0',
    sourceHash: 'sha256:basic',
    domain: 'frontend',
    departmentTags: ['frontend-platform'],
    sceneTags: ['homepage'],
    skillPath: '/tmp/basic/SKILL.md',
    retrievalSource: 'local_lexical',
    recallScore: 100,
    recallScoreBreakdown: {
      exactName: 0,
      displayName: 0,
      alias: 0,
      lexical: 40,
      bm25: 50,
      vector: 0,
      department: 5,
      domain: 5,
      scene: 0,
      penalty: 0,
    },
  },
  {
    skillId: 'frontend/pro',
    name: 'pro',
    displayName: 'Pro',
    description: 'pro',
    aliases: [],
    version: '0.1.0',
    sourceHash: 'sha256:pro',
    domain: 'frontend',
    departmentTags: ['frontend-platform'],
    sceneTags: ['homepage'],
    skillPath: '/tmp/pro/SKILL.md',
    retrievalSource: 'local_hybrid',
    recallScore: 80,
    recallScoreBreakdown: {
      exactName: 0,
      displayName: 0,
      alias: 0,
      lexical: 30,
      bm25: 20,
      vector: 20,
      department: 5,
      domain: 5,
      scene: 0,
      penalty: 0,
    },
  },
]

const graphItems: SkillGraphFeatures[] = [
  {
    skillId: 'frontend/basic',
    version: '0.1.0',
    sourceHash: 'sha256:basic',
    globalQualityScore: 0.3,
    globalConfidence: 0.4,
    versionQualityScore: 0.3,
    versionConfidence: 0.4,
    departmentScore: 0.2,
    departmentConfidence: 0.5,
    sceneScore: 0.2,
    sceneConfidence: 0.5,
    invocationCount: 2,
    successRate: 0.4,
    graphFeatureScore: 0.2,
    graphFeatureBreakdown: {
      global: 0.03,
      version: 0.042,
      department: 0.02,
      scene: 0.02,
    },
  },
  {
    skillId: 'frontend/pro',
    version: '0.1.0',
    sourceHash: 'sha256:pro',
    globalQualityScore: 0.9,
    globalConfidence: 0.9,
    versionQualityScore: 0.9,
    versionConfidence: 0.9,
    departmentScore: 0.8,
    departmentConfidence: 0.8,
    sceneScore: 0.8,
    sceneConfidence: 0.8,
    invocationCount: 12,
    successRate: 0.9,
    graphFeatureScore: 0.82,
    graphFeatureBreakdown: {
      global: 0.2025,
      version: 0.2835,
      department: 0.128,
      scene: 0.128,
    },
  },
]

describe('rerank skills', () => {
  test('promotes graph-strong candidates above raw recall leader', async () => {
    const result = await rerankSkills(request, recallCandidates, {
      enableGraph: true,
      graphFeatureResponse: {
        schemaVersion: '2026-04-12',
        generatedAt: '2026-04-12T00:00:00.000Z',
        sourceFeaturesGeneratedAt: '2026-04-12T00:00:00.000Z',
        items: graphItems,
      },
      retrievalFeaturesManifest: {
        schemaVersion: '2026-04-12',
        generatedAt: '2026-04-12T00:00:00.000Z',
        registryVersion: 'sha256:test',
        aggregateGeneratedAt: '2026-04-12T00:00:00.000Z',
        window: '30d',
        itemCount: 2,
        items: [],
      },
    })

    expect(result.graphApplied).toBe(true)
    expect(result.candidates[0]?.skillId).toBe('frontend/pro')
    expect(result.candidates[0]?.graphFeatures?.graphFeatureScore).toBe(0.82)
  })

  test('falls back to normalized recall when graph features are disabled', async () => {
    const result = await rerankSkills(request, recallCandidates, {
      enableGraph: false,
    })

    expect(result.graphApplied).toBe(false)
    expect(result.candidates[0]?.skillId).toBe('frontend/basic')
    expect(result.candidates[0]?.finalScoreBreakdown.graphFeatureScore).toBe(0)
  })
})
