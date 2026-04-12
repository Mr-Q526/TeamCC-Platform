import { spawn } from 'child_process'

const COMPOSE_FILE = 'docker-compose.skill-data.yml'
const NEO4J_SERVICE = 'skill-neo4j'

type ConceptDef = {
  conceptId: string
  name: string
  kind: string
  weight: number
}

type SceneDef = {
  sceneId: string
  name: string
  weight: number
}

type DepartmentPreferenceDef = {
  departmentId: string
  name: string
  score: number
  confidence: number
  sampleCount: number
}

type ScenePerformanceDef = {
  sceneId: string
  name: string
  score: number
  confidence: number
  sampleCount: number
}

type ProjectPerformanceDef = {
  projectId: string
  name: string
  repo: string
  score: number
  successRate: number
  invocationCount: number
}

type VersionDef = {
  version: string
  sourceHash: string
  qualityTier: 'pro' | 'basic' | 'standard'
  active: boolean
  qualityScore: number
  confidence: number
  promptStyle: string
  releaseDate: string
}

type AggregateDef = {
  aggregateKey: string
  scopeType: 'global' | 'department' | 'scene' | 'project' | 'version'
  scopeId: string
  window: string
  qualityScore: number
  selectionRate: number
  invocationRate: number
  successRate: number
  verificationPassRate: number
  userSatisfaction: number
  confidence: number
  sampleCount: number
  versionKey?: string
  departmentId?: string
  sceneId?: string
  projectId?: string
}

type SkillDef = {
  skillId: string
  displayName: string
  domain: string
  description: string
  aliases: string[]
  concepts: ConceptDef[]
  scenes: SceneDef[]
  departmentPreferences: DepartmentPreferenceDef[]
  scenePerformance: ScenePerformanceDef[]
  projectPerformance: ProjectPerformanceDef[]
  versions: VersionDef[]
  aggregates: AggregateDef[]
}

type TaskSelectionDef = {
  versionKey: string
  rank: number
  finalScore: number
  bm25Score: number
  vectorScore: number
  graphScore: number
  injected: boolean
}

type TaskInvocationDef = {
  versionKey: string
  sequence: number
}

type TaskSuccessDef = {
  versionKey: string
  verificationPassed: boolean
  userRating: number
  durationMinutes: number
}

type TaskFailureDef = {
  versionKey: string
  reason: string
}

type TaskDef = {
  taskId: string
  title: string
  query: string
  status: 'success' | 'partial-success'
  departmentId: string
  departmentName: string
  projectId: string
  projectName: string
  repo: string
  sceneId: string
  sceneName: string
  requestedConcepts: Array<ConceptDef>
  selections: TaskSelectionDef[]
  invocations: TaskInvocationDef[]
  successes: TaskSuccessDef[]
  failures: TaskFailureDef[]
  createdAt: string
}

type RelatedSkillEdge = {
  fromSkillId: string
  toSkillId: string
  weight: number
  reason: string
}

function cypherLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function cypherDateTime(value: string): string {
  return `datetime(${cypherLiteral(value)})`
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function makeVersionKey(skillId: string, version: string, sourceHash: string): string {
  return `${skillId}@${version}#${sourceHash.slice(0, 12)}`
}

function shortId(id: string): string {
  return id.split('/').pop() || id
}

function qualityTierZh(value: VersionDef['qualityTier']): string {
  switch (value) {
    case 'pro':
      return '专业版'
    case 'basic':
      return '基础版'
    default:
      return '标准版'
  }
}

function aggregateScopeZh(value: AggregateDef['scopeType']): string {
  switch (value) {
    case 'global':
      return '全局聚合'
    case 'department':
      return '部门聚合'
    case 'scene':
      return '场景聚合'
    case 'project':
      return '项目聚合'
    case 'version':
      return '版本聚合'
    default:
      return value
  }
}

const skillZhNames: Record<string, string> = {
  'frontend/admin-dashboard-design': '管理后台设计',
  'frontend/analytics-dashboard-design': '数据看板设计',
  'backend/rest-api-implementation': 'REST 接口开发',
  'backend/auth-authorization-backend': '认证授权后端',
  'review/code-review-risk-based': '高风险代码评审',
  'security/security-vulnerability-check': '安全漏洞检查',
  'infra/load-testing': '负载测试',
  'backend/backend-performance-profiling': '后端性能剖析',
}

const skillZhDescriptions: Record<string, string> = {
  'frontend/admin-dashboard-design': '适合运营后台、审核后台和数据密集型管理控制台的页面设计能力。',
  'frontend/analytics-dashboard-design': '适合 BI、KPI 和数据分析控制台的看板设计能力。',
  'backend/rest-api-implementation': '适合 REST 接口、分页、校验和错误语义的后端实现能力。',
  'backend/auth-authorization-backend': '适合登录认证、授权、RBAC 和多租户边界的后端能力。',
  'review/code-review-risk-based': '适合高风险改动、鉴权、迁移和并发问题的代码评审能力。',
  'security/security-vulnerability-check': '适合鉴权、依赖和输入校验等漏洞排查的安全能力。',
  'infra/load-testing': '适合压测、容量评估和吞吐分析的性能测试能力。',
  'backend/backend-performance-profiling': '适合慢接口、热点查询和瓶颈定位的性能剖析能力。',
}

const conceptZhNames: Record<string, string> = {
  'concept:admin-dashboard': '管理后台',
  'concept:backoffice-ui': '后台界面',
  'concept:table-workflow': '表格工作流',
  'concept:analytics-dashboard': '数据分析看板',
  'concept:data-visualization': '数据可视化',
  'concept:kpi-monitoring': 'KPI 监控',
  'concept:rest-api': 'REST 接口',
  'concept:request-validation': '请求校验',
  'concept:pagination': '分页',
  'concept:authz': '授权控制',
  'concept:rbac': 'RBAC',
  'concept:multitenancy': '多租户',
  'concept:high-risk-review': '高风险评审',
  'concept:migration-risk': '迁移风险',
  'concept:vulnerability-audit': '漏洞审查',
  'concept:dependency-risk': '依赖风险',
  'concept:secure-coding': '安全编码',
  'concept:load-testing': '负载测试',
  'concept:capacity-planning': '容量规划',
  'concept:performance-bottleneck': '性能瓶颈',
  'concept:performance-profiling': '性能剖析',
  'concept:query-hotspot': '热点查询',
}

const sceneZhNames: Record<string, string> = {
  'scene:admin-console': '管理后台',
  'scene:dashboard': '仪表盘',
  'scene:analytics-console': '分析控制台',
  'scene:api-service': '接口服务',
  'scene:account-system': '账号系统',
  'scene:code-review': '代码评审',
  'scene:security-audit': '安全审查',
  'scene:performance-test': '性能测试',
}

const departmentZhNames: Record<string, string> = {
  'dept:frontend-platform': '前端平台',
  'dept:growth': '增长团队',
  'dept:data-platform': '数据平台',
  'dept:backend-platform': '后端平台',
  'dept:security-platform': '安全平台',
  'dept:infra-platform': '基础设施平台',
}

const projectZhNames: Record<string, string> = {
  'project:ops-console': '运营控制台',
  'project:order-service': '订单服务',
  'project:payments-platform': '支付平台',
}

function displayZh(value: string, map: Record<string, string>, fallback: string): string {
  return map[value] || fallback
}

async function runCypher(cypher: string): Promise<void> {
  const user = process.env.SKILL_NEO4J_USER?.trim() || 'neo4j'
  const password = process.env.SKILL_NEO4J_PASSWORD?.trim() || 'skills_dev_password'

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'compose',
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

const skills: SkillDef[] = [
  {
    skillId: 'frontend/admin-dashboard-design',
    displayName: 'Admin Dashboard Design',
    domain: 'frontend',
    description: 'Designs data-heavy back-office and operations dashboards with strong IA and table-driven workflows.',
    aliases: ['管理后台设计', '运营后台设计', '后台网页设计'],
    concepts: [
      { conceptId: 'concept:admin-dashboard', name: 'admin dashboard', kind: 'capability', weight: 0.96 },
      { conceptId: 'concept:backoffice-ui', name: 'back-office ui', kind: 'capability', weight: 0.92 },
      { conceptId: 'concept:table-workflow', name: 'table workflow', kind: 'artifact', weight: 0.76 },
    ],
    scenes: [
      { sceneId: 'scene:admin-console', name: 'admin console', weight: 0.98 },
      { sceneId: 'scene:dashboard', name: 'dashboard', weight: 0.87 },
    ],
    departmentPreferences: [
      { departmentId: 'dept:frontend-platform', name: 'frontend-platform', score: 0.93, confidence: 0.86, sampleCount: 44 },
      { departmentId: 'dept:growth', name: 'growth', score: 0.82, confidence: 0.64, sampleCount: 12 },
    ],
    scenePerformance: [
      { sceneId: 'scene:admin-console', name: 'admin console', score: 0.92, confidence: 0.84, sampleCount: 31 },
    ],
    projectPerformance: [
      { projectId: 'project:ops-console', name: 'ops-console', repo: 'team/ops-console', score: 0.94, successRate: 0.91, invocationCount: 23 },
    ],
    versions: [
      {
        version: '2.2.0-pro',
        sourceHash: 'ad22pro9f1c2b6d8e001',
        qualityTier: 'pro',
        active: true,
        qualityScore: 0.93,
        confidence: 0.88,
        promptStyle: 'structured-enterprise',
        releaseDate: '2026-04-01T10:00:00+08:00',
      },
      {
        version: '1.0.0-basic',
        sourceHash: 'ad10basic1c9dd0a0032',
        qualityTier: 'basic',
        active: false,
        qualityScore: 0.58,
        confidence: 0.62,
        promptStyle: 'lightweight-generic',
        releaseDate: '2026-03-12T10:00:00+08:00',
      },
    ],
    aggregates: [
      {
        aggregateKey: 'agg:skill:frontend/admin-dashboard-design:global:30d',
        scopeType: 'global',
        scopeId: 'global',
        window: '30d',
        qualityScore: 0.82,
        selectionRate: 0.61,
        invocationRate: 0.54,
        successRate: 0.79,
        verificationPassRate: 0.82,
        userSatisfaction: 0.84,
        confidence: 0.81,
        sampleCount: 55,
      },
      {
        aggregateKey: 'agg:skill:frontend/admin-dashboard-design:version:pro:30d',
        scopeType: 'version',
        scopeId: 'frontend/admin-dashboard-design@2.2.0-pro',
        window: '30d',
        qualityScore: 0.93,
        selectionRate: 0.74,
        invocationRate: 0.7,
        successRate: 0.9,
        verificationPassRate: 0.92,
        userSatisfaction: 0.93,
        confidence: 0.86,
        sampleCount: 37,
        versionKey: makeVersionKey('frontend/admin-dashboard-design', '2.2.0-pro', 'ad22pro9f1c2b6d8e001'),
      },
      {
        aggregateKey: 'agg:skill:frontend/admin-dashboard-design:version:basic:30d',
        scopeType: 'version',
        scopeId: 'frontend/admin-dashboard-design@1.0.0-basic',
        window: '30d',
        qualityScore: 0.49,
        selectionRate: 0.32,
        invocationRate: 0.28,
        successRate: 0.36,
        verificationPassRate: 0.41,
        userSatisfaction: 0.44,
        confidence: 0.68,
        sampleCount: 18,
        versionKey: makeVersionKey('frontend/admin-dashboard-design', '1.0.0-basic', 'ad10basic1c9dd0a0032'),
      },
      {
        aggregateKey: 'agg:skill:frontend/admin-dashboard-design:department:frontend-platform:30d',
        scopeType: 'department',
        scopeId: 'dept:frontend-platform',
        window: '30d',
        qualityScore: 0.91,
        selectionRate: 0.78,
        invocationRate: 0.72,
        successRate: 0.89,
        verificationPassRate: 0.9,
        userSatisfaction: 0.92,
        confidence: 0.84,
        sampleCount: 29,
        departmentId: 'dept:frontend-platform',
      },
    ],
  },
  {
    skillId: 'frontend/analytics-dashboard-design',
    displayName: 'Analytics Dashboard Design',
    domain: 'frontend',
    description: 'Designs KPI, BI, and analytics dashboards with chart selection, hierarchy, and monitoring emphasis.',
    aliases: ['数据看板设计', 'BI看板设计', '分析后台设计'],
    concepts: [
      { conceptId: 'concept:analytics-dashboard', name: 'analytics dashboard', kind: 'capability', weight: 0.97 },
      { conceptId: 'concept:data-visualization', name: 'data visualization', kind: 'capability', weight: 0.91 },
      { conceptId: 'concept:kpi-monitoring', name: 'kpi monitoring', kind: 'capability', weight: 0.82 },
    ],
    scenes: [
      { sceneId: 'scene:analytics-console', name: 'analytics console', weight: 0.98 },
      { sceneId: 'scene:dashboard', name: 'dashboard', weight: 0.9 },
    ],
    departmentPreferences: [
      { departmentId: 'dept:frontend-platform', name: 'frontend-platform', score: 0.88, confidence: 0.81, sampleCount: 26 },
      { departmentId: 'dept:data-platform', name: 'data-platform', score: 0.83, confidence: 0.74, sampleCount: 19 },
    ],
    scenePerformance: [
      { sceneId: 'scene:analytics-console', name: 'analytics console', score: 0.91, confidence: 0.83, sampleCount: 22 },
    ],
    projectPerformance: [
      { projectId: 'project:ops-console', name: 'ops-console', repo: 'team/ops-console', score: 0.89, successRate: 0.87, invocationCount: 17 },
    ],
    versions: [
      {
        version: '1.4.0-pro',
        sourceHash: 'an14proab3c2d9987721',
        qualityTier: 'pro',
        active: true,
        qualityScore: 0.91,
        confidence: 0.86,
        promptStyle: 'chart-forward-enterprise',
        releaseDate: '2026-04-03T10:00:00+08:00',
      },
      {
        version: '0.9.0-basic',
        sourceHash: 'an09basicde91aa670024',
        qualityTier: 'basic',
        active: false,
        qualityScore: 0.57,
        confidence: 0.61,
        promptStyle: 'simple-kpi-layout',
        releaseDate: '2026-03-08T10:00:00+08:00',
      },
    ],
    aggregates: [
      {
        aggregateKey: 'agg:skill:frontend/analytics-dashboard-design:global:30d',
        scopeType: 'global',
        scopeId: 'global',
        window: '30d',
        qualityScore: 0.84,
        selectionRate: 0.58,
        invocationRate: 0.52,
        successRate: 0.82,
        verificationPassRate: 0.85,
        userSatisfaction: 0.87,
        confidence: 0.8,
        sampleCount: 41,
      },
      {
        aggregateKey: 'agg:skill:frontend/analytics-dashboard-design:scene:analytics-console:30d',
        scopeType: 'scene',
        scopeId: 'scene:analytics-console',
        window: '30d',
        qualityScore: 0.9,
        selectionRate: 0.73,
        invocationRate: 0.68,
        successRate: 0.89,
        verificationPassRate: 0.9,
        userSatisfaction: 0.91,
        confidence: 0.82,
        sampleCount: 24,
        sceneId: 'scene:analytics-console',
      },
    ],
  },
  {
    skillId: 'backend/rest-api-implementation',
    displayName: 'REST API Implementation',
    domain: 'backend',
    description: 'Implements REST API endpoints, validation, pagination, and clear error semantics for service teams.',
    aliases: ['REST接口开发', 'API接口实现', '后端接口开发'],
    concepts: [
      { conceptId: 'concept:rest-api', name: 'rest api', kind: 'capability', weight: 0.98 },
      { conceptId: 'concept:request-validation', name: 'request validation', kind: 'capability', weight: 0.84 },
      { conceptId: 'concept:pagination', name: 'pagination', kind: 'artifact', weight: 0.72 },
    ],
    scenes: [
      { sceneId: 'scene:api-service', name: 'api service', weight: 0.98 },
    ],
    departmentPreferences: [
      { departmentId: 'dept:backend-platform', name: 'backend-platform', score: 0.91, confidence: 0.87, sampleCount: 39 },
    ],
    scenePerformance: [
      { sceneId: 'scene:api-service', name: 'api service', score: 0.89, confidence: 0.84, sampleCount: 33 },
    ],
    projectPerformance: [
      { projectId: 'project:order-service', name: 'order-service', repo: 'team/order-service', score: 0.91, successRate: 0.89, invocationCount: 28 },
    ],
    versions: [
      {
        version: '2.1.0',
        sourceHash: 're21std10f2ab91e913',
        qualityTier: 'standard',
        active: true,
        qualityScore: 0.89,
        confidence: 0.85,
        promptStyle: 'service-implementation',
        releaseDate: '2026-04-02T10:00:00+08:00',
      },
    ],
    aggregates: [
      {
        aggregateKey: 'agg:skill:backend/rest-api-implementation:project:order-service:30d',
        scopeType: 'project',
        scopeId: 'project:order-service',
        window: '30d',
        qualityScore: 0.9,
        selectionRate: 0.8,
        invocationRate: 0.76,
        successRate: 0.88,
        verificationPassRate: 0.91,
        userSatisfaction: 0.88,
        confidence: 0.84,
        sampleCount: 21,
        projectId: 'project:order-service',
      },
    ],
  },
  {
    skillId: 'backend/auth-authorization-backend',
    displayName: 'Auth & Authorization Backend',
    domain: 'backend',
    description: 'Builds authentication, authorization, RBAC, and multi-tenant backend boundaries.',
    aliases: ['鉴权后端开发', 'RBAC后端', '认证授权后端'],
    concepts: [
      { conceptId: 'concept:authz', name: 'authorization', kind: 'capability', weight: 0.97 },
      { conceptId: 'concept:rbac', name: 'rbac', kind: 'capability', weight: 0.95 },
      { conceptId: 'concept:multitenancy', name: 'multi-tenancy', kind: 'capability', weight: 0.72 },
    ],
    scenes: [
      { sceneId: 'scene:api-service', name: 'api service', weight: 0.88 },
      { sceneId: 'scene:account-system', name: 'account system', weight: 0.79 },
    ],
    departmentPreferences: [
      { departmentId: 'dept:backend-platform', name: 'backend-platform', score: 0.86, confidence: 0.8, sampleCount: 25 },
      { departmentId: 'dept:security-platform', name: 'security-platform', score: 0.84, confidence: 0.77, sampleCount: 18 },
    ],
    scenePerformance: [
      { sceneId: 'scene:api-service', name: 'api service', score: 0.86, confidence: 0.79, sampleCount: 22 },
    ],
    projectPerformance: [
      { projectId: 'project:order-service', name: 'order-service', repo: 'team/order-service', score: 0.87, successRate: 0.84, invocationCount: 14 },
    ],
    versions: [
      {
        version: '1.3.0',
        sourceHash: 'au13std77efca11bb45',
        qualityTier: 'standard',
        active: true,
        qualityScore: 0.87,
        confidence: 0.8,
        promptStyle: 'security-aware-service',
        releaseDate: '2026-03-29T10:00:00+08:00',
      },
    ],
    aggregates: [
      {
        aggregateKey: 'agg:skill:backend/auth-authorization-backend:department:backend-platform:30d',
        scopeType: 'department',
        scopeId: 'dept:backend-platform',
        window: '30d',
        qualityScore: 0.86,
        selectionRate: 0.63,
        invocationRate: 0.58,
        successRate: 0.84,
        verificationPassRate: 0.88,
        userSatisfaction: 0.86,
        confidence: 0.79,
        sampleCount: 17,
        departmentId: 'dept:backend-platform',
      },
    ],
  },
  {
    skillId: 'review/code-review-risk-based',
    displayName: 'Risk-Based Code Review',
    domain: 'review',
    description: 'Reviews high-risk changes with focus on auth, migrations, concurrency, and operational blast radius.',
    aliases: ['高风险代码评审', '风险型代码review'],
    concepts: [
      { conceptId: 'concept:high-risk-review', name: 'high risk review', kind: 'capability', weight: 0.96 },
      { conceptId: 'concept:migration-risk', name: 'migration risk', kind: 'capability', weight: 0.75 },
    ],
    scenes: [
      { sceneId: 'scene:code-review', name: 'code review', weight: 0.97 },
      { sceneId: 'scene:security-audit', name: 'security audit', weight: 0.64 },
    ],
    departmentPreferences: [
      { departmentId: 'dept:backend-platform', name: 'backend-platform', score: 0.82, confidence: 0.77, sampleCount: 16 },
      { departmentId: 'dept:security-platform', name: 'security-platform', score: 0.88, confidence: 0.8, sampleCount: 19 },
    ],
    scenePerformance: [
      { sceneId: 'scene:code-review', name: 'code review', score: 0.84, confidence: 0.74, sampleCount: 13 },
    ],
    projectPerformance: [
      { projectId: 'project:payments-platform', name: 'payments-platform', repo: 'team/payments-platform', score: 0.86, successRate: 0.82, invocationCount: 11 },
    ],
    versions: [
      {
        version: '1.1.0',
        sourceHash: 'rv11std0cded9a77f91',
        qualityTier: 'standard',
        active: true,
        qualityScore: 0.84,
        confidence: 0.76,
        promptStyle: 'review-first',
        releaseDate: '2026-03-22T10:00:00+08:00',
      },
    ],
    aggregates: [
      {
        aggregateKey: 'agg:skill:review/code-review-risk-based:department:security-platform:30d',
        scopeType: 'department',
        scopeId: 'dept:security-platform',
        window: '30d',
        qualityScore: 0.87,
        selectionRate: 0.69,
        invocationRate: 0.61,
        successRate: 0.84,
        verificationPassRate: 0.86,
        userSatisfaction: 0.85,
        confidence: 0.77,
        sampleCount: 18,
        departmentId: 'dept:security-platform',
      },
    ],
  },
  {
    skillId: 'security/security-vulnerability-check',
    displayName: 'Security Vulnerability Check',
    domain: 'security',
    description: 'Finds vulnerability patterns across auth, dependency, and input-validation flows with exploit-minded review.',
    aliases: ['安全漏洞检查', '漏洞扫描分析'],
    concepts: [
      { conceptId: 'concept:vulnerability-audit', name: 'vulnerability audit', kind: 'capability', weight: 0.98 },
      { conceptId: 'concept:dependency-risk', name: 'dependency risk', kind: 'capability', weight: 0.83 },
      { conceptId: 'concept:secure-coding', name: 'secure coding', kind: 'capability', weight: 0.8 },
    ],
    scenes: [
      { sceneId: 'scene:security-audit', name: 'security audit', weight: 0.99 },
    ],
    departmentPreferences: [
      { departmentId: 'dept:security-platform', name: 'security-platform', score: 0.95, confidence: 0.89, sampleCount: 33 },
    ],
    scenePerformance: [
      { sceneId: 'scene:security-audit', name: 'security audit', score: 0.94, confidence: 0.88, sampleCount: 29 },
    ],
    projectPerformance: [
      { projectId: 'project:payments-platform', name: 'payments-platform', repo: 'team/payments-platform', score: 0.93, successRate: 0.92, invocationCount: 19 },
    ],
    versions: [
      {
        version: '2.0.0',
        sourceHash: 'sv20stdf101bc7de451',
        qualityTier: 'standard',
        active: true,
        qualityScore: 0.94,
        confidence: 0.89,
        promptStyle: 'security-audit',
        releaseDate: '2026-04-04T10:00:00+08:00',
      },
    ],
    aggregates: [
      {
        aggregateKey: 'agg:skill:security/security-vulnerability-check:department:security-platform:30d',
        scopeType: 'department',
        scopeId: 'dept:security-platform',
        window: '30d',
        qualityScore: 0.94,
        selectionRate: 0.86,
        invocationRate: 0.82,
        successRate: 0.92,
        verificationPassRate: 0.95,
        userSatisfaction: 0.93,
        confidence: 0.88,
        sampleCount: 26,
        departmentId: 'dept:security-platform',
      },
    ],
  },
  {
    skillId: 'infra/load-testing',
    displayName: 'Load Testing',
    domain: 'infra',
    description: 'Plans and executes load tests, capacity checks, and throughput analysis for backend services.',
    aliases: ['负载测试', '压测'],
    concepts: [
      { conceptId: 'concept:load-testing', name: 'load testing', kind: 'capability', weight: 0.98 },
      { conceptId: 'concept:capacity-planning', name: 'capacity planning', kind: 'capability', weight: 0.79 },
      { conceptId: 'concept:performance-bottleneck', name: 'performance bottleneck', kind: 'capability', weight: 0.76 },
    ],
    scenes: [
      { sceneId: 'scene:performance-test', name: 'performance test', weight: 0.99 },
    ],
    departmentPreferences: [
      { departmentId: 'dept:backend-platform', name: 'backend-platform', score: 0.79, confidence: 0.73, sampleCount: 16 },
      { departmentId: 'dept:infra-platform', name: 'infra-platform', score: 0.86, confidence: 0.81, sampleCount: 14 },
    ],
    scenePerformance: [
      { sceneId: 'scene:performance-test', name: 'performance test', score: 0.85, confidence: 0.8, sampleCount: 21 },
    ],
    projectPerformance: [
      { projectId: 'project:order-service', name: 'order-service', repo: 'team/order-service', score: 0.84, successRate: 0.82, invocationCount: 12 },
    ],
    versions: [
      {
        version: '1.5.0',
        sourceHash: 'lt15std2201afcd3307',
        qualityTier: 'standard',
        active: true,
        qualityScore: 0.86,
        confidence: 0.81,
        promptStyle: 'performance-check',
        releaseDate: '2026-03-27T10:00:00+08:00',
      },
    ],
    aggregates: [
      {
        aggregateKey: 'agg:skill:infra/load-testing:scene:performance-test:30d',
        scopeType: 'scene',
        scopeId: 'scene:performance-test',
        window: '30d',
        qualityScore: 0.85,
        selectionRate: 0.67,
        invocationRate: 0.63,
        successRate: 0.83,
        verificationPassRate: 0.86,
        userSatisfaction: 0.84,
        confidence: 0.79,
        sampleCount: 18,
        sceneId: 'scene:performance-test',
      },
    ],
  },
  {
    skillId: 'backend/backend-performance-profiling',
    displayName: 'Backend Performance Profiling',
    domain: 'backend',
    description: 'Profiles slow endpoints and query hotspots to localize bottlenecks after load testing.',
    aliases: ['后端性能剖析', '慢接口定位'],
    concepts: [
      { conceptId: 'concept:performance-profiling', name: 'performance profiling', kind: 'capability', weight: 0.98 },
      { conceptId: 'concept:performance-bottleneck', name: 'performance bottleneck', kind: 'capability', weight: 0.9 },
      { conceptId: 'concept:query-hotspot', name: 'query hotspot', kind: 'artifact', weight: 0.72 },
    ],
    scenes: [
      { sceneId: 'scene:performance-test', name: 'performance test', weight: 0.91 },
    ],
    departmentPreferences: [
      { departmentId: 'dept:backend-platform', name: 'backend-platform', score: 0.84, confidence: 0.8, sampleCount: 19 },
    ],
    scenePerformance: [
      { sceneId: 'scene:performance-test', name: 'performance test', score: 0.88, confidence: 0.81, sampleCount: 17 },
    ],
    projectPerformance: [
      { projectId: 'project:order-service', name: 'order-service', repo: 'team/order-service', score: 0.86, successRate: 0.84, invocationCount: 14 },
    ],
    versions: [
      {
        version: '1.2.0',
        sourceHash: 'bp12std7719fcee1082',
        qualityTier: 'standard',
        active: true,
        qualityScore: 0.88,
        confidence: 0.81,
        promptStyle: 'profiling-diagnostic',
        releaseDate: '2026-03-31T10:00:00+08:00',
      },
    ],
    aggregates: [
      {
        aggregateKey: 'agg:skill:backend/backend-performance-profiling:project:order-service:30d',
        scopeType: 'project',
        scopeId: 'project:order-service',
        window: '30d',
        qualityScore: 0.87,
        selectionRate: 0.58,
        invocationRate: 0.55,
        successRate: 0.85,
        verificationPassRate: 0.87,
        userSatisfaction: 0.86,
        confidence: 0.8,
        sampleCount: 15,
        projectId: 'project:order-service',
      },
    ],
  },
]

const relatedSkillEdges: RelatedSkillEdge[] = [
  {
    fromSkillId: 'frontend/admin-dashboard-design',
    toSkillId: 'frontend/analytics-dashboard-design',
    weight: 0.89,
    reason: 'co-recommended-on-dashboard-work',
  },
  {
    fromSkillId: 'frontend/analytics-dashboard-design',
    toSkillId: 'frontend/admin-dashboard-design',
    weight: 0.82,
    reason: 'upsell-admin-work-to-data-view',
  },
  {
    fromSkillId: 'backend/rest-api-implementation',
    toSkillId: 'backend/auth-authorization-backend',
    weight: 0.87,
    reason: 'api-work-often-needs-authz',
  },
  {
    fromSkillId: 'backend/auth-authorization-backend',
    toSkillId: 'review/code-review-risk-based',
    weight: 0.75,
    reason: 'authz-changes-need-risk-review',
  },
  {
    fromSkillId: 'security/security-vulnerability-check',
    toSkillId: 'review/code-review-risk-based',
    weight: 0.81,
    reason: 'security-review-and-risk-review-co-occur',
  },
  {
    fromSkillId: 'infra/load-testing',
    toSkillId: 'backend/backend-performance-profiling',
    weight: 0.93,
    reason: 'load-test-results-often-flow-into-profiling',
  },
  {
    fromSkillId: 'backend/backend-performance-profiling',
    toSkillId: 'infra/load-testing',
    weight: 0.78,
    reason: 'profiling-findings-feed-next-load-test',
  },
]

const tasks: TaskDef[] = [
  {
    taskId: 'task:ui-dashboard-001',
    title: '运营管理后台设计',
    query: '设计一个管理后台，偏数据分析风格，适合运营看板使用。',
    status: 'success',
    departmentId: 'dept:frontend-platform',
    departmentName: 'frontend-platform',
    projectId: 'project:ops-console',
    projectName: 'ops-console',
    repo: 'team/ops-console',
    sceneId: 'scene:admin-console',
    sceneName: 'admin console',
    requestedConcepts: [
      { conceptId: 'concept:admin-dashboard', name: 'admin dashboard', kind: 'capability', weight: 0.98 },
      { conceptId: 'concept:analytics-dashboard', name: 'analytics dashboard', kind: 'capability', weight: 0.85 },
      { conceptId: 'concept:data-visualization', name: 'data visualization', kind: 'capability', weight: 0.71 },
    ],
    selections: [
      {
        versionKey: makeVersionKey('frontend/admin-dashboard-design', '2.2.0-pro', 'ad22pro9f1c2b6d8e001'),
        rank: 1,
        finalScore: 0.93,
        bm25Score: 0.88,
        vectorScore: 0.84,
        graphScore: 0.95,
        injected: true,
      },
      {
        versionKey: makeVersionKey('frontend/analytics-dashboard-design', '1.4.0-pro', 'an14proab3c2d9987721'),
        rank: 2,
        finalScore: 0.87,
        bm25Score: 0.74,
        vectorScore: 0.86,
        graphScore: 0.88,
        injected: true,
      },
    ],
    invocations: [
      {
        versionKey: makeVersionKey('frontend/admin-dashboard-design', '2.2.0-pro', 'ad22pro9f1c2b6d8e001'),
        sequence: 1,
      },
      {
        versionKey: makeVersionKey('frontend/analytics-dashboard-design', '1.4.0-pro', 'an14proab3c2d9987721'),
        sequence: 2,
      },
    ],
    successes: [
      {
        versionKey: makeVersionKey('frontend/admin-dashboard-design', '2.2.0-pro', 'ad22pro9f1c2b6d8e001'),
        verificationPassed: true,
        userRating: 5,
        durationMinutes: 42,
      },
    ],
    failures: [],
    createdAt: '2026-04-11T16:15:00+08:00',
  },
  {
    taskId: 'task:ui-dashboard-002',
    title: '管理后台快速原型',
    query: '先快速搭一个粗糙的管理后台原型，后面再补高级视觉。',
    status: 'partial-success',
    departmentId: 'dept:frontend-platform',
    departmentName: 'frontend-platform',
    projectId: 'project:ops-console',
    projectName: 'ops-console',
    repo: 'team/ops-console',
    sceneId: 'scene:admin-console',
    sceneName: 'admin console',
    requestedConcepts: [
      { conceptId: 'concept:admin-dashboard', name: 'admin dashboard', kind: 'capability', weight: 0.97 },
    ],
    selections: [
      {
        versionKey: makeVersionKey('frontend/admin-dashboard-design', '1.0.0-basic', 'ad10basic1c9dd0a0032'),
        rank: 1,
        finalScore: 0.74,
        bm25Score: 0.82,
        vectorScore: 0.69,
        graphScore: 0.41,
        injected: true,
      },
      {
        versionKey: makeVersionKey('frontend/admin-dashboard-design', '2.2.0-pro', 'ad22pro9f1c2b6d8e001'),
        rank: 2,
        finalScore: 0.71,
        bm25Score: 0.76,
        vectorScore: 0.68,
        graphScore: 0.59,
        injected: false,
      },
    ],
    invocations: [
      {
        versionKey: makeVersionKey('frontend/admin-dashboard-design', '1.0.0-basic', 'ad10basic1c9dd0a0032'),
        sequence: 1,
      },
      {
        versionKey: makeVersionKey('frontend/admin-dashboard-design', '2.2.0-pro', 'ad22pro9f1c2b6d8e001'),
        sequence: 2,
      },
    ],
    successes: [
      {
        versionKey: makeVersionKey('frontend/admin-dashboard-design', '2.2.0-pro', 'ad22pro9f1c2b6d8e001'),
        verificationPassed: true,
        userRating: 4,
        durationMinutes: 65,
      },
    ],
    failures: [
      {
        versionKey: makeVersionKey('frontend/admin-dashboard-design', '1.0.0-basic', 'ad10basic1c9dd0a0032'),
        reason: 'layout-too-generic-and-table-flow-missing',
      },
    ],
    createdAt: '2026-04-11T16:20:00+08:00',
  },
  {
    taskId: 'task:api-order-001',
    title: '订单服务 REST API 与 RBAC',
    query: '新增订单服务 REST API，并补 RBAC 鉴权与分页校验。',
    status: 'success',
    departmentId: 'dept:backend-platform',
    departmentName: 'backend-platform',
    projectId: 'project:order-service',
    projectName: 'order-service',
    repo: 'team/order-service',
    sceneId: 'scene:api-service',
    sceneName: 'api service',
    requestedConcepts: [
      { conceptId: 'concept:rest-api', name: 'rest api', kind: 'capability', weight: 0.98 },
      { conceptId: 'concept:rbac', name: 'rbac', kind: 'capability', weight: 0.86 },
      { conceptId: 'concept:authz', name: 'authorization', kind: 'capability', weight: 0.82 },
    ],
    selections: [
      {
        versionKey: makeVersionKey('backend/rest-api-implementation', '2.1.0', 're21std10f2ab91e913'),
        rank: 1,
        finalScore: 0.92,
        bm25Score: 0.9,
        vectorScore: 0.78,
        graphScore: 0.91,
        injected: true,
      },
      {
        versionKey: makeVersionKey('backend/auth-authorization-backend', '1.3.0', 'au13std77efca11bb45'),
        rank: 2,
        finalScore: 0.88,
        bm25Score: 0.73,
        vectorScore: 0.82,
        graphScore: 0.9,
        injected: true,
      },
      {
        versionKey: makeVersionKey('review/code-review-risk-based', '1.1.0', 'rv11std0cded9a77f91'),
        rank: 3,
        finalScore: 0.74,
        bm25Score: 0.62,
        vectorScore: 0.66,
        graphScore: 0.83,
        injected: false,
      },
    ],
    invocations: [
      {
        versionKey: makeVersionKey('backend/rest-api-implementation', '2.1.0', 're21std10f2ab91e913'),
        sequence: 1,
      },
      {
        versionKey: makeVersionKey('backend/auth-authorization-backend', '1.3.0', 'au13std77efca11bb45'),
        sequence: 2,
      },
    ],
    successes: [
      {
        versionKey: makeVersionKey('backend/rest-api-implementation', '2.1.0', 're21std10f2ab91e913'),
        verificationPassed: true,
        userRating: 5,
        durationMinutes: 53,
      },
      {
        versionKey: makeVersionKey('backend/auth-authorization-backend', '1.3.0', 'au13std77efca11bb45'),
        verificationPassed: true,
        userRating: 5,
        durationMinutes: 53,
      },
    ],
    failures: [],
    createdAt: '2026-04-11T16:25:00+08:00',
  },
  {
    taskId: 'task:security-001',
    title: '鉴权和依赖风险审查',
    query: '做一次鉴权和依赖风险审查，优先找高危漏洞。',
    status: 'success',
    departmentId: 'dept:security-platform',
    departmentName: 'security-platform',
    projectId: 'project:payments-platform',
    projectName: 'payments-platform',
    repo: 'team/payments-platform',
    sceneId: 'scene:security-audit',
    sceneName: 'security audit',
    requestedConcepts: [
      { conceptId: 'concept:vulnerability-audit', name: 'vulnerability audit', kind: 'capability', weight: 0.98 },
      { conceptId: 'concept:dependency-risk', name: 'dependency risk', kind: 'capability', weight: 0.81 },
      { conceptId: 'concept:authz', name: 'authorization', kind: 'capability', weight: 0.7 },
    ],
    selections: [
      {
        versionKey: makeVersionKey('security/security-vulnerability-check', '2.0.0', 'sv20stdf101bc7de451'),
        rank: 1,
        finalScore: 0.95,
        bm25Score: 0.89,
        vectorScore: 0.84,
        graphScore: 0.97,
        injected: true,
      },
      {
        versionKey: makeVersionKey('review/code-review-risk-based', '1.1.0', 'rv11std0cded9a77f91'),
        rank: 2,
        finalScore: 0.83,
        bm25Score: 0.66,
        vectorScore: 0.71,
        graphScore: 0.9,
        injected: true,
      },
    ],
    invocations: [
      {
        versionKey: makeVersionKey('security/security-vulnerability-check', '2.0.0', 'sv20stdf101bc7de451'),
        sequence: 1,
      },
      {
        versionKey: makeVersionKey('review/code-review-risk-based', '1.1.0', 'rv11std0cded9a77f91'),
        sequence: 2,
      },
    ],
    successes: [
      {
        versionKey: makeVersionKey('security/security-vulnerability-check', '2.0.0', 'sv20stdf101bc7de451'),
        verificationPassed: true,
        userRating: 5,
        durationMinutes: 39,
      },
    ],
    failures: [],
    createdAt: '2026-04-11T16:28:00+08:00',
  },
  {
    taskId: 'task:perf-001',
    title: '订单查询接口压测与瓶颈定位',
    query: '压测订单查询接口并定位瓶颈，最好能给出后续优化方向。',
    status: 'success',
    departmentId: 'dept:backend-platform',
    departmentName: 'backend-platform',
    projectId: 'project:order-service',
    projectName: 'order-service',
    repo: 'team/order-service',
    sceneId: 'scene:performance-test',
    sceneName: 'performance test',
    requestedConcepts: [
      { conceptId: 'concept:load-testing', name: 'load testing', kind: 'capability', weight: 0.95 },
      { conceptId: 'concept:performance-profiling', name: 'performance profiling', kind: 'capability', weight: 0.9 },
      { conceptId: 'concept:performance-bottleneck', name: 'performance bottleneck', kind: 'capability', weight: 0.85 },
    ],
    selections: [
      {
        versionKey: makeVersionKey('infra/load-testing', '1.5.0', 'lt15std2201afcd3307'),
        rank: 1,
        finalScore: 0.9,
        bm25Score: 0.87,
        vectorScore: 0.8,
        graphScore: 0.89,
        injected: true,
      },
      {
        versionKey: makeVersionKey('backend/backend-performance-profiling', '1.2.0', 'bp12std7719fcee1082'),
        rank: 2,
        finalScore: 0.88,
        bm25Score: 0.72,
        vectorScore: 0.86,
        graphScore: 0.9,
        injected: true,
      },
    ],
    invocations: [
      {
        versionKey: makeVersionKey('infra/load-testing', '1.5.0', 'lt15std2201afcd3307'),
        sequence: 1,
      },
      {
        versionKey: makeVersionKey('backend/backend-performance-profiling', '1.2.0', 'bp12std7719fcee1082'),
        sequence: 2,
      },
    ],
    successes: [
      {
        versionKey: makeVersionKey('infra/load-testing', '1.5.0', 'lt15std2201afcd3307'),
        verificationPassed: true,
        userRating: 4,
        durationMinutes: 47,
      },
      {
        versionKey: makeVersionKey('backend/backend-performance-profiling', '1.2.0', 'bp12std7719fcee1082'),
        verificationPassed: true,
        userRating: 4,
        durationMinutes: 47,
      },
    ],
    failures: [],
    createdAt: '2026-04-11T16:31:00+08:00',
  },
]

function buildStatements(): string[] {
  const statements: string[] = [
    'DROP CONSTRAINT skill_skill_id IF EXISTS;',
    'DROP CONSTRAINT scene_name IF EXISTS;',
    'DROP CONSTRAINT department_name IF EXISTS;',
    'DROP CONSTRAINT alias_name IF EXISTS;',
    'DROP CONSTRAINT skill_id_v1 IF EXISTS;',
    'DROP CONSTRAINT skill_version_key_v1 IF EXISTS;',
    'DROP CONSTRAINT concept_id_v1 IF EXISTS;',
    'DROP CONSTRAINT scene_id_v1 IF EXISTS;',
    'DROP CONSTRAINT department_id_v1 IF EXISTS;',
    'DROP CONSTRAINT project_id_v1 IF EXISTS;',
    'DROP CONSTRAINT task_id_v1 IF EXISTS;',
    'DROP CONSTRAINT feedback_aggregate_key_v1 IF EXISTS;',
    'DROP CONSTRAINT alias_name_v1 IF EXISTS;',
    'MATCH (n) DETACH DELETE n;',
    'CREATE CONSTRAINT skill_id_v1 IF NOT EXISTS FOR (s:Skill) REQUIRE s.skillId IS UNIQUE;',
    'CREATE CONSTRAINT skill_version_key_v1 IF NOT EXISTS FOR (sv:SkillVersion) REQUIRE sv.versionKey IS UNIQUE;',
    'CREATE CONSTRAINT concept_id_v1 IF NOT EXISTS FOR (c:Concept) REQUIRE c.conceptId IS UNIQUE;',
    'CREATE CONSTRAINT scene_id_v1 IF NOT EXISTS FOR (sc:Scene) REQUIRE sc.sceneId IS UNIQUE;',
    'CREATE CONSTRAINT department_id_v1 IF NOT EXISTS FOR (d:Department) REQUIRE d.departmentId IS UNIQUE;',
    'CREATE CONSTRAINT project_id_v1 IF NOT EXISTS FOR (p:Project) REQUIRE p.projectId IS UNIQUE;',
    'CREATE CONSTRAINT task_id_v1 IF NOT EXISTS FOR (t:Task) REQUIRE t.taskId IS UNIQUE;',
    'CREATE CONSTRAINT feedback_aggregate_key_v1 IF NOT EXISTS FOR (fa:FeedbackAggregate) REQUIRE fa.aggregateKey IS UNIQUE;',
    'CREATE CONSTRAINT alias_name_v1 IF NOT EXISTS FOR (a:Alias) REQUIRE a.name IS UNIQUE;',
  ]

  for (const skill of skills) {
    const activeVersion = skill.versions.find(version => version.active)

    statements.push(`
MERGE (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
SET s.displayName = ${cypherLiteral(skill.displayName)},
    s.displayNameZh = ${cypherLiteral(displayZh(skill.skillId, skillZhNames, skill.displayName))},
    s.domain = ${cypherLiteral(skill.domain)},
    s.description = ${cypherLiteral(skill.description)},
    s.descriptionZh = ${cypherLiteral(displayZh(skill.skillId, skillZhDescriptions, skill.description))},
    s.globalQualityScore = ${skill.aggregates.find(aggregate => aggregate.scopeType === 'global')?.qualityScore ?? 0},
    s.globalConfidence = ${skill.aggregates.find(aggregate => aggregate.scopeType === 'global')?.confidence ?? 0},
    s.activeVersionKey = ${cypherLiteral(activeVersion ? makeVersionKey(skill.skillId, activeVersion.version, activeVersion.sourceHash) : '')},
    s.updatedAt = datetime();
`)

    for (const alias of skill.aliases) {
      statements.push(`
MERGE (a:Alias {name: ${cypherLiteral(alias)}})
SET a.normalizedName = ${cypherLiteral(normalizeName(alias))},
    a.updatedAt = datetime()
WITH a
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (a)-[r:ALIASES_SKILL]->(s)
SET r.labelZh = '别名';
`)
    }

    for (const concept of skill.concepts) {
      statements.push(`
MERGE (c:Concept {conceptId: ${cypherLiteral(concept.conceptId)}})
SET c.name = ${cypherLiteral(concept.name)},
    c.nameZh = ${cypherLiteral(displayZh(concept.conceptId, conceptZhNames, concept.name))},
    c.kind = ${cypherLiteral(concept.kind)},
    c.updatedAt = datetime()
WITH c
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (s)-[r:MATCHES_CONCEPT]->(c)
SET r.weight = ${concept.weight},
    r.labelZh = '匹配概念',
    r.updatedAt = datetime();
`)
    }

    for (const scene of skill.scenes) {
      statements.push(`
MERGE (sc:Scene {sceneId: ${cypherLiteral(scene.sceneId)}})
SET sc.name = ${cypherLiteral(scene.name)},
    sc.nameZh = ${cypherLiteral(displayZh(scene.sceneId, sceneZhNames, scene.name))},
    sc.updatedAt = datetime()
WITH sc
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (s)-[r:APPLIES_TO_SCENE]->(sc)
SET r.weight = ${scene.weight},
    r.labelZh = '适用场景',
    r.updatedAt = datetime();
`)
    }

    for (const department of skill.departmentPreferences) {
      statements.push(`
MERGE (d:Department {departmentId: ${cypherLiteral(department.departmentId)}})
SET d.name = ${cypherLiteral(department.name)},
    d.nameZh = ${cypherLiteral(displayZh(department.departmentId, departmentZhNames, department.name))},
    d.updatedAt = datetime()
WITH d
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (d)-[r:PREFERS_SKILL]->(s)
SET r.score = ${department.score},
    r.confidence = ${department.confidence},
    r.sampleCount = ${department.sampleCount},
    r.labelZh = '偏好技能',
    r.updatedAt = datetime();
`)
    }

    for (const scenePerf of skill.scenePerformance) {
      statements.push(`
MERGE (sc:Scene {sceneId: ${cypherLiteral(scenePerf.sceneId)}})
SET sc.name = ${cypherLiteral(scenePerf.name)},
    sc.nameZh = ${cypherLiteral(displayZh(scenePerf.sceneId, sceneZhNames, scenePerf.name))},
    sc.updatedAt = datetime()
WITH sc
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (sc)-[r:SUCCESSFUL_WITH]->(s)
SET r.score = ${scenePerf.score},
    r.confidence = ${scenePerf.confidence},
    r.sampleCount = ${scenePerf.sampleCount},
    r.labelZh = '场景成功',
    r.updatedAt = datetime();
`)
    }

    for (const projectPerf of skill.projectPerformance) {
      statements.push(`
MERGE (p:Project {projectId: ${cypherLiteral(projectPerf.projectId)}})
SET p.name = ${cypherLiteral(projectPerf.name)},
    p.nameZh = ${cypherLiteral(displayZh(projectPerf.projectId, projectZhNames, projectPerf.name))},
    p.repo = ${cypherLiteral(projectPerf.repo)},
    p.updatedAt = datetime()
WITH p
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (p)-[r:SUCCEEDS_WITH]->(s)
SET r.score = ${projectPerf.score},
    r.successRate = ${projectPerf.successRate},
    r.invocationCount = ${projectPerf.invocationCount},
    r.labelZh = '项目成功',
    r.updatedAt = datetime();
`)
    }

    for (const version of skill.versions) {
      const versionKey = makeVersionKey(skill.skillId, version.version, version.sourceHash)
      statements.push(`
MERGE (sv:SkillVersion {versionKey: ${cypherLiteral(versionKey)}})
SET sv.skillId = ${cypherLiteral(skill.skillId)},
    sv.version = ${cypherLiteral(version.version)},
    sv.sourceHash = ${cypherLiteral(version.sourceHash)},
    sv.qualityTier = ${cypherLiteral(version.qualityTier)},
    sv.captionZh = ${cypherLiteral(`${qualityTierZh(version.qualityTier)} ${version.version}`)},
    sv.active = ${version.active ? 'true' : 'false'},
    sv.qualityScore = ${version.qualityScore},
    sv.confidence = ${version.confidence},
    sv.promptStyle = ${cypherLiteral(version.promptStyle)},
    sv.releaseDate = ${cypherDateTime(version.releaseDate)},
    sv.updatedAt = datetime()
WITH sv
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
MERGE (s)-[r:HAS_VERSION]->(sv)
SET r.labelZh = '拥有版本';
`)
    }

    const proVersion = skill.versions.find(version => version.qualityTier === 'pro')
    const basicVersion = skill.versions.find(version => version.qualityTier === 'basic')
    if (proVersion && basicVersion) {
      statements.push(`
MATCH (better:SkillVersion {versionKey: ${cypherLiteral(makeVersionKey(skill.skillId, proVersion.version, proVersion.sourceHash))}})
MATCH (baseline:SkillVersion {versionKey: ${cypherLiteral(makeVersionKey(skill.skillId, basicVersion.version, basicVersion.sourceHash))}})
MERGE (better)-[r:UPGRADES]->(baseline)
SET r.reason = 'higher-quality-variant',
    r.labelZh = '升级自',
    r.updatedAt = datetime();
`)
    }

    for (const aggregate of skill.aggregates) {
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
MATCH (s:Skill {skillId: ${cypherLiteral(skill.skillId)}})
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

      if (aggregate.departmentId) {
        statements.push(`
MATCH (d:Department {departmentId: ${cypherLiteral(aggregate.departmentId)}})
MATCH (fa:FeedbackAggregate {aggregateKey: ${cypherLiteral(aggregate.aggregateKey)}})
MERGE (fa)-[r:IN_DEPARTMENT]->(d)
SET r.labelZh = '部门范围';
`)
      }

      if (aggregate.sceneId) {
        statements.push(`
MATCH (sc:Scene {sceneId: ${cypherLiteral(aggregate.sceneId)}})
MATCH (fa:FeedbackAggregate {aggregateKey: ${cypherLiteral(aggregate.aggregateKey)}})
MERGE (fa)-[r:IN_SCENE]->(sc)
SET r.labelZh = '场景范围';
`)
      }

      if (aggregate.projectId) {
        statements.push(`
MATCH (p:Project {projectId: ${cypherLiteral(aggregate.projectId)}})
MATCH (fa:FeedbackAggregate {aggregateKey: ${cypherLiteral(aggregate.aggregateKey)}})
MERGE (fa)-[r:IN_PROJECT]->(p)
SET r.labelZh = '项目范围';
`)
      }
    }
  }

  for (const edge of relatedSkillEdges) {
    statements.push(`
MATCH (from:Skill {skillId: ${cypherLiteral(edge.fromSkillId)}})
MATCH (to:Skill {skillId: ${cypherLiteral(edge.toSkillId)}})
MERGE (from)-[r:RELATED_TO]->(to)
SET r.weight = ${edge.weight},
    r.reason = ${cypherLiteral(edge.reason)},
    r.labelZh = '相关技能',
    r.updatedAt = datetime();
`)
  }

  for (const task of tasks) {
    statements.push(`
MERGE (t:Task {taskId: ${cypherLiteral(task.taskId)}})
SET t.title = ${cypherLiteral(task.title)},
    t.titleZh = ${cypherLiteral(task.title)},
    t.query = ${cypherLiteral(task.query)},
    t.queryZh = ${cypherLiteral(task.query)},
    t.status = ${cypherLiteral(task.status)},
    t.source = 'mock_seed_v1',
    t.createdAt = ${cypherDateTime(task.createdAt)},
    t.updatedAt = datetime();
`)

    statements.push(`
MERGE (d:Department {departmentId: ${cypherLiteral(task.departmentId)}})
SET d.name = ${cypherLiteral(task.departmentName)},
    d.nameZh = ${cypherLiteral(displayZh(task.departmentId, departmentZhNames, task.departmentName))},
    d.updatedAt = datetime()
WITH d
MATCH (t:Task {taskId: ${cypherLiteral(task.taskId)}})
MERGE (t)-[r:BELONGS_TO_DEPARTMENT]->(d)
SET r.labelZh = '所属部门';
`)

    statements.push(`
MERGE (p:Project {projectId: ${cypherLiteral(task.projectId)}})
SET p.name = ${cypherLiteral(task.projectName)},
    p.nameZh = ${cypherLiteral(displayZh(task.projectId, projectZhNames, task.projectName))},
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
    sc.nameZh = ${cypherLiteral(displayZh(task.sceneId, sceneZhNames, task.sceneName))},
    sc.updatedAt = datetime()
WITH sc
MATCH (t:Task {taskId: ${cypherLiteral(task.taskId)}})
MERGE (t)-[r:PRIMARY_SCENE]->(sc)
SET r.labelZh = '主场景';
`)

    for (const concept of task.requestedConcepts) {
      statements.push(`
MERGE (c:Concept {conceptId: ${cypherLiteral(concept.conceptId)}})
SET c.name = ${cypherLiteral(concept.name)},
    c.nameZh = ${cypherLiteral(displayZh(concept.conceptId, conceptZhNames, concept.name))},
    c.kind = ${cypherLiteral(concept.kind)},
    c.updatedAt = datetime()
WITH c
MATCH (t:Task {taskId: ${cypherLiteral(task.taskId)}})
MERGE (t)-[r:REQUESTS_CONCEPT]->(c)
SET r.weight = ${concept.weight},
    r.labelZh = '需求概念',
    r.updatedAt = datetime();
`)
    }

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

  return statements
}

async function main(): Promise<void> {
  await runCypher(buildStatements().join('\n'))
  console.log(
    `Seeded Neo4j skill graph schema v1 with ${skills.length} skills, ${tasks.length} tasks, and feedback aggregates`,
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
