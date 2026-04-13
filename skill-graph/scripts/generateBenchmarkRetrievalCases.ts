import { mkdir, rm, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import YAML from 'yaml'
import {
  BENCHMARK_DIFFICULTY_TARGETS,
  BENCHMARK_LANGUAGE_TARGETS,
  BENCHMARK_DOMAIN_TARGETS,
  findIdentityLeak,
} from '../src/evals/benchmarkAudit.js'
import {
  getBenchmarkCasesDir,
  RETRIEVAL_BENCHMARK_DATASET_ID,
} from '../src/evals/retrievalDatasets.js'
import {
  departmentForDomain,
  domainAcceptables,
  domainForbidden,
  prettyDomain,
  sceneHintsForSkill,
  toSlug,
} from '../src/evals/retrievalCaseFactory.js'
import { readGeneratedSkillRegistry } from '../src/registry/registry.js'
import type { SkillRegistryEntry } from '../src/registry/registry.js'
import type { SkillRetrievalEvalCase } from '../src/evals/types.js'

type CliOptions = {
  outputDir: string
  arkModel: string
  arkApiKey: string
  arkBaseUrl: string
  batchSize: number
}

type DifficultyTag = keyof typeof BENCHMARK_DIFFICULTY_TARGETS
type LanguageTag = keyof typeof BENCHMARK_LANGUAGE_TARGETS
type DomainName = keyof typeof BENCHMARK_DOMAIN_TARGETS

type BenchmarkSkeleton = {
  caseId: string
  filePath: string
  domain: DomainName
  difficultyTag: DifficultyTag
  languageTag: LanguageTag
  skill: SkillRegistryEntry
  acceptableSkillIds: string[]
  forbiddenSkillIds: string[]
  bannedTerms: string[]
  promptPayload: Record<string, unknown>
}

type GeneratedPayload = {
  caseId: string
  title: string
  queryText: string
  queryContext: string
}

const PROJECT_ROOT = resolve(process.cwd())
const DEFAULT_OUTPUT_DIR = getBenchmarkCasesDir(PROJECT_ROOT)
const DEFAULT_ARK_CHAT_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    outputDir: DEFAULT_OUTPUT_DIR,
    arkModel:
      process.env.VOLC_ARK_CHAT_MODEL?.trim() ||
      process.env.ARK_CHAT_MODEL?.trim() ||
      '',
    arkApiKey:
      process.env.ARK_API_KEY?.trim() ||
      process.env.VOLC_ARK_API_KEY?.trim() ||
      '',
    arkBaseUrl:
      process.env.VOLC_ARK_CHAT_URL?.trim() ||
      process.env.ARK_CHAT_URL?.trim() ||
      DEFAULT_ARK_CHAT_URL,
    batchSize: 6,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--output-dir' && next) {
      options.outputDir = resolve(next)
      index += 1
    } else if (arg === '--ark-model' && next) {
      options.arkModel = next
      index += 1
    } else if (arg === '--ark-api-key' && next) {
      options.arkApiKey = next
      index += 1
    } else if (arg === '--ark-base-url' && next) {
      options.arkBaseUrl = next
      index += 1
    } else if (arg === '--batch-size' && next) {
      options.batchSize = Number(next)
      index += 1
    }
  }

  if (!options.arkApiKey) {
    throw new Error('Missing ARK_API_KEY or VOLC_ARK_API_KEY for benchmark generation')
  }
  if (!options.arkModel) {
    throw new Error('Missing VOLC_ARK_CHAT_MODEL or ARK_CHAT_MODEL for benchmark generation')
  }
  if (!Number.isFinite(options.batchSize) || options.batchSize <= 0) {
    throw new Error('--batch-size must be a positive number')
  }

  return options
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function stripEnglishTokens(value: string): string {
  return normalizeText(value.replace(/\b[A-Za-z][A-Za-z0-9._-]*\b/g, ' '))
}

function buildSequence<T extends string>(targets: Record<T, number>): T[] {
  const remaining = new Map(Object.entries(targets) as Array<[T, number]>)
  const sequence: T[] = []
  while ([...remaining.values()].some(count => count > 0)) {
    for (const [key, count] of remaining.entries()) {
      if (count <= 0) {
        continue
      }
      sequence.push(key)
      remaining.set(key, count - 1)
    }
  }
  return sequence
}

function summarizeSkill(skill: SkillRegistryEntry): string {
  const scenes = skill.sceneTags.length > 0 ? skill.sceneTags.join(', ') : skill.domain
  return [
    `domain=${prettyDomain(skill.domain)}`,
    `description=${skill.description}`,
    `scenes=${scenes}`,
  ].join('; ')
}

function scenarioHints(skill: SkillRegistryEntry): string[] {
  const base = skill.skillId.split('/')[1] ?? skill.skillId
  const common = skill.sceneTags.length > 0 ? skill.sceneTags : [skill.domain]
  return [base.replace(/[-_]+/g, ' '), ...common]
}

function buildDifficultyInstruction(
  difficultyTag: DifficultyTag,
  targetSkill: SkillRegistryEntry,
  acceptableSkills: SkillRegistryEntry[],
): string {
  switch (difficultyTag) {
    case 'difficulty:direct':
      return `用户诉求要明确落在目标能力上，直接表现出 ${targetSkill.domain} 任务与交付预期。`
    case 'difficulty:adjacent':
      return `用户表达要自然带到相邻技能的关键词，但最优匹配仍应是目标能力。可轻度借用这些邻近技能语义：${acceptableSkills.map(item => item.displayName).join(' / ') || '无' }。`
    case 'difficulty:ambiguous':
    default:
      return `用户表达要更偏业务目标或结果导向，存在歧义，但最终最优匹配仍应是目标能力。`
  }
}

function buildLanguageInstruction(languageTag: LanguageTag): string {
  if (languageTag === 'lang:zh-pure') {
    return '输出纯中文任务表达，不要出现英文技术词。'
  }
  return '输出中文为主的任务表达，可以自然夹带 1 到 3 个英文技术术语。'
}

function buildCaseTitle(skill: SkillRegistryEntry, difficultyTag: DifficultyTag): string {
  const difficultyLabel =
    difficultyTag === 'difficulty:direct'
      ? '直达'
      : difficultyTag === 'difficulty:adjacent'
        ? '相邻混淆'
        : '歧义'
  return `${prettyDomain(skill.domain)}${difficultyLabel}检索`
}

function defaultMixedQueryContext(domain: DomainName): string {
  switch (domain) {
    case 'frontend':
      return 'landing page UX conversion'
    case 'backend':
      return 'api service architecture'
    case 'design':
      return 'presentation storytelling visual'
    case 'tools':
      return 'workflow automation tool'
    case 'security':
      return 'security hardening abuse protection'
    case 'infra':
      return 'deploy observability release'
    case 'general':
      return 'workflow planning execution'
    case 'ai':
      return 'content generation rewrite'
    case 'review':
      return 'code review quality'
  }
}

function buildPromptPayload(
  skill: SkillRegistryEntry,
  difficultyTag: DifficultyTag,
  languageTag: LanguageTag,
  acceptableSkills: SkillRegistryEntry[],
  forbiddenSkills: SkillRegistryEntry[],
): Record<string, unknown> {
  return {
    targetSkillSummary: summarizeSkill(skill),
    userIntent: buildDifficultyInstruction(difficultyTag, skill, acceptableSkills),
    languageInstruction: buildLanguageInstruction(languageTag),
    domain: skill.domain,
    scenes: skill.sceneTags,
    departmentTags: skill.departmentTags,
    hints: scenarioHints(skill),
    acceptableSkills: acceptableSkills.map(item => summarizeSkill(item)),
    forbiddenSkills: forbiddenSkills.map(item => summarizeSkill(item)),
  }
}

function buildSkeletons(registry: SkillRegistryEntry[], outputDir: string): BenchmarkSkeleton[] {
  const registryById = new Map(registry.map(skill => [skill.skillId, skill] as const))
  const skillsByDomain = new Map<DomainName, SkillRegistryEntry[]>()
  for (const skill of registry) {
    const domain = skill.domain as DomainName
    const group = skillsByDomain.get(domain) ?? []
    group.push(skill)
    skillsByDomain.set(domain, group)
  }
  for (const group of skillsByDomain.values()) {
    group.sort((left, right) => left.skillId.localeCompare(right.skillId))
  }

  const domainSequence = buildSequence(BENCHMARK_DOMAIN_TARGETS)
  const difficultySequence = buildSequence(BENCHMARK_DIFFICULTY_TARGETS)
  const languageSequence = buildSequence(BENCHMARK_LANGUAGE_TARGETS)
  const domainIndex = new Map<DomainName, number>()
  const perSkillCount = new Map<string, number>()

  return domainSequence.map((domain, index) => {
    const skills = skillsByDomain.get(domain)
    if (!skills || skills.length === 0) {
      throw new Error(`No skills found for domain ${domain}`)
    }
    const nextIndex = domainIndex.get(domain) ?? 0
    const skill = skills[nextIndex % skills.length]
    domainIndex.set(domain, nextIndex + 1)

    const occurrence = (perSkillCount.get(skill.skillId) ?? 0) + 1
    perSkillCount.set(skill.skillId, occurrence)

    const acceptableSkillIds = domainAcceptables(skill, registryById)
    const forbiddenSkillIds = domainForbidden(skill.domain).filter(
      item => item !== skill.skillId && !acceptableSkillIds.includes(item),
    )
    const acceptableSkills = acceptableSkillIds
      .map(skillId => registryById.get(skillId))
      .filter((item): item is SkillRegistryEntry => item !== undefined)
    const forbiddenSkills = forbiddenSkillIds
      .map(skillId => registryById.get(skillId))
      .filter((item): item is SkillRegistryEntry => item !== undefined)

    const difficultyTag = difficultySequence[index] as DifficultyTag
    const languageTag = languageSequence[index] as LanguageTag
    const slug = toSlug(skill.skillId)
    const sequence = String(occurrence).padStart(3, '0')
    const caseId = `retrieval_benchmark_${slug}_${sequence}`
    const filePath = join(outputDir, domain, `${slug}-${sequence}.yaml`)
    const bannedTerms = [
      skill.skillId,
      skill.name,
      skill.displayName,
      skill.skillId.split('/')[1] ?? skill.skillId,
      (skill.skillId.split('/')[1] ?? skill.skillId).replace(/[-_]+/g, ' '),
    ]
      .map(item => item.trim())
      .filter(Boolean)

    return {
      caseId,
      filePath,
      domain,
      difficultyTag,
      languageTag,
      skill,
      acceptableSkillIds,
      forbiddenSkillIds: forbiddenSkillIds.slice(0, 2),
      bannedTerms,
      promptPayload: buildPromptPayload(
        skill,
        difficultyTag,
        languageTag,
        acceptableSkills,
        forbiddenSkills,
      ),
    }
  })
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(candidate)
}

async function callArkRewrite(
  options: CliOptions,
  batch: BenchmarkSkeleton[],
  feedback?: string,
): Promise<GeneratedPayload[]> {
  const systemPrompt = [
    '你在为 Skill 检索系统生成 benchmark query。',
    '只返回合法 JSON 数组，不要输出任何额外说明。',
    '每个元素字段必须只有 caseId, title, queryText, queryContext。',
    'queryText 要像用户直接给 TeamCC 的自然任务描述。',
    '严禁出现 target skill 的 skillId、slug、name、displayName 的精确字符串。',
    'title 8 到 20 个字。',
    'queryContext 输出 6 到 14 个空格分隔关键词，便于检索，可中英混合。',
  ].join('\n')

  const userPrompt = JSON.stringify(
    {
      batchSize: batch.length,
      correctionFeedback: feedback ?? null,
      items: batch.map(item => ({
        caseId: item.caseId,
        targetSkillId: item.skill.skillId,
        difficulty: item.difficultyTag,
        languageProfile: item.languageTag,
        bannedTerms: item.bannedTerms,
        promptPayload: item.promptPayload,
      })),
      outputRules: {
        zhPure: 'queryText 只用中文自然任务表达',
        zhMixed: 'queryText 以中文为主，可自然夹带常见英文术语',
        direct: '需求明确直达目标 skill',
        adjacent: '需求与邻近 skill 有混淆，但仍以目标 skill 最优',
        ambiguous: '需求更偏业务目标与结果导向，但仍以目标 skill 最优',
      },
    },
    null,
    2,
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)
  const response = await fetch(options.arkBaseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.arkApiKey}`,
    },
    body: JSON.stringify({
      model: options.arkModel,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))

  if (!response.ok) {
    const payload = await response.text().catch(() => '')
    throw new Error(`Ark chat request failed (${response.status}): ${payload}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ text?: string; type?: string }>
      }
    }>
  }

  const content = payload.choices?.[0]?.message?.content
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .map(item => (typeof item?.text === 'string' ? item.text : ''))
            .join('\n')
        : ''

  const parsed = extractJson(text)
  if (!Array.isArray(parsed)) {
    throw new Error('Ark chat response is not a JSON array')
  }

  return parsed.map(item => ({
    caseId: typeof item?.caseId === 'string' ? item.caseId.trim() : '',
    title: typeof item?.title === 'string' ? item.title.trim() : '',
    queryText: typeof item?.queryText === 'string' ? item.queryText.trim() : '',
    queryContext:
      typeof item?.queryContext === 'string' ? item.queryContext.trim() : '',
  }))
}

async function repairGeneratedPayload(
  options: CliOptions,
  skeleton: BenchmarkSkeleton,
  current: GeneratedPayload,
  errors: string[],
): Promise<GeneratedPayload> {
  const systemPrompt = [
    '你在修复一条 Skill 检索 benchmark query。',
    '只返回一个合法 JSON 对象，不要输出任何额外说明。',
    '字段必须只有 caseId, title, queryText, queryContext。',
    '保持目标任务和难度不变，只修复违规内容。',
    '严禁出现 bannedTerms 中的精确字符串。',
  ].join('\n')

  const userPrompt = JSON.stringify(
    {
      caseId: skeleton.caseId,
      currentOutput: current,
      errors,
      bannedTerms: skeleton.bannedTerms,
      promptPayload: skeleton.promptPayload,
    },
    null,
    2,
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)
  const response = await fetch(options.arkBaseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.arkApiKey}`,
    },
    body: JSON.stringify({
      model: options.arkModel,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))

  if (!response.ok) {
    const payload = await response.text().catch(() => '')
    throw new Error(`Ark repair request failed (${response.status}): ${payload}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ text?: string; type?: string }>
      }
    }>
  }
  const content = payload.choices?.[0]?.message?.content
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .map(item => (typeof item?.text === 'string' ? item.text : ''))
            .join('\n')
        : ''
  const parsed = extractJson(text) as Record<string, unknown>
  return {
    caseId: typeof parsed.caseId === 'string' ? parsed.caseId.trim() : skeleton.caseId,
    title: typeof parsed.title === 'string' ? parsed.title.trim() : current.title,
    queryText:
      typeof parsed.queryText === 'string' ? parsed.queryText.trim() : current.queryText,
    queryContext:
      typeof parsed.queryContext === 'string'
        ? parsed.queryContext.trim()
        : current.queryContext,
  }
}

function validateGeneratedPayload(
  skeleton: BenchmarkSkeleton,
  payload: GeneratedPayload,
): string[] {
  const errors: string[] = []
  if (payload.caseId !== skeleton.caseId) {
    errors.push(`caseId mismatch: ${payload.caseId}`)
  }
  if (!payload.title) {
    errors.push('missing title')
  }
  if (!payload.queryText) {
    errors.push('missing queryText')
  }
  if (!payload.queryContext) {
    errors.push('missing queryContext')
  }
  if (payload.queryText.length > 180) {
    errors.push(`query too long: ${payload.queryText.length}`)
  }

  const leaked = findIdentityLeak(payload.queryText, skeleton.skill)
  if (leaked) {
    errors.push(`query leaks target identity: ${leaked}`)
  }

  const leakedContext = findIdentityLeak(payload.queryContext, skeleton.skill)
  if (leakedContext) {
    errors.push(`queryContext leaks target identity: ${leakedContext}`)
  }

  return errors
}

async function rewriteBatch(
  options: CliOptions,
  batch: BenchmarkSkeleton[],
): Promise<Map<string, GeneratedPayload>> {
  let attempt = 0
  let pending = batch
  const accepted = new Map<string, GeneratedPayload>()
  let feedback = ''

  while (pending.length > 0 && attempt < 3) {
    attempt += 1
    const response = await callArkRewrite(options, pending, feedback || undefined)
    const byCaseId = new Map(response.map(item => [item.caseId, item] as const))
    const nextPending: BenchmarkSkeleton[] = []
    const errorLines: string[] = []

    for (const skeleton of pending) {
      const payload = byCaseId.get(skeleton.caseId)
      if (!payload) {
        nextPending.push(skeleton)
        errorLines.push(`${skeleton.caseId}: missing output`)
        continue
      }
      const errors = validateGeneratedPayload(skeleton, payload)
      if (errors.length > 0) {
        nextPending.push(skeleton)
        errorLines.push(`${skeleton.caseId}: ${errors.join('; ')}`)
        continue
      }
      accepted.set(skeleton.caseId, payload)
    }

    pending = nextPending
    feedback = errorLines.join('\n')
  }

  if (pending.length > 0) {
    for (const skeleton of pending) {
      const response = await callArkRewrite(options, [skeleton], feedback || undefined)
      const payload = response[0]
      if (!payload) {
        throw new Error(`Ark rewrite failed for ${skeleton.caseId}: missing output`)
      }
      let errors = validateGeneratedPayload(skeleton, payload)
      let current = payload
      if (errors.length > 0) {
        current = await repairGeneratedPayload(options, skeleton, current, errors)
        errors = validateGeneratedPayload(skeleton, current)
      }
      if (errors.length > 0) {
        throw new Error(`Ark rewrite failed for ${skeleton.caseId}: ${errors.join('; ')}`)
      }
      accepted.set(skeleton.caseId, current)
    }
  }

  return accepted
}

async function writeBenchmarkCase(
  skeleton: BenchmarkSkeleton,
  payload: GeneratedPayload,
): Promise<void> {
  const title =
    skeleton.languageTag === 'lang:zh-pure'
      ? stripEnglishTokens(payload.title || buildCaseTitle(skeleton.skill, skeleton.difficultyTag))
      : normalizeText(payload.title || buildCaseTitle(skeleton.skill, skeleton.difficultyTag))
  const queryText =
    skeleton.languageTag === 'lang:zh-pure'
      ? stripEnglishTokens(payload.queryText)
      : normalizeText(payload.queryText)
  const normalizedQueryContext = normalizeText(payload.queryContext)
  const queryContext =
    skeleton.languageTag === 'lang:zh-mixed' && !/[A-Za-z]/.test(normalizedQueryContext)
      ? `${normalizedQueryContext} ${defaultMixedQueryContext(skeleton.domain)}`.trim()
      : normalizedQueryContext

  const evalCase: SkillRetrievalEvalCase = {
    schemaVersion: '2026-04-12',
    caseType: 'retrieval',
    caseId: skeleton.caseId,
    title,
    dataset: RETRIEVAL_BENCHMARK_DATASET_ID,
    tags: [
      skeleton.domain,
      'set:benchmark',
      skeleton.difficultyTag,
      skeleton.languageTag,
      ...skeleton.skill.sceneTags.slice(0, 2),
    ],
    query: {
      queryText,
      queryContext,
      cwd: '/tmp/skill-eval',
      department: departmentForDomain(skeleton.domain),
      domainHints: [skeleton.domain],
      sceneHints: sceneHintsForSkill(skeleton.skill),
      priorInjectedSkillIds: [],
      priorInvokedSkillIds: [],
      limit: 5,
    },
    expected: {
      mustHitSkillIds: [skeleton.skill.skillId],
      acceptableSkillIds: skeleton.acceptableSkillIds,
      forbiddenSkillIds: skeleton.forbiddenSkillIds,
    },
    modeOverrides: {},
  }

  await mkdir(dirname(skeleton.filePath), { recursive: true })
  const body = YAML.stringify(evalCase).replace(
    /^schemaVersion: 2026-04-12$/m,
    'schemaVersion: "2026-04-12"',
  )
  await writeFile(skeleton.filePath, body, 'utf-8')
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const registry = await readGeneratedSkillRegistry(join(PROJECT_ROOT, 'skills-flat'))
  if (!registry) {
    throw new Error('Missing skill registry at skills-flat/skill-registry.json')
  }

  const skeletons = buildSkeletons(registry.skills, options.outputDir)
  await rm(options.outputDir, { recursive: true, force: true })
  await mkdir(options.outputDir, { recursive: true })

  const batches: BenchmarkSkeleton[][] = []
  for (let index = 0; index < skeletons.length; index += options.batchSize) {
    batches.push(skeletons.slice(index, index + options.batchSize))
  }

  const generated = new Map<string, GeneratedPayload>()
  for (const [index, batch] of batches.entries()) {
    console.error(`[benchmark-gen] batch ${index + 1}/${batches.length}`)
    const result = await rewriteBatch(options, batch)
    for (const [caseId, payload] of result.entries()) {
      generated.set(caseId, payload)
    }
    for (const skeleton of batch) {
      const payload = generated.get(skeleton.caseId)
      if (!payload) {
        throw new Error(`Missing generated payload for ${skeleton.caseId}`)
      }
      await writeBenchmarkCase(skeleton, payload)
    }
  }

  console.log(
    JSON.stringify(
      {
        caseCount: skeletons.length,
        outputDir: options.outputDir,
        arkModel: options.arkModel,
        domainTargets: BENCHMARK_DOMAIN_TARGETS,
        difficultyTargets: BENCHMARK_DIFFICULTY_TARGETS,
        languageTargets: BENCHMARK_LANGUAGE_TARGETS,
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
