import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getOriginalCwd, setOriginalCwd } from '../src/bootstrap/state.js'
import {
  applySafeConfigEnvironmentVariables,
} from '../src/utils/managedEnv.js'
import {
  getRelativeSettingsFilePathForSource,
  getSettingsFilePathForSource,
  getSettingsRootPathForSource,
  updateSettingsForSource,
} from '../src/utils/settings/settings.js'
import { resetSettingsCache } from '../src/utils/settings/settingsCache.js'

const originalEnv = {
  TEAMCC_CONFIG_DIR: process.env.TEAMCC_CONFIG_DIR,
  CLAUDE_CODE_USE_COWORK_PLUGINS:
    process.env.CLAUDE_CODE_USE_COWORK_PLUGINS,
}
const originalCwd = getOriginalCwd()

const tempRoots: string[] = []

afterEach(() => {
  resetSettingsCache()
  for (const dir of tempRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }

  if (originalEnv.TEAMCC_CONFIG_DIR === undefined) {
    delete process.env.TEAMCC_CONFIG_DIR
  } else {
    process.env.TEAMCC_CONFIG_DIR = originalEnv.TEAMCC_CONFIG_DIR
  }

  if (originalEnv.CLAUDE_CODE_USE_COWORK_PLUGINS === undefined) {
    delete process.env.CLAUDE_CODE_USE_COWORK_PLUGINS
  } else {
    process.env.CLAUDE_CODE_USE_COWORK_PLUGINS =
      originalEnv.CLAUDE_CODE_USE_COWORK_PLUGINS
  }

  delete process.env.TEAMCC_SETTINGS_MIGRATION_TEST_VAR
  delete process.env.TEAMCC_SETTINGS_MIGRATION_TEST_USER_VAR
  delete process.env.TEAMCC_SETTINGS_MIGRATION_TEST_PROJECT_VAR
  delete process.env.TEAMCC_SETTINGS_MIGRATION_TEST_LOCAL_VAR
  setOriginalCwd(originalCwd)
})

test('TeamCC settings paths resolve away from Claude paths and remain writable', () => {
  const configRoot = mkdtempSync(join(tmpdir(), 'teamcc-config-'))
  const projectRoot = mkdtempSync(join(tmpdir(), 'teamcc-project-'))
  tempRoots.push(configRoot, projectRoot)

  process.env.TEAMCC_CONFIG_DIR = configRoot
  process.env.CLAUDE_CODE_USE_COWORK_PLUGINS = ''
  setOriginalCwd(projectRoot)

  expect(getSettingsRootPathForSource('userSettings')).toBe(configRoot)
  expect(getSettingsFilePathForSource('userSettings')).toBe(
    join(configRoot, 'settings.json'),
  )
  expect(getRelativeSettingsFilePathForSource('projectSettings')).toBe(
    join('.teamcc', 'settings.json'),
  )
  expect(getRelativeSettingsFilePathForSource('localSettings')).toBe(
    join('.teamcc', 'settings.local.json'),
  )
  expect(getSettingsFilePathForSource('projectSettings')).toBe(
    join(projectRoot, '.teamcc', 'settings.json'),
  )
  expect(getSettingsFilePathForSource('localSettings')).toBe(
    join(projectRoot, '.teamcc', 'settings.local.json'),
  )

  const userResult = updateSettingsForSource('userSettings', {
    env: { TEAMCC_SETTINGS_MIGRATION_TEST_USER_VAR: 'user-value' },
  })
  expect(userResult.error).toBeNull()
  expect(existsSync(join(configRoot, 'settings.json'))).toBe(true)
  expect(existsSync(join(configRoot, '.claude', 'settings.json'))).toBe(false)

  const projectResult = updateSettingsForSource('projectSettings', {
    env: { TEAMCC_SETTINGS_MIGRATION_TEST_PROJECT_VAR: 'project-value' },
  })
  expect(projectResult.error).toBeNull()
  expect(existsSync(join(projectRoot, '.teamcc', 'settings.json'))).toBe(true)
  expect(existsSync(join(projectRoot, '.claude', 'settings.json'))).toBe(false)

  const localResult = updateSettingsForSource('localSettings', {
    env: { TEAMCC_SETTINGS_MIGRATION_TEST_LOCAL_VAR: 'local-value' },
  })
  expect(localResult.error).toBeNull()
  expect(
    existsSync(join(projectRoot, '.teamcc', 'settings.local.json')),
  ).toBe(true)
  expect(
    existsSync(join(projectRoot, '.claude', 'settings.local.json')),
  ).toBe(false)

  const userSettings = readFileSync(join(configRoot, 'settings.json'), 'utf-8')
  expect(userSettings).toContain('TEAMCC_SETTINGS_MIGRATION_TEST_USER_VAR')

  process.env.TEAMCC_SETTINGS_MIGRATION_TEST_USER_VAR = ''
  applySafeConfigEnvironmentVariables()
  expect(process.env.TEAMCC_SETTINGS_MIGRATION_TEST_USER_VAR).toBe('user-value')
})
