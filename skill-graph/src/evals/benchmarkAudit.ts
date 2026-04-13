import type { SkillRetrievalEvalCase } from './types.js'
import type { SkillRegistryEntry } from '../registry/registry.js'

export const BENCHMARK_DOMAIN_TARGETS = {
  frontend: 90,
  backend: 42,
  design: 36,
  tools: 30,
  security: 24,
  infra: 24,
  general: 24,
  ai: 18,
  review: 12,
} as const

export const BENCHMARK_DIFFICULTY_TARGETS = {
  'difficulty:direct': 150,
  'difficulty:adjacent': 105,
  'difficulty:ambiguous': 45,
} as const

export const BENCHMARK_LANGUAGE_TARGETS = {
  'lang:zh-mixed': 210,
  'lang:zh-pure': 90,
} as const

export const BENCHMARK_REVIEW_SAMPLE_SIZE = 36

export type BenchmarkAuditIssue = {
  caseId: string
  type:
    | 'missing-skill'
    | 'duplicate-case-id'
    | 'duplicate-query'
    | 'near-duplicate-query'
    | 'empty-query'
    | 'query-too-long'
    | 'identity-leak'
    | 'invalid-expected'
    | 'missing-domain-tag'
    | 'missing-difficulty-tag'
    | 'missing-language-tag'
  detail: string
}

export type BenchmarkAuditSummary = {
  caseCount: number
  byDomain: Record<string, number>
  byDifficulty: Record<string, number>
  byLanguage: Record<string, number>
  issueCount: number
  issues: BenchmarkAuditIssue[]
}

const KNOWN_DOMAINS = new Set(Object.keys(BENCHMARK_DOMAIN_TARGETS))

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[“”"'`]+/g, '')
}

function charTrigrams(value: string): Set<string> {
  const normalized = normalizeText(value).replace(/\s+/g, '')
  if (normalized.length <= 3) {
    return new Set(normalized ? [normalized] : [])
  }
  const grams = new Set<string>()
  for (let index = 0; index <= normalized.length - 3; index++) {
    grams.add(normalized.slice(index, index + 3))
  }
  return grams
}

function diceSimilarity(left: string, right: string): number {
  const leftGrams = charTrigrams(left)
  const rightGrams = charTrigrams(right)
  if (leftGrams.size === 0 || rightGrams.size === 0) {
    return 0
  }

  let overlap = 0
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) {
      overlap += 1
    }
  }

  return (2 * overlap) / (leftGrams.size + rightGrams.size)
}

function findTag(tags: string[], prefix: string): string | null {
  return tags.find(tag => tag.startsWith(prefix)) ?? null
}

export function findDomainTag(tags: string[]): string | null {
  return tags.find(tag => KNOWN_DOMAINS.has(tag)) ?? null
}

export function buildSkillIdentityFragments(skill: SkillRegistryEntry): string[] {
  const slug = skill.skillId.split('/')[1] ?? skill.skillId
  return [
    skill.skillId,
    skill.name,
    skill.displayName,
    slug,
    slug.replace(/[-_]+/g, ' '),
  ]
    .map(fragment => normalizeText(fragment))
    .filter(fragment => {
      if (!fragment) {
        return false
      }
      if (fragment.includes('/')) {
        return true
      }
      const isAscii = /^[a-z0-9 _-]+$/.test(fragment)
      if (isAscii && fragment.replace(/[^a-z0-9]/g, '').length < 4) {
        return false
      }
      return true
    })
    .filter(Boolean)
}

export function findIdentityLeak(
  queryText: string,
  skill: SkillRegistryEntry,
): string | null {
  const normalized = normalizeText(queryText)
  for (const fragment of buildSkillIdentityFragments(skill)) {
    if (fragment && normalized.includes(fragment)) {
      return fragment
    }
  }
  return null
}

export function buildBenchmarkReviewSample(
  cases: SkillRetrievalEvalCase[],
  sampleSize = BENCHMARK_REVIEW_SAMPLE_SIZE,
): SkillRetrievalEvalCase[] {
  const chosen = new Map<string, SkillRetrievalEvalCase>()
  const domains = Object.keys(BENCHMARK_DOMAIN_TARGETS)
  const difficulties = Object.keys(BENCHMARK_DIFFICULTY_TARGETS)
  const preferredLanguages = ['lang:zh-mixed', 'lang:zh-pure'] as const

  for (const domain of domains) {
    for (const difficulty of difficulties) {
      const pool = cases.filter(item => {
        return findDomainTag(item.tags) === domain && item.tags.includes(difficulty)
      })
      if (pool.length === 0) {
        continue
      }

      for (const languageTag of preferredLanguages) {
        const found = pool.find(item => item.tags.includes(languageTag))
        if (found) {
          chosen.set(found.caseId, found)
          break
        }
      }
      if (chosen.size >= sampleSize) {
        return [...chosen.values()].slice(0, sampleSize)
      }
    }
  }

  for (const domain of domains) {
    const pool = cases.filter(item => findDomainTag(item.tags) === domain)
    for (const item of pool) {
      chosen.set(item.caseId, item)
      if (chosen.size >= sampleSize) {
        return [...chosen.values()].slice(0, sampleSize)
      }
    }
  }

  for (const item of cases) {
    chosen.set(item.caseId, item)
    if (chosen.size >= sampleSize) {
      break
    }
  }

  return [...chosen.values()].slice(0, sampleSize)
}

export function auditBenchmarkCases(input: {
  cases: SkillRetrievalEvalCase[]
  registryById: Map<string, SkillRegistryEntry>
}): BenchmarkAuditSummary {
  const issues: BenchmarkAuditIssue[] = []
  const byDomain: Record<string, number> = {}
  const byDifficulty: Record<string, number> = {}
  const byLanguage: Record<string, number> = {}
  const seenCaseIds = new Set<string>()
  const seenQueries = new Map<string, string>()

  for (const item of input.cases) {
    const queryText = item.query.queryText.trim()
    const domainTag = findDomainTag(item.tags)
    const difficultyTag = findTag(item.tags, 'difficulty:')
    const languageTag = findTag(item.tags, 'lang:')

    if (seenCaseIds.has(item.caseId)) {
      issues.push({
        caseId: item.caseId,
        type: 'duplicate-case-id',
        detail: `Duplicated caseId ${item.caseId}`,
      })
    }
    seenCaseIds.add(item.caseId)

    if (!queryText) {
      issues.push({
        caseId: item.caseId,
        type: 'empty-query',
        detail: 'query.queryText is empty',
      })
    }
    if (queryText.length > 180) {
      issues.push({
        caseId: item.caseId,
        type: 'query-too-long',
        detail: `query.queryText length ${queryText.length} exceeds 180`,
      })
    }

    const normalizedQuery = normalizeText(queryText)
    const existingQueryCaseId = seenQueries.get(normalizedQuery)
    if (existingQueryCaseId && existingQueryCaseId !== item.caseId) {
      issues.push({
        caseId: item.caseId,
        type: 'duplicate-query',
        detail: `Duplicated queryText with ${existingQueryCaseId}`,
      })
    } else {
      seenQueries.set(normalizedQuery, item.caseId)
    }

    if (!domainTag) {
      issues.push({
        caseId: item.caseId,
        type: 'missing-domain-tag',
        detail: 'Missing primary domain tag',
      })
    } else {
      byDomain[domainTag] = (byDomain[domainTag] ?? 0) + 1
    }

    if (!difficultyTag) {
      issues.push({
        caseId: item.caseId,
        type: 'missing-difficulty-tag',
        detail: 'Missing difficulty:* tag',
      })
    } else {
      byDifficulty[difficultyTag] = (byDifficulty[difficultyTag] ?? 0) + 1
    }

    if (!languageTag) {
      issues.push({
        caseId: item.caseId,
        type: 'missing-language-tag',
        detail: 'Missing lang:* tag',
      })
    } else {
      byLanguage[languageTag] = (byLanguage[languageTag] ?? 0) + 1
    }

    if (item.expected.mustHitSkillIds.length !== 1) {
      issues.push({
        caseId: item.caseId,
        type: 'invalid-expected',
        detail: `mustHitSkillIds must contain exactly 1 skill, got ${item.expected.mustHitSkillIds.length}`,
      })
    }

    const targetSkillId = item.expected.mustHitSkillIds[0]
    const targetSkill = targetSkillId ? input.registryById.get(targetSkillId) : null
    if (!targetSkill) {
      issues.push({
        caseId: item.caseId,
        type: 'missing-skill',
        detail: `Unknown target skillId ${targetSkillId ?? 'n/a'}`,
      })
    } else {
      const leaked = findIdentityLeak(queryText, targetSkill)
      if (leaked) {
        issues.push({
          caseId: item.caseId,
          type: 'identity-leak',
          detail: `query contains target skill identity fragment "${leaked}"`,
        })
      }
    }

    const expectedSet = new Set(item.expected.mustHitSkillIds)
    const acceptableSet = new Set(item.expected.acceptableSkillIds)
    const forbiddenSet = new Set(item.expected.forbiddenSkillIds)
    const overlap = [
      ...expectedSet,
    ].filter(skillId => acceptableSet.has(skillId) || forbiddenSet.has(skillId))
    if (overlap.length > 0) {
      issues.push({
        caseId: item.caseId,
        type: 'invalid-expected',
        detail: `expected skill overlaps with acceptable/forbidden: ${overlap.join(', ')}`,
      })
    }
  }

  for (let left = 0; left < input.cases.length; left++) {
    for (let right = left + 1; right < input.cases.length; right++) {
      const leftCase = input.cases[left]
      const rightCase = input.cases[right]
      if (findDomainTag(leftCase.tags) !== findDomainTag(rightCase.tags)) {
        continue
      }
      const similarity = diceSimilarity(leftCase.query.queryText, rightCase.query.queryText)
      if (similarity >= 0.9) {
        issues.push({
          caseId: rightCase.caseId,
          type: 'near-duplicate-query',
          detail: `Near duplicate with ${leftCase.caseId} (${similarity.toFixed(3)})`,
        })
      }
    }
  }

  return {
    caseCount: input.cases.length,
    byDomain,
    byDifficulty,
    byLanguage,
    issueCount: issues.length,
    issues,
  }
}
