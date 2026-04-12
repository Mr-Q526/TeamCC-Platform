import { describe, expect, test } from 'bun:test'
import type { SkillEmbeddingsManifest } from '../embeddings/embeddings.js'
import type { SkillRegistryManifest } from '../registry/registry.js'
import { recallSkills } from './recall.js'

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
      displayName: 'Website Homepage Design Pro',
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
      sceneTags: ['design', 'admin-console'],
      targetDir: 'admin-dashboard-design',
      skillFile: 'admin-dashboard-design/SKILL.md',
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
  itemCount: 3,
  items: [
    {
      embeddingId: 'emb-basic',
      skillId: 'frontend/website-homepage-design-basic',
      version: '0.1.0',
      sourceHash: 'sha256:basic',
      objectType: 'skill-summary',
      textHash: 'basic',
      embeddingProvider: 'volcengine',
      embeddingModel: 'demo',
      embeddingDim: 2,
      vector: [0.9, 0.1],
    },
    {
      embeddingId: 'emb-pro',
      skillId: 'frontend/website-homepage-design-pro',
      version: '0.1.0',
      sourceHash: 'sha256:pro',
      objectType: 'skill-summary',
      textHash: 'pro',
      embeddingProvider: 'volcengine',
      embeddingModel: 'demo',
      embeddingDim: 2,
      vector: [1, 0],
    },
    {
      embeddingId: 'emb-admin',
      skillId: 'frontend/admin-dashboard-design',
      version: '0.1.0',
      sourceHash: 'sha256:admin',
      objectType: 'skill-summary',
      textHash: 'admin',
      embeddingProvider: 'volcengine',
      embeddingModel: 'demo',
      embeddingDim: 2,
      vector: [0, 1],
    },
  ],
}

describe('recall skills', () => {
  test('prefers lexical homepage matches with frontend hints', async () => {
    const result = await recallSkills(
      {
        queryText: '做一个官网首页设计',
        queryContext: 'marketing landing hero',
        cwd: '/tmp/demo',
        department: 'dept:frontend-platform',
        limit: 3,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
      },
    )

    expect(result.candidates.length).toBeGreaterThanOrEqual(2)
    expect(
      result.candidates.some(
        candidate =>
          candidate.skillId === 'frontend/website-homepage-design-basic',
      ),
    ).toBe(true)
    expect(
      result.candidates.some(
        candidate =>
          candidate.skillId === 'frontend/website-homepage-design-pro',
      ),
    ).toBe(true)
    expect(result.vectorAvailable).toBe(false)
  })

  test('uses vector recall when query embedding is available', async () => {
    const result = await recallSkills(
      {
        queryText: '专业版高端官网',
        cwd: '/tmp/demo',
        department: 'dept:frontend-platform',
        limit: 3,
      },
      {
        registryManifest,
        embeddingsManifest,
        queryEmbedding: { vector: [1, 0] },
      },
    )

    expect(result.vectorAvailable).toBe(true)
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(
      result.candidates.some(
        candidate =>
          candidate.skillId === 'frontend/website-homepage-design-pro' &&
          candidate.retrievalSource === 'local_hybrid',
      ),
    ).toBe(true)
  })
})
