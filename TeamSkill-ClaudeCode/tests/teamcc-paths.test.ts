import { afterEach, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import {
  getGlobalClaudeFile,
  getGlobalTeamCCFile,
} from '../src/utils/env.js'
import {
  getClaudeConfigHomeDir,
  getTeamCCConfigHomeDir,
} from '../src/utils/envUtils.js'
import { enableConfigs } from '../src/utils/config.js'

const originalEnv = {
  TEAMCC_CONFIG_DIR: process.env.TEAMCC_CONFIG_DIR,
  CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE,
}

const tempRoots: string[] = []

afterEach(() => {
  for (const dir of tempRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }

  if (originalEnv.TEAMCC_CONFIG_DIR === undefined) {
    delete process.env.TEAMCC_CONFIG_DIR
  } else {
    process.env.TEAMCC_CONFIG_DIR = originalEnv.TEAMCC_CONFIG_DIR
  }

  if (originalEnv.CLAUDE_CONFIG_DIR === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR
  } else {
    process.env.CLAUDE_CONFIG_DIR = originalEnv.CLAUDE_CONFIG_DIR
  }

  if (originalEnv.HOME === undefined) {
    delete process.env.HOME
  } else {
    process.env.HOME = originalEnv.HOME
  }

  if (originalEnv.USERPROFILE === undefined) {
    delete process.env.USERPROFILE
  } else {
    process.env.USERPROFILE = originalEnv.USERPROFILE
  }
})

test('TeamCC config home and global config resolve to the new paths', () => {
  const teamccRoot = mkdtempSync(join(tmpdir(), 'teamcc-paths-'))
  tempRoots.push(teamccRoot)

  process.env.TEAMCC_CONFIG_DIR = teamccRoot

  expect(getTeamCCConfigHomeDir()).toBe(teamccRoot)
  expect(getClaudeConfigHomeDir()).toBe(teamccRoot)
  expect(getGlobalTeamCCFile()).toBe(join(teamccRoot, 'config.json'))
  expect(getGlobalClaudeFile()).toBe(join(teamccRoot, 'config.json'))
})

test('enableConfigs migrates legacy Claude global config once before reads', () => {
  const teamccRoot = mkdtempSync(join(tmpdir(), 'teamcc-config-'))
  const legacyHome = mkdtempSync(join(tmpdir(), 'claude-home-'))
  tempRoots.push(teamccRoot, legacyHome)

  process.env.TEAMCC_CONFIG_DIR = teamccRoot
  process.env.HOME = legacyHome
  process.env.USERPROFILE = legacyHome
  delete process.env.CLAUDE_CONFIG_DIR

  const legacyClaudeDir = join(homedir(), '.claude')
  const preferredLegacyFile = join(legacyClaudeDir, '.config.json')
  const fallbackLegacyFile = join(legacyHome, '.claude.json')
  const migratedFile = join(teamccRoot, 'config.json')

  mkdirSync(legacyClaudeDir, { recursive: true })
  writeFileSync(
    preferredLegacyFile,
    JSON.stringify({ theme: 'light', numStartups: 7 }, null, 2),
  )
  writeFileSync(
    fallbackLegacyFile,
    JSON.stringify({ theme: 'dark', numStartups: 1 }, null, 2),
  )

  enableConfigs()

  expect(existsSync(migratedFile)).toBe(true)
  expect(readFileSync(migratedFile, 'utf-8')).toBe(
    readFileSync(preferredLegacyFile, 'utf-8'),
  )
  expect(readFileSync(migratedFile, 'utf-8')).not.toBe(
    readFileSync(fallbackLegacyFile, 'utf-8'),
  )

  writeFileSync(
    preferredLegacyFile,
    JSON.stringify({ theme: 'dark', numStartups: 99 }, null, 2),
  )

  enableConfigs()

  expect(readFileSync(migratedFile, 'utf-8')).not.toBe(
    readFileSync(preferredLegacyFile, 'utf-8'),
  )
  expect(getGlobalTeamCCFile()).toBe(migratedFile)
  expect(getGlobalClaudeFile()).toBe(migratedFile)
})
