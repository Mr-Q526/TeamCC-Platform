import { existsSync } from 'fs'
import { homedir } from 'os'
import { basename, delimiter, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  cosineSimilarity,
  embedQueryText,
  readGeneratedSkillEmbeddings,
  type SkillEmbeddingsManifest,
} from '../embeddings/embeddings.js'
import {
  readGeneratedSkillRegistry,
  type SkillRegistryEntry,
  type SkillRegistryManifest,
} from '../registry/registry.js'
import {
  getSkillGraphFeatures,
  readSkillRetrievalFeatures,
  type SkillGraphFeatures,
  type SkillRetrievalFeaturesManifest,
} from './retrievalFeatures.js'

type IndexedSkill = {
  skillId: string
  name: string
  displayName: string
  description: string
  aliases: string[]
  version: string
  sourceHash: string
  domain: string
  departmentTags: string[]
  sceneTags: string[]
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

export type SkillScoreBreakdown = {
  exactName: number
  displayName: number
  alias: number
  lexical: number
  bm25: number
  vector: number
  department: number
  domain: number
  scene: number
  penalty: number
}

export type SkillRetrievalRequest = {
  queryText: string
  queryContext?: string
  cwd: string
  department?: string | null
  domainHints?: string[]
  sceneHints?: string[]
  referencedFiles?: string[]
  editedFiles?: string[]
  priorInjectedSkillIds?: string[]
  priorInvokedSkillIds?: string[]
  limit: number
}

export type SkillRecallCandidate = {
  skillId: string
  name: string
  displayName: string
  description: string
  version: string
  sourceHash: string
  domain: string
  departmentTags: string[]
  sceneTags: string[]
  retrievalSource: 'local_lexical' | 'local_hybrid'
  recallScore: number
  recallScoreBreakdown: SkillScoreBreakdown
}

export type SkillRetrievalCandidate = SkillRecallCandidate & {
  graphFeatures: SkillGraphFeatures | null
  finalScore: number
  finalScoreBreakdown: {
    recallNormalized: number
    graphFeatureScore: number
  }
  rank: number
}

export type SkillRetrievalResponse = {
  schemaVersion: '2026-04-12'
  generatedAt: string
  queryText: string
  retrievalMode: 'bm25' | 'bm25_vector' | 'bm25_vector_graph'
  candidates: SkillRetrievalCandidate[]
  dataVersions: {
    registryVersion: string | null
    embeddingsGeneratedAt: string | null
    retrievalFeaturesGeneratedAt: string | null
  }
}

type VectorSkillSearchResult = {
  skillId: string
  version: string
  sourceHash: string
  score: number
}

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

const TEAMCC_CONFIG_HOME_DIR_NAME = '.teamcc'
const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const PACKAGE_SKILLS_DIR = join(PACKAGE_ROOT, 'skills-flat')

const indexCache = new Map<string, Promise<SkillIndex>>()

function splitRegistryEnv(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(new RegExp(`[${delimiter},\\n]`))
    .map(part => part.trim())
    .filter(Boolean)
}

function getTeamCCConfigHomeDir(): string {
  return process.env.TEAMCC_CONFIG_DIR || join(homedir(), TEAMCC_CONFIG_HOME_DIR_NAME)
}

function getSkillRegistryLocations(projectRoot: string): string[] {
  const locations: string[] = []
  const seen = new Set<string>()

  const pushLocation = (dir: string): void => {
    if (!dir || seen.has(dir) || !existsSync(dir)) {
      return
    }
    seen.add(dir)
    locations.push(dir)
  }

  for (const dir of splitRegistryEnv(process.env.CLAUDE_CODE_SKILL_REGISTRY_DIRS)) {
    pushLocation(dir)
  }

  const singleEnvDir = process.env.CLAUDE_CODE_SKILL_REGISTRY_DIR?.trim()
  if (singleEnvDir) {
    pushLocation(singleEnvDir)
  }

  pushLocation(PACKAGE_SKILLS_DIR)
  pushLocation(join(projectRoot, 'skills-flat'))
  pushLocation(join(getTeamCCConfigHomeDir(), 'skills-flat'))

  return locations
}

async function readFirstAvailableRegistry(
  projectRoot: string,
): Promise<{ manifest: SkillRegistryManifest; dir: string } | null> {
  for (const dir of getSkillRegistryLocations(projectRoot)) {
    const manifest = await readGeneratedSkillRegistry(dir)
    if (manifest && manifest.skills.length > 0) {
      return { manifest, dir }
    }
  }

  return null
}

async function readFirstAvailableEmbeddings(
  projectRoot: string,
): Promise<{ manifest: SkillEmbeddingsManifest; dir: string } | null> {
  for (const dir of getSkillRegistryLocations(projectRoot)) {
    const manifest = await readGeneratedSkillEmbeddings(dir)
    if (manifest && manifest.items.length > 0) {
      return { manifest, dir }
    }
  }

  return null
}

export async function readSkillRegistry(
  projectRoot = process.cwd(),
): Promise<SkillRegistryManifest | null> {
  return (await readFirstAvailableRegistry(projectRoot))?.manifest ?? null
}

export async function readSkillEmbeddings(
  projectRoot = process.cwd(),
): Promise<SkillEmbeddingsManifest | null> {
  return (await readFirstAvailableEmbeddings(projectRoot))?.manifest ?? null
}

export function clearSkillRetrievalCache(): void {
  indexCache.clear()
}

function toStringArray(values: string[] | undefined): string[] {
  return values?.map(value => value.trim()).filter(Boolean) ?? []
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[_/:.]+/g, ' ')
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

function buildSearchTokens(skill: Pick<
  SkillRegistryEntry,
  'name' | 'displayName' | 'description' | 'aliases' | 'domain' | 'departmentTags' | 'sceneTags'
>): string[] {
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

function createIndexedSkill(
  skill: Omit<IndexedSkill, 'searchTokens' | 'termFrequencies' | 'documentLength'>,
): IndexedSkill {
  const searchTokens = buildSearchTokens(skill)
  const termFrequencies: Record<string, number> = {}

  for (const token of searchTokens) {
    termFrequencies[token] = (termFrequencies[token] ?? 0) + 1
  }

  return {
    ...skill,
    searchTokens,
    termFrequencies,
    documentLength: searchTokens.length,
  }
}

function normalizeDepartmentTag(label: string | undefined | null): string | null {
  const normalized = label
    ?.trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || null
}

function expandQueryTokens(query: string): string[] {
  const tokens = new Set(tokenize(query))
  const normalizedQuery = normalizeText(query)

  for (const [trigger, expansions] of Object.entries(QUERY_EXPANSIONS)) {
    if (!normalizedQuery.includes(trigger)) continue
    for (const expansion of expansions) {
      tokens.add(expansion)
    }
  }

  return [...tokens]
}

function collectHintMatches(
  query: string,
  hintMap: Record<string, string[]>,
): Set<string> {
  const normalizedQuery = normalizeText(query)
  const matches = new Set<string>()

  for (const [key, hints] of Object.entries(hintMap)) {
    if (hints.some(hint => normalizedQuery.includes(hint.toLowerCase()))) {
      matches.add(key)
    }
  }

  return matches
}

function mergeHintValues(
  matches: Set<string>,
  additionalHints: string[] | undefined,
): Set<string> {
  const merged = new Set(matches)

  for (const hint of additionalHints ?? []) {
    const normalized = hint.trim().toLowerCase()
    if (normalized) {
      merged.add(normalized)
    }
  }

  return merged
}

async function buildSkillIndex(projectRoot: string): Promise<SkillIndex> {
  const indexedSkills: IndexedSkill[] = []
  const seenNames = new Set<string>()

  for (const dir of getSkillRegistryLocations(projectRoot)) {
    const generatedRegistry = await readGeneratedSkillRegistry(dir)
    if (!generatedRegistry || generatedRegistry.skills.length === 0) {
      continue
    }

    for (const skill of generatedRegistry.skills) {
      const key = skill.name.toLowerCase()
      if (seenNames.has(key)) {
        continue
      }

      seenNames.add(key)
      indexedSkills.push(
        createIndexedSkill({
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
          skillPath: join(dir, skill.skillFile),
        }),
      )
    }
  }

  const documentFrequency: Record<string, number> = {}
  for (const skill of indexedSkills) {
    for (const token of new Set(skill.searchTokens)) {
      documentFrequency[token] = (documentFrequency[token] ?? 0) + 1
    }
  }

  const averageDocumentLength =
    indexedSkills.length === 0
      ? 0
      : indexedSkills.reduce((sum, skill) => sum + skill.documentLength, 0) /
        indexedSkills.length

  return {
    skills: indexedSkills,
    averageDocumentLength,
    documentFrequency,
  }
}

async function getSkillIndex(projectRoot: string): Promise<SkillIndex> {
  const cacheKey = getSkillRegistryLocations(projectRoot).join('\n')
  const cached = indexCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const loadingPromise = buildSkillIndex(projectRoot)
  indexCache.set(cacheKey, loadingPromise)
  return loadingPromise
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

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function buildQueryContextWithFiles(request: SkillRetrievalRequest): string {
  const fileHints = [
    ...(request.referencedFiles ?? []),
    ...(request.editedFiles ?? []),
  ]
    .flatMap(file => {
      const trimmed = file.trim()
      if (!trimmed) return []
      return uniqueStrings([basename(trimmed), basename(dirname(trimmed))])
    })
    .join(' ')

  return [request.queryContext?.trim(), fileHints].filter(Boolean).join('\n')
}

function vectorSearchAvailable(): boolean {
  const hasApiKey =
    Boolean(process.env.ARK_API_KEY?.trim()) ||
    Boolean(process.env.VOLC_ARK_API_KEY?.trim())
  const hasModel =
    Boolean(process.env.VOLC_ARK_EMBEDDING_MODEL?.trim()) ||
    Boolean(process.env.VOLC_ARK_EMBEDDING_ENDPOINT_ID?.trim())

  return hasApiKey && hasModel
}

async function searchSkillVectors(
  projectRoot: string,
  query: string,
  limit = 20,
): Promise<VectorSkillSearchResult[]> {
  const embeddingQuery = await embedQueryText(query)
  if (!embeddingQuery) {
    return []
  }

  for (const dir of getSkillRegistryLocations(projectRoot)) {
    const manifest = await readGeneratedSkillEmbeddings(dir)
    if (!manifest || manifest.items.length === 0) {
      continue
    }

    const scored = manifest.items
      .map(item => ({
        skillId: item.skillId,
        version: item.version,
        sourceHash: item.sourceHash,
        score: cosineSimilarity(embeddingQuery.vector, item.vector),
      }))
      .filter(item => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)

    if (scored.length > 0) {
      return scored
    }
  }

  return []
}

export async function recallSkills(
  request: SkillRetrievalRequest,
): Promise<{
  retrievalMode: 'bm25' | 'bm25_vector'
  candidates: SkillRecallCandidate[]
  dataVersions: {
    registryVersion: string | null
    embeddingsGeneratedAt: string | null
  }
}> {
  const queryText = request.queryText.trim()
  if (!queryText) {
    return {
      retrievalMode: 'bm25',
      candidates: [],
      dataVersions: {
        registryVersion: null,
        embeddingsGeneratedAt: null,
      },
    }
  }

  const [skillIndex, departmentTag, registry, embeddings] = await Promise.all([
    getSkillIndex(request.cwd),
    Promise.resolve(normalizeDepartmentTag(request.department)),
    readFirstAvailableRegistry(request.cwd),
    readFirstAvailableEmbeddings(request.cwd),
  ])
  const skills = skillIndex.skills

  if (skills.length === 0) {
    return {
      retrievalMode: 'bm25',
      candidates: [],
      dataVersions: {
        registryVersion: registry?.manifest.registryVersion ?? null,
        embeddingsGeneratedAt: embeddings?.manifest.generatedAt ?? null,
      },
    }
  }

  const enrichedQuery = [queryText, buildQueryContextWithFiles(request)]
    .filter(Boolean)
    .join('\n')

  const queryTokens = expandQueryTokens(enrichedQuery)
  const hintedDomains = mergeHintValues(
    collectHintMatches(enrichedQuery, DOMAIN_HINTS),
    request.domainHints,
  )
  const hintedScenes = mergeHintValues(
    collectHintMatches(enrichedQuery, SCENE_HINTS),
    request.sceneHints,
  )
  const vectorEnabled = vectorSearchAvailable() && embeddings !== null
  const vectorResults = vectorEnabled
    ? await searchSkillVectors(request.cwd, enrichedQuery, Math.max(request.limit * 5, 20))
    : []
  const vectorScores = new Map(
    vectorResults.map(result => [result.skillId, result.score]),
  )

  const ranked = skills
    .map(skill => {
      const bm25Score = scoreSkillBm25(
        skill,
        queryTokens,
        skills.length,
        skillIndex.averageDocumentLength,
        skillIndex.documentFrequency,
      )
      const vectorScore = vectorScores.get(skill.skillId) ?? 0
      const { score, scoreBreakdown } = scoreSkill(
        skill,
        enrichedQuery,
        queryTokens,
        departmentTag,
        hintedDomains,
        hintedScenes,
        bm25Score,
        vectorScore,
      )

      return {
        ...skill,
        score,
        scoreBreakdown,
      }
    })
    .filter(
      skill =>
        skill.score >= 32 || (vectorScores.get(skill.skillId) ?? 0) >= 0.55,
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.name.localeCompare(right.name)
    })
    .slice(0, Math.max(request.limit * 5, 20))

  return {
    retrievalMode: vectorEnabled ? 'bm25_vector' : 'bm25',
    candidates: ranked.map(skill => ({
      skillId: skill.skillId,
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      version: skill.version,
      sourceHash: skill.sourceHash,
      domain: skill.domain,
      departmentTags: skill.departmentTags,
      sceneTags: skill.sceneTags,
      retrievalSource:
        skill.scoreBreakdown.vector > 0 ? 'local_hybrid' : 'local_lexical',
      recallScore: skill.score,
      recallScoreBreakdown: skill.scoreBreakdown,
    })),
    dataVersions: {
      registryVersion: registry?.manifest.registryVersion ?? null,
      embeddingsGeneratedAt: embeddings?.manifest.generatedAt ?? null,
    },
  }
}

function filterPreviouslySeenCandidates(
  candidates: SkillRecallCandidate[],
  request: SkillRetrievalRequest,
): SkillRecallCandidate[] {
  const injectedIds = new Set(request.priorInjectedSkillIds ?? [])
  const invokedIds = new Set(request.priorInvokedSkillIds ?? [])

  return candidates.filter(
    candidate =>
      !injectedIds.has(candidate.skillId) && !invokedIds.has(candidate.skillId),
  )
}

function normalizeScore(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  if (max <= min) {
    return 1
  }

  return (value - min) / (max - min)
}

function buildSkillFeatureResultKey(candidate: {
  skillId: string
  version: string | null | undefined
  sourceHash: string | null | undefined
}): string {
  const version = candidate.version?.trim()
  const sourceHash = candidate.sourceHash?.trim()
  return version && sourceHash
    ? `${candidate.skillId}::${version}::${sourceHash}`
    : candidate.skillId
}

function toGraphFeatureMap(items: SkillGraphFeatures[]): Map<string, SkillGraphFeatures> {
  return new Map(
    items.map(item => [buildSkillFeatureResultKey(item), item] as const),
  )
}

function rankRetrievedCandidates(
  candidates: SkillRecallCandidate[],
  graphFeatures: Map<string, SkillGraphFeatures>,
  useGraphRerank: boolean,
): SkillRetrievalCandidate[] {
  const filtered = candidates.slice()
  const recallScores = filtered.map(candidate => candidate.recallScore)
  const maxRecallScore = recallScores.length > 0 ? Math.max(...recallScores) : 0
  const minRecallScore = recallScores.length > 0 ? Math.min(...recallScores) : 0

  return filtered
    .map(candidate => {
      const recallNormalized = normalizeScore(
        candidate.recallScore,
        minRecallScore,
        maxRecallScore,
      )
      const features = useGraphRerank
        ? graphFeatures.get(
            buildSkillFeatureResultKey({
              skillId: candidate.skillId,
              version: candidate.version,
              sourceHash: candidate.sourceHash,
            }),
          ) ?? null
        : null
      const graphFeatureScore = features?.graphFeatureScore ?? 0
      const finalScore = useGraphRerank
        ? 0.7 * recallNormalized + 0.3 * graphFeatureScore
        : recallNormalized

      return {
        ...candidate,
        graphFeatures: features,
        finalScore,
        finalScoreBreakdown: {
          recallNormalized,
          graphFeatureScore,
        },
        rank: 0,
      }
    })
    .sort((left, right) => {
      if (right.finalScore !== left.finalScore) {
        return right.finalScore - left.finalScore
      }
      if (right.recallScore !== left.recallScore) {
        return right.recallScore - left.recallScore
      }
      return left.name.localeCompare(right.name)
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
    }))
}

export async function retrieveSkills(
  request: SkillRetrievalRequest,
): Promise<SkillRetrievalResponse> {
  const queryText = request.queryText.trim()
  if (!queryText) {
    return {
      schemaVersion: '2026-04-12',
      generatedAt: new Date().toISOString(),
      queryText,
      retrievalMode: 'bm25',
      candidates: [],
      dataVersions: {
        registryVersion: null,
        embeddingsGeneratedAt: null,
        retrievalFeaturesGeneratedAt: null,
      },
    }
  }

  const recall = await recallSkills(request)
  const filteredRecallCandidates = filterPreviouslySeenCandidates(
    recall.candidates,
    request,
  )
  const retrievalFeatures = await readSkillRetrievalFeatures()
  const useGraphRerank =
    recall.retrievalMode === 'bm25_vector' && retrievalFeatures !== null
  const graphFeatureResponse = useGraphRerank
    ? await getSkillGraphFeatures(
        {
          queryText,
          department: request.department ?? null,
          domainHints: toStringArray(request.domainHints),
          sceneHints: toStringArray(request.sceneHints),
          candidates: filteredRecallCandidates.map(candidate => ({
            skillId: candidate.skillId,
            version: candidate.version,
            sourceHash: candidate.sourceHash,
          })),
        },
        retrievalFeatures as SkillRetrievalFeaturesManifest,
      )
    : null

  const rankedCandidates = rankRetrievedCandidates(
    filteredRecallCandidates,
    toGraphFeatureMap(graphFeatureResponse?.items ?? []),
    useGraphRerank,
  ).slice(0, request.limit)

  return {
    schemaVersion: '2026-04-12',
    generatedAt: new Date().toISOString(),
    queryText,
    retrievalMode: useGraphRerank ? 'bm25_vector_graph' : recall.retrievalMode,
    candidates: rankedCandidates,
    dataVersions: {
      registryVersion: recall.dataVersions.registryVersion,
      embeddingsGeneratedAt: recall.dataVersions.embeddingsGeneratedAt,
      retrievalFeaturesGeneratedAt:
        graphFeatureResponse?.sourceFeaturesGeneratedAt ??
        retrievalFeatures?.generatedAt ??
        null,
    },
  }
}
