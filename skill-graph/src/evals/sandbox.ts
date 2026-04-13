import { mkdir, readFile, access, copyFile } from 'fs/promises'
import { constants as fsConstants } from 'fs'
import { dirname, join, resolve } from 'path'
import type {
  SandboxEvalCaseResult,
  SkillEvalJudgeResult,
  SkillSandboxEvalCase,
} from './types.js'

async function pathExists(path: string | null): Promise<boolean> {
  if (!path) {
    return false
  }

  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function runShellCommand(
  command: string,
  cwd: string,
): Promise<{
  exitCode: number
  stdout: string
  stderr: string
}> {
  const proc = Bun.spawn(['sh', '-lc', command], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return {
    exitCode,
    stdout,
    stderr,
  }
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeJudgeResult(
  value: unknown,
  judgeType: 'human' | 'llm',
): SkillEvalJudgeResult {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  return {
    schemaVersion: '2026-04-12',
    judgeType,
    overallPass:
      typeof record.overallPass === 'boolean' ? record.overallPass : null,
    taskOutcomeScore: toNullableNumber(record.taskOutcomeScore),
    retrievalQualityScore: toNullableNumber(record.retrievalQualityScore),
    skillSelectionScore: toNullableNumber(record.skillSelectionScore),
    executionQualityScore: toNullableNumber(record.executionQualityScore),
    attributionIntegrityScore: toNullableNumber(record.attributionIntegrityScore),
    feedbackLoopScore: toNullableNumber(record.feedbackLoopScore),
    summary:
      toStringValue(record.summary) ??
      `pending_${judgeType}_review`,
    issues: Array.isArray(record.issues)
      ? record.issues.filter((item): item is string => typeof item === 'string')
      : [],
    evidence: Array.isArray(record.evidence)
      ? record.evidence.filter((item): item is string => typeof item === 'string')
      : [],
  }
}

async function loadJudgeResult(
  evalCase: SkillSandboxEvalCase,
  sandboxRoot: string,
): Promise<SkillEvalJudgeResult> {
  const resultPath = evalCase.judge.resultPath
    ? resolve(sandboxRoot, evalCase.judge.resultPath)
    : null
  if (resultPath && (await pathExists(resultPath))) {
    const raw = await readFile(resultPath, 'utf-8')
    return normalizeJudgeResult(JSON.parse(raw), evalCase.judge.type)
  }

  if (evalCase.judge.type === 'llm' && evalCase.judge.command) {
    const executed = await runShellCommand(evalCase.judge.command, sandboxRoot)
    if (executed.exitCode === 0 && executed.stdout.trim()) {
      return normalizeJudgeResult(JSON.parse(executed.stdout), 'llm')
    }

    return normalizeJudgeResult(
      {
        summary: 'llm_judge_failed',
        issues: [executed.stderr.trim() || 'llm judge command failed'],
      },
      'llm',
    )
  }

  return normalizeJudgeResult(
    {
      summary:
        evalCase.judge.type === 'human'
          ? 'pending_human_review'
          : 'pending_llm_review',
      issues: ['judge_result_not_available'],
    },
    evalCase.judge.type,
  )
}

async function maybeCopyArtifact(
  sourcePath: string | null,
  targetPath: string,
): Promise<string | null> {
  if (!sourcePath || !(await pathExists(sourcePath))) {
    return null
  }

  await mkdir(dirname(targetPath), { recursive: true })
  await copyFile(sourcePath, targetPath)
  return targetPath
}

export async function runSandboxBlindEval(
  evalCases: SkillSandboxEvalCase[],
  options: {
    runArtifactsDir: string
    sandboxesRoot: string
  },
): Promise<{
  cases: SandboxEvalCaseResult[]
  summary: {
    caseCount: number
    passCount: number
    verificationPassCount: number
  }
}> {
  const results: SandboxEvalCaseResult[] = []

  for (const evalCase of evalCases) {
    const sandboxRoot = resolve(options.sandboxesRoot, evalCase.sandboxId)
    const projectRoot = resolve(sandboxRoot, evalCase.projectSeed.rootDir)
    const caseArtifactsDir = join(options.runArtifactsDir, evalCase.caseId)
    await mkdir(caseArtifactsDir, { recursive: true })

    let commandExitCode: number | null = null
    if (evalCase.execution.command) {
      const executed = await runShellCommand(evalCase.execution.command, projectRoot)
      commandExitCode = executed.exitCode
      await Bun.write(join(caseArtifactsDir, 'teamcc-run.stdout.log'), executed.stdout)
      await Bun.write(join(caseArtifactsDir, 'teamcc-run.stderr.log'), executed.stderr)
    }

    const verificationResults = []
    for (const command of evalCase.verification.commands) {
      const executed = await runShellCommand(command, projectRoot)
      verificationResults.push({
        command,
        passed: executed.exitCode === 0,
        exitCode: executed.exitCode,
        stdout: executed.stdout,
        stderr: executed.stderr,
      })
    }

    const artifactsRoot = evalCase.execution.artifactsDir
      ? resolve(projectRoot, evalCase.execution.artifactsDir)
      : projectRoot

    const rawInputPath = await maybeCopyArtifact(
      join(artifactsRoot, 'raw-input.json'),
      join(caseArtifactsDir, 'raw-input.json'),
    )
    const retrievalRequestPath = await maybeCopyArtifact(
      join(artifactsRoot, 'retrieval-request.json'),
      join(caseArtifactsDir, 'retrieval-request.json'),
    )
    const retrievalResponsePath = await maybeCopyArtifact(
      join(artifactsRoot, 'retrieval-response.json'),
      join(caseArtifactsDir, 'retrieval-response.json'),
    )
    const discoveryAttachmentPath = await maybeCopyArtifact(
      join(artifactsRoot, 'skill-discovery-attachment.json'),
      join(caseArtifactsDir, 'skill-discovery-attachment.json'),
    )
    const chosenSkillPath = await maybeCopyArtifact(
      join(artifactsRoot, 'chosen-skill.json'),
      join(caseArtifactsDir, 'chosen-skill.json'),
    )
    const skillEventsPath = await maybeCopyArtifact(
      join(artifactsRoot, 'skill-events.jsonl'),
      join(caseArtifactsDir, 'skill-events.jsonl'),
    )
    const finalDiffPath = await maybeCopyArtifact(
      join(artifactsRoot, 'final-diff.patch'),
      join(caseArtifactsDir, 'final-diff.patch'),
    )

    const judgeResult = await loadJudgeResult(evalCase, projectRoot)
    const judgeResultPath = join(caseArtifactsDir, 'judge-result.json')
    await Bun.write(judgeResultPath, `${JSON.stringify(judgeResult, null, 2)}\n`)

    let chosenSkill = {
      skillId: null,
      version: null,
      sourceHash: null,
    }
    if (chosenSkillPath && (await pathExists(chosenSkillPath))) {
      const chosenRaw = JSON.parse(await readFile(chosenSkillPath, 'utf-8'))
      chosenSkill = {
        skillId: toStringValue(chosenRaw.skillId),
        version: toStringValue(chosenRaw.version),
        sourceHash: toStringValue(chosenRaw.sourceHash),
      }
    }

    results.push({
      caseId: evalCase.caseId,
      title: evalCase.title,
      sandboxId: evalCase.sandboxId,
      commandExitCode,
      verificationPassed: verificationResults.every(result => result.passed),
      verificationResults,
      chosenSkill,
      requestLogged: Boolean(retrievalRequestPath),
      responseLogged: Boolean(retrievalResponsePath),
      eventsLogged: Boolean(skillEventsPath),
      artifactPaths: {
        rawInputPath,
        retrievalRequestPath,
        retrievalResponsePath,
        discoveryAttachmentPath,
        chosenSkillPath,
        skillEventsPath,
        finalDiffPath,
        judgeResultPath,
      },
      judgeResult,
    })
  }

  return {
    cases: results,
    summary: {
      caseCount: results.length,
      passCount: results.filter(result => result.judgeResult.overallPass === true).length,
      verificationPassCount: results.filter(result => result.verificationPassed).length,
    },
  }
}
