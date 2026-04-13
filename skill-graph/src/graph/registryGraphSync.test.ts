import { describe, expect, test } from 'bun:test'
import type { SkillRegistryManifest } from '../registry/registry.js'
import {
  buildSkillRegistryGraphSyncCypher,
  summarizeSkillRegistryGraphSync,
} from './registryGraphSync.js'

const registry: SkillRegistryManifest = {
  schemaVersion: '2026-04-11',
  generatedAt: '2026-04-12T00:00:00.000Z',
  registryVersion: 'sha256:test',
  skillCount: 1,
  source: 'skills-flat',
  skills: [
    {
      skillId: 'frontend/website-homepage-design-pro',
      name: 'website-homepage-design-pro',
      displayName: 'Website Homepage Design PRO',
      description: 'Design a premium branded homepage.',
      aliases: ['官网首页', 'homepage', 'pro'],
      version: '0.1.0',
      sourceHash: 'sha256:abcdef1234567890',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['homepage', 'design'],
      targetDir: 'website-homepage-design-pro',
      skillFile: 'website-homepage-design-pro/SKILL.md',
    },
  ],
}

describe('registry graph sync', () => {
  test('summarizes registry sync counts', () => {
    expect(summarizeSkillRegistryGraphSync(registry)).toMatchObject({
      registryVersion: 'sha256:test',
      skillCount: 1,
      versionCount: 1,
      aliasCount: 5,
      domainCount: 1,
      departmentCount: 1,
      sceneCount: 2,
      genericAliasCount: 1,
    })
  })

  test('builds idempotent cypher without overwriting feedback scores', () => {
    const cypher = buildSkillRegistryGraphSyncCypher(registry)

    expect(cypher).toContain('CREATE CONSTRAINT skill_id_v1')
    expect(cypher).toContain('MERGE (s:Skill {skillId:')
    expect(cypher).toContain('MERGE (sv:SkillVersion {versionKey:')
    expect(cypher).toContain('MERGE (s)-[r:HAS_VERSION]->(sv)')
    expect(cypher).toContain('MERGE (a)-[r:ALIASES_SKILL]->(s)')
    expect(cypher).toContain('r.aliasType =')
    expect(cypher).toContain('r.weight =')
    expect(cypher).toContain('r.isGeneric =')
    expect(cypher).toContain('a.skillCount =')
    expect(cypher).toContain('MERGE (s)-[r:IN_DOMAIN]->(d)')
    expect(cypher).toContain('MERGE (s)-[r:BELONGS_TO_DEPARTMENT]->(d)')
    expect(cypher).toContain('MERGE (s)-[r:APPLIES_TO_SCENE]->(sc)')
    expect(cypher).not.toContain('globalQualityScore =')
    expect(cypher).not.toContain('sv.qualityScore =')
  })
})
