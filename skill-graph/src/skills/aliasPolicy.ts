export type SkillAliasInput = {
  name: string
  displayName: string
  domain: string
  aliases: string[]
  departmentTags: string[]
  sceneTags: string[]
}

export type SkillAliasAuditIssue = {
  alias: string
  reason: 'generic_exact' | 'metadata_tag' | 'platform_tag' | 'too_short'
}

export const GENERIC_ALIAS_DENYLIST = new Set(
  [
    'ai',
    'api',
    'architecture',
    'backend',
    'basic',
    'code',
    'coding',
    'data',
    'db',
    'deploy',
    'deployment',
    'design',
    'doc',
    'docs',
    'frontend',
    'general',
    'infra',
    'library',
    'model',
    'page',
    'pro',
    'release',
    'review',
    'security',
    'system',
    'test',
    'testing',
    'ui',
    'web',
    '上线',
    '人工智能',
    '代码',
    '发布',
    '后端',
    '基础版',
    '安全',
    '安全审计',
    '审核',
    '建模',
    '开发',
    '接口',
    '数据库',
    '文档',
    '架构',
    '架构设计',
    '模块边界',
    '测试',
    '登录态',
    '页面',
    '页面开发',
    '问题修复',
    '部署',
    '通用',
    '配置',
    '鉴权',
    '授权',
    '专业版',
    '前端',
    '设计',
    '视觉设计',
    '数据',
    '模型',
    '系统',
    '质量',
    '风险',
    '策略',
    '方案',
    '企业',
    '公司',
    '状态',
    '问题',
    '修复',
    '分析',
    '功能',
    '工具',
    '平台',
    '应用',
    'web 前端',
  ].map(value => value.toLowerCase()),
)

const METADATA_TAG_DENYLIST = new Set(
  [
    'ai-platform',
    'backend-platform',
    'content-ops',
    'design-platform',
    'frontend-platform',
    'infra-platform',
    'reviewer',
    'security-platform',
  ].map(value => value.toLowerCase()),
)

const EXACT_ALIASES: Record<string, string[]> = {
  'about-company-page': ['关于我们页面', '公司介绍页面', '关于公司的页面', '公司页面', '品牌故事页', '团队使命页面', '企业介绍页'],
  'admin-dashboard-design': ['管理后台设计', '管理控制台', '后台仪表盘', 'admin dashboard', '管理台首页'],
  'analytics-dashboard-design': ['数据看板设计', '分析看板', 'BI 看板', 'analytics dashboard'],
  'auth-authorization-backend': ['后端鉴权', '接口授权', '租户边界', '权限检查'],
  'auth-login-page': ['登录页面', '登录页', 'login page', '登录错误恢复'],
  'background-jobs-queues': ['后台任务队列', '异步队列', '任务重试', '幂等任务', '死信队列'],
  'bug-fix-debugging': ['修复 bug', '修 bug', 'bug 修复', '问题排查', '故障定位', '回归测试'],
  'cache-strategy-backend': ['Redis 缓存策略', '缓存击穿', '缓存雪崩', '缓存失效策略'],
  'careers-page': ['招聘页面', '职业页面', '职业页', '职位页面', 'careers page', '候选人转化页'],
  'checkout-flow': ['结账流程', '支付流程', 'checkout flow', '订单确认页'],
  'component-library': ['组件库设计', 'component library', '组件变体', 'UI 组件规范'],
  'contact-sales-page': ['联系销售页面', 'contact sales page', '销售线索表单', '预约销售页'],
  'data-table': ['数据表格', 'data table', '表格交互', '行内操作'],
  'database-schema-design': ['数据库设计', '表结构设计', '索引设计', '数据建模方案'],
  'developer-portal': ['开发者门户', 'developer portal', 'API 文档门户', 'SDK 文档入口'],
  'development-plan-doc': ['开发计划文档', '技术方案', '实施方案', '任务拆解', '开发路线图', 'coding plan'],
  'docs-site': ['文档站', '文档网站', 'documentation site', '开发文档站'],
  'ecommerce-storefront-design': ['电商首页', '商城首页', '商品列表页', 'storefront design'],
  'education-course-page': ['课程页面', '课程页', 'course page', '学习进度页'],
  'enterprise-security-page': ['企业安全页面', '信任中心页面', 'trust center', '合规说明页'],
  'error-empty-states': ['空状态设计', '错误状态设计', 'empty state', 'error state', '404 页面'],
  'form-builder': ['表单构建器', '表单设计', 'form builder', '动态表单'],
  'graphql-api-implementation': ['GraphQL API', 'resolver', 'dataloader', 'N+1 查询'],
  'marketing-landing-page': ['营销落地页', '转化页', '预约 demo 页面', '获客页', 'campaign page', 'lead generation page'],
  'onboarding-flow': ['新手引导', '入门流程', 'onboarding flow', '首次使用流程'],
  'pricing-page': ['定价页', '定价页面', 'pricing page', '套餐对比页'],
  'profile-account-page': ['个人资料页面', '账户页面', 'profile page', 'account page'],
  'rate-limiting-abuse-protection': ['限流防滥用', '访问频率限制', 'rate limiting', 'abuse protection', '配额保护'],
  'responsive-navigation': ['响应式导航', '导航栏', 'responsive navigation', 'navbar', '移动端导航'],
  'rest-api-implementation': ['REST 接口', 'REST API', 'controller', '参数校验', '分页接口'],
  'search-results-page': ['搜索结果页面', '搜索结果页', 'search results page', '筛选结果页'],
  'security-ownership-map': ['安全所有权', '安全负责人映射', '文件归属', 'ownership map', '代码归属安全'],
  'security-threat-model': ['威胁建模', '威胁分析', 'threat model', '攻击面分析', '攻击路径梳理'],
  'settings-page': ['设置页面', '设置页', '配置页', 'settings page', 'preferences page'],
  'supply-chain-security': ['供应链安全', '依赖安全', '软件供应链', 'dependency security'],
  'vercel-deploy': ['Vercel 部署', 'Vercel 上线', '预览环境', 'preview deployment', '前端部署'],
  'website-homepage-design': ['官网首页', '品牌首页', '企业官网首页', '产品官网首页', 'homepage design'],
  'wechat-toolkit': ['公众号工具', '微信公众号', '微信运营', '公众号改写', '公众号发布'],
}

const WORD_ALIASES: Record<string, string[]> = {
  about: ['关于我们页面', '公司介绍页面'],
  account: ['账户页面', '个人中心页面'],
  admin: ['管理后台设计', 'admin dashboard'],
  analytics: ['数据看板设计', 'analytics dashboard'],
  auth: ['登录页面', '后端鉴权'],
  authorization: ['接口授权', '权限检查'],
  background: ['后台任务队列'],
  backfill: ['数据回填', 'backfill job'],
  bug: ['bug 修复', '问题排查'],
  cache: ['Redis 缓存策略', '缓存失效策略'],
  careers: ['招聘页面', 'careers page'],
  checkout: ['结账流程', 'checkout flow'],
  component: ['组件库设计', 'component library'],
  contact: ['联系销售页面', 'contact sales page'],
  dashboard: ['仪表盘设计', 'dashboard design'],
  database: ['表结构设计', '索引设计'],
  debugging: ['故障定位', 'bug 排查'],
  dependency: ['依赖安全', 'dependency security'],
  developer: ['开发者门户', 'developer portal'],
  docs: ['文档站', 'documentation site'],
  ecommerce: ['电商首页', 'storefront design'],
  education: ['课程页面', 'course page'],
  empty: ['空状态设计', 'empty state'],
  enterprise: ['企业安全页面', 'trust center'],
  error: ['错误状态设计', 'error state'],
  form: ['表单构建器', 'form builder'],
  graphql: ['GraphQL API', 'resolver'],
  homepage: ['官网首页', '品牌首页'],
  jobs: ['后台任务队列', 'scheduled job'],
  landing: ['营销落地页', '转化页'],
  limiting: ['限流防滥用', 'rate limiting'],
  marketing: ['营销落地页', 'campaign page'],
  migration: ['数据迁移', 'migration plan'],
  navigation: ['响应式导航', 'navbar'],
  onboarding: ['新手引导', 'onboarding flow'],
  pricing: ['定价页', 'pricing page'],
  profile: ['个人资料页面', 'profile page'],
  queues: ['异步队列', '死信队列'],
  rate: ['访问频率限制', 'rate limiting'],
  rest: ['REST API', 'REST 接口'],
  responsive: ['响应式导航', '移动端适配'],
  search: ['搜索结果页面', 'search results page'],
  settings: ['设置页面', 'settings page'],
  supply: ['供应链安全', '软件供应链'],
  table: ['数据表格', 'data table'],
  threat: ['威胁建模', 'threat model'],
  vercel: ['Vercel 部署', '预览环境'],
  vulnerability: ['漏洞检查', '安全漏洞检查'],
  website: ['官网首页', '企业官网首页'],
  wechat: ['公众号工具', '微信公众号'],
  xiaohongshu: ['小红书运营', '小红书内容'],
}

export function normalizeAlias(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeAliasKey(value: string): string {
  return normalizeAlias(value).toLowerCase()
}

export function uniqueAliases(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalized = normalizeAlias(value)
    const key = normalized.toLowerCase()
    if (!normalized || seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
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

function isPlatformTagAlias(aliasKey: string): boolean {
  return (
    METADATA_TAG_DENYLIST.has(aliasKey) ||
    /^(frontend|backend|design|security|infra|ai|review|general)-platform$/.test(
      aliasKey,
    )
  )
}

export function auditSkillAlias(
  alias: string,
  input: SkillAliasInput,
): SkillAliasAuditIssue | null {
  const normalized = normalizeAlias(alias)
  const key = normalized.toLowerCase()
  const metadataTags = new Set(
    [input.domain, ...input.departmentTags, ...input.sceneTags]
      .map(value => normalizeAliasKey(value))
      .filter(Boolean),
  )

  if (normalized.length <= 1) {
    return { alias: normalized, reason: 'too_short' }
  }

  if (GENERIC_ALIAS_DENYLIST.has(key)) {
    return { alias: normalized, reason: 'generic_exact' }
  }

  if (metadataTags.has(key)) {
    return { alias: normalized, reason: 'metadata_tag' }
  }

  if (isPlatformTagAlias(key)) {
    return { alias: normalized, reason: 'platform_tag' }
  }

  return null
}

export function isAllowedSkillAlias(alias: string, input: SkillAliasInput): boolean {
  return auditSkillAlias(alias, input) === null
}

export function generateSkillAliases(input: SkillAliasInput): string[] {
  const canonical = [
    input.name,
    input.displayName,
    input.name.replace(/-/g, ' '),
    input.name.replace(/-/g, ''),
  ]

  const rawAliases = [
    ...canonical,
    ...(input.aliases ?? []),
    ...(EXACT_ALIASES[input.name] ?? []),
  ]

  for (const word of wordsFrom(input.name)) {
    rawAliases.push(...(WORD_ALIASES[word.toLowerCase()] ?? []))
  }

  for (const word of wordsFrom(input.displayName)) {
    rawAliases.push(...(WORD_ALIASES[word.toLowerCase()] ?? []))
  }

  return uniqueAliases(rawAliases)
    .filter(alias => isAllowedSkillAlias(alias, input))
    .slice(0, 18)
}
