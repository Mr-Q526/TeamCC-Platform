import { appendFile } from 'fs/promises'
import { basename, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createSkillFactEvent } from '../src/events/skillFacts.js'
import {
  hasSkillFactPgConfig,
  insertSkillFactEvent,
} from '../src/events/storage.js'
import {
  buildEvalMarkdownReport,
} from '../src/evals/report.js'
import {
  buildRunManifest,
  createEvalRunId,
  ensureRunLayout,
  finalizeRunManifest,
  listEvalCases,
  loadEvalCase,
  writeJsonFile,
  writeMarkdownReport,
  appendJsonl,
} from '../src/evals/io.js'
import {
  LangfuseEvalClient,
  hasLangfuseConfig,
} from '../src/evals/langfuse.js'
import {
  BENCHMARK_RETRIEVAL_DATASET_NAME,
  getBenchmarkCasesDir,
} from '../src/evals/retrievalDatasets.js'
import {
  loadRetrievalCasesFromLangfuseDataset,
} from '../src/evals/langfuseDatasets.js'
import { runReplayDiagnosis } from '../src/evals/replay.js'
import {
  runGraphUpliftEval,
  runOfflineRetrievalEval,
} from '../src/evals/retrieval.js'
import { runSandboxBlindEval } from '../src/evals/sandbox.js'
import type {
  GraphUpliftCaseResult,
  ReplayDiagnosisCaseResult,
  RetrievalEvalCaseResult,
  SandboxEvalCaseResult,
  SkillEvalCase,
  SkillEvalMode,
  SkillSandboxEvalCase,
  SkillRetrievalEvalCase,
} from '../src/evals/types.js'

type CliOptions = {
  mode: SkillEvalMode
  caseId: string | null
  suite: string | null
  casesDir: string | null
  casesSource: 'filesystem' | 'langfuse-dataset'
  datasetName: string | null
  outputDir: string
  runId: string | null
  topK: number
  baselineRetrievalFeaturesPath: string | null
  experimentRetrievalFeaturesPath: string | null
  replayRunDir: string | null
  projectRoot: string
  sandboxesRoot: string
}

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const DEFAULT_EVAL_ROOT = join(PROJECT_ROOT, 'evals', 'skills')

const LANGFUSE_SCORE_LABELS = {
  recallAt3: 'Recall@3（召回率）',
  mrr: 'MRR（倒数排名均值）',
  ndcgAt5: 'NDCG@5（归一化折损累计增益）',
} as const

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: 'offline-retrieval',
    caseId: null,
    suite: null,
    casesDir: null,
    casesSource: 'filesystem',
    datasetName: BENCHMARK_RETRIEVAL_DATASET_NAME,
    outputDir: join(DEFAULT_EVAL_ROOT, 'runs'),
    runId: null,
    topK: 5,
    baselineRetrievalFeaturesPath: null,
    experimentRetrievalFeaturesPath: null,
    replayRunDir: null,
    projectRoot: PROJECT_ROOT,
    sandboxesRoot: join(DEFAULT_EVAL_ROOT, 'sandboxes'),
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--mode' && next) {
      options.mode = next as SkillEvalMode
      i++
    } else if (arg === '--case' && next) {
      options.caseId = next
      i++
    } else if (arg === '--suite' && next) {
      options.suite = next
      i++
    } else if (arg === '--cases-dir' && next) {
      options.casesDir = resolve(next)
      i++
    } else if (arg === '--cases-source' && next) {
      options.casesSource = next === 'langfuse-dataset' ? 'langfuse-dataset' : 'filesystem'
      i++
    } else if (arg === '--dataset-name' && next) {
      options.datasetName = next
      i++
    } else if (arg === '--output-dir' && next) {
      options.outputDir = resolve(next)
      i++
    } else if (arg === '--run-id' && next) {
      options.runId = next
      i++
    } else if (arg === '--top-k' && next) {
      options.topK = Number(next)
      i++
    } else if (arg === '--baseline-retrieval-features' && next) {
      options.baselineRetrievalFeaturesPath = resolve(next)
      i++
    } else if (arg === '--experiment-retrieval-features' && next) {
      options.experimentRetrievalFeaturesPath = resolve(next)
      i++
    } else if (arg === '--replay-run-dir' && next) {
      options.replayRunDir = resolve(next)
      i++
    } else if (arg === '--project-root' && next) {
      options.projectRoot = resolve(next)
      i++
    } else if (arg === '--sandboxes-root' && next) {
      options.sandboxesRoot = resolve(next)
      i++
    }
  }

  if (!Number.isFinite(options.topK) || options.topK <= 0) {
    throw new Error('--top-k must be a positive number')
  }

  return options
}

function defaultCasesDir(mode: SkillEvalMode): string {
  switch (mode) {
    case 'teamcc-sandbox-blind':
      return join(DEFAULT_EVAL_ROOT, 'cases', 'sandbox')
    case 'offline-retrieval':
    case 'graph-uplift':
      return getBenchmarkCasesDir(PROJECT_ROOT)
    case 'replay-diagnosis':
      return join(DEFAULT_EVAL_ROOT, 'runs')
  }
}

async function emitEvalOutcome(runDir: string, payload: Record<string, unknown>): Promise<void> {
  const event = createSkillFactEvent({
    factKind: 'eval_outcome',
    source: 'eval_runner',
    cwd: PROJECT_ROOT,
    runId: basename(runDir),
    taskId: `eval:${payload.caseId ?? 'summary'}`,
    traceId: `${basename(runDir)}:${payload.caseId ?? 'summary'}`,
    retrievalRoundId: `${basename(runDir)}:${payload.caseId ?? 'summary'}`,
    payload,
  })

  await appendFile(
    join(runDir, 'skill-events.jsonl'),
    `${JSON.stringify(event)}\n`,
    'utf-8',
  )

  if (hasSkillFactPgConfig()) {
    await insertSkillFactEvent(event).catch(() => {})
  }
}

async function loadCases(
  casesDir: string,
  options: CliOptions,
): Promise<SkillEvalCase[]> {
  if (options.casesSource === 'langfuse-dataset') {
    if (options.mode !== 'offline-retrieval' && options.mode !== 'graph-uplift') {
      throw new Error(
        '--cases-source langfuse-dataset currently supports only offline-retrieval and graph-uplift',
      )
    }
    if (!options.datasetName) {
      throw new Error('--dataset-name is required when --cases-source=langfuse-dataset')
    }
    return loadRetrievalCasesFromLangfuseDataset({
      datasetName: options.datasetName,
      caseId: options.caseId,
      suite: options.suite,
    })
  }

  const files = await listEvalCases(casesDir)
  const loaded = await Promise.all(files.map(loadEvalCase))
  return loaded.filter(item => {
    if (options.caseId && item.caseId !== options.caseId) {
      return false
    }
    if (options.suite && !item.caseId.includes(options.suite)) {
      return false
    }
    return true
  })
}

async function maybeWriteLangfuseArtifacts(
  runDir: string,
  mode: SkillEvalMode,
  cases:
    | RetrievalEvalCaseResult[]
    | GraphUpliftCaseResult[]
    | SandboxEvalCaseResult[]
    | ReplayDiagnosisCaseResult[],
  manifest: ReturnType<typeof buildRunManifest>,
): Promise<void> {
  const client = LangfuseEvalClient.fromEnv()
  if (!client) {
    return
  }

  const traces = []
  const errors: string[] = []
  try {
    if (mode === 'offline-retrieval') {
      for (const item of cases as RetrievalEvalCaseResult[]) {
        for (const result of item.modeResults) {
          traces.push(
            await client.recordTrace({
              metadata: {
                runId: manifest.runId,
                mode,
                caseId: item.caseId,
                traceId: result.traceId,
                taskId: result.taskId,
                retrievalRoundId: result.retrievalRoundId,
                requestedMode: result.requestedMode,
                actualMode: result.actualMode,
                skillId: result.candidates[0]?.skillId ?? null,
                skillVersion: null,
                sourceHash: null,
                registryVersion: manifest.assetVersions.registryVersion,
                embeddingsGeneratedAt: manifest.assetVersions.embeddingsGeneratedAt,
                retrievalFeaturesGeneratedAt:
                  manifest.assetVersions.retrievalFeaturesGeneratedAt,
              },
              input: {
                caseId: item.caseId,
                title: item.title,
              },
              output: {
                requestedMode: result.requestedMode,
                actualMode: result.actualMode,
                topCandidate: result.candidates[0] ?? null,
              },
              spans: [
                {
                  name: 'case_load',
                  startedAt: manifest.startedAt,
                  endedAt: manifest.startedAt,
                  metadata: { caseId: item.caseId },
                },
                {
                  name: 'retrieval',
                  startedAt: manifest.startedAt,
                  endedAt: manifest.startedAt,
                  metadata: {
                    requestedMode: result.requestedMode,
                    actualMode: result.actualMode,
                    degraded: result.degraded,
                  },
                },
              ],
              scores: [
                { name: LANGFUSE_SCORE_LABELS.recallAt3, value: result.recallAt3 },
                { name: LANGFUSE_SCORE_LABELS.mrr, value: result.mrr },
                { name: LANGFUSE_SCORE_LABELS.ndcgAt5, value: result.ndcgAt5 },
              ],
            }),
          )
        }
      }
    }

    if (mode === 'teamcc-sandbox-blind') {
      for (const item of cases as SandboxEvalCaseResult[]) {
        traces.push(
          await client.recordTrace({
            metadata: {
              runId: manifest.runId,
              mode,
              caseId: item.caseId,
              traceId: `${manifest.runId}:${item.caseId}`,
              taskId: item.caseId,
              retrievalRoundId: item.caseId,
              requestedMode: null,
              actualMode: null,
              skillId: item.chosenSkill.skillId,
              skillVersion: item.chosenSkill.version,
              sourceHash: item.chosenSkill.sourceHash,
              registryVersion: manifest.assetVersions.registryVersion,
              embeddingsGeneratedAt: manifest.assetVersions.embeddingsGeneratedAt,
              retrievalFeaturesGeneratedAt:
                manifest.assetVersions.retrievalFeaturesGeneratedAt,
            },
            input: {
              caseId: item.caseId,
              sandboxId: item.sandboxId,
            },
            output: {
              verificationPassed: item.verificationPassed,
              judgeSummary: item.judgeResult.summary,
            },
            spans: [
              {
                name: 'teamcc_execution',
                startedAt: manifest.startedAt,
                endedAt: manifest.startedAt,
                metadata: {
                  requestLogged: item.requestLogged,
                  responseLogged: item.responseLogged,
                  eventsLogged: item.eventsLogged,
                },
              },
              {
                name: 'judge',
                startedAt: manifest.startedAt,
                endedAt: manifest.startedAt,
                metadata: {
                  judgeType: item.judgeResult.judgeType,
                  overallPass: item.judgeResult.overallPass,
                },
              },
            ],
            scores: [
              {
                name: 'verification_passed',
                value: item.verificationPassed,
              },
              {
                name: 'overall_pass',
                value: item.judgeResult.overallPass ?? false,
                comment: item.judgeResult.summary,
              },
            ],
          }),
        )
      }
    }

    if (mode === 'graph-uplift') {
      for (const item of cases as GraphUpliftCaseResult[]) {
        traces.push(
          await client.recordTrace({
            metadata: {
              runId: manifest.runId,
              mode,
              caseId: item.caseId,
              traceId: `${manifest.runId}:${item.caseId}`,
              taskId: item.caseId,
              retrievalRoundId: item.caseId,
              requestedMode: 'bm25_vector_graph',
              actualMode: item.experimentMode,
              skillId: item.focusSkillId,
              skillVersion: null,
              sourceHash: null,
              registryVersion: manifest.assetVersions.registryVersion,
              embeddingsGeneratedAt: manifest.assetVersions.embeddingsGeneratedAt,
              retrievalFeaturesGeneratedAt:
                manifest.assetVersions.retrievalFeaturesGeneratedAt,
            },
            input: {
              caseId: item.caseId,
              baselineMode: item.baselineMode,
            },
            output: {
              experimentMode: item.experimentMode,
              rankDelta: item.rankDelta,
              finalScoreDelta: item.finalScoreDelta,
              classification: item.classification,
            },
            spans: [
              {
                name: 'graph_uplift_compare',
                startedAt: manifest.startedAt,
                endedAt: manifest.startedAt,
                metadata: {
                  focusSkillId: item.focusSkillId,
                  baselineRank: item.baselineRank,
                  experimentRank: item.experimentRank,
                },
              },
            ],
            scores: [
              {
                name: 'rank_delta',
                value: item.rankDelta ?? 0,
              },
              {
                name: 'final_score_delta',
                value: item.finalScoreDelta ?? 0,
                comment: item.classification,
              },
            ],
          }),
        )
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }

  await writeJsonFile(join(runDir, 'langfuse.json'), { traces, errors })
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (options.mode === 'replay-diagnosis') {
    const replayRunDir = options.replayRunDir
    if (!replayRunDir) {
      throw new Error('--replay-run-dir is required for replay-diagnosis')
    }
    const replay = await runReplayDiagnosis(replayRunDir)
    await writeJsonFile(join(replayRunDir, 'replay-diagnosis.json'), replay)
    console.log(JSON.stringify(replay, null, 2))
    return
  }

  const casesDir = options.casesDir ?? defaultCasesDir(options.mode)
  const casesLocation =
    options.casesSource === 'langfuse-dataset'
      ? `langfuse://${options.datasetName ?? 'unknown-dataset'}`
      : casesDir
  const runId = options.runId ?? createEvalRunId(options.mode)
  const runDir = join(options.outputDir, runId)
  const { artifactsDir } = await ensureRunLayout(runDir)
  const cases = await loadCases(casesDir, options)
  if (cases.length === 0) {
    throw new Error(`No eval cases matched ${options.caseId ?? options.suite ?? basename(casesDir)}`)
  }

  const retrievalCases = cases.filter(
    (item): item is SkillRetrievalEvalCase => item.caseType === 'retrieval',
  )
  const sandboxCases = cases.filter(
    (item): item is SkillSandboxEvalCase => item.caseType === 'sandbox',
  )

  let assetVersions = {
    registryVersion: null,
    embeddingsGeneratedAt: null,
    retrievalFeaturesGeneratedAt: null,
    aggregateGeneratedAt: null,
  }
  let summary: Record<string, unknown> = {
    mode: options.mode,
    caseCount: cases.length,
  }
  let casesOutput:
    | RetrievalEvalCaseResult[]
    | GraphUpliftCaseResult[]
    | SandboxEvalCaseResult[]
    | ReplayDiagnosisCaseResult[] = []

  if (options.mode === 'offline-retrieval') {
    const result = await runOfflineRetrievalEval({
      projectRoot: options.projectRoot,
      cases: retrievalCases,
      topK: options.topK,
    })
    assetVersions = {
      registryVersion: result.assets.registryManifest?.registryVersion ?? null,
      embeddingsGeneratedAt: result.assets.embeddingsManifest?.generatedAt ?? null,
      retrievalFeaturesGeneratedAt:
        result.assets.retrievalFeaturesManifest?.generatedAt ?? null,
      aggregateGeneratedAt:
        result.assets.retrievalFeaturesManifest?.aggregateGeneratedAt ?? null,
    }
    summary = {
      mode: options.mode,
      ...result.summary,
    }
    casesOutput = result.cases
  } else if (options.mode === 'graph-uplift') {
    const result = await runGraphUpliftEval({
      projectRoot: options.projectRoot,
      cases: retrievalCases,
      topK: options.topK,
      baselineRetrievalFeaturesPath: options.baselineRetrievalFeaturesPath,
      experimentRetrievalFeaturesPath: options.experimentRetrievalFeaturesPath,
    })
    summary = {
      mode: options.mode,
      ...result.summary,
    }
    casesOutput = result.cases
  } else if (options.mode === 'teamcc-sandbox-blind') {
    const result = await runSandboxBlindEval(sandboxCases, {
      runArtifactsDir: artifactsDir,
      sandboxesRoot: options.sandboxesRoot,
    })
    summary = {
      mode: options.mode,
      ...result.summary,
    }
    casesOutput = result.cases
  }

  const manifest = buildRunManifest({
    runId,
    mode: options.mode,
    casesDir: casesLocation,
    outputDir: runDir,
    caseIds: cases.map(item => item.caseId),
    langfuseEnabled: hasLangfuseConfig(),
    assetVersions,
  })
  await writeJsonFile(join(runDir, 'run-manifest.json'), manifest)
  await writeJsonFile(join(runDir, 'cases.json'), casesOutput)
  for (const item of casesOutput) {
    await appendJsonl(join(runDir, 'cases.jsonl'), item)
    await emitEvalOutcome(runDir, {
      mode: options.mode,
      caseId: (item as { caseId: string }).caseId,
      result: item,
    })
  }
  await writeJsonFile(join(runDir, 'summary.json'), summary)
  await writeMarkdownReport(
    join(runDir, 'report.md'),
    buildEvalMarkdownReport({
      runId,
      mode: options.mode,
      cases: casesOutput,
      summary,
    }),
  )
  await maybeWriteLangfuseArtifacts(runDir, options.mode, casesOutput, manifest)
  await writeJsonFile(
    join(runDir, 'run-manifest.json'),
    finalizeRunManifest(manifest, 'completed'),
  )

  console.log(JSON.stringify({ runId, mode: options.mode, summary }, null, 2))
}

main().catch(async error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
