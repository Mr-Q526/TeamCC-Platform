import { basename, dirname } from 'path'
import {
  clearSkillRetrievalCache,
  retrieveSkills as retrieveSkillsFromGraph,
  type SkillRetrievalRequest as GraphSkillRetrievalRequest,
  type SkillRetrievalResponse as GraphSkillRetrievalResponse,
} from '@teamcc/skill-graph/retrieval'
import { getIdentityProfile, getProjectRoot } from '../../bootstrap/state.js'
import {
  buildSkillFactEvent,
  createSkillFactAttribution,
  createSkillTelemetryTraceId,
  logSkillFactEvent,
} from './telemetry.js'

export type SkillRetrievalRequest = Omit<
  GraphSkillRetrievalRequest,
  'cwd' | 'department'
> & {
  cwd?: string
  department?: string | null
  traceId?: string
  taskId?: string
  retrievalRoundId?: string
  telemetry?: boolean
}

export type SkillRetrievalResponse = GraphSkillRetrievalResponse

type SkillSearchRuntimeContext = {
  cwd: string
  projectId: string | null
  department: string | null
}

export function normalizeDepartmentHint(label: string | undefined | null): string | null {
  const normalized = label
    ?.trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || null
}

function getSkillSearchRuntimeContext(
  request: Pick<SkillRetrievalRequest, 'cwd' | 'department'>,
): SkillSearchRuntimeContext {
  const profile = getIdentityProfile()

  return {
    cwd: request.cwd ?? getProjectRoot(),
    projectId:
      typeof profile?.projectId === 'number' && Number.isFinite(profile.projectId)
        ? String(profile.projectId)
        : null,
    department:
      normalizeDepartmentHint(request.department) ??
      normalizeDepartmentHint(profile?.departmentLabel) ??
      null,
  }
}

export function buildSkillGraphRetrievalRequest(
  request: SkillRetrievalRequest,
  runtimeContext: SkillSearchRuntimeContext,
): GraphSkillRetrievalRequest {
  return {
    queryText: request.queryText,
    queryContext: request.queryContext,
    cwd: runtimeContext.cwd,
    projectId: runtimeContext.projectId,
    department: runtimeContext.department,
    domainHints: request.domainHints,
    sceneHints: request.sceneHints,
    referencedFiles: request.referencedFiles,
    editedFiles: request.editedFiles,
    priorInjectedSkillIds: request.priorInjectedSkillIds,
    priorInvokedSkillIds: request.priorInvokedSkillIds,
    limit: request.limit,
  }
}

function buildQueryContextWithFiles(request: SkillRetrievalRequest): string {
  const fileHints = [
    ...(request.referencedFiles ?? []),
    ...(request.editedFiles ?? []),
  ]
    .flatMap(file => {
      const trimmed = file.trim()
      if (!trimmed) return []
      return [basename(trimmed), basename(dirname(trimmed))]
    })
    .filter(Boolean)
    .join(' ')

  return [request.queryContext?.trim(), fileHints].filter(Boolean).join('\n')
}

async function logSkillRetrievalTelemetry(
  request: SkillRetrievalRequest,
  response: SkillRetrievalResponse,
  runtimeContext: SkillSearchRuntimeContext,
): Promise<void> {
  const attribution = createSkillFactAttribution(
    request.taskId,
    request.traceId ?? createSkillTelemetryTraceId(),
    request.retrievalRoundId,
  )
  const queryContext = buildQueryContextWithFiles(request)

  await logSkillFactEvent(
    buildSkillFactEvent({
      factKind: 'retrieval_run',
      source: 'system',
      cwd: runtimeContext.cwd,
      projectId: runtimeContext.projectId,
      department: runtimeContext.department,
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
        query: response.queryText,
        queryContext,
        limit: request.limit,
        retrievalMode: response.retrievalMode,
        dataVersions: response.dataVersions,
        candidates: response.candidates.map(candidate => ({
          skillId: candidate.skillId,
          name: candidate.name,
          displayName: candidate.displayName,
          aliases: [],
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
        })),
      },
    }),
  )

  await Promise.all(
    response.candidates.map(candidate =>
      logSkillFactEvent(
        buildSkillFactEvent({
          factKind: 'skill_exposed',
          source: 'system',
          cwd: runtimeContext.cwd,
          projectId: runtimeContext.projectId,
          department: runtimeContext.department,
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
              recallNormalized: candidate.finalScoreBreakdown.recallNormalized,
              graphFeatureScore:
                candidate.finalScoreBreakdown.graphFeatureScore,
            },
          },
          payload: {
            query: response.queryText,
          },
        }),
      ),
    ),
  )
}

export async function retrieveSkills(
  request: SkillRetrievalRequest,
): Promise<GraphSkillRetrievalResponse> {
  const runtimeContext = getSkillSearchRuntimeContext(request)
  const graphRequest = buildSkillGraphRetrievalRequest(request, runtimeContext)
  const response = await retrieveSkillsFromGraph(graphRequest)

  if (request.telemetry !== false) {
    await logSkillRetrievalTelemetry(request, response, runtimeContext)
  }

  return response
}

export function clearSkillSearchCache(): void {
  clearSkillRetrievalCache()
}
