import { existsSync } from 'fs'
import { join, basename, dirname, delimiter } from 'path'
import { fileURLToPath } from 'url'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { logForDebugging } from '../../utils/debug.js'
import type { SettingSource } from '../../utils/settings/constants.js'

export type SkillRegistryLocation = {
  dir: string
  source: SettingSource
  kind: 'env' | 'project' | 'user' | 'bundled'
}

export const GENERATED_SKILL_REGISTRY_FILE = 'skill-registry.json'

export type SkillRegistryEntry = {
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

export type SkillRegistryManifest = {
  schemaVersion: string
  generatedAt: string
  registryVersion: string
  skillCount: number
  source: string
  skills: SkillRegistryEntry[]
}

const BUNDLED_SKILL_REGISTRY_DIR = fileURLToPath(
  new URL('../../../skills-flat', import.meta.url),
)

function splitRegistryEnv(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(new RegExp(`[${delimiter},\\n]`))
    .map(part => part.trim())
    .filter(Boolean)
}

function pushLocation(
  acc: SkillRegistryLocation[],
  seen: Set<string>,
  dir: string,
  source: SettingSource,
  kind: SkillRegistryLocation['kind'],
): void {
  if (!dir || seen.has(dir) || !existsSync(dir)) {
    return
  }

  seen.add(dir)
  acc.push({ dir, source, kind })
}

export function getSkillRegistryLocations(
  projectRoot: string,
): SkillRegistryLocation[] {
  const locations: SkillRegistryLocation[] = []
  const seen = new Set<string>()

  for (const dir of splitRegistryEnv(process.env.CLAUDE_CODE_SKILL_REGISTRY_DIRS)) {
    pushLocation(locations, seen, dir, 'userSettings', 'env')
  }

  const singleEnvDir = process.env.CLAUDE_CODE_SKILL_REGISTRY_DIR?.trim()
  if (singleEnvDir) {
    pushLocation(locations, seen, singleEnvDir, 'userSettings', 'env')
  }

  pushLocation(
    locations,
    seen,
    join(projectRoot, 'skills-flat'),
    'projectSettings',
    'project',
  )

  pushLocation(
    locations,
    seen,
    join(getClaudeConfigHomeDir(), 'skills-flat'),
    'userSettings',
    'user',
  )

  pushLocation(
    locations,
    seen,
    BUNDLED_SKILL_REGISTRY_DIR,
    'userSettings',
    'bundled',
  )

  return locations
}

export function getSkillRegistryDebugLabel(projectRoot: string): string {
  const locations = getSkillRegistryLocations(projectRoot)
  if (locations.length === 0) {
    return '[]'
  }

  return `[${locations
    .map(location => `${location.kind}:${basename(dirname(location.dir))}/${basename(location.dir)}`)
    .join(', ')}]`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

function parseRegistryEntry(value: unknown): SkillRegistryEntry | null {
  if (!isRecord(value)) {
    return null
  }

  const targetDir = toStringValue(value.targetDir)
  const skillFile =
    toStringValue(value.skillFile) || (targetDir ? `${targetDir}/SKILL.md` : '')

  return {
    skillId: toStringValue(value.skillId),
    name: toStringValue(value.name, targetDir),
    displayName: toStringValue(
      value.displayName,
      toStringValue(value.name, targetDir),
    ),
    description: toStringValue(value.description),
    aliases: toStringArray(value.aliases),
    version: toStringValue(value.version, '0.0.0'),
    sourceHash: toStringValue(value.sourceHash),
    domain: toStringValue(value.domain, 'general'),
    departmentTags: toStringArray(value.departmentTags),
    sceneTags: toStringArray(value.sceneTags),
    targetDir,
    skillFile,
  }
}

export async function readGeneratedSkillRegistry(
  dir: string,
): Promise<SkillRegistryManifest | null> {
  const filePath = join(dir, GENERATED_SKILL_REGISTRY_FILE)
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const raw = await getFsImplementation().readFile(filePath, {
      encoding: 'utf-8',
    })
    const parsed = JSON.parse(raw)
    if (!isRecord(parsed) || !Array.isArray(parsed.skills)) {
      return null
    }

    const skills = parsed.skills
      .map(parseRegistryEntry)
      .filter((entry): entry is SkillRegistryEntry => entry !== null)

    return {
      schemaVersion: toStringValue(parsed.schemaVersion, '2026-04-11'),
      generatedAt: toStringValue(parsed.generatedAt),
      registryVersion: toStringValue(parsed.registryVersion),
      skillCount:
        typeof parsed.skillCount === 'number' ? parsed.skillCount : skills.length,
      source: toStringValue(parsed.source, 'skills-flat'),
      skills,
    }
  } catch (error) {
    logForDebugging(
      `[skill-registry] failed to read generated registry ${filePath}: ${error}`,
      { level: 'warn' },
    )
    return null
  }
}
