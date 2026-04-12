import { randomUUID } from 'crypto'

export const SKILL_FACT_SCHEMA_VERSION = '2026-04-12' as const

export type SkillFactSchemaVersion = typeof SKILL_FACT_SCHEMA_VERSION

export type SkillFactKind =
  | 'retrieval_run'
  | 'skill_exposed'
  | 'skill_selected'
  | 'skill_invoked'
  | 'skill_completed'
  | 'skill_failed'
  | 'skill_feedback'
  | 'eval_outcome'

export type SkillFactSource = 'user' | 'model' | 'system' | 'eval_runner'

export type SkillFactSelectionSource =
  | 'user'
  | 'model'
  | 'system'
  | 'eval_runner'

export type SkillFactContext = {
  cwd: string | null
  projectId: string | null
  department: string | null
  scene: string | null
  domain: string | null
}

export type SkillFactRetrieval = {
  rank: number | null
  candidateCount: number | null
  retrievalSource: string | null
  score: number | null
  scoreBreakdown: Record<string, number> | null
  selectedBy: SkillFactSelectionSource | null
}

export type SkillFactOutcome = {
  success: boolean | null
  verificationPassed: boolean | null
  failureReason: string | null
  durationMs: number | null
}

export type SkillFactFeedback = {
  rating: number | null
  sentiment: 'positive' | 'negative' | 'neutral' | null
  comment: string | null
}

export type SkillFactEvent = {
  eventId: string
  schemaVersion: SkillFactSchemaVersion
  factKind: SkillFactKind
  source: SkillFactSource | null
  createdAt: string
  runId: string | null
  traceId: string
  taskId: string
  retrievalRoundId: string
  skillId: string | null
  skillName: string | null
  skillVersion: string | null
  sourceHash: string | null
  context: SkillFactContext
  retrieval: SkillFactRetrieval
  outcome: SkillFactOutcome
  feedback: SkillFactFeedback
  resolutionError: string | null
  payload: Record<string, unknown> | null
}

export type SkillFactEventInput = {
  eventId?: string | null
  schemaVersion?: SkillFactSchemaVersion | null
  factKind: SkillFactKind
  source?: SkillFactSource | null
  createdAt?: string | null
  runId?: string | null
  traceId?: string | null
  taskId?: string | null
  retrievalRoundId?: string | null
  skillId?: string | null
  skillName?: string | null
  skillVersion?: string | null
  sourceHash?: string | null
  context?: Partial<SkillFactContext> | null
  retrieval?: Partial<SkillFactRetrieval> | null
  outcome?: Partial<SkillFactOutcome> | null
  feedback?: Partial<SkillFactFeedback> | null
  resolutionError?: string | null
  payload?: Record<string, unknown> | null
}

const IDENTITY_REQUIRED_KINDS = new Set<SkillFactKind>([
  'skill_exposed',
  'skill_selected',
  'skill_invoked',
  'skill_completed',
  'skill_failed',
  'skill_feedback',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return trimmed
}

function normalizeIdentityValue(value: unknown): string | null {
  const normalized = normalizeString(value)
  if (!normalized) {
    return null
  }

  if (normalized.toLowerCase() === 'unknown') {
    return null
  }

  return normalized
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function normalizeSelectionSource(
  value: unknown,
): SkillFactSelectionSource | null {
  if (
    value === 'user' ||
    value === 'model' ||
    value === 'system' ||
    value === 'eval_runner'
  ) {
    return value
  }

  return null
}

function normalizeSource(value: unknown): SkillFactSource | null {
  if (
    value === 'user' ||
    value === 'model' ||
    value === 'system' ||
    value === 'eval_runner'
  ) {
    return value
  }

  return null
}

function normalizeSentiment(
  value: unknown,
): SkillFactFeedback['sentiment'] {
  if (value === 'positive' || value === 'negative' || value === 'neutral') {
    return value
  }

  return null
}

function normalizeScoreBreakdown(
  value: unknown,
): Record<string, number> | null {
  if (!isRecord(value)) {
    return null
  }

  const entries = Object.entries(value)
    .filter(([, item]) => typeof item === 'number' && Number.isFinite(item))
    .map(([key, item]) => [key, item] as const)

  if (entries.length === 0) {
    return null
  }

  return Object.fromEntries(entries)
}

function normalizePayload(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function normalizeContext(value: unknown): SkillFactContext {
  const record = isRecord(value) ? value : {}
  return {
    cwd: normalizeString(record.cwd),
    projectId: normalizeString(record.projectId),
    department: normalizeString(record.department),
    scene: normalizeString(record.scene),
    domain: normalizeString(record.domain),
  }
}

function normalizeRetrieval(value: unknown): SkillFactRetrieval {
  const record = isRecord(value) ? value : {}
  return {
    rank: normalizeNumber(record.rank),
    candidateCount: normalizeNumber(record.candidateCount),
    retrievalSource: normalizeString(record.retrievalSource),
    score: normalizeNumber(record.score),
    scoreBreakdown: normalizeScoreBreakdown(record.scoreBreakdown),
    selectedBy: normalizeSelectionSource(record.selectedBy),
  }
}

function normalizeOutcome(value: unknown): SkillFactOutcome {
  const record = isRecord(value) ? value : {}
  return {
    success: normalizeBoolean(record.success),
    verificationPassed: normalizeBoolean(record.verificationPassed),
    failureReason: normalizeString(record.failureReason),
    durationMs: normalizeNumber(record.durationMs),
  }
}

function normalizeFeedback(value: unknown): SkillFactFeedback {
  const record = isRecord(value) ? value : {}
  return {
    rating: normalizeNumber(record.rating),
    sentiment: normalizeSentiment(record.sentiment),
    comment: normalizeString(record.comment),
  }
}

function inferResolutionError(
  factKind: SkillFactKind,
  skillId: string | null,
  skillVersion: string | null,
  sourceHash: string | null,
  resolutionError: string | null,
): string | null {
  if (resolutionError) {
    return resolutionError
  }

  if (!IDENTITY_REQUIRED_KINDS.has(factKind)) {
    return null
  }

  if (skillId && skillVersion && sourceHash) {
    return null
  }

  return 'skill_identity_unresolved'
}

export function createSkillFactEvent(
  input: SkillFactEventInput,
): SkillFactEvent {
  const traceId = normalizeString(input.traceId) ?? randomUUID()
  const taskId = normalizeString(input.taskId) ?? traceId
  const retrievalRoundId = normalizeString(input.retrievalRoundId) ?? traceId
  const skillId = normalizeIdentityValue(input.skillId)
  const skillVersion = normalizeIdentityValue(input.skillVersion)
  const sourceHash = normalizeIdentityValue(input.sourceHash)

  return {
    eventId: normalizeString(input.eventId) ?? randomUUID(),
    schemaVersion:
      input.schemaVersion ?? SKILL_FACT_SCHEMA_VERSION,
    factKind: input.factKind,
    source: normalizeSource(input.source),
    createdAt: normalizeString(input.createdAt) ?? new Date().toISOString(),
    runId: normalizeString(input.runId),
    traceId,
    taskId,
    retrievalRoundId,
    skillId,
    skillName: normalizeIdentityValue(input.skillName),
    skillVersion,
    sourceHash,
    context: normalizeContext(input.context),
    retrieval: normalizeRetrieval(input.retrieval),
    outcome: normalizeOutcome(input.outcome),
    feedback: normalizeFeedback(input.feedback),
    resolutionError: inferResolutionError(
      input.factKind,
      skillId,
      skillVersion,
      sourceHash,
      normalizeString(input.resolutionError),
    ),
    payload: normalizePayload(input.payload),
  }
}

export function isSkillFactEvent(value: unknown): value is SkillFactEvent {
  if (!isRecord(value)) {
    return false
  }

  if (value.schemaVersion !== SKILL_FACT_SCHEMA_VERSION) {
    return false
  }

  if (typeof value.eventId !== 'string' || !value.eventId.trim()) {
    return false
  }

  if (typeof value.traceId !== 'string' || !value.traceId.trim()) {
    return false
  }

  if (typeof value.taskId !== 'string' || !value.taskId.trim()) {
    return false
  }

  if (
    typeof value.retrievalRoundId !== 'string' ||
    !value.retrievalRoundId.trim()
  ) {
    return false
  }

  return isRecord(value.context) && isRecord(value.retrieval)
}

export function parseSkillFactEvent(value: unknown): SkillFactEvent | null {
  if (!isRecord(value)) {
    return null
  }

  const factKind = normalizeString(value.factKind) as SkillFactKind | null
  if (
    factKind !== 'retrieval_run' &&
    factKind !== 'skill_exposed' &&
    factKind !== 'skill_selected' &&
    factKind !== 'skill_invoked' &&
    factKind !== 'skill_completed' &&
    factKind !== 'skill_failed' &&
    factKind !== 'skill_feedback' &&
    factKind !== 'eval_outcome'
  ) {
    return null
  }

  const event = createSkillFactEvent({
    eventId: normalizeString(value.eventId),
    schemaVersion: value.schemaVersion as SkillFactSchemaVersion | null,
    factKind,
    source: normalizeSource(value.source),
    createdAt: normalizeString(value.createdAt),
    runId: normalizeString(value.runId),
    traceId: normalizeString(value.traceId),
    taskId: normalizeString(value.taskId),
    retrievalRoundId: normalizeString(value.retrievalRoundId),
    skillId: normalizeIdentityValue(value.skillId),
    skillName: normalizeIdentityValue(value.skillName),
    skillVersion: normalizeIdentityValue(value.skillVersion),
    sourceHash: normalizeIdentityValue(value.sourceHash),
    context: isRecord(value.context) ? value.context : null,
    retrieval: isRecord(value.retrieval) ? value.retrieval : null,
    outcome: isRecord(value.outcome) ? value.outcome : null,
    feedback: isRecord(value.feedback) ? value.feedback : null,
    resolutionError: normalizeString(value.resolutionError),
    payload: normalizePayload(value.payload),
  })

  return isSkillFactEvent(event) ? event : null
}

export function parseSkillFactJsonl(text: string): SkillFactEvent[] {
  return text
    .split(/\r?\n/g)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        return parseSkillFactEvent(JSON.parse(line))
      } catch {
        return null
      }
    })
    .filter((event): event is SkillFactEvent => event !== null)
}

export function filterSkillFactsByKind(
  events: SkillFactEvent[],
  factKind: SkillFactKind,
): SkillFactEvent[] {
  return events.filter(event => event.factKind === factKind)
}
