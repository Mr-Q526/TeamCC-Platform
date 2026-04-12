import { basename, dirname } from 'path'
import {
  buildSkillFactEvent,
  createSkillFactAttribution,
  createSkillTelemetryTraceId,
  logSkillFactEvent,
} from './telemetry.js'
import {
  buildSkillFeatureResultKey,
  getSkillGraphFeatures,
  readSkillEmbeddings,
  readSkillRegistry,
  readSkillRetrievalFeatures,
  type SkillGraphFeatures,
} from './skillGraphProvider.js'
import {
  localSkillSearch,
  type LocalSkillSearchResult,
  type SkillScoreBreakdown,
} from './localSearch.js'

export type SkillRetrievalRequest = {
  queryText: string
  queryContext?: string
  cwd: string
  department?: string | null
  domainHints?: string[]
  sceneHints?: string[]
  referencedFiles?: string[]
  editedFiles?: string[]
  priorInjectedSkillIds?: string[]
  priorInvokedSkillIds?: string[]
  limit: number
  traceId?: string
  taskId?: string
  retrievalRoundId?: string
  telemetry?: boolean
}

export type SkillRecallCandidate = Omit<
  LocalSkillSearchResult,
  'score' | 'scoreBreakdown'
> & {
  recallScore: number
  recallScoreBreakdown: SkillScoreBreakdown
}

export type SkillRetrievalCandidate = SkillRecallCandidate & {
  graphFeatures: SkillGraphFeatures | null
  finalScore: number
  finalScoreBreakdown: {
    recallNormalized: number
    graphFeatureScore: number
  }
}

export type SkillRetrievalResponse = {
  schemaVersion: '2026-04-12'
  generatedAt: string
  queryText: string
  retrievalMode: 'bm25' | 'bm25_vector' | 'bm25_vector_graph'
  candidates: SkillRetrievalCandidate[]
  dataVersions: {
    registryVersion: string | null
    embeddingsGeneratedAt: string | null
    aggregateGeneratedAt: string | null
  }
}

function normalizeScore(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  if (max <= min) {
    return 1
  }

  return (value - min) / (max - min)
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function buildQueryContextWithFiles(request: SkillRetrievalRequest): string {
  const fileHints = [
    ...(request.referencedFiles ?? []),
    ...(request.editedFiles ?? []),
  ]
    .flatMap(file => {
      const trimmed = file.trim()
      if (!trimmed) return []
      return uniqueStrings([basename(trimmed), basename(dirname(trimmed))])
    })
    .join(' ')

  return [request.queryContext?.trim(), fileHints].filter(Boolean).join('\n')
}

function toRecallCandidate(result: LocalSkillSearchResult): SkillRecallCandidate {
  return {
    skillId: result.skillId,
    name: result.name,
    displayName: result.displayName,
    description: result.description,
    aliases: result.aliases,
    version: result.version,
    sourceHash: result.sourceHash,
    rank: result.rank,
    domain: result.domain,
    departmentTags: result.departmentTags,
    sceneTags: result.sceneTags,
    retrievalSource: result.retrievalSource,
    recallScore: result.score,
    recallScoreBreakdown: result.scoreBreakdown,
  }
}

export async function recallSkills(
  request: SkillRetrievalRequest,
): Promise<{
  retrievalMode: 'bm25' | 'bm25_vector'
  candidates: SkillRecallCandidate[]
  dataVersions: {
    registryVersion: string | null
    embeddingsGeneratedAt: string | null
  }
}> {
  const enrichedQueryContext = buildQueryContextWithFiles(request)
  const recallLimit = Math.max(request.limit * 5, 20)
  const [results, registry, embeddings] = await Promise.all([
    localSkillSearch({
      cwd: request.cwd,
      query: request.queryText,
      limit: recallLimit,
      queryContext: enrichedQueryContext,
      traceId: request.traceId,
      taskId: request.taskId,
      retrievalRoundId: request.retrievalRoundId,
      telemetry: false,
    }),
    readSkillRegistry(request.cwd),
    readSkillEmbeddings(request.cwd),
  ])

  return {
    retrievalMode: embeddings ? 'bm25_vector' : 'bm25',
    candidates: results.map(toRecallCandidate),
    dataVersions: {
      registryVersion: registry?.registryVersion ?? null,
      embeddingsGeneratedAt: embeddings?.generatedAt ?? null,
    },
  }
}

function filterPreviouslySeenCandidates(
  candidates: SkillRecallCandidate[],
  request: SkillRetrievalRequest,
): SkillRecallCandidate[] {
  const injectedIds = new Set(request.priorInjectedSkillIds ?? [])
  const invokedIds = new Set(request.priorInvokedSkillIds ?? [])

  return candidates.filter(
    candidate =>
      !injectedIds.has(candidate.skillId) && !invokedIds.has(candidate.skillId),
  )
}

function rankRetrievedCandidates(
  candidates: SkillRecallCandidate[],
  graphFeatures: Map<string, SkillGraphFeatures>,
  useGraphRerank: boolean,
): SkillRetrievalCandidate[] {
  const filtered = candidates.slice()
  const recallScores = filtered.map(candidate => candidate.recallScore)
  const maxRecallScore = recallScores.length > 0 ? Math.max(...recallScores) : 0
  const minRecallScore = recallScores.length > 0 ? Math.min(...recallScores) : 0

  return filtered
    .map(candidate => {
      const recallNormalized = normalizeScore(
        candidate.recallScore,
        minRecallScore,
        maxRecallScore,
      )
      const features = useGraphRerank
        ? graphFeatures.get(
            buildSkillFeatureResultKey({
              skillId: candidate.skillId,
              version: candidate.version,
              sourceHash: candidate.sourceHash,
            }),
          ) ?? null
        : null
      const graphFeatureScore = features?.graphFeatureScore ?? 0
      const finalScore = useGraphRerank
        ? 0.7 * recallNormalized + 0.3 * graphFeatureScore
        : recallNormalized

      return {
        ...candidate,
        graphFeatures: features,
        finalScore,
        finalScoreBreakdown: {
          recallNormalized,
          graphFeatureScore,
        },
      }
    })
    .sort((left, right) => {
      if (right.finalScore !== left.finalScore) {
        return right.finalScore - left.finalScore
      }
      if (right.recallScore !== left.recallScore) {
        return right.recallScore - left.recallScore
      }
      return left.name.localeCompare(right.name)
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
    }))
}

function toTelemetryCandidate(candidate: SkillRetrievalCandidate) {
  return {
    skillId: candidate.skillId,
    name: candidate.name,
    displayName: candidate.displayName,
    aliases: candidate.aliases,
    version: candidate.version,
    sourceHash: candidate.sourceHash,
    domain: candidate.domain,
    departmentTags: candidate.departmentTags,
    sceneTags: candidate.sceneTags,
    rank: candidate.rank,
    retrievalSource: candidate.retrievalSource,
    recallScore: candidate.recallScore,
    recallScoreBreakdown: candidate.recallScoreBreakdown,
    finalScore: candidate.finalScore,
    finalScoreBreakdown: candidate.finalScoreBreakdown,
    graphFeatures: candidate.graphFeatures,
  }
}

export async function retrieveSkills(
  request: SkillRetrievalRequest,
): Promise<SkillRetrievalResponse> {
  const queryText = request.queryText.trim()
  if (!queryText) {
    return {
      schemaVersion: '2026-04-12',
      generatedAt: new Date().toISOString(),
      queryText,
      retrievalMode: 'bm25',
      candidates: [],
      dataVersions: {
        registryVersion: null,
        embeddingsGeneratedAt: null,
        aggregateGeneratedAt: null,
      },
    }
  }

  const traceId = request.traceId ?? createSkillTelemetryTraceId()
  const attribution = createSkillFactAttribution(
    request.taskId,
    traceId,
    request.retrievalRoundId,
  )
  const recall = await recallSkills({
    ...request,
    traceId: attribution.traceId,
    taskId: attribution.taskId,
    retrievalRoundId: attribution.retrievalRoundId,
  })
  const filteredRecallCandidates = filterPreviouslySeenCandidates(
    recall.candidates,
    request,
  )
  const retrievalFeatures = await readSkillRetrievalFeatures()
  const useGraphRerank =
    recall.retrievalMode === 'bm25_vector' && retrievalFeatures !== null
  const graphFeatures = useGraphRerank
    ? await getSkillGraphFeatures(
        {
          department: request.department ?? null,
          sceneHints: request.sceneHints ?? [],
        },
        filteredRecallCandidates.map(candidate => ({
          skillId: candidate.skillId,
          version: candidate.version,
          sourceHash: candidate.sourceHash,
        })),
      )
    : new Map<string, SkillGraphFeatures>()

  const rankedCandidates = rankRetrievedCandidates(
    filteredRecallCandidates,
    graphFeatures,
    useGraphRerank,
  ).slice(0, request.limit)

  const response: SkillRetrievalResponse = {
    schemaVersion: '2026-04-12',
    generatedAt: new Date().toISOString(),
    queryText,
    retrievalMode: useGraphRerank
      ? 'bm25_vector_graph'
      : recall.retrievalMode,
    candidates: rankedCandidates,
    dataVersions: {
      registryVersion: recall.dataVersions.registryVersion,
      embeddingsGeneratedAt: recall.dataVersions.embeddingsGeneratedAt,
      aggregateGeneratedAt: retrievalFeatures?.manifest.generatedAt ?? null,
    },
  }

  if (request.telemetry !== false) {
    const queryContext = buildQueryContextWithFiles(request)
    await logSkillFactEvent(
      buildSkillFactEvent({
        factKind: 'retrieval_run',
        source: 'system',
        cwd: request.cwd,
        department: request.department ?? null,
        domain: request.domainHints?.[0] ?? null,
        scene: request.sceneHints?.[0] ?? null,
        taskId: attribution.taskId,
        traceId: attribution.traceId,
        retrievalRoundId: attribution.retrievalRoundId,
        retrieval: {
          candidateCount: response.candidates.length,
          retrievalSource: response.retrievalMode,
        },
        payload: {
          query: queryText,
          queryContext,
          limit: request.limit,
          retrievalMode: response.retrievalMode,
          dataVersions: response.dataVersions,
          candidates: response.candidates.map(toTelemetryCandidate),
        },
      }),
    )

    await Promise.all(
      response.candidates.map(candidate =>
        logSkillFactEvent(
          buildSkillFactEvent({
            factKind: 'skill_exposed',
            source: 'system',
            cwd: request.cwd,
            department: request.department ?? null,
            scene: candidate.sceneTags[0] ?? request.sceneHints?.[0] ?? null,
            domain: candidate.domain,
            taskId: attribution.taskId,
            traceId: attribution.traceId,
            retrievalRoundId: attribution.retrievalRoundId,
            skillId: candidate.skillId,
            skillName: candidate.name,
            skillVersion: candidate.version,
            sourceHash: candidate.sourceHash,
            retrieval: {
              rank: candidate.rank,
              candidateCount: response.candidates.length,
              retrievalSource: response.retrievalMode,
              score: candidate.finalScore,
              scoreBreakdown: {
                recallNormalized:
                  candidate.finalScoreBreakdown.recallNormalized,
                graphFeatureScore:
                  candidate.finalScoreBreakdown.graphFeatureScore,
              },
            },
            payload: {
              query: queryText,
            },
          }),
        ),
      ),
    )
  }

  return response
}
