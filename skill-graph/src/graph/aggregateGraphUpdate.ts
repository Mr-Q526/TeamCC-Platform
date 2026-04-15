import { readFile, mkdir, writeFile } from 'fs/promises'
import { spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  getSkillGraphSkillsDir,
  readGeneratedSkillRegistry,
  type SkillRegistryManifest,
} from '../registry/registry.js'
import type {
  SkillFeedbackAggregate,
  SkillFeedbackAggregateManifest,
} from '../aggregates/skillFactAggregates.js'
import {
  readSkillFeedbackAggregateManifestFromPg,
  type SkillFeedbackAggregateQueryFilter,
} from '../aggregates/storage.js'

export type SkillGraphAggregateNode = {
  aggregateKey: string
  scopeType: SkillFeedbackAggregate['scopeType']
  scopeId: string
  skillId: string
  skillVersion: string | null
  sourceHash: string | null
  versionKey: string | null
  projectId: string | null
  departmentId: string | null
  sceneId: string | null
  window: string
  qualityScore: number
  selectionRate: number
  invocationRate: number
  successRate: number
  verificationPassRate: number
  userSatisfaction: number
  confidence: number
  sampleCount: number
  updatedAt: string
}

export type SkillGraphSkillUpdate = {
  skillId: string
  displayName: string
  displayNameZh: string
  domain: string
  description: string
  descriptionZh: string
  globalQualityScore: number
  globalConfidence: number
}

export type SkillGraphVersionUpdate = {
  skillId: string
  version: string
  sourceHash: string
  versionKey: string
  captionZh: string
  qualityScore: number
  confidence: number
  active: boolean
}

export type SkillGraphDepartmentEdgeUpdate = {
  departmentId: string
  departmentName: string
  departmentNameZh: string
  skillId: string
  score: number
  confidence: number
  sampleCount: number
  window: string
}

export type SkillGraphProjectEdgeUpdate = {
  projectId: string
  projectName: string
  projectNameZh: string
  skillId: string
  score: number
  confidence: number
  sampleCount: number
  window: string
}

export type SkillGraphSceneEdgeUpdate = {
  sceneId: string
  sceneName: string
  sceneNameZh: string
  skillId: string
  score: number
  confidence: number
  sampleCount: number
  window: string
}

export type SkillAggregateGraphUpdateManifest = {
  schemaVersion: string
  generatedAt: string
  sourceAggregateGeneratedAt: string
  aggregateWindow: string
  itemCount: number
  skillUpdates: SkillGraphSkillUpdate[]
  versionUpdates: SkillGraphVersionUpdate[]
  projectEdgeUpdates: SkillGraphProjectEdgeUpdate[]
  departmentEdgeUpdates: SkillGraphDepartmentEdgeUpdate[]
  sceneEdgeUpdates: SkillGraphSceneEdgeUpdate[]
  feedbackAggregates: SkillGraphAggregateNode[]
}

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const AGGREGATE_FILE = join(
  PROJECT_ROOT,
  'data',
  'aggregates',
  'skill-feedback-aggregates.json',
)
const GRAPH_OUTPUT_FILE = join(
  PROJECT_ROOT,
  'data',
  'graph',
  'skill-aggregate-graph-update.json',
)
const COMPOSE_FILE = join(PROJECT_ROOT, 'docker-compose.skill-data.yml')
const COMPOSE_PROJECT =
  process.env.SKILL_COMPOSE_PROJECT?.trim() || 'teamskill-claudecode'
const NEO4J_SERVICE = 'skill-neo4j'

type RegistrySkillMetadata = {
  displayName: string
  displayNameZh: string
  domain: string
  description: string
  descriptionZh: string
  activeVersionKey: string | null
}

function cypherLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function trimString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function hasChineseText(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value)
}

function pickChineseAlias(aliases: string[]): string | null {
  for (const alias of aliases) {
    const trimmed = trimString(alias)
    if (trimmed && hasChineseText(trimmed)) {
      return trimmed
    }
  }

  return null
}

function departmentNameZh(departmentId: string, fallback: string): string {
  switch (departmentId) {
    case 'dept:frontend-platform':
      return '前端平台'
    case 'dept:backend-platform':
      return '后端平台'
    case 'dept:security-platform':
      return '安全平台'
    case 'dept:data-platform':
      return '数据平台'
    case 'dept:growth':
      return '增长团队'
    case 'dept:infra-platform':
      return '基础设施平台'
    default:
      return fallback
  }
}

function sceneNameZh(sceneId: string, fallback: string): string {
  switch (sceneId) {
    case 'scene:homepage':
      return '官网首页'
    case 'scene:design':
      return '设计'
    case 'scene:architecture':
      return '架构'
    case 'scene:test':
      return '测试'
    case 'scene:security-audit':
      return '安全审查'
    case 'scene:admin-console':
      return '管理后台'
    default:
      return fallback
  }
}

function aggregateScopeZh(scopeType: SkillGraphAggregateNode['scopeType']): string {
  switch (scopeType) {
    case 'global':
      return '全局聚合'
    case 'project':
      return '项目聚合'
    case 'department':
      return '部门聚合'
    case 'scene':
      return '场景聚合'
    case 'version':
      return '版本聚合'
    default:
      return scopeType
  }
}

function versionCaptionZh(skillId: string, version: string): string {
  if (skillId.endsWith('-pro')) {
    return `专业版 ${version}`
  }

  if (skillId.endsWith('-basic')) {
    return `基础版 ${version}`
  }

  return `版本 ${version}`
}

function projectNameZh(projectId: string, fallback: string): string {
  if (projectId.startsWith('project:')) {
    return projectId.slice('project:'.length)
  }

  return fallback
}

export function makeVersionKey(
  skillId: string,
  version: string,
  sourceHash: string,
): string {
  return `${skillId}@${version}#${sourceHash.slice(0, 12)}`
}

export function toDepartmentId(department: string): string {
  return department.startsWith('dept:') ? department : `dept:${department}`
}

export function toSceneId(scene: string): string {
  return scene.startsWith('scene:') ? scene : `scene:${scene}`
}

function loadRegistryMetadataMap(
  registry: SkillRegistryManifest | null,
): Map<string, RegistrySkillMetadata> {
  const metadataMap = new Map<string, RegistrySkillMetadata>()
  if (!registry) {
    return metadataMap
  }

  for (const skill of registry.skills) {
    metadataMap.set(skill.skillId, {
      displayName: skill.displayName,
      displayNameZh: pickChineseAlias(skill.aliases) ?? skill.displayName,
      domain: skill.domain,
      description: skill.description,
      descriptionZh: skill.description,
      activeVersionKey:
        skill.version && skill.sourceHash
          ? makeVersionKey(skill.skillId, skill.version, skill.sourceHash)
          : null,
    })
  }

  return metadataMap
}

function aggregateToGraphNode(
  aggregate: SkillFeedbackAggregate,
): SkillGraphAggregateNode {
  return {
    aggregateKey: aggregate.aggregateKey,
    scopeType: aggregate.scopeType,
    scopeId: aggregate.scopeId,
    skillId: aggregate.skillId,
    skillVersion: aggregate.skillVersion,
    sourceHash: aggregate.sourceHash,
    versionKey:
      aggregate.skillVersion && aggregate.sourceHash
        ? makeVersionKey(
            aggregate.skillId,
            aggregate.skillVersion,
            aggregate.sourceHash,
          )
        : null,
    projectId: aggregate.projectId,
    departmentId: aggregate.department ? toDepartmentId(aggregate.department) : null,
    sceneId: aggregate.scene ? toSceneId(aggregate.scene) : null,
    window: aggregate.window,
    qualityScore: aggregate.qualityScore,
    selectionRate: aggregate.selectionRate,
    invocationRate: aggregate.invocationRate,
    successRate: aggregate.successRate,
    verificationPassRate: aggregate.verificationPassRate,
    userSatisfaction: aggregate.userSatisfaction,
    confidence: aggregate.confidence,
    sampleCount: aggregate.sampleCount,
    updatedAt: aggregate.updatedAt,
  }
}

export function buildSkillAggregateGraphUpdate(
  aggregateManifest: SkillFeedbackAggregateManifest,
  registry: SkillRegistryManifest | null,
): SkillAggregateGraphUpdateManifest {
  const registryMetadata = loadRegistryMetadataMap(registry)
  const feedbackAggregates = aggregateManifest.items.map(aggregateToGraphNode)
  const skillUpdates = new Map<string, SkillGraphSkillUpdate>()
  const versionUpdates = new Map<string, SkillGraphVersionUpdate>()
  const projectEdgeUpdates = new Map<string, SkillGraphProjectEdgeUpdate>()
  const departmentEdgeUpdates = new Map<string, SkillGraphDepartmentEdgeUpdate>()
  const sceneEdgeUpdates = new Map<string, SkillGraphSceneEdgeUpdate>()

  for (const aggregate of aggregateManifest.items) {
    const registrySkill = registryMetadata.get(aggregate.skillId)

    if (aggregate.scopeType === 'global') {
      skillUpdates.set(aggregate.skillId, {
        skillId: aggregate.skillId,
        displayName: registrySkill?.displayName ?? aggregate.skillId.split('/').pop() ?? aggregate.skillId,
        displayNameZh:
          registrySkill?.displayNameZh ??
          registrySkill?.displayName ??
          aggregate.skillId.split('/').pop() ??
          aggregate.skillId,
        domain: registrySkill?.domain ?? 'general',
        description: registrySkill?.description ?? '',
        descriptionZh: registrySkill?.descriptionZh ?? registrySkill?.description ?? '',
        globalQualityScore: aggregate.qualityScore,
        globalConfidence: aggregate.confidence,
      })
    }

    if (
      aggregate.scopeType === 'version' &&
      aggregate.skillVersion &&
      aggregate.sourceHash
    ) {
      const versionKey = makeVersionKey(
        aggregate.skillId,
        aggregate.skillVersion,
        aggregate.sourceHash,
      )
      versionUpdates.set(versionKey, {
        skillId: aggregate.skillId,
        version: aggregate.skillVersion,
        sourceHash: aggregate.sourceHash,
        versionKey,
        captionZh: versionCaptionZh(aggregate.skillId, aggregate.skillVersion),
        qualityScore: aggregate.qualityScore,
        confidence: aggregate.confidence,
        active: registrySkill?.activeVersionKey === versionKey,
      })
    }

    if (aggregate.scopeType === 'project' && aggregate.projectId) {
      projectEdgeUpdates.set(
        `${aggregate.skillId}\n${aggregate.projectId}\n${aggregate.window}`,
        {
          projectId: aggregate.projectId,
          projectName: aggregate.projectId,
          projectNameZh: projectNameZh(aggregate.projectId, aggregate.projectId),
          skillId: aggregate.skillId,
          score: aggregate.qualityScore,
          confidence: aggregate.confidence,
          sampleCount: aggregate.sampleCount,
          window: aggregate.window,
        },
      )
    }

    if (aggregate.scopeType === 'department' && aggregate.department) {
      departmentEdgeUpdates.set(
        `${aggregate.skillId}\n${aggregate.department}\n${aggregate.window}`,
        {
          departmentId: toDepartmentId(aggregate.department),
          departmentName: aggregate.department,
          departmentNameZh: departmentNameZh(
            toDepartmentId(aggregate.department),
            aggregate.department,
          ),
          skillId: aggregate.skillId,
          score: aggregate.qualityScore,
          confidence: aggregate.confidence,
          sampleCount: aggregate.sampleCount,
          window: aggregate.window,
        },
      )
    }

    if (aggregate.scopeType === 'scene' && aggregate.scene) {
      sceneEdgeUpdates.set(`${aggregate.skillId}\n${aggregate.scene}\n${aggregate.window}`, {
        sceneId: toSceneId(aggregate.scene),
        sceneName: aggregate.scene,
        sceneNameZh: sceneNameZh(toSceneId(aggregate.scene), aggregate.scene),
        skillId: aggregate.skillId,
        score: aggregate.qualityScore,
        confidence: aggregate.confidence,
        sampleCount: aggregate.sampleCount,
        window: aggregate.window,
      })
    }
  }

  return {
    schemaVersion: '2026-04-12',
    generatedAt: new Date().toISOString(),
    sourceAggregateGeneratedAt: aggregateManifest.generatedAt,
    aggregateWindow: aggregateManifest.window,
    itemCount: feedbackAggregates.length,
    skillUpdates: [...skillUpdates.values()].sort((a, b) =>
      a.skillId.localeCompare(b.skillId),
    ),
    versionUpdates: [...versionUpdates.values()].sort((a, b) =>
      a.versionKey.localeCompare(b.versionKey),
    ),
    projectEdgeUpdates: [...projectEdgeUpdates.values()].sort((a, b) =>
      `${a.projectId}:${a.skillId}`.localeCompare(`${b.projectId}:${b.skillId}`),
    ),
    departmentEdgeUpdates: [...departmentEdgeUpdates.values()].sort((a, b) =>
      `${a.departmentId}:${a.skillId}`.localeCompare(`${b.departmentId}:${b.skillId}`),
    ),
    sceneEdgeUpdates: [...sceneEdgeUpdates.values()].sort((a, b) =>
      `${a.sceneId}:${a.skillId}`.localeCompare(`${b.sceneId}:${b.skillId}`),
    ),
    feedbackAggregates,
  }
}

export async function readSkillFeedbackAggregateManifest(
  filePath = AGGREGATE_FILE,
): Promise<SkillFeedbackAggregateManifest> {
  const raw = await readFile(filePath, 'utf-8')
  return JSON.parse(raw) as SkillFeedbackAggregateManifest
}

export async function readSkillAggregateGraphUpdateManifest(
  filePath = GRAPH_OUTPUT_FILE,
): Promise<SkillAggregateGraphUpdateManifest> {
  const raw = await readFile(filePath, 'utf-8')
  return JSON.parse(raw) as SkillAggregateGraphUpdateManifest
}

export async function buildAndWriteSkillAggregateGraphUpdate(
  inputFile = AGGREGATE_FILE,
  outputFile = GRAPH_OUTPUT_FILE,
): Promise<SkillAggregateGraphUpdateManifest> {
  const aggregateManifest = await readSkillFeedbackAggregateManifest(inputFile)
  const registry = await readGeneratedSkillRegistry(getSkillGraphSkillsDir(PROJECT_ROOT))
  const manifest = buildSkillAggregateGraphUpdate(aggregateManifest, registry)
  await mkdir(dirname(outputFile), { recursive: true })
  await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
  return manifest
}

export async function buildAndWriteSkillAggregateGraphUpdateFromPg(
  filter: SkillFeedbackAggregateQueryFilter = {},
  outputFile = GRAPH_OUTPUT_FILE,
): Promise<SkillAggregateGraphUpdateManifest> {
  const aggregateManifest = await readSkillFeedbackAggregateManifestFromPg(filter)
  const registry = await readGeneratedSkillRegistry(getSkillGraphSkillsDir(PROJECT_ROOT))
  const manifest = buildSkillAggregateGraphUpdate(aggregateManifest, registry)
  await mkdir(dirname(outputFile), { recursive: true })
  await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
  return manifest
}

export function buildSkillAggregateGraphCypher(
  manifest: SkillAggregateGraphUpdateManifest,
): string {
  const aggregateKeys = manifest.feedbackAggregates.map(aggregate =>
    cypherLiteral(aggregate.aggregateKey),
  )
  const statements: string[] = [
    'CREATE CONSTRAINT skill_id_v1 IF NOT EXISTS FOR (s:Skill) REQUIRE s.skillId IS UNIQUE;',
    'CREATE CONSTRAINT skill_version_key_v1 IF NOT EXISTS FOR (sv:SkillVersion) REQUIRE sv.versionKey IS UNIQUE;',
    'CREATE CONSTRAINT project_id_v1 IF NOT EXISTS FOR (p:Project) REQUIRE p.projectId IS UNIQUE;',
    'CREATE CONSTRAINT scene_id_v1 IF NOT EXISTS FOR (sc:Scene) REQUIRE sc.sceneId IS UNIQUE;',
    'CREATE CONSTRAINT department_id_v1 IF NOT EXISTS FOR (d:Department) REQUIRE d.departmentId IS UNIQUE;',
    'CREATE CONSTRAINT feedback_aggregate_key_v1 IF NOT EXISTS FOR (fa:FeedbackAggregate) REQUIRE fa.aggregateKey IS UNIQUE;',
    `
MATCH (fa:FeedbackAggregate {window: ${cypherLiteral(manifest.aggregateWindow)}})
WHERE NOT fa.aggregateKey IN [${aggregateKeys.join(', ')}]
DETACH DELETE fa;
`,
  ]

  for (const skill of manifest.skillUpdates) {
    statements.push(`
MERGE (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
SET s.displayName = ${cypherLiteral(skill.displayName)},
    s.displayNameZh = ${cypherLiteral(skill.displayNameZh)},
    s.domain = ${cypherLiteral(skill.domain)},
    s.description = ${cypherLiteral(skill.description)},
    s.descriptionZh = ${cypherLiteral(skill.descriptionZh)},
    s.globalQualityScore = ${skill.globalQualityScore},
    s.globalConfidence = ${skill.globalConfidence},
    s.updatedAt = datetime();
`)
  }

  for (const version of manifest.versionUpdates) {
    statements.push(`
MERGE (sv:SkillVersion {versionKey: ${cypherLiteral(version.versionKey)}})
SET sv.skillId = ${cypherLiteral(version.skillId)},
    sv.version = ${cypherLiteral(version.version)},
    sv.sourceHash = ${cypherLiteral(version.sourceHash)},
    sv.captionZh = ${cypherLiteral(version.captionZh)},
    sv.qualityScore = ${version.qualityScore},
    sv.confidence = ${version.confidence},
    sv.active = ${version.active ? 'true' : 'false'},
    sv.updatedAt = datetime()
WITH sv
MATCH (s:Skill {skillId: ${cypherLiteral(version.skillId)}})
MERGE (s)-[r:HAS_VERSION]->(sv)
SET r.labelZh = '拥有版本';
`)
  }

  for (const edge of manifest.projectEdgeUpdates) {
    statements.push(`
MERGE (p:Project {projectId: ${cypherLiteral(edge.projectId)}})
SET p.name = ${cypherLiteral(edge.projectName)},
    p.nameZh = ${cypherLiteral(edge.projectNameZh)},
    p.updatedAt = datetime()
WITH p
MATCH (s:Skill {skillId: ${cypherLiteral(edge.skillId)}})
MERGE (p)-[r:USED_SKILL]->(s)
SET r.score = ${edge.score},
    r.confidence = ${edge.confidence},
    r.sampleCount = ${edge.sampleCount},
    r.window = ${cypherLiteral(edge.window)},
    r.labelZh = '项目使用技能',
    r.updatedAt = datetime();
`)
  }

  for (const edge of manifest.departmentEdgeUpdates) {
    statements.push(`
MERGE (d:Department {departmentId: ${cypherLiteral(edge.departmentId)}})
SET d.name = ${cypherLiteral(edge.departmentName)},
    d.nameZh = ${cypherLiteral(edge.departmentNameZh)},
    d.updatedAt = datetime()
WITH d
MATCH (s:Skill {skillId: ${cypherLiteral(edge.skillId)}})
MERGE (d)-[r:PREFERS_SKILL]->(s)
SET r.score = ${edge.score},
    r.confidence = ${edge.confidence},
    r.sampleCount = ${edge.sampleCount},
    r.window = ${cypherLiteral(edge.window)},
    r.labelZh = '偏好技能',
    r.updatedAt = datetime();
`)
  }

  for (const edge of manifest.sceneEdgeUpdates) {
    statements.push(`
MERGE (sc:Scene {sceneId: ${cypherLiteral(edge.sceneId)}})
SET sc.name = ${cypherLiteral(edge.sceneName)},
    sc.nameZh = ${cypherLiteral(edge.sceneNameZh)},
    sc.updatedAt = datetime()
WITH sc
MATCH (s:Skill {skillId: ${cypherLiteral(edge.skillId)}})
MERGE (sc)-[r:SUCCESSFUL_WITH]->(s)
SET r.score = ${edge.score},
    r.confidence = ${edge.confidence},
    r.sampleCount = ${edge.sampleCount},
    r.window = ${cypherLiteral(edge.window)},
    r.labelZh = '场景成功',
    r.updatedAt = datetime();
`)
  }

  for (const aggregate of manifest.feedbackAggregates) {
    statements.push(`
MERGE (fa:FeedbackAggregate {aggregateKey: ${cypherLiteral(aggregate.aggregateKey)}})
SET fa.scopeType = ${cypherLiteral(aggregate.scopeType)},
    fa.scopeId = ${cypherLiteral(aggregate.scopeId)},
    fa.captionZh = ${cypherLiteral(`${aggregateScopeZh(aggregate.scopeType)}\n${aggregate.scopeId}`)},
    fa.window = ${cypherLiteral(aggregate.window)},
    fa.qualityScore = ${aggregate.qualityScore},
    fa.selectionRate = ${aggregate.selectionRate},
    fa.invocationRate = ${aggregate.invocationRate},
    fa.successRate = ${aggregate.successRate},
    fa.verificationPassRate = ${aggregate.verificationPassRate},
    fa.userSatisfaction = ${aggregate.userSatisfaction},
    fa.confidence = ${aggregate.confidence},
    fa.sampleCount = ${aggregate.sampleCount},
    fa.updatedAt = datetime()
WITH fa
MATCH (s:Skill {skillId: ${cypherLiteral(aggregate.skillId)}})
MERGE (fa)-[r:FOR_SKILL]->(s)
SET r.labelZh = '技能聚合';
`)

    if (aggregate.versionKey) {
      statements.push(`
MATCH (fa:FeedbackAggregate {aggregateKey: ${cypherLiteral(aggregate.aggregateKey)}})
MATCH (sv:SkillVersion {versionKey: ${cypherLiteral(aggregate.versionKey)}})
MERGE (fa)-[r:FOR_VERSION]->(sv)
SET r.labelZh = '版本聚合';
`)
    }

    if (aggregate.projectId) {
      statements.push(`
MATCH (fa:FeedbackAggregate {aggregateKey: ${cypherLiteral(aggregate.aggregateKey)}})
MATCH (p:Project {projectId: ${cypherLiteral(aggregate.projectId)}})
MERGE (fa)-[r:IN_PROJECT]->(p)
SET r.labelZh = '项目范围';
`)
    }

    if (aggregate.departmentId) {
      statements.push(`
MATCH (fa:FeedbackAggregate {aggregateKey: ${cypherLiteral(aggregate.aggregateKey)}})
MATCH (d:Department {departmentId: ${cypherLiteral(aggregate.departmentId)}})
MERGE (fa)-[r:IN_DEPARTMENT]->(d)
SET r.labelZh = '部门范围';
`)
    }

    if (aggregate.sceneId) {
      statements.push(`
MATCH (fa:FeedbackAggregate {aggregateKey: ${cypherLiteral(aggregate.aggregateKey)}})
MATCH (sc:Scene {sceneId: ${cypherLiteral(aggregate.sceneId)}})
MERGE (fa)-[r:IN_SCENE]->(sc)
SET r.labelZh = '场景范围';
`)
    }
  }

  return statements.join('\n')
}

export async function runNeo4jCypher(cypher: string): Promise<void> {
  const user = trimString(process.env.SKILL_NEO4J_USER) ?? 'neo4j'
  const password =
    trimString(process.env.SKILL_NEO4J_PASSWORD) ?? 'skills_dev_password'

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

export async function applySkillAggregateGraphUpdate(
  manifest: SkillAggregateGraphUpdateManifest,
): Promise<void> {
  await runNeo4jCypher(buildSkillAggregateGraphCypher(manifest))
}
