import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import YAML from 'yaml'
import {
  auditSkillAlias,
  normalizeAlias,
  type SkillAliasAuditIssue,
} from '../src/skills/aliasPolicy.js'

type SkillFrontmatter = {
  skillId?: string
  name?: string
  displayName?: string
  aliases?: string[]
  domain?: string
  departmentTags?: string[]
  sceneTags?: string[]
}

type AliasOccurrence = {
  skillId: string
  name: string
}

type AliasAuditSummary = {
  schemaVersion: '2026-04-14'
  skillCount: number
  aliasCount: number
  avgAliasesPerSkill: number
  maxAliasesPerSkill: number
  issueCount: number
  issueCountsByReason: Record<SkillAliasAuditIssue['reason'], number>
  genericIssueAliases: Array<{
    alias: string
    reason: SkillAliasAuditIssue['reason']
    skillCount: number
    skills: string[]
  }>
  topRepeatedAliases: Array<{
    alias: string
    skillCount: number
    skills: string[]
  }>
}

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SKILLS_DIR = join(PROJECT_ROOT, 'skills-flat')
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)---\s*\n?/

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
    : []
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

async function loadFrontmatter(filePath: string): Promise<SkillFrontmatter> {
  const raw = await readFile(filePath, 'utf-8')
  const match = raw.match(FRONTMATTER_REGEX)
  if (!match) {
    throw new Error(`Missing frontmatter: ${filePath}`)
  }
  return (YAML.parse(match[1] ?? '') ?? {}) as SkillFrontmatter
}

async function auditAliases(): Promise<AliasAuditSummary> {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true })
  const aliasOccurrences = new Map<string, { alias: string; occurrences: AliasOccurrence[] }>()
  const issueOccurrences = new Map<
    string,
    {
      alias: string
      reason: SkillAliasAuditIssue['reason']
      occurrences: AliasOccurrence[]
    }
  >()
  const issueCountsByReason: Record<SkillAliasAuditIssue['reason'], number> = {
    generic_exact: 0,
    metadata_tag: 0,
    platform_tag: 0,
    too_short: 0,
  }
  let skillCount = 0
  let aliasCount = 0
  let maxAliasesPerSkill = 0

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue

    const dirName = entry.name
    const frontmatter = await loadFrontmatter(join(SKILLS_DIR, dirName, 'SKILL.md'))
    const name = toStringValue(frontmatter.name, dirName)
    const skillId = toStringValue(frontmatter.skillId, name)
    const aliases = toStringArray(frontmatter.aliases).map(normalizeAlias)
    const occurrence = { skillId, name }
    skillCount++
    aliasCount += aliases.length
    maxAliasesPerSkill = Math.max(maxAliasesPerSkill, aliases.length)

    for (const alias of aliases) {
      const aliasKey = alias.toLowerCase()
      const bucket = aliasOccurrences.get(aliasKey) ?? {
        alias,
        occurrences: [],
      }
      bucket.occurrences.push(occurrence)
      aliasOccurrences.set(aliasKey, bucket)

      const issue = auditSkillAlias(alias, {
        name,
        displayName: toStringValue(frontmatter.displayName, name),
        domain: toStringValue(frontmatter.domain, 'general'),
        aliases,
        departmentTags: toStringArray(frontmatter.departmentTags),
        sceneTags: toStringArray(frontmatter.sceneTags),
      })
      if (!issue) continue

      issueCountsByReason[issue.reason]++
      const issueKey = `${issue.reason}\n${aliasKey}`
      const issueBucket = issueOccurrences.get(issueKey) ?? {
        alias,
        reason: issue.reason,
        occurrences: [],
      }
      issueBucket.occurrences.push(occurrence)
      issueOccurrences.set(issueKey, issueBucket)
    }
  }

  const topRepeatedAliases = [...aliasOccurrences.values()]
    .filter(item => item.occurrences.length > 1)
    .sort(
      (left, right) =>
        right.occurrences.length - left.occurrences.length ||
        left.alias.localeCompare(right.alias),
    )
    .slice(0, 30)
    .map(item => ({
      alias: item.alias,
      skillCount: item.occurrences.length,
      skills: item.occurrences.map(occurrence => occurrence.skillId).sort(),
    }))

  const genericIssueAliases = [...issueOccurrences.values()]
    .sort(
      (left, right) =>
        right.occurrences.length - left.occurrences.length ||
        left.alias.localeCompare(right.alias),
    )
    .map(item => ({
      alias: item.alias,
      reason: item.reason,
      skillCount: item.occurrences.length,
      skills: item.occurrences.map(occurrence => occurrence.skillId).sort(),
    }))

  return {
    schemaVersion: '2026-04-14',
    skillCount,
    aliasCount,
    avgAliasesPerSkill:
      skillCount > 0 ? Number((aliasCount / skillCount).toFixed(2)) : 0,
    maxAliasesPerSkill,
    issueCount: genericIssueAliases.reduce(
      (sum, item) => sum + item.skillCount,
      0,
    ),
    issueCountsByReason,
    genericIssueAliases,
    topRepeatedAliases,
  }
}

async function main(): Promise<void> {
  const summary = await auditAliases()
  console.log(JSON.stringify(summary, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
