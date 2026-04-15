import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import YAML from 'yaml'
import { listEvalCases, loadEvalCase } from '../src/evals/io.js'
import {
  getCoverageCasesDir,
  getGeneratedCoverageCasesVersionDir,
  RETRIEVAL_COVERAGE_DATASET_ID,
} from '../src/evals/retrievalDatasets.js'
import {
  departmentForSkill,
  domainAcceptables,
  domainForbidden,
  prettyDomain,
  sceneHintsForSkill,
  toSlug,
} from '../src/evals/retrievalCaseFactory.js'
import { readGeneratedSkillRegistry } from '../src/registry/registry.js'
import type { SkillRegistryEntry } from '../src/registry/registry.js'
import type { SkillRetrievalEvalCase } from '../src/evals/types.js'

type GeneratedRetrievalCaseSpec = SkillRetrievalEvalCase & {
  filePath: string
}

const PROJECT_ROOT = resolve(process.cwd())
const COVERAGE_ROOT = getCoverageCasesDir(PROJECT_ROOT)
const GENERATED_ROOT = getGeneratedCoverageCasesVersionDir(PROJECT_ROOT)

function makeQueryVariant(
  skill: SkillRegistryEntry,
  variant: number,
): { title: string; queryText: string; queryContext: string } {
  const displayName = skill.displayName
  const domainLabel = prettyDomain(skill.domain)
  const scenes = skill.sceneTags.length ? skill.sceneTags.join(' / ') : skill.domain
  const departments = skill.departmentTags.length ? skill.departmentTags.join(' / ') : skill.domain
  const baseName = skill.skillId.split('/')[1] ?? skill.skillId

  switch (skill.domain) {
    case 'frontend':
      return [
        {
          title: `${domainLabel}${displayName}需求`,
          queryText: `${displayName} 前端页面 组件 布局 转化率`,
          queryContext: `${domainLabel} ${displayName} landing page hero CTA responsive design`,
        },
        {
          title: `${domainLabel}${displayName}方案`,
          queryText: `${baseName} 用户体验 信息架构 交互设计`,
          queryContext: `${domainLabel} ${scenes} ${departments} component layout navigation`,
        },
        {
          title: `${domainLabel}${displayName}检索`,
          queryText: `${displayName} 适合做什么样的页面和界面`,
          queryContext: `${domainLabel} ${displayName} design system page flow`,
        },
      ][variant % 3]
    case 'backend':
      return [
        {
          title: `${domainLabel}${displayName}架构`,
          queryText: `${displayName} API 架构 数据模型 可靠性`,
          queryContext: `${domainLabel} ${displayName} architecture scalability latency`,
        },
        {
          title: `${domainLabel}${displayName}实现`,
          queryText: `${baseName} 需要后端实现 设计 接口`,
          queryContext: `${domainLabel} ${scenes} service database api`,
        },
        {
          title: `${domainLabel}${displayName}排障`,
          queryText: `${displayName} 性能 问题 排查 与治理`,
          queryContext: `${domainLabel} ${displayName} debug profiling reliability`,
        },
      ][variant % 3]
    case 'infra':
      return [
        {
          title: `${domainLabel}${displayName}排障`,
          queryText: `${displayName} 部署 监控 构建失败 排查`,
          queryContext: `${domainLabel} ${displayName} deploy observability release`,
        },
        {
          title: `${domainLabel}${displayName}方案`,
          queryText: `${baseName} CI/CD 质量门禁 发布流程`,
          queryContext: `${domainLabel} ${scenes} pipeline monitoring alerting`,
        },
        {
          title: `${domainLabel}${displayName}实践`,
          queryText: `${displayName} 稳定性 压测 告警 运行手册`,
          queryContext: `${domainLabel} ${displayName} SLO incident tracing`,
        },
      ][variant % 3]
    case 'security':
      return [
        {
          title: `${domainLabel}${displayName}审计`,
          queryText: `${displayName} 漏洞 风险 威胁 建模`,
          queryContext: `${domainLabel} ${displayName} audit threat modeling attack surface`,
        },
        {
          title: `${domainLabel}${displayName}治理`,
          queryText: `${baseName} 安全检查 依赖风险 供应链`,
          queryContext: `${domainLabel} ${scenes} vulnerability review compliance`,
        },
        {
          title: `${domainLabel}${displayName}策略`,
          queryText: `${displayName} 保护策略 最佳实践`,
          queryContext: `${domainLabel} ${displayName} security baseline hardening`,
        },
      ][variant % 3]
    case 'review':
      return [
        {
          title: `${domainLabel}${displayName}评审`,
          queryText: `${displayName} 代码审查 风险点 质量`,
          queryContext: `${domainLabel} ${displayName} review checklist defects`,
        },
        {
          title: `${domainLabel}${displayName}策略`,
          queryText: `${baseName} 测试 策略 覆盖 边界`,
          queryContext: `${domainLabel} ${scenes} review strategy unit test`,
        },
        {
          title: `${domainLabel}${displayName}门禁`,
          queryText: `${displayName} 合并前检查 与 风险评估`,
          queryContext: `${domainLabel} ${displayName} code review gating`,
        },
      ][variant % 3]
    case 'tools':
      return [
        {
          title: `${domainLabel}${displayName}使用`,
          queryText: `${displayName} 自动化 测试 截图 文档`,
          queryContext: `${domainLabel} ${displayName} tool workflow automation`,
        },
        {
          title: `${domainLabel}${displayName}检索`,
          queryText: `${baseName} 适合什么场景 怎么用`,
          queryContext: `${domainLabel} ${scenes} debug review automation`,
        },
        {
          title: `${domainLabel}${displayName}方案`,
          queryText: `${displayName} 结合项目流程 提升效率`,
          queryContext: `${domainLabel} ${displayName} productivity task execution`,
        },
      ][variant % 3]
    case 'ai':
      return [
        {
          title: `${domainLabel}${displayName}任务`,
          queryText: `${displayName} 内容生成 转写 润色`,
          queryContext: `${domainLabel} ${displayName} content generation writing`,
        },
        {
          title: `${domainLabel}${displayName}方案`,
          queryText: `${baseName} AI 处理 结果 质量`,
          queryContext: `${domainLabel} ${scenes} language processing content`,
        },
        {
          title: `${domainLabel}${displayName}检索`,
          queryText: `${displayName} 适合哪些 AI 场景`,
          queryContext: `${domainLabel} ${displayName} generation transcription refinement`,
        },
      ][variant % 3]
    case 'design':
      return [
        {
          title: `${domainLabel}${displayName}制作`,
          queryText: `${displayName} 视觉设计 演示 物料`,
          queryContext: `${domainLabel} ${displayName} presentation visual design`,
        },
        {
          title: `${domainLabel}${displayName}检索`,
          queryText: `${baseName} 适合哪种设计场景`,
          queryContext: `${domainLabel} ${scenes} creative assets storytelling`,
        },
        {
          title: `${domainLabel}${displayName}方案`,
          queryText: `${displayName} 统一风格 讲故事 信息表达`,
          queryContext: `${domainLabel} ${displayName} deck motion illustration`,
        },
      ][variant % 3]
    case 'general':
    default:
      return [
        {
          title: `${domainLabel}${displayName}检索`,
          queryText: `${displayName} 通用任务 方案 处理`,
          queryContext: `${domainLabel} ${displayName} general workflow planning debugging`,
        },
        {
          title: `${domainLabel}${displayName}场景`,
          queryText: `${baseName} 适合什么工作流`,
          queryContext: `${domainLabel} ${scenes} task planning operations`,
        },
        {
          title: `${domainLabel}${displayName}实践`,
          queryText: `${displayName} 配合项目流程如何使用`,
          queryContext: `${domainLabel} ${displayName} content ops collaboration`,
        },
      ][variant % 3]
  }
}

function buildCaseSpec(
  skill: SkillRegistryEntry,
  index: number,
  registryById: Map<string, SkillRegistryEntry>,
): GeneratedRetrievalCaseSpec {
  const variant = index % 3
  const { title, queryText, queryContext } = makeQueryVariant(skill, variant)
  const acceptable = domainAcceptables(skill, registryById)
  const forbidden = domainForbidden(skill.domain).filter(
    item => item !== skill.skillId && !acceptable.includes(item),
  )
  const caseId = `retrieval_generated_${toSlug(skill.skillId)}_001`
  const filePath = join(
    GENERATED_ROOT,
    skill.domain,
    `${skill.skillId.split('/')[1] ?? skill.skillId}.yaml`,
  )

  return {
    schemaVersion: '2026-04-12',
    caseType: 'retrieval',
    caseId,
    title,
    dataset: RETRIEVAL_COVERAGE_DATASET_ID,
    tags: ['set:coverage', skill.domain, 'generated', ...(skill.sceneTags.slice(0, 2) || [])],
    query: {
      queryText,
      queryContext,
      cwd: '/tmp/skill-eval',
      department: departmentForSkill(skill),
      domainHints: [skill.domain],
      sceneHints: sceneHintsForSkill(skill),
      priorInjectedSkillIds: [],
      priorInvokedSkillIds: [],
      limit: 5,
    },
    expected: {
      mustHitSkillIds: [skill.skillId],
      acceptableSkillIds: acceptable,
      forbiddenSkillIds: forbidden.slice(0, 2),
    },
    modeOverrides: {},
    filePath,
  }
}

async function writeCaseFile(spec: GeneratedRetrievalCaseSpec): Promise<void> {
  await mkdir(dirname(spec.filePath), { recursive: true })
  const body = YAML.stringify({
    schemaVersion: spec.schemaVersion,
    caseType: spec.caseType,
    caseId: spec.caseId,
    title: spec.title,
    dataset: spec.dataset,
    tags: spec.tags,
    query: spec.query,
    expected: spec.expected,
    modeOverrides: spec.modeOverrides,
  }).replace(/^schemaVersion: 2026-04-12$/m, 'schemaVersion: "2026-04-12"')
  await writeFile(spec.filePath, body, 'utf-8')
}

async function main(): Promise<void> {
  const registry = await readGeneratedSkillRegistry(join(PROJECT_ROOT, 'skills-flat'))
  if (!registry) {
    throw new Error('Missing skill registry at skills-flat/skill-registry.json')
  }

  const existingFiles = await listEvalCases(COVERAGE_ROOT)
  const loaded = await Promise.all(existingFiles.map(loadEvalCase))
  const coveredSkillIds = new Set(
    loaded.flatMap(item => (item.caseType === 'retrieval' ? item.expected.mustHitSkillIds : [])),
  )

  const registryById = new Map(registry.skills.map(skill => [skill.skillId, skill] as const))
  const missingSkills = registry.skills.filter(skill => !coveredSkillIds.has(skill.skillId))
  const generated = missingSkills.map((skill, index) => buildCaseSpec(skill, index, registryById))

  for (const spec of generated) {
    await writeCaseFile(spec)
  }

  const existingCount = loaded.filter(item => item.caseType === 'retrieval').length
  console.log(
    JSON.stringify(
      {
        registrySkillCount: registry.skillCount,
        existingCoverageCaseCount: existingCount,
        generatedCaseCount: generated.length,
        finalCoverageCaseCount: existingCount + generated.length,
        generatedRoot: GENERATED_ROOT,
        generatedCaseIds: generated.map(item => item.caseId),
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
