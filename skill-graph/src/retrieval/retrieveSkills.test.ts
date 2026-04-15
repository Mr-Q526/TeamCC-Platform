import { describe, expect, test } from 'bun:test'
import type { SkillEmbeddingsManifest } from '../embeddings/embeddings.js'
import type { SkillRegistryManifest } from '../registry/registry.js'
import type { SkillRetrievalFeaturesManifest } from './retrievalFeatures.js'
import { retrieveSkills } from './retrieveSkills.js'

const registryManifest: SkillRegistryManifest = {
  schemaVersion: '2026-04-11',
  generatedAt: '2026-04-12T00:00:00.000Z',
  registryVersion: 'sha256:registry',
  skillCount: 2,
  source: 'skills-flat',
  skills: [
    {
      skillId: 'frontend/basic',
      name: 'basic',
      displayName: 'Basic',
      description: 'basic',
      aliases: ['首页'],
      version: '0.1.0',
      sourceHash: 'sha256:basic',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['homepage'],
      targetDir: 'basic',
      skillFile: 'basic/SKILL.md',
    },
    {
      skillId: 'frontend/pro',
      name: 'pro',
      displayName: 'Pro',
      description: 'pro',
      aliases: ['高端首页'],
      version: '0.1.0',
      sourceHash: 'sha256:pro',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['homepage'],
      targetDir: 'pro',
      skillFile: 'pro/SKILL.md',
    },
  ],
}

const embeddingsManifest: SkillEmbeddingsManifest = {
  schemaVersion: '2026-04-12',
  generatedAt: '2026-04-12T12:00:00.000Z',
  registryVersion: 'sha256:registry',
  embeddingProvider: 'volcengine',
  embeddingModel: 'demo',
  embeddingDim: 2,
  embeddingEndpoint: 'https://example.test/embeddings',
  itemCount: 2,
  items: [
    {
      embeddingId: 'emb-basic',
      skillId: 'frontend/basic',
      version: '0.1.0',
      sourceHash: 'sha256:basic',
      objectType: 'skill-summary',
      textHash: 'basic',
      embeddingProvider: 'volcengine',
      embeddingModel: 'demo',
      embeddingDim: 2,
      vector: [0.4, 0.6],
    },
    {
      embeddingId: 'emb-pro',
      skillId: 'frontend/pro',
      version: '0.1.0',
      sourceHash: 'sha256:pro',
      objectType: 'skill-summary',
      textHash: 'pro',
      embeddingProvider: 'volcengine',
      embeddingModel: 'demo',
      embeddingDim: 2,
      vector: [1, 0],
    },
  ],
}

const retrievalFeaturesManifest: SkillRetrievalFeaturesManifest = {
  schemaVersion: '2026-04-12',
  generatedAt: '2026-04-12T12:18:53.557Z',
  registryVersion: 'sha256:registry',
  aggregateGeneratedAt: '2026-04-12T12:17:34.311Z',
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
  items: [
    {
      skillId: 'frontend/basic',
      name: 'basic',
      displayName: 'Basic',
      description: 'basic',
      version: '0.1.0',
      sourceHash: 'sha256:basic',
      versionKey: 'frontend/basic@0.1.0#sha256:basic',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['homepage'],
      global: {
        score: 0.2,
        confidence: 0.3,
        sampleCount: 2,
        invocationCount: 2,
        successRate: 0.5,
        updatedAt: '2026-04-12T00:00:00.000Z',
      },
      versions: [
        {
          version: '0.1.0',
          sourceHash: 'sha256:basic',
          versionKey: 'frontend/basic@0.1.0#sha256:basic',
          qualityScore: 0.2,
          confidence: 0.3,
          sampleCount: 2,
          invocationCount: 2,
          successRate: 0.5,
          updatedAt: '2026-04-12T00:00:00.000Z',
        },
      ],
      projects: {},
      departments: {},
      scenes: {},
    },
    {
      skillId: 'frontend/pro',
      name: 'pro',
      displayName: 'Pro',
      description: 'pro',
      version: '0.1.0',
      sourceHash: 'sha256:pro',
      versionKey: 'frontend/pro@0.1.0#sha256:pro',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['homepage'],
      global: {
        score: 0.95,
        confidence: 0.9,
        sampleCount: 12,
        invocationCount: 10,
        successRate: 0.9,
        updatedAt: '2026-04-12T00:00:00.000Z',
      },
      versions: [
        {
          version: '0.1.0',
          sourceHash: 'sha256:pro',
          versionKey: 'frontend/pro@0.1.0#sha256:pro',
          qualityScore: 0.95,
          confidence: 0.9,
          sampleCount: 12,
          invocationCount: 10,
          successRate: 0.9,
          updatedAt: '2026-04-12T00:00:00.000Z',
        },
      ],
      projects: {},
      departments: {
        'frontend-platform': {
          score: 0.9,
          confidence: 0.8,
          sampleCount: 8,
          invocationCount: 7,
          successRate: 0.88,
          updatedAt: '2026-04-12T00:00:00.000Z',
        },
      },
      scenes: {
        homepage: {
          score: 0.92,
          confidence: 0.82,
          sampleCount: 8,
          invocationCount: 7,
          successRate: 0.9,
          updatedAt: '2026-04-12T00:00:00.000Z',
        },
      },
    },
  ],
}

describe('retrieve skills', () => {
  test('returns graph-augmented response when vector and graph assets are present', async () => {
    const response = await retrieveSkills(
      {
        queryText: '高端官网首页',
        cwd: '/tmp/demo',
        projectId: null,
        department: 'dept:frontend-platform',
        sceneHints: ['scene:homepage'],
        limit: 2,
      },
      {
        registryManifest,
        embeddingsManifest,
        queryEmbedding: { vector: [1, 0] },
        retrievalFeaturesManifest,
      },
    )

    expect(response.retrievalMode).toBe('bm25_vector_graph')
    const pro = response.candidates.find(candidate => candidate.skillId === 'frontend/pro')
    expect(pro?.graphFeatures).not.toBeNull()
    expect(pro?.finalScoreBreakdown.graphFeatureScore).toBeGreaterThan(0)
    expect(response.dataVersions.retrievalFeaturesGeneratedAt).toBe(
      retrievalFeaturesManifest.generatedAt,
    )
  })

  test('returns lexical fallback when registry exists but no vector assets are available', async () => {
    const response = await retrieveSkills(
      {
        queryText: '首页设计',
        cwd: '/tmp/demo',
        limit: 2,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
        retrievalFeaturesManifest,
      },
    )

    expect(response.retrievalMode).toBe('bm25')
    expect(response.candidates.length).toBeGreaterThan(0)
    expect(response.candidates[0]?.graphFeatures).toBeNull()
  })
})
