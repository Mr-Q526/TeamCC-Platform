import { join } from 'path'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { getTeamCCIdentityPath } from '../../utils/teamccPaths.js'
import { logForDebugging } from '../../utils/debug.js'
import {
  getSkillRegistryLocations,
  readGeneratedSkillRegistry,
} from './registry.js'
import {
  hasGeneratedSkillEmbeddings,
  searchSkillVectors,
  vectorSearchAvailable,
} from './vectorSearch.js'
import {
  buildSkillFactEvent,
  createSkillFactAttribution,
  createSkillTelemetryTraceId,
  logSkillFactEvent,
} from './telemetry.js'

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

export type LocalSkillSearchResult = {
  skillId: string
  name: string
  displayName: string
  description: string
  aliases: string[]
  version: string
  sourceHash: string
  score: number
  scoreBreakdown: SkillScoreBreakdown
  rank: number
  domain: string
  departmentTags: string[]
  sceneTags: string[]
  retrievalSource: 'local_lexical' | 'local_hybrid'
}

type LocalSkillSearchOptions = {
  cwd: string
  query: string
  limit?: number
  queryContext?: string
  traceId?: string
  taskId?: string
  retrievalRoundId?: string
  telemetry?: boolean
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

const DEPARTMENT_ID_TO_TAG: Record<number, string> = {
  101: 'frontend-platform',
  102: 'backend-platform',
  104: 'infra-platform',
  105: 'data-platform',
  107: 'growth',
  108: 'growth',
  111: 'security-platform',
}

const QUERY_EXPANSIONS: Record<string, string[]> = {
  '前端': ['frontend', 'react', 'ui', '页面'],
  '页面': ['ui', 'frontend', 'design'],
  '设计': ['design', 'ui', 'frontend'],
  '官网': ['landing', 'homepage', 'marketing', 'brand', 'design'],
  '首页': ['landing', 'homepage', 'hero', 'design'],
  '营销': ['marketing', 'landing', 'campaign', 'conversion', 'lead'],
  '落地页': ['landing', 'marketing', 'campaign', 'conversion', 'lead'],
  '预约': ['demo', 'signup', 'lead', 'marketing', 'landing'],
  landing: ['官网', '首页', 'marketing', 'design'],
  homepage: ['官网', '首页', 'landing', 'design'],
  demo: ['预约', 'signup', 'lead', 'marketing', 'landing'],
  '安全': ['security', 'audit', 'threat', 'model'],
  '威胁建模': ['security', 'threat', 'model'],
  '部署': ['deploy', 'vercel', 'release'],
  '发布': ['deploy', 'release', 'vercel'],
  '上线': ['deploy', 'release', 'vercel'],
  '测试': ['test', 'playwright', 'browser'],
  '自动化': ['playwright', 'browser', 'test'],
  '截图': ['screenshot', 'image'],
  '表格': ['spreadsheet', 'excel', 'sheet', 'csv'],
  '文档': ['doc', 'documentation'],
  '转录': ['transcribe', 'audio', 'speech', 'subtitle'],
  '音频': ['transcribe', 'audio', 'speech'],
  '视频': ['video', 'motion'],
  'ppt': ['ppt', 'presentation', 'slides'],
  '演示': ['presentation', 'slides', 'ppt'],
  '微信': ['wechat'],
  '小红书': ['xiaohongshu'],
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
  'content-generation': [
    'ppt',
    'presentation',
    'video',
    '文案',
    '视频',
    '演示',
  ],
}

const indexCache = new Map<string, Promise<SkillIndex>>()

export function clearSkillIndexCache(): void {
  indexCache.clear()
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }

  return []
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

function buildSearchTokens(skill: {
  name: string
  displayName: string
  description: string
  aliases: string[]
  domain: string
  departmentTags: string[]
  sceneTags: string[]
}): string[] {
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

async function loadDepartmentTag(cwd: string): Promise<string | null> {
  const identityPath = getTeamCCIdentityPath(cwd)

  try {
    const raw = await getFsImplementation().readFile(identityPath, {
      encoding: 'utf-8',
    })
    const { frontmatter } = parseFrontmatter(raw, identityPath)
    const departmentId = Number(frontmatter.department_id)
    if (!Number.isFinite(departmentId)) {
      return null
    }
    return DEPARTMENT_ID_TO_TAG[departmentId] ?? null
  } catch {
    return null
  }
}

async function buildSkillIndex(cwd: string): Promise<SkillIndex> {
  const fs = getFsImplementation()
  const indexedSkills: IndexedSkill[] = []
  const seenNames = new Set<string>()

  for (const location of getSkillRegistryLocations(cwd)) {
    const generatedRegistry = await readGeneratedSkillRegistry(location.dir)
    if (generatedRegistry && generatedRegistry.skills.length > 0) {
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
            skillPath: join(location.dir, skill.skillFile),
          }),
        )
      }

      continue
    }

    let entries
    try {
      entries = await fs.readdir(location.dir)
    } catch {
      continue
    }

    const locationSkills = await Promise.all(
      entries.map(async entry => {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) {
          return null
        }

        const skillPath = join(location.dir, entry.name, 'SKILL.md')

        try {
          const raw = await fs.readFile(skillPath, { encoding: 'utf-8' })
          const { frontmatter } = parseFrontmatter(raw, skillPath)
          const name = toStringValue(frontmatter.name, entry.name)
          const domain = toStringValue(frontmatter.domain, 'general')

          return createIndexedSkill({
            skillId: toStringValue(frontmatter.skillId, `${domain}/${name}`),
            name,
            displayName: toStringValue(frontmatter.displayName, name),
            description: toStringValue(frontmatter.description),
            aliases: toStringArray(frontmatter.aliases),
            version: toStringValue(frontmatter.version, '0.0.0'),
            sourceHash: toStringValue(frontmatter.sourceHash),
            domain,
            departmentTags: toStringArray(frontmatter.departmentTags),
            sceneTags: toStringArray(frontmatter.sceneTags),
            skillPath,
          })
        } catch (error) {
          logForDebugging(
            `[skill-search] failed to index ${skillPath}: ${error}`,
            {
              level: 'warn',
            },
          )
          return null
        }
      }),
    )

    for (const skill of locationSkills) {
      if (!skill) continue
      const key = skill.name.toLowerCase()
      if (seenNames.has(key)) {
        continue
      }
      seenNames.add(key)
      indexedSkills.push(skill)
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

async function getSkillIndex(cwd: string): Promise<SkillIndex> {
  const cacheKey = getSkillRegistryLocations(cwd)
    .map(location => location.dir)
    .join('\n')
  const cached = indexCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const loadingPromise = buildSkillIndex(cwd)
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

function toTelemetryCandidate(skill: LocalSkillSearchResult) {
  return {
    skillId: skill.skillId,
    name: skill.name,
    displayName: skill.displayName,
    aliases: skill.aliases,
    version: skill.version,
    sourceHash: skill.sourceHash,
    domain: skill.domain,
    departmentTags: skill.departmentTags,
    sceneTags: skill.sceneTags,
    rank: skill.rank,
    score: skill.score,
    scoreBreakdown: skill.scoreBreakdown,
    retrievalSource: skill.retrievalSource,
  }
}

export async function localSkillSearch({
  cwd,
  query,
  limit = 5,
  queryContext = '',
  traceId = createSkillTelemetryTraceId(),
  taskId,
  retrievalRoundId,
  telemetry = true,
}: LocalSkillSearchOptions): Promise<LocalSkillSearchResult[]> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return []
  }

  const [skillIndex, departmentTag] = await Promise.all([
    getSkillIndex(cwd),
    loadDepartmentTag(cwd),
  ])
  const skills = skillIndex.skills

  if (skills.length === 0) {
    return []
  }

  const enrichedQuery = [trimmedQuery, queryContext.trim()]
    .filter(Boolean)
    .join('\n')

  const queryTokens = expandQueryTokens(enrichedQuery)
  const hintedDomains = collectHintMatches(enrichedQuery, DOMAIN_HINTS)
  const hintedScenes = collectHintMatches(enrichedQuery, SCENE_HINTS)
  const vectorEnabled =
    vectorSearchAvailable() && (await hasGeneratedSkillEmbeddings(cwd))
  const vectorResults = vectorEnabled
    ? await searchSkillVectors(cwd, enrichedQuery, Math.max(limit * 5, 20))
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
    .slice(0, limit)

  const results = ranked.map((skill, index) => ({
    skillId: skill.skillId,
    name: skill.name,
    displayName: skill.displayName,
    description: skill.description,
    aliases: skill.aliases,
    version: skill.version,
    sourceHash: skill.sourceHash,
    score: skill.score,
    scoreBreakdown: skill.scoreBreakdown,
    rank: index + 1,
    domain: skill.domain,
    departmentTags: skill.departmentTags,
    sceneTags: skill.sceneTags,
    retrievalSource:
      skill.scoreBreakdown.vector > 0 ? ('local_hybrid' as const) : ('local_lexical' as const),
  }))

  if (telemetry) {
    const attribution = createSkillFactAttribution(taskId, traceId, retrievalRoundId)

    await logSkillFactEvent(
      buildSkillFactEvent({
        factKind: 'retrieval_run',
        source: 'system',
        cwd,
        department: departmentTag,
        domain: [...hintedDomains][0] ?? null,
        scene: [...hintedScenes][0] ?? null,
        taskId: attribution.taskId,
        traceId: attribution.traceId,
        retrievalRoundId: attribution.retrievalRoundId,
        retrieval: {
          candidateCount: results.length,
          retrievalSource: vectorEnabled ? 'local_hybrid' : 'local_lexical',
        },
        payload: {
          query: trimmedQuery,
          queryContext,
          enhancedQuery: enrichedQuery,
          limit,
          indexSkillCount: skills.length,
          returnedSkillCount: results.length,
          queryTokens,
          vectorEnabled,
          vectorCandidateCount: vectorResults.length,
          hintedDomains: [...hintedDomains],
          hintedScenes: [...hintedScenes],
          registryLocations: getSkillRegistryLocations(cwd).map(location => ({
            kind: location.kind,
            dir: location.dir,
          })),
          candidates: results.map(toTelemetryCandidate),
        },
      }),
    )

    await Promise.all(
      results.map(result =>
        logSkillFactEvent(
          buildSkillFactEvent({
            factKind: 'skill_exposed',
            source: 'system',
            cwd,
            department: departmentTag,
            scene: result.sceneTags[0] ?? [...hintedScenes][0] ?? null,
            domain: result.domain,
            taskId: attribution.taskId,
            traceId: attribution.traceId,
            retrievalRoundId: attribution.retrievalRoundId,
            skillId: result.skillId,
            skillName: result.name,
            skillVersion: result.version,
            sourceHash: result.sourceHash,
            retrieval: {
              rank: result.rank,
              candidateCount: results.length,
              retrievalSource: result.retrievalSource,
              score: result.score,
              scoreBreakdown: result.scoreBreakdown,
            },
            payload: {
              query: trimmedQuery,
            },
          }),
        ),
      ),
    )
  }

  return results
}
