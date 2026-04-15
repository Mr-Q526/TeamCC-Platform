import { join } from 'path'
import { fileURLToPath } from 'url'
import {
  cosineSimilarity,
  embedQueryText,
  readSkillEmbeddings,
  type SkillEmbeddingsManifest,
} from '../embeddings/embeddings.js'
import {
  getSkillGraphSkillsDir,
  readSkillRegistry,
  type SkillRegistryEntry,
  type SkillRegistryManifest,
} from '../registry/registry.js'
import type {
  SkillRecallCandidate,
  SkillRetrievalRequest,
  SkillScoreBreakdown,
} from './types.js'

type IndexedSkill = SkillRegistryEntry & {
  skillPath: string
  searchTokens: string[]
  termFrequencies: Record<string, number>
  documentLength: number
}

type SkillIndex = {
  skills: IndexedSkill[]
  averageDocumentLength: number
  documentFrequency: Record<string, number>
}

export type RecallResult = {
  candidates: SkillRecallCandidate[]
  registryVersion: string | null
  embeddingsGeneratedAt: string | null
  vectorAvailable: boolean
}

type RecallAssets = {
  registryManifest?: SkillRegistryManifest | null
  embeddingsManifest?: SkillEmbeddingsManifest | null
  queryEmbedding?:
    | {
        vector: number[]
      }
    | null
}

type IntentRule = {
  key: string
  skillIdIncludes: string[]
  terms: string[]
}

type QueryIntentProfile = {
  frontendPageTypes: Set<string>
  securityTypes: Set<string>
  contentPlatformTypes: Set<string>
  generalTaskTypes: Set<string>
  complexity: 'basic' | 'pro' | null
  marketingIntent: boolean
  deploymentIntent: boolean
  homepageStrategicIntent: boolean
  homepageAntiLandingIntent: boolean
}

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url))

const QUERY_EXPANSIONS: Record<string, string[]> = {
  前端: ['frontend', 'react', 'ui', '页面'],
  页面: ['ui', 'frontend'],
  设计: ['design', 'ui'],
  官网: ['homepage', 'brand', 'design'],
  首页: ['homepage', 'hero', 'design'],
  营销: ['marketing', 'landing', 'campaign', 'conversion', 'lead'],
  落地页: ['landing', 'marketing', 'campaign', 'conversion', 'lead'],
  预约: ['demo', 'signup', 'lead', 'marketing', 'landing'],
  landing: ['落地页', 'marketing', 'conversion', 'lead'],
  homepage: ['官网', '首页', 'hero', 'design'],
  demo: ['预约', 'signup', 'lead'],
  安全: ['security', 'audit'],
  威胁建模: ['security', 'threat', 'model'],
  部署: ['deploy', 'vercel', 'release'],
  上线: ['deploy', 'release', 'vercel'],
  测试: ['test', 'playwright', 'browser'],
  自动化: ['playwright', 'browser', 'test'],
  截图: ['screenshot', 'image'],
  表格: ['spreadsheet', 'excel', 'sheet', 'csv'],
  文档: ['doc', 'documentation'],
  转录: ['transcribe', 'audio', 'speech', 'subtitle'],
  音频: ['transcribe', 'audio', 'speech'],
  视频: ['video', 'motion'],
  ppt: ['ppt', 'presentation', 'slides'],
  演示: ['presentation', 'slides', 'ppt'],
  汇报: ['presentation', 'slides', 'deck', 'ppt'],
  复盘: ['presentation', 'deck', 'report'],
  deck: ['ppt', 'presentation', 'slides'],
  课堂: ['course', 'lesson', 'presentation'],
  微信: ['wechat'],
  小红书: ['xiaohongshu'],
}

const FRONTEND_PAGE_TYPE_RULES: IntentRule[] = [
  {
    key: 'settings',
    skillIdIncludes: ['settings-page'],
    terms: ['设置页面', '设置页', '配置页', '设置', 'settings', 'preferences'],
  },
  {
    key: 'search-results',
    skillIdIncludes: ['search-results-page'],
    terms: ['搜索结果', '搜索结果页面', 'search results', 'results page', '过滤器', '筛选'],
  },
  {
    key: 'navigation',
    skillIdIncludes: ['responsive-navigation'],
    terms: ['响应式导航', '导航栏', '导航', 'navbar', 'sidebar', 'mega menu', 'tabs', 'drawer'],
  },
  {
    key: 'profile-account',
    skillIdIncludes: ['profile-account-page'],
    terms: ['个人资料', '账户页面', '账号页面', 'profile', 'account page', 'account settings'],
  },
  {
    key: 'onboarding',
    skillIdIncludes: ['onboarding-flow'],
    terms: ['onboarding', '引导流程', '新手引导', '入门流程', '首次使用'],
  },
  {
    key: 'checkout',
    skillIdIncludes: ['checkout-flow'],
    terms: ['结账', '支付流程', 'checkout', '购物车', '订单确认', '地址', '物流'],
  },
  {
    key: 'pricing',
    skillIdIncludes: ['pricing-page'],
    terms: ['定价页', '定价页面', 'pricing', '套餐', '价格页', '价格方案'],
  },
  {
    key: 'docs-site',
    skillIdIncludes: ['docs-site'],
    terms: ['文档站', '文档网站', 'docs site', 'documentation site', '开发文档站'],
  },
  {
    key: 'login',
    skillIdIncludes: ['auth-login-page'],
    terms: ['登录页面', '登录页', 'login page', 'sign in', '账户访问', '错误恢复'],
  },
  {
    key: 'dashboard',
    skillIdIncludes: [
      'admin-dashboard-design',
      'analytics-dashboard-design',
      'fintech-dashboard',
    ],
    terms: ['dashboard', '仪表盘', '控制台', '后台', '管理后台', '数据分析仪表盘', '看板'],
  },
  {
    key: 'table',
    skillIdIncludes: ['data-table'],
    terms: ['数据表', '数据表格', 'data table', 'table', 'columns', 'sorting', 'inline actions'],
  },
  {
    key: 'form',
    skillIdIncludes: ['form-builder'],
    terms: ['表单构建', '表单设计', 'form builder', 'form', '字段', '校验'],
  },
  {
    key: 'homepage',
    skillIdIncludes: ['website-homepage-design'],
    terms: ['官网首页', '首页设计', '品牌官网', 'homepage', 'home page', 'hero'],
  },
  {
    key: 'about-company',
    skillIdIncludes: ['about-company-page'],
    terms: [
      '公司介绍',
      '关于我们',
      '关于公司',
      '公司页面',
      '公司故事',
      '团队',
      '使命',
      'about company',
      'about us',
      '价值观',
      '发展历程',
    ],
  },
  {
    key: 'careers',
    skillIdIncludes: ['careers-page'],
    terms: [
      '招聘页面',
      '招聘页',
      '职业页面',
      '职业页',
      'careers',
      '岗位',
      '候选人',
      '招聘',
    ],
  },
  {
    key: 'contact-sales',
    skillIdIncludes: ['contact-sales-page'],
    terms: ['联系销售', 'contact sales', 'sales page', '销售表单', '预约销售'],
  },
  {
    key: 'component-library',
    skillIdIncludes: ['component-library'],
    terms: ['组件库', 'component library', '组件规范', 'variants', '变体'],
  },
  {
    key: 'design-system',
    skillIdIncludes: ['design-system-builder'],
    terms: ['设计系统', 'design system', 'token', 'tokens', '组件标准'],
  },
  {
    key: 'developer-portal',
    skillIdIncludes: ['developer-portal'],
    terms: ['开发者门户', 'developer portal', 'api docs', 'sdk'],
  },
  {
    key: 'ecommerce-storefront',
    skillIdIncludes: ['ecommerce-storefront-design'],
    terms: ['电商首页', '商品列表', 'storefront', 'ecommerce', '商品卡片'],
  },
  {
    key: 'education-course',
    skillIdIncludes: ['education-course-page'],
    terms: ['课程页面', '课程页', 'course page', '课程层级', '练习', '进度'],
  },
  {
    key: 'enterprise-security-page',
    skillIdIncludes: ['enterprise-security-page'],
    terms: ['企业安全页面', '安全页面', '信任中心', 'trust center', 'soc2', '合规页面'],
  },
  {
    key: 'error-empty-states',
    skillIdIncludes: ['error-empty-states'],
    terms: ['错误状态', '空状态', '404', '离线状态', 'empty state', 'error state'],
  },
  {
    key: 'healthcare-portal',
    skillIdIncludes: ['healthcare-portal'],
    terms: ['医疗门户', 'patient portal', 'healthcare portal', 'privacy', '敏感任务'],
  },
  {
    key: 'notification-center',
    skillIdIncludes: ['notification-center'],
    terms: ['通知中心', 'notification center', '已读状态', '优先级', '通知'],
  },
  {
    key: 'saas-workspace',
    skillIdIncludes: ['saas-workspace-design'],
    terms: ['saas workspace', '工作区', '多租户', 'workspace'],
  },
  {
    key: 'ai-chat',
    skillIdIncludes: ['ai-chat-interface'],
    terms: ['聊天界面', 'ai chat', 'chat interface', '对话流程', '安全提示'],
  },
  {
    key: 'nextjs-app-router',
    skillIdIncludes: ['nextjs-app-router'],
    terms: ['next.js', 'nextjs', 'app router', '路由架构', 'server components'],
  },
  {
    key: 'web-game',
    skillIdIncludes: ['develop-web-game'],
    terms: ['网页游戏', 'web game', '游戏', 'canvas game'],
  },
]

const SECURITY_SUBTYPE_RULES: IntentRule[] = [
  {
    key: 'threat-model',
    skillIdIncludes: ['security-threat-model'],
    terms: ['威胁建模', '威胁模型', 'threat model', 'attack surface', '攻击面', '攻击路径', 'abuse path', 'trust boundary'],
  },
  {
    key: 'ownership-map',
    skillIdIncludes: ['security-ownership-map'],
    terms: ['安全所有权', '所有权', '负责人', '文件归属', '代码归属', 'codeowners', 'ownership', 'bus factor', '谁负责'],
  },
  {
    key: 'rate-limiting',
    skillIdIncludes: ['rate-limiting-abuse-protection'],
    terms: ['限流', '速率限制', '访问频率', '限制访问频率', '防止滥用', '防滥用', '接口被刷', '刷接口', '频控', 'quota', 'rate limit', 'rate limiting', 'api abuse', 'anti scraping'],
  },
  {
    key: 'supply-chain',
    skillIdIncludes: ['dependency-supply-chain-audit'],
    terms: ['供应链', '依赖包', '依赖安全', 'lockfile', '锁文件', 'npm 包', 'package', '投毒', '许可证', 'license', 'dependency', 'supply chain'],
  },
  {
    key: 'best-practices',
    skillIdIncludes: ['security-best-practices'],
    terms: ['安全最佳实践', '最佳实践', '安全基线', 'secure coding', 'best practices', '改进建议', '修复建议'],
  },
  {
    key: 'vulnerability-check',
    skillIdIncludes: ['security-vulnerability-check'],
    terms: ['漏洞', '漏洞检查', '漏洞扫描', 'vulnerability', 'xss', 'ssrf', 'sql injection', '注入', '越权', 'cve'],
  },
]

const CONTENT_PLATFORM_RULES: IntentRule[] = [
  {
    key: 'wechat',
    skillIdIncludes: ['wechat-toolkit'],
    terms: ['微信公众号', '公众号', '微信文章', '微信运营', 'wechat'],
  },
  {
    key: 'xiaohongshu',
    skillIdIncludes: ['xiaohongshu-ops'],
    terms: ['小红书', '小红书运营', '种草', 'xiaohongshu'],
  },
]

const GENERAL_TASK_RULES: IntentRule[] = [
  {
    key: 'humanizer',
    skillIdIncludes: ['humanizer-zh'],
    terms: [
      '去 ai 味',
      '去ai味',
      '更像人写的',
      '更自然表达',
      '自然中文',
      '润色成自然',
      'humanize',
      'humanizer',
    ],
  },
  {
    key: 'development-plan',
    skillIdIncludes: ['development-plan-doc'],
    terms: [
      '开发计划',
      '开发计划文档',
      '项目计划',
      '里程碑',
      '验收标准',
      '资源拆分',
      '风险拆解',
      'implementation plan',
    ],
  },
  {
    key: 'business-presentation',
    skillIdIncludes: ['ppt-maker'],
    terms: [
      '运营复盘',
      '业务汇报',
      '经营分析',
      '汇报 deck',
      '业务 deck',
      'presentation narrative',
      '逐页布局',
      '页级布局',
      '汇报材料',
      '业务材料',
      '汇报稿',
      '老板汇报',
      '管理层汇报',
    ],
  },
  {
    key: 'course-presentation',
    skillIdIncludes: ['ppt-course-presentation'],
    terms: [
      '课堂汇报',
      '课程展示',
      '读书报告',
      '案例分析',
      '小组作业',
      '课堂讨论',
      '老师',
      '同学',
      'lesson presentation',
      'course presentation',
      '课堂投屏',
      '授课',
    ],
  },
]

const MARKETING_INTENT_TERMS = [
  '营销落地页',
  '落地页',
  '转化页',
  '转化',
  '获客',
  'campaign',
  'lead generation',
  'webinar',
  'marketing landing',
  'feature promotion',
]

const DEPLOYMENT_INTENT_TERMS = [
  '部署',
  '上线',
  'vercel',
  'preview deployment',
  '预览环境',
  '生产环境',
  '域名',
  '环境变量',
  '托管',
  'build',
  '构建产物',
  'push this live',
  'deploy',
]

const BASIC_INTENT_TERMS = [
  '基础版',
  '基础',
  '简单',
  '简洁',
  '快速',
  '轻量',
  'basic',
  'mvp',
  'baseline',
]

const PRO_INTENT_TERMS = [
  '专业版',
  '专业',
  '高级',
  '完整',
  '复杂',
  '企业级',
  '深层',
  '强层次',
  'advanced',
]

const HOMEPAGE_STRATEGIC_INTENT_TERMS = [
  '品牌站',
  '品牌表达',
  '首屏叙事',
  '首屏动作',
  '价值主张',
  '信任证明',
  '模块排序',
  '转化承接',
  '转化路径',
  'cta 路径',
  'hero narrative',
  'section narrative',
  'proof sequencing',
  'brand homepage',
  '成熟大厂官网',
  '大厂官网',
  '战略定位',
]

const HOMEPAGE_ANTI_LANDING_TERMS = [
  '不是简单做个 landing page',
  '不是简单做个 landing',
  '不是只拼几个营销模块',
  '不是营销落地页',
  '不是活动页',
  '不只是 landing page',
  'not a landing page',
]

const DOMAIN_HINTS: Record<string, string[]> = {
  frontend: [
    'frontend',
    'react',
    'nextjs',
    'ui',
    '页面',
    '前端',
    'css',
    '官网',
    '首页',
    '营销',
    '落地页',
    'landing',
    'homepage',
    'marketing',
  ],
  security: ['security', 'audit', 'threat', '威胁建模', '安全'],
  infra: ['deploy', 'release', 'vercel', '部署', '发布', '上线'],
  tools: [
    'pdf',
    'screenshot',
    'spreadsheet',
    'playwright',
    '截图',
    '表格',
    '转录',
    '音频',
    'ppt',
  ],
  design: [
    'design',
    'visual',
    'motion',
    '视觉',
    '设计',
    '视频',
    '官网',
    '首页',
    '营销',
    '落地页',
    'landing',
    'homepage',
    'marketing',
    'conversion',
    'hero',
    'brand',
  ],
  data: ['data', 'analysis', 'excel', 'sheet', '数据', '分析'],
  ai: ['agent', 'llm', 'ai', 'prompt'],
}

const SCENE_HINTS: Record<string, string[]> = {
  design: [
    'design',
    'ui',
    '视觉',
    '设计',
    '页面',
    '官网',
    '首页',
    '营销',
    '落地页',
    'landing',
    'homepage',
    'hero',
  ],
  architecture: ['architecture', '架构', 'router', 'boundary'],
  deploy: ['deploy', 'release', '上线', '发布', '部署'],
  'security-audit': ['security', 'audit', '威胁建模', '审计', '安全'],
  test: ['test', 'playwright', '自动化', '测试'],
  'content-generation': ['ppt', 'presentation', 'video', '文案', '视频', '演示'],
}

const indexCache = new Map<string, SkillIndex>()

function indexCacheKeyFor(manifest: SkillRegistryManifest): string {
  const skillIdentity = manifest.skills
    .map(skill => `${skill.skillId}@${skill.version}#${skill.sourceHash}`)
    .sort()
    .join('|')

  return [
    manifest.registryVersion,
    manifest.generatedAt,
    String(manifest.skillCount),
    skillIdentity,
  ].join('\n')
}

function toStringArray(value: string[] | undefined): string[] {
  return Array.isArray(value)
    ? value.map(item => item.trim()).filter(Boolean)
    : []
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[_/:.]+/g, ' ')
}

function includesAnyTerm(normalizedText: string, terms: string[]): boolean {
  return terms.some(term => {
    const normalizedTerm = normalizeText(term)
    return normalizedTerm.length > 0 && normalizedText.includes(normalizedTerm)
  })
}

function collectRuleMatches(
  normalizedText: string,
  rules: IntentRule[],
): Set<string> {
  const matches = new Set<string>()

  for (const rule of rules) {
    if (includesAnyTerm(normalizedText, rule.terms)) {
      matches.add(rule.key)
    }
  }

  return matches
}

function matchesRuleSkill(skill: IndexedSkill, rule: IntentRule): boolean {
  const normalizedSkillId = normalizeText(skill.skillId)
  const normalizedName = normalizeText(skill.name)

  return rule.skillIdIncludes.some(pattern => {
    const normalizedPattern = normalizeText(pattern)
    return (
      normalizedSkillId.includes(normalizedPattern) ||
      normalizedName.includes(normalizedPattern)
    )
  })
}

function resolveComplexityIntent(normalizedRawQuery: string): 'basic' | 'pro' | null {
  const hasBasic = includesAnyTerm(normalizedRawQuery, BASIC_INTENT_TERMS)
  const hasPro = includesAnyTerm(normalizedRawQuery, PRO_INTENT_TERMS)

  if (hasBasic && !hasPro) {
    return 'basic'
  }
  if (hasPro && !hasBasic) {
    return 'pro'
  }
  return null
}

function buildQueryIntentProfile(rawQuery: string, enrichedQuery: string): QueryIntentProfile {
  const normalizedRawQuery = normalizeText(rawQuery)
  const normalizedEnrichedQuery = normalizeText(enrichedQuery)

  return {
    frontendPageTypes: collectRuleMatches(
      normalizedEnrichedQuery,
      FRONTEND_PAGE_TYPE_RULES,
    ),
    securityTypes: collectRuleMatches(
      normalizedEnrichedQuery,
      SECURITY_SUBTYPE_RULES,
    ),
    contentPlatformTypes: collectRuleMatches(
      normalizedEnrichedQuery,
      CONTENT_PLATFORM_RULES,
    ),
    generalTaskTypes: collectRuleMatches(
      normalizedEnrichedQuery,
      GENERAL_TASK_RULES,
    ),
    complexity: resolveComplexityIntent(normalizedRawQuery),
    marketingIntent: includesAnyTerm(normalizedRawQuery, MARKETING_INTENT_TERMS),
    deploymentIntent: includesAnyTerm(normalizedRawQuery, DEPLOYMENT_INTENT_TERMS),
    homepageStrategicIntent: includesAnyTerm(
      normalizedRawQuery,
      HOMEPAGE_STRATEGIC_INTENT_TERMS,
    ),
    homepageAntiLandingIntent: includesAnyTerm(
      normalizedRawQuery,
      HOMEPAGE_ANTI_LANDING_TERMS,
    ),
  }
}

function applyFrontendIntentScoring(
  skill: IndexedSkill,
  intent: QueryIntentProfile,
  scoreBreakdown: SkillScoreBreakdown,
): void {
  const isMarketingLanding = skill.skillId === 'frontend/marketing-landing-page'
  const isHomepageNeutral = skill.skillId === 'frontend/website-homepage-design'
  const isHomepagePro = skill.skillId === 'frontend/website-homepage-design-pro'
  const isHomepageBasic = skill.skillId === 'frontend/website-homepage-design-basic'

  if (intent.frontendPageTypes.size === 0) {
    if (intent.marketingIntent && isMarketingLanding) {
      scoreBreakdown.discriminator += 88
    } else if (isMarketingLanding) {
      scoreBreakdown.genericPenalty -= 360
    }
    return
  }

  let matchedSpecificPage = false
  for (const rule of FRONTEND_PAGE_TYPE_RULES) {
    if (!intent.frontendPageTypes.has(rule.key)) {
      continue
    }
    if (matchesRuleSkill(skill, rule)) {
      scoreBreakdown.discriminator += 105
      matchedSpecificPage = true
    }
  }

  if (skill.domain === 'security') {
    scoreBreakdown.genericPenalty -= 72
  }

  if (
    isMarketingLanding &&
    !intent.marketingIntent &&
    !intent.frontendPageTypes.has('homepage')
  ) {
    scoreBreakdown.genericPenalty -= 560
  }

  if (intent.frontendPageTypes.has('homepage')) {
    if (intent.homepageStrategicIntent) {
      if (isHomepagePro) {
        scoreBreakdown.intent += 96
      } else if (isHomepageNeutral) {
        scoreBreakdown.genericPenalty -= 72
      } else if (isHomepageBasic) {
        scoreBreakdown.genericPenalty -= 44
      } else if (isMarketingLanding) {
        scoreBreakdown.genericPenalty -= 120
      }
    }

    if (intent.homepageAntiLandingIntent) {
      if (isMarketingLanding) {
        scoreBreakdown.genericPenalty -= 140
      } else if (isHomepageNeutral) {
        scoreBreakdown.genericPenalty -= 28
      }
    }

    if (intent.complexity === 'pro') {
      if (isHomepagePro) {
        scoreBreakdown.discriminator += 52
      } else if (isHomepageNeutral) {
        scoreBreakdown.genericPenalty -= 78
      } else if (isHomepageBasic) {
        scoreBreakdown.genericPenalty -= 34
      }
    } else if (intent.complexity === 'basic') {
      if (isHomepageBasic) {
        scoreBreakdown.discriminator += 24
      } else if (isHomepagePro) {
        scoreBreakdown.genericPenalty -= 22
      }
    }
  }

  if (
    skill.skillId.startsWith('frontend/') &&
    !matchedSpecificPage &&
    skill.skillId !== 'frontend/marketing-landing-page'
  ) {
    scoreBreakdown.genericPenalty -= 12
  }
}

function applySecurityIntentScoring(
  skill: IndexedSkill,
  intent: QueryIntentProfile,
  scoreBreakdown: SkillScoreBreakdown,
): void {
  if (intent.securityTypes.size === 0) {
    return
  }

  let matchedSpecificSecurityType = false
  for (const rule of SECURITY_SUBTYPE_RULES) {
    if (!intent.securityTypes.has(rule.key)) {
      continue
    }
    if (matchesRuleSkill(skill, rule)) {
      scoreBreakdown.discriminator += 105
      matchedSpecificSecurityType = true
    }
  }

  if (
    skill.skillId === 'security/security-threat-model' &&
    !intent.securityTypes.has('threat-model')
  ) {
    scoreBreakdown.genericPenalty -= 95
  }

  if (
    skill.domain === 'security' &&
    !matchedSpecificSecurityType &&
    !skill.skillId.includes('security-threat-model')
  ) {
    scoreBreakdown.genericPenalty -= 10
  }
}

function applyGeneralIntentScoring(
  skill: IndexedSkill,
  intent: QueryIntentProfile,
  scoreBreakdown: SkillScoreBreakdown,
): void {
  if (intent.contentPlatformTypes.size > 0) {
    for (const rule of CONTENT_PLATFORM_RULES) {
      if (!intent.contentPlatformTypes.has(rule.key)) {
        continue
      }
      if (matchesRuleSkill(skill, rule)) {
        scoreBreakdown.discriminator += 105
      }
    }

    if (skill.skillId === 'infra/vercel-deploy') {
      scoreBreakdown.genericPenalty -= 120
    }
  }

  if (intent.deploymentIntent && skill.skillId === 'infra/vercel-deploy') {
    scoreBreakdown.discriminator += 70
  }

  if (intent.generalTaskTypes.size > 0) {
    for (const rule of GENERAL_TASK_RULES) {
      if (!intent.generalTaskTypes.has(rule.key)) {
        continue
      }
      if (matchesRuleSkill(skill, rule)) {
        scoreBreakdown.discriminator += 105
      }
    }

    const isPptMaker = skill.skillId === 'design/ppt-maker'
    const isCoursePresentation =
      skill.skillId === 'design/ppt-course-presentation'
    const isOtherPptSkill =
      skill.skillId.startsWith('design/ppt-') &&
      !isPptMaker &&
      !isCoursePresentation

    if (intent.generalTaskTypes.has('business-presentation')) {
      if (isPptMaker) {
        scoreBreakdown.discriminator += 150
      } else if (isCoursePresentation) {
        scoreBreakdown.genericPenalty -= 210
      } else if (isOtherPptSkill) {
        scoreBreakdown.genericPenalty -= 72
      }
    }

    if (intent.generalTaskTypes.has('course-presentation')) {
      if (isCoursePresentation) {
        scoreBreakdown.discriminator += 140
      } else if (isPptMaker) {
        scoreBreakdown.genericPenalty -= 54
      }
    }
  }
}

function applyComplexityIntentScoring(
  skill: IndexedSkill,
  intent: QueryIntentProfile,
  scoreBreakdown: SkillScoreBreakdown,
): void {
  if (!intent.complexity) {
    return
  }

  const isBasic = skill.skillId.endsWith('-basic') || normalizeText(skill.name).includes(' basic')
  const isPro = skill.skillId.endsWith('-pro') || normalizeText(skill.name).includes(' pro')

  if (intent.complexity === 'basic') {
    if (isBasic) {
      scoreBreakdown.intent += 28
    } else if (isPro) {
      scoreBreakdown.genericPenalty -= 16
    }
    return
  }

  if (isPro) {
    scoreBreakdown.intent += 28
  } else if (isBasic) {
    scoreBreakdown.genericPenalty -= 16
  }
}

function matchedRuleKeys(
  skill: IndexedSkill,
  activeKeys: Set<string>,
  rules: IntentRule[],
): string[] {
  const keys: string[] = []

  for (const rule of rules) {
    if (!activeKeys.has(rule.key)) {
      continue
    }
    if (matchesRuleSkill(skill, rule)) {
      keys.push(rule.key)
    }
  }

  return keys.sort()
}

function queryIntentKeys(intent: QueryIntentProfile): string[] {
  const keys: string[] = []

  if (intent.marketingIntent) {
    keys.push('marketing')
  }

  if (intent.deploymentIntent) {
    keys.push('deployment')
  }

  if (intent.homepageStrategicIntent) {
    keys.push('homepage:strategic')
  }

  if (intent.complexity) {
    keys.push(`complexity:${intent.complexity}`)
  }

  return keys.sort()
}

function queryDiscriminatorKeys(intent: QueryIntentProfile): string[] {
  return [
    ...[...intent.frontendPageTypes].sort().map(key => `frontend:${key}`),
    ...[...intent.securityTypes].sort().map(key => `security:${key}`),
    ...[...intent.contentPlatformTypes]
      .sort()
      .map(key => `content-platform:${key}`),
    ...[...intent.generalTaskTypes].sort().map(key => `general-task:${key}`),
  ]
}

function matchedIntentKeys(
  skill: IndexedSkill,
  intent: QueryIntentProfile,
): string[] {
  const keys: string[] = []
  const normalizedName = normalizeText(skill.name)
  const isBasic =
    skill.skillId.endsWith('-basic') || normalizedName.includes(' basic')
  const isPro = skill.skillId.endsWith('-pro') || normalizedName.includes(' pro')
  const isHomepagePro = skill.skillId === 'frontend/website-homepage-design-pro'

  if (intent.marketingIntent && skill.skillId === 'frontend/marketing-landing-page') {
    keys.push('marketing')
  }

  if (intent.deploymentIntent && skill.skillId === 'infra/vercel-deploy') {
    keys.push('deployment')
  }

  if (intent.homepageStrategicIntent && isHomepagePro) {
    keys.push('homepage:strategic')
  }

  if (intent.complexity === 'basic' && isBasic) {
    keys.push('complexity:basic')
  }

  if (intent.complexity === 'pro' && isPro) {
    keys.push('complexity:pro')
  }

  return keys.sort()
}

function matchedDiscriminatorKeys(
  skill: IndexedSkill,
  intent: QueryIntentProfile,
): string[] {
  return [
    ...matchedRuleKeys(skill, intent.frontendPageTypes, FRONTEND_PAGE_TYPE_RULES).map(
      key => `frontend:${key}`,
    ),
    ...matchedRuleKeys(skill, intent.securityTypes, SECURITY_SUBTYPE_RULES).map(
      key => `security:${key}`,
    ),
    ...matchedRuleKeys(skill, intent.contentPlatformTypes, CONTENT_PLATFORM_RULES).map(
      key => `content-platform:${key}`,
    ),
    ...matchedRuleKeys(skill, intent.generalTaskTypes, GENERAL_TASK_RULES).map(
      key => `general-task:${key}`,
    ),
  ]
}

function normalizeScopedKey(
  value: string | null | undefined,
  prefix: 'dept:' | 'scene:',
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  if (!trimmed) {
    return null
  }

  return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed
}

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(/[^a-z0-9\u4e00-\u9fff+-]+/g)
        .map(token => token.trim())
        .filter(token => token.length >= 2 || /[\u4e00-\u9fff]/.test(token)),
    ),
  )
}

function buildSearchTokens(skill: SkillRegistryEntry): string[] {
  return [
    ...tokenize(skill.name),
    ...tokenize(skill.displayName),
    ...tokenize(skill.description),
    ...skill.aliases.flatMap(tokenize),
    ...tokenize(skill.domain),
    ...skill.departmentTags.flatMap(tokenize),
    ...skill.sceneTags.flatMap(tokenize),
  ]
}

function createIndexedSkill(skill: SkillRegistryEntry): IndexedSkill {
  const searchTokens = buildSearchTokens(skill)
  const termFrequencies: Record<string, number> = {}

  for (const token of searchTokens) {
    termFrequencies[token] = (termFrequencies[token] ?? 0) + 1
  }

  return {
    ...skill,
    skillPath: join(getSkillGraphSkillsDir(PROJECT_ROOT), skill.skillFile),
    searchTokens,
    termFrequencies,
    documentLength: searchTokens.length,
  }
}

function buildSkillIndex(manifest: SkillRegistryManifest): SkillIndex {
  const cacheKey = indexCacheKeyFor(manifest)
  const cached = indexCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const skills = manifest.skills.map(createIndexedSkill)
  const documentFrequency: Record<string, number> = {}
  for (const skill of skills) {
    for (const token of new Set(skill.searchTokens)) {
      documentFrequency[token] = (documentFrequency[token] ?? 0) + 1
    }
  }

  const averageDocumentLength =
    skills.length === 0
      ? 0
      : skills.reduce((sum, skill) => sum + skill.documentLength, 0) /
        skills.length

  const index = {
    skills,
    averageDocumentLength,
    documentFrequency,
  }
  indexCache.set(cacheKey, index)
  return index
}

function expandQueryTokens(query: string): string[] {
  const tokens = new Set(tokenize(query))
  const normalizedQuery = normalizeText(query)

  for (const [trigger, expansions] of Object.entries(QUERY_EXPANSIONS)) {
    if (!normalizedQuery.includes(trigger)) {
      continue
    }
    for (const expansion of expansions) {
      tokens.add(expansion)
    }
  }

  return [...tokens]
}

function collectHintMatches(
  query: string,
  hintMap: Record<string, string[]>,
  explicitHints: string[] | undefined,
): Set<string> {
  const normalizedQuery = normalizeText(query)
  const matches = new Set<string>()

  for (const [key, hints] of Object.entries(hintMap)) {
    if (hints.some(hint => normalizedQuery.includes(hint.toLowerCase()))) {
      matches.add(key)
    }
  }

  for (const hint of explicitHints ?? []) {
    const trimmed = hint.trim().toLowerCase()
    if (trimmed) {
      matches.add(trimmed.startsWith('scene:') ? trimmed.slice(6) : trimmed)
    }
  }

  return matches
}

function scoreSkillBm25(
  skill: IndexedSkill,
  queryTokens: string[],
  totalDocuments: number,
  averageDocumentLength: number,
  documentFrequency: Record<string, number>,
): number {
  if (queryTokens.length === 0 || totalDocuments === 0 || averageDocumentLength === 0) {
    return 0
  }

  const k1 = 1.2
  const b = 0.75
  let score = 0

  for (const token of queryTokens) {
    const tf = skill.termFrequencies[token] ?? 0
    if (tf <= 0) {
      continue
    }

    const df = documentFrequency[token] ?? 0
    const idf = Math.log(1 + (totalDocuments - df + 0.5) / (df + 0.5))
    const denominator =
      tf + k1 * (1 - b + b * (skill.documentLength / averageDocumentLength))

    score += idf * ((tf * (k1 + 1)) / denominator)
  }

  return score
}

function scoreSkill(
  skill: IndexedSkill,
  query: string,
  queryTokens: string[],
  intent: QueryIntentProfile,
  departmentTag: string | null,
  hintedDomains: Set<string>,
  hintedScenes: Set<string>,
  bm25Score: number,
  vectorScore: number,
  priorInjectedSkillIds: Set<string>,
  priorInvokedSkillIds: Set<string>,
): { score: number; scoreBreakdown: SkillScoreBreakdown } {
  const normalizedQuery = normalizeText(query)
  const normalizedName = normalizeText(skill.name)
  const normalizedDisplayName = normalizeText(skill.displayName)
  const normalizedDescription = normalizeText(skill.description)
  const searchableTokenSet = new Set(skill.searchTokens)

  const scoreBreakdown: SkillScoreBreakdown = {
    exactName: 0,
    displayName: 0,
    alias: 0,
    lexical: 0,
    bm25: 0,
    vector: 0,
    department: 0,
    domain: 0,
    scene: 0,
    intent: 0,
    discriminator: 0,
    genericPenalty: 0,
    penalty: 0,
  }

  if (normalizedQuery.includes(normalizedName)) {
    scoreBreakdown.exactName += 80
  }

  if (normalizedDisplayName && normalizedQuery.includes(normalizedDisplayName)) {
    scoreBreakdown.displayName += 55
  }

  for (const alias of skill.aliases) {
    const normalizedAlias = normalizeText(alias)
    if (!normalizedAlias || !normalizedQuery.includes(normalizedAlias)) {
      continue
    }
    scoreBreakdown.alias += normalizedAlias.length >= 4 ? 34 : 16
  }

  for (const token of queryTokens) {
    if (normalizedName.includes(token)) {
      scoreBreakdown.lexical += 26
      continue
    }

    if (normalizedDisplayName.includes(token)) {
      scoreBreakdown.lexical += 20
      continue
    }

    if (normalizedDescription.includes(token)) {
      scoreBreakdown.lexical += 10
      continue
    }

    if (searchableTokenSet.has(token)) {
      scoreBreakdown.lexical += 8
    }
  }

  scoreBreakdown.bm25 += bm25Score * 18
  scoreBreakdown.vector += vectorScore > 0 ? vectorScore * 30 : 0

  if (departmentTag) {
    if (skill.departmentTags.includes(departmentTag)) {
      scoreBreakdown.department += 18
    } else if (skill.departmentTags.length > 0) {
      scoreBreakdown.penalty -= 4
    }
  }

  if (hintedDomains.has(skill.domain)) {
    scoreBreakdown.domain += 18
  }

  for (const sceneTag of skill.sceneTags) {
    if (hintedScenes.has(sceneTag)) {
      scoreBreakdown.scene += 14
    }
  }

  applyFrontendIntentScoring(skill, intent, scoreBreakdown)
  applySecurityIntentScoring(skill, intent, scoreBreakdown)
  applyGeneralIntentScoring(skill, intent, scoreBreakdown)
  applyComplexityIntentScoring(skill, intent, scoreBreakdown)

  if (priorInjectedSkillIds.has(skill.skillId)) {
    scoreBreakdown.penalty -= 8
  }

  if (priorInvokedSkillIds.has(skill.skillId)) {
    scoreBreakdown.penalty -= 18
  }

  if (
    queryTokens.length > 0 &&
    skill.departmentTags.length === 0 &&
    hintedDomains.size === 0 &&
    hintedScenes.size === 0
  ) {
    scoreBreakdown.penalty -= 4
  }

  return {
    score: Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0),
    scoreBreakdown,
  }
}

async function resolveVectorScores(
  request: SkillRetrievalRequest,
  embeddingsManifest: SkillEmbeddingsManifest | null,
  queryEmbedding: { vector: number[] } | null | undefined,
): Promise<Map<string, number>> {
  if (!embeddingsManifest || embeddingsManifest.items.length === 0) {
    return new Map()
  }

  const resolvedQueryEmbedding =
    queryEmbedding === undefined
      ? await embedQueryText([request.queryText, request.queryContext ?? ''].filter(Boolean).join('\n'))
      : queryEmbedding

  if (!resolvedQueryEmbedding?.vector || resolvedQueryEmbedding.vector.length === 0) {
    return new Map()
  }

  return new Map(
    embeddingsManifest.items
      .map(item => [
        `${item.skillId}\n${item.version}\n${item.sourceHash}`,
        cosineSimilarity(resolvedQueryEmbedding.vector, item.vector),
      ] as const)
      .filter(([, score]) => score > 0),
  )
}

export function clearRecallCache(): void {
  indexCache.clear()
}

export async function recallSkills(
  request: SkillRetrievalRequest,
  assets: RecallAssets = {},
): Promise<RecallResult> {
  const trimmedQuery = request.queryText.trim()
  if (!trimmedQuery) {
    return {
      candidates: [],
      registryVersion: null,
      embeddingsGeneratedAt: null,
      vectorAvailable: false,
    }
  }

  const registryManifest =
    assets.registryManifest === undefined
      ? await readSkillRegistry(PROJECT_ROOT)
      : assets.registryManifest

  if (!registryManifest || registryManifest.skills.length === 0) {
    return {
      candidates: [],
      registryVersion: null,
      embeddingsGeneratedAt: null,
      vectorAvailable: false,
    }
  }

  const embeddingsManifest =
    assets.embeddingsManifest === undefined
      ? await readSkillEmbeddings(PROJECT_ROOT)
      : assets.embeddingsManifest

  const skillIndex = buildSkillIndex(registryManifest)
  const enrichedQuery = [trimmedQuery, request.queryContext?.trim() ?? '']
    .filter(Boolean)
    .join('\n')
  const queryTokens = expandQueryTokens(enrichedQuery)
  const intent = buildQueryIntentProfile(trimmedQuery, enrichedQuery)
  const hintedDomains = collectHintMatches(
    enrichedQuery,
    DOMAIN_HINTS,
    request.domainHints,
  )
  const hintedScenes = collectHintMatches(
    enrichedQuery,
    SCENE_HINTS,
    request.sceneHints,
  )
  const departmentTag = normalizeScopedKey(request.department, 'dept:')
  const priorInjectedSkillIds = new Set(request.priorInjectedSkillIds ?? [])
  const priorInvokedSkillIds = new Set(request.priorInvokedSkillIds ?? [])
  const vectorScores = await resolveVectorScores(
    request,
    embeddingsManifest ?? null,
    assets.queryEmbedding,
  )
  const activeQueryIntentKeys = queryIntentKeys(intent)
  const activeQueryDiscriminatorKeys = queryDiscriminatorKeys(intent)

  const candidates = skillIndex.skills
    .map(skill => {
      const bm25Score = scoreSkillBm25(
        skill,
        queryTokens,
        skillIndex.skills.length,
        skillIndex.averageDocumentLength,
        skillIndex.documentFrequency,
      )
      const vectorScore =
        vectorScores.get(`${skill.skillId}\n${skill.version}\n${skill.sourceHash}`) ??
        0
      const { score, scoreBreakdown } = scoreSkill(
        skill,
        enrichedQuery,
        queryTokens,
        intent,
        departmentTag,
        hintedDomains,
        hintedScenes,
        bm25Score,
        vectorScore,
        priorInjectedSkillIds,
        priorInvokedSkillIds,
      )

      return {
        ...skill,
        recallScore: score,
        recallScoreBreakdown: scoreBreakdown,
        queryIntentKeys: activeQueryIntentKeys,
        queryDiscriminatorKeys: activeQueryDiscriminatorKeys,
        matchedIntentKeys: matchedIntentKeys(skill, intent),
        matchedDiscriminatorKeys: matchedDiscriminatorKeys(skill, intent),
      }
    })
    .filter(
      skill =>
        skill.recallScore >= 32 ||
        (vectorScores.get(`${skill.skillId}\n${skill.version}\n${skill.sourceHash}`) ??
          0) >= 0.55,
    )
    .sort((left, right) => {
      if (right.recallScore !== left.recallScore) {
        return right.recallScore - left.recallScore
      }
      return left.name.localeCompare(right.name)
    })
    .slice(0, Math.max(request.limit, 1))
    .map<SkillRecallCandidate>(skill => ({
      skillId: skill.skillId,
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      aliases: skill.aliases,
      version: skill.version,
      sourceHash: skill.sourceHash,
      domain: skill.domain,
      departmentTags: skill.departmentTags,
      sceneTags: skill.sceneTags,
      skillPath: skill.skillPath,
      retrievalSource:
        (vectorScores.get(`${skill.skillId}\n${skill.version}\n${skill.sourceHash}`) ??
          0) > 0
          ? 'local_hybrid'
          : 'local_lexical',
      recallScore: skill.recallScore,
      recallScoreBreakdown: skill.recallScoreBreakdown,
      queryIntentKeys: skill.queryIntentKeys,
      queryDiscriminatorKeys: skill.queryDiscriminatorKeys,
      matchedIntentKeys: skill.matchedIntentKeys,
      matchedDiscriminatorKeys: skill.matchedDiscriminatorKeys,
    }))

  return {
    candidates,
    registryVersion: registryManifest.registryVersion,
    embeddingsGeneratedAt: embeddingsManifest?.generatedAt ?? null,
    vectorAvailable: vectorScores.size > 0,
  }
}
