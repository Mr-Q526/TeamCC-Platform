import { createHash } from 'crypto'
import { readFile, readdir, writeFile } from 'fs/promises'
import { join } from 'path'
import YAML from 'yaml'

type SkillFrontmatter = Record<string, unknown> & {
  schemaVersion?: string
  skillId?: string
  name?: string
  displayName?: string
  description?: string
  aliases?: string[]
  version?: string
  sourceHash?: string
  domain?: string
  departmentTags?: string[]
  sceneTags?: string[]
}

type SkillRegistryEntry = {
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
  targetDir: string
  skillFile: string
}

const SKILLS_DIR = 'skills-flat'
const OUTPUT_FILE = join(SKILLS_DIR, 'skill-registry.json')
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)---\s*\n?/

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

function uniqueStable(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(trimmed)
  }

  return result
}

async function loadSkillFrontmatter(filePath: string): Promise<SkillFrontmatter> {
  const raw = await readFile(filePath, 'utf-8')
  const match = raw.match(FRONTMATTER_REGEX)
  if (!match) {
    throw new Error(`Missing frontmatter: ${filePath}`)
  }

  return (YAML.parse(match[1] ?? '') ?? {}) as SkillFrontmatter
}

async function buildRegistryEntries(): Promise<SkillRegistryEntry[]> {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true })
  const skills: SkillRegistryEntry[] = []

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue
    }

    const targetDir = entry.name
    const skillFile = `${targetDir}/SKILL.md`
    const filePath = join(SKILLS_DIR, skillFile)
    const frontmatter = await loadSkillFrontmatter(filePath)
    const name = toStringValue(frontmatter.name, targetDir)
    const domain = toStringValue(frontmatter.domain, 'general')
    const aliases = uniqueStable(toStringArray(frontmatter.aliases))

    skills.push({
      skillId: toStringValue(frontmatter.skillId, `${domain}/${name}`),
      name,
      displayName: toStringValue(frontmatter.displayName, name),
      description: toStringValue(frontmatter.description),
      aliases,
      version: toStringValue(frontmatter.version, '0.0.0'),
      sourceHash: toStringValue(frontmatter.sourceHash),
      domain,
      departmentTags: toStringArray(frontmatter.departmentTags),
      sceneTags: toStringArray(frontmatter.sceneTags),
      targetDir,
      skillFile,
    })
  }

  return skills.sort((left, right) => left.skillId.localeCompare(right.skillId))
}

function buildRegistryVersion(skills: SkillRegistryEntry[]): string {
  const payload = JSON.stringify(skills)
  return `sha256:${createHash('sha256').update(payload, 'utf8').digest('hex')}`
}

async function main(): Promise<void> {
  const skills = await buildRegistryEntries()
  const generatedAt = new Date().toISOString()
  const registryVersion = buildRegistryVersion(skills)

  await writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(
      {
        schemaVersion: '2026-04-11',
        generatedAt,
        registryVersion,
        skillCount: skills.length,
        source: 'skills-flat',
        skills,
      },
      null,
      2,
    )}\n`,
    'utf-8',
  )

  console.log(
    `Built skill registry with ${skills.length} skills at ${OUTPUT_FILE}`,
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
