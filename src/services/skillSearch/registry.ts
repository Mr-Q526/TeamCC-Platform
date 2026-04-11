import { existsSync } from 'fs'
import { join, basename, dirname, delimiter } from 'path'
import { fileURLToPath } from 'url'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import type { SettingSource } from '../../utils/settings/constants.js'

export type SkillRegistryLocation = {
  dir: string
  source: SettingSource
  kind: 'env' | 'project' | 'user' | 'bundled'
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
