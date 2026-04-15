import { createHash } from 'crypto'
import { readFile, readdir, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { fileURLToPath } from 'url'
import YAML from 'yaml'
import { generateSkillAliases } from '../src/skills/aliasPolicy.js'

type SkillFrontmatter = Record<string, unknown> & {
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

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SKILLS_DIR = join(PROJECT_ROOT, 'skills-flat')
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)---\s*\n?/

const FIELD_ORDER = [
  'schemaVersion',
  'skillId',
  'name',
  'displayName',
  'description',
  'aliases',
  'version',
  'sourceHash',
  'domain',
  'departmentTags',
  'sceneTags',
]

function generateAliases(frontmatter: SkillFrontmatter, dirName: string): string[] {
  const name = String(frontmatter.name || dirName)
  const displayName = String(frontmatter.displayName || name)
  const domain = String(frontmatter.domain || 'general')
  const sceneTags = Array.isArray(frontmatter.sceneTags)
    ? frontmatter.sceneTags.map(String)
    : []
  const departmentTags = Array.isArray(frontmatter.departmentTags)
    ? frontmatter.departmentTags.map(String)
    : []

  return generateSkillAliases({
    name,
    displayName,
    domain,
    aliases: Array.isArray(frontmatter.aliases) ? frontmatter.aliases.map(String) : [],
    departmentTags,
    sceneTags,
  })
}

function reorderFrontmatter(frontmatter: SkillFrontmatter): SkillFrontmatter {
  const ordered: SkillFrontmatter = {}

  for (const key of FIELD_ORDER) {
    if (frontmatter[key] !== undefined) {
      ordered[key] = frontmatter[key]
    }
  }

  for (const [key, value] of Object.entries(frontmatter)) {
    if (!FIELD_ORDER.includes(key)) {
      ordered[key] = value
    }
  }

  return ordered
}

function stringifyFrontmatter(frontmatter: SkillFrontmatter): string {
  return YAML.stringify(frontmatter, {
    lineWidth: 0,
    singleQuote: true,
  }).trimEnd()
}

function computeSourceHash(frontmatter: SkillFrontmatter, body: string): string {
  const hashFrontmatter = { ...frontmatter }
  delete hashFrontmatter.sourceHash
  const normalized = `---\n${stringifyFrontmatter(hashFrontmatter)}\n---\n${body}`
  return `sha256:${createHash('sha256').update(normalized, 'utf8').digest('hex')}`
}

async function loadSkillFile(filePath: string): Promise<{
  frontmatter: SkillFrontmatter
  body: string
}> {
  const raw = await readFile(filePath, 'utf-8')
  const match = raw.match(FRONTMATTER_REGEX)
  if (!match) {
    throw new Error(`Missing frontmatter: ${filePath}`)
  }

  return {
    frontmatter: (YAML.parse(match[1] ?? '') ?? {}) as SkillFrontmatter,
    body: raw.slice(match[0].length).replace(/^\n+/, ''),
  }
}

async function main(): Promise<void> {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true })
  const manifestSkills = []

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue

    const dirName = entry.name
    const filePath = join(SKILLS_DIR, dirName, 'SKILL.md')
    const { frontmatter, body } = await loadSkillFile(filePath)
    frontmatter.aliases = generateAliases(frontmatter, dirName)
    const ordered = reorderFrontmatter(frontmatter)
    ordered.sourceHash = computeSourceHash(ordered, body)

    await writeFile(
      filePath,
      `---\n${stringifyFrontmatter(ordered)}\n---\n\n${body}`,
      'utf-8',
    )

    manifestSkills.push({
      skillId: String(ordered.skillId),
      targetDir: join(SKILLS_DIR, dirName),
      displayName: String(ordered.displayName),
      version: String(ordered.version),
      sourceHash: String(ordered.sourceHash),
      domain: String(ordered.domain),
      departmentTags: Array.isArray(ordered.departmentTags)
        ? ordered.departmentTags
        : [],
      sceneTags: Array.isArray(ordered.sceneTags) ? ordered.sceneTags : [],
      aliases: Array.isArray(ordered.aliases) ? ordered.aliases : [],
    })
  }

  manifestSkills.sort((left, right) => left.skillId.localeCompare(right.skillId))

  await writeFile(
    join(SKILLS_DIR, 'pilot-manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: '2026-04-11',
        pilotCount: manifestSkills.length,
        skills: manifestSkills,
      },
      null,
      2,
    )}\n`,
    'utf-8',
  )

  console.log(
    `Updated aliases and sourceHash for ${manifestSkills.length} skills in ${basename(SKILLS_DIR)}`,
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
