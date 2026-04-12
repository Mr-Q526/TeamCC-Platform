import { randomUUID } from 'crypto'
import { mkdir, readFile, readdir, writeFile, appendFile } from 'fs/promises'
import { basename, dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import YAML from 'yaml'
import { localSkillSearch } from '../../TeamSkill-ClaudeCode/src/services/skillSearch/localSearch.js'
import {
  buildSkillFactEvent,
  logSkillFactEvent,
} from '../../TeamSkill-ClaudeCode/src/services/skillSearch/telemetry.js'

type SkillEvalCase = {
  caseId: string
  caseVersion?: string
  department?: string
  scene?: string
  domain?: string
  project?: {
    cwd?: string
  }
  input: {
    userQuery: string
    queryContext?: string
    businessContext?: string
  }
  expected: {
    skillIds: string[]
    acceptableSkillIds?: string[]
    forbiddenSkillIds?: string[]
  }
}

type CaseResult = {
  caseId: string
  caseVersion?: string
  caseFile: string
  traceId: string
  topK: number
  retrievedSkillIds: string[]
  expectedSkillIds: string[]
  acceptableSkillIds: string[]
  forbiddenSkillIds: string[]
  firstExpectedRank: number | null
  recallAt1: number
  recallAt3: number
  mrr: number
  ndcgAt3: number
  forbiddenInTop3: string[]
}

type CliOptions = {
  caseId?: string
  suite?: string
  casesDir: string
  cwd: string
  topK: number
  outDir: string
  telemetry: 'local' | 'off'
}

function parseArgs(argv: string[]): CliOptions {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url))
  const options: CliOptions = {
    casesDir: join(projectRoot, 'evals', 'skill-cases'),
    cwd: resolve(projectRoot, '../TeamSkill-ClaudeCode'),
    topK: 5,
    outDir: join(projectRoot, 'evals', 'runs'),
    telemetry: 'local',
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--case' && next) {
      options.caseId = next
      i++
    } else if (arg === '--suite' && next) {
      options.suite = next
      i++
    } else if (arg === '--cases-dir' && next) {
      options.casesDir = next
      i++
    } else if (arg === '--cwd' && next) {
      options.cwd = resolve(next)
      i++
    } else if (arg === '--top-k' && next) {
      options.topK = Number(next)
      i++
    } else if (arg === '--out-dir' && next) {
      options.outDir = next
      i++
    } else if (arg === '--telemetry' && (next === 'local' || next === 'off')) {
      options.telemetry = next
      i++
    }
  }

  if (!Number.isFinite(options.topK) || options.topK <= 0) {
    throw new Error('--top-k must be a positive number')
  }

  return options
}

async function listCaseFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async entry => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        return listCaseFiles(path)
      }
      if (entry.isFile() && /\.(ya?ml|json)$/i.test(entry.name)) {
        return [path]
      }
      return []
    }),
  )

  return files.flat().sort()
}

async function loadCase(file: string): Promise<SkillEvalCase> {
  const raw = await readFile(file, 'utf-8')
  const parsed = file.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw)

  if (!parsed?.caseId || !parsed?.input?.userQuery) {
    throw new Error(`Invalid skill eval case: ${file}`)
  }

  return parsed as SkillEvalCase
}

function relevanceForSkill(
  skillId: string,
  expected: Set<string>,
  acceptable: Set<string>,
): number {
  if (expected.has(skillId)) return 1
  if (acceptable.has(skillId)) return 0.5
  return 0
}

function dcg(relevances: number[]): number {
  return relevances.reduce((sum, relevance, index) => {
    if (relevance <= 0) return sum
    return sum + relevance / Math.log2(index + 2)
  }, 0)
}

function ndcgAtK(
  retrievedSkillIds: string[],
  expected: Set<string>,
  acceptable: Set<string>,
  k: number,
): number {
  const actual = retrievedSkillIds
    .slice(0, k)
    .map(skillId => relevanceForSkill(skillId, expected, acceptable))
  const ideal = [...expected]
    .map(() => 1)
    .concat([...acceptable].map(() => 0.5))
    .sort((left, right) => right - left)
    .slice(0, k)

  const idealDcg = dcg(ideal)
  if (idealDcg === 0) return 0
  return dcg(actual) / idealDcg
}

async function evaluateCase(
  evalCase: SkillEvalCase,
  caseFile: string,
  options: CliOptions,
): Promise<CaseResult> {
  const expected = new Set(evalCase.expected.skillIds)
  const acceptable = new Set(evalCase.expected.acceptableSkillIds ?? [])
  const forbidden = new Set(evalCase.expected.forbiddenSkillIds ?? [])
  const traceId = randomUUID()
  const cwd = evalCase.project?.cwd
    ? resolve(dirname(caseFile), evalCase.project.cwd)
    : options.cwd
  const queryContext = [
    evalCase.department,
    evalCase.scene,
    evalCase.domain,
    evalCase.input.businessContext,
    evalCase.input.queryContext,
  ]
    .filter(Boolean)
    .join('\n')

  const results = await localSkillSearch({
    cwd,
    query: evalCase.input.userQuery,
    queryContext,
    limit: options.topK,
    traceId,
    taskId: `eval:${evalCase.caseId}`,
    retrievalRoundId: traceId,
    telemetry: options.telemetry === 'local',
  })

  const retrievedSkillIds = results.map(result => result.skillId)
  const firstExpectedIndex = retrievedSkillIds.findIndex(skillId =>
    expected.has(skillId),
  )
  const firstExpectedRank =
    firstExpectedIndex >= 0 ? firstExpectedIndex + 1 : null
  const forbiddenInTop3 = retrievedSkillIds
    .slice(0, 3)
    .filter(skillId => forbidden.has(skillId))

  return {
    caseId: evalCase.caseId,
    caseVersion: evalCase.caseVersion,
    caseFile,
    traceId,
    topK: options.topK,
    retrievedSkillIds,
    expectedSkillIds: [...expected],
    acceptableSkillIds: [...acceptable],
    forbiddenSkillIds: [...forbidden],
    firstExpectedRank,
    recallAt1:
      retrievedSkillIds.slice(0, 1).some(skillId => expected.has(skillId))
        ? 1
        : 0,
    recallAt3:
      retrievedSkillIds.slice(0, 3).some(skillId => expected.has(skillId))
        ? 1
        : 0,
    mrr: firstExpectedRank ? 1 / firstExpectedRank : 0,
    ndcgAt3: ndcgAtK(retrievedSkillIds, expected, acceptable, 3),
    forbiddenInTop3,
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const runId =
    process.env.SKILL_EVAL_RUN_ID ??
    `skill-retrieval-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const runDir = resolve(options.outDir, runId)

  process.env.SKILL_EVAL_RUN_ID = runId
  process.env.SKILL_EVAL_TELEMETRY = options.telemetry
  process.env.SKILL_EVAL_EVENTS_PATH = join(runDir, 'skill-events.jsonl')

  const caseFiles = (await listCaseFiles(resolve(options.casesDir))).filter(
    file => {
      if (options.suite && !file.includes(options.suite)) return false
      return true
    },
  )
  const cases = await Promise.all(
    caseFiles.map(async file => ({
      file,
      evalCase: await loadCase(file),
    })),
  )
  const selectedCases = cases.filter(({ evalCase }) => {
    if (options.caseId && evalCase.caseId !== options.caseId) {
      return false
    }
    return true
  })

  if (selectedCases.length === 0) {
    throw new Error(
      `No eval cases matched ${options.caseId ?? options.suite ?? basename(options.casesDir)}`,
    )
  }

  await mkdir(runDir, { recursive: true })

  const results: CaseResult[] = []
  for (const { evalCase, file } of selectedCases) {
    const result = await evaluateCase(evalCase, file, options)
    results.push(result)
    await logSkillFactEvent(
      buildSkillFactEvent({
        factKind: 'eval_outcome',
        source: 'eval_runner',
        cwd: resolve(options.cwd),
        taskId: `eval:${result.caseId}`,
        traceId: result.traceId,
        retrievalRoundId: result.traceId,
        payload: {
          caseId: result.caseId,
          caseVersion: result.caseVersion ?? null,
          caseFile: result.caseFile,
          topK: result.topK,
          retrievedSkillIds: result.retrievedSkillIds,
          expectedSkillIds: result.expectedSkillIds,
          acceptableSkillIds: result.acceptableSkillIds,
          forbiddenSkillIds: result.forbiddenSkillIds,
          firstExpectedRank: result.firstExpectedRank,
          recallAt1: result.recallAt1,
          recallAt3: result.recallAt3,
          mrr: result.mrr,
          ndcgAt3: result.ndcgAt3,
          forbiddenInTop3: result.forbiddenInTop3,
        },
      }),
    )
    await appendFile(
      join(runDir, 'results.jsonl'),
      `${JSON.stringify(result)}\n`,
      'utf-8',
    )
  }

  const summary = {
    runId,
    generatedAt: new Date().toISOString(),
    mode: 'retrieval-only',
    caseCount: results.length,
    topK: options.topK,
    casesDir: resolve(options.casesDir),
    metrics: {
      recallAt1: average(results.map(result => result.recallAt1)),
      recallAt3: average(results.map(result => result.recallAt3)),
      mrr: average(results.map(result => result.mrr)),
      ndcgAt3: average(results.map(result => result.ndcgAt3)),
      forbiddenTop3Rate: average(
        results.map(result => (result.forbiddenInTop3.length > 0 ? 1 : 0)),
      ),
    },
    failedCases: results
      .filter(result => result.recallAt3 === 0)
      .map(result => ({
        caseId: result.caseId,
        expectedSkillIds: result.expectedSkillIds,
        retrievedSkillIds: result.retrievedSkillIds,
      })),
  }

  await writeFile(
    join(runDir, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf-8',
  )

  console.log(JSON.stringify(summary, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
