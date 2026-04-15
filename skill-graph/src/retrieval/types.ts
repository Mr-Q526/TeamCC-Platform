export type SkillRetrievalMode = 'bm25' | 'bm25_vector' | 'bm25_vector_graph'

export type SkillScoreBreakdown = {
  exactName: number
  displayName: number
  alias: number
  lexical: number
  bm25: number
  vector: number
  department: number
  domain: number
  scene: number
  intent: number
  discriminator: number
  genericPenalty: number
  penalty: number
}

export type SkillGraphFeatures = {
  skillId: string
  version: string | null
  sourceHash: string | null
  projectScore: number | null
  projectConfidence: number | null
  projectPreferenceScore: number | null
  globalQualityScore: number | null
  globalConfidence: number | null
  globalPreferenceScore: number | null
  versionQualityScore: number | null
  versionConfidence: number | null
  versionPreferenceScore: number | null
  departmentScore: number | null
  departmentConfidence: number | null
  departmentPreferenceScore: number | null
  sceneScore: number | null
  sceneConfidence: number | null
  scenePreferenceScore: number | null
  invocationCount: number | null
  successRate: number | null
  qualityFeatureScore: number
  preferenceFeatureScore: number
  graphFeatureScore: number
  graphFeatureBreakdown: {
    project: number
    global: number
    version: number
    department: number
    scene: number
  }
  qualityFeatureBreakdown: {
    project: number
    global: number
    version: number
    department: number
    scene: number
  }
  preferenceFeatureBreakdown: {
    project: number
    global: number
    version: number
    department: number
    scene: number
  }
  graphFeatureExplanation: SkillGraphFeatureExplanation
}

export type SkillGraphFeatureSignalExplanation = {
  scope: 'project' | 'global' | 'version' | 'department' | 'scene'
  weight: number
  matched: boolean
  matchedKey: string | null
  qualityScore: number | null
  confidence: number | null
  preferenceScore: number | null
  feedbackCount: number | null
  explicitPositiveCount: number | null
  explicitNegativeCount: number | null
  sampleCount: number | null
  invocationCount: number | null
  successRate: number | null
  qualityContribution: number
  preferenceContribution: number
  weightedContribution: number
  reason: string
}

export type SkillGraphFeatureExplanation = {
  formula: string
  signals: SkillGraphFeatureSignalExplanation[]
  missingSignals: string[]
}

export type SkillRetrievalRequest = {
  queryText: string
  queryContext?: string
  cwd: string
  projectId?: string | null
  department?: string | null
  domainHints?: string[]
  sceneHints?: string[]
  referencedFiles?: string[]
  editedFiles?: string[]
  priorInjectedSkillIds?: string[]
  priorInvokedSkillIds?: string[]
  limit: number
}

export type SkillRecallCandidate = {
  skillId: string
  name: string
  displayName: string
  description: string
  aliases: string[]
  version: string
  sourceHash: string
  domain: string
  departmentTags: string[]
  sceneTags: string[]
  skillPath: string
  retrievalSource: 'local_lexical' | 'local_hybrid'
  recallScore: number
  recallScoreBreakdown: SkillScoreBreakdown
  queryIntentKeys: string[]
  queryDiscriminatorKeys: string[]
  matchedIntentKeys: string[]
  matchedDiscriminatorKeys: string[]
}

export type SkillGraphEligibility = {
  eligible: boolean
  strongestScope: 'intent' | 'project' | 'scene' | 'department' | 'none'
  recallGap: number
  bonusCap: number
  blockedReason: string | null
}

export type SkillRetrievalCandidate = SkillRecallCandidate & {
  graphFeatures: SkillGraphFeatures | null
  graphEligibility: SkillGraphEligibility
  finalScore: number
  finalScoreBreakdown: {
    recallNormalized: number
    graphFeatureScore: number
    qualityFeatureScore: number
    preferenceFeatureScore: number
    graphBonus: number
    graphBonusCap: number
    qualityBonus: number
    preferenceBonus: number
    qualityBonusCap: number
    preferenceBonusCap: number
    recallGap: number
    strongestScope: SkillGraphEligibility['strongestScope']
    blockedReason: string | null
    preferenceBlockedReason: string | null
    formula: string
  }
  rank: number
}

export type SkillRetrievalResponse = {
  schemaVersion: '2026-04-12'
  generatedAt: string
  queryText: string
  retrievalMode: SkillRetrievalMode
  candidates: SkillRetrievalCandidate[]
  dataVersions: {
    registryVersion: string | null
    embeddingsGeneratedAt: string | null
    retrievalFeaturesGeneratedAt: string | null
  }
}
