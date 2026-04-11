import { join } from 'path'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { logForDebugging } from '../../utils/debug.js'
import { getSkillRegistryLocations } from './registry.js'

type IndexedSkill = {
  name: string
  displayName: string
  description: string
  domain: string
  departmentTags: string[]
  sceneTags: string[]
}

export type LocalSkillSearchResult = {
  name: string
  description: string
  score: number
  domain: string
  departmentTags: string[]
  sceneTags: string[]
}

type LocalSkillSearchOptions = {
  cwd: string
  query: string
  limit?: number
  queryContext?: string
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
  landing: ['官网', '首页', 'marketing', 'design'],
  homepage: ['官网', '首页', 'landing', 'design'],
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
    'landing',
    'homepage',
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
    'landing',
    'homepage',
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

const indexCache = new Map<string, Promise<IndexedSkill[]>>()

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
  const identityPath = join(cwd, '.claude', 'identity', 'active.md')

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

async function buildSkillIndex(cwd: string): Promise<IndexedSkill[]> {
  const fs = getFsImplementation()
  const indexedSkills: IndexedSkill[] = []
  const seenNames = new Set<string>()

  for (const location of getSkillRegistryLocations(cwd)) {
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

          return {
            name: toStringValue(frontmatter.name, entry.name),
            displayName: toStringValue(frontmatter.displayName, entry.name),
            description: toStringValue(frontmatter.description),
            domain: toStringValue(frontmatter.domain, 'general'),
            departmentTags: toStringArray(frontmatter.departmentTags),
            sceneTags: toStringArray(frontmatter.sceneTags),
          } satisfies IndexedSkill
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

  return indexedSkills
}

async function getSkillIndex(cwd: string): Promise<IndexedSkill[]> {
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

function scoreSkill(
  skill: IndexedSkill,
  query: string,
  queryTokens: string[],
  departmentTag: string | null,
  hintedDomains: Set<string>,
  hintedScenes: Set<string>,
): number {
  const normalizedQuery = normalizeText(query)
  const normalizedName = normalizeText(skill.name)
  const normalizedDisplayName = normalizeText(skill.displayName)
  const normalizedDescription = normalizeText(skill.description)
  const searchableTokens = [
    ...tokenize(skill.name),
    ...tokenize(skill.displayName),
    ...tokenize(skill.description),
    ...tokenize(skill.domain),
    ...skill.departmentTags.flatMap(tokenize),
    ...skill.sceneTags.flatMap(tokenize),
  ]
  const searchableTokenSet = new Set(searchableTokens)

  let score = 0

  if (normalizedQuery.includes(normalizedName)) {
    score += 80
  }

  if (normalizedDisplayName && normalizedQuery.includes(normalizedDisplayName)) {
    score += 55
  }

  for (const token of queryTokens) {
    if (normalizedName.includes(token)) {
      score += 26
      continue
    }

    if (normalizedDisplayName.includes(token)) {
      score += 20
      continue
    }

    if (normalizedDescription.includes(token)) {
      score += 10
      continue
    }

    if (searchableTokenSet.has(token)) {
      score += 8
    }
  }

  if (departmentTag) {
    if (skill.departmentTags.includes(departmentTag)) {
      score += 18
    } else if (skill.departmentTags.length > 0) {
      score -= 4
    }
  }

  if (hintedDomains.has(skill.domain)) {
    score += 18
  }

  for (const sceneTag of skill.sceneTags) {
    if (hintedScenes.has(sceneTag)) {
      score += 14
    }
  }

  if (
    queryTokens.length > 0 &&
    skill.departmentTags.length === 0 &&
    hintedDomains.size === 0 &&
    hintedScenes.size === 0
  ) {
    score -= 4
  }

  return score
}

export async function localSkillSearch({
  cwd,
  query,
  limit = 5,
  queryContext = '',
}: LocalSkillSearchOptions): Promise<LocalSkillSearchResult[]> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return []
  }

  const [skills, departmentTag] = await Promise.all([
    getSkillIndex(cwd),
    loadDepartmentTag(cwd),
  ])

  if (skills.length === 0) {
    return []
  }

  const enrichedQuery = [trimmedQuery, queryContext.trim()]
    .filter(Boolean)
    .join('\n')

  const queryTokens = expandQueryTokens(enrichedQuery)
  const hintedDomains = collectHintMatches(enrichedQuery, DOMAIN_HINTS)
  const hintedScenes = collectHintMatches(enrichedQuery, SCENE_HINTS)

  const ranked = skills
    .map(skill => ({
      ...skill,
      score: scoreSkill(
        skill,
        enrichedQuery,
        queryTokens,
        departmentTag,
        hintedDomains,
        hintedScenes,
      ),
    }))
    .filter(skill => skill.score >= 32)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.name.localeCompare(right.name)
    })
    .slice(0, limit)

  return ranked.map(skill => ({
    name: skill.name,
    description: skill.description,
    score: skill.score,
    domain: skill.domain,
    departmentTags: skill.departmentTags,
    sceneTags: skill.sceneTags,
  }))
}
