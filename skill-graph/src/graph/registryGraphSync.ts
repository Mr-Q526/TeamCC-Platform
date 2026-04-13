import { spawn } from 'child_process'
import { join } from 'path'
import { fileURLToPath } from 'url'
import {
  getSkillGraphSkillsDir,
  readGeneratedSkillRegistry,
  type SkillRegistryEntry,
  type SkillRegistryManifest,
} from '../registry/registry.js'

export type SkillRegistryGraphSyncManifest = {
  schemaVersion: string
  generatedAt: string
  registryVersion: string | null
  skillCount: number
  versionCount: number
  aliasCount: number
  domainCount: number
  departmentCount: number
  sceneCount: number
  genericAliasCount: number
}

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const COMPOSE_FILE = join(PROJECT_ROOT, 'docker-compose.skill-data.yml')
const COMPOSE_PROJECT =
  process.env.SKILL_COMPOSE_PROJECT?.trim() || 'teamskill-claudecode'
const NEO4J_SERVICE = 'skill-neo4j'

function cypherLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function makeVersionKey(skillId: string, version: string, sourceHash: string): string {
  return `${skillId}@${version}#${sourceHash.slice(0, 12)}`
}

function displayNameZh(skill: SkillRegistryEntry): string {
  return (
    skill.aliases.find(alias => /[\u4e00-\u9fff]/.test(alias)) ??
    skill.displayName
  )
}

function departmentId(value: string): string {
  return value.startsWith('dept:') ? value : `dept:${value}`
}

function sceneId(value: string): string {
  return value.startsWith('scene:') ? value : `scene:${value}`
}

function domainId(value: string): string {
  return value.startsWith('domain:') ? value : `domain:${value}`
}

function qualityTier(skill: SkillRegistryEntry): string {
  if (skill.name.endsWith('-pro') || skill.aliases.includes('pro')) {
    return 'pro'
  }

  if (skill.name.endsWith('-basic') || skill.aliases.includes('basic')) {
    return 'basic'
  }

  return 'standard'
}

function qualityTierZh(value: string): string {
  switch (value) {
    case 'pro':
      return '专业版'
    case 'basic':
      return '基础版'
    default:
      return '标准版'
  }
}

type AliasUsage = {
  alias: string
  normalizedName: string
  skillCount: number
  isGeneric: boolean
}

type AliasLink = AliasUsage & {
  aliasType: 'name' | 'displayName' | 'alias'
  weight: number
}

const ALWAYS_GENERIC_ALIASES = new Set(
  [
    'ai',
    'api',
    'architecture',
    'backend',
    'backend-platform',
    'basic',
    'content-generation',
    'data',
    'design',
    'frontend',
    'frontend-platform',
    'growth',
    'page',
    'pro',
    'review',
    'security',
    'security-audit',
    'server side',
    'test',
    'tools',
    'ui',
    'web 前端',
    '专业版',
    '人工智能',
    '代码审查',
    '前端',
    '后端',
    '基础版',
    '安全',
    '安全审计',
    '数据',
    '服务端',
    '架构',
    '架构设计',
    '模块边界',
    '测试',
    '设计',
    '评审',
    '验证',
    '视觉设计',
    '页面',
    '页面开发',
  ].map(normalizeName),
)

function buildAliasUsageMap(registry: SkillRegistryManifest): Map<string, AliasUsage> {
  const aliasToSkills = new Map<string, Set<string>>()
  const aliasDisplay = new Map<string, string>()

  for (const skill of registry.skills) {
    for (const alias of new Set([skill.name, skill.displayName, ...skill.aliases])) {
      const trimmed = alias.trim()
      if (!trimmed) continue
      const normalized = normalizeName(trimmed)
      aliasDisplay.set(normalized, trimmed)
      const skills = aliasToSkills.get(normalized) ?? new Set<string>()
      skills.add(skill.skillId)
      aliasToSkills.set(normalized, skills)
    }
  }

  return new Map(
    [...aliasToSkills.entries()].map(([normalizedName, skills]) => {
      const skillCount = skills.size
      const isGeneric = skillCount >= 5 || ALWAYS_GENERIC_ALIASES.has(normalizedName)
      return [
        normalizedName,
        {
          alias: aliasDisplay.get(normalizedName) ?? normalizedName,
          normalizedName,
          skillCount,
          isGeneric,
        },
      ]
    }),
  )
}

function aliasWeight(aliasType: AliasLink['aliasType'], usage: AliasUsage): number {
  if (aliasType === 'name') return 1
  if (aliasType === 'displayName') return 0.9
  if (usage.isGeneric) {
    if (usage.skillCount >= 50) return 0.05
    if (usage.skillCount >= 20) return 0.1
    if (usage.skillCount >= 10) return 0.18
    return 0.25
  }
  return usage.skillCount > 1 ? 0.65 : 0.8
}

function constraintsCypher(): string[] {
  return [
    'CREATE CONSTRAINT skill_id_v1 IF NOT EXISTS FOR (s:Skill) REQUIRE s.skillId IS UNIQUE;',
    'CREATE CONSTRAINT skill_version_key_v1 IF NOT EXISTS FOR (sv:SkillVersion) REQUIRE sv.versionKey IS UNIQUE;',
    'CREATE CONSTRAINT alias_name_v1 IF NOT EXISTS FOR (a:Alias) REQUIRE a.name IS UNIQUE;',
    'CREATE CONSTRAINT domain_id_v1 IF NOT EXISTS FOR (d:Domain) REQUIRE d.domainId IS UNIQUE;',
    'CREATE CONSTRAINT scene_id_v1 IF NOT EXISTS FOR (sc:Scene) REQUIRE sc.sceneId IS UNIQUE;',
    'CREATE CONSTRAINT department_id_v1 IF NOT EXISTS FOR (d:Department) REQUIRE d.departmentId IS UNIQUE;',
    `
MATCH (:Alias)-[r:ALIASES_SKILL]->(:Skill)
WHERE r.weight IS NULL
SET r.aliasType = coalesce(r.aliasType, 'legacy'),
    r.weight = 0.1,
    r.isGeneric = true,
    r.skillCount = coalesce(r.skillCount, 1),
    r.updatedAt = datetime();
`,
  ]
}

function skillCypher(
  skill: SkillRegistryEntry,
  aliasUsageMap: Map<string, AliasUsage>,
): string[] {
  const versionKey = makeVersionKey(skill.skillId, skill.version, skill.sourceHash)
  const tier = qualityTier(skill)
  const statements: string[] = [
    `
MERGE (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
SET s.name = ${cypherLiteral(skill.name)},
    s.displayName = ${cypherLiteral(skill.displayName)},
    s.displayNameZh = ${cypherLiteral(displayNameZh(skill))},
    s.domain = ${cypherLiteral(skill.domain)},
    s.description = ${cypherLiteral(skill.description)},
    s.descriptionZh = ${cypherLiteral(skill.description)},
    s.activeVersionKey = ${cypherLiteral(versionKey)},
    s.registryTargetDir = ${cypherLiteral(skill.targetDir)},
    s.registrySkillFile = ${cypherLiteral(skill.skillFile)},
    s.registrySyncedAt = datetime(),
    s.updatedAt = datetime();
`,
    `
MERGE (sv:SkillVersion {versionKey: ${cypherLiteral(versionKey)}})
SET sv.skillId = ${cypherLiteral(skill.skillId)},
    sv.version = ${cypherLiteral(skill.version)},
    sv.sourceHash = ${cypherLiteral(skill.sourceHash)},
    sv.qualityTier = ${cypherLiteral(tier)},
    sv.captionZh = ${cypherLiteral(`${qualityTierZh(tier)} ${skill.version}`)},
    sv.active = true,
    sv.registrySyncedAt = datetime(),
    sv.updatedAt = datetime()
WITH sv
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (s)-[r:HAS_VERSION]->(sv)
SET r.labelZh = '拥有版本',
    r.updatedAt = datetime();
`,
    `
MERGE (d:Domain {domainId: ${cypherLiteral(domainId(skill.domain))}})
SET d.name = ${cypherLiteral(skill.domain)},
    d.nameZh = ${cypherLiteral(skill.domain)},
    d.updatedAt = datetime()
WITH d
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (s)-[r:IN_DOMAIN]->(d)
SET r.labelZh = '所属领域',
    r.updatedAt = datetime();
`,
  ]

  const aliasLinks: AliasLink[] = [
    { alias: skill.name, aliasType: 'name' as const },
    { alias: skill.displayName, aliasType: 'displayName' as const },
    ...skill.aliases.map(alias => ({ alias, aliasType: 'alias' as const })),
  ]
    .map(item => {
      const normalizedName = normalizeName(item.alias)
      const usage = aliasUsageMap.get(normalizedName)
      if (!usage) return null
      return {
        ...usage,
        alias: item.alias,
        aliasType: item.aliasType,
        weight: aliasWeight(item.aliasType, usage),
      }
    })
    .filter((item): item is AliasLink => item !== null)

  const seenAliases = new Set<string>()
  for (const alias of aliasLinks) {
    if (seenAliases.has(alias.normalizedName)) {
      continue
    }
    seenAliases.add(alias.normalizedName)

    statements.push(`
MERGE (a:Alias {name: ${cypherLiteral(alias.alias)}})
SET a.normalizedName = ${cypherLiteral(alias.normalizedName)},
    a.skillCount = ${alias.skillCount},
    a.isGeneric = ${alias.isGeneric ? 'true' : 'false'},
    a.updatedAt = datetime()
WITH a
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (a)-[r:ALIASES_SKILL]->(s)
SET r.labelZh = '别名',
    r.aliasType = ${cypherLiteral(alias.aliasType)},
    r.weight = ${alias.weight},
    r.isGeneric = ${alias.isGeneric ? 'true' : 'false'},
    r.skillCount = ${alias.skillCount},
    r.updatedAt = datetime();
`)
  }

  for (const department of skill.departmentTags) {
    const id = departmentId(department)
    statements.push(`
MERGE (d:Department {departmentId: ${cypherLiteral(id)}})
SET d.name = ${cypherLiteral(department)},
    d.nameZh = ${cypherLiteral(department)},
    d.updatedAt = datetime()
WITH d
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (s)-[r:BELONGS_TO_DEPARTMENT]->(d)
SET r.labelZh = '所属部门',
    r.updatedAt = datetime();
`)
  }

  for (const scene of skill.sceneTags) {
    const id = sceneId(scene)
    statements.push(`
MERGE (sc:Scene {sceneId: ${cypherLiteral(id)}})
SET sc.name = ${cypherLiteral(scene)},
    sc.nameZh = ${cypherLiteral(scene)},
    sc.updatedAt = datetime()
WITH sc
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (s)-[r:APPLIES_TO_SCENE]->(sc)
SET r.weight = 1,
    r.labelZh = '适用场景',
    r.updatedAt = datetime();
`)
  }

  return statements
}

export function buildSkillRegistryGraphSyncCypher(
  registry: SkillRegistryManifest,
): string {
  const statements = constraintsCypher()
  const aliasUsageMap = buildAliasUsageMap(registry)

  for (const skill of registry.skills) {
    statements.push(...skillCypher(skill, aliasUsageMap))
  }

  return statements.join('\n')
}

export function summarizeSkillRegistryGraphSync(
  registry: SkillRegistryManifest,
): SkillRegistryGraphSyncManifest {
  const aliases = new Set<string>()
  const domains = new Set<string>()
  const departments = new Set<string>()
  const scenes = new Set<string>()
  let genericAliasCount = 0
  const aliasUsageMap = buildAliasUsageMap(registry)

  for (const skill of registry.skills) {
    aliases.add(skill.name)
    aliases.add(skill.displayName)
    for (const alias of skill.aliases) aliases.add(alias)
    domains.add(skill.domain)
    for (const department of skill.departmentTags) departments.add(department)
    for (const scene of skill.sceneTags) scenes.add(scene)
  }
  for (const alias of aliasUsageMap.values()) {
    if (alias.isGeneric) genericAliasCount += 1
  }

  return {
    schemaVersion: '2026-04-12',
    generatedAt: new Date().toISOString(),
    registryVersion: registry.registryVersion || null,
    skillCount: registry.skills.length,
    versionCount: registry.skills.length,
    aliasCount: aliases.size,
    domainCount: domains.size,
    departmentCount: departments.size,
    sceneCount: scenes.size,
    genericAliasCount,
  }
}

export async function runNeo4jCypher(cypher: string): Promise<void> {
  const user = process.env.SKILL_NEO4J_USER?.trim() || 'neo4j'
  const password =
    process.env.SKILL_NEO4J_PASSWORD?.trim() || 'skills_dev_password'

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'compose',
        '-p',
        COMPOSE_PROJECT,
        '-f',
        COMPOSE_FILE,
        'exec',
        '-T',
        NEO4J_SERVICE,
        'cypher-shell',
        '-u',
        user,
        '-p',
        password,
      ],
      {
        stdio: ['pipe', 'inherit', 'inherit'],
      },
    )

    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`cypher-shell exited with code ${code ?? -1}`))
    })

    child.stdin.write(cypher)
    child.stdin.end()
  })
}

export async function syncSkillRegistryToNeo4j(): Promise<SkillRegistryGraphSyncManifest> {
  const registry = await readGeneratedSkillRegistry(getSkillGraphSkillsDir(PROJECT_ROOT))
  if (!registry) {
    throw new Error('skill registry not found; run skills:build-registry first')
  }

  await runNeo4jCypher(buildSkillRegistryGraphSyncCypher(registry))
  return summarizeSkillRegistryGraphSync(registry)
}
