import { mkdir, rm, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import YAML from 'yaml'
import {
  getGraphPreferenceCasesDir,
  RETRIEVAL_GRAPH_PREFERENCE_DATASET_ID,
} from '../src/evals/retrievalDatasets.js'
import { departmentForSkill } from '../src/evals/retrievalCaseFactory.js'
import { readGeneratedSkillRegistry } from '../src/registry/registry.js'
import type { SkillRegistryEntry } from '../src/registry/registry.js'
import type { SkillRetrievalEvalCase } from '../src/evals/types.js'

type GraphPreferenceVariant = {
  sequence: string
  title: string
  difficultyTag: 'difficulty:direct' | 'difficulty:adjacent'
  languageTag: 'lang:zh-pure' | 'lang:zh-mixed'
  queryText: string
  queryContext: string
}

type GraphPreferenceSpec = {
  slug: string
  sceneKey: string
  preferredSkillId: string
  competingSkillId: string
  projectId: string
  forbiddenSkillIds: string[]
  sceneHints: string[]
  variants: GraphPreferenceVariant[]
}

type GraphPreferenceExpansionProfile = {
  targetCount: number
  titleStem: string
  subject: string
  directScenes: string[]
  directGoals: string[]
  mixedTerms: string[]
  adjacentScenes: string[]
  adjacentGoals: string[]
  contrastTails: string[]
  contextTerms: string[]
  adjacentShare: number
}

const PROJECT_ROOT = resolve(process.cwd())
const DEFAULT_OUTPUT_DIR = getGraphPreferenceCasesDir(PROJECT_ROOT)

const GRAPH_PREFERENCE_SPECS: GraphPreferenceSpec[] = [
  {
    slug: 'frontend_homepage_preference',
    sceneKey: 'homepage',
    preferredSkillId: 'frontend/website-homepage-design-pro',
    competingSkillId: 'frontend/website-homepage-design-basic',
    projectId: 'seed:homepage-refresh',
    forbiddenSkillIds: [
      'frontend/marketing-landing-page',
      'frontend/docs-site-pro',
      'backend/backend-api-architecture',
    ],
    sceneHints: ['scene:homepage', 'scene:design'],
    variants: [
      {
        sequence: '001',
        title: '品牌官网首页优先选择正反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我想做一个品牌官网首页，强调高级感、转化结构和完整首屏叙事。',
        queryContext: '前端 官网首页 hero 品牌官网 转化结构 高级感',
      },
      {
        sequence: '002',
        title: '品牌官网首页在纯中文任务表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我们准备重做公司官网首页，希望首屏叙事完整、品牌感强，并且能清楚承接转化。',
        queryContext: '品牌官网首页 首屏叙事 品牌感 转化承接 页面结构',
      },
      {
        sequence: '003',
        title: '品牌站首屏改版在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '要把品牌站首屏、价值主张和 CTA 路径重新梳理，做成更像成熟大厂官网的首页体验。',
        queryContext: '品牌站 首屏 价值主张 CTA homepage 营销叙事',
      },
    ],
  },
  {
    slug: 'frontend_docs_preference',
    sceneKey: 'docs-site',
    preferredSkillId: 'frontend/docs-site-pro',
    competingSkillId: 'frontend/docs-site-basic',
    projectId: 'seed:docs-site',
    forbiddenSkillIds: [
      'frontend/website-homepage-design-pro',
      'backend/backend-api-architecture',
    ],
    sceneHints: ['scene:docs-site', 'scene:design'],
    variants: [
      {
        sequence: '001',
        title: '开发者文档站优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我想设计一个开发者文档站，要有侧栏、搜索、版本切换和示例展示。',
        queryContext: '前端 文档站 docs site 搜索 版本切换 API 示例',
      },
      {
        sequence: '002',
        title: '开发者文档站在纯中文表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我们要做一个开发者文档网站，重点是目录导航、站内搜索、版本切换和示例代码阅读体验。',
        queryContext: '开发者文档网站 导航 搜索 版本切换 示例代码 阅读体验',
      },
      {
        sequence: '003',
        title: '接口文档门户在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '想把 API 文档门户和接入说明做得更系统一些，要兼顾导航结构、示例展示和版本说明。',
        queryContext: 'API 文档 门户 接入说明 navigation examples versioning',
      },
    ],
  },
  {
    slug: 'frontend_component_library_preference',
    sceneKey: 'component-library',
    preferredSkillId: 'frontend/component-library-pro',
    competingSkillId: 'frontend/component-library-basic',
    projectId: 'seed:component-library',
    forbiddenSkillIds: [
      'frontend/website-homepage-design-pro',
      'backend/backend-api-architecture',
    ],
    sceneHints: ['scene:component-library', 'scene:design'],
    variants: [
      {
        sequence: '001',
        title: '组件库设计优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我想搭建一个企业级 component library，要有 tokens、variants、组件规范和可维护扩展能力。',
        queryContext: '前端 组件库 component library tokens variants 设计规范',
      },
      {
        sequence: '002',
        title: '组件库建设在纯中文表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我们要建设一套企业级组件库，希望统一设计令牌、组件规范、变体能力和长期维护方式。',
        queryContext: '企业级组件库 设计令牌 组件规范 变体能力 长期维护',
      },
      {
        sequence: '003',
        title: '前端规范化组件资产在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '需要把前端基础组件和设计令牌体系整理成可复用资产，后面还要支持规范治理和扩展。',
        queryContext: '前端基础组件 design tokens 规范治理 可复用资产',
      },
    ],
  },
  {
    slug: 'frontend_login_preference',
    sceneKey: 'login',
    preferredSkillId: 'frontend/auth-login-page-pro',
    competingSkillId: 'frontend/auth-login-page-basic',
    projectId: 'seed:auth-login-page',
    forbiddenSkillIds: [
      'frontend/component-library-pro',
      'security/security-best-practices',
    ],
    sceneHints: ['scene:login', 'scene:design'],
    variants: [
      {
        sequence: '001',
        title: '企业级登录页优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '设计一个企业级登录页，支持 SSO、异常态恢复、安全提示和账户访问说明。',
        queryContext: '前端 登录页 SSO sign in 安全提示 错误恢复',
      },
      {
        sequence: '002',
        title: '登录与身份接入页面在混合表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我想做一个企业登录入口，要覆盖 SSO、账号异常处理、sign-in 安全提示和访问说明。',
        queryContext: '企业登录 SSO sign-in 账号异常 安全提示 访问说明',
      },
      {
        sequence: '003',
        title: '统一身份登录入口在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '需要把统一身份登录入口重做一下，既要兼顾安全说明，也要照顾异常态和企业账号流程。',
        queryContext: '统一身份登录 安全说明 异常态 企业账号流程',
      },
    ],
  },
  {
    slug: 'frontend_settings_preference',
    sceneKey: 'settings',
    preferredSkillId: 'frontend/settings-page-pro',
    competingSkillId: 'frontend/settings-page-basic',
    projectId: 'seed:settings-page',
    forbiddenSkillIds: [
      'frontend/profile-account-page-pro',
      'backend/backend-api-architecture',
    ],
    sceneHints: ['scene:settings', 'scene:design'],
    variants: [
      {
        sequence: '001',
        title: '企业设置页优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我想设计一个企业级设置页，要有分组导航、复杂权限、表单状态和保存反馈。',
        queryContext: '前端 settings page 权限管理 分组导航 表单状态 保存反馈',
      },
      {
        sequence: '002',
        title: '复杂配置页在纯中文表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我们要做一个复杂配置页面，需要分组导航、权限差异、表单状态处理和清晰的保存反馈。',
        queryContext: '复杂配置页 分组导航 权限差异 表单状态 保存反馈',
      },
      {
        sequence: '003',
        title: '管理配置中心在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '想把后台配置中心做得更完整一些，重点是权限分层、配置分组和编辑保存体验。',
        queryContext: '后台配置中心 权限分层 配置分组 编辑保存 experience',
      },
    ],
  },
  {
    slug: 'frontend_pricing_preference',
    sceneKey: 'pricing',
    preferredSkillId: 'frontend/pricing-page-pro',
    competingSkillId: 'frontend/pricing-page-basic',
    projectId: 'seed:pricing-page',
    forbiddenSkillIds: [
      'frontend/contact-sales-page-pro',
      'backend/backend-api-architecture',
    ],
    sceneHints: ['scene:pricing', 'scene:design'],
    variants: [
      {
        sequence: '001',
        title: '定价页优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我想做一个 SaaS 定价页，突出套餐对比、升级引导、FAQ 和转化说明。',
        queryContext: '前端 pricing page 套餐对比 升级引导 FAQ 转化',
      },
      {
        sequence: '002',
        title: '套餐定价页面在纯中文表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我们要设计一个软件套餐定价页面，重点是方案对比、升级引导、常见问题和转化承接。',
        queryContext: '套餐定价页面 方案对比 升级引导 常见问题 转化承接',
      },
      {
        sequence: '003',
        title: '商业化套餐展示在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '要把商业化套餐展示做得更清晰，用户要能快速看懂不同方案、升级路径和购买理由。',
        queryContext: '商业化套餐 方案展示 upgrade path pricing conversion',
      },
    ],
  },
  {
    slug: 'frontend_search_results_preference',
    sceneKey: 'search-results',
    preferredSkillId: 'frontend/search-results-page-pro',
    competingSkillId: 'frontend/search-results-page-basic',
    projectId: 'seed:search-results-page',
    forbiddenSkillIds: [
      'frontend/data-table-pro',
      'backend/backend-api-architecture',
    ],
    sceneHints: ['scene:search-results', 'scene:design'],
    variants: [
      {
        sequence: '001',
        title: '搜索结果页优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我想设计一个搜索结果页，要支持筛选、排序、空状态和高信息密度展示。',
        queryContext: '前端 search results 筛选 排序 空状态 高信息密度',
      },
      {
        sequence: '002',
        title: '检索结果列表在纯中文表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我们要做一个检索结果列表页面，需要支持筛选条件、排序方式、空状态和高密度信息展示。',
        queryContext: '检索结果列表 筛选条件 排序方式 空状态 高密度信息',
      },
      {
        sequence: '003',
        title: '带筛选的结果页在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '想把结果页做得更专业一点，列表要支持 filters、排序、无结果提示和高密度浏览。',
        queryContext: '结果页 filters 排序 无结果提示 高密度浏览',
      },
    ],
  },
  {
    slug: 'frontend_responsive_navigation_preference',
    sceneKey: 'navigation',
    preferredSkillId: 'frontend/responsive-navigation-pro',
    competingSkillId: 'frontend/responsive-navigation-basic',
    projectId: 'seed:responsive-navigation',
    forbiddenSkillIds: [
      'frontend/component-library-pro',
      'backend/backend-api-architecture',
    ],
    sceneHints: ['scene:navigation', 'scene:design'],
    variants: [
      {
        sequence: '001',
        title: '响应式导航优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我想设计一个响应式导航栏，覆盖桌面端、移动端、二级菜单和吸顶交互。',
        queryContext: '前端 responsive navigation 桌面端 移动端 二级菜单 吸顶交互',
      },
      {
        sequence: '002',
        title: '自适应导航栏在纯中文表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我们要设计一个自适应导航栏，需要同时处理桌面端、移动端、二级菜单和吸顶交互。',
        queryContext: '自适应导航栏 桌面端 移动端 二级菜单 吸顶交互',
      },
      {
        sequence: '003',
        title: '站点导航体系在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '想把站点主导航重做一下，重点是 desktop/mobile 切换、多层菜单和顶部悬停体验。',
        queryContext: '站点主导航 desktop mobile 多层菜单 顶部悬停',
      },
    ],
  },
  {
    slug: 'frontend_developer_portal_preference',
    sceneKey: 'developer-portal',
    preferredSkillId: 'frontend/developer-portal-pro',
    competingSkillId: 'frontend/developer-portal-basic',
    projectId: 'seed:developer-portal',
    forbiddenSkillIds: [
      'frontend/docs-site-pro',
      'backend/backend-api-architecture',
    ],
    sceneHints: ['scene:developer-portal', 'scene:design'],
    variants: [
      {
        sequence: '001',
        title: '开发者门户优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我想设计一个开发者门户，要有 API 导航、接入文档、示例代码和清晰的信息架构。',
        queryContext: '前端 developer portal API 导航 接入文档 示例代码 信息架构',
      },
      {
        sequence: '002',
        title: '开发者接入门户在纯中文表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我们要做一个开发者接入门户，重点是接口导航、接入指引、示例代码和信息架构清晰。',
        queryContext: '开发者接入门户 接口导航 接入指引 示例代码 信息架构',
      },
      {
        sequence: '003',
        title: '对外接入站点在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '需要做一个面向外部开发者的接入站点，既要有 onboarding，也要有 API 导航和示例阅读体验。',
        queryContext: '外部开发者 接入站点 onboarding API navigation examples',
      },
    ],
  },
  {
    slug: 'frontend_design_system_preference',
    sceneKey: 'design-system',
    preferredSkillId: 'frontend/design-system-builder-pro',
    competingSkillId: 'frontend/design-system-builder-basic',
    projectId: 'seed:design-system-builder',
    forbiddenSkillIds: [
      'frontend/component-library-pro',
      'backend/backend-api-architecture',
    ],
    sceneHints: ['scene:design-system', 'scene:design'],
    variants: [
      {
        sequence: '001',
        title: '设计系统建设优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我想搭建一套企业级设计系统，要覆盖 design tokens、组件规范、发布流程和协作治理。',
        queryContext: '前端 design system tokens 组件规范 发布流程 协作治理',
      },
      {
        sequence: '002',
        title: '企业设计系统在纯中文表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我们要建设一套企业设计系统，希望同时覆盖设计令牌、组件规则、发布流程和协作治理。',
        queryContext: '企业设计系统 设计令牌 组件规则 发布流程 协作治理',
      },
      {
        sequence: '003',
        title: '设计治理体系在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '想把设计治理体系做完整，不只是组件，还要包括 tokens、发布机制和跨团队协作规则。',
        queryContext: '设计治理体系 tokens 发布机制 跨团队协作 design system',
      },
    ],
  },
  {
    slug: 'ai_humanizer_preference',
    sceneKey: 'humanizer',
    preferredSkillId: 'ai/humanizer-zh-pro',
    competingSkillId: 'ai/humanizer-zh-basic',
    projectId: 'seed:humanizer-zh',
    forbiddenSkillIds: ['design/motion-video-maker', 'design/ppt-maker'],
    sceneHints: ['scene:writing', 'scene:content-generation'],
    variants: [
      {
        sequence: '001',
        title: '去 AI 味文案优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '把这段中文 AI 文案改得更像人写的，去掉 AI 味，但保留信息完整和自然语气。',
        queryContext: '中文文案 去 AI 味 自然表达 润色 humanizer',
      },
      {
        sequence: '002',
        title: '中文润稿去模型腔在混合表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '帮我把这篇中文稿子润成更自然的人类表达，减少模型腔，但不要丢信息密度和语气层次。',
        queryContext: '中文稿子 润稿 human-like tone 信息密度 语气层次',
      },
      {
        sequence: '003',
        title: '发布前润色改写在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '这篇准备发布的中文内容需要做一轮 rewrite，让表达更自然、更像真人写作，同时保持信息边界。',
        queryContext: '发布前内容 rewrite 中文自然表达 真人写作 信息边界',
      },
    ],
  },
  {
    slug: 'general_development_plan_preference',
    sceneKey: 'planning',
    preferredSkillId: 'general/development-plan-doc-pro',
    competingSkillId: 'general/development-plan-doc-basic',
    projectId: 'seed:development-plan-doc',
    forbiddenSkillIds: [
      'backend/backend-api-architecture',
      'frontend/website-homepage-design-pro',
    ],
    sceneHints: ['scene:planning', 'scene:architecture'],
    variants: [
      {
        sequence: '001',
        title: '开发计划文档优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '帮我输出一份完整 development plan，包含里程碑、资源拆分、风险和验收标准。',
        queryContext: '开发计划文档 planning 里程碑 风险 资源拆分 验收标准',
      },
      {
        sequence: '002',
        title: '项目开发计划在纯中文表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '先不要写代码，先帮我整理一份项目开发计划，内容包括里程碑、资源安排、风险和验收标准。',
        queryContext: '项目开发计划 里程碑 资源安排 风险 验收标准',
      },
      {
        sequence: '003',
        title: '功能推进方案在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我们准备推进一个中型功能迭代，先需要一份 execution plan，把阶段目标、资源、风险和交付界线梳理清楚。',
        queryContext: 'execution plan 阶段目标 资源 风险 交付界线',
      },
    ],
  },
  {
    slug: 'review_risk_code_review_preference',
    sceneKey: 'review',
    preferredSkillId: 'review/code-review-risk-based',
    competingSkillId: 'review/code-review-general',
    projectId: 'seed:code-review-risk',
    forbiddenSkillIds: [
      'general/bug-fix-debugging',
      'backend/rest-api-implementation',
    ],
    sceneHints: ['scene:review', 'scene:architecture'],
    variants: [
      {
        sequence: '001',
        title: '高风险代码审查优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '请对一组高风险代码变更做 review，重点看权限、回滚、边界条件、可观测性和潜在爆炸半径。',
        queryContext: '高风险代码审查 权限 回滚 边界条件 可观测性 爆炸半径',
      },
      {
        sequence: '002',
        title: '风险导向代码评审在混合表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '这次 diff 风险比较高，麻烦做一轮 risk-based code review，重点盯 auth、rollback、observability 和 edge cases。',
        queryContext: 'risk-based code review auth rollback observability edge cases',
      },
      {
        sequence: '003',
        title: '高风险变更评审在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '这批变更牵涉公共接口和权限控制，想先做一轮更偏风险视角的审查，确认不会留下大的回滚和监控盲点。',
        queryContext: '公共接口 权限控制 风险视角审查 回滚 监控盲点',
      },
    ],
  },
  {
    slug: 'backend_performance_preference',
    sceneKey: 'performance',
    preferredSkillId: 'backend/backend-performance-profiling',
    competingSkillId: 'backend/background-jobs-queues',
    projectId: 'seed:backend-performance',
    forbiddenSkillIds: [
      'backend/rest-api-implementation',
      'review/code-review-general',
    ],
    sceneHints: ['scene:debug', 'scene:performance'],
    variants: [
      {
        sequence: '001',
        title: '慢接口性能排查优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我要排查后端慢接口，先做 profiling，再找出热点链路、慢查询和真正的性能瓶颈。',
        queryContext: '后端慢接口 profiling 热点链路 慢查询 性能瓶颈',
      },
      {
        sequence: '002',
        title: '延迟热点分析在混合表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '线上 API latency 很高，想先做 performance profiling，把 hot path、CPU 和 query hotspot 定位出来。',
        queryContext: 'API latency performance profiling hot path CPU query hotspot',
      },
      {
        sequence: '003',
        title: '后端热点诊断在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '现在不是单纯修 bug，而是要搞清楚请求链路为什么越来越慢，最好能用证据把性能问题拆清楚。',
        queryContext: '请求链路 越来越慢 证据 性能问题 profiling',
      },
    ],
  },
  {
    slug: 'backend_background_jobs_preference',
    sceneKey: 'architecture',
    preferredSkillId: 'backend/background-jobs-queues',
    competingSkillId: 'backend/rest-api-implementation',
    projectId: 'seed:background-jobs',
    forbiddenSkillIds: [
      'backend/backend-api-architecture',
      'review/code-review-general',
    ],
    sceneHints: ['scene:architecture', 'scene:debug'],
    variants: [
      {
        sequence: '001',
        title: '异步任务与队列问题优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我要排查队列 worker 的重试、幂等、积压和异步任务处理问题，并梳理稳定性方案。',
        queryContext: '队列 worker 重试 幂等 积压 异步任务 稳定性方案',
      },
      {
        sequence: '002',
        title: '后台任务链路排查在混合表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '帮我处理 queue / worker 的 retry、idempotency、backlog 和 async workflow 问题，最好兼顾 observability。',
        queryContext: 'queue worker retry idempotency backlog async workflow observability',
      },
      {
        sequence: '003',
        title: '异步执行链路治理在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我们现在更像是后台任务链路不稳，想先把重试、积压和执行一致性这些问题理顺，而不是只写几个接口。',
        queryContext: '后台任务链路 重试 积压 执行一致性 接口 background jobs',
      },
    ],
  },
  {
    slug: 'security_vulnerability_review_preference',
    sceneKey: 'security-audit',
    preferredSkillId: 'security/security-vulnerability-check',
    competingSkillId: 'security/security-best-practices',
    projectId: 'seed:security-vulnerability-review',
    forbiddenSkillIds: [
      'review/code-review-general',
      'backend/auth-authorization-backend',
    ],
    sceneHints: ['scene:security-audit', 'scene:review'],
    variants: [
      {
        sequence: '001',
        title: '应用安全漏洞审查优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '请对这段后端代码做安全漏洞审查，重点看鉴权、输入校验、敏感数据暴露和可利用问题。',
        queryContext: '安全漏洞审查 鉴权 输入校验 敏感数据暴露 可利用问题',
      },
      {
        sequence: '002',
        title: '应用安全检查在混合表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '帮我做一轮 application security review，重点查 auth、input validation、data exposure 和 exploitable flaws。',
        queryContext: 'application security review auth input validation data exposure exploitable flaws',
      },
      {
        sequence: '003',
        title: '安全风险排查在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我不是只想听安全建议，而是想知道这段实现里有没有真正可能被打出来的问题和风险路径。',
        queryContext: '不是安全建议 真正可利用问题 风险路径 exploitable',
      },
    ],
  },
  {
    slug: 'security_dependency_audit_preference',
    sceneKey: 'security-audit',
    preferredSkillId: 'security/dependency-supply-chain-audit',
    competingSkillId: 'security/security-vulnerability-check',
    projectId: 'seed:dependency-audit',
    forbiddenSkillIds: [
      'review/code-review-general',
      'backend/auth-authorization-backend',
    ],
    sceneHints: ['scene:security-audit', 'scene:review'],
    variants: [
      {
        sequence: '001',
        title: '依赖供应链审查优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '请审查项目依赖和供应链风险，重点看 lockfile、CVE、恶意包、许可证和升级安全性。',
        queryContext: '依赖审查 供应链风险 lockfile CVE 恶意包 许可证 升级安全',
      },
      {
        sequence: '002',
        title: '依赖安全核查在混合表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '帮我做一轮 dependency audit，重点看 vulnerable packages、lockfile integrity、license risk 和 update safety。',
        queryContext: 'dependency audit vulnerable packages lockfile integrity license risk update safety',
      },
      {
        sequence: '003',
        title: '供应链风险排查在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我更关心外部包和版本链路会不会把风险带进来，想先把依赖层面的隐患摸清楚。',
        queryContext: '外部包 版本链路 风险 依赖层面 隐患 supply chain',
      },
    ],
  },
  {
    slug: 'tools_playwright_interactive_preference',
    sceneKey: 'debug',
    preferredSkillId: 'tools/playwright-interactive',
    competingSkillId: 'tools/playwright',
    projectId: 'seed:playwright-interactive',
    forbiddenSkillIds: [
      'tools/screenshot',
      'frontend/component-library-pro',
    ],
    sceneHints: ['scene:debug', 'scene:test'],
    variants: [
      {
        sequence: '001',
        title: '持续交互式 UI 调试优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我要持续交互式调试一个页面流程，希望保留浏览器状态，反复检查表单、弹窗和异常态。',
        queryContext: '持续交互式调试 保留浏览器状态 表单 弹窗 异常态',
      },
      {
        sequence: '002',
        title: '持久浏览器调试在混合表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '想用 persistent browser 做一轮 iterative UI debugging，需要反复点流程、看状态变化和交互问题。',
        queryContext: 'persistent browser iterative UI debugging 状态变化 交互问题',
      },
      {
        sequence: '003',
        title: '多轮界面排查在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '这次不是一次性自动跑流程，而是要一边保留页面上下文一边多轮排查交互问题。',
        queryContext: '不是一次性自动流程 保留页面上下文 多轮排查 交互问题',
      },
    ],
  },
  {
    slug: 'tools_spreadsheet_preference',
    sceneKey: 'data-analysis',
    preferredSkillId: 'tools/spreadsheet',
    competingSkillId: 'tools/doc',
    projectId: 'seed:operations-spreadsheet',
    forbiddenSkillIds: [
      'design/ppt-maker',
      'tools/pdf',
    ],
    sceneHints: ['scene:data-analysis', 'scene:content-generation'],
    variants: [
      {
        sequence: '001',
        title: '运营数据表分析优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '我要整理运营数据表，做渠道投放分析、透视汇总和结构化表格输出，方便后续复盘。',
        queryContext: '运营数据表 渠道投放分析 透视汇总 结构化表格 输出',
      },
      {
        sequence: '002',
        title: '渠道表格分析在混合表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '帮我把投放数据整理成可继续编辑的表格，做透视、汇总和运营分析输出。',
        queryContext: '可继续编辑的表格 透视 汇总 运营分析 输出',
      },
      {
        sequence: '003',
        title: '增长数据整理在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我需要把一堆增长数据先梳理成能继续算和复盘的表格，不只是写一份说明文档。',
        queryContext: '增长数据 梳理 继续算 复盘 表格 说明文档',
      },
    ],
  },
  {
    slug: 'design_ppt_maker_preference',
    sceneKey: 'content-generation',
    preferredSkillId: 'design/ppt-maker',
    competingSkillId: 'design/ppt-course-presentation',
    projectId: 'seed:operations-ppt',
    forbiddenSkillIds: [
      'design/motion-video-maker',
      'tools/spreadsheet',
    ],
    sceneHints: ['scene:content-generation', 'scene:design'],
    variants: [
      {
        sequence: '001',
        title: '运营汇报 PPT 优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '根据这份运营复盘材料生成完整 PPT，要有清晰故事线、逐页结构和适合汇报的视觉表达。',
        queryContext: '运营复盘材料 生成完整 PPT 清晰故事线 逐页结构 汇报视觉',
      },
      {
        sequence: '002',
        title: '业务汇报 deck 在混合表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '把这份业务材料整理成可汇报的 deck，要自动出大纲、页面布局和 presentation narrative。',
        queryContext: 'deck 自动出大纲 页面布局 presentation narrative',
      },
      {
        sequence: '003',
        title: '复盘演示文稿在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我想把复盘内容整理成能直接拿去讲的演示文稿，不只是几页课堂风格的展示材料。',
        queryContext: '复盘内容 演示文稿 直接拿去讲 课堂风格展示材料',
      },
    ],
  },
  {
    slug: 'design_motion_video_preference',
    sceneKey: 'content-generation',
    preferredSkillId: 'design/motion-video-maker',
    competingSkillId: 'design/jimeng',
    projectId: 'seed:motion-video',
    forbiddenSkillIds: [
      'design/ppt-maker',
      'tools/pdf',
    ],
    sceneHints: ['scene:content-generation', 'scene:design'],
    variants: [
      {
        sequence: '001',
        title: '讲解动画视频优先选择反馈更强的候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText:
          '根据这段运营脚本生成讲解动画视频，要有镜头节奏、字幕强化、转场和口播配套动效。',
        queryContext: '运营脚本 讲解动画视频 镜头节奏 字幕强化 转场 口播动效',
      },
      {
        sequence: '002',
        title: '口播配套动效视频在混合表达下仍应优先选择优质候选',
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-mixed',
        queryText:
          '想根据文案做一个 explainer motion video，要有字幕、镜头切换和配合 narration 的动画节奏。',
        queryContext: 'explainer motion video subtitles narration 动画节奏 镜头切换',
      },
      {
        sequence: '003',
        title: '内容讲解短视频在相邻表述下仍应优先选择优质候选',
        difficultyTag: 'difficulty:adjacent',
        languageTag: 'lang:zh-mixed',
        queryText:
          '我不是要单张图片，而是想把一段讲解内容做成可以预览和导出的动态视频表达。',
        queryContext: '不是单张图片 讲解内容 动态视频 预览 导出',
      },
    ],
  },
]

const GRAPH_PREFERENCE_EXPANSION_PROFILES: Record<
  GraphPreferenceSpec['slug'],
  GraphPreferenceExpansionProfile
> = {
  frontend_homepage_preference: {
    targetCount: 20,
    titleStem: '官网首页偏好',
    subject: '品牌官网首页',
    directScenes: [
      '这次公司官网改版',
      '品牌升级项目启动了',
      '市场部想把主站首页重做一遍',
      '官网首屏准备重新设计',
    ],
    directGoals: [
      '首屏叙事、价值主张和 CTA 承接更完整',
      '品牌感、模块节奏和转化路径更成熟',
      'hero 信息层级、信任证明和首屏动作更清楚',
      '首页结构、内容节奏和转化动线更像成熟大厂',
    ],
    mixedTerms: ['brand homepage', 'hero + CTA', 'conversion homepage'],
    adjacentScenes: [
      '现在更像是官网首页体验太散',
      '业务方觉得品牌站首屏说不清价值',
      '这轮不是做活动页而是补完整官网首页',
      '首页改完还是不像成熟官网',
    ],
    adjacentGoals: [
      '把品牌表达、模块排序和转化承接理顺',
      '把首屏卖点、信任证明和 CTA 路径拉顺',
      '把首页叙事、价值说明和首屏结构做完整',
      '把官网首页的节奏、视觉重心和转化入口补齐',
    ],
    contrastTails: [
      '不是只拼几个营销模块',
      '不是简单做个 landing page',
      '不是内部后台页面',
      '不是随便排版一个首页',
    ],
    contextTerms: ['官网首页', '品牌站', '首屏', 'hero', 'CTA', '品牌感', '转化结构'],
    adjacentShare: 0.34,
  },
  frontend_docs_preference: {
    targetCount: 20,
    titleStem: '文档站偏好',
    subject: '开发者文档站',
    directScenes: [
      '这次要补一套开发者文档门户',
      '平台侧准备重做文档站',
      '外部接入文档需要系统化升级',
      '开发者文档网站要重新搭框架',
    ],
    directGoals: [
      '侧栏导航、站内搜索和版本切换更清晰',
      'API 文档、示例代码和接入说明更好读',
      '信息架构、目录层级和阅读体验更成熟',
      '文档检索、示例展示和 onboarding 更完整',
    ],
    mixedTerms: ['docs portal', 'developer docs', 'API documentation'],
    adjacentScenes: [
      '现在不是单页说明文档能解决的问题',
      '接入资料越来越多但导航很乱',
      '外部开发者经常找不到入口',
      '文档站现在更像资料堆砌',
    ],
    adjacentGoals: [
      '把导航结构、搜索和版本说明理顺',
      '把接入指引、示例代码和 API 阅读体验做完整',
      '把文档门户的信息分层和入口路径拉清楚',
      '把目录结构、站内搜索和代码示例串起来',
    ],
    contrastTails: [
      '不是只补几篇接口说明',
      '不是单纯做官网宣传页',
      '不是只扔一堆 markdown',
      '不是随手拼一个静态页',
    ],
    contextTerms: ['文档站', '开发者文档', 'API', '搜索', '版本切换', '接入说明'],
    adjacentShare: 0.34,
  },
  frontend_component_library_preference: {
    targetCount: 20,
    titleStem: '组件库偏好',
    subject: '企业级组件库',
    directScenes: [
      '设计和前端想统一基础组件资产',
      '团队准备建设内部组件库',
      '这次要把 UI 基础设施补起来',
      '组件规范和资产治理要一起推进',
    ],
    directGoals: [
      'tokens、variants 和组件规范可长期维护',
      '基础组件、设计令牌和扩展机制更系统',
      '组件复用、约束规则和发布方式更完整',
      '规范治理、设计令牌和可维护扩展能力更成熟',
    ],
    mixedTerms: ['component library', 'design tokens', 'UI foundation'],
    adjacentScenes: [
      '现在组件各写各的很散',
      'UI 资产一直在重复造轮子',
      '这轮不只是补几个按钮组件',
      '团队想做一套能长期维护的组件体系',
    ],
    adjacentGoals: [
      '把基础组件、tokens 和规则统一下来',
      '把设计令牌、变体能力和扩展边界理顺',
      '把组件资产、发布节奏和治理方式补齐',
      '把复用能力、规范约束和协作流程落到位',
    ],
    contrastTails: [
      '不是只做一个 demo 页面',
      '不是临时抄几份组件代码',
      '不是单个页面的局部样式修补',
      '不是只整理视觉稿',
    ],
    contextTerms: ['组件库', 'design tokens', 'variants', '规范治理', '复用', '基础组件'],
    adjacentShare: 0.34,
  },
  frontend_login_preference: {
    targetCount: 20,
    titleStem: '登录页偏好',
    subject: '企业登录页',
    directScenes: [
      '这次统一身份入口要重做',
      '账号接入页面需要升级',
      '企业登录入口准备重新设计',
      'SSO 登录流程要补完整',
    ],
    directGoals: [
      'SSO、异常态恢复和安全提示更清楚',
      '登录流程、账户说明和错误反馈更成熟',
      '身份接入、访问说明和异常处理更完整',
      'sign-in 体验、安全提醒和企业账号流程更顺',
    ],
    mixedTerms: ['sign-in flow', 'SSO login', 'identity access'],
    adjacentScenes: [
      '这次不是普通表单页而是企业登录入口',
      '登录链路现在问题主要在异常态和账号说明',
      '统一身份入口看起来太像简易 demo',
      '访问入口缺少企业账号和安全说明',
    ],
    adjacentGoals: [
      '把 SSO、异常处理和安全提醒补齐',
      '把登录流程、身份说明和错误反馈拉顺',
      '把企业账号访问路径和恢复机制理清楚',
      '把 sign-in 的关键状态和提示体系做完整',
    ],
    contrastTails: [
      '不是只做一张输入框页面',
      '不是后台配置页',
      '不是随便拼个 auth 表单',
      '不是只追求好看',
    ],
    contextTerms: ['登录页', 'SSO', '身份入口', '异常态', '安全提示', 'sign-in'],
    adjacentShare: 0.34,
  },
  frontend_settings_preference: {
    targetCount: 20,
    titleStem: '设置页偏好',
    subject: '企业设置页',
    directScenes: [
      '后台配置中心准备重构',
      '复杂设置页面需要重新梳理',
      '管理端配置页要补完整',
      '企业配置中心要做一版升级',
    ],
    directGoals: [
      '分组导航、权限差异和保存反馈更清晰',
      '复杂表单状态、配置分层和操作回执更成熟',
      '设置分组、编辑流程和权限说明更完整',
      '配置中心的信息层级、状态提示和保存体验更顺',
    ],
    mixedTerms: ['settings center', 'admin settings', 'configuration flow'],
    adjacentScenes: [
      '这轮更像是配置中心难用',
      '后台设置不是简单资料页',
      '配置项越来越多但层级很乱',
      '用户最常抱怨的是配置修改和保存体验',
    ],
    adjacentGoals: [
      '把权限分层、配置分组和保存反馈理顺',
      '把复杂表单状态、差异权限和编辑流程补齐',
      '把设置导航、状态提示和回执体验做完整',
      '把配置管理里的层级和操作闭环拉清楚',
    ],
    contrastTails: [
      '不是做账号资料页',
      '不是普通内容展示页',
      '不是只加几个表单项',
      '不是简单后台列表页',
    ],
    contextTerms: ['设置页', '配置中心', '权限分层', '保存反馈', '复杂表单', '分组导航'],
    adjacentShare: 0.34,
  },
  frontend_pricing_preference: {
    targetCount: 20,
    titleStem: '定价页偏好',
    subject: 'SaaS 定价页',
    directScenes: [
      '商业化团队要上线新套餐页',
      'SaaS 套餐页面准备改版',
      '官网商业化信息要重新梳理',
      '这轮想重做 pricing 页面',
    ],
    directGoals: [
      '套餐对比、升级引导和 FAQ 更清楚',
      '方案差异、购买路径和转化承接更成熟',
      '定价结构、权益说明和升级动线更完整',
      'pricing 信息层级、对比关系和 CTA 更顺',
    ],
    mixedTerms: ['pricing page', 'plan comparison', 'upgrade path'],
    adjacentScenes: [
      '现在更像是商业化说不清',
      '用户看不懂不同套餐差别',
      '这次不是介绍页而是转化导向的定价页',
      '套餐结构现在撑不起销售转化',
    ],
    adjacentGoals: [
      '把方案对比、升级路径和 FAQ 做顺',
      '把权益说明、购买理由和转化承接理顺',
      '把套餐层级、CTA 和升级引导补完整',
      '把定价逻辑、差异表达和购买动线拉清楚',
    ],
    contrastTails: [
      '不是纯宣传页',
      '不是客服联系方式页面',
      '不是只列一张价格表',
      '不是活动海报式页面',
    ],
    contextTerms: ['定价页', 'pricing', '套餐对比', '升级引导', 'FAQ', '转化'],
    adjacentShare: 0.34,
  },
  frontend_search_results_preference: {
    targetCount: 20,
    titleStem: '搜索结果页偏好',
    subject: '搜索结果页',
    directScenes: [
      '站内检索结果页准备重做',
      '搜索结果体验要升级',
      '内容检索页面需要重新设计',
      '这次想把结果列表做专业一些',
    ],
    directGoals: [
      '筛选、排序和空状态更完整',
      '高信息密度展示和浏览效率更成熟',
      '结果列表、filters 和排序逻辑更清晰',
      '查询结果的空态、筛选区和列表结构更顺',
    ],
    mixedTerms: ['search results', 'filter + sort', 'result listing'],
    adjacentScenes: [
      '现在结果页只能凑合用',
      '用户抱怨结果列表太乱',
      '这轮不是做表格页而是检索结果体验',
      '筛选和排序现在撑不起检索任务',
    ],
    adjacentGoals: [
      '把筛选、排序和无结果提示理顺',
      '把高密度列表、浏览效率和结果结构补齐',
      '把 filters、result list 和空状态做完整',
      '把结果页的信息组织和交互闭环拉清楚',
    ],
    contrastTails: [
      '不是简单后台列表',
      '不是普通表格管理页',
      '不是只有一个搜索框',
      '不是营销展示页',
    ],
    contextTerms: ['搜索结果页', 'filters', '排序', '空状态', '高密度', 'result list'],
    adjacentShare: 0.34,
  },
  frontend_responsive_navigation_preference: {
    targetCount: 20,
    titleStem: '导航栏偏好',
    subject: '响应式导航栏',
    directScenes: [
      '站点主导航需要重做',
      '官网导航体验准备升级',
      '桌面端和移动端导航要统一一版',
      '主导航交互需要系统化补齐',
    ],
    directGoals: [
      '桌面端、移动端和多层菜单更顺',
      '吸顶交互、二级菜单和切换体验更成熟',
      'desktop/mobile 导航切换和层级组织更完整',
      '导航入口、菜单结构和交互反馈更清晰',
    ],
    mixedTerms: ['responsive navigation', 'desktop/mobile nav', 'sticky navbar'],
    adjacentScenes: [
      '现在站点导航很容易迷路',
      '多层菜单和移动端切换都不顺',
      '这轮不是做内容页而是补导航体系',
      '用户主要抱怨菜单层级和悬停体验',
    ],
    adjacentGoals: [
      '把 desktop/mobile 导航和多层菜单理顺',
      '把吸顶、展开和层级切换补完整',
      '把主导航入口、菜单组织和反馈状态做对',
      '把导航体系的结构感和操作路径拉清楚',
    ],
    contrastTails: [
      '不是普通 header 装饰',
      '不是只画一排链接',
      '不是后台表单页',
      '不是单页布局修补',
    ],
    contextTerms: ['导航栏', 'responsive', 'desktop', 'mobile', '二级菜单', '吸顶'],
    adjacentShare: 0.34,
  },
  frontend_developer_portal_preference: {
    targetCount: 20,
    titleStem: '开发者门户偏好',
    subject: '开发者门户',
    directScenes: [
      '外部开发者接入站点要重做',
      '生态团队想搭一套开发者门户',
      '对外接入资料需要做成门户化体验',
      '开发者 onboarding 入口准备升级',
    ],
    directGoals: [
      'API 导航、接入文档和示例代码更完整',
      '开发者 onboarding、资料入口和信息架构更成熟',
      '接入说明、导航结构和代码示例更清晰',
      'developer portal 的内容组织和查找路径更顺',
    ],
    mixedTerms: ['developer portal', 'onboarding hub', 'API onboarding'],
    adjacentScenes: [
      '现在对外接入资料太碎',
      '开发者总是找不到正确入口',
      '这轮不是单纯文档页而是门户化接入站点',
      '接入路径和资料结构现在支撑不了生态增长',
    ],
    adjacentGoals: [
      '把 API 导航、接入路径和示例阅读体验理顺',
      '把 onboarding、资料入口和信息层级补完整',
      '把开发者门户的检索、导航和示例体系做对',
      '把接入站点的主路径、示例和文档关系拉清楚',
    ],
    contrastTails: [
      '不是官网宣传页',
      '不是只列几个下载链接',
      '不是简单资料集合',
      '不是内部管理后台',
    ],
    contextTerms: ['开发者门户', 'API 导航', 'onboarding', '接入文档', '示例代码', '信息架构'],
    adjacentShare: 0.34,
  },
  frontend_design_system_preference: {
    targetCount: 20,
    titleStem: '设计系统偏好',
    subject: '企业设计系统',
    directScenes: [
      '设计与前端要联合建设设计系统',
      '这轮想把 design system 正式搭起来',
      '跨团队 UI 治理需要一套设计系统',
      '设计资产和组件规范要统一建设',
    ],
    directGoals: [
      '设计令牌、组件规则和发布流程更成熟',
      'tokens、治理规则和协作机制更完整',
      '组件规范、发布节奏和跨团队协作更清晰',
      'design system 的治理、资产和演进方式更顺',
    ],
    mixedTerms: ['design system', 'token governance', 'UI governance'],
    adjacentScenes: [
      '现在更像是规范散落各处',
      '这轮不只是补几个组件',
      '协作过程中缺少统一 design system 边界',
      '资产治理和发布机制现在都不成体系',
    ],
    adjacentGoals: [
      '把 tokens、组件规则和协作边界理顺',
      '把设计资产、发布流程和治理机制补完整',
      '把跨团队 UI 规范和演进方式做对',
      '把设计系统里的约束、资产和协作闭环拉清楚',
    ],
    contrastTails: [
      '不是单页 UI 修改',
      '不是只整理视觉稿',
      '不是局部样式修补',
      '不是临时性组件堆积',
    ],
    contextTerms: ['设计系统', 'tokens', '治理', '组件规范', '发布流程', '协作'],
    adjacentShare: 0.34,
  },
  ai_humanizer_preference: {
    targetCount: 20,
    titleStem: '中文去 AI 味偏好',
    subject: '中文去 AI 味润稿',
    directScenes: [
      '发公众号前要润一版中文稿子',
      '运营内容准备上线前需要再打磨',
      '这篇对外发布文章现在模型味太重',
      '老板看稿时觉得语言不够像真人',
    ],
    directGoals: [
      '表达更自然、保留信息密度和语气层次',
      '减少模型腔、保留原意和逻辑结构',
      '更像人写的中文，但不丢关键信息',
      '自然润色、去 AI 味和语气收束更成熟',
    ],
    mixedTerms: ['humanize rewrite', 'human-like tone', 'rewrite polish'],
    adjacentScenes: [
      '这轮不是重写观点而是润表达',
      '内容本身没问题，主要是文字太像模型生成',
      '发布前最后一轮只想把中文语气修顺',
      '读起来不假，但还是不够像真人写的',
    ],
    adjacentGoals: [
      '把语气、节奏和措辞拉自然',
      '把模型腔、模板味和重复表达压下去',
      '把文章的中文感、真实感和边界感做对',
      '把 rewrite 后的自然度和信息完整性兼顾住',
    ],
    contrastTails: [
      '不是生成新文章',
      '不是做 PPT 大纲',
      '不是写视频脚本',
      '不是改业务逻辑',
    ],
    contextTerms: ['中文润稿', '去 AI 味', '自然表达', 'human-like', '语气层次', 'rewrite'],
    adjacentShare: 0.34,
  },
  general_development_plan_preference: {
    targetCount: 19,
    titleStem: '开发计划偏好',
    subject: '项目开发计划',
    directScenes: [
      '新功能立项前要先出实施计划',
      '这轮先不写代码，先做项目计划',
      '中型功能推进需要一份正式 plan',
      '团队要先把交付路线拉清楚',
    ],
    directGoals: [
      '里程碑、资源拆分和风险控制更完整',
      '阶段目标、依赖关系和验收标准更成熟',
      '执行路径、排期和交付边界更清楚',
      'development plan 的节奏、资源和风险说明更顺',
    ],
    mixedTerms: ['development plan', 'execution plan', 'delivery roadmap'],
    adjacentScenes: [
      '现在不是要讨论架构细节，而是先把推进方案定下来',
      '功能能做，但计划拆分还很乱',
      '这轮最缺的是交付路线和阶段边界',
      '团队先需要一份能指导推进的 plan',
    ],
    adjacentGoals: [
      '把阶段目标、资源安排和风险管理理顺',
      '把 milestones、owners 和 acceptance 补完整',
      '把实施节奏、依赖项和验收闭环做对',
      '把 execution plan 的边界、顺序和责任拉清楚',
    ],
    contrastTails: [
      '不是直接输出代码方案',
      '不是只看某个接口实现',
      '不是写 PR 审查意见',
      '不是官网设计任务',
    ],
    contextTerms: ['开发计划', '里程碑', '资源拆分', '风险', '验收标准', 'execution plan'],
    adjacentShare: 0.34,
  },
  review_risk_code_review_preference: {
    targetCount: 27,
    titleStem: '高风险评审偏好',
    subject: '高风险代码评审',
    directScenes: [
      '这次 PR 动了权限和公共接口',
      '发版前有一批高风险 diff 需要过审',
      '核心链路改动比较重，先做风险审查',
      '这组变更的潜在爆炸半径不小',
    ],
    directGoals: [
      '权限、回滚路径和边界条件看透',
      '可观测性、失败路径和兼容性检查完整',
      '公共接口、授权逻辑和回滚方案更清楚',
      '爆炸半径、风险点和监控盲区定位出来',
    ],
    mixedTerms: ['risk-based review', 'high-risk diff', 'rollback + observability'],
    adjacentScenes: [
      '这轮不是普通 code review',
      '主要担心 auth、rollback 和 edge cases',
      '评审重点不是代码风格，而是上线风险',
      '现在更像是要先拦住危险变更',
    ],
    adjacentGoals: [
      '把权限、回滚和失败路径先查清楚',
      '把爆炸半径、可观测性和边界条件理顺',
      '把高风险 diff 的主风险和监控盲点挖出来',
      '把上线前最容易出事故的点先审透',
    ],
    contrastTails: [
      '不是只提风格意见',
      '不是泛泛而谈代码规范',
      '不是单纯找命名问题',
      '不是做功能设计文档',
    ],
    contextTerms: ['风险评审', '权限', '回滚', 'observability', 'edge cases', '爆炸半径'],
    adjacentShare: 0.56,
  },
  backend_performance_preference: {
    targetCount: 30,
    titleStem: '后端性能排查偏好',
    subject: '后端性能排查',
    directScenes: [
      '线上接口越来越慢',
      '请求链路延迟明显抬高',
      '一个核心 API 最近经常超时',
      '这轮要先把服务性能问题拆清楚',
    ],
    directGoals: [
      'profiling、慢查询和热点链路找出来',
      'CPU hotspot、query hotspot 和真正瓶颈定位清楚',
      '延迟来源、hot path 和资源消耗证据拉齐',
      '性能瓶颈、链路热点和优化优先级更明确',
    ],
    mixedTerms: ['performance profiling', 'latency hotspot', 'hot path analysis'],
    adjacentScenes: [
      '现在不是简单修一个 bug',
      '大家都说慢，但还没有证据链',
      '先别拍脑袋优化，得先定位瓶颈',
      '这轮最缺的是热点分析而不是再写新接口',
    ],
    adjacentGoals: [
      '把请求链路为什么变慢先查实',
      '把 profiling 证据、慢点位和根因理顺',
      '把 latency、CPU 和 query hotspot 先摸清楚',
      '把性能问题的真实来源和优先级做对',
    ],
    contrastTails: [
      '不是直接开始重构',
      '不是只补监控图表',
      '不是去设计新 API',
      '不是泛泛讲性能原则',
    ],
    contextTerms: ['后端性能', 'profiling', '慢查询', 'hot path', 'latency', '瓶颈'],
    adjacentShare: 0.58,
  },
  backend_background_jobs_preference: {
    targetCount: 30,
    titleStem: '后台任务链路偏好',
    subject: '异步任务与队列链路',
    directScenes: [
      '队列 worker 最近老是积压',
      '后台任务执行链路不稳定',
      '异步任务重试和幂等问题越来越多',
      '这次要先把 worker 链路梳理清楚',
    ],
    directGoals: [
      '重试、幂等、积压和执行一致性理清楚',
      'queue backlog、worker retry 和 observability 补完整',
      '异步 workflow、失败重试和处理稳定性更成熟',
      '后台任务的执行闭环、排障路径和可靠性更顺',
    ],
    mixedTerms: ['background jobs', 'queue worker', 'async workflow'],
    adjacentScenes: [
      '现在不是只写几个接口能解决',
      '问题更像出在 worker 和 backlog 链路',
      '业务侧抱怨任务执行时好时坏',
      '我们更像是缺一套稳定的后台任务方案',
    ],
    adjacentGoals: [
      '把 retry、idempotency 和 backlog 先理顺',
      '把 async workflow 的稳定性和可观测性补齐',
      '把队列链路里的积压、重复执行和失败路径看透',
      '把后台任务执行的一致性和排障方式做对',
    ],
    contrastTails: [
      '不是去设计新 REST 接口',
      '不是只改 controller 层',
      '不是纯粹的性能 profiling',
      '不是泛泛讨论系统架构',
    ],
    contextTerms: ['后台任务', 'queue', 'worker', 'retry', 'idempotency', 'backlog'],
    adjacentShare: 0.58,
  },
  security_vulnerability_review_preference: {
    targetCount: 30,
    titleStem: '漏洞审查偏好',
    subject: '应用安全漏洞审查',
    directScenes: [
      '这段后端代码发版前要过一轮安全检查',
      '有一批实现要做正式漏洞审查',
      '上线前需要查实际可利用风险',
      '安全审查这轮想先看应用层漏洞',
    ],
    directGoals: [
      'auth、输入校验和敏感数据暴露查透',
      '可利用问题、风险路径和漏洞点定位出来',
      '鉴权、输入边界和数据暴露问题检查完整',
      'application security review 的关键风险更清楚',
    ],
    mixedTerms: ['application security review', 'exploitable flaws', 'auth + validation'],
    adjacentScenes: [
      '这轮不是听安全原则课',
      '我想知道代码里有没有真能打出来的问题',
      '主要担心风险路径和可利用漏洞',
      '不只是 best practices，而是要查真实漏洞',
    ],
    adjacentGoals: [
      '把 exploitable risk 和攻击路径先挖出来',
      '把 auth、validation 和 data exposure 风险查清楚',
      '把真正可能出事的漏洞点定位出来',
      '把代码里的安全问题和可利用性评清楚',
    ],
    contrastTails: [
      '不是泛泛给建议',
      '不是做依赖供应链审查',
      '不是普通代码风格 review',
      '不是高层安全宣讲',
    ],
    contextTerms: ['漏洞审查', 'auth', 'input validation', 'data exposure', 'exploitable', '攻击路径'],
    adjacentShare: 0.58,
  },
  security_dependency_audit_preference: {
    targetCount: 30,
    titleStem: '依赖供应链偏好',
    subject: '依赖与供应链审查',
    directScenes: [
      '上线前要过一轮依赖安全核查',
      '项目外部包链路需要正式审计',
      '这次重点看 supply chain 风险',
      '依赖升级前要先做安全审查',
    ],
    directGoals: [
      'lockfile、CVE 和恶意包风险查清楚',
      'license risk、update safety 和包来源完整梳理',
      'dependency audit 的主要隐患和升级边界更清晰',
      '版本链路、外部包和供应链风险排查完整',
    ],
    mixedTerms: ['dependency audit', 'supply chain risk', 'lockfile integrity'],
    adjacentScenes: [
      '这轮不是审代码逻辑，而是看依赖层风险',
      '主要担心外部包把问题带进来',
      '升级前想先摸清 lockfile 和包来源隐患',
      '不是泛泛讲安全，而是盯供应链链路',
    ],
    adjacentGoals: [
      '把 vulnerable packages 和 lockfile integrity 查实',
      '把外部依赖、license 风险和升级安全性理顺',
      '把供应链层面的隐患和高风险包先挖出来',
      '把依赖链路里的 CVE、恶意包和升级边界看透',
    ],
    contrastTails: [
      '不是应用层漏洞排查',
      '不是普通代码 review',
      '不是只提最佳实践',
      '不是做系统性能诊断',
    ],
    contextTerms: ['dependency audit', 'supply chain', 'lockfile', 'CVE', 'license risk', '恶意包'],
    adjacentShare: 0.58,
  },
  tools_playwright_interactive_preference: {
    targetCount: 27,
    titleStem: '交互式调试偏好',
    subject: '持续交互式 UI 调试',
    directScenes: [
      '这次页面问题要反复进浏览器排查',
      '表单流程需要多轮交互式检查',
      '浏览器状态需要保留下来继续调试',
      '复杂弹窗链路想逐步排查',
    ],
    directGoals: [
      '保留页面上下文、反复点流程和看状态变化',
      'persistent browser、异常态检查和交互调试更顺',
      '多轮界面排查、状态对比和手工验证更完整',
      '浏览器会话、页面状态和调试闭环更成熟',
    ],
    mixedTerms: ['persistent browser', 'interactive debugging', 'iterative UI check'],
    adjacentScenes: [
      '这轮不是一次性自动回放',
      '主要问题是要保留上下文继续查',
      '不是跑完脚本就结束，而是多轮排查',
      '页面问题需要边试边看状态变化',
    ],
    adjacentGoals: [
      '把浏览器状态保住并持续调试',
      '把交互问题、多轮检查和异常态验证做顺',
      '把 iterative UI debugging 的上下文链路补完整',
      '把保留会话、排查流程和状态观测理清楚',
    ],
    contrastTails: [
      '不是只截个图',
      '不是纯离线脚本跑完就走',
      '不是写一个静态测试报告',
      '不是表格整理任务',
    ],
    contextTerms: ['interactive debugging', 'persistent browser', '多轮排查', '异常态', '表单流程', '状态变化'],
    adjacentShare: 0.52,
  },
  tools_spreadsheet_preference: {
    targetCount: 27,
    titleStem: '运营表格偏好',
    subject: '运营数据表整理',
    directScenes: [
      '周报前要把投放数据整理出来',
      '运营复盘需要一份可继续算的数据表',
      '增长数据要先做结构化梳理',
      '渠道明细需要汇总成能继续分析的表格',
    ],
    directGoals: [
      '透视汇总、渠道分析和结构化表格输出更完整',
      '数据清洗、汇总和后续复盘链路更顺',
      '可编辑表格、分析维度和复盘口径更清楚',
      '运营分析里的汇总、透视和结构化输出更成熟',
    ],
    mixedTerms: ['editable sheet', 'pivot summary', 'growth analysis'],
    adjacentScenes: [
      '这轮不是写一份说明文档',
      '主要任务是把散数据先收成表',
      '复盘之前要先把渠道数据算清楚',
      '老板要的不是一段结论，而是可继续分析的数据底表',
    ],
    adjacentGoals: [
      '把投放明细、汇总口径和表格结构先理顺',
      '把 pivot、渠道分析和复盘底表补完整',
      '把增长数据从散乱材料整理成可继续计算的表格',
      '把运营分析用的数据结构和输出形态做对',
    ],
    contrastTails: [
      '不是写文档说明',
      '不是做 PPT 演示稿',
      '不是视频脚本任务',
      '不是只给一段结论',
    ],
    contextTerms: ['运营数据表', '透视汇总', 'editable sheet', '渠道分析', '复盘', '结构化表格'],
    adjacentShare: 0.52,
  },
  design_ppt_maker_preference: {
    targetCount: 30,
    titleStem: '运营 PPT 偏好',
    subject: '运营汇报 PPT',
    directScenes: [
      '周会前要把运营复盘做成汇报稿',
      '月底经营分析会要出一份 PPT',
      '老板要看本月增长复盘演示文稿',
      '这次要把业务材料整理成能直接讲的 deck',
    ],
    directGoals: [
      '故事线、逐页结构和视觉表达更完整',
      '汇报逻辑、页面编排和 presentation narrative 更成熟',
      '自动大纲、页面布局和演示节奏更清楚',
      '从业务材料到正式汇报稿的转化更顺',
    ],
    mixedTerms: ['presentation deck', 'executive PPT', 'business review deck'],
    adjacentScenes: [
      '这轮不是课堂风格课件',
      '老板要的是能直接汇报的业务 deck',
      '内容已经有了，缺的是一套能讲的演示稿',
      '运营复盘不能只是几张随手拼的页',
    ],
    adjacentGoals: [
      '把故事线、逐页结构和汇报节奏理顺',
      '把经营复盘材料变成正式 presentation deck',
      '把大纲、页面层次和视觉叙事补完整',
      '把业务结论组织成能直接拿去讲的 PPT',
    ],
    contrastTails: [
      '不是培训课件',
      '不是文档说明页',
      '不是静态信息罗列',
      '不是单页海报',
    ],
    contextTerms: ['运营汇报', 'PPT', 'deck', '故事线', '逐页结构', 'presentation'],
    adjacentShare: 0.56,
  },
  design_motion_video_preference: {
    targetCount: 30,
    titleStem: '讲解视频偏好',
    subject: '讲解动画视频',
    directScenes: [
      '运营脚本要做成一支讲解视频',
      '活动复盘想做成带口播节奏的动画短片',
      '这段说明材料准备做成 explainer video',
      '内容团队要把文案转成可导出的视频',
    ],
    directGoals: [
      '镜头节奏、字幕强化和转场设计更完整',
      'narration 配套动效、镜头切换和节奏控制更成熟',
      '从脚本到动态视频的镜头组织更清楚',
      '讲解内容、字幕和动画节奏的配合更顺',
    ],
    mixedTerms: ['motion video', 'explainer video', 'narration animation'],
    adjacentScenes: [
      '这轮不是生成单张图片',
      '内容要的是一支能预览导出的视频',
      '脚本已经写好，缺的是动态镜头表达',
      '不是做静态海报，而是讲解型短视频',
    ],
    adjacentGoals: [
      '把镜头节奏、字幕和转场先搭起来',
      '把脚本转成可讲可看的 motion video',
      '把口播配套动效、画面推进和节奏控制补完整',
      '把动态视频的导出、预览和叙事闭环做对',
    ],
    contrastTails: [
      '不是图像生成任务',
      '不是 PPT 汇报稿',
      '不是文档改写',
      '不是静态 banner',
    ],
    contextTerms: ['讲解视频', 'motion video', '字幕', '转场', '口播', '镜头节奏'],
    adjacentShare: 0.56,
  },
}

function padSequence(sequence: number): string {
  return String(sequence).padStart(3, '0')
}

function dedupeWords(parts: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const part of parts.map(item => item.trim()).filter(Boolean)) {
    const key = part.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(part)
  }
  return result
}

function buildQueryContext(parts: string[]): string {
  return dedupeWords(parts).join(' ')
}

function buildDirectPureQuery(input: {
  scene: string
  subject: string
  goal: string
  templateIndex: number
}): string {
  const { scene, subject, goal, templateIndex } = input
  switch (templateIndex % 3) {
    case 0:
      return `${scene}，我需要把${subject}做好，重点是${goal}。`
    case 1:
      return `${scene}，想先把${subject}这块补完整，核心是${goal}。`
    default:
      return `${scene}，这次做${subject}，最关心的是${goal}。`
  }
}

function buildDirectMixedQuery(input: {
  scene: string
  subject: string
  goal: string
  mixedTerm: string
  templateIndex: number
}): string {
  const { scene, subject, goal, mixedTerm, templateIndex } = input
  switch (templateIndex % 3) {
    case 0:
      return `${scene}，想把${subject}做成更成熟的 ${mixedTerm} 体验，重点是${goal}。`
    case 1:
      return `${scene}，这轮需要一个更完整的 ${mixedTerm} 方案，核心还是${goal}。`
    default:
      return `${scene}，希望把${subject}往 ${mixedTerm} 的方向做，重点补齐${goal}。`
  }
}

function buildAdjacentQuery(input: {
  scene: string
  subject: string
  goal: string
  contrastTail: string
  mixedTerm: string
  templateIndex: number
  languageTag: GraphPreferenceVariant['languageTag']
}): string {
  const { scene, subject, goal, contrastTail, mixedTerm, templateIndex, languageTag } = input
  if (languageTag === 'lang:zh-pure') {
    switch (templateIndex % 3) {
      case 0:
        return `${scene}，想先把${subject}里的${goal}理顺，${contrastTail}。`
      case 1:
        return `${scene}，更像是${subject}这条线需要先补齐${goal}，${contrastTail}。`
      default:
        return `${scene}，这次优先把${subject}里的${goal}做对，${contrastTail}。`
    }
  }

  switch (templateIndex % 3) {
    case 0:
      return `${scene}，更像是${subject}这条线需要一次 ${mixedTerm} 级别的梳理，先把${goal}做对，${contrastTail}。`
    case 1:
      return `${scene}，想先从 ${mixedTerm} 视角把${subject}里的${goal}拉顺，${contrastTail}。`
    default:
      return `${scene}，现在最缺的是一轮 ${mixedTerm} 式处理，把${goal}补完整，${contrastTail}。`
  }
}

function buildExpandedVariants(
  spec: GraphPreferenceSpec,
  profile: GraphPreferenceExpansionProfile,
): GraphPreferenceVariant[] {
  const extraCount = profile.targetCount - spec.variants.length
  if (extraCount <= 0) {
    return []
  }

  const adjacentCount = Math.max(1, Math.round(extraCount * profile.adjacentShare))
  const mixedCount = Math.max(1, Math.floor((extraCount - adjacentCount) / 2))
  const pureCount = extraCount - adjacentCount - mixedCount

  const variants: GraphPreferenceVariant[] = []
  const seenQueries = new Set<string>()

  const pushVariant = (
    variant: Omit<GraphPreferenceVariant, 'sequence'>,
  ): void => {
    const normalizedQuery = variant.queryText.trim().toLowerCase()
    if (seenQueries.has(normalizedQuery)) {
      return
    }
    seenQueries.add(normalizedQuery)
    variants.push({
      sequence: padSequence(spec.variants.length + variants.length + 1),
      ...variant,
    })
  }

  let generated = 0
  for (const scene of profile.directScenes) {
    for (const goal of profile.directGoals) {
      if (generated >= pureCount) {
        break
      }
      const queryText = buildDirectPureQuery({
        scene,
        subject: profile.subject,
        goal,
        templateIndex: generated,
      })
      pushVariant({
        title: `${profile.titleStem}扩展表达 ${padSequence(spec.variants.length + generated + 1)}`,
        difficultyTag: 'difficulty:direct',
        languageTag: 'lang:zh-pure',
        queryText,
        queryContext: buildQueryContext([
          profile.subject,
          goal,
          scene,
          ...profile.contextTerms.slice(0, 4),
        ]),
      })
      generated += 1
    }
    if (generated >= pureCount) {
      break
    }
  }

  generated = 0
  for (const scene of profile.directScenes) {
    for (const goal of profile.directGoals) {
      for (const mixedTerm of profile.mixedTerms) {
        if (generated >= mixedCount) {
          break
        }
        const queryText = buildDirectMixedQuery({
          scene,
          subject: profile.subject,
          goal,
          mixedTerm,
          templateIndex: generated,
        })
        pushVariant({
          title: `${profile.titleStem}混合表达 ${padSequence(spec.variants.length + variants.length + 1)}`,
          difficultyTag: 'difficulty:direct',
          languageTag: 'lang:zh-mixed',
          queryText,
          queryContext: buildQueryContext([
            profile.subject,
            goal,
            mixedTerm,
            scene,
            ...profile.contextTerms.slice(0, 4),
          ]),
        })
        generated += 1
      }
      if (generated >= mixedCount) {
        break
      }
    }
    if (generated >= mixedCount) {
      break
    }
  }

  generated = 0
  for (const scene of profile.adjacentScenes) {
    for (const goal of profile.adjacentGoals) {
      for (const contrastTail of profile.contrastTails) {
        if (generated >= adjacentCount) {
          break
        }
        const languageTag =
          generated % 2 === 0 ? 'lang:zh-mixed' : 'lang:zh-pure'
        const mixedTerm =
          profile.mixedTerms[generated % profile.mixedTerms.length] ?? profile.subject
        const queryText = buildAdjacentQuery({
          scene,
          subject: profile.subject,
          goal,
          contrastTail,
          mixedTerm,
          templateIndex: generated,
          languageTag,
        })
        pushVariant({
          title: `${profile.titleStem}邻近表达 ${padSequence(spec.variants.length + variants.length + 1)}`,
          difficultyTag: 'difficulty:adjacent',
          languageTag,
          queryText,
          queryContext: buildQueryContext([
            profile.subject,
            goal,
            scene,
            mixedTerm,
            ...profile.contextTerms.slice(0, 5),
          ]),
        })
        generated += 1
      }
      if (generated >= adjacentCount) {
        break
      }
    }
    if (generated >= adjacentCount) {
      break
    }
  }

  if (variants.length < extraCount) {
    throw new Error(
      `Spec ${spec.slug} failed to generate enough extra variants: expected ${extraCount}, got ${variants.length}`,
    )
  }

  return variants.slice(0, extraCount)
}

function buildRegistryMap(skills: SkillRegistryEntry[]): Map<string, SkillRegistryEntry> {
  return new Map(skills.map(skill => [skill.skillId, skill] as const))
}

function ensureSkill(
  registryById: Map<string, SkillRegistryEntry>,
  skillId: string,
): SkillRegistryEntry {
  const skill = registryById.get(skillId)
  if (!skill) {
    throw new Error(`Skill ${skillId} not found in skill-registry.json`)
  }
  return skill
}

function buildEvalCase(
  spec: GraphPreferenceSpec,
  variant: GraphPreferenceVariant,
  preferredSkill: SkillRegistryEntry,
): SkillRetrievalEvalCase {
  const department = departmentForSkill(preferredSkill)
  const tags = [
    preferredSkill.domain,
    'set:graph-preference',
    variant.difficultyTag,
    variant.languageTag,
    spec.sceneKey,
  ]

  return {
    schemaVersion: '2026-04-12',
    caseType: 'retrieval',
    caseId: `retrieval_graph_preference_${spec.slug}_${variant.sequence}`,
    title: variant.title,
    dataset: RETRIEVAL_GRAPH_PREFERENCE_DATASET_ID,
    tags,
    query: {
      queryText: variant.queryText,
      queryContext: variant.queryContext,
      cwd: '/tmp/skill-eval',
      projectId: spec.projectId,
      department,
      domainHints: [preferredSkill.domain],
      sceneHints: spec.sceneHints,
      priorInjectedSkillIds: [],
      priorInvokedSkillIds: [],
      limit: 5,
    },
    expected: {
      mustHitSkillIds: [spec.preferredSkillId],
      acceptableSkillIds: [spec.competingSkillId],
      forbiddenSkillIds: spec.forbiddenSkillIds,
      preference: {
        preferredSkillId: spec.preferredSkillId,
        competingSkillId: spec.competingSkillId,
        expectedDirection: 'preferred_above_competitor',
      },
    },
    modeOverrides: {},
  }
}

async function writeCaseFile(filePath: string, evalCase: SkillRetrievalEvalCase): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const body = YAML.stringify(evalCase).replace(
    /schemaVersion: "2026-04-12"/,
    'schemaVersion: "2026-04-12"',
  )
  await writeFile(filePath, body, 'utf-8')
}

async function main(): Promise<void> {
  const outputDir = DEFAULT_OUTPUT_DIR
  const registry = await readGeneratedSkillRegistry(join(PROJECT_ROOT, 'skills-flat'))
  if (!registry) {
    throw new Error('Missing generated skill-registry.json')
  }

  const registryById = buildRegistryMap(registry.skills)

  await rm(outputDir, { recursive: true, force: true })
  await mkdir(outputDir, { recursive: true })

  let caseCount = 0

  for (const spec of GRAPH_PREFERENCE_SPECS) {
    const preferredSkill = ensureSkill(registryById, spec.preferredSkillId)
    ensureSkill(registryById, spec.competingSkillId)
    for (const skillId of spec.forbiddenSkillIds) {
      ensureSkill(registryById, skillId)
    }

    const profile = GRAPH_PREFERENCE_EXPANSION_PROFILES[spec.slug]
    const allVariants = profile
      ? [...spec.variants, ...buildExpandedVariants(spec, profile)]
      : spec.variants

    for (const variant of allVariants) {
      const evalCase = buildEvalCase(spec, variant, preferredSkill)
      const filePath = join(
        outputDir,
        preferredSkill.domain,
        `${spec.slug}_${variant.sequence}.yaml`,
      )
      await writeCaseFile(filePath, evalCase)
      caseCount += 1
    }
  }

  console.log(
    JSON.stringify(
      {
        outputDir,
        specCount: GRAPH_PREFERENCE_SPECS.length,
        caseCount,
        targetCaseCount: Object.values(GRAPH_PREFERENCE_EXPANSION_PROFILES).reduce(
          (sum, profile) => sum + profile.targetCount,
          0,
        ),
      },
      null,
      2,
    ),
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
