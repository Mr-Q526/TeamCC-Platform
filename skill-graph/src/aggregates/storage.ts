import type { PoolClient, QueryConfig } from 'pg'
import {
  getSkillFactPgPool,
  querySkillFactPg,
} from '../events/storage.js'
import type {
  SkillAggregateScopeType,
  SkillFeedbackAggregate,
  SkillFeedbackAggregateManifest,
} from './skillFactAggregates.js'

export type SkillFeedbackAggregateQueryFilter = {
  window?: string | null
  scopeType?: SkillAggregateScopeType | null
  scopeId?: string | null
  skillId?: string | null
  skillVersion?: string | null
  sourceHash?: string | null
  limit?: number | null
}

type SkillFeedbackAggregateRow = {
  aggregate_key: string
  schema_version: string
  generated_at: Date | string
  window: string
  window_days: number
  scope_type: SkillAggregateScopeType
  scope_id: string
  skill_id: string
  skill_version: string | null
  source_hash: string | null
  project_id: string | null
  department: string | null
  scene: string | null
  sample_count: number
  exposure_count: number
  selection_count: number
  invocation_count: number
  terminal_count: number
  success_count: number
  failure_count: number
  verification_pass_count: number
  feedback_count: number
  explicit_positive_count: number
  explicit_negative_count: number
  selection_rate: number
  invocation_rate: number
  success_rate: number
  verification_pass_rate: number
  user_satisfaction: number
  avg_rank_when_shown: number | null
  freshness_score: number
  failure_penalty: number
  cost_penalty: number
  quality_score: number
  confidence: number
  first_event_at: Date | string
  last_event_at: Date | string
  computed_at: Date | string
}

type SkillFeedbackAggregateInsertRow = {
  aggregateKey: string
  schemaVersion: string
  generatedAt: string
  window: string
  windowDays: number
  scopeType: SkillAggregateScopeType
  scopeId: string
  skillId: string
  skillVersion: string | null
  sourceHash: string | null
  projectId: string | null
  department: string | null
  scene: string | null
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
  computedAt: string
}

const DEFAULT_QUERY_LIMIT = 100
const MAX_QUERY_LIMIT = 1000

const SKILL_FEEDBACK_AGGREGATES_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS skill_feedback_aggregates (
  aggregate_key text PRIMARY KEY,
  schema_version text NOT NULL,
  generated_at timestamptz NOT NULL,
  "window" text NOT NULL,
  window_days integer NOT NULL,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  skill_id text NOT NULL,
  skill_version text NULL,
  source_hash text NULL,
  project_id text NULL,
  department text NULL,
  scene text NULL,
  sample_count integer NOT NULL,
  exposure_count integer NOT NULL,
  selection_count integer NOT NULL,
  invocation_count integer NOT NULL,
  terminal_count integer NOT NULL,
  success_count integer NOT NULL,
  failure_count integer NOT NULL,
  verification_pass_count integer NOT NULL,
  feedback_count integer NOT NULL,
  explicit_positive_count integer NOT NULL,
  explicit_negative_count integer NOT NULL,
  selection_rate double precision NOT NULL,
  invocation_rate double precision NOT NULL,
  success_rate double precision NOT NULL,
  verification_pass_rate double precision NOT NULL,
  user_satisfaction double precision NOT NULL,
  avg_rank_when_shown double precision NULL,
  freshness_score double precision NOT NULL,
  failure_penalty double precision NOT NULL,
  cost_penalty double precision NOT NULL,
  quality_score double precision NOT NULL,
  confidence double precision NOT NULL,
  first_event_at timestamptz NOT NULL,
  last_event_at timestamptz NOT NULL,
  computed_at timestamptz NOT NULL
);

ALTER TABLE skill_feedback_aggregates
  ADD COLUMN IF NOT EXISTS project_id text NULL;

CREATE INDEX IF NOT EXISTS idx_skill_feedback_aggregates_window_scope_score
  ON skill_feedback_aggregates ("window", scope_type, scope_id, quality_score DESC);

CREATE INDEX IF NOT EXISTS idx_skill_feedback_aggregates_skill_scope
  ON skill_feedback_aggregates (skill_id, scope_type);

CREATE INDEX IF NOT EXISTS idx_skill_feedback_aggregates_skill_identity
  ON skill_feedback_aggregates (skill_id, skill_version, source_hash);

CREATE INDEX IF NOT EXISTS idx_skill_feedback_aggregates_project_scope
  ON skill_feedback_aggregates (project_id, scope_type, quality_score DESC);

CREATE INDEX IF NOT EXISTS idx_skill_feedback_aggregates_computed_at
  ON skill_feedback_aggregates (computed_at DESC);
`

let ensureAggregateTablePromise: Promise<void> | null = null

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

export async function ensureSkillFeedbackAggregatesTable(): Promise<void> {
  if (!ensureAggregateTablePromise) {
    ensureAggregateTablePromise = querySkillFactPg(
      SKILL_FEEDBACK_AGGREGATES_TABLE_DDL,
    )
      .then(() => undefined)
      .catch(error => {
        ensureAggregateTablePromise = null
        throw error
      })
  }

  await ensureAggregateTablePromise
}

export function mapSkillFeedbackAggregateToInsertRow(
  aggregate: SkillFeedbackAggregate,
  manifest: Pick<
    SkillFeedbackAggregateManifest,
    'schemaVersion' | 'generatedAt' | 'windowDays'
  >,
): SkillFeedbackAggregateInsertRow {
  return {
    aggregateKey: aggregate.aggregateKey,
    schemaVersion: manifest.schemaVersion,
    generatedAt: manifest.generatedAt,
    window: aggregate.window,
    windowDays: manifest.windowDays,
    scopeType: aggregate.scopeType,
    scopeId: aggregate.scopeId,
    skillId: aggregate.skillId,
    skillVersion: aggregate.skillVersion,
    sourceHash: aggregate.sourceHash,
    projectId: aggregate.projectId,
    department: aggregate.department,
    scene: aggregate.scene,
    sampleCount: aggregate.sampleCount,
    exposureCount: aggregate.exposureCount,
    selectionCount: aggregate.selectionCount,
    invocationCount: aggregate.invocationCount,
    terminalCount: aggregate.terminalCount,
    successCount: aggregate.successCount,
    failureCount: aggregate.failureCount,
    verificationPassCount: aggregate.verificationPassCount,
    feedbackCount: aggregate.feedbackCount,
    explicitPositiveCount: aggregate.explicitPositiveCount,
    explicitNegativeCount: aggregate.explicitNegativeCount,
    selectionRate: aggregate.selectionRate,
    invocationRate: aggregate.invocationRate,
    successRate: aggregate.successRate,
    verificationPassRate: aggregate.verificationPassRate,
    userSatisfaction: aggregate.userSatisfaction,
    avgRankWhenShown: aggregate.avgRankWhenShown,
    freshnessScore: aggregate.freshnessScore,
    failurePenalty: aggregate.failurePenalty,
    costPenalty: aggregate.costPenalty,
    qualityScore: aggregate.qualityScore,
    confidence: aggregate.confidence,
    firstEventAt: aggregate.firstEventAt,
    lastEventAt: aggregate.lastEventAt,
    computedAt: aggregate.updatedAt,
  }
}

export function mapSkillFeedbackAggregateRowToAggregate(
  row: SkillFeedbackAggregateRow,
): SkillFeedbackAggregate {
  return {
    aggregateKey: row.aggregate_key,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    skillId: row.skill_id,
    skillVersion: row.skill_version,
    sourceHash: row.source_hash,
    projectId: row.project_id,
    department: row.department,
    scene: row.scene,
    window: row.window,
    sampleCount: row.sample_count,
    exposureCount: row.exposure_count,
    selectionCount: row.selection_count,
    invocationCount: row.invocation_count,
    terminalCount: row.terminal_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
    verificationPassCount: row.verification_pass_count,
    feedbackCount: row.feedback_count,
    explicitPositiveCount: row.explicit_positive_count,
    explicitNegativeCount: row.explicit_negative_count,
    selectionRate: row.selection_rate,
    invocationRate: row.invocation_rate,
    successRate: row.success_rate,
    verificationPassRate: row.verification_pass_rate,
    userSatisfaction: row.user_satisfaction,
    avgRankWhenShown: row.avg_rank_when_shown,
    freshnessScore: row.freshness_score,
    failurePenalty: row.failure_penalty,
    costPenalty: row.cost_penalty,
    qualityScore: row.quality_score,
    confidence: row.confidence,
    firstEventAt: toIsoString(row.first_event_at),
    lastEventAt: toIsoString(row.last_event_at),
    updatedAt: toIsoString(row.computed_at),
  }
}

function insertQueryForRow(
  row: SkillFeedbackAggregateInsertRow,
): QueryConfig {
  return {
    text: `
INSERT INTO skill_feedback_aggregates (
  aggregate_key,
  schema_version,
  generated_at,
  "window",
  window_days,
  scope_type,
  scope_id,
  skill_id,
  skill_version,
  source_hash,
  project_id,
  department,
  scene,
  sample_count,
  exposure_count,
  selection_count,
  invocation_count,
  terminal_count,
  success_count,
  failure_count,
  verification_pass_count,
  feedback_count,
  explicit_positive_count,
  explicit_negative_count,
  selection_rate,
  invocation_rate,
  success_rate,
  verification_pass_rate,
  user_satisfaction,
  avg_rank_when_shown,
  freshness_score,
  failure_penalty,
  cost_penalty,
  quality_score,
  confidence,
  first_event_at,
  last_event_at,
  computed_at
)
VALUES (
  $1, $2, $3::timestamptz, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
  $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
  $28, $29, $30, $31, $32, $33, $34, $35, $36::timestamptz, $37::timestamptz,
  $38::timestamptz
)
ON CONFLICT (aggregate_key) DO UPDATE SET
  schema_version = EXCLUDED.schema_version,
  generated_at = EXCLUDED.generated_at,
  "window" = EXCLUDED."window",
  window_days = EXCLUDED.window_days,
  scope_type = EXCLUDED.scope_type,
  scope_id = EXCLUDED.scope_id,
  skill_id = EXCLUDED.skill_id,
  skill_version = EXCLUDED.skill_version,
  source_hash = EXCLUDED.source_hash,
  project_id = EXCLUDED.project_id,
  department = EXCLUDED.department,
  scene = EXCLUDED.scene,
  sample_count = EXCLUDED.sample_count,
  exposure_count = EXCLUDED.exposure_count,
  selection_count = EXCLUDED.selection_count,
  invocation_count = EXCLUDED.invocation_count,
  terminal_count = EXCLUDED.terminal_count,
  success_count = EXCLUDED.success_count,
  failure_count = EXCLUDED.failure_count,
  verification_pass_count = EXCLUDED.verification_pass_count,
  feedback_count = EXCLUDED.feedback_count,
  explicit_positive_count = EXCLUDED.explicit_positive_count,
  explicit_negative_count = EXCLUDED.explicit_negative_count,
  selection_rate = EXCLUDED.selection_rate,
  invocation_rate = EXCLUDED.invocation_rate,
  success_rate = EXCLUDED.success_rate,
  verification_pass_rate = EXCLUDED.verification_pass_rate,
  user_satisfaction = EXCLUDED.user_satisfaction,
  avg_rank_when_shown = EXCLUDED.avg_rank_when_shown,
  freshness_score = EXCLUDED.freshness_score,
  failure_penalty = EXCLUDED.failure_penalty,
  cost_penalty = EXCLUDED.cost_penalty,
  quality_score = EXCLUDED.quality_score,
  confidence = EXCLUDED.confidence,
  first_event_at = EXCLUDED.first_event_at,
  last_event_at = EXCLUDED.last_event_at,
  computed_at = EXCLUDED.computed_at
`,
    values: [
      row.aggregateKey,
      row.schemaVersion,
      row.generatedAt,
      row.window,
      row.windowDays,
      row.scopeType,
      row.scopeId,
      row.skillId,
      row.skillVersion,
      row.sourceHash,
      row.projectId,
      row.department,
      row.scene,
      row.sampleCount,
      row.exposureCount,
      row.selectionCount,
      row.invocationCount,
      row.terminalCount,
      row.successCount,
      row.failureCount,
      row.verificationPassCount,
      row.feedbackCount,
      row.explicitPositiveCount,
      row.explicitNegativeCount,
      row.selectionRate,
      row.invocationRate,
      row.successRate,
      row.verificationPassRate,
      row.userSatisfaction,
      row.avgRankWhenShown,
      row.freshnessScore,
      row.failurePenalty,
      row.costPenalty,
      row.qualityScore,
      row.confidence,
      row.firstEventAt,
      row.lastEventAt,
      row.computedAt,
    ],
  }
}

async function insertAggregateRows(
  rows: SkillFeedbackAggregateInsertRow[],
  client?: PoolClient,
): Promise<void> {
  for (const row of rows) {
    const query = insertQueryForRow(row)
    if (client) {
      await client.query(query)
    } else {
      await querySkillFactPg(query)
    }
  }
}

export async function upsertSkillFeedbackAggregates(
  manifest: SkillFeedbackAggregateManifest,
): Promise<void> {
  await ensureSkillFeedbackAggregatesTable()
  const rows = manifest.items.map(item =>
    mapSkillFeedbackAggregateToInsertRow(item, manifest),
  )
  await insertAggregateRows(rows)
}

export async function replaceSkillFeedbackAggregatesForWindow(
  window: string,
  manifest: SkillFeedbackAggregateManifest,
): Promise<void> {
  await ensureSkillFeedbackAggregatesTable()
  const rows = manifest.items.map(item =>
    mapSkillFeedbackAggregateToInsertRow(item, manifest),
  )
  const client = await getSkillFactPgPool().connect()

  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM skill_feedback_aggregates WHERE "window" = $1', [
      window,
    ])
    await insertAggregateRows(rows, client)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export function buildSkillFeedbackAggregatesQuery(
  filter: SkillFeedbackAggregateQueryFilter = {},
): QueryConfig {
  const conditions: string[] = []
  const values: unknown[] = []

  const scalarFilters: Array<[string, string | null | undefined]> = [
    ['"window" = ?', filter.window],
    ['scope_type = ?', filter.scopeType],
    ['scope_id = ?', filter.scopeId],
    ['skill_id = ?', filter.skillId],
    ['skill_version = ?', filter.skillVersion],
    ['source_hash = ?', filter.sourceHash],
  ]

  for (const [sql, value] of scalarFilters) {
    const trimmed = trimString(value)
    if (trimmed) {
      pushCondition(conditions, values, sql, trimmed)
    }
  }

  values.push(normalizedQueryLimit(filter.limit))
  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return {
    text: `
SELECT
  aggregate_key,
  schema_version,
  generated_at,
  "window",
  window_days,
  scope_type,
  scope_id,
  skill_id,
  skill_version,
  source_hash,
  project_id,
  department,
  scene,
  sample_count,
  exposure_count,
  selection_count,
  invocation_count,
  terminal_count,
  success_count,
  failure_count,
  verification_pass_count,
  feedback_count,
  explicit_positive_count,
  explicit_negative_count,
  selection_rate,
  invocation_rate,
  success_rate,
  verification_pass_rate,
  user_satisfaction,
  avg_rank_when_shown,
  freshness_score,
  failure_penalty,
  cost_penalty,
  quality_score,
  confidence,
  first_event_at,
  last_event_at,
  computed_at
FROM skill_feedback_aggregates
${whereClause}
ORDER BY quality_score DESC, confidence DESC, skill_id ASC, scope_type ASC
LIMIT $${values.length}
`,
    values,
  }
}

export async function querySkillFeedbackAggregates(
  filter: SkillFeedbackAggregateQueryFilter = {},
): Promise<SkillFeedbackAggregate[]> {
  await ensureSkillFeedbackAggregatesTable()
  const query = buildSkillFeedbackAggregatesQuery(filter)
  const result = await querySkillFactPg<SkillFeedbackAggregateRow>(query)
  return result.rows.map(mapSkillFeedbackAggregateRowToAggregate)
}

export async function readSkillFeedbackAggregateManifestFromPg(
  filter: SkillFeedbackAggregateQueryFilter & {
    generatedAt?: string | null
    windowDays?: number | null
  } = {},
): Promise<SkillFeedbackAggregateManifest> {
  const items = await querySkillFeedbackAggregates({
    ...filter,
    limit: filter.limit ?? MAX_QUERY_LIMIT,
  })
  const generatedAt =
    filter.generatedAt?.trim() ||
    items
      .map(item => item.updatedAt)
      .sort()
      .at(-1) ||
    new Date().toISOString()
  const window = filter.window?.trim() || items[0]?.window || '30d'
  const windowDays =
    filter.windowDays ??
    (Number.parseInt(window.replace(/d$/, ''), 10) || 30)

  return {
    schemaVersion: '2026-04-12',
    generatedAt,
    window,
    windowDays,
    source: 'skill_fact_events',
    itemCount: items.length,
    items: items.sort((left, right) => {
      if (left.skillId !== right.skillId) {
        return left.skillId.localeCompare(right.skillId)
      }
      if (left.scopeType !== right.scopeType) {
        return left.scopeType.localeCompare(right.scopeType)
      }
      return left.scopeId.localeCompare(right.scopeId)
    }),
  }
}
