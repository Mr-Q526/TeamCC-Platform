import { describe, expect, test } from 'bun:test'
import type { SkillRegistryManifest } from '../registry/registry.js'
import {
  buildDemoAggregateGraphUpdateManifest,
  buildDemoLocalSkillGraphCypher,
  DEMO_LOCAL_SKILL_IDS,
  selectDemoLocalSkills,
} from './demoLocalSkillGraph.js'

const registry: SkillRegistryManifest = {
  schemaVersion: '2026-04-11',
  generatedAt: '2026-04-12T00:00:00.000Z',
  registryVersion: 'sha256:test',
  skillCount: 5,
  source: 'skills-flat',
  skills: [
    {
      skillId: 'frontend/website-homepage-design-basic',
      name: 'website-homepage-design-basic',
      displayName: 'Website Homepage Design Basic',
      description: 'Basic homepage design',
      aliases: ['官网首页', '首页'],
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
      aliases: ['高端官网', '首页设计'],
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
      aliases: ['管理后台'],
      version: '0.1.0',
      sourceHash: 'sha256:admin',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['design'],
      targetDir: 'admin-dashboard-design',
      skillFile: 'admin-dashboard-design/SKILL.md',
    },
    {
      skillId: 'backend/rest-api-implementation',
      name: 'rest-api-implementation',
      displayName: 'REST API Implementation',
      description: 'REST API implementation',
      aliases: ['REST 接口'],
      version: '0.1.0',
      sourceHash: 'sha256:rest',
      domain: 'backend',
      departmentTags: ['backend-platform'],
      sceneTags: ['architecture', 'test'],
      targetDir: 'rest-api-implementation',
      skillFile: 'rest-api-implementation/SKILL.md',
    },
    {
      skillId: 'backend/auth-authorization-backend',
      name: 'auth-authorization-backend',
      displayName: 'Backend Auth Authorization',
      description: 'Auth backend',
      aliases: ['后端鉴权'],
      version: '0.1.0',
      sourceHash: 'sha256:auth',
      domain: 'backend',
      departmentTags: ['backend-platform'],
      sceneTags: ['architecture', 'security-audit'],
      targetDir: 'auth-authorization-backend',
      skillFile: 'auth-authorization-backend/SKILL.md',
    },
  ],
}

describe('demo local skill graph', () => {
  test('selects the exact 5 required demo skills', () => {
    const selected = selectDemoLocalSkills(registry)
    expect(selected.map(skill => skill.skillId)).toEqual([...DEMO_LOCAL_SKILL_IDS].sort())
  })

  test('builds demo graph manifest with homepage pro stronger than basic', () => {
    const selected = selectDemoLocalSkills(registry)
    const manifest = buildDemoAggregateGraphUpdateManifest(selected)

    expect(manifest.skillUpdates).toHaveLength(5)
    expect(manifest.departmentEdgeUpdates).toHaveLength(5)
    expect(manifest.sceneEdgeUpdates).toHaveLength(5)
    expect(manifest.feedbackAggregates).toHaveLength(20)

    const basic = manifest.skillUpdates.find(
      skill => skill.skillId === 'frontend/website-homepage-design-basic',
    )
    const pro = manifest.skillUpdates.find(
      skill => skill.skillId === 'frontend/website-homepage-design-pro',
    )

    expect(pro?.globalQualityScore).toBeGreaterThan(
      basic?.globalQualityScore ?? 0,
    )
    expect(pro?.globalConfidence).toBeGreaterThan(
      basic?.globalConfidence ?? 0,
    )
    expect(pro?.displayNameZh).toBe('官网首页设计专业版')
    expect(basic?.displayNameZh).toBe('官网首页设计基础版')
  })

  test('builds cypher with static, effect, and aggregate relationships', () => {
    const selected = selectDemoLocalSkills(registry)
    const manifest = buildDemoAggregateGraphUpdateManifest(selected)
    const cypher = buildDemoLocalSkillGraphCypher(selected, manifest)

    expect(cypher).toContain('MATCH (n) DETACH DELETE n;')
    expect(cypher).toContain('MERGE (a)-[r:ALIASES_SKILL]->(s)')
    expect(cypher).toContain('MERGE (s)-[r:HAS_VERSION]->(sv)')
    expect(cypher).toContain('MERGE (s)-[r:APPLIES_TO_SCENE]->(sc)')
    expect(cypher).toContain('MERGE (t:Task {taskId:')
    expect(cypher).toContain('MERGE (t)-[r:SELECTED]->(sv)')
    expect(cypher).toContain('MERGE (t)-[r:INVOKED]->(sv)')
    expect(cypher).toContain('MERGE (t)-[r:SUCCEEDED_WITH]->(sv)')
    expect(cypher).toContain('MERGE (t)-[r:FAILED_WITH]->(sv)')
    expect(cypher).toContain('MERGE (d)-[r:PREFERS_SKILL]->(s)')
    expect(cypher).toContain('MERGE (sc)-[r:SUCCESSFUL_WITH]->(s)')
    expect(cypher).toContain('MERGE (fa)-[r:FOR_SKILL]->(s)')
    expect(cypher).toContain('MERGE (fa)-[r:FOR_VERSION]->(sv)')
    expect(cypher).toContain('MERGE (fa)-[r:IN_DEPARTMENT]->(d)')
    expect(cypher).toContain('MERGE (fa)-[r:IN_SCENE]->(sc)')
    expect(cypher).toContain('displayNameZh')
    expect(cypher).toContain('captionZh')
    expect(cypher).toContain('nameZh')
  })
})
