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
  penalty: number
}

export type SkillGraphFeatures = {
  skillId: string
  version: string | null
  sourceHash: string | null
  globalQualityScore: number | null
  globalConfidence: number | null
  versionQualityScore: number | null
  versionConfidence: number | null
  departmentScore: number | null
  departmentConfidence: number | null
  sceneScore: number | null
  sceneConfidence: number | null
  invocationCount: number | null
  successRate: number | null
  graphFeatureScore: number
  graphFeatureBreakdown: {
    global: number
    version: number
    department: number
    scene: number
  }
}

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
}

export type SkillRetrievalCandidate = SkillRecallCandidate & {
  graphFeatures: SkillGraphFeatures | null
  finalScore: number
  finalScoreBreakdown: {
    recallNormalized: number
    graphFeatureScore: number
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
