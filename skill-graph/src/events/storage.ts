import { Pool, type PoolConfig, type QueryConfig } from 'pg'
import {
  createSkillFactEvent,
  type SkillFactEvent,
  type SkillFactKind,
} from './skillFacts.js'

export type SkillFactSinkMode = 'postgres' | 'jsonl' | 'off'

export type SkillFactQueryFilter = {
  factKinds?: SkillFactKind[]
  skillId?: string | null
  skillVersion?: string | null
  sourceHash?: string | null
  taskId?: string | null
  traceId?: string | null
  projectId?: string | null
  department?: string | null
  scene?: string | null
  domain?: string | null
  createdAfter?: string | null
  createdBefore?: string | null
  limit?: number | null
}

type SkillFactRow = {
  event_id: string
  schema_version: string
  fact_kind: SkillFactKind
  source: string | null
  created_at: Date | string
  run_id: string | null
  trace_id: string
  task_id: string
  retrieval_round_id: string
  skill_id: string | null
  skill_name: string | null
  skill_version: string | null
  source_hash: string | null
  cwd: string | null
  project_id: string | null
  department: string | null
  scene: string | null
  domain: string | null
  retrieval_rank: number | null
  retrieval_candidate_count: number | null
  retrieval_source: string | null
  retrieval_score: number | null
  retrieval_selected_by: string | null
  outcome_success: boolean | null
  outcome_verification_passed: boolean | null
  outcome_failure_reason: string | null
  outcome_duration_ms: number | null
  feedback_rating: number | null
  feedback_sentiment: string | null
  feedback_comment: string | null
  score_breakdown: Record<string, number> | string | null
  payload: Record<string, unknown> | string | null
  resolution_error: string | null
}

type SkillFactInsertRow = {
  eventId: string
  schemaVersion: string
  factKind: SkillFactKind
  source: string | null
  createdAt: string
  runId: string | null
  traceId: string
  taskId: string
  retrievalRoundId: string
  skillId: string | null
  skillName: string | null
  skillVersion: string | null
  sourceHash: string | null
  cwd: string | null
  projectId: string | null
  department: string | null
  scene: string | null
  domain: string | null
  retrievalRank: number | null
  retrievalCandidateCount: number | null
  retrievalSource: string | null
  retrievalScore: number | null
  retrievalSelectedBy: string | null
  outcomeSuccess: boolean | null
  outcomeVerificationPassed: boolean | null
  outcomeFailureReason: string | null
  outcomeDurationMs: number | null
  feedbackRating: number | null
  feedbackSentiment: string | null
  feedbackComment: string | null
  scoreBreakdown: string | null
  payload: string | null
  resolutionError: string | null
}

const DEFAULT_SKILL_PG_HOST = '127.0.0.1'
const DEFAULT_SKILL_PG_PORT = 54329
const DEFAULT_SKILL_PG_DATABASE = 'skills'
const DEFAULT_SKILL_PG_USER = 'skills'
const DEFAULT_SKILL_PG_PASSWORD = 'skills_dev_password'
const DEFAULT_QUERY_LIMIT = 100
const MAX_QUERY_LIMIT = 1000

let pool: Pool | null = null
let poolKey: string | null = null
let ensureTablePromise: Promise<void> | null = null

const SKILL_FACT_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS skill_fact_events (
  event_id text PRIMARY KEY,
  schema_version text NOT NULL,
  fact_kind text NOT NULL,
  source text NULL,
  created_at timestamptz NOT NULL,
  run_id text NULL,
  trace_id text NOT NULL,
  task_id text NOT NULL,
  retrieval_round_id text NOT NULL,
  skill_id text NULL,
  skill_name text NULL,
  skill_version text NULL,
  source_hash text NULL,
  cwd text NULL,
  project_id text NULL,
  department text NULL,
  scene text NULL,
  domain text NULL,
  retrieval_rank integer NULL,
  retrieval_candidate_count integer NULL,
  retrieval_source text NULL,
  retrieval_score double precision NULL,
  retrieval_selected_by text NULL,
  outcome_success boolean NULL,
  outcome_verification_passed boolean NULL,
  outcome_failure_reason text NULL,
  outcome_duration_ms integer NULL,
  feedback_rating double precision NULL,
  feedback_sentiment text NULL,
  feedback_comment text NULL,
  score_breakdown jsonb NULL,
  payload jsonb NULL,
  resolution_error text NULL,
  inserted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_fact_events_created_at
  ON skill_fact_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_fact_events_fact_kind_created_at
  ON skill_fact_events (fact_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_fact_events_skill_id_created_at
  ON skill_fact_events (skill_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_fact_events_skill_identity_created_at
  ON skill_fact_events (skill_id, skill_version, source_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_fact_events_task_id
  ON skill_fact_events (task_id);

CREATE INDEX IF NOT EXISTS idx_skill_fact_events_trace_id
  ON skill_fact_events (trace_id);

CREATE INDEX IF NOT EXISTS idx_skill_fact_events_scope_created_at
  ON skill_fact_events (project_id, department, scene, domain, created_at DESC);
`

function trimString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function parseJsonRecord(
  value: Record<string, unknown> | string | null,
): Record<string, unknown> | null {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }

  return value
}

function parseScoreBreakdown(
  value: Record<string, number> | string | null,
): Record<string, number> | null {
  const parsed = parseJsonRecord(value)
  if (!parsed) {
    return null
  }

  const entries = Object.entries(parsed).filter(
    ([, item]) => typeof item === 'number' && Number.isFinite(item),
  )

  return entries.length > 0
    ? Object.fromEntries(entries)
    : null
}

function resolveConnectionString(): string {
  const explicitUrl = trimString(process.env.SKILL_PG_URL)
  if (explicitUrl) {
    return explicitUrl
  }

  const url = new URL('postgres://localhost')
  url.hostname = trimString(process.env.SKILL_PG_HOST) ?? DEFAULT_SKILL_PG_HOST
  url.port = String(
    Number.parseInt(process.env.SKILL_PG_PORT ?? '', 10) || DEFAULT_SKILL_PG_PORT,
  )
  url.pathname = `/${
    trimString(process.env.SKILL_PG_DATABASE) ?? DEFAULT_SKILL_PG_DATABASE
  }`
  url.username = trimString(process.env.SKILL_PG_USER) ?? DEFAULT_SKILL_PG_USER
  url.password =
    trimString(process.env.SKILL_PG_PASSWORD) ?? DEFAULT_SKILL_PG_PASSWORD
  return url.toString()
}

export function resolveSkillFactPgConfig(): PoolConfig {
  const connectionString = resolveConnectionString()
  return {
    connectionString,
    max: 5,
    connectionTimeoutMillis: 1_000,
    idleTimeoutMillis: 30_000,
  }
}

export function hasSkillFactPgConfig(): boolean {
  return Boolean(resolveSkillFactPgConfig().connectionString)
}

function getPool(): Pool {
  const config = resolveSkillFactPgConfig()
  const nextPoolKey = JSON.stringify(config)

  if (pool && poolKey === nextPoolKey) {
    return pool
  }

  if (pool) {
    void pool.end().catch(() => {})
  }

  pool = new Pool(config)
  poolKey = nextPoolKey
  ensureTablePromise = null
  return pool
}

export async function closeSkillFactPgPool(): Promise<void> {
  ensureTablePromise = null
  poolKey = null
  if (!pool) {
    return
  }

  const currentPool = pool
  pool = null
  await currentPool.end()
}

export async function ensureSkillFactEventsTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = getPool()
      .query(SKILL_FACT_TABLE_DDL)
      .then(() => undefined)
      .catch(error => {
        ensureTablePromise = null
        throw error
      })
  }

  await ensureTablePromise
}

export function mapSkillFactEventToInsertRow(
  event: SkillFactEvent,
): SkillFactInsertRow {
  return {
    eventId: event.eventId,
    schemaVersion: event.schemaVersion,
    factKind: event.factKind,
    source: event.source,
    createdAt: event.createdAt,
    runId: event.runId,
    traceId: event.traceId,
    taskId: event.taskId,
    retrievalRoundId: event.retrievalRoundId,
    skillId: event.skillId,
    skillName: event.skillName,
    skillVersion: event.skillVersion,
    sourceHash: event.sourceHash,
    cwd: event.context.cwd,
    projectId: event.context.projectId,
    department: event.context.department,
    scene: event.context.scene,
    domain: event.context.domain,
    retrievalRank: event.retrieval.rank,
    retrievalCandidateCount: event.retrieval.candidateCount,
    retrievalSource: event.retrieval.retrievalSource,
    retrievalScore: event.retrieval.score,
    retrievalSelectedBy: event.retrieval.selectedBy,
    outcomeSuccess: event.outcome.success,
    outcomeVerificationPassed: event.outcome.verificationPassed,
    outcomeFailureReason: event.outcome.failureReason,
    outcomeDurationMs: event.outcome.durationMs,
    feedbackRating: event.feedback.rating,
    feedbackSentiment: event.feedback.sentiment,
    feedbackComment: event.feedback.comment,
    scoreBreakdown: event.retrieval.scoreBreakdown
      ? JSON.stringify(event.retrieval.scoreBreakdown)
      : null,
    payload: event.payload ? JSON.stringify(event.payload) : null,
    resolutionError: event.resolutionError,
  }
}

export function mapSkillFactRowToEvent(row: SkillFactRow): SkillFactEvent {
  return createSkillFactEvent({
    eventId: row.event_id,
    schemaVersion: row.schema_version as SkillFactEvent['schemaVersion'],
    factKind: row.fact_kind,
    source: row.source as SkillFactEvent['source'],
    createdAt: toIsoString(row.created_at),
    runId: row.run_id,
    traceId: row.trace_id,
    taskId: row.task_id,
    retrievalRoundId: row.retrieval_round_id,
    skillId: row.skill_id,
    skillName: row.skill_name,
    skillVersion: row.skill_version,
    sourceHash: row.source_hash,
    context: {
      cwd: row.cwd,
      projectId: row.project_id,
      department: row.department,
      scene: row.scene,
      domain: row.domain,
    },
    retrieval: {
      rank: row.retrieval_rank,
      candidateCount: row.retrieval_candidate_count,
      retrievalSource: row.retrieval_source,
      score: row.retrieval_score,
      scoreBreakdown: parseScoreBreakdown(row.score_breakdown),
      selectedBy: row.retrieval_selected_by as SkillFactEvent['retrieval']['selectedBy'],
    },
    outcome: {
      success: row.outcome_success,
      verificationPassed: row.outcome_verification_passed,
      failureReason: row.outcome_failure_reason,
      durationMs: row.outcome_duration_ms,
    },
    feedback: {
      rating: row.feedback_rating,
      sentiment: row.feedback_sentiment as SkillFactEvent['feedback']['sentiment'],
      comment: row.feedback_comment,
    },
    resolutionError: row.resolution_error,
    payload: parseJsonRecord(row.payload),
  })
}

export async function insertSkillFactEvent(event: SkillFactEvent): Promise<void> {
  await ensureSkillFactEventsTable()
  const row = mapSkillFactEventToInsertRow(event)

  await getPool().query(
    `
INSERT INTO skill_fact_events (
  event_id,
  schema_version,
  fact_kind,
  source,
  created_at,
  run_id,
  trace_id,
  task_id,
  retrieval_round_id,
  skill_id,
  skill_name,
  skill_version,
  source_hash,
  cwd,
  project_id,
  department,
  scene,
  domain,
  retrieval_rank,
  retrieval_candidate_count,
  retrieval_source,
  retrieval_score,
  retrieval_selected_by,
  outcome_success,
  outcome_verification_passed,
  outcome_failure_reason,
  outcome_duration_ms,
  feedback_rating,
  feedback_sentiment,
  feedback_comment,
  score_breakdown,
  payload,
  resolution_error
)
VALUES (
  $1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12, $13,
  $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
  $28, $29, $30, $31::jsonb, $32::jsonb, $33
)
ON CONFLICT (event_id) DO NOTHING
`,
    [
      row.eventId,
      row.schemaVersion,
      row.factKind,
      row.source,
      row.createdAt,
      row.runId,
      row.traceId,
      row.taskId,
      row.retrievalRoundId,
      row.skillId,
      row.skillName,
      row.skillVersion,
      row.sourceHash,
      row.cwd,
      row.projectId,
      row.department,
      row.scene,
      row.domain,
      row.retrievalRank,
      row.retrievalCandidateCount,
      row.retrievalSource,
      row.retrievalScore,
      row.retrievalSelectedBy,
      row.outcomeSuccess,
      row.outcomeVerificationPassed,
      row.outcomeFailureReason,
      row.outcomeDurationMs,
      row.feedbackRating,
      row.feedbackSentiment,
      row.feedbackComment,
      row.scoreBreakdown,
      row.payload,
      row.resolutionError,
    ],
  )
}

function normalizedQueryLimit(limit: number | null | undefined): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_QUERY_LIMIT
  }

  return Math.min(Math.max(Math.trunc(limit as number), 1), MAX_QUERY_LIMIT)
}

function pushCondition(
  conditions: string[],
  values: unknown[],
  sql: string,
  value: unknown,
): void {
  values.push(value)
  conditions.push(sql.replace('?', `$${values.length}`))
}

export function buildSkillFactEventsQuery(
  filter: SkillFactQueryFilter = {},
): QueryConfig {
  const conditions: string[] = []
  const values: unknown[] = []

  if (filter.factKinds && filter.factKinds.length > 0) {
    pushCondition(
      conditions,
      values,
      'fact_kind = ANY(?)',
      filter.factKinds,
    )
  }

  const scalarFilters: Array<[string, string | null | undefined]> = [
    ['skill_id = ?', filter.skillId],
    ['skill_version = ?', filter.skillVersion],
    ['source_hash = ?', filter.sourceHash],
    ['task_id = ?', filter.taskId],
    ['trace_id = ?', filter.traceId],
    ['project_id = ?', filter.projectId],
    ['department = ?', filter.department],
    ['scene = ?', filter.scene],
    ['domain = ?', filter.domain],
  ]

  for (const [sql, value] of scalarFilters) {
    const trimmed = trimString(value)
    if (trimmed) {
      pushCondition(conditions, values, sql, trimmed)
    }
  }

  const createdAfter = trimString(filter.createdAfter)
  if (createdAfter) {
    pushCondition(conditions, values, 'created_at >= ?::timestamptz', createdAfter)
  }

  const createdBefore = trimString(filter.createdBefore)
  if (createdBefore) {
    pushCondition(conditions, values, 'created_at <= ?::timestamptz', createdBefore)
  }

  values.push(normalizedQueryLimit(filter.limit))
  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return {
    text: `
SELECT
  event_id,
  schema_version,
  fact_kind,
  source,
  created_at,
  run_id,
  trace_id,
  task_id,
  retrieval_round_id,
  skill_id,
  skill_name,
  skill_version,
  source_hash,
  cwd,
  project_id,
  department,
  scene,
  domain,
  retrieval_rank,
  retrieval_candidate_count,
  retrieval_source,
  retrieval_score,
  retrieval_selected_by,
  outcome_success,
  outcome_verification_passed,
  outcome_failure_reason,
  outcome_duration_ms,
  feedback_rating,
  feedback_sentiment,
  feedback_comment,
  score_breakdown,
  payload,
  resolution_error
FROM skill_fact_events
${whereClause}
ORDER BY created_at DESC
LIMIT $${values.length}
`,
    values,
  }
}

export async function querySkillFactEvents(
  filter: SkillFactQueryFilter = {},
): Promise<SkillFactEvent[]> {
  await ensureSkillFactEventsTable()
  const query = buildSkillFactEventsQuery(filter)
  const result = await getPool().query<SkillFactRow>(query)
  return result.rows.map(mapSkillFactRowToEvent)
}
