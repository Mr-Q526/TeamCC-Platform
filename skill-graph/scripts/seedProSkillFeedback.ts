import {
  buildAndWriteSkillFactAggregates,
} from '../src/aggregates/skillFactAggregates.js'
import { ensureSkillFeedbackAggregatesTable } from '../src/aggregates/storage.js'
import { createSkillFactEvent } from '../src/events/skillFacts.js'
import {
  buildInsertSkillFactEventQuery,
  closeSkillFactPgPool,
  ensureSkillFactEventsTable,
  getSkillFactPgPool,
  mapSkillFactEventToInsertRow,
} from '../src/events/storage.js'
import {
  applySkillAggregateGraphUpdate,
  buildSkillAggregateGraphUpdate,
} from '../src/graph/aggregateGraphUpdate.js'
import {
  readSkillRegistry,
  type SkillRegistryEntry,
} from '../src/registry/registry.js'
import {
  factFilterForRetrievalFeaturePreset,
  writeSkillRetrievalFeatures,
} from '../src/retrieval/retrievalFeatures.js'

type PairSeedConfig = {
  basicName: string
  proName: string
  taskCount: number
  basicWinCount: number
  projectId: string
  queryText: string
  sceneHint?: string | null
}

type SingletonSeedConfig = {
  skillName: string
  taskCount: number
  projectId: string
  queryText: string
  sceneHint?: string | null
}

type SkillContext = {
  cwd: string
  projectId: string
  department: string | null
  scene: string | null
  domain: string | null
}

type SeedSummary = {
  eventsPlanned: number
  eventsInserted: number
  pairCount: number
  singletonCount: number
  refreshed: boolean
}

const RUN_ID = 'seed-scene-quality-v2'
const DEFAULT_WINDOW_DAYS = 30

const PAIR_SEEDS: PairSeedConfig[] = [
  {
    basicName: 'website-homepage-design-basic',
    proName: 'website-homepage-design-pro',
    taskCount: 20,
    basicWinCount: 2,
    projectId: 'seed:homepage-refresh',
    queryText: '品牌官网首页 homepage 前端设计，要求高级感和完整转化结构',
    sceneHint: 'homepage',
  },
  {
    basicName: 'website-homepage-design',
    proName: 'website-homepage-design-pro',
    taskCount: 24,
    basicWinCount: 1,
    projectId: 'seed:homepage-refresh',
    queryText:
      '重做品牌官网首页，要高级感、完整叙事、成熟大厂风格和清晰转化承接',
    sceneHint: 'homepage',
  },
  {
    basicName: 'humanizer-zh-basic',
    proName: 'humanizer-zh-pro',
    taskCount: 20,
    basicWinCount: 3,
    projectId: 'seed:humanizer-zh',
    queryText: '把中文 AI 文案去 AI 味，保持自然表达和语气层次',
    sceneHint: 'writing',
  },
  {
    basicName: 'settings-page-basic',
    proName: 'settings-page-pro',
    taskCount: 18,
    basicWinCount: 3,
    projectId: 'seed:settings-page',
    queryText: '设计一套企业级设置页，分组清晰、权限复杂、表单状态完整',
    sceneHint: 'settings',
  },
  {
    basicName: 'pricing-page-basic',
    proName: 'pricing-page-pro',
    taskCount: 18,
    basicWinCount: 3,
    projectId: 'seed:pricing-page',
    queryText: '做 SaaS 定价页，强调套餐对比、升级引导和转化说明',
    sceneHint: 'pricing',
  },
  {
    basicName: 'search-results-page-basic',
    proName: 'search-results-page-pro',
    taskCount: 18,
    basicWinCount: 3,
    projectId: 'seed:search-results-page',
    queryText: '搜索结果页设计，要有筛选、排序、空状态和高信息密度',
    sceneHint: 'search-results',
  },
  {
    basicName: 'responsive-navigation-basic',
    proName: 'responsive-navigation-pro',
    taskCount: 18,
    basicWinCount: 3,
    projectId: 'seed:responsive-navigation',
    queryText: '设计响应式导航栏，覆盖桌面端、移动端、二级菜单和吸顶交互',
    sceneHint: 'navigation',
  },
  {
    basicName: 'component-library-basic',
    proName: 'component-library-pro',
    taskCount: 18,
    basicWinCount: 4,
    projectId: 'seed:component-library',
    queryText: '搭建企业级组件库，要有 token、组件规范和可维护扩展能力',
    sceneHint: 'component-library',
  },
  {
    basicName: 'docs-site-basic',
    proName: 'docs-site-pro',
    taskCount: 16,
    basicWinCount: 3,
    projectId: 'seed:docs-site',
    queryText: '设计开发者文档站，包含侧栏导航、搜索、版本切换和示例展示',
    sceneHint: 'docs-site',
  },
  {
    basicName: 'development-plan-doc-basic',
    proName: 'development-plan-doc-pro',
    taskCount: 16,
    basicWinCount: 4,
    projectId: 'seed:development-plan-doc',
    queryText: '输出完整开发计划文档，包含里程碑、风险、资源拆分和验收标准',
    sceneHint: 'planning',
  },
  {
    basicName: 'auth-login-page-basic',
    proName: 'auth-login-page-pro',
    taskCount: 16,
    basicWinCount: 3,
    projectId: 'seed:auth-login-page',
    queryText: '做一个企业级登录页，支持 SSO、异常态和安全提示',
    sceneHint: 'login',
  },
  {
    basicName: 'developer-portal-basic',
    proName: 'developer-portal-pro',
    taskCount: 16,
    basicWinCount: 4,
    projectId: 'seed:developer-portal',
    queryText: '做一个开发者门户，强调 API 导航、接入指南、示例代码和文档体验',
    sceneHint: 'developer-portal',
  },
  {
    basicName: 'design-system-builder-basic',
    proName: 'design-system-builder-pro',
    taskCount: 16,
    basicWinCount: 4,
    projectId: 'seed:design-system-builder',
    queryText: '建立企业级 design system，覆盖 tokens、组件规则、发布流程和设计治理',
    sceneHint: 'design-system',
  },
  {
    basicName: 'code-review-general',
    proName: 'code-review-risk-based',
    taskCount: 16,
    basicWinCount: 4,
    projectId: 'seed:code-review-risk',
    queryText:
      '对高风险代码变更做风险导向 review，重点看权限、支付、回滚、可观测性和边界条件',
    sceneHint: 'review',
  },
  {
    basicName: 'unit-test-strategy',
    proName: 'bug-fix-debugging',
    taskCount: 16,
    basicWinCount: 4,
    projectId: 'seed:bug-fix-debugging',
    queryText:
      '定位回归 bug、复现失败路径、修复运行时问题，并补上能防止再次回归的测试',
    sceneHint: 'debug',
  },
  {
    basicName: 'bug-fix-debugging',
    proName: 'backend-performance-profiling',
    taskCount: 16,
    basicWinCount: 4,
    projectId: 'seed:backend-performance',
    queryText:
      '排查慢接口和 latency hotspot，要先做 profiling，再定位热点链路和性能瓶颈',
    sceneHint: 'debug',
  },
  {
    basicName: 'rest-api-implementation',
    proName: 'background-jobs-queues',
    taskCount: 16,
    basicWinCount: 4,
    projectId: 'seed:background-jobs',
    queryText:
      '排查队列 worker 的重试、幂等、积压和异步任务处理问题，兼顾运行稳定性与可观测性',
    sceneHint: 'architecture',
  },
  {
    basicName: 'security-best-practices',
    proName: 'security-vulnerability-check',
    taskCount: 16,
    basicWinCount: 4,
    projectId: 'seed:security-vulnerability-review',
    queryText:
      '对后端应用做安全审查，重点检查鉴权、输入校验、敏感数据暴露和可利用漏洞',
    sceneHint: 'security-audit',
  },
  {
    basicName: 'security-best-practices',
    proName: 'dependency-supply-chain-audit',
    taskCount: 16,
    basicWinCount: 4,
    projectId: 'seed:dependency-audit',
    queryText:
      '检查依赖和供应链风险，重点看 lockfile、CVE、恶意包、升级风险和许可证问题',
    sceneHint: 'security-audit',
  },
  {
    basicName: 'playwright',
    proName: 'playwright-interactive',
    taskCount: 14,
    basicWinCount: 4,
    projectId: 'seed:playwright-interactive',
    queryText:
      '做持续交互式 UI 调试，需要保留浏览器状态，反复检查页面流程、表单和异常态',
    sceneHint: 'debug',
  },
  {
    basicName: 'doc',
    proName: 'spreadsheet',
    taskCount: 14,
    basicWinCount: 4,
    projectId: 'seed:operations-spreadsheet',
    queryText:
      '整理运营数据表，做渠道投放分析、透视汇总和结构化表格输出，方便后续复盘',
    sceneHint: 'data-analysis',
  },
  {
    basicName: 'ppt-course-presentation',
    proName: 'ppt-maker',
    taskCount: 16,
    basicWinCount: 4,
    projectId: 'seed:operations-ppt',
    queryText:
      '根据运营复盘材料生成完整 PPT，要有清晰故事线、页级布局和适合汇报的视觉表达',
    sceneHint: 'content-generation',
  },
  {
    basicName: 'jimeng',
    proName: 'motion-video-maker',
    taskCount: 14,
    basicWinCount: 3,
    projectId: 'seed:motion-video',
    queryText:
      '根据运营脚本生成讲解动画视频，强调镜头节奏、字幕强化、转场和口播配套动效',
    sceneHint: 'content-generation',
  },
]

const SINGLETON_SEEDS: SingletonSeedConfig[] = [
  {
    skillName: 'ppt-maker',
    taskCount: 18,
    projectId: 'seed:ppt-maker',
    queryText: '根据业务材料生成完整 PPT，大纲、故事线和视觉风格都要专业',
    sceneHint: 'content-generation',
  },
  {
    skillName: 'ppt-maker',
    taskCount: 20,
    projectId: 'seed:operations-ppt',
    queryText:
      '把运营复盘材料整理成老板汇报 deck，要有故事线、逐页结构和业务汇报表达',
    sceneHint: 'content-generation',
  },
  {
    skillName: 'website-homepage-design-pro',
    taskCount: 14,
    projectId: 'seed:homepage-refresh',
    queryText:
      '做品牌官网首页 redesign，强调 hero、价值主张、完整 CTA 路径和成熟大厂表达',
    sceneHint: 'homepage',
  },
  {
    skillName: 'admin-dashboard-design',
    taskCount: 16,
    projectId: 'seed:admin-dashboard',
    queryText: '设计一个企业级管理后台 dashboard，要兼顾数据密度、监控模块和操作效率',
    sceneHint: 'admin-dashboard',
  },
]

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag)
}

function trimString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function getSkillByName(
  registry: SkillRegistryEntry[],
  name: string,
): SkillRegistryEntry {
  const skill = registry.find(entry => entry.name === name)
  if (!skill) {
    throw new Error(`Skill ${name} not found in skill-registry.json`)
  }

  return skill
}

function buildContext(
  skill: SkillRegistryEntry,
  projectId: string,
  sceneHint?: string | null,
): SkillContext {
  return {
    cwd: `/synthetic/${skill.targetDir}`,
    projectId,
    department: trimString(skill.departmentTags[0]),
    scene: trimString(sceneHint) ?? trimString(skill.sceneTags[0]),
    domain: trimString(skill.domain),
  }
}

function taskBaseTimestamp(pairOrdinal: number, taskOrdinal: number): number {
  const hoursAgo = (pairOrdinal * 12 + taskOrdinal) * 2
  return Date.now() - hoursAgo * 60 * 60 * 1000
}

function makeEventId(
  parts: Array<string | number>,
  skillId?: string | null,
): string {
  return [...parts, skillId ?? 'none'].join(':')
}

async function insertEventBatch(
  events: ReturnType<typeof createSkillFactEvent>[],
): Promise<number> {
  const pool = getSkillFactPgPool()
  const client = await pool.connect()
  let inserted = 0

  try {
    await client.query('BEGIN')
    for (const event of events) {
      const query = buildInsertSkillFactEventQuery(
        mapSkillFactEventToInsertRow(event),
      )
      const result = await client.query(query)
      inserted += result.rowCount ?? 0
    }
    await client.query('COMMIT')
    return inserted
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

function buildExposureEvent(options: {
  eventId: string
  createdAt: string
  traceId: string
  taskId: string
  retrievalRoundId: string
  skill: SkillRegistryEntry
  context: SkillContext
  rank: number
  candidateCount: number
  score: number
  queryText: string
  outcomeLabel: string
}): ReturnType<typeof createSkillFactEvent> {
  return createSkillFactEvent({
    eventId: options.eventId,
    factKind: 'skill_exposed',
    source: 'eval_runner',
    createdAt: options.createdAt,
    runId: RUN_ID,
    traceId: options.traceId,
    taskId: options.taskId,
    retrievalRoundId: options.retrievalRoundId,
    skillId: options.skill.skillId,
    skillName: options.skill.name,
    skillVersion: options.skill.version,
    sourceHash: options.skill.sourceHash,
    context: options.context,
    retrieval: {
      rank: options.rank,
      candidateCount: options.candidateCount,
      retrievalSource: 'seed_scene_quality',
      score: options.score,
      scoreBreakdown: {
        seedBaseline: options.score,
      },
    },
    payload: {
      seedProfile: RUN_ID,
      queryText: options.queryText,
      outcomeLabel: options.outcomeLabel,
    },
  })
}

function buildSelectionChain(options: {
  taskPrefix: string
  createdAtMs: number
  traceId: string
  taskId: string
  retrievalRoundId: string
  skill: SkillRegistryEntry
  context: SkillContext
  rank: number
  candidateCount: number
  queryText: string
  comment: string
  rating: number
  sentiment: 'positive' | 'neutral'
  verificationPassed: boolean
  durationMs: number
}): Array<ReturnType<typeof createSkillFactEvent>> {
  const createdAt = (offsetMinutes: number) =>
    new Date(options.createdAtMs + offsetMinutes * 60 * 1000).toISOString()

  return [
    createSkillFactEvent({
      eventId: makeEventId(
        [RUN_ID, options.taskPrefix, 'skill_selected'],
        options.skill.skillId,
      ),
      factKind: 'skill_selected',
      source: 'eval_runner',
      createdAt: createdAt(2),
      runId: RUN_ID,
      traceId: options.traceId,
      taskId: options.taskId,
      retrievalRoundId: options.retrievalRoundId,
      skillId: options.skill.skillId,
      skillName: options.skill.name,
      skillVersion: options.skill.version,
      sourceHash: options.skill.sourceHash,
      context: options.context,
      retrieval: {
        rank: options.rank,
        candidateCount: options.candidateCount,
        retrievalSource: 'seed_scene_quality',
        score: options.rank === 1 ? 0.95 : 0.82,
        selectedBy: 'eval_runner',
      },
      payload: {
        seedProfile: RUN_ID,
        queryText: options.queryText,
      },
    }),
    createSkillFactEvent({
      eventId: makeEventId(
        [RUN_ID, options.taskPrefix, 'skill_invoked'],
        options.skill.skillId,
      ),
      factKind: 'skill_invoked',
      source: 'eval_runner',
      createdAt: createdAt(3),
      runId: RUN_ID,
      traceId: options.traceId,
      taskId: options.taskId,
      retrievalRoundId: options.retrievalRoundId,
      skillId: options.skill.skillId,
      skillName: options.skill.name,
      skillVersion: options.skill.version,
      sourceHash: options.skill.sourceHash,
      context: options.context,
      retrieval: {
        rank: options.rank,
        candidateCount: options.candidateCount,
        retrievalSource: 'seed_scene_quality',
        selectedBy: 'eval_runner',
      },
      payload: {
        seedProfile: RUN_ID,
        queryText: options.queryText,
      },
    }),
    createSkillFactEvent({
      eventId: makeEventId(
        [RUN_ID, options.taskPrefix, 'skill_completed'],
        options.skill.skillId,
      ),
      factKind: 'skill_completed',
      source: 'eval_runner',
      createdAt: createdAt(6),
      runId: RUN_ID,
      traceId: options.traceId,
      taskId: options.taskId,
      retrievalRoundId: options.retrievalRoundId,
      skillId: options.skill.skillId,
      skillName: options.skill.name,
      skillVersion: options.skill.version,
      sourceHash: options.skill.sourceHash,
      context: options.context,
      retrieval: {
        rank: options.rank,
        candidateCount: options.candidateCount,
        retrievalSource: 'seed_scene_quality',
        selectedBy: 'eval_runner',
      },
      outcome: {
        success: true,
        verificationPassed: options.verificationPassed,
        durationMs: options.durationMs,
      },
      payload: {
        seedProfile: RUN_ID,
        queryText: options.queryText,
      },
    }),
    createSkillFactEvent({
      eventId: makeEventId(
        [RUN_ID, options.taskPrefix, 'skill_feedback'],
        options.skill.skillId,
      ),
      factKind: 'skill_feedback',
      source: 'eval_runner',
      createdAt: createdAt(8),
      runId: RUN_ID,
      traceId: options.traceId,
      taskId: options.taskId,
      retrievalRoundId: options.retrievalRoundId,
      skillId: options.skill.skillId,
      skillName: options.skill.name,
      skillVersion: options.skill.version,
      sourceHash: options.skill.sourceHash,
      context: options.context,
      retrieval: {
        rank: options.rank,
        candidateCount: options.candidateCount,
        retrievalSource: 'seed_scene_quality',
        selectedBy: 'eval_runner',
      },
      feedback: {
        rating: options.rating,
        sentiment: options.sentiment,
        comment: options.comment,
      },
      payload: {
        seedProfile: RUN_ID,
        queryText: options.queryText,
      },
    }),
  ]
}

function buildPairEvents(
  config: PairSeedConfig,
  pairOrdinal: number,
  basicSkill: SkillRegistryEntry,
  proSkill: SkillRegistryEntry,
): ReturnType<typeof createSkillFactEvent>[] {
  const events: ReturnType<typeof createSkillFactEvent>[] = []

  for (let taskOrdinal = 0; taskOrdinal < config.taskCount; taskOrdinal += 1) {
    const basicWins = taskOrdinal < config.basicWinCount
    const winner = basicWins ? basicSkill : proSkill
    const loser = basicWins ? proSkill : basicSkill
    const winnerContext = buildContext(
      winner,
      config.projectId,
      config.sceneHint,
    )
    const loserContext = buildContext(loser, config.projectId, config.sceneHint)
    const createdAtMs = taskBaseTimestamp(pairOrdinal, taskOrdinal)
    const pairLabel = `${config.proName}:task:${taskOrdinal + 1}`
    const traceId = `${RUN_ID}:trace:${pairLabel}`
    const taskId = `${RUN_ID}:task:${pairLabel}`
    const retrievalRoundId = `${RUN_ID}:retrieval:${pairLabel}`
    const winnerRank = 1
    const loserRank = 2

    events.push(
      buildExposureEvent({
        eventId: makeEventId(
          [RUN_ID, pairLabel, 'skill_exposed', 'winner'],
          winner.skillId,
        ),
        createdAt: new Date(createdAtMs).toISOString(),
        traceId,
        taskId,
        retrievalRoundId,
        skill: winner,
        context: winnerContext,
        rank: winnerRank,
        candidateCount: 2,
        score: 0.96,
        queryText: config.queryText,
        outcomeLabel: basicWins ? 'basic-win' : 'pro-win',
      }),
    )
    events.push(
      buildExposureEvent({
        eventId: makeEventId(
          [RUN_ID, pairLabel, 'skill_exposed', 'loser'],
          loser.skillId,
        ),
        createdAt: new Date(createdAtMs + 30 * 1000).toISOString(),
        traceId,
        taskId,
        retrievalRoundId,
        skill: loser,
        context: loserContext,
        rank: loserRank,
        candidateCount: 2,
        score: 0.84,
        queryText: config.queryText,
        outcomeLabel: basicWins ? 'basic-win' : 'pro-win',
      }),
    )

    events.push(
      ...buildSelectionChain({
        taskPrefix: pairLabel,
        createdAtMs,
        traceId,
        taskId,
        retrievalRoundId,
        skill: winner,
        context: winnerContext,
        rank: winnerRank,
        candidateCount: 2,
        queryText: config.queryText,
        comment: basicWins
          ? '基础版满足了轻量需求，保留为可接受但非首选结果'
          : '专业版在复杂场景下表现更完整，人工偏好明显更高',
        rating: basicWins ? 3 : 5,
        sentiment: basicWins ? 'neutral' : 'positive',
        verificationPassed: true,
        durationMs: basicWins ? 540000 : 720000,
      }),
    )
  }

  return events
}

function buildSingletonEvents(
  config: SingletonSeedConfig,
  singletonOrdinal: number,
  skill: SkillRegistryEntry,
): ReturnType<typeof createSkillFactEvent>[] {
  const events: ReturnType<typeof createSkillFactEvent>[] = []

  for (let taskOrdinal = 0; taskOrdinal < config.taskCount; taskOrdinal += 1) {
    const createdAtMs = taskBaseTimestamp(
      PAIR_SEEDS.length + singletonOrdinal,
      taskOrdinal,
    )
    const label = `${config.skillName}:single-v3:${taskOrdinal + 1}`
    const traceId = `${RUN_ID}:trace:${label}`
    const taskId = `${RUN_ID}:task:${label}`
    const retrievalRoundId = `${RUN_ID}:retrieval:${label}`
    const context = buildContext(skill, config.projectId, config.sceneHint)

    events.push(
      buildExposureEvent({
        eventId: makeEventId(
          [RUN_ID, label, 'skill_exposed', 'single'],
          skill.skillId,
        ),
        createdAt: new Date(createdAtMs).toISOString(),
        traceId,
        taskId,
        retrievalRoundId,
        skill,
        context,
        rank: 1,
        candidateCount: 1,
        score: 0.97,
        queryText: config.queryText,
        outcomeLabel: 'single-positive',
      }),
    )
    events.push(
      ...buildSelectionChain({
        taskPrefix: label,
        createdAtMs,
        traceId,
        taskId,
        retrievalRoundId,
        skill,
        context,
        rank: 1,
        candidateCount: 1,
        queryText: config.queryText,
        comment: '该 skill 在生成完整输出时稳定命中预期，人工反馈积极',
        rating: 5,
        sentiment: 'positive',
        verificationPassed: true,
        durationMs: 840000,
      }),
    )
  }

  return events
}

async function refreshArtifacts(
  windowDays: number,
  registry: Awaited<ReturnType<typeof readSkillRegistry>>,
): Promise<void> {
  const aggregateManifest = await buildAndWriteSkillFactAggregates({
    windowDays,
    targetSampleCount: 20,
    writeJson: false,
    writePg: false,
    factFilter: factFilterForRetrievalFeaturePreset('experiment'),
  })
  const graphManifest = buildSkillAggregateGraphUpdate(aggregateManifest, registry)
  await applySkillAggregateGraphUpdate(graphManifest)
  await writeSkillRetrievalFeatures({
    preset: 'experiment',
    aggregateManifest,
    registryManifest: registry,
  })
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const refresh = !hasFlag(argv, '--no-refresh')

  await ensureSkillFactEventsTable()
  await ensureSkillFeedbackAggregatesTable()

  const registry = await readSkillRegistry(process.cwd())
  if (!registry) {
    throw new Error('Failed to read skill-registry.json')
  }

  const events: ReturnType<typeof createSkillFactEvent>[] = []

  PAIR_SEEDS.forEach((config, index) => {
    const basicSkill = getSkillByName(registry.skills, config.basicName)
    const proSkill = getSkillByName(registry.skills, config.proName)
    events.push(...buildPairEvents(config, index, basicSkill, proSkill))
  })

  SINGLETON_SEEDS.forEach((config, index) => {
    const skill = getSkillByName(registry.skills, config.skillName)
    events.push(...buildSingletonEvents(config, index, skill))
  })

  const inserted = await insertEventBatch(events)

  if (refresh) {
    await refreshArtifacts(DEFAULT_WINDOW_DAYS, registry)
  }

  const summary: SeedSummary = {
    eventsPlanned: events.length,
    eventsInserted: inserted,
    pairCount: PAIR_SEEDS.length,
    singletonCount: SINGLETON_SEEDS.length,
    refreshed: refresh,
  }

  console.log(JSON.stringify(summary, null, 2))
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await closeSkillFactPgPool().catch(() => {})
  })
