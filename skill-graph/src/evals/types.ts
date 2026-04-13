export type SkillEvalMode =
  | 'offline-retrieval'
  | 'graph-uplift'
  | 'teamcc-sandbox-blind'
  | 'replay-diagnosis'

export type SkillRetrievalEvalRequestedMode =
  | 'bm25'
  | 'bm25_vector'
  | 'bm25_vector_graph'

export type SkillRetrievalEvalCase = {
  schemaVersion: '2026-04-12'
  caseType: 'retrieval'
  caseId: string
  title: string
  dataset: string | null
  tags: string[]
  query: {
    queryText: string
    queryContext: string | null
    cwd: string | null
    department: string | null
    domainHints: string[]
    sceneHints: string[]
    priorInjectedSkillIds: string[]
    priorInvokedSkillIds: string[]
    limit: number | null
  }
  expected: {
    mustHitSkillIds: string[]
    acceptableSkillIds: string[]
    forbiddenSkillIds: string[]
  }
  modeOverrides: Partial<
    Record<
      SkillRetrievalEvalRequestedMode,
      {
        disabled: boolean
        note: string | null
      }
    >
  > | null
}

export type SkillSandboxEvalCase = {
  schemaVersion: '2026-04-12'
  caseType: 'sandbox'
  caseId: string
  title: string
  dataset: string | null
  tags: string[]
  sandboxId: string
  taskBrief: string
  projectSeed: {
    rootDir: string
    description: string | null
  }
  expected: {
    goodSkillIds: string[]
    forbiddenSkillIds: string[]
    deliverables: string[]
  }
  verification: {
    commands: string[]
  }
  execution: {
    command: string | null
    artifactsDir: string | null
  }
  judge: {
    type: 'human' | 'llm'
    rubricPath: string | null
    resultPath: string | null
    command: string | null
  }
}

export type SkillEvalCase = SkillRetrievalEvalCase | SkillSandboxEvalCase

export type SkillEvalAssetVersions = {
  registryVersion: string | null
  embeddingsGeneratedAt: string | null
  retrievalFeaturesGeneratedAt: string | null
  aggregateGeneratedAt: string | null
}

export type SkillEvalRunManifest = {
  schemaVersion: '2026-04-12'
  runId: string
  mode: SkillEvalMode
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'completed' | 'failed'
  caseIds: string[]
  casesDir: string
  outputDir: string
  langfuseEnabled: boolean
  assetVersions: SkillEvalAssetVersions
}

export type SkillEvalJudgeResult = {
  schemaVersion: '2026-04-12'
  judgeType: 'human' | 'llm'
  overallPass: boolean | null
  taskOutcomeScore: number | null
  retrievalQualityScore: number | null
  skillSelectionScore: number | null
  executionQualityScore: number | null
  attributionIntegrityScore: number | null
  feedbackLoopScore: number | null
  summary: string
  issues: string[]
  evidence: string[]
}

export type LangfuseEvalTraceMetadata = {
  runId: string
  mode: SkillEvalMode
  caseId: string
  traceId: string
  taskId: string | null
  retrievalRoundId: string | null
  requestedMode: SkillRetrievalEvalRequestedMode | null
  actualMode: string | null
  skillId: string | null
  skillVersion: string | null
  sourceHash: string | null
  registryVersion: string | null
  embeddingsGeneratedAt: string | null
  retrievalFeaturesGeneratedAt: string | null
}

export type RetrievalEvalCandidateRecord = {
  rank: number
  skillId: string
  name: string
  displayName: string
  retrievalSource: string
  recallScore: number
  graphFeatureScore: number | null
  finalScore: number
  finalScoreBreakdown: Record<string, unknown>
  graphFeatureExplanation: Record<string, unknown> | null
}

export type RetrievalEvalModeResult = {
  requestedMode: SkillRetrievalEvalRequestedMode
  actualMode: string
  degraded: boolean
  degradationReason: string | null
  traceId: string
  taskId: string
  retrievalRoundId: string
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
  candidates: RetrievalEvalCandidateRecord[]
}

export type RetrievalEvalCaseResult = {
  caseId: string
  title: string
  dataset: string | null
  tags: string[]
  expected: SkillRetrievalEvalCase['expected']
  requestedModes: SkillRetrievalEvalRequestedMode[]
  modeResults: RetrievalEvalModeResult[]
}

export type GraphUpliftCaseResult = {
  caseId: string
  title: string
  baselineMode: string
  experimentMode: string
  focusSkillId: string | null
  baselineRank: number | null
  experimentRank: number | null
  rankDelta: number | null
  baselineGraphFeatureScore: number | null
  experimentGraphFeatureScore: number | null
  graphScoreDelta: number | null
  baselineFinalScore: number | null
  experimentFinalScore: number | null
  finalScoreDelta: number | null
  classification: 'uplift' | 'neutral' | 'hurt'
}

export type SandboxArtifactPaths = {
  rawInputPath: string | null
  retrievalRequestPath: string | null
  retrievalResponsePath: string | null
  discoveryAttachmentPath: string | null
  chosenSkillPath: string | null
  skillEventsPath: string | null
  finalDiffPath: string | null
  judgeResultPath: string | null
}

export type SandboxEvalCaseResult = {
  caseId: string
  title: string
  sandboxId: string
  commandExitCode: number | null
  verificationPassed: boolean
  verificationResults: Array<{
    command: string
    passed: boolean
    exitCode: number
    stdout: string
    stderr: string
  }>
  chosenSkill: {
    skillId: string | null
    version: string | null
    sourceHash: string | null
  }
  requestLogged: boolean
  responseLogged: boolean
  eventsLogged: boolean
  artifactPaths: SandboxArtifactPaths
  judgeResult: SkillEvalJudgeResult
}

export type ReplayDiagnosisCaseResult = {
  caseId: string
  mode: 'retrieval' | 'sandbox'
  failureCategory: 'R1' | 'R2' | 'T1' | 'T2' | 'E1' | 'F1' | 'PASS'
  summary: string
}
