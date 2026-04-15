import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  querySkillFactEvents,
  type SkillFactQueryFilter,
} from '../events/storage.js'
import type { SkillFactEvent } from '../events/skillFacts.js'
import {
  replaceSkillFeedbackAggregatesForWindow,
} from './storage.js'

export type SkillAggregateScopeType =
  | 'global'
  | 'project'
  | 'department'
  | 'scene'
  | 'version'

export type SkillFeedbackAggregate = {
  aggregateKey: string
  scopeType: SkillAggregateScopeType
  scopeId: string
  skillId: string
  skillVersion: string | null
  sourceHash: string | null
  projectId: string | null
  department: string | null
  scene: string | null
  window: string
  sampleCount: number
  exposureCount: number
  selectionCount: number
  invocationCount: number
  terminalCount: number
  successCount: number
  failureCount: number
  verificationPassCount: number
  feedbackCount: number
  explicitPositiveCount: number
  explicitNegativeCount: number
  selectionRate: number
  invocationRate: number
  successRate: number
  verificationPassRate: number
  userSatisfaction: number
  avgRankWhenShown: number | null
  freshnessScore: number
  failurePenalty: number
  costPenalty: number
  qualityScore: number
  confidence: number
  firstEventAt: string
  lastEventAt: string
  updatedAt: string
}

export type SkillFeedbackAggregateManifest = {
  schemaVersion: string
  generatedAt: string
  window: string
  windowDays: number
  source: 'skill_fact_events'
  itemCount: number
  items: SkillFeedbackAggregate[]
}

type BuildSkillFactAggregatesOptions = {
  windowDays?: number
  targetSampleCount?: number
  now?: string
  sourceEvents?: SkillFactEvent[]
  factFilter?: SkillFactAggregationEventFilter
}

type ReadSkillFactAggregateSourceOptions = {
  windowDays?: number
  pageSize?: number
  createdAfter?: string | null
  factFilter?: SkillFactAggregationEventFilter
}

export type SkillFactAggregationEventFilter = {
  includeSources?: Array<SkillFactEvent['source']>
  excludeSources?: Array<SkillFactEvent['source']>
  includeRunIds?: string[]
  excludeRunIds?: string[]
  includeRunIdPrefixes?: string[]
  excludeRunIdPrefixes?: string[]
}

type AggregateAccumulator = {
  scopeType: SkillAggregateScopeType
  scopeId: string
  skillId: string
  skillVersion: string | null
  sourceHash: string | null
  projectId: string | null
  department: string | null
  scene: string | null
  exposureCount: number
  selectionCount: number
  invocationCount: number
  terminalCount: number
  successCount: number
  failureCount: number
  verificationPassCount: number
  feedbackCount: number
  explicitPositiveCount: number
  explicitNegativeCount: number
  satisfactionScoreSum: number
  rankSum: number
  rankCount: number
  taskIds: Set<string>
  firstEventAtMs: number
  lastEventAtMs: number
}

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DEFAULT_OUTPUT_FILE = join(
  PROJECT_ROOT,
  'data',
  'aggregates',
  'skill-feedback-aggregates.json',
)
const DEFAULT_WINDOW_DAYS = 30
const DEFAULT_PAGE_SIZE = 1000
const DEFAULT_TARGET_SAMPLE_COUNT = 20
const MIN_SATISFACTION = 0.5

function clamp(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6))
}

function aggregateKeyFor(
  scopeType: SkillAggregateScopeType,
  scopeId: string,
  skillId: string,
  window: string,
): string {
  return `agg:skill:${skillId}:${scopeType}:${scopeId}:${window}`
}

function toWindowLabel(windowDays: number): string {
  return `${windowDays}d`
}

function toVersionScopeId(
  skillVersion: string | null,
  sourceHash: string | null,
): string | null {
  if (!skillVersion || !sourceHash) {
    return null
  }

  return `${skillVersion}#${sourceHash}`
}

function normalizeNullableScopeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeFeedbackScore(event: SkillFactEvent): number | null {
  const rating = event.feedback.rating
  if (typeof rating === 'number' && Number.isFinite(rating)) {
    return clamp(rating / 5)
  }

  switch (event.feedback.sentiment) {
    case 'positive':
      return 1
    case 'negative':
      return 0
    case 'neutral':
      return 0.5
    default:
      return null
  }
}

function updateAccumulatorEventCounts(
  accumulator: AggregateAccumulator,
  event: SkillFactEvent,
): void {
  switch (event.factKind) {
    case 'skill_exposed':
      accumulator.exposureCount += 1
      if (typeof event.retrieval.rank === 'number' && Number.isFinite(event.retrieval.rank)) {
        accumulator.rankSum += event.retrieval.rank
        accumulator.rankCount += 1
      }
      break
    case 'skill_selected':
      accumulator.selectionCount += 1
      break
    case 'skill_invoked':
      accumulator.invocationCount += 1
      break
    case 'skill_completed':
    case 'skill_failed':
      accumulator.terminalCount += 1
      if (event.outcome.success === true || event.factKind === 'skill_completed') {
        accumulator.successCount += 1
      } else {
        accumulator.failureCount += 1
      }
      if (event.outcome.verificationPassed === true) {
        accumulator.verificationPassCount += 1
      }
      break
    case 'skill_feedback': {
      accumulator.feedbackCount += 1
      const score = normalizeFeedbackScore(event)
      if (score !== null) {
        accumulator.satisfactionScoreSum += score
        if (score >= 0.6) {
          accumulator.explicitPositiveCount += 1
        } else if (score <= 0.4) {
          accumulator.explicitNegativeCount += 1
        }
      }
      break
    }
    default:
      break
  }
}

function createAccumulator(
  event: SkillFactEvent,
  scopeType: SkillAggregateScopeType,
  scopeId: string,
): AggregateAccumulator {
  const createdAtMs = Date.parse(event.createdAt)
  return {
    scopeType,
    scopeId,
    skillId: event.skillId as string,
    skillVersion: event.skillVersion,
    sourceHash: event.sourceHash,
    projectId: scopeType === 'project' ? event.context.projectId : null,
    department: scopeType === 'department' ? event.context.department : null,
    scene: scopeType === 'scene' ? event.context.scene : null,
    exposureCount: 0,
    selectionCount: 0,
    invocationCount: 0,
    terminalCount: 0,
    successCount: 0,
    failureCount: 0,
    verificationPassCount: 0,
    feedbackCount: 0,
    explicitPositiveCount: 0,
    explicitNegativeCount: 0,
    satisfactionScoreSum: 0,
    rankSum: 0,
    rankCount: 0,
    taskIds: new Set<string>(),
    firstEventAtMs: createdAtMs,
    lastEventAtMs: createdAtMs,
  }
}

function updateAccumulator(
  accumulator: AggregateAccumulator,
  event: SkillFactEvent,
): void {
  const createdAtMs = Date.parse(event.createdAt)
  accumulator.firstEventAtMs = Math.min(accumulator.firstEventAtMs, createdAtMs)
  accumulator.lastEventAtMs = Math.max(accumulator.lastEventAtMs, createdAtMs)
  accumulator.taskIds.add(event.taskId)
  updateAccumulatorEventCounts(accumulator, event)
}

function buildAccumulatorKey(
  scopeType: SkillAggregateScopeType,
  scopeId: string,
  skillId: string,
): string {
  return `${scopeType}\n${scopeId}\n${skillId}`
}

function pushEventToAggregateScope(
  aggregates: Map<string, AggregateAccumulator>,
  event: SkillFactEvent,
  scopeType: SkillAggregateScopeType,
  scopeId: string | null,
): void {
  if (!scopeId || !event.skillId) {
    return
  }

  const key = buildAccumulatorKey(scopeType, scopeId, event.skillId)
  const accumulator =
    aggregates.get(key) ?? createAccumulator(event, scopeType, scopeId)
  updateAccumulator(accumulator, event)
  aggregates.set(key, accumulator)
}

function freshnessScore(
  lastEventAtMs: number,
  nowMs: number,
  windowMs: number,
): number {
  const ageMs = Math.max(0, nowMs - lastEventAtMs)
  return clamp(1 - ageMs / windowMs)
}

function confidenceScore(sampleCount: number, targetSampleCount: number): number {
  if (sampleCount <= 0) {
    return 0
  }

  return clamp(
    Math.log(1 + sampleCount) / Math.log(1 + Math.max(targetSampleCount, 1)),
  )
}

function finalizeAccumulator(
  accumulator: AggregateAccumulator,
  options: {
    nowMs: number
    targetSampleCount: number
    window: string
    windowMs: number
    updatedAt: string
  },
): SkillFeedbackAggregate {
  const sampleCount = accumulator.taskIds.size
  const selectionRate =
    accumulator.exposureCount > 0
      ? accumulator.selectionCount / accumulator.exposureCount
      : 0
  const invocationRate =
    accumulator.exposureCount > 0
      ? accumulator.invocationCount / accumulator.exposureCount
      : accumulator.selectionCount > 0
        ? accumulator.invocationCount / accumulator.selectionCount
        : 0
  const successRate =
    accumulator.invocationCount > 0
      ? accumulator.successCount / accumulator.invocationCount
      : accumulator.terminalCount > 0
        ? accumulator.successCount / accumulator.terminalCount
        : 0
  const verificationPassRate =
    accumulator.invocationCount > 0
      ? accumulator.verificationPassCount / accumulator.invocationCount
      : accumulator.terminalCount > 0
        ? accumulator.verificationPassCount / accumulator.terminalCount
        : 0
  const userSatisfaction =
    accumulator.feedbackCount > 0
      ? accumulator.satisfactionScoreSum / accumulator.feedbackCount
      : MIN_SATISFACTION
  const avgRankWhenShown =
    accumulator.rankCount > 0 ? accumulator.rankSum / accumulator.rankCount : null
  const freshness = freshnessScore(
    accumulator.lastEventAtMs,
    options.nowMs,
    options.windowMs,
  )
  const failurePenalty =
    accumulator.terminalCount > 0
      ? accumulator.failureCount / accumulator.terminalCount
      : accumulator.invocationCount > 0
        ? 1 - successRate
        : 0
  const costPenalty = 0
  const quality =
    0.3 * successRate +
    0.2 * userSatisfaction +
    0.15 * verificationPassRate +
    0.15 * invocationRate +
    0.1 * selectionRate +
    0.1 * freshness -
    0.05 * costPenalty -
    0.05 * failurePenalty
  const confidence = confidenceScore(sampleCount, options.targetSampleCount)

  return {
    aggregateKey: aggregateKeyFor(
      accumulator.scopeType,
      accumulator.scopeId,
      accumulator.skillId,
      options.window,
    ),
    scopeType: accumulator.scopeType,
    scopeId: accumulator.scopeId,
    skillId: accumulator.skillId,
    skillVersion: accumulator.scopeType === 'version' ? accumulator.skillVersion : null,
    sourceHash: accumulator.scopeType === 'version' ? accumulator.sourceHash : null,
    projectId: accumulator.projectId,
    department: accumulator.department,
    scene: accumulator.scene,
    window: options.window,
    sampleCount,
    exposureCount: accumulator.exposureCount,
    selectionCount: accumulator.selectionCount,
    invocationCount: accumulator.invocationCount,
    terminalCount: accumulator.terminalCount,
    successCount: accumulator.successCount,
    failureCount: accumulator.failureCount,
    verificationPassCount: accumulator.verificationPassCount,
    feedbackCount: accumulator.feedbackCount,
    explicitPositiveCount: accumulator.explicitPositiveCount,
    explicitNegativeCount: accumulator.explicitNegativeCount,
    selectionRate: roundMetric(selectionRate),
    invocationRate: roundMetric(invocationRate),
    successRate: roundMetric(successRate),
    verificationPassRate: roundMetric(verificationPassRate),
    userSatisfaction: roundMetric(userSatisfaction),
    avgRankWhenShown:
      avgRankWhenShown === null ? null : roundMetric(avgRankWhenShown),
    freshnessScore: roundMetric(freshness),
    failurePenalty: roundMetric(failurePenalty),
    costPenalty: roundMetric(costPenalty),
    qualityScore: roundMetric(clamp(quality)),
    confidence: roundMetric(confidence),
    firstEventAt: new Date(accumulator.firstEventAtMs).toISOString(),
    lastEventAt: new Date(accumulator.lastEventAtMs).toISOString(),
    updatedAt: options.updatedAt,
  }
}

export function buildSkillFactAggregates(
  events: SkillFactEvent[],
  options: BuildSkillFactAggregatesOptions = {},
): SkillFeedbackAggregateManifest {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const window = toWindowLabel(windowDays)
  const targetSampleCount =
    options.targetSampleCount ?? DEFAULT_TARGET_SAMPLE_COUNT
  const now = options.now ? new Date(options.now) : new Date()
  const nowMs = now.getTime()
  const windowMs = windowDays * 24 * 60 * 60 * 1000
  const aggregates = new Map<string, AggregateAccumulator>()

  for (const event of events) {
    if (!event.skillId || event.resolutionError) {
      continue
    }

    pushEventToAggregateScope(aggregates, event, 'global', 'global')
    pushEventToAggregateScope(
      aggregates,
      event,
      'project',
      normalizeNullableScopeId(event.context.projectId),
    )
    pushEventToAggregateScope(
      aggregates,
      event,
      'department',
      event.context.department,
    )
    pushEventToAggregateScope(aggregates, event, 'scene', event.context.scene)
    pushEventToAggregateScope(
      aggregates,
      event,
      'version',
      toVersionScopeId(event.skillVersion, event.sourceHash),
    )
  }

  const updatedAt = now.toISOString()
  const items = [...aggregates.values()]
    .map(accumulator =>
      finalizeAccumulator(accumulator, {
        nowMs,
        targetSampleCount,
        window,
        windowMs,
        updatedAt,
      }),
    )
    .sort((left, right) => {
      if (left.skillId !== right.skillId) {
        return left.skillId.localeCompare(right.skillId)
      }
      if (left.scopeType !== right.scopeType) {
        return left.scopeType.localeCompare(right.scopeType)
      }
      return left.scopeId.localeCompare(right.scopeId)
    })

  return {
    schemaVersion: '2026-04-12',
    generatedAt: updatedAt,
    window,
    windowDays,
    source: 'skill_fact_events',
    itemCount: items.length,
    items,
  }
}

function matchesEventFilter(
  event: SkillFactEvent,
  filter: SkillFactAggregationEventFilter | undefined,
): boolean {
  if (!filter) {
    return true
  }

  const source = event.source
  const runId = event.runId

  if (filter.includeSources && filter.includeSources.length > 0) {
    if (!source || !filter.includeSources.includes(source)) {
      return false
    }
  }

  if (filter.excludeSources && source && filter.excludeSources.includes(source)) {
    return false
  }

  if (filter.includeRunIds && filter.includeRunIds.length > 0) {
    if (!runId || !filter.includeRunIds.includes(runId)) {
      return false
    }
  }

  if (filter.excludeRunIds && runId && filter.excludeRunIds.includes(runId)) {
    return false
  }

  if (filter.includeRunIdPrefixes && filter.includeRunIdPrefixes.length > 0) {
    if (
      !runId ||
      !filter.includeRunIdPrefixes.some(prefix => runId.startsWith(prefix))
    ) {
      return false
    }
  }

  if (
    filter.excludeRunIdPrefixes &&
    runId &&
    filter.excludeRunIdPrefixes.some(prefix => runId.startsWith(prefix))
  ) {
    return false
  }

  return true
}

export function filterSkillFactEventsForAggregation(
  events: SkillFactEvent[],
  filter: SkillFactAggregationEventFilter | undefined,
): SkillFactEvent[] {
  return filter ? events.filter(event => matchesEventFilter(event, filter)) : events
}

export async function readSkillFactEventsForAggregation(
  options: ReadSkillFactAggregateSourceOptions = {},
): Promise<SkillFactEvent[]> {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const createdAfter =
    options.createdAfter ??
    new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
  const factKinds: SkillFactQueryFilter['factKinds'] = [
    'skill_exposed',
    'skill_selected',
    'skill_invoked',
    'skill_completed',
    'skill_failed',
    'skill_feedback',
    'eval_outcome',
  ]

  const events: SkillFactEvent[] = []
  let createdBefore: string | null = null

  while (true) {
    const batch = await querySkillFactEvents({
      factKinds,
      createdAfter,
      createdBefore,
      limit: pageSize,
    })

    if (batch.length === 0) {
      break
    }

    events.push(...batch)

    if (batch.length < pageSize) {
      break
    }

    const oldestEvent = batch[batch.length - 1]
    const nextCursorMs = Date.parse(oldestEvent.createdAt) - 1
    createdBefore = new Date(nextCursorMs).toISOString()
  }

  return filterSkillFactEventsForAggregation(events, options.factFilter)
}

export async function buildAndWriteSkillFactAggregates(
  options: BuildSkillFactAggregatesOptions & {
    outputFile?: string
    writeJson?: boolean
    writePg?: boolean
  } = {},
): Promise<SkillFeedbackAggregateManifest> {
  const events =
    options.sourceEvents
      ? filterSkillFactEventsForAggregation(options.sourceEvents, options.factFilter)
      : await readSkillFactEventsForAggregation(options)
  const manifest = buildSkillFactAggregates(events, options)
  const outputFile = options.outputFile ?? DEFAULT_OUTPUT_FILE
  const writeJson = options.writeJson ?? true
  const writePg = options.writePg ?? true

  if (writeJson) {
    await mkdir(dirname(outputFile), { recursive: true })
    await writeFile(`${outputFile}`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
  }

  if (writePg) {
    await replaceSkillFeedbackAggregatesForWindow(manifest.window, manifest)
  }

  return manifest
}
