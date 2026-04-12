import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'

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

export function getSkillGraphSkillsDir(projectRoot = process.cwd()): string {
  return join(projectRoot, 'skills-flat')
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
    const raw = await readFile(filePath, 'utf-8')
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
    console.warn(
      `[skill-registry] failed to read generated registry ${filePath}: ${error instanceof Error ? error.message : error}`,
    )
    return null
  }
}

export async function readSkillRegistry(
  projectRoot = process.cwd(),
): Promise<SkillRegistryManifest | null> {
  return readGeneratedSkillRegistry(getSkillGraphSkillsDir(projectRoot))
}
