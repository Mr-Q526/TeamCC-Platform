import { createHash } from 'crypto'
import { readFile, readdir, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import YAML from 'yaml'

type SkillFrontmatter = Record<string, unknown> & {
  skillId?: string
  name?: string
  displayName?: string
  description?: string
  aliases?: string[]
  version?: string
  sourceHash?: string
  domain?: string
  departmentTags?: string[]
  sceneTags?: string[]
}

const SKILLS_DIR = 'skills-flat'
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)---\s*\n?/

const FIELD_ORDER = [
  'schemaVersion',
  'skillId',
  'name',
  'displayName',
  'description',
  'aliases',
  'version',
  'sourceHash',
  'domain',
  'departmentTags',
  'sceneTags',
]

const WORD_ALIASES: Record<string, string[]> = {
  about: ['关于我们', '公司介绍', '品牌介绍'],
  account: ['账户', '账号', '个人中心'],
  admin: ['管理后台', '后台管理', '管理台', 'admin panel'],
  ai: ['AI', '人工智能', '智能助手'],
  analytics: ['数据分析', '分析看板', 'BI', '指标看板'],
  api: ['API', '接口', '服务接口'],
  architecture: ['架构', '架构设计', '模块边界'],
  auth: ['认证', '鉴权', '授权', '登录态'],
  authorization: ['授权', '权限', 'RBAC', 'ABAC'],
  backend: ['后端', '服务端', 'server side'],
  background: ['后台任务', '异步任务', '后台作业'],
  backfill: ['数据回填', '补数据', 'backfill'],
  basic: ['基础版', 'basic'],
  bug: ['bug', '缺陷', '故障', '问题修复'],
  builder: ['构建器', '生成器', 'builder'],
  cache: ['缓存', 'Redis', '缓存失效', 'cache invalidation'],
  careers: ['招聘', '加入我们', '职位页面'],
  chain: ['供应链', '链路'],
  checkout: ['结账', '支付流程', '下单流程'],
  ci: ['CI', '持续集成', '质量门禁'],
  code: ['代码', 'coding', '代码实现'],
  company: ['公司', '企业', '品牌'],
  component: ['组件', '组件库', 'UI 组件'],
  contact: ['联系', '联系销售', 'contact sales'],
  course: ['课程', '教学', '课程页'],
  dashboard: ['仪表盘', '看板', '控制台', 'dashboard'],
  data: ['数据', 'data'],
  database: ['数据库', '数据表', 'DB'],
  debug: ['调试', '排查', '定位问题'],
  debugging: ['调试', 'bug 排查', '故障定位'],
  dependency: ['依赖', '依赖安全', 'dependency'],
  deploy: ['部署', '发布', '上线'],
  design: ['设计', 'UI', '视觉设计'],
  developer: ['开发者', '开发者门户', 'developer portal'],
  doc: ['文档', '方案文档', '技术文档'],
  docs: ['文档站', '文档网站', 'documentation'],
  ecommerce: ['电商', '商城', '购物'],
  education: ['教育', '课程', '学习'],
  empty: ['空状态', 'empty state'],
  enterprise: ['企业', '企业级', 'B2B'],
  error: ['错误状态', '异常状态', '报错页'],
  fix: ['修复', '修 bug', '问题修复'],
  fintech: ['金融科技', '金融', 'fintech'],
  form: ['表单', '表单构建', 'form'],
  frontend: ['前端', 'Web 前端', '页面开发'],
  general: ['通用', 'general'],
  graphql: ['GraphQL', 'resolver', 'schema', 'mutation'],
  gates: ['门禁', '质量门禁', 'required checks'],
  healthcare: ['医疗', '健康', 'healthcare'],
  homepage: ['首页', '官网首页', '主页'],
  jobs: ['任务队列', '定时任务', 'job', 'scheduled job'],
  library: ['库', '组件库', 'library'],
  limiting: ['限流', 'rate limiting', '配额'],
  load: ['负载测试', 'load test', '压测'],
  marketing: ['营销', '落地页', '转化页', 'campaign page'],
  migration: ['迁移', '数据迁移', 'migration'],
  model: ['模型', '建模'],
  navigation: ['导航', '响应式导航', 'navbar'],
  notification: ['通知', '消息中心', 'notification'],
  observability: ['可观测性', '日志', '指标', '链路追踪', '告警'],
  onboarding: ['新手引导', '入门流程', 'onboarding'],
  page: ['页面', 'page'],
  performance: ['性能', '性能优化', '性能分析'],
  plan: ['计划', '开发计划', '实施计划'],
  pricing: ['定价', '价格页', 'pricing'],
  pro: ['专业版', 'pro'],
  profile: ['个人资料', '用户资料', 'profile'],
  quality: ['质量', '质量检查', 'quality gate'],
  queues: ['队列', 'worker', '重试', '幂等', '死信队列', 'dead-letter queue'],
  rate: ['限流', '速率限制', 'rate limit'],
  rest: ['REST', 'REST API', '资源接口'],
  responsive: ['响应式', '移动端适配', 'responsive'],
  review: ['代码审查', 'code review', '评审'],
  risk: ['风险', '风险审查', 'risk-based'],
  sales: ['销售', '联系销售', '销售线索'],
  saas: ['SaaS', '工作台', 'B2B 产品'],
  schema: ['表结构', 'schema', '数据建模', '索引'],
  screenshot: ['截图', '截屏', 'screenshot'],
  search: ['搜索', '搜索结果', 'search results'],
  security: ['安全', '安全审计', 'security'],
  settings: ['设置', '配置页', 'settings'],
  spreadsheet: ['表格', 'Excel', '电子表格'],
  states: ['状态', 'UI 状态'],
  storefront: ['店铺首页', '商城首页', '商品页', 'storefront'],
  strategy: ['策略', '方案'],
  stress: ['压力测试', '压测', 'stress test'],
  supply: ['供应链', '软件供应链'],
  system: ['系统', '设计系统'],
  table: ['表格', '数据表格', 'data table'],
  test: ['测试', '验证', 'test'],
  testing: ['测试', '测试策略', 'testing'],
  threat: ['威胁建模', '威胁分析', 'threat model'],
  unit: ['单元测试', 'unit test'],
  vercel: ['Vercel', '部署', '预览环境'],
  vulnerability: ['漏洞', '漏洞检查', '安全漏洞'],
  website: ['官网', '企业官网', 'website'],
  wechat: ['微信', '公众号', '微信运营'],
  xiaohongshu: ['小红书', '种草', '内容运营'],
}

const EXACT_ALIASES: Record<string, string[]> = {
  'background-jobs-queues': [
    '后台任务队列',
    '异步队列',
    '任务重试',
    '幂等任务',
    '死信队列',
  ],
  'bug-fix-debugging': [
    '修复 bug',
    '修 bug',
    'bug 修复',
    '问题排查',
    '故障定位',
    '回归测试',
  ],
  'development-plan-doc': [
    '开发计划文档',
    '技术方案',
    '实施方案',
    '任务拆解',
    '开发路线图',
    'coding plan',
  ],
  'marketing-landing-page': ['营销落地页', '转化页', '预约 demo', '获客页'],
  'website-homepage-design': ['官网首页', '品牌首页', '企业官网', '产品官网'],
  'rest-api-implementation': ['REST 接口', 'controller', '参数校验', '分页接口'],
  'auth-authorization-backend': ['后端鉴权', '接口授权', '租户边界', '权限检查'],
  'cache-strategy-backend': ['Redis 缓存', '缓存击穿', '缓存雪崩', '缓存失效'],
  'database-schema-design': ['数据库设计', '表结构设计', '索引设计', '迁移方案'],
  'graphql-api-implementation': ['GraphQL API', 'resolver', 'dataloader', 'N+1 查询'],
}

function uniqueStable(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }

  return result
}

function wordsFrom(value: string): string[] {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9\u4e00-\u9fff]+/g)
    .map(word => word.trim())
    .filter(Boolean)
}

function generateAliases(frontmatter: SkillFrontmatter, dirName: string): string[] {
  const name = String(frontmatter.name || dirName)
  const displayName = String(frontmatter.displayName || name)
  const domain = String(frontmatter.domain || 'general')
  const sceneTags = Array.isArray(frontmatter.sceneTags)
    ? frontmatter.sceneTags.map(String)
    : []
  const departmentTags = Array.isArray(frontmatter.departmentTags)
    ? frontmatter.departmentTags.map(String)
    : []

  const seeds = [
    name,
    displayName,
    name.replace(/-/g, ' '),
    ...wordsFrom(name),
    ...wordsFrom(displayName),
    domain,
    ...sceneTags,
    ...departmentTags,
  ]

  const aliases = [
    ...(Array.isArray(frontmatter.aliases) ? frontmatter.aliases.map(String) : []),
    ...(EXACT_ALIASES[name] ?? []),
  ]

  for (const seed of seeds) {
    aliases.push(seed)
    const normalized = seed.toLowerCase()
    for (const part of normalized.split(/[^a-z0-9]+/g).filter(Boolean)) {
      aliases.push(...(WORD_ALIASES[part] ?? []))
    }
    aliases.push(...(WORD_ALIASES[normalized] ?? []))
  }

  return uniqueStable(aliases).slice(0, 28)
}

function reorderFrontmatter(frontmatter: SkillFrontmatter): SkillFrontmatter {
  const ordered: SkillFrontmatter = {}

  for (const key of FIELD_ORDER) {
    if (frontmatter[key] !== undefined) {
      ordered[key] = frontmatter[key]
    }
  }

  for (const [key, value] of Object.entries(frontmatter)) {
    if (!FIELD_ORDER.includes(key)) {
      ordered[key] = value
    }
  }

  return ordered
}

function stringifyFrontmatter(frontmatter: SkillFrontmatter): string {
  return YAML.stringify(frontmatter, {
    lineWidth: 0,
    singleQuote: true,
  }).trimEnd()
}

function computeSourceHash(frontmatter: SkillFrontmatter, body: string): string {
  const hashFrontmatter = { ...frontmatter }
  delete hashFrontmatter.sourceHash
  const normalized = `---\n${stringifyFrontmatter(hashFrontmatter)}\n---\n${body}`
  return `sha256:${createHash('sha256').update(normalized, 'utf8').digest('hex')}`
}

async function loadSkillFile(filePath: string): Promise<{
  frontmatter: SkillFrontmatter
  body: string
}> {
  const raw = await readFile(filePath, 'utf-8')
  const match = raw.match(FRONTMATTER_REGEX)
  if (!match) {
    throw new Error(`Missing frontmatter: ${filePath}`)
  }

  return {
    frontmatter: (YAML.parse(match[1] ?? '') ?? {}) as SkillFrontmatter,
    body: raw.slice(match[0].length).replace(/^\n+/, ''),
  }
}

async function main(): Promise<void> {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true })
  const manifestSkills = []

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue

    const dirName = entry.name
    const filePath = join(SKILLS_DIR, dirName, 'SKILL.md')
    const { frontmatter, body } = await loadSkillFile(filePath)
    frontmatter.aliases = generateAliases(frontmatter, dirName)
    const ordered = reorderFrontmatter(frontmatter)
    ordered.sourceHash = computeSourceHash(ordered, body)

    await writeFile(
      filePath,
      `---\n${stringifyFrontmatter(ordered)}\n---\n\n${body}`,
      'utf-8',
    )

    manifestSkills.push({
      skillId: String(ordered.skillId),
      targetDir: join(SKILLS_DIR, dirName),
      displayName: String(ordered.displayName),
      version: String(ordered.version),
      sourceHash: String(ordered.sourceHash),
      domain: String(ordered.domain),
      departmentTags: Array.isArray(ordered.departmentTags)
        ? ordered.departmentTags
        : [],
      sceneTags: Array.isArray(ordered.sceneTags) ? ordered.sceneTags : [],
      aliases: Array.isArray(ordered.aliases) ? ordered.aliases : [],
    })
  }

  manifestSkills.sort((left, right) => left.skillId.localeCompare(right.skillId))

  await writeFile(
    join(SKILLS_DIR, 'pilot-manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: '2026-04-11',
        pilotCount: manifestSkills.length,
        skills: manifestSkills,
      },
      null,
      2,
    )}\n`,
    'utf-8',
  )

  console.log(
    `Updated aliases and sourceHash for ${manifestSkills.length} skills in ${basename(SKILLS_DIR)}`,
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
