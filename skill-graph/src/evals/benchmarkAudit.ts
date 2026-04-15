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
    | 'target-domain-mismatch'
    | 'target-department-mismatch'
    | 'target-scene-mismatch'
    | 'invalid-preference'
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
const GENERIC_SCENES = new Set([
  'design',
  'writing',
  'planning',
  'review',
  'architecture',
  'content-generation',
  'test',
  'security-audit',
])

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

function normalizeScopeValue(value: string): string {
  return normalizeText(value).replace(/^(dept|scene):/g, '')
}

function normalizeScopeArray(values: string[]): string[] {
  return values
    .map(value => normalizeScopeValue(value))
    .filter(Boolean)
}

function matchingSceneHints(sceneHints: string[]): {
  normalized: string[]
  specific: string[]
} {
  const normalized = normalizeScopeArray(sceneHints)
  const specific = normalized.filter(scene => !GENERIC_SCENES.has(scene))
  return {
    normalized,
    specific,
  }
}

function normalizedIdentityFragments(skill: SkillRegistryEntry): string[] {
  return [
    skill.skillId,
    skill.name,
    skill.displayName,
    skill.description,
    ...skill.aliases,
  ]
    .map(fragment => normalizeText(fragment))
    .filter(Boolean)
}

function sceneHintMatchesSkillIdentity(
  skill: SkillRegistryEntry,
  sceneHint: string,
): boolean {
  const normalizedHint = normalizeScopeValue(sceneHint)
  if (!normalizedHint) {
    return false
  }
  const normalizedHintWords = normalizedHint.replace(/[-_]+/g, ' ')
  return normalizedIdentityFragments(skill).some(fragment => {
    return (
      fragment.includes(normalizedHint) ||
      fragment.includes(normalizedHintWords) ||
      normalizedHint.includes(fragment) ||
      normalizedHintWords.includes(fragment)
    )
  })
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
      if (domainTag && normalizeText(targetSkill.domain) !== normalizeText(domainTag)) {
        issues.push({
          caseId: item.caseId,
          type: 'target-domain-mismatch',
          detail: `target skill domain ${targetSkill.domain} does not match case domain ${domainTag}`,
        })
      }

      const queryDepartment = item.query.department
        ? normalizeScopeValue(item.query.department)
        : null
      const targetDepartments = normalizeScopeArray(targetSkill.departmentTags)
      if (
        queryDepartment &&
        targetDepartments.length > 0 &&
        !targetDepartments.includes(queryDepartment)
      ) {
        issues.push({
          caseId: item.caseId,
          type: 'target-department-mismatch',
          detail: `target skill departments [${targetDepartments.join(', ')}] do not match query department ${queryDepartment}`,
        })
      }

      const sceneHints = matchingSceneHints(item.query.sceneHints)
      const targetScenes = normalizeScopeArray(targetSkill.sceneTags)
      const requiredScenes =
        sceneHints.specific.length > 0 ? sceneHints.specific : sceneHints.normalized
      if (
        requiredScenes.length > 0 &&
        !requiredScenes.some(scene =>
          targetScenes.includes(scene) || sceneHintMatchesSkillIdentity(targetSkill, scene),
        )
      ) {
        issues.push({
          caseId: item.caseId,
          type: 'target-scene-mismatch',
          detail: `target skill scenes [${targetScenes.join(', ')}] do not match query scenes [${requiredScenes.join(', ')}]`,
        })
      }

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

    for (const skillId of [
      ...item.expected.acceptableSkillIds,
      ...item.expected.forbiddenSkillIds,
    ]) {
      if (!input.registryById.has(skillId)) {
        issues.push({
          caseId: item.caseId,
          type: 'missing-skill',
          detail: `Unknown referenced skillId ${skillId}`,
        })
      }
    }

    if (item.expected.preference) {
      const preference = item.expected.preference
      const preferredSkill = input.registryById.get(preference.preferredSkillId) ?? null
      const competingSkill = input.registryById.get(preference.competingSkillId) ?? null

      if (preference.preferredSkillId !== targetSkillId) {
        issues.push({
          caseId: item.caseId,
          type: 'invalid-preference',
          detail: `preferredSkillId ${preference.preferredSkillId} must equal target mustHitSkillId ${targetSkillId}`,
        })
      }

      if (!acceptableSet.has(preference.competingSkillId)) {
        issues.push({
          caseId: item.caseId,
          type: 'invalid-preference',
          detail: `competingSkillId ${preference.competingSkillId} must be included in acceptableSkillIds`,
        })
      }

      if (!preferredSkill || !competingSkill) {
        issues.push({
          caseId: item.caseId,
          type: 'invalid-preference',
          detail: `preferred or competing skill missing from registry`,
        })
      } else {
        if (preferredSkill.domain !== competingSkill.domain) {
          issues.push({
            caseId: item.caseId,
            type: 'invalid-preference',
            detail: `preferred and competing skills must share domain, got ${preferredSkill.domain} vs ${competingSkill.domain}`,
          })
        }

        if (item.tags.includes('set:graph-preference')) {
          const preferredScenes = normalizeScopeArray(preferredSkill.sceneTags)
          const competingScenes = normalizeScopeArray(competingSkill.sceneTags)
          const overlapScenes = preferredScenes.filter(scene =>
            competingScenes.includes(scene),
          )
          if (overlapScenes.length === 0) {
            issues.push({
              caseId: item.caseId,
              type: 'invalid-preference',
              detail: `graph-preference preferred and competing skills must share at least one scene tag`,
            })
          }
        }
      }
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
