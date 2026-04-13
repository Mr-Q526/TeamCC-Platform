import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import type {
  ReplayDiagnosisCaseResult,
  RetrievalEvalCaseResult,
  SandboxEvalCaseResult,
} from './types.js'

async function readJsonIfExists(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function classifyRetrievalCase(caseResult: RetrievalEvalCaseResult): ReplayDiagnosisCaseResult {
  const graphResult = caseResult.modeResults.find(
    result => result.requestedMode === 'bm25_vector_graph',
  )
  const firstExpectedRank = graphResult?.firstExpectedRank ?? null
  if (firstExpectedRank === null || firstExpectedRank > 5) {
    return {
      caseId: caseResult.caseId,
      mode: 'retrieval',
      failureCategory: 'R1',
      summary: 'expected skill did not enter Top5 in graph retrieval mode',
    }
  }
  if (firstExpectedRank > 1) {
    return {
      caseId: caseResult.caseId,
      mode: 'retrieval',
      failureCategory: 'R2',
      summary: 'expected skill entered Top5 but did not rank first',
    }
  }
  return {
    caseId: caseResult.caseId,
    mode: 'retrieval',
    failureCategory: 'PASS',
    summary: 'retrieval case passed',
  }
}

function classifySandboxCase(caseResult: SandboxEvalCaseResult): ReplayDiagnosisCaseResult {
  if (!caseResult.requestLogged || !caseResult.responseLogged) {
    return {
      caseId: caseResult.caseId,
      mode: 'sandbox',
      failureCategory: 'T1',
      summary: 'TeamCC retrieval request/response artifacts are missing',
    }
  }
  if (!caseResult.chosenSkill.skillId) {
    return {
      caseId: caseResult.caseId,
      mode: 'sandbox',
      failureCategory: 'T2',
      summary: 'chosen skill identity is missing',
    }
  }
  if (!caseResult.verificationPassed) {
    return {
      caseId: caseResult.caseId,
      mode: 'sandbox',
      failureCategory: 'E1',
      summary: 'verification commands failed',
    }
  }
  if (!caseResult.eventsLogged) {
    return {
      caseId: caseResult.caseId,
      mode: 'sandbox',
      failureCategory: 'F1',
      summary: 'skill events were not captured',
    }
  }
  if (caseResult.judgeResult.overallPass === false) {
    return {
      caseId: caseResult.caseId,
      mode: 'sandbox',
      failureCategory: 'T2',
      summary: 'judge marked sandbox run as failed',
    }
  }
  return {
    caseId: caseResult.caseId,
    mode: 'sandbox',
    failureCategory: 'PASS',
    summary: 'sandbox case passed',
  }
}

export async function runReplayDiagnosis(runDir: string): Promise<{
  cases: ReplayDiagnosisCaseResult[]
}> {
  const resolvedRunDir = resolve(runDir)
  const summary = (await readJsonIfExists(join(resolvedRunDir, 'summary.json'))) as
    | {
        mode?: string
      }
    | null
  const casesJson = await readFile(join(resolvedRunDir, 'cases.json'), 'utf-8')
  const parsedCases = JSON.parse(casesJson) as Array<
    RetrievalEvalCaseResult | SandboxEvalCaseResult
  >
  const mode = summary?.mode

  const cases =
    mode === 'teamcc-sandbox-blind'
      ? (parsedCases as SandboxEvalCaseResult[]).map(classifySandboxCase)
      : (parsedCases as RetrievalEvalCaseResult[]).map(classifyRetrievalCase)

  return { cases }
}
