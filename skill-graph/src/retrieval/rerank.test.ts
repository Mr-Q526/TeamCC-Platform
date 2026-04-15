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
  projectId: 'proj:test-homepage',
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
      intent: 0,
      discriminator: 0,
      genericPenalty: 0,
      penalty: 0,
    },
    queryIntentKeys: [],
    queryDiscriminatorKeys: ['frontend:homepage'],
    matchedIntentKeys: [],
    matchedDiscriminatorKeys: ['frontend:homepage'],
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
    recallScore: 96,
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
      intent: 0,
      discriminator: 0,
      genericPenalty: 0,
      penalty: 0,
    },
    queryIntentKeys: ['complexity:pro'],
    queryDiscriminatorKeys: ['frontend:homepage'],
    matchedIntentKeys: ['complexity:pro'],
    matchedDiscriminatorKeys: ['frontend:homepage'],
  },
]

function graphExplanation(score: number): SkillGraphFeatures['graphFeatureExplanation'] {
  return {
    formula:
      'graphRawScore = contextMatched ? 0.40 * project(qualityScore * confidence) + 0.25 * scene(qualityScore * confidence) + 0.15 * department(qualityScore * confidence) + 0.10 * version(qualityScore * confidence) + 0.10 * global(qualityScore * confidence) : 0',
    signals: [
      {
        scope: 'global',
        weight: 0.1,
        matched: true,
        matchedKey: 'global',
        qualityScore: score,
        confidence: score,
        preferenceScore: score / 2,
        feedbackCount: 2,
        explicitPositiveCount: 2,
        explicitNegativeCount: 0,
        sampleCount: 1,
        invocationCount: 1,
        successRate: score,
        qualityContribution: score / 2,
        preferenceContribution: score / 2,
        weightedContribution: score,
        reason: 'matched global aggregate',
      },
    ],
    missingSignals: [],
  }
}

const graphItems: SkillGraphFeatures[] = [
  {
    skillId: 'frontend/basic',
    version: '0.1.0',
    sourceHash: 'sha256:basic',
    projectScore: 0.15,
    projectConfidence: 0.4,
    projectPreferenceScore: 0,
    globalQualityScore: 0.3,
    globalConfidence: 0.4,
    globalPreferenceScore: 0,
    versionQualityScore: 0.3,
    versionConfidence: 0.4,
    versionPreferenceScore: 0,
    departmentScore: 0.2,
    departmentConfidence: 0.5,
    departmentPreferenceScore: 0,
    sceneScore: 0.2,
    sceneConfidence: 0.5,
    scenePreferenceScore: 0,
    invocationCount: 2,
    successRate: 0.4,
    qualityFeatureScore: 0.224,
    preferenceFeatureScore: 0,
    graphFeatureScore: 0.224,
    graphFeatureBreakdown: {
      project: 0.024,
      global: 0.03,
      version: 0.012,
      department: 0.015,
      scene: 0.02,
    },
    qualityFeatureBreakdown: {
      project: 0.024,
      global: 0.03,
      version: 0.012,
      department: 0.015,
      scene: 0.02,
    },
    preferenceFeatureBreakdown: {
      project: 0,
      global: 0,
      version: 0,
      department: 0,
      scene: 0,
    },
    graphFeatureExplanation: graphExplanation(0.2),
  },
  {
    skillId: 'frontend/pro',
    version: '0.1.0',
    sourceHash: 'sha256:pro',
    projectScore: 0.9,
    projectConfidence: 0.9,
    projectPreferenceScore: 0.9,
    globalQualityScore: 0.9,
    globalConfidence: 0.9,
    globalPreferenceScore: 0.7,
    versionQualityScore: 0.9,
    versionConfidence: 0.9,
    versionPreferenceScore: 0.8,
    departmentScore: 0.8,
    departmentConfidence: 0.8,
    departmentPreferenceScore: 0.75,
    sceneScore: 0.8,
    sceneConfidence: 0.8,
    scenePreferenceScore: 0.85,
    invocationCount: 12,
    successRate: 0.9,
    qualityFeatureScore: 0.742,
    preferenceFeatureScore: 0.7325,
    graphFeatureScore: 1.4745,
    graphFeatureBreakdown: {
      project: 0.43,
      global: 0.151,
      version: 0.161,
      department: 0.2085,
      scene: 0.27,
    },
    qualityFeatureBreakdown: {
      project: 0.324,
      global: 0.081,
      version: 0.081,
      department: 0.096,
      scene: 0.16,
    },
    preferenceFeatureBreakdown: {
      project: 0.106,
      global: 0.07,
      version: 0.08,
      department: 0.1125,
      scene: 0.11,
    },
    graphFeatureExplanation: graphExplanation(0.82),
  },
]

describe('rerank skills', () => {
  test('allows close recall candidates to take graph bonus without penalizing recall leader', async () => {
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
        scoring: {
          graphFeatureScoreFormula:
            'graphRawScore = contextMatched ? 0.40 * project(qualityScore * confidence) + 0.25 * scene(qualityScore * confidence) + 0.15 * department(qualityScore * confidence) + 0.10 * version(qualityScore * confidence) + 0.10 * global(qualityScore * confidence) : 0',
          finalScoreFormula: 'finalScore = recallNormalized + graphBonus',
          graphFeatureWeights: {
            project: 0.4,
            version: 0.1,
            global: 0.1,
            department: 0.15,
            scene: 0.25,
          },
          graphFeatureInputs: [],
        },
        itemCount: 2,
        items: [],
      },
    })

    expect(result.graphApplied).toBe(true)
    expect(result.candidates[0]?.skillId).toBe('frontend/pro')
    expect(result.candidates[0]?.graphFeatures?.preferenceFeatureScore).toBeGreaterThan(0)
    expect(result.candidates[0]?.graphEligibility.eligible).toBe(true)
    expect(result.candidates[0]?.finalScoreBreakdown.qualityBonus).toBeGreaterThan(0)
    expect(result.candidates[0]?.finalScoreBreakdown.preferenceBonus).toBeGreaterThan(0)
  })

  test('falls back to normalized recall when graph features are disabled', async () => {
    const result = await rerankSkills(request, recallCandidates, {
      enableGraph: false,
    })

    expect(result.graphApplied).toBe(false)
    expect(result.candidates[0]?.skillId).toBe('frontend/basic')
    expect(result.candidates[0]?.finalScoreBreakdown.graphFeatureScore).toBe(0)
    expect(result.candidates[0]?.finalScoreBreakdown.formula).toBe(
      'finalScore = recallNormalized + qualityBonus + preferenceBonus',
    )
  })

  test('blocks graph bonus when recall gap is too large', async () => {
    const result = await rerankSkills(
      request,
      [{ ...recallCandidates[0] }, { ...recallCandidates[1], recallScore: 80 }],
      {
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
          scoring: {
            graphFeatureScoreFormula:
              'graphRawScore = contextMatched ? 0.40 * project(qualityScore * confidence) + 0.25 * scene(qualityScore * confidence) + 0.15 * department(qualityScore * confidence) + 0.10 * version(qualityScore * confidence) + 0.10 * global(qualityScore * confidence) : 0',
            finalScoreFormula: 'finalScore = recallNormalized + graphBonus',
            graphFeatureWeights: {
              project: 0.4,
              version: 0.1,
              global: 0.1,
              department: 0.15,
              scene: 0.25,
            },
            graphFeatureInputs: [],
          },
          itemCount: 2,
          items: [],
        },
      },
    )

    expect(result.candidates[0]?.skillId).toBe('frontend/basic')
    expect(result.candidates[1]?.graphEligibility.eligible).toBe(false)
    expect(result.candidates[1]?.finalScoreBreakdown.blockedReason).toContain(
      'recall_gap_exceeded',
    )
  })

  test('does not apply preference bonus when intent does not align', async () => {
    const result = await rerankSkills(
      { ...request, queryText: '前端体验优化', sceneHints: ['scene:design'] },
      [
        {
          ...recallCandidates[0],
          queryDiscriminatorKeys: [],
          matchedDiscriminatorKeys: [],
          queryIntentKeys: [],
          matchedIntentKeys: [],
        },
        {
          ...recallCandidates[1],
          queryDiscriminatorKeys: [],
          matchedDiscriminatorKeys: [],
          queryIntentKeys: [],
          matchedIntentKeys: [],
        },
      ],
      {
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
          scoring: {
            graphFeatureScoreFormula:
              'qualityRawScore = contextMatched ? 0.40 * project(qualityScore * confidence) + 0.25 * scene(qualityScore * confidence) + 0.15 * department(qualityScore * confidence) + 0.10 * version(qualityScore * confidence) + 0.10 * global(qualityScore * confidence) : 0; preferenceRawScore = contextMatched ? 0.40 * project(preferenceScore) + 0.25 * scene(preferenceScore) + 0.15 * department(preferenceScore) + 0.10 * version(preferenceScore) + 0.10 * global(preferenceScore) : 0',
            finalScoreFormula:
              'finalScore = recallNormalized + qualityBonus + preferenceBonus',
            graphFeatureWeights: {
              project: 0.4,
              version: 0.1,
              global: 0.1,
              department: 0.15,
              scene: 0.25,
            },
            graphFeatureInputs: [],
          },
          itemCount: 2,
          items: [],
        },
      },
    )

    expect(result.candidates[0]?.finalScoreBreakdown.preferenceBonus).toBe(0)
    expect(result.candidates[0]?.finalScoreBreakdown.preferenceBlockedReason).toBe(
      'preference_signal_unavailable',
    )
  })
})
