import { mkdir, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { LangfuseClient } from '@langfuse/client'
import { readSkillEmbeddings } from '../src/embeddings/embeddings.js'
import { BENCHMARK_RETRIEVAL_DATASET_NAME } from '../src/evals/retrievalDatasets.js'
import { readSkillRegistry } from '../src/registry/registry.js'
import { readSkillRetrievalFeatures } from '../src/retrieval/retrievalFeatures.js'
import { retrieveSkills } from '../src/retrieval/retrieveSkills.js'
import type {
  SkillRetrievalMode,
  SkillRetrievalResponse,
} from '../src/retrieval/types.js'

type CliOptions = {
  datasetName: string
  mode: SkillRetrievalMode
  projectRoot: string
  outputDir: string
  runName: string | null
}

type RetrievalDatasetInput = {
  queryText?: string
  queryContext?: string | null
  cwd?: string | null
  department?: string | null
  domainHints?: string[]
  sceneHints?: string[]
  priorInjectedSkillIds?: string[]
  priorInvokedSkillIds?: string[]
  limit?: number | null
}

type RetrievalDatasetExpectedOutput = {
  mustHitSkillIds?: string[]
  acceptableSkillIds?: string[]
  forbiddenSkillIds?: string[]
}

type RetrievalExperimentOutput = {
  requestedMode: SkillRetrievalMode
  actualMode: string
  degraded: boolean
  topCandidateSkillId: string | null
  firstExpectedRank: number | null
  firstAcceptableRank: number | null
  forbiddenInTop3: string[]
  recallAt1: number
  recallAt3: number
  recallAt5: number
  mrr: number
  ndcgAt3: number
  ndcgAt5: number
  top1ExactHit: number
  top3AcceptableHit: number
  candidates: Array<{
    rank: number
    skillId: string
    finalScore: number
    recallScore: number
    graphFeatureScore: number | null
  }>
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    datasetName: BENCHMARK_RETRIEVAL_DATASET_NAME,
    mode: 'bm25_vector_graph',
    projectRoot: process.cwd(),
    outputDir: join(process.cwd(), 'evals', 'skills', 'runs'),
    runName: null,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--dataset-name' && next) {
      options.datasetName = next
      index += 1
    } else if (arg === '--mode' && next) {
      options.mode = next as SkillRetrievalMode
      index += 1
    } else if (arg === '--project-root' && next) {
      options.projectRoot = resolve(next)
      index += 1
    } else if (arg === '--output-dir' && next) {
      options.outputDir = resolve(next)
      index += 1
    } else if (arg === '--run-name' && next) {
      options.runName = next
      index += 1
    }
  }

  return options
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
    : []
}

function relevanceForSkill(
  skillId: string,
  expected: Set<string>,
  acceptable: Set<string>,
): number {
  if (expected.has(skillId)) {
    return 1
  }
  if (acceptable.has(skillId)) {
    return 0.5
  }
  return 0
}

function dcg(relevances: number[]): number {
  return relevances.reduce((sum, relevance, index) => {
    if (relevance <= 0) {
      return sum
    }
    return sum + relevance / Math.log2(index + 2)
  }, 0)
}

function ndcgAtK(
  skillIds: string[],
  expected: Set<string>,
  acceptable: Set<string>,
  k: number,
): number {
  const actual = skillIds
    .slice(0, k)
    .map(skillId => relevanceForSkill(skillId, expected, acceptable))
  const ideal = [...expected]
    .map(() => 1)
    .concat([...acceptable].map(() => 0.5))
    .sort((left, right) => right - left)
    .slice(0, k)
  const idealScore = dcg(ideal)
  if (idealScore === 0) {
    return 0
  }
  return Number((dcg(actual) / idealScore).toFixed(6))
}

function average(values: number[]): number | null {
  return values.length > 0
    ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(6))
    : null
}

function buildOutput(
  requestedMode: SkillRetrievalMode,
  response: SkillRetrievalResponse,
  expectedOutput: RetrievalDatasetExpectedOutput | undefined,
): RetrievalExperimentOutput {
  const expected = new Set(toStringArray(expectedOutput?.mustHitSkillIds))
  const acceptable = new Set(toStringArray(expectedOutput?.acceptableSkillIds))
  const forbidden = new Set(toStringArray(expectedOutput?.forbiddenSkillIds))
  const skillIds = response.candidates.map(candidate => candidate.skillId)
  const firstExpectedRank =
    skillIds.findIndex(skillId => expected.has(skillId)) >= 0
      ? skillIds.findIndex(skillId => expected.has(skillId)) + 1
      : null
  const firstAcceptableRank =
    skillIds.findIndex(skillId => acceptable.has(skillId)) >= 0
      ? skillIds.findIndex(skillId => acceptable.has(skillId)) + 1
      : null

  return {
    requestedMode,
    actualMode: response.retrievalMode,
    degraded: response.retrievalMode !== requestedMode,
    topCandidateSkillId: response.candidates[0]?.skillId ?? null,
    firstExpectedRank,
    firstAcceptableRank,
    forbiddenInTop3: skillIds.slice(0, 3).filter(skillId => forbidden.has(skillId)),
    recallAt1: skillIds.slice(0, 1).some(skillId => expected.has(skillId)) ? 1 : 0,
    recallAt3: skillIds.slice(0, 3).some(skillId => expected.has(skillId)) ? 1 : 0,
    recallAt5: skillIds.slice(0, 5).some(skillId => expected.has(skillId)) ? 1 : 0,
    mrr: firstExpectedRank ? Number((1 / firstExpectedRank).toFixed(6)) : 0,
    ndcgAt3: ndcgAtK(skillIds, expected, acceptable, 3),
    ndcgAt5: ndcgAtK(skillIds, expected, acceptable, 5),
    top1ExactHit: skillIds[0] && expected.has(skillIds[0]) ? 1 : 0,
    top3AcceptableHit:
      skillIds
        .slice(0, 3)
        .some(skillId => expected.has(skillId) || acceptable.has(skillId))
        ? 1
        : 0,
    candidates: response.candidates.map(candidate => ({
      rank: candidate.rank,
      skillId: candidate.skillId,
      finalScore: candidate.finalScore,
      recallScore: candidate.recallScore,
      graphFeatureScore: candidate.graphFeatures?.graphFeatureScore ?? null,
    })),
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  const [registryManifest, embeddingsManifest, retrievalFeaturesManifest] =
    await Promise.all([
      readSkillRegistry(options.projectRoot),
      readSkillEmbeddings(options.projectRoot),
      readSkillRetrievalFeatures(),
    ])

  const langfuse = new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? process.env.LANGFUSE_HOST,
  })

  const dataset = await langfuse.dataset.get(options.datasetName)
  const startedAt = new Date()
  const runName =
    options.runName ??
    `retrieval-${options.mode}-${startedAt.toISOString().replace(/[:.]/g, '-')}`

  const result = await dataset.runExperiment({
    name: `Skill Retrieval ${options.mode}`,
    runName,
    description: `Run retrieval benchmark on dataset ${options.datasetName} using ${options.mode}`,
    metadata: {
      source: 'skill-graph',
      evalType: 'offline-retrieval',
      requestedMode: options.mode,
    },
    task: async item => {
      const input = (item.input ?? {}) as RetrievalDatasetInput
      const response = await retrieveSkills(
        {
          queryText: input.queryText ?? '',
          queryContext: input.queryContext ?? undefined,
          cwd: input.cwd ?? options.projectRoot,
          department: input.department ?? undefined,
          domainHints: toStringArray(input.domainHints),
          sceneHints: toStringArray(input.sceneHints),
          priorInjectedSkillIds: toStringArray(input.priorInjectedSkillIds),
          priorInvokedSkillIds: toStringArray(input.priorInvokedSkillIds),
          limit: typeof input.limit === 'number' ? input.limit : 5,
        },
        {
          registryManifest,
          embeddingsManifest: options.mode === 'bm25' ? null : embeddingsManifest,
          retrievalFeaturesManifest:
            options.mode === 'bm25_vector_graph' ? retrievalFeaturesManifest : null,
        },
      )

      return buildOutput(
        options.mode,
        response,
        (item.expectedOutput ?? {}) as RetrievalDatasetExpectedOutput,
      )
    },
    evaluators: [
      async ({ output }) => [
        { name: 'Recall@3（召回率）', value: output.recallAt3 },
        { name: 'MRR（倒数排名均值）', value: output.mrr },
        { name: 'NDCG@5（归一化折损累计增益）', value: output.ndcgAt5 },
        { name: 'Top1 Exact Hit（首位精确命中）', value: output.top1ExactHit },
      ],
    ],
    runEvaluators: [
      async ({ itemResults }) => {
        const outputs = itemResults.map(item => item.output as RetrievalExperimentOutput)
        return [
          {
            name: 'avg_recall_at_3',
            value: average(outputs.map(item => item.recallAt3)),
            comment: 'Average Recall@3 across all dataset items',
          },
          {
            name: 'avg_mrr',
            value: average(outputs.map(item => item.mrr)),
            comment: 'Average MRR across all dataset items',
          },
          {
            name: 'avg_ndcg_at_5',
            value: average(outputs.map(item => item.ndcgAt5)),
            comment: 'Average NDCG@5 across all dataset items',
          },
          {
            name: 'avg_top1_exact_hit',
            value: average(outputs.map(item => item.top1ExactHit)),
            comment: 'Average Top1 exact hit across all dataset items',
          },
          {
            name: 'avg_degraded_rate',
            value: average(outputs.map(item => (item.degraded ? 1 : 0))),
            comment: 'Average degradation rate across all dataset items',
          },
        ]
      },
    ],
  })

  const targetDir = join(
    options.outputDir,
    `langfuse-experiment-${options.mode}-${startedAt.toISOString().replace(/[:.]/g, '-')}`,
  )
  await mkdir(targetDir, { recursive: true })
  await writeFile(
    join(targetDir, 'result.json'),
    `${JSON.stringify(
      {
        experimentId: result.experimentId,
        runName: result.runName,
        datasetRunId: result.datasetRunId ?? null,
        datasetRunUrl: result.datasetRunUrl ?? null,
        runEvaluations: result.runEvaluations,
        itemResultCount: result.itemResults.length,
        sampleItemResults: result.itemResults.slice(0, 3),
      },
      null,
      2,
    )}\n`,
    'utf-8',
  )
  await writeFile(join(targetDir, 'summary.txt'), `${await result.format()}\n`, 'utf-8')

  console.log(
    JSON.stringify(
      {
        experimentId: result.experimentId,
        runName: result.runName,
        datasetRunId: result.datasetRunId ?? null,
        datasetRunUrl: result.datasetRunUrl ?? null,
        itemResultCount: result.itemResults.length,
        runEvaluations: result.runEvaluations,
        artifactDir: targetDir,
      },
      null,
      2,
    ),
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
