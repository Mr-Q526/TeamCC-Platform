import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { SkillFeedbackAggregateManifest } from '../aggregates/skillFactAggregates.js'
import type { SkillEmbeddingsManifest } from '../embeddings/embeddings.js'
import type { SkillRegistryManifest } from '../registry/registry.js'
import { buildSkillRetrievalFeatures } from './retrievalFeatures.js'
import { retrieveSkills } from './retrieve.js'

const ORIGINAL_ENV = { ...process.env }
const ORIGINAL_FETCH = global.fetch
const tempDirs: string[] = []

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

const registryManifest: SkillRegistryManifest = {
  schemaVersion: '2026-04-11',
  generatedAt: '2026-04-12T00:00:00.000Z',
  registryVersion: 'sha256:test-registry',
  skillCount: 2,
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
  itemCount: 4,
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
      aggregateKey: 'agg:skill:frontend/admin-dashboard-design:global:global:30d',
      scopeType: 'global',
      scopeId: 'global',
      skillId: 'frontend/admin-dashboard-design',
      skillVersion: null,
      sourceHash: null,
      department: null,
      scene: null,
      window: '30d',
      sampleCount: 6,
      exposureCount: 8,
      selectionCount: 2,
      invocationCount: 1,
      terminalCount: 1,
      successCount: 1,
      failureCount: 0,
      verificationPassCount: 1,
      feedbackCount: 1,
      explicitPositiveCount: 1,
      explicitNegativeCount: 0,
      selectionRate: 0.25,
      invocationRate: 0.5,
      successRate: 1,
      verificationPassRate: 1,
      userSatisfaction: 0.8,
      avgRankWhenShown: 2.4,
      freshnessScore: 1,
      failurePenalty: 0,
      costPenalty: 0,
      qualityScore: 0.41,
      confidence: 0.53,
      firstEventAt: '2026-04-01T00:00:00.000Z',
      lastEventAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T12:00:00.000Z',
    },
  ],
}

async function createSkillFixtures(options: { withEmbeddings: boolean; withFeatures: boolean }) {
  const tempDir = await mkdtemp(join(tmpdir(), 'skill-retrieve-'))
  tempDirs.push(tempDir)

  const skillsDir = join(tempDir, 'skills-flat')
  await mkdir(skillsDir, { recursive: true })
  const registryFile = join(skillsDir, 'skill-registry.json')
  await writeFile(registryFile, `${JSON.stringify(registryManifest, null, 2)}\n`, 'utf-8')

  if (options.withEmbeddings) {
    const embeddingsManifest: SkillEmbeddingsManifest = {
      schemaVersion: '2026-04-11',
      generatedAt: '2026-04-12T09:00:00.000Z',
      registryVersion: registryManifest.registryVersion,
      embeddingProvider: 'volcengine',
      embeddingModel: 'test-model',
      embeddingDim: 3,
      embeddingEndpoint: 'https://example.test/embeddings',
      itemCount: 2,
      items: [
        {
          embeddingId: 'embedding-basic',
          skillId: 'frontend/website-homepage-design-basic',
          version: '0.1.0',
          sourceHash: 'sha256:basic',
          objectType: 'skill-summary',
          textHash: 'sha256:text-basic',
          embeddingProvider: 'volcengine',
          embeddingModel: 'test-model',
          embeddingDim: 3,
          vector: [1, 0, 0],
        },
        {
          embeddingId: 'embedding-admin',
          skillId: 'frontend/admin-dashboard-design',
          version: '0.1.0',
          sourceHash: 'sha256:admin',
          objectType: 'skill-summary',
          textHash: 'sha256:text-admin',
          embeddingProvider: 'volcengine',
          embeddingModel: 'test-model',
          embeddingDim: 3,
          vector: [0.1, 0.8, 0],
        },
      ],
    }

    await writeFile(
      join(skillsDir, 'skill-embeddings.json'),
      `${JSON.stringify(embeddingsManifest, null, 2)}\n`,
      'utf-8',
    )
  }

  let retrievalFeaturesFile: string | null = null
  let retrievalFeaturesGeneratedAt: string | null = null
  if (options.withFeatures) {
    const manifest = buildSkillRetrievalFeatures(aggregateManifest, registryManifest)
    retrievalFeaturesGeneratedAt = manifest.generatedAt
    retrievalFeaturesFile = join(tempDir, 'skill-retrieval-features.json')
    await writeFile(
      retrievalFeaturesFile,
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf-8',
    )
  }

  process.env.CLAUDE_CODE_SKILL_REGISTRY_DIR = skillsDir
  delete process.env.CLAUDE_CODE_SKILL_REGISTRY_DIRS
  process.env.SKILL_RETRIEVAL_FEATURES_PATH =
    retrievalFeaturesFile ?? join(tempDir, 'missing-features.json')

  return {
    cwd: tempDir,
    retrievalFeaturesFile,
    retrievalFeaturesGeneratedAt,
  }
}

beforeEach(() => {
  restoreEnv()
  global.fetch = ORIGINAL_FETCH
})

afterEach(async () => {
  restoreEnv()
  global.fetch = ORIGINAL_FETCH
  await Promise.all(
    tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })),
  )
})

describe('retrieveSkills', () => {
  test('returns bm25 when embeddings are unavailable', async () => {
    const fixtures = await createSkillFixtures({
      withEmbeddings: false,
      withFeatures: false,
    })

    const response = await retrieveSkills({
      cwd: fixtures.cwd,
      queryText: '官网首页设计',
      limit: 3,
    })

    expect(response.retrievalMode).toBe('bm25')
    expect(response.candidates.length).toBeGreaterThan(0)
    expect(response.dataVersions.retrievalFeaturesGeneratedAt).toBeNull()
  })

  test('returns bm25_vector when embeddings exist but retrieval features are unavailable', async () => {
    const fixtures = await createSkillFixtures({
      withEmbeddings: true,
      withFeatures: false,
    })

    process.env.ARK_API_KEY = 'test-key'
    process.env.VOLC_ARK_EMBEDDING_MODEL = 'test-model'
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [{ embedding: [1, 0, 0] }],
        }),
        { status: 200 },
      )

    const response = await retrieveSkills({
      cwd: fixtures.cwd,
      queryText: 'homepage design',
      limit: 3,
    })

    expect(response.retrievalMode).toBe('bm25_vector')
    expect(response.dataVersions.embeddingsGeneratedAt).toBe('2026-04-12T09:00:00.000Z')
    expect(response.dataVersions.retrievalFeaturesGeneratedAt).toBeNull()
  })

  test('returns bm25_vector_graph and full graph fields when retrieval features are available', async () => {
    const fixtures = await createSkillFixtures({
      withEmbeddings: true,
      withFeatures: true,
    })

    process.env.ARK_API_KEY = 'test-key'
    process.env.VOLC_ARK_EMBEDDING_MODEL = 'test-model'
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [{ embedding: [1, 0, 0] }],
        }),
        { status: 200 },
      )

    const response = await retrieveSkills({
      cwd: fixtures.cwd,
      queryText: 'homepage design',
      sceneHints: ['homepage'],
      limit: 3,
    })

    expect(response.retrievalMode).toBe('bm25_vector_graph')
    expect(response.dataVersions.retrievalFeaturesGeneratedAt).toBe(
      fixtures.retrievalFeaturesGeneratedAt,
    )
    const candidateWithGraphScore = response.candidates.find(
      candidate => (candidate.graphFeatures?.graphFeatureScore ?? 0) > 0,
    )
    expect(candidateWithGraphScore).toBeDefined()
    expect(
      candidateWithGraphScore?.finalScoreBreakdown.graphFeatureScore ?? 0,
    ).toBeGreaterThan(0)
  })

  test('returns an empty response for blank queries', async () => {
    const fixtures = await createSkillFixtures({
      withEmbeddings: true,
      withFeatures: true,
    })

    const response = await retrieveSkills({
      cwd: fixtures.cwd,
      queryText: '   ',
      limit: 3,
    })

    expect(response.retrievalMode).toBe('bm25')
    expect(response.candidates).toEqual([])
    expect(response.dataVersions.retrievalFeaturesGeneratedAt).toBeNull()
  })
})
