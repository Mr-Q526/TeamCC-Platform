import { afterEach, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join, sep } from 'path'
import {
  getOriginalCwd,
  getCwdState,
  setCwdState,
  setOriginalCwd,
} from '../src/bootstrap/state.js'
import { getMemoryPath } from '../src/utils/config.js'
import {
  clearMemoryFileCaches,
  getMemoryFiles,
  isMemoryFilePath,
} from '../src/utils/claudemd.js'
import { getCronFilePath } from '../src/utils/cronTasks.js'
import { getAgentMemoryDir } from '../src/tools/AgentTool/agentMemory.js'
import {
  runStartupTeamCCMigration,
  TEAMCC_LOCAL_MEMORY_FILENAME,
  TEAMCC_MEMORY_FILENAME,
  TEAMCC_PROJECT_DIR_NAME,
} from '../src/utils/teamccPaths.js'

const originalEnv = {
  TEAMCC_CONFIG_DIR: process.env.TEAMCC_CONFIG_DIR,
  CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
}
const originalCwd = getOriginalCwd()
const originalStateCwd = getCwdState()
const originalProcessCwd = process.cwd()

const tempRoots: string[] = []

afterEach(() => {
  clearMemoryFileCaches()
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

  setOriginalCwd(originalCwd)
  setCwdState(originalStateCwd)
  process.chdir(originalProcessCwd)
})

test('startup migration moves legacy Claude project state to TeamCC paths', async () => {
  const legacyHome = mkdtempSync(join(tmpdir(), 'claude-home-'))
  const teamccHome = mkdtempSync(join(tmpdir(), 'teamcc-home-'))
  const projectRoot = mkdtempSync(join(tmpdir(), 'teamcc-project-'))
  tempRoots.push(legacyHome, teamccHome, projectRoot)

  process.env.CLAUDE_CONFIG_DIR = legacyHome
  process.env.TEAMCC_CONFIG_DIR = teamccHome
  setOriginalCwd(projectRoot)
  setCwdState(projectRoot)
  process.chdir(projectRoot)

  mkdirSync(join(legacyHome, 'rules'), { recursive: true })
  writeFileSync(join(legacyHome, 'settings.json'), '{"env":{"A":"1"}}\n')
  writeFileSync(join(legacyHome, 'CLAUDE.md'), '# legacy user memory\n')
  writeFileSync(join(legacyHome, 'rules', 'user-rule.md'), '# user rule\n')

  mkdirSync(join(projectRoot, '.claude', 'rules'), { recursive: true })
  writeFileSync(join(projectRoot, '.claude', 'settings.json'), '{}\n')
  writeFileSync(
    join(projectRoot, '.claude', 'teamcc.json'),
    '{"apiBase":"http://localhost:3000"}\n',
  )
  writeFileSync(join(projectRoot, '.claude', 'CLAUDE.md'), '# nested memory\n')
  writeFileSync(
    join(projectRoot, '.claude', 'rules', 'project-rule.md'),
    '# project rule\n',
  )
  writeFileSync(join(projectRoot, 'CLAUDE.md'), '# root memory\n')
  writeFileSync(join(projectRoot, 'CLAUDE.local.md'), '# local memory\n')

  runStartupTeamCCMigration(projectRoot)

  expect(existsSync(join(teamccHome, 'settings.json'))).toBe(true)
  expect(existsSync(join(teamccHome, TEAMCC_MEMORY_FILENAME))).toBe(true)
  expect(readFileSync(join(teamccHome, TEAMCC_MEMORY_FILENAME), 'utf-8')).toBe(
    '# legacy user memory\n',
  )
  expect(existsSync(join(teamccHome, 'rules', 'user-rule.md'))).toBe(true)

  expect(
    existsSync(join(projectRoot, TEAMCC_PROJECT_DIR_NAME, 'settings.json')),
  ).toBe(true)
  expect(
    existsSync(join(projectRoot, TEAMCC_PROJECT_DIR_NAME, 'teamcc.json')),
  ).toBe(true)
  expect(
    existsSync(
      join(projectRoot, TEAMCC_PROJECT_DIR_NAME, TEAMCC_MEMORY_FILENAME),
    ),
  ).toBe(true)
  expect(
    existsSync(
      join(projectRoot, TEAMCC_PROJECT_DIR_NAME, 'rules', 'project-rule.md'),
    ),
  ).toBe(true)
  expect(existsSync(join(projectRoot, TEAMCC_MEMORY_FILENAME))).toBe(true)
  expect(
    existsSync(join(projectRoot, TEAMCC_LOCAL_MEMORY_FILENAME)),
  ).toBe(true)

  expect(getMemoryPath('User')).toBe(join(teamccHome, TEAMCC_MEMORY_FILENAME))
  expect(getMemoryPath('Project')).toBe(
    join(projectRoot, TEAMCC_MEMORY_FILENAME),
  )
  expect(getMemoryPath('Local')).toBe(
    join(projectRoot, TEAMCC_LOCAL_MEMORY_FILENAME),
  )
  expect(isMemoryFilePath(join(projectRoot, TEAMCC_MEMORY_FILENAME))).toBe(
    true,
  )
  expect(isMemoryFilePath(join(projectRoot, 'CLAUDE.md'))).toBe(false)
  expect(getCronFilePath(projectRoot)).toBe(
    join(projectRoot, TEAMCC_PROJECT_DIR_NAME, 'scheduled_tasks.json'),
  )
  expect(getAgentMemoryDir('worker', 'project')).toBe(
    join(projectRoot, TEAMCC_PROJECT_DIR_NAME, 'agent-memory', 'worker') + sep,
  )

  clearMemoryFileCaches()
  const memoryFiles = await getMemoryFiles()
  expect(
    memoryFiles.some(
      file => file.path === join(projectRoot, TEAMCC_MEMORY_FILENAME),
    ),
  ).toBe(true)
  expect(
    memoryFiles.some(
      file =>
        file.path ===
        join(projectRoot, TEAMCC_PROJECT_DIR_NAME, TEAMCC_MEMORY_FILENAME),
    ),
  ).toBe(true)
})
