import {
  getSkillGraphFeatures,
  readSkillRetrievalFeatures,
  type SkillGraphFeatureResponse,
  type SkillRetrievalFeaturesManifest,
} from './retrievalFeatures.js'
import type {
  SkillRecallCandidate,
  SkillRetrievalCandidate,
  SkillRetrievalRequest,
} from './types.js'

export type RerankResult = {
  candidates: SkillRetrievalCandidate[]
  retrievalFeaturesGeneratedAt: string | null
  graphApplied: boolean
}

type RerankOptions = {
  enableGraph?: boolean
  retrievalFeaturesManifest?: SkillRetrievalFeaturesManifest | null
  graphFeatureResponse?: SkillGraphFeatureResponse | null
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6))
}

function candidateKey(candidate: {
  skillId: string
  version: string | null | undefined
  sourceHash: string | null | undefined
}): string {
  return `${candidate.skillId}\n${candidate.version ?? ''}\n${candidate.sourceHash ?? ''}`
}

export async function rerankSkills(
  request: SkillRetrievalRequest,
  recallCandidates: SkillRecallCandidate[],
  options: RerankOptions = {},
): Promise<RerankResult> {
  if (recallCandidates.length === 0) {
    return {
      candidates: [],
      retrievalFeaturesGeneratedAt: null,
      graphApplied: false,
    }
  }

  const enableGraph = options.enableGraph ?? true
  const retrievalFeaturesManifest =
    !enableGraph
      ? null
      : options.retrievalFeaturesManifest === undefined
        ? await readSkillRetrievalFeatures()
        : options.retrievalFeaturesManifest

  const graphFeatureResponse =
    !enableGraph || !retrievalFeaturesManifest
      ? null
      : options.graphFeatureResponse ??
        (await getSkillGraphFeatures(
          {
            queryText: request.queryText,
            department: request.department,
            domainHints: request.domainHints,
            sceneHints: request.sceneHints,
            candidates: recallCandidates.map(candidate => ({
              skillId: candidate.skillId,
              version: candidate.version,
              sourceHash: candidate.sourceHash,
            })),
          },
          retrievalFeaturesManifest,
        ))

  const graphFeaturesByKey = new Map(
    (graphFeatureResponse?.items ?? []).map(item => [candidateKey(item), item] as const),
  )
  const maxRecall = Math.max(
    ...recallCandidates.map(candidate => candidate.recallScore),
    0,
  )

  const candidates = recallCandidates
    .map<SkillRetrievalCandidate>(candidate => {
      const graphFeatures = graphFeaturesByKey.get(candidateKey(candidate)) ?? null
      const recallNormalized =
        maxRecall > 0 ? roundMetric(Math.max(candidate.recallScore, 0) / maxRecall) : 0
      const graphFeatureScore = graphFeatures?.graphFeatureScore ?? 0
      const finalScore = roundMetric(
        graphFeatures
          ? 0.7 * recallNormalized + 0.3 * graphFeatureScore
          : recallNormalized,
      )

      return {
        ...candidate,
        graphFeatures,
        finalScore,
        finalScoreBreakdown: {
          recallNormalized,
          graphFeatureScore: roundMetric(graphFeatureScore),
        },
        rank: 0,
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

  return {
    candidates,
    retrievalFeaturesGeneratedAt:
      graphFeatureResponse?.sourceFeaturesGeneratedAt ??
      retrievalFeaturesManifest?.generatedAt ??
      null,
    graphApplied: Boolean(graphFeatureResponse),
  }
}
