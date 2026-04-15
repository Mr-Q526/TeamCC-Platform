import {
  getSkillGraphFeatures,
  readSkillRetrievalFeatures,
  type SkillGraphFeatureResponse,
  type SkillRetrievalFeaturesManifest,
} from './retrievalFeatures.js'
import type {
  SkillGraphEligibility,
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

function strongestContextScope(candidate: SkillRetrievalCandidate | SkillRecallCandidate, graphScore: {
  projectScore: number | null
  sceneScore: number | null
  departmentScore: number | null
} | null): 'project' | 'scene' | 'department' | 'none' {
  if (graphScore?.projectScore !== null) {
    return 'project'
  }
  if (graphScore?.sceneScore !== null) {
    return 'scene'
  }
  if (graphScore?.departmentScore !== null) {
    return 'department'
  }
  return 'none'
}

function recallGapThreshold(scope: 'project' | 'scene' | 'department' | 'none'): number {
  switch (scope) {
    case 'project':
      return 0.15
    case 'scene':
      return 0.1
    case 'department':
      return 0.05
    default:
      return 0
  }
}

function qualityBonusCapFor(
  scope: 'project' | 'scene' | 'department' | 'none',
  candidate: SkillRecallCandidate,
): number {
  const matchedDiscriminatorKeys = candidate.matchedDiscriminatorKeys ?? []
  const matchedIntentKeys = candidate.matchedIntentKeys ?? []
  if (
    matchedDiscriminatorKeys.length > 0 ||
    matchedIntentKeys.length > 0
  ) {
    return 0.05
  }

  switch (scope) {
    case 'project':
      return 0.04
    case 'scene':
      return 0.03
    case 'department':
      return 0.02
    default:
      return 0
  }
}

function preferenceBonusCapFor(
  scope: 'project' | 'scene' | 'department' | 'none',
  candidate: SkillRecallCandidate,
): number {
  const matchedDiscriminatorKeys = candidate.matchedDiscriminatorKeys ?? []
  const matchedIntentKeys = candidate.matchedIntentKeys ?? []
  if (
    matchedDiscriminatorKeys.length > 0 ||
    matchedIntentKeys.length > 0
  ) {
    return 0.08
  }

  switch (scope) {
    case 'project':
      return 0.05
    case 'scene':
      return 0.035
    case 'department':
      return 0.02
    default:
      return 0
  }
}

function hasIntentAlignment(candidate: SkillRecallCandidate): boolean {
  const queryDiscriminatorKeys = candidate.queryDiscriminatorKeys ?? []
  const queryIntentKeys = candidate.queryIntentKeys ?? []
  const matchedDiscriminatorKeys = candidate.matchedDiscriminatorKeys ?? []
  const matchedIntentKeys = candidate.matchedIntentKeys ?? []

  if (queryDiscriminatorKeys.length > 0) {
    return matchedDiscriminatorKeys.length > 0
  }

  if (queryIntentKeys.length > 0) {
    return matchedIntentKeys.length > 0
  }

  return false
}

function blockedReasonForIntentMismatch(candidate: SkillRecallCandidate): string | null {
  const queryDiscriminatorKeys = candidate.queryDiscriminatorKeys ?? []
  const matchedDiscriminatorKeys = candidate.matchedDiscriminatorKeys ?? []
  const queryIntentKeys = candidate.queryIntentKeys ?? []
  const matchedIntentKeys = candidate.matchedIntentKeys ?? []

  if (
    queryDiscriminatorKeys.length > 0 &&
    matchedDiscriminatorKeys.length === 0
  ) {
    return 'intent_discriminator_mismatch'
  }

  if (
    queryIntentKeys.length > 0 &&
    matchedIntentKeys.length === 0
  ) {
    return 'intent_mismatch'
  }

  if (
    queryIntentKeys.includes('deployment') &&
    !matchedIntentKeys.includes('deployment')
  ) {
    return 'deployment_intent_mismatch'
  }

  return null
}

function computeGraphEligibility(input: {
  candidate: SkillRecallCandidate
  graphFeatureScore: number
  graphFeatures: SkillRetrievalCandidate['graphFeatures']
  recallNormalized: number
  topRecallNormalized: number
}): SkillGraphEligibility {
  const contextScope = strongestContextScope(input.candidate, input.graphFeatures)
  const recallGap = roundMetric(input.topRecallNormalized - input.recallNormalized)
  const blockedForIntent = blockedReasonForIntentMismatch(input.candidate)
  const bonusCap = qualityBonusCapFor(contextScope, input.candidate)

  if (!input.graphFeatures) {
    return {
      eligible: false,
      strongestScope: 'none',
      recallGap,
      bonusCap: 0,
      blockedReason: 'graph_features_unavailable',
    }
  }

  if (contextScope === 'none' || input.graphFeatureScore <= 0) {
    return {
      eligible: false,
      strongestScope: 'none',
      recallGap,
      bonusCap: 0,
      blockedReason: 'no_context_match',
    }
  }

  if (blockedForIntent) {
    return {
      eligible: false,
      strongestScope: 'intent',
      recallGap,
      bonusCap,
      blockedReason: blockedForIntent,
    }
  }

  const threshold = recallGapThreshold(contextScope)
  if (recallGap > threshold) {
    const matchedDiscriminatorKeys = input.candidate.matchedDiscriminatorKeys ?? []
    const matchedIntentKeys = input.candidate.matchedIntentKeys ?? []
    return {
      eligible: false,
      strongestScope:
        matchedDiscriminatorKeys.length > 0 ||
        matchedIntentKeys.length > 0
          ? 'intent'
          : contextScope,
      recallGap,
      bonusCap,
      blockedReason: `recall_gap_exceeded:${threshold.toFixed(2)}`,
    }
  }

  return {
    eligible: true,
    strongestScope:
      (input.candidate.matchedDiscriminatorKeys ?? []).length > 0 ||
      (input.candidate.matchedIntentKeys ?? []).length > 0
        ? 'intent'
        : contextScope,
    recallGap,
    bonusCap,
    blockedReason: null,
  }
}

function computePreferenceBlockedReason(input: {
  candidate: SkillRecallCandidate
  graphEligibility: SkillGraphEligibility
  graphFeatures: SkillRetrievalCandidate['graphFeatures']
  preferenceFeatureScore: number
}): string | null {
  if (!input.graphEligibility.eligible) {
    return input.graphEligibility.blockedReason
  }

  if (input.graphFeatures?.projectPreferenceScore === null) {
    return 'preference_requires_project_match'
  }

  if (input.preferenceFeatureScore <= 0) {
    return 'preference_signal_unavailable'
  }

  if (!hasIntentAlignment(input.candidate)) {
    return 'preference_intent_unavailable'
  }

  return null
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
            projectId: request.projectId,
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
      const graphFeatureScore = roundMetric(graphFeatures?.graphFeatureScore ?? 0)
      const qualityFeatureScore = roundMetric(
        graphFeatures?.qualityFeatureScore ?? 0,
      )
      const preferenceFeatureScore = roundMetric(
        graphFeatures?.preferenceFeatureScore ?? 0,
      )
      const graphEligibility = computeGraphEligibility({
        candidate,
        graphFeatures,
        graphFeatureScore,
        recallNormalized,
        topRecallNormalized: 1,
      })
      const qualityBonusCap = graphEligibility.eligible
        ? graphEligibility.bonusCap
        : 0
      const qualityBonus = graphEligibility.eligible
        ? roundMetric(
            Math.min(
              qualityBonusCap,
              qualityBonusCap * qualityFeatureScore,
            ),
          )
        : 0
      const preferenceBonusCap = graphEligibility.eligible
        ? preferenceBonusCapFor(
            strongestContextScope(candidate, graphFeatures),
            candidate,
          )
        : 0
      const preferenceBlockedReason = computePreferenceBlockedReason({
        candidate,
        graphEligibility,
        graphFeatures,
        preferenceFeatureScore,
      })
      const effectivePreferenceBonusCap =
        preferenceBlockedReason === null ? preferenceBonusCap : 0
      const preferenceBonus =
        preferenceBlockedReason === null
          ? roundMetric(
              Math.min(
                effectivePreferenceBonusCap,
                effectivePreferenceBonusCap * preferenceFeatureScore,
              ),
            )
          : 0
      const graphBonus = roundMetric(qualityBonus + preferenceBonus)
      const finalScore = roundMetric(recallNormalized + graphBonus)

      return {
        ...candidate,
        graphFeatures,
        graphEligibility,
        finalScore,
        finalScoreBreakdown: {
          recallNormalized,
          graphFeatureScore,
          qualityFeatureScore,
          preferenceFeatureScore,
          graphBonus,
          graphBonusCap: roundMetric(qualityBonusCap + effectivePreferenceBonusCap),
          qualityBonus,
          preferenceBonus,
          qualityBonusCap,
          preferenceBonusCap: effectivePreferenceBonusCap,
          recallGap: graphEligibility.recallGap,
          strongestScope: graphEligibility.strongestScope,
          blockedReason: graphEligibility.blockedReason,
          preferenceBlockedReason,
          formula: 'finalScore = recallNormalized + qualityBonus + preferenceBonus',
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
