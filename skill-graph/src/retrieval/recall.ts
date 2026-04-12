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

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url))

const QUERY_EXPANSIONS: Record<string, string[]> = {
  前端: ['frontend', 'react', 'ui', '页面'],
  页面: ['ui', 'frontend', 'design'],
  设计: ['design', 'ui', 'frontend'],
  官网: ['landing', 'homepage', 'marketing', 'brand', 'design'],
  首页: ['landing', 'homepage', 'hero', 'design'],
  营销: ['marketing', 'landing', 'campaign', 'conversion', 'lead'],
  落地页: ['landing', 'marketing', 'campaign', 'conversion', 'lead'],
  预约: ['demo', 'signup', 'lead', 'marketing', 'landing'],
  landing: ['官网', '首页', 'marketing', 'design'],
  homepage: ['官网', '首页', 'landing', 'design'],
  demo: ['预约', 'signup', 'lead', 'marketing', 'landing'],
  安全: ['security', 'audit', 'threat', 'model'],
  威胁建模: ['security', 'threat', 'model'],
  部署: ['deploy', 'vercel', 'release'],
  发布: ['deploy', 'release', 'vercel'],
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
  微信: ['wechat'],
  小红书: ['xiaohongshu'],
}

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
    }))

  return {
    candidates,
    registryVersion: registryManifest.registryVersion,
    embeddingsGeneratedAt: embeddingsManifest?.generatedAt ?? null,
    vectorAvailable: vectorScores.size > 0,
  }
}
