import {
  recallSkills as recallSkillsFromGraph,
  type SkillScoreBreakdown,
} from '@teamcc/skill-graph/retrieval'
import { retrieveSkills, clearSkillSearchCache } from './provider.js'

export type LocalSkillSearchResult = {
  skillId: string
  name: string
  displayName: string
  description: string
  aliases: string[]
  version: string
  sourceHash: string
  score: number
  scoreBreakdown: SkillScoreBreakdown
  rank: number
  domain: string
  departmentTags: string[]
  sceneTags: string[]
  retrievalSource: 'local_lexical' | 'local_hybrid'
}

export type SkillRecallCandidate = LocalSkillSearchResult & {
  recallScore: number
  recallScoreBreakdown: SkillScoreBreakdown
}

export type SkillRecallResponse = {
  schemaVersion: '2026-04-12'
  generatedAt: string
  queryText: string
  retrievalMode: 'bm25' | 'bm25_vector'
  candidates: SkillRecallCandidate[]
  dataVersions: {
    registryVersion: string | null
    embeddingsGeneratedAt: string | null
  }
}

type LocalSkillSearchOptions = {
  cwd: string
  query: string
  limit?: number
  queryContext?: string
  traceId?: string
  taskId?: string
  retrievalRoundId?: string
  telemetry?: boolean
}

export { type SkillScoreBreakdown }

export function clearSkillIndexCache(): void {
  clearSkillSearchCache()
}

export async function localSkillSearch({
  cwd,
  query,
  limit = 5,
  queryContext,
  traceId,
  taskId,
  retrievalRoundId,
  telemetry = true,
}: LocalSkillSearchOptions): Promise<LocalSkillSearchResult[]> {
  const response = await retrieveSkills({
    cwd,
    queryText: query,
    limit,
    queryContext,
    traceId,
    taskId,
    retrievalRoundId,
    telemetry,
  })

  return response.candidates.map(candidate => ({
    skillId: candidate.skillId,
    name: candidate.name,
    displayName: candidate.displayName,
    description: candidate.description,
    aliases: [],
    version: candidate.version,
    sourceHash: candidate.sourceHash,
    score: candidate.recallScore,
    scoreBreakdown: candidate.recallScoreBreakdown,
    rank: candidate.rank,
    domain: candidate.domain,
    departmentTags: candidate.departmentTags,
    sceneTags: candidate.sceneTags,
    retrievalSource: candidate.retrievalSource,
  }))
}

export async function recallSkills(
  options: LocalSkillSearchOptions,
): Promise<SkillRecallResponse> {
  const response = await recallSkillsFromGraph({
    queryText: options.query,
    queryContext: options.queryContext,
    cwd: options.cwd,
    limit: options.limit ?? 5,
  })

  return {
    schemaVersion: '2026-04-12',
    generatedAt: new Date().toISOString(),
    queryText: options.query.trim(),
    retrievalMode: response.retrievalMode,
    candidates: response.candidates.map((candidate, index) => ({
      skillId: candidate.skillId,
      name: candidate.name,
      displayName: candidate.displayName,
      description: candidate.description,
      aliases: [],
      version: candidate.version,
      sourceHash: candidate.sourceHash,
      score: candidate.recallScore,
      scoreBreakdown: candidate.recallScoreBreakdown,
      rank: index + 1,
      domain: candidate.domain,
      departmentTags: candidate.departmentTags,
      sceneTags: candidate.sceneTags,
      retrievalSource: candidate.retrievalSource,
      recallScore: candidate.recallScore,
      recallScoreBreakdown: candidate.recallScoreBreakdown,
    })),
    dataVersions: response.dataVersions,
  }
}
