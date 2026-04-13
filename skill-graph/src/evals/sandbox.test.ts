import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'fs/promises'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import { loadEvalCase } from './io.js'
import { runSandboxBlindEval } from './sandbox.js'

const tempDirs: string[] = []
const projectRoot = resolve(import.meta.dir, '../..')

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })),
  )
})

describe('sandbox eval', () => {
  test('collects fixture artifacts and judge output', async () => {
    const runDir = await mkdtemp(join(tmpdir(), 'sandbox-eval-'))
    tempDirs.push(runDir)
    const evalCase = await loadEvalCase(
      resolve(
        projectRoot,
        'evals/skills/cases/sandbox/homepage-blind-fixture.yaml',
      ),
    )

    expect(evalCase.caseType).toBe('sandbox')
    if (evalCase.caseType !== 'sandbox') {
      throw new Error('expected sandbox case')
    }

    const result = await runSandboxBlindEval([evalCase], {
      runArtifactsDir: runDir,
      sandboxesRoot: resolve(projectRoot, 'evals/skills/sandboxes'),
    })

    expect(result.summary.caseCount).toBe(1)
    expect(result.cases[0]?.verificationPassed).toBe(true)
    expect(result.cases[0]?.chosenSkill.skillId).toBe(
      'frontend/website-homepage-design-pro',
    )
    expect(result.cases[0]?.eventsLogged).toBe(true)
    expect(result.cases[0]?.judgeResult.overallPass).toBe(true)
  })
})
