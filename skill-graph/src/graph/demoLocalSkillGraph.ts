import type { SkillRegistryManifest } from '../registry/registry.js'
import {
  buildSkillAggregateGraphCypher,
  makeVersionKey,
  runNeo4jCypher,
  toDepartmentId,
  toSceneId,
  type SkillAggregateGraphUpdateManifest,
} from './aggregateGraphUpdate.js'

export const DEMO_LOCAL_SKILL_IDS = [
  'frontend/website-homepage-design-basic',
  'frontend/website-homepage-design-pro',
  'frontend/admin-dashboard-design',
  'backend/rest-api-implementation',
  'backend/auth-authorization-backend',
] as const

type DemoSkillId = (typeof DEMO_LOCAL_SKILL_IDS)[number]

type DemoAggregatePreset = {
  global: AggregateMetrics
  department: AggregateMetrics
  scene: AggregateMetrics
}

type AggregateMetrics = {
  qualityScore: number
  confidence: number
  sampleCount: number
  selectionRate: number
  invocationRate: number
  successRate: number
  verificationPassRate: number
  userSatisfaction: number
}

type DemoStaticSkill = {
  skillId: DemoSkillId
  displayName: string
  description: string
  domain: string
  version: string
  sourceHash: string
  aliases: string[]
  departmentTags: string[]
  sceneTags: string[]
}

type DemoTaskSelection = {
  versionKey: string
  rank: number
  finalScore: number
  bm25Score: number
  vectorScore: number
  graphScore: number
  injected: boolean
}

type DemoTaskInvocation = {
  versionKey: string
  sequence: number
}

type DemoTaskSuccess = {
  versionKey: string
  verificationPassed: boolean
  userRating: number
  durationMinutes: number
}

type DemoTaskFailure = {
  versionKey: string
  reason: string
}

type DemoTask = {
  taskId: string
  title: string
  titleZh: string
  query: string
  queryZh: string
  status: 'success' | 'partial-success'
  departmentId: string
  departmentName: string
  departmentNameZh: string
  projectId: string
  projectName: string
  projectNameZh: string
  repo: string
  sceneId: string
  sceneName: string
  sceneNameZh: string
  selections: DemoTaskSelection[]
  invocations: DemoTaskInvocation[]
  successes: DemoTaskSuccess[]
  failures: DemoTaskFailure[]
  createdAt: string
}

const REQUIRED_SKILL_SET = new Set<string>(DEMO_LOCAL_SKILL_IDS)

const AGGREGATE_PRESETS: Record<DemoSkillId, DemoAggregatePreset> = {
  'frontend/website-homepage-design-basic': {
    global: {
      qualityScore: 0.59,
      confidence: 0.67,
      sampleCount: 8,
      selectionRate: 0.54,
      invocationRate: 0.5,
      successRate: 0.58,
      verificationPassRate: 0.52,
      userSatisfaction: 0.66,
    },
    department: {
      qualityScore: 0.61,
      confidence: 0.63,
      sampleCount: 6,
      selectionRate: 0.57,
      invocationRate: 0.52,
      successRate: 0.6,
      verificationPassRate: 0.55,
      userSatisfaction: 0.68,
    },
    scene: {
      qualityScore: 0.64,
      confidence: 0.61,
      sampleCount: 5,
      selectionRate: 0.6,
      invocationRate: 0.56,
      successRate: 0.62,
      verificationPassRate: 0.58,
      userSatisfaction: 0.7,
    },
  },
  'frontend/website-homepage-design-pro': {
    global: {
      qualityScore: 0.91,
      confidence: 0.82,
      sampleCount: 15,
      selectionRate: 0.83,
      invocationRate: 0.78,
      successRate: 0.9,
      verificationPassRate: 0.88,
      userSatisfaction: 0.93,
    },
    department: {
      qualityScore: 0.93,
      confidence: 0.79,
      sampleCount: 12,
      selectionRate: 0.86,
      invocationRate: 0.8,
      successRate: 0.92,
      verificationPassRate: 0.9,
      userSatisfaction: 0.94,
    },
    scene: {
      qualityScore: 0.95,
      confidence: 0.8,
      sampleCount: 11,
      selectionRate: 0.88,
      invocationRate: 0.84,
      successRate: 0.93,
      verificationPassRate: 0.91,
      userSatisfaction: 0.95,
    },
  },
  'frontend/admin-dashboard-design': {
    global: {
      qualityScore: 0.86,
      confidence: 0.74,
      sampleCount: 10,
      selectionRate: 0.76,
      invocationRate: 0.71,
      successRate: 0.87,
      verificationPassRate: 0.83,
      userSatisfaction: 0.88,
    },
    department: {
      qualityScore: 0.89,
      confidence: 0.72,
      sampleCount: 8,
      selectionRate: 0.79,
      invocationRate: 0.74,
      successRate: 0.9,
      verificationPassRate: 0.86,
      userSatisfaction: 0.9,
    },
    scene: {
      qualityScore: 0.88,
      confidence: 0.69,
      sampleCount: 7,
      selectionRate: 0.8,
      invocationRate: 0.75,
      successRate: 0.88,
      verificationPassRate: 0.85,
      userSatisfaction: 0.89,
    },
  },
  'backend/rest-api-implementation': {
    global: {
      qualityScore: 0.88,
      confidence: 0.77,
      sampleCount: 12,
      selectionRate: 0.78,
      invocationRate: 0.75,
      successRate: 0.89,
      verificationPassRate: 0.87,
      userSatisfaction: 0.89,
    },
    department: {
      qualityScore: 0.9,
      confidence: 0.75,
      sampleCount: 10,
      selectionRate: 0.8,
      invocationRate: 0.77,
      successRate: 0.9,
      verificationPassRate: 0.88,
      userSatisfaction: 0.9,
    },
    scene: {
      qualityScore: 0.91,
      confidence: 0.73,
      sampleCount: 9,
      selectionRate: 0.82,
      invocationRate: 0.78,
      successRate: 0.91,
      verificationPassRate: 0.89,
      userSatisfaction: 0.91,
    },
  },
  'backend/auth-authorization-backend': {
    global: {
      qualityScore: 0.84,
      confidence: 0.73,
      sampleCount: 9,
      selectionRate: 0.71,
      invocationRate: 0.68,
      successRate: 0.85,
      verificationPassRate: 0.82,
      userSatisfaction: 0.87,
    },
    department: {
      qualityScore: 0.87,
      confidence: 0.7,
      sampleCount: 7,
      selectionRate: 0.74,
      invocationRate: 0.71,
      successRate: 0.87,
      verificationPassRate: 0.84,
      userSatisfaction: 0.88,
    },
    scene: {
      qualityScore: 0.89,
      confidence: 0.71,
      sampleCount: 7,
      selectionRate: 0.76,
      invocationRate: 0.73,
      successRate: 0.88,
      verificationPassRate: 0.85,
      userSatisfaction: 0.89,
    },
  },
}

function cypherLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function rounded(value: number): number {
  return Number(value.toFixed(6))
}

function skillDisplayNameZh(skill: DemoStaticSkill): string {
  switch (skill.skillId) {
    case 'frontend/website-homepage-design-basic':
      return '官网首页设计基础版'
    case 'frontend/website-homepage-design-pro':
      return '官网首页设计专业版'
    case 'frontend/admin-dashboard-design':
      return '管理后台设计'
    case 'backend/rest-api-implementation':
      return 'REST 接口开发'
    case 'backend/auth-authorization-backend':
      return '认证授权后端'
    default:
      return skill.displayName
  }
}

function skillDescriptionZh(skill: DemoStaticSkill): string {
  return skill.description
}

function sceneNameZh(scene: string): string {
  switch (scene) {
    case 'homepage':
      return '官网首页'
    case 'design':
      return '设计'
    case 'architecture':
      return '架构'
    case 'test':
      return '测试'
    case 'security-audit':
      return '安全审查'
    default:
      return scene
  }
}

function versionCaptionZh(skill: DemoStaticSkill): string {
  if (skill.skillId.endsWith('-pro')) {
    return `专业版 ${skill.version}`
  }

  if (skill.skillId.endsWith('-basic')) {
    return `基础版 ${skill.version}`
  }

  return `版本 ${skill.version}`
}

function projectNameZh(projectId: string, fallback: string): string {
  switch (projectId) {
    case 'project:brand-site':
      return '品牌官网'
    case 'project:ops-console':
      return '运营控制台'
    case 'project:order-service':
      return '订单服务'
    case 'project:account-center':
      return '账号中心'
    default:
      return fallback
  }
}

function buildDemoTasks(skills: DemoStaticSkill[]): DemoTask[] {
  const skillById = new Map(skills.map(skill => [skill.skillId, skill] as const))
  const homepageBasic = skillById.get('frontend/website-homepage-design-basic')
  const homepagePro = skillById.get('frontend/website-homepage-design-pro')
  const adminDashboard = skillById.get('frontend/admin-dashboard-design')
  const restApi = skillById.get('backend/rest-api-implementation')
  const authBackend = skillById.get('backend/auth-authorization-backend')

  if (!homepageBasic || !homepagePro || !adminDashboard || !restApi || !authBackend) {
    throw new Error('Missing required demo skills for task generation')
  }

  const homepageBasicVersionKey = makeVersionKey(
    homepageBasic.skillId,
    homepageBasic.version,
    homepageBasic.sourceHash,
  )
  const homepageProVersionKey = makeVersionKey(
    homepagePro.skillId,
    homepagePro.version,
    homepagePro.sourceHash,
  )
  const adminVersionKey = makeVersionKey(
    adminDashboard.skillId,
    adminDashboard.version,
    adminDashboard.sourceHash,
  )
  const restVersionKey = makeVersionKey(
    restApi.skillId,
    restApi.version,
    restApi.sourceHash,
  )
  const authVersionKey = makeVersionKey(
    authBackend.skillId,
    authBackend.version,
    authBackend.sourceHash,
  )

  return [
    {
      taskId: 'task:homepage-redesign-001',
      title: 'Homepage redesign for startup site',
      titleZh: '创业公司官网首页改版',
      query: 'Redesign the homepage for a startup site with stronger trust and conversion.',
      queryZh: '重做创业公司官网首页，提升信任感和转化。',
      status: 'partial-success',
      departmentId: 'dept:frontend-platform',
      departmentName: 'frontend-platform',
      departmentNameZh: '前端平台',
      projectId: 'project:brand-site',
      projectName: 'brand-site',
      projectNameZh: '品牌官网',
      repo: 'team/brand-site',
      sceneId: 'scene:homepage',
      sceneName: 'homepage',
      sceneNameZh: '官网首页',
      selections: [
        {
          versionKey: homepageBasicVersionKey,
          rank: 1,
          finalScore: 0.82,
          bm25Score: 0.79,
          vectorScore: 0.71,
          graphScore: 0.48,
          injected: true,
        },
        {
          versionKey: homepageProVersionKey,
          rank: 2,
          finalScore: 0.79,
          bm25Score: 0.75,
          vectorScore: 0.72,
          graphScore: 0.62,
          injected: true,
        },
      ],
      invocations: [
        {
          versionKey: homepageBasicVersionKey,
          sequence: 1,
        },
        {
          versionKey: homepageProVersionKey,
          sequence: 2,
        },
      ],
      successes: [
        {
          versionKey: homepageProVersionKey,
          verificationPassed: true,
          userRating: 5,
          durationMinutes: 26,
        },
      ],
      failures: [
        {
          versionKey: homepageBasicVersionKey,
          reason: 'layout too generic and lacked strong conversion path',
        },
      ],
      createdAt: '2026-04-12T08:30:00.000Z',
    },
    {
      taskId: 'task:homepage-launch-002',
      title: 'Premium homepage launch page',
      titleZh: '高端官网首页发布页',
      query: 'Create a polished homepage for a premium product launch.',
      queryZh: '为高端产品发布设计一个更精致的官网首页。',
      status: 'success',
      departmentId: 'dept:frontend-platform',
      departmentName: 'frontend-platform',
      departmentNameZh: '前端平台',
      projectId: 'project:brand-site',
      projectName: 'brand-site',
      projectNameZh: '品牌官网',
      repo: 'team/brand-site',
      sceneId: 'scene:homepage',
      sceneName: 'homepage',
      sceneNameZh: '官网首页',
      selections: [
        {
          versionKey: homepageProVersionKey,
          rank: 1,
          finalScore: 0.91,
          bm25Score: 0.84,
          vectorScore: 0.78,
          graphScore: 0.74,
          injected: true,
        },
      ],
      invocations: [
        {
          versionKey: homepageProVersionKey,
          sequence: 1,
        },
      ],
      successes: [
        {
          versionKey: homepageProVersionKey,
          verificationPassed: true,
          userRating: 5,
          durationMinutes: 18,
        },
      ],
      failures: [],
      createdAt: '2026-04-12T08:35:00.000Z',
    },
    {
      taskId: 'task:admin-console-003',
      title: 'Operations admin dashboard refresh',
      titleZh: '运营后台仪表盘改造',
      query: 'Refresh the operations admin dashboard for dense workflows.',
      queryZh: '改造运营后台仪表盘，适配高密度工作流。',
      status: 'success',
      departmentId: 'dept:frontend-platform',
      departmentName: 'frontend-platform',
      departmentNameZh: '前端平台',
      projectId: 'project:ops-console',
      projectName: 'ops-console',
      projectNameZh: '运营控制台',
      repo: 'team/ops-console',
      sceneId: 'scene:design',
      sceneName: 'design',
      sceneNameZh: '设计',
      selections: [
        {
          versionKey: adminVersionKey,
          rank: 1,
          finalScore: 0.88,
          bm25Score: 0.82,
          vectorScore: 0.73,
          graphScore: 0.69,
          injected: true,
        },
      ],
      invocations: [
        {
          versionKey: adminVersionKey,
          sequence: 1,
        },
      ],
      successes: [
        {
          versionKey: adminVersionKey,
          verificationPassed: true,
          userRating: 4,
          durationMinutes: 22,
        },
      ],
      failures: [],
      createdAt: '2026-04-12T08:40:00.000Z',
    },
    {
      taskId: 'task:rest-api-004',
      title: 'Order service REST endpoint implementation',
      titleZh: '订单服务 REST 接口实现',
      query: 'Implement a REST API endpoint with validation and pagination.',
      queryZh: '实现带参数校验和分页的 REST 接口。',
      status: 'success',
      departmentId: 'dept:backend-platform',
      departmentName: 'backend-platform',
      departmentNameZh: '后端平台',
      projectId: 'project:order-service',
      projectName: 'order-service',
      projectNameZh: '订单服务',
      repo: 'team/order-service',
      sceneId: 'scene:architecture',
      sceneName: 'architecture',
      sceneNameZh: '架构',
      selections: [
        {
          versionKey: restVersionKey,
          rank: 1,
          finalScore: 0.9,
          bm25Score: 0.83,
          vectorScore: 0.75,
          graphScore: 0.72,
          injected: true,
        },
      ],
      invocations: [
        {
          versionKey: restVersionKey,
          sequence: 1,
        },
      ],
      successes: [
        {
          versionKey: restVersionKey,
          verificationPassed: true,
          userRating: 5,
          durationMinutes: 16,
        },
      ],
      failures: [],
      createdAt: '2026-04-12T08:45:00.000Z',
    },
    {
      taskId: 'task:authz-005',
      title: 'Tenant-aware auth backend update',
      titleZh: '多租户鉴权后端更新',
      query: 'Update backend authorization flow for tenant-aware access control.',
      queryZh: '更新后端鉴权流程，支持多租户访问控制。',
      status: 'success',
      departmentId: 'dept:backend-platform',
      departmentName: 'backend-platform',
      departmentNameZh: '后端平台',
      projectId: 'project:account-center',
      projectName: 'account-center',
      projectNameZh: '账号中心',
      repo: 'team/account-center',
      sceneId: 'scene:security-audit',
      sceneName: 'security-audit',
      sceneNameZh: '安全审查',
      selections: [
        {
          versionKey: authVersionKey,
          rank: 1,
          finalScore: 0.87,
          bm25Score: 0.81,
          vectorScore: 0.7,
          graphScore: 0.71,
          injected: true,
        },
      ],
      invocations: [
        {
          versionKey: authVersionKey,
          sequence: 1,
        },
      ],
      successes: [
        {
          versionKey: authVersionKey,
          verificationPassed: true,
          userRating: 4,
          durationMinutes: 20,
        },
      ],
      failures: [],
      createdAt: '2026-04-12T08:50:00.000Z',
    },
  ]
}

function sceneForEffects(skill: DemoStaticSkill): string {
  if (skill.sceneTags.includes('homepage')) {
    return 'homepage'
  }

  if (skill.sceneTags.includes('security-audit')) {
    return 'security-audit'
  }

  if (skill.sceneTags.includes('architecture')) {
    return 'architecture'
  }

  return skill.sceneTags[0] ?? 'general'
}

function primaryDepartment(skill: DemoStaticSkill): string {
  return skill.departmentTags[0] ?? 'general'
}

function aggregateKeyFor(
  skillId: string,
  scopeType: 'global' | 'department' | 'scene' | 'version',
  scopeId: string,
  window: string,
): string {
  return `agg:skill:${skillId}:${scopeType}:${scopeId}:${window}`
}

export function selectDemoLocalSkills(
  registry: SkillRegistryManifest,
): DemoStaticSkill[] {
  const selected = registry.skills
    .filter(skill => REQUIRED_SKILL_SET.has(skill.skillId))
    .map(skill => ({
      skillId: skill.skillId as DemoSkillId,
      displayName: skill.displayName,
      description: skill.description,
      domain: skill.domain,
      version: skill.version,
      sourceHash: skill.sourceHash,
      aliases: skill.aliases,
      departmentTags: skill.departmentTags,
      sceneTags: skill.sceneTags,
    }))
    .sort((a, b) => a.skillId.localeCompare(b.skillId))

  if (selected.length !== DEMO_LOCAL_SKILL_IDS.length) {
    const found = new Set(selected.map(skill => skill.skillId))
    const missing = DEMO_LOCAL_SKILL_IDS.filter(skillId => !found.has(skillId))
    throw new Error(`Missing demo skills in registry: ${missing.join(', ')}`)
  }

  return selected
}

export function buildDemoAggregateGraphUpdateManifest(
  skills: DemoStaticSkill[],
): SkillAggregateGraphUpdateManifest {
  const generatedAt = new Date().toISOString()
  const window = '30d'
  const feedbackAggregates: SkillAggregateGraphUpdateManifest['feedbackAggregates'] = []
  const skillUpdates: SkillAggregateGraphUpdateManifest['skillUpdates'] = []
  const versionUpdates: SkillAggregateGraphUpdateManifest['versionUpdates'] = []
  const departmentEdgeUpdates: SkillAggregateGraphUpdateManifest['departmentEdgeUpdates'] = []
  const sceneEdgeUpdates: SkillAggregateGraphUpdateManifest['sceneEdgeUpdates'] = []

  for (const skill of skills) {
    const preset = AGGREGATE_PRESETS[skill.skillId]
    const department = primaryDepartment(skill)
    const scene = sceneForEffects(skill)
    const versionKey = makeVersionKey(skill.skillId, skill.version, skill.sourceHash)

    skillUpdates.push({
      skillId: skill.skillId,
      displayName: skill.displayName,
      displayNameZh: skillDisplayNameZh(skill),
      domain: skill.domain,
      description: skill.description,
      descriptionZh: skillDescriptionZh(skill),
      globalQualityScore: rounded(preset.global.qualityScore),
      globalConfidence: rounded(preset.global.confidence),
    })

    versionUpdates.push({
      skillId: skill.skillId,
      version: skill.version,
      sourceHash: skill.sourceHash,
      versionKey,
      captionZh: versionCaptionZh(skill),
      qualityScore: rounded(preset.global.qualityScore),
      confidence: rounded(preset.global.confidence),
      active: true,
    })

    departmentEdgeUpdates.push({
      departmentId: toDepartmentId(department),
      departmentName: department,
      departmentNameZh:
        department === 'frontend-platform' ? '前端平台' :
        department === 'backend-platform' ? '后端平台' :
        department,
      skillId: skill.skillId,
      score: rounded(preset.department.qualityScore),
      confidence: rounded(preset.department.confidence),
      sampleCount: preset.department.sampleCount,
      window,
    })

    sceneEdgeUpdates.push({
      sceneId: toSceneId(scene),
      sceneName: scene,
      sceneNameZh: sceneNameZh(scene),
      skillId: skill.skillId,
      score: rounded(preset.scene.qualityScore),
      confidence: rounded(preset.scene.confidence),
      sampleCount: preset.scene.sampleCount,
      window,
    })

    feedbackAggregates.push(
      {
        aggregateKey: aggregateKeyFor(skill.skillId, 'global', 'global', window),
        scopeType: 'global',
        scopeId: 'global',
        skillId: skill.skillId,
        skillVersion: null,
        sourceHash: null,
        versionKey: null,
        departmentId: null,
        sceneId: null,
        window,
        qualityScore: rounded(preset.global.qualityScore),
        selectionRate: rounded(preset.global.selectionRate),
        invocationRate: rounded(preset.global.invocationRate),
        successRate: rounded(preset.global.successRate),
        verificationPassRate: rounded(preset.global.verificationPassRate),
        userSatisfaction: rounded(preset.global.userSatisfaction),
        confidence: rounded(preset.global.confidence),
        sampleCount: preset.global.sampleCount,
        updatedAt: generatedAt,
      },
      {
        aggregateKey: aggregateKeyFor(skill.skillId, 'department', department, window),
        scopeType: 'department',
        scopeId: department,
        skillId: skill.skillId,
        skillVersion: null,
        sourceHash: null,
        versionKey: null,
        departmentId: toDepartmentId(department),
        sceneId: null,
        window,
        qualityScore: rounded(preset.department.qualityScore),
        selectionRate: rounded(preset.department.selectionRate),
        invocationRate: rounded(preset.department.invocationRate),
        successRate: rounded(preset.department.successRate),
        verificationPassRate: rounded(preset.department.verificationPassRate),
        userSatisfaction: rounded(preset.department.userSatisfaction),
        confidence: rounded(preset.department.confidence),
        sampleCount: preset.department.sampleCount,
        updatedAt: generatedAt,
      },
      {
        aggregateKey: aggregateKeyFor(skill.skillId, 'scene', scene, window),
        scopeType: 'scene',
        scopeId: scene,
        skillId: skill.skillId,
        skillVersion: null,
        sourceHash: null,
        versionKey: null,
        departmentId: null,
        sceneId: toSceneId(scene),
        window,
        qualityScore: rounded(preset.scene.qualityScore),
        selectionRate: rounded(preset.scene.selectionRate),
        invocationRate: rounded(preset.scene.invocationRate),
        successRate: rounded(preset.scene.successRate),
        verificationPassRate: rounded(preset.scene.verificationPassRate),
        userSatisfaction: rounded(preset.scene.userSatisfaction),
        confidence: rounded(preset.scene.confidence),
        sampleCount: preset.scene.sampleCount,
        updatedAt: generatedAt,
      },
      {
        aggregateKey: aggregateKeyFor(
          skill.skillId,
          'version',
          `${skill.version}#${skill.sourceHash}`,
          window,
        ),
        scopeType: 'version',
        scopeId: `${skill.version}#${skill.sourceHash}`,
        skillId: skill.skillId,
        skillVersion: skill.version,
        sourceHash: skill.sourceHash,
        versionKey,
        departmentId: null,
        sceneId: null,
        window,
        qualityScore: rounded(preset.global.qualityScore),
        selectionRate: rounded(preset.global.selectionRate),
        invocationRate: rounded(preset.global.invocationRate),
        successRate: rounded(preset.global.successRate),
        verificationPassRate: rounded(preset.global.verificationPassRate),
        userSatisfaction: rounded(preset.global.userSatisfaction),
        confidence: rounded(preset.global.confidence),
        sampleCount: preset.global.sampleCount,
        updatedAt: generatedAt,
      },
    )
  }

  return {
    schemaVersion: '2026-04-12',
    generatedAt,
    sourceAggregateGeneratedAt: generatedAt,
    aggregateWindow: window,
    itemCount: feedbackAggregates.length,
    skillUpdates,
    versionUpdates,
    departmentEdgeUpdates,
    sceneEdgeUpdates,
    feedbackAggregates,
  }
}

export function buildDemoLocalSkillGraphCypher(
  skills: DemoStaticSkill[],
  manifest: SkillAggregateGraphUpdateManifest,
): string {
  const tasks = buildDemoTasks(skills)
  const statements: string[] = [
    'CREATE CONSTRAINT skill_id_v1 IF NOT EXISTS FOR (s:Skill) REQUIRE s.skillId IS UNIQUE;',
    'CREATE CONSTRAINT skill_version_key_v1 IF NOT EXISTS FOR (sv:SkillVersion) REQUIRE sv.versionKey IS UNIQUE;',
    'CREATE CONSTRAINT scene_id_v1 IF NOT EXISTS FOR (sc:Scene) REQUIRE sc.sceneId IS UNIQUE;',
    'CREATE CONSTRAINT department_id_v1 IF NOT EXISTS FOR (d:Department) REQUIRE d.departmentId IS UNIQUE;',
    'CREATE CONSTRAINT feedback_aggregate_key_v1 IF NOT EXISTS FOR (fa:FeedbackAggregate) REQUIRE fa.aggregateKey IS UNIQUE;',
    'CREATE CONSTRAINT alias_name_v1 IF NOT EXISTS FOR (a:Alias) REQUIRE a.name IS UNIQUE;',
    'MATCH (n) DETACH DELETE n;',
  ]

  for (const skill of skills) {
    const global = manifest.skillUpdates.find(item => item.skillId === skill.skillId)
    const version = manifest.versionUpdates.find(item => item.skillId === skill.skillId)

    statements.push(`
MERGE (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
SET s.displayName = ${cypherLiteral(skill.displayName)},
    s.displayNameZh = ${cypherLiteral(skillDisplayNameZh(skill))},
    s.domain = ${cypherLiteral(skill.domain)},
    s.description = ${cypherLiteral(skill.description)},
    s.descriptionZh = ${cypherLiteral(skillDescriptionZh(skill))},
    s.globalQualityScore = ${global?.globalQualityScore ?? 0},
    s.globalConfidence = ${global?.globalConfidence ?? 0},
    s.activeVersionKey = ${cypherLiteral(version?.versionKey ?? '')},
    s.updatedAt = datetime();
`)

    for (const alias of skill.aliases) {
      statements.push(`
MERGE (a:Alias {name: ${cypherLiteral(alias)}})
SET a.normalizedName = ${cypherLiteral(alias.toLowerCase())},
    a.updatedAt = datetime()
WITH a
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (a)-[r:ALIASES_SKILL]->(s)
SET r.labelZh = '别名';
`)
    }

    const versionKey = makeVersionKey(skill.skillId, skill.version, skill.sourceHash)
    statements.push(`
MERGE (sv:SkillVersion {versionKey: ${cypherLiteral(versionKey)}})
SET sv.skillId = ${cypherLiteral(skill.skillId)},
    sv.version = ${cypherLiteral(skill.version)},
    sv.sourceHash = ${cypherLiteral(skill.sourceHash)},
    sv.captionZh = ${cypherLiteral(versionCaptionZh(skill))},
    sv.active = true,
    sv.qualityScore = ${version?.qualityScore ?? 0},
    sv.confidence = ${version?.confidence ?? 0},
    sv.updatedAt = datetime()
WITH sv
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (s)-[r:HAS_VERSION]->(sv)
SET r.labelZh = '拥有版本';
`)

    for (const scene of skill.sceneTags) {
      statements.push(`
MERGE (sc:Scene {sceneId: ${cypherLiteral(toSceneId(scene))}})
SET sc.name = ${cypherLiteral(scene)},
    sc.nameZh = ${cypherLiteral(sceneNameZh(scene))},
    sc.updatedAt = datetime()
WITH sc
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (s)-[r:APPLIES_TO_SCENE]->(sc)
SET r.weight = 1,
    r.labelZh = '适用场景',
    r.updatedAt = datetime();
`)
    }
  }

  for (const task of tasks) {
    statements.push(`
MERGE (t:Task {taskId: ${cypherLiteral(task.taskId)}})
SET t.title = ${cypherLiteral(task.title)},
    t.titleZh = ${cypherLiteral(task.titleZh)},
    t.query = ${cypherLiteral(task.query)},
    t.queryZh = ${cypherLiteral(task.queryZh)},
    t.status = ${cypherLiteral(task.status)},
    t.source = 'demo_local_v1',
    t.createdAt = datetime(${cypherLiteral(task.createdAt)}),
    t.updatedAt = datetime();
`)

    statements.push(`
MERGE (d:Department {departmentId: ${cypherLiteral(task.departmentId)}})
SET d.name = ${cypherLiteral(task.departmentName)},
    d.nameZh = ${cypherLiteral(task.departmentNameZh)},
    d.updatedAt = datetime()
WITH d
MATCH (t:Task {taskId: ${cypherLiteral(task.taskId)}})
MERGE (t)-[r:BELONGS_TO_DEPARTMENT]->(d)
SET r.labelZh = '所属部门';
`)

    statements.push(`
MERGE (p:Project {projectId: ${cypherLiteral(task.projectId)}})
SET p.name = ${cypherLiteral(task.projectName)},
    p.nameZh = ${cypherLiteral(task.projectNameZh)},
    p.repo = ${cypherLiteral(task.repo)},
    p.updatedAt = datetime()
WITH p
MATCH (t:Task {taskId: ${cypherLiteral(task.taskId)}})
MERGE (t)-[r:IN_PROJECT]->(p)
SET r.labelZh = '所属项目';
`)

    statements.push(`
MERGE (sc:Scene {sceneId: ${cypherLiteral(task.sceneId)}})
SET sc.name = ${cypherLiteral(task.sceneName)},
    sc.nameZh = ${cypherLiteral(task.sceneNameZh)},
    sc.updatedAt = datetime()
WITH sc
MATCH (t:Task {taskId: ${cypherLiteral(task.taskId)}})
MERGE (t)-[r:PRIMARY_SCENE]->(sc)
SET r.labelZh = '主场景';
`)

    for (const selection of task.selections) {
      statements.push(`
MATCH (t:Task {taskId: ${cypherLiteral(task.taskId)}})
MATCH (sv:SkillVersion {versionKey: ${cypherLiteral(selection.versionKey)}})
MERGE (t)-[r:SELECTED]->(sv)
SET r.rank = ${selection.rank},
    r.finalScore = ${selection.finalScore},
    r.bm25Score = ${selection.bm25Score},
    r.vectorScore = ${selection.vectorScore},
    r.graphScore = ${selection.graphScore},
    r.injected = ${selection.injected ? 'true' : 'false'},
    r.labelZh = '已选择',
    r.updatedAt = datetime();
`)
    }

    for (const invocation of task.invocations) {
      statements.push(`
MATCH (t:Task {taskId: ${cypherLiteral(task.taskId)}})
MATCH (sv:SkillVersion {versionKey: ${cypherLiteral(invocation.versionKey)}})
MERGE (t)-[r:INVOKED]->(sv)
SET r.sequence = ${invocation.sequence},
    r.labelZh = '已调用',
    r.updatedAt = datetime();
`)
    }

    for (const success of task.successes) {
      statements.push(`
MATCH (t:Task {taskId: ${cypherLiteral(task.taskId)}})
MATCH (sv:SkillVersion {versionKey: ${cypherLiteral(success.versionKey)}})
MERGE (t)-[r:SUCCEEDED_WITH]->(sv)
SET r.verificationPassed = ${success.verificationPassed ? 'true' : 'false'},
    r.userRating = ${success.userRating},
    r.durationMinutes = ${success.durationMinutes},
    r.labelZh = '成功使用',
    r.updatedAt = datetime();
`)
    }

    for (const failure of task.failures) {
      statements.push(`
MATCH (t:Task {taskId: ${cypherLiteral(task.taskId)}})
MATCH (sv:SkillVersion {versionKey: ${cypherLiteral(failure.versionKey)}})
MERGE (t)-[r:FAILED_WITH]->(sv)
SET r.reason = ${cypherLiteral(failure.reason)},
    r.labelZh = '失败使用',
    r.updatedAt = datetime();
`)
    }
  }

  statements.push(buildSkillAggregateGraphCypher(manifest))
  return statements.join('\n')
}

export async function resetDemoLocalSkillGraph(
  registry: SkillRegistryManifest,
): Promise<void> {
  const skills = selectDemoLocalSkills(registry)
  const manifest = buildDemoAggregateGraphUpdateManifest(skills)
  await runNeo4jCypher(buildDemoLocalSkillGraphCypher(skills, manifest))
}
