import memoize from 'lodash-es/memoize.js'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { fileSuffixForOauthConfig } from '../constants/oauth.js'
import { getFsImplementation } from './fsOperations.js'

export const TEAMCC_CONFIG_HOME_DIR_NAME = '.teamcc'
export const LEGACY_CLAUDE_CONFIG_HOME_DIR_NAME = '.claude'
export const TEAMCC_PROJECT_DIR_NAME = '.teamcc'
export const LEGACY_CLAUDE_PROJECT_DIR_NAME = '.claude'
export const TEAMCC_MEMORY_FILENAME = 'TEAMCC.md'
export const LEGACY_CLAUDE_MEMORY_FILENAME = 'CLAUDE.md'
export const TEAMCC_LOCAL_MEMORY_FILENAME = 'TEAMCC.local.md'
export const LEGACY_CLAUDE_LOCAL_MEMORY_FILENAME = 'CLAUDE.local.md'
export const TEAMCC_RULES_DIR_NAME = 'rules'
export const TEAMCC_MIGRATION_MARKER = '.migrated-from-claude'

export const getTeamCCConfigHomeDir = memoize(
  (): string => {
    return (
      process.env.TEAMCC_CONFIG_DIR ||
      join(homedir(), TEAMCC_CONFIG_HOME_DIR_NAME)
    ).normalize('NFC')
  },
  () =>
    `${process.env.TEAMCC_CONFIG_DIR || ''}|${process.env.HOME || ''}|${process.env.USERPROFILE || ''}`,
)

export const getGlobalTeamCCFile = memoize(
  (): string => {
    return join(
      getTeamCCConfigHomeDir(),
      `config${fileSuffixForOauthConfig()}.json`,
    ).normalize('NFC')
  },
  () =>
    `${process.env.TEAMCC_CONFIG_DIR || ''}|${process.env.HOME || ''}|${process.env.USERPROFILE || ''}|${fileSuffixForOauthConfig()}`,
)

function getLegacyClaudeConfigHomeDir(): string {
  return (
    process.env.CLAUDE_CONFIG_DIR ||
    join(homedir(), LEGACY_CLAUDE_CONFIG_HOME_DIR_NAME)
  ).normalize('NFC')
}

function getLegacyClaudeGlobalRootDir(): string {
  return (process.env.CLAUDE_CONFIG_DIR || homedir()).normalize('NFC')
}

function getLegacyClaudeGlobalConfigCandidates(): string[] {
  const suffix = fileSuffixForOauthConfig()
  return [
    join(getLegacyClaudeConfigHomeDir(), '.config.json'),
    join(getLegacyClaudeGlobalRootDir(), `.claude${suffix}.json`),
  ]
}

export function getTeamCCProjectDir(cwd: string): string {
  return join(cwd, TEAMCC_PROJECT_DIR_NAME)
}

export function getTeamCCProjectConfigFile(cwd: string): string {
  return join(getTeamCCProjectDir(cwd), 'teamcc.json')
}

export function getTeamCCProjectCacheDir(cwd: string): string {
  return join(getTeamCCProjectDir(cwd), 'cache')
}

export function getTeamCCIdentityPath(cwd: string): string {
  return join(getTeamCCProjectDir(cwd), 'identity', 'active.md')
}

export function getTeamCCWorktreesDir(repoRoot: string): string {
  return join(repoRoot, TEAMCC_PROJECT_DIR_NAME, 'worktrees')
}

export function getLegacyClaudeProjectDir(cwd: string): string {
  return join(cwd, LEGACY_CLAUDE_PROJECT_DIR_NAME)
}

function getMigrationMarkerPath(dir: string): string {
  return join(dir, TEAMCC_MIGRATION_MARKER)
}

function pathsEqual(a: string, b: string): boolean {
  return a.normalize('NFC') === b.normalize('NFC')
}

function copyEntryIfMissing(source: string, target: string): boolean {
  const fs = getFsImplementation()
  if (!fs.existsSync(source) || fs.existsSync(target)) {
    return false
  }

  const stat = fs.lstatSync(source)
  if (stat.isDirectory()) {
    fs.mkdirSync(target)
    let copied = false
    for (const entry of fs.readdirStringSync(source)) {
      copied =
        copyEntryIfMissing(join(source, entry), join(target, entry)) || copied
    }
    return copied || true
  }

  fs.mkdirSync(dirname(target))
  fs.copyFileSync(source, target)
  return true
}

function copyDirContentsWithRootRenames(
  sourceDir: string,
  targetDir: string,
  rootRenames: Record<string, string> = {},
  skippedRootEntries: Set<string> = new Set(),
): boolean {
  const fs = getFsImplementation()
  if (!fs.existsSync(sourceDir) || !fs.lstatSync(sourceDir).isDirectory()) {
    return false
  }

  fs.mkdirSync(targetDir)
  let copied = false
  for (const entry of fs.readdirStringSync(sourceDir)) {
    if (skippedRootEntries.has(entry)) {
      continue
    }

    copied =
      copyEntryIfMissing(
        join(sourceDir, entry),
        join(targetDir, rootRenames[entry] ?? entry),
      ) || copied
  }
  return copied
}

function markMigrationComplete(dir: string): void {
  const fs = getFsImplementation()
  fs.mkdirSync(dir)
  const markerPath = getMigrationMarkerPath(dir)
  if (!fs.existsSync(markerPath)) {
    fs.appendFileSync(markerPath, 'migrated\n')
  }
}

/**
 * One-time migration from Claude-era global config files to TeamCC.
 * Returns true when a legacy file was copied into the TeamCC config home.
 */
export function migrateClaudeGlobalConfigToTeamCC(): boolean {
  const fs = getFsImplementation()
  const target = getGlobalTeamCCFile()

  if (fs.existsSync(target)) {
    return false
  }

  const source = getLegacyClaudeGlobalConfigCandidates().find(candidate =>
    fs.existsSync(candidate),
  )
  if (!source) {
    return false
  }

  fs.mkdirSync(dirname(target))
  fs.copyFileSync(source, target)
  return true
}

export function migrateClaudeConfigHomeToTeamCC(): boolean {
  const fs = getFsImplementation()
  const sourceDir = getLegacyClaudeConfigHomeDir()
  const targetDir = getTeamCCConfigHomeDir()

  if (pathsEqual(sourceDir, targetDir)) {
    return false
  }
  if (
    !fs.existsSync(sourceDir) ||
    fs.existsSync(getMigrationMarkerPath(targetDir))
  ) {
    return false
  }

  const migrated =
    migrateClaudeGlobalConfigToTeamCC() ||
    copyDirContentsWithRootRenames(
      sourceDir,
      targetDir,
      {
        [LEGACY_CLAUDE_MEMORY_FILENAME]: TEAMCC_MEMORY_FILENAME,
        [LEGACY_CLAUDE_LOCAL_MEMORY_FILENAME]: TEAMCC_LOCAL_MEMORY_FILENAME,
      },
      new Set(['.config.json']),
    )

  markMigrationComplete(targetDir)
  return migrated
}

export function migrateClaudeProjectToTeamCC(
  cwd: string = process.cwd(),
): boolean {
  const fs = getFsImplementation()
  const sourceDir = getLegacyClaudeProjectDir(cwd)
  const targetDir = getTeamCCProjectDir(cwd)

  const hasLegacyProjectDir = fs.existsSync(sourceDir)
  const hasLegacyRootMemory =
    fs.existsSync(join(cwd, LEGACY_CLAUDE_MEMORY_FILENAME)) ||
    fs.existsSync(join(cwd, LEGACY_CLAUDE_LOCAL_MEMORY_FILENAME))

  if (!hasLegacyProjectDir && !hasLegacyRootMemory) {
    return false
  }
  if (fs.existsSync(getMigrationMarkerPath(targetDir))) {
    return false
  }

  let migrated = false
  if (hasLegacyProjectDir) {
    migrated =
      copyDirContentsWithRootRenames(sourceDir, targetDir, {
        [LEGACY_CLAUDE_MEMORY_FILENAME]: TEAMCC_MEMORY_FILENAME,
      }) || migrated
  }

  migrated =
    copyEntryIfMissing(
      join(cwd, LEGACY_CLAUDE_MEMORY_FILENAME),
      join(cwd, TEAMCC_MEMORY_FILENAME),
    ) || migrated
  migrated =
    copyEntryIfMissing(
      join(cwd, LEGACY_CLAUDE_LOCAL_MEMORY_FILENAME),
      join(cwd, TEAMCC_LOCAL_MEMORY_FILENAME),
    ) || migrated

  markMigrationComplete(targetDir)
  return migrated
}

export function runStartupTeamCCMigration(
  cwd: string = process.cwd(),
): void {
  migrateClaudeGlobalConfigToTeamCC()
  migrateClaudeConfigHomeToTeamCC()
  migrateClaudeProjectToTeamCC(cwd)
}
