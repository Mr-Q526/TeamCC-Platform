import { randomUUID } from 'crypto'
import { embedQueryText, readSkillEmbeddings } from '../embeddings/embeddings.js'
import { readSkillRegistry } from '../registry/registry.js'
import { readSkillRetrievalFeatures } from '../retrieval/retrievalFeatures.js'
import { retrieveSkills } from '../retrieval/retrieveSkills.js'
import type { SkillRetrievalCandidate } from '../retrieval/types.js'
import type {
  GraphUpliftCaseResult,
  RetrievalEvalCandidateRecord,
  RetrievalEvalCaseResult,
  RetrievalPreferenceMetricSummary,
  RetrievalEvalModeResult,
  SkillRetrievalEvalCase,
  SkillRetrievalEvalRequestedMode,
} from './types.js'

export type RetrievalEvalAssetBundle = {
  registryManifest: Awaited<ReturnType<typeof readSkillRegistry>>
  embeddingsManifest: Awaited<ReturnType<typeof readSkillEmbeddings>>
  retrievalFeaturesManifest: Awaited<ReturnType<typeof readSkillRetrievalFeatures>>
}

export type OfflineRetrievalEvalOptions = {
  projectRoot: string
  cases: SkillRetrievalEvalCase[]
  topK: number
  retrievalFeaturesPath?: string | null
}

type RetrievalMetricSummary = {
  recallAt1: number
  recallAt3: number
  recallAt5: number
  mrr: number
  ndcgAt3: number
  ndcgAt5: number
  top1ExactHit: number
  top3AcceptableHit: number
  degradedRate: number
}

function domainTag(tags: string[]): string {
  return (
    tags.find(tag =>
      ['frontend', 'backend', 'design', 'tools', 'security', 'infra', 'general', 'ai', 'review'].includes(
        tag,
      ),
    ) ?? 'untagged'
  )
}

function prefixedTag(tags: string[], prefix: string): string {
  return tags.find(tag => tag.startsWith(prefix)) ?? 'untagged'
}

export type GraphUpliftEvalOptions = OfflineRetrievalEvalOptions & {
  baselineRetrievalFeaturesPath?: string | null
  experimentRetrievalFeaturesPath?: string | null
}

function average(values: number[]): number {
  return values.length > 0
    ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(6))
    : 0
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

function candidateRecord(candidate: SkillRetrievalCandidate): RetrievalEvalCandidateRecord {
  return {
    rank: candidate.rank,
    skillId: candidate.skillId,
    name: candidate.name,
    displayName: candidate.displayName,
    retrievalSource: candidate.retrievalSource,
    recallScore: candidate.recallScore,
    graphFeatureScore: candidate.graphFeatures?.graphFeatureScore ?? null,
    finalScore: candidate.finalScore,
    finalScoreBreakdown: candidate.finalScoreBreakdown as Record<string, unknown>,
    graphFeatureExplanation:
      (candidate.graphFeatures?.graphFeatureExplanation as Record<string, unknown> | undefined) ??
      null,
  }
}

async function loadAssets(
  projectRoot: string,
  retrievalFeaturesPath?: string | null,
): Promise<RetrievalEvalAssetBundle> {
  const [registryManifest, embeddingsManifest, retrievalFeaturesManifest] =
    await Promise.all([
      readSkillRegistry(projectRoot),
      readSkillEmbeddings(projectRoot),
      retrievalFeaturesPath === null
        ? Promise.resolve(null)
        : retrievalFeaturesPath
          ? readSkillRetrievalFeatures(retrievalFeaturesPath)
          : readSkillRetrievalFeatures(),
    ])

  return {
    registryManifest,
    embeddingsManifest,
    retrievalFeaturesManifest,
  }
}

async function resolveQueryEmbedding(
  requestedMode: SkillRetrievalEvalRequestedMode,
  evalCase: SkillRetrievalEvalCase,
): Promise<{
  vector: number[]
} | null> {
  if (requestedMode === 'bm25') {
    return null
  }

  const queryText = [evalCase.query.queryText, evalCase.query.queryContext]
    .filter(Boolean)
    .join('\n')
  const embedded = await embedQueryText(queryText)
  return embedded ? { vector: embedded.vector } : null
}

async function evaluateMode(
  bundle: RetrievalEvalAssetBundle,
  evalCase: SkillRetrievalEvalCase,
  requestedMode: SkillRetrievalEvalRequestedMode,
  topK: number,
  retrievalFeaturesOverride:
    | Awaited<ReturnType<typeof readSkillRetrievalFeatures>>
    | undefined,
): Promise<RetrievalEvalModeResult> {
  const expected = new Set(evalCase.expected.mustHitSkillIds)
  const acceptable = new Set(evalCase.expected.acceptableSkillIds)
  const forbidden = new Set(evalCase.expected.forbiddenSkillIds)
  const queryEmbedding = await resolveQueryEmbedding(requestedMode, evalCase)
  const response = await retrieveSkills(
    {
      queryText: evalCase.query.queryText,
      queryContext: evalCase.query.queryContext ?? undefined,
      cwd: evalCase.query.cwd ?? process.cwd(),
      projectId: evalCase.query.projectId ?? undefined,
      department: evalCase.query.department ?? undefined,
      domainHints: evalCase.query.domainHints,
      sceneHints: evalCase.query.sceneHints,
      priorInjectedSkillIds: evalCase.query.priorInjectedSkillIds,
      priorInvokedSkillIds: evalCase.query.priorInvokedSkillIds,
      limit: evalCase.query.limit ?? topK,
    },
    {
      registryManifest: bundle.registryManifest,
      embeddingsManifest:
        requestedMode === 'bm25' ? null : bundle.embeddingsManifest,
      queryEmbedding,
      retrievalFeaturesManifest:
        requestedMode === 'bm25_vector_graph'
          ? retrievalFeaturesOverride === undefined
            ? bundle.retrievalFeaturesManifest
            : retrievalFeaturesOverride
          : null,
    },
  )

  const skillIds = response.candidates.map(candidate => candidate.skillId)
  const traceId = randomUUID()
  const firstExpectedRank =
    skillIds.findIndex(skillId => expected.has(skillId)) >= 0
      ? skillIds.findIndex(skillId => expected.has(skillId)) + 1
      : null
  const firstAcceptableRank =
    skillIds.findIndex(skillId => acceptable.has(skillId)) >= 0
      ? skillIds.findIndex(skillId => acceptable.has(skillId)) + 1
      : null

  const degraded = response.retrievalMode !== requestedMode
  let degradationReason: string | null = null
  if (degraded) {
    degradationReason =
      requestedMode === 'bm25_vector_graph' && !queryEmbedding
        ? 'query_embedding_unavailable'
        : requestedMode === 'bm25_vector_graph' &&
            !bundle.retrievalFeaturesManifest &&
            retrievalFeaturesOverride !== null
          ? 'retrieval_features_unavailable'
          : requestedMode !== 'bm25' && !queryEmbedding
            ? 'query_embedding_unavailable'
            : 'mode_degraded'
  }

  return {
    requestedMode,
    actualMode: response.retrievalMode,
    degraded,
    degradationReason,
    traceId,
    taskId: `eval:${evalCase.caseId}:${requestedMode}`,
    retrievalRoundId: traceId,
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
    candidates: response.candidates.map(candidateRecord),
  }
}

function summarizeRequestedModes(
  results: RetrievalEvalCaseResult[],
): Record<SkillRetrievalEvalRequestedMode, RetrievalMetricSummary> {
  return Object.fromEntries(
    (['bm25', 'bm25_vector', 'bm25_vector_graph'] as const).map(mode => {
      const flattened = results
        .flatMap(result => result.modeResults)
        .filter(result => result.requestedMode === mode)

      return [
        mode,
        {
          recallAt1: average(flattened.map(result => result.recallAt1)),
          recallAt3: average(flattened.map(result => result.recallAt3)),
          recallAt5: average(flattened.map(result => result.recallAt5)),
          mrr: average(flattened.map(result => result.mrr)),
          ndcgAt3: average(flattened.map(result => result.ndcgAt3)),
          ndcgAt5: average(flattened.map(result => result.ndcgAt5)),
          top1ExactHit: average(flattened.map(result => result.top1ExactHit)),
          top3AcceptableHit: average(
            flattened.map(result => result.top3AcceptableHit),
          ),
          degradedRate: average(flattened.map(result => (result.degraded ? 1 : 0))),
        },
      ]
    }),
  ) as Record<SkillRetrievalEvalRequestedMode, RetrievalMetricSummary>
}

function summarizeByGrouping(
  results: RetrievalEvalCaseResult[],
  selector: (result: RetrievalEvalCaseResult) => string,
): Record<
  string,
  {
    caseCount: number
    metricsByRequestedMode: Record<SkillRetrievalEvalRequestedMode, RetrievalMetricSummary>
  }
> {
  const grouped = new Map<string, RetrievalEvalCaseResult[]>()
  for (const result of results) {
    const key = selector(result)
    const bucket = grouped.get(key) ?? []
    bucket.push(result)
    grouped.set(key, bucket)
  }

  return Object.fromEntries(
    [...grouped.entries()].map(([key, bucket]) => [
      key,
      {
        caseCount: bucket.length,
        metricsByRequestedMode: summarizeRequestedModes(bucket),
      },
    ]),
  )
}

function summarizePreferenceCases(
  results: RetrievalEvalCaseResult[],
): RetrievalPreferenceMetricSummary | null {
  const preferenceCases = results.filter(result => result.expected.preference !== null)
  if (preferenceCases.length === 0) {
    return null
  }

  const graphResults = preferenceCases
    .map(result => result.modeResults.find(item => item.requestedMode === 'bm25_vector_graph'))
    .filter((item): item is RetrievalEvalModeResult => item !== undefined)

  if (graphResults.length === 0) {
    return {
      caseCount: preferenceCases.length,
      preferredSkillTop1Rate: 0,
      preferredSkillBeatsCompetitorRate: 0,
      wrongIntentHijackRate: 0,
      graphAppliedRate: 0,
      preferenceBonusAppliedRate: 0,
    }
  }

  const caseCount = graphResults.length
  let preferredTop1 = 0
  let preferredBeatsCompetitor = 0
  let wrongIntentHijack = 0
  let graphApplied = 0
  let preferenceBonusApplied = 0

  for (const result of preferenceCases) {
    const preference = result.expected.preference
    const graph = result.modeResults.find(item => item.requestedMode === 'bm25_vector_graph')
    if (!preference || !graph) {
      continue
    }

    const topCandidate = graph.candidates[0] ?? null
    const preferredCandidate =
      graph.candidates.find(candidate => candidate.skillId === preference.preferredSkillId) ??
      null
    const competingCandidate =
      graph.candidates.find(candidate => candidate.skillId === preference.competingSkillId) ??
      null

    if (topCandidate?.skillId === preference.preferredSkillId) {
      preferredTop1 += 1
    }

    if (
      preferredCandidate &&
      competingCandidate &&
      preferredCandidate.rank < competingCandidate.rank
    ) {
      preferredBeatsCompetitor += 1
    }

    if (
      topCandidate &&
      topCandidate.skillId !== preference.preferredSkillId &&
      topCandidate.skillId !== preference.competingSkillId &&
      !result.expected.acceptableSkillIds.includes(topCandidate.skillId)
    ) {
      wrongIntentHijack += 1
    }

    if (
      graph.candidates.some(
        candidate => (candidate.finalScoreBreakdown.graphBonus ?? 0) > 0,
      )
    ) {
      graphApplied += 1
    }

    if (
      preferredCandidate &&
      (preferredCandidate.finalScoreBreakdown.preferenceBonus ?? 0) > 0
    ) {
      preferenceBonusApplied += 1
    }
  }

  return {
    caseCount,
    preferredSkillTop1Rate: average([preferredTop1 / caseCount]),
    preferredSkillBeatsCompetitorRate: average([preferredBeatsCompetitor / caseCount]),
    wrongIntentHijackRate: average([wrongIntentHijack / caseCount]),
    graphAppliedRate: average([graphApplied / caseCount]),
    preferenceBonusAppliedRate: average([preferenceBonusApplied / caseCount]),
  }
}

export async function runOfflineRetrievalEval(
  options: OfflineRetrievalEvalOptions,
): Promise<{
  cases: RetrievalEvalCaseResult[]
  summary: {
    caseCount: number
    metricsByRequestedMode: Record<SkillRetrievalEvalRequestedMode, RetrievalMetricSummary>
    metricsByPrimaryTag: Record<
      string,
      {
        caseCount: number
        metricsByRequestedMode: Record<
          SkillRetrievalEvalRequestedMode,
          RetrievalMetricSummary
        >
      }
    >
    metricsByDomain: Record<
      string,
      {
        caseCount: number
        metricsByRequestedMode: Record<
          SkillRetrievalEvalRequestedMode,
          RetrievalMetricSummary
        >
      }
    >
    metricsByDifficulty: Record<
      string,
      {
        caseCount: number
        metricsByRequestedMode: Record<
          SkillRetrievalEvalRequestedMode,
          RetrievalMetricSummary
        >
      }
    >
    metricsByLanguage: Record<
      string,
      {
        caseCount: number
        metricsByRequestedMode: Record<
          SkillRetrievalEvalRequestedMode,
          RetrievalMetricSummary
        >
      }
    >
    preferenceMetrics: RetrievalPreferenceMetricSummary | null
  }
  assets: RetrievalEvalAssetBundle
}> {
  const bundle = await loadAssets(
    options.projectRoot,
    options.retrievalFeaturesPath,
  )
  const results: RetrievalEvalCaseResult[] = []

  for (const evalCase of options.cases) {
    const modes: SkillRetrievalEvalRequestedMode[] = [
      'bm25',
      'bm25_vector',
      'bm25_vector_graph',
    ].filter(mode => !evalCase.modeOverrides?.[mode]?.disabled)
    const modeResults: RetrievalEvalModeResult[] = []

    for (const mode of modes) {
      modeResults.push(
        await evaluateMode(bundle, evalCase, mode, options.topK, undefined),
      )
    }

    results.push({
      caseId: evalCase.caseId,
      title: evalCase.title,
      dataset: evalCase.dataset,
      tags: evalCase.tags,
      expected: evalCase.expected,
      requestedModes: modes,
      modeResults,
    })
  }

  const metricsByRequestedMode = summarizeRequestedModes(results)
  const metricsByPrimaryTag = summarizeByGrouping(results, result => result.tags[0] ?? 'untagged')
  const metricsByDomain = summarizeByGrouping(results, result => domainTag(result.tags))
  const metricsByDifficulty = summarizeByGrouping(results, result =>
    prefixedTag(result.tags, 'difficulty:'),
  )
  const metricsByLanguage = summarizeByGrouping(results, result =>
    prefixedTag(result.tags, 'lang:'),
  )
  const preferenceMetrics = summarizePreferenceCases(results)

  return {
    cases: results,
    summary: {
      caseCount: results.length,
      metricsByRequestedMode,
      metricsByPrimaryTag,
      metricsByDomain,
      metricsByDifficulty,
      metricsByLanguage,
      preferenceMetrics,
    },
    assets: bundle,
  }
}

function candidateBySkillId(
  result: RetrievalEvalModeResult | undefined,
  skillId: string | null,
): RetrievalEvalCandidateRecord | null {
  if (!result || !skillId) {
    return null
  }
  return result.candidates.find(candidate => candidate.skillId === skillId) ?? null
}

export async function runGraphUpliftEval(
  options: GraphUpliftEvalOptions,
): Promise<{
  cases: GraphUpliftCaseResult[]
  summary: {
    caseCount: number
    upliftCount: number
    neutralCount: number
    hurtCount: number
  }
}> {
  const bundle = await loadAssets(options.projectRoot)
  const baselineFeatures =
    options.baselineRetrievalFeaturesPath === null
      ? null
      : options.baselineRetrievalFeaturesPath
        ? await readSkillRetrievalFeatures(options.baselineRetrievalFeaturesPath)
        : null
  const experimentFeatures =
    options.experimentRetrievalFeaturesPath === undefined
      ? bundle.retrievalFeaturesManifest
      : await readSkillRetrievalFeatures(options.experimentRetrievalFeaturesPath)

  const cases: GraphUpliftCaseResult[] = []

  for (const evalCase of options.cases) {
    const focusSkillId = evalCase.expected.mustHitSkillIds[0] ?? null
    const baseline = await evaluateMode(
      bundle,
      evalCase,
      baselineFeatures ? 'bm25_vector_graph' : 'bm25_vector',
      options.topK,
      baselineFeatures,
    )
    const experiment = await evaluateMode(
      bundle,
      evalCase,
      'bm25_vector_graph',
      options.topK,
      experimentFeatures,
    )
    const baselineCandidate = candidateBySkillId(baseline, focusSkillId)
    const experimentCandidate = candidateBySkillId(experiment, focusSkillId)
    const baselineRank = baselineCandidate?.rank ?? null
    const experimentRank = experimentCandidate?.rank ?? null
    const rankDelta =
      baselineRank !== null && experimentRank !== null
        ? baselineRank - experimentRank
        : null
    const graphScoreDelta =
      experimentCandidate?.graphFeatureScore !== null &&
      experimentCandidate?.graphFeatureScore !== undefined
        ? Number(
            (
              (experimentCandidate.graphFeatureScore ?? 0) -
              (baselineCandidate?.graphFeatureScore ?? 0)
            ).toFixed(6),
          )
        : null
    const finalScoreDelta =
      baselineCandidate && experimentCandidate
        ? Number(
            (experimentCandidate.finalScore - baselineCandidate.finalScore).toFixed(6),
          )
        : null
    const classification =
      rankDelta === null
        ? 'neutral'
        : rankDelta > 0
          ? 'uplift'
          : rankDelta < 0
            ? 'hurt'
            : 'neutral'

    cases.push({
      caseId: evalCase.caseId,
      title: evalCase.title,
      baselineMode: baseline.actualMode,
      experimentMode: experiment.actualMode,
      focusSkillId,
      baselineRank,
      experimentRank,
      rankDelta,
      baselineGraphFeatureScore: baselineCandidate?.graphFeatureScore ?? null,
      experimentGraphFeatureScore: experimentCandidate?.graphFeatureScore ?? null,
      graphScoreDelta,
      baselineFinalScore: baselineCandidate?.finalScore ?? null,
      experimentFinalScore: experimentCandidate?.finalScore ?? null,
      finalScoreDelta,
      classification,
    })
  }

  return {
    cases,
    summary: {
      caseCount: cases.length,
      upliftCount: cases.filter(item => item.classification === 'uplift').length,
      neutralCount: cases.filter(item => item.classification === 'neutral').length,
      hurtCount: cases.filter(item => item.classification === 'hurt').length,
    },
  }
}
