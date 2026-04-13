import type { PoolClient, QueryConfig } from 'pg'
import type { SkillFactEvent, SkillFactKind } from '../events/skillFacts.js'
import {
  buildInsertSkillFactEventQuery,
  ensureSkillFactEventsTable,
  getSkillFactPgPool,
  mapSkillFactEventToInsertRow,
  querySkillFactPg,
} from '../events/storage.js'

export type SkillGraphRefreshMode = 'legacy' | 'shadow' | 'redis'

export type SkillGraphRefreshRequestStatus =
  | 'pending'
  | 'publishing'
  | 'published'
  | 'running'
  | 'succeeded'
  | 'failed'

export type SkillGraphRefreshRequest = {
  jobKey: string
  window: string
  status: SkillGraphRefreshRequestStatus
  requestedAt: string
  startedAt: string | null
  completedAt: string | null
  attemptCount: number
  lastError: string | null
  lastEventId: string | null
  lastFactKind: SkillFactKind | null
  requestCount: number
  updatedAt: string
}

export type SkillGraphRefreshClaim = {
  request: SkillGraphRefreshRequest
  claimedAt: string
}

export type SkillGraphRefreshRequestQueryFilter = {
  jobKey?: string | null
  window?: string | null
  statuses?: SkillGraphRefreshRequestStatus[] | null
  limit?: number | null
}

type SkillGraphRefreshRequestRow = {
  job_key: string
  window: string
  status: SkillGraphRefreshRequestStatus
  requested_at: Date | string
  started_at: Date | string | null
  completed_at: Date | string | null
  attempt_count: number
  last_error: string | null
  last_event_id: string | null
  last_fact_kind: SkillFactKind | null
  request_count: number
  updated_at: Date | string
}

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000
const DEFAULT_WINDOW = '30d'
const DEFAULT_RUNNING_TIMEOUT_MS = 5 * 60 * 1000

const SKILL_GRAPH_REFRESH_REQUESTS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS skill_graph_refresh_requests (
  job_key text PRIMARY KEY,
  "window" text NOT NULL,
  status text NOT NULL,
  requested_at timestamptz NOT NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text NULL,
  last_event_id text NULL,
  last_fact_kind text NULL,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_graph_refresh_requests_status_requested_at
  ON skill_graph_refresh_requests (status, requested_at ASC);

CREATE INDEX IF NOT EXISTS idx_skill_graph_refresh_requests_updated_at
  ON skill_graph_refresh_requests (updated_at DESC);
`

let ensureRefreshTablePromise: Promise<void> | null = null

function trimString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function normalizeLimit(limit: number | null | undefined): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.max(Math.trunc(limit as number), 1), MAX_LIMIT)
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

export function resolveSkillGraphRefreshMode(): SkillGraphRefreshMode {
  const value = process.env.SKILL_GRAPH_REFRESH_MODE?.trim().toLowerCase()
  if (value === 'shadow' || value === 'redis') {
    return value
  }
  return 'legacy'
}

export function resolveSkillGraphRefreshWindow(): string {
  return trimString(process.env.SKILL_GRAPH_REFRESH_WINDOW) ?? DEFAULT_WINDOW
}

export function resolveSkillGraphRefreshRunningTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.SKILL_GRAPH_REFRESH_RUNNING_TIMEOUT_MS ?? '',
    10,
  )
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_RUNNING_TIMEOUT_MS
}

export function buildSkillGraphRefreshJobKey(window: string): string {
  return `refresh:${window}`
}

export function mapSkillGraphRefreshRequestRow(
  row: SkillGraphRefreshRequestRow,
): SkillGraphRefreshRequest {
  return {
    jobKey: row.job_key,
    window: row.window,
    status: row.status,
    requestedAt: toIsoString(row.requested_at) as string,
    startedAt: toIsoString(row.started_at),
    completedAt: toIsoString(row.completed_at),
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    lastEventId: row.last_event_id,
    lastFactKind: row.last_fact_kind,
    requestCount: row.request_count,
    updatedAt: toIsoString(row.updated_at) as string,
  }
}

export async function ensureSkillGraphRefreshRequestsTable(): Promise<void> {
  if (!ensureRefreshTablePromise) {
    ensureRefreshTablePromise = querySkillFactPg(
      SKILL_GRAPH_REFRESH_REQUESTS_TABLE_DDL,
    )
      .then(() => undefined)
      .catch(error => {
        ensureRefreshTablePromise = null
        throw error
      })
  }

  await ensureRefreshTablePromise
}

function buildUpsertSkillGraphRefreshRequestQuery(options: {
  window: string
  requestedAt: string
  lastEventId: string
  lastFactKind: SkillFactKind
}): QueryConfig {
  const jobKey = buildSkillGraphRefreshJobKey(options.window)

  return {
    text: `
INSERT INTO skill_graph_refresh_requests (
  job_key,
  "window",
  status,
  requested_at,
  started_at,
  completed_at,
  attempt_count,
  last_error,
  last_event_id,
  last_fact_kind,
  request_count,
  updated_at
)
VALUES (
  $1,
  $2,
  'pending',
  $3::timestamptz,
  NULL,
  NULL,
  0,
  NULL,
  $4,
  $5,
  1,
  $3::timestamptz
)
ON CONFLICT (job_key) DO UPDATE SET
  "window" = EXCLUDED."window",
  status = 'pending',
  requested_at = EXCLUDED.requested_at,
  completed_at = NULL,
  last_error = NULL,
  last_event_id = EXCLUDED.last_event_id,
  last_fact_kind = EXCLUDED.last_fact_kind,
  request_count = skill_graph_refresh_requests.request_count + 1,
  updated_at = EXCLUDED.updated_at
RETURNING
  job_key,
  "window",
  status,
  requested_at,
  started_at,
  completed_at,
  attempt_count,
  last_error,
  last_event_id,
  last_fact_kind,
  request_count,
  updated_at
`,
    values: [
      jobKey,
      options.window,
      options.requestedAt,
      options.lastEventId,
      options.lastFactKind,
    ],
  }
}

async function upsertSkillGraphRefreshRequest(
  client: PoolClient,
  options: {
    window: string
    requestedAt: string
    lastEventId: string
    lastFactKind: SkillFactKind
  },
): Promise<SkillGraphRefreshRequest> {
  const result =
    await client.query<SkillGraphRefreshRequestRow>(
      buildUpsertSkillGraphRefreshRequestQuery(options),
    )

  return mapSkillGraphRefreshRequestRow(result.rows[0] as SkillGraphRefreshRequestRow)
}

export async function insertSkillFactEventAndRequestRefresh(
  event: SkillFactEvent,
  options: {
    window?: string
  } = {},
): Promise<{
  eventInserted: boolean
  request: SkillGraphRefreshRequest
}> {
  await Promise.all([
    ensureSkillFactEventsTable(),
    ensureSkillGraphRefreshRequestsTable(),
  ])

  const client = await getSkillFactPgPool().connect()
  const requestedAt = new Date().toISOString()

  try {
    await client.query('BEGIN')
    const eventInsertResult = await client.query(
      buildInsertSkillFactEventQuery(mapSkillFactEventToInsertRow(event)),
    )
    const request = await upsertSkillGraphRefreshRequest(client, {
      window: options.window ?? resolveSkillGraphRefreshWindow(),
      requestedAt,
      lastEventId: event.eventId,
      lastFactKind: event.factKind,
    })
    await client.query('COMMIT')

    return {
      eventInserted: eventInsertResult.rowCount > 0,
      request,
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export function buildSkillGraphRefreshRequestsQuery(
  filter: SkillGraphRefreshRequestQueryFilter = {},
): QueryConfig {
  const conditions: string[] = []
  const values: unknown[] = []

  const jobKey = trimString(filter.jobKey)
  if (jobKey) {
    pushCondition(conditions, values, 'job_key = ?', jobKey)
  }

  const window = trimString(filter.window)
  if (window) {
    pushCondition(conditions, values, '"window" = ?', window)
  }

  if (filter.statuses && filter.statuses.length > 0) {
    pushCondition(conditions, values, 'status = ANY(?)', filter.statuses)
  }

  values.push(normalizeLimit(filter.limit))
  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return {
    text: `
SELECT
  job_key,
  "window",
  status,
  requested_at,
  started_at,
  completed_at,
  attempt_count,
  last_error,
  last_event_id,
  last_fact_kind,
  request_count,
  updated_at
FROM skill_graph_refresh_requests
${whereClause}
ORDER BY requested_at ASC
LIMIT $${values.length}
`,
    values,
  }
}

export async function querySkillGraphRefreshRequests(
  filter: SkillGraphRefreshRequestQueryFilter = {},
): Promise<SkillGraphRefreshRequest[]> {
  await ensureSkillGraphRefreshRequestsTable()
  const result = await querySkillFactPg<SkillGraphRefreshRequestRow>(
    buildSkillGraphRefreshRequestsQuery(filter),
  )
  return result.rows.map(mapSkillGraphRefreshRequestRow)
}

export async function readSkillGraphRefreshRequest(
  jobKey: string,
  client?: PoolClient,
): Promise<SkillGraphRefreshRequest | null> {
  await ensureSkillGraphRefreshRequestsTable()
  const query = buildSkillGraphRefreshRequestsQuery({
    jobKey,
    limit: 1,
  })
  const result = client
    ? await client.query<SkillGraphRefreshRequestRow>(query)
    : await querySkillFactPg<SkillGraphRefreshRequestRow>(query)

  const row = result.rows[0]
  return row ? mapSkillGraphRefreshRequestRow(row) : null
}

export async function markSkillGraphRefreshPublishing(
  jobKey: string,
  requestedAt: string,
): Promise<SkillGraphRefreshRequest | null> {
  await ensureSkillGraphRefreshRequestsTable()
  const result = await querySkillFactPg<SkillGraphRefreshRequestRow>(
    `
UPDATE skill_graph_refresh_requests
SET
  status = 'publishing',
  last_error = NULL,
  updated_at = now()
WHERE job_key = $1
  AND status = 'pending'
  AND requested_at = $2::timestamptz
RETURNING
  job_key,
  "window",
  status,
  requested_at,
  started_at,
  completed_at,
  attempt_count,
  last_error,
  last_event_id,
  last_fact_kind,
  request_count,
  updated_at
`,
    [jobKey, requestedAt],
  )

  const row = result.rows[0]
  return row ? mapSkillGraphRefreshRequestRow(row) : null
}

export async function markSkillGraphRefreshPublished(
  jobKey: string,
  requestedAt: string,
): Promise<SkillGraphRefreshRequest | null> {
  await ensureSkillGraphRefreshRequestsTable()
  const result = await querySkillFactPg<SkillGraphRefreshRequestRow>(
    `
UPDATE skill_graph_refresh_requests
SET
  status = 'published',
  updated_at = now()
WHERE job_key = $1
  AND status = 'publishing'
  AND requested_at = $2::timestamptz
RETURNING
  job_key,
  "window",
  status,
  requested_at,
  started_at,
  completed_at,
  attempt_count,
  last_error,
  last_event_id,
  last_fact_kind,
  request_count,
  updated_at
`,
    [jobKey, requestedAt],
  )

  const row = result.rows[0]
  return row ? mapSkillGraphRefreshRequestRow(row) : null
}

export async function markSkillGraphRefreshPending(
  jobKey: string,
  lastError?: string | null,
): Promise<SkillGraphRefreshRequest | null> {
  await ensureSkillGraphRefreshRequestsTable()
  const result = await querySkillFactPg<SkillGraphRefreshRequestRow>(
    `
UPDATE skill_graph_refresh_requests
SET
  status = 'pending',
  last_error = $2,
  updated_at = now()
WHERE job_key = $1
RETURNING
  job_key,
  "window",
  status,
  requested_at,
  started_at,
  completed_at,
  attempt_count,
  last_error,
  last_event_id,
  last_fact_kind,
  request_count,
  updated_at
`,
    [jobKey, trimString(lastError) ?? null],
  )

  const row = result.rows[0]
  return row ? mapSkillGraphRefreshRequestRow(row) : null
}

export async function claimSkillGraphRefreshRequest(
  jobKey: string,
  options: {
    runningTimeoutMs?: number
  } = {},
): Promise<SkillGraphRefreshClaim | null> {
  await ensureSkillGraphRefreshRequestsTable()
  const runningTimeoutMs =
    options.runningTimeoutMs ?? resolveSkillGraphRefreshRunningTimeoutMs()
  const client = await getSkillFactPgPool().connect()

  try {
    await client.query('BEGIN')
    const selected = await client.query<SkillGraphRefreshRequestRow>(
      `
SELECT
  job_key,
  "window",
  status,
  requested_at,
  started_at,
  completed_at,
  attempt_count,
  last_error,
  last_event_id,
  last_fact_kind,
  request_count,
  updated_at
FROM skill_graph_refresh_requests
WHERE job_key = $1
FOR UPDATE
`,
      [jobKey],
    )

    const row = selected.rows[0]
    if (!row) {
      await client.query('COMMIT')
      return null
    }

    const request = mapSkillGraphRefreshRequestRow(row)
    const now = new Date()
    const timedOut =
      request.startedAt !== null &&
      now.getTime() - Date.parse(request.startedAt) > runningTimeoutMs

    if (
      request.status === 'succeeded' ||
      request.status === 'publishing' ||
      (request.status === 'running' && !timedOut)
    ) {
      await client.query('COMMIT')
      return null
    }

    const claimedAt = now.toISOString()
    const updated = await client.query<SkillGraphRefreshRequestRow>(
      `
UPDATE skill_graph_refresh_requests
SET
  status = 'running',
  started_at = $2::timestamptz,
  attempt_count = attempt_count + 1,
  last_error = NULL,
  updated_at = $2::timestamptz
WHERE job_key = $1
RETURNING
  job_key,
  "window",
  status,
  requested_at,
  started_at,
  completed_at,
  attempt_count,
  last_error,
  last_event_id,
  last_fact_kind,
  request_count,
  updated_at
`,
      [jobKey, claimedAt],
    )
    await client.query('COMMIT')

    return {
      request: mapSkillGraphRefreshRequestRow(
        updated.rows[0] as SkillGraphRefreshRequestRow,
      ),
      claimedAt,
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export async function finalizeSkillGraphRefreshRequest(
  claim: SkillGraphRefreshClaim,
  result: {
    succeeded: boolean
    lastError?: string | null
  },
): Promise<SkillGraphRefreshRequest | null> {
  await ensureSkillGraphRefreshRequestsTable()
  const client = await getSkillFactPgPool().connect()

  try {
    await client.query('BEGIN')
    const selected = await client.query<SkillGraphRefreshRequestRow>(
      `
SELECT
  job_key,
  "window",
  status,
  requested_at,
  started_at,
  completed_at,
  attempt_count,
  last_error,
  last_event_id,
  last_fact_kind,
  request_count,
  updated_at
FROM skill_graph_refresh_requests
WHERE job_key = $1
FOR UPDATE
`,
      [claim.request.jobKey],
    )

    const current = selected.rows[0]
    if (!current) {
      await client.query('COMMIT')
      return null
    }

    const currentRequest = mapSkillGraphRefreshRequestRow(current)
    const hasNewerRequest =
      Date.parse(currentRequest.requestedAt) > Date.parse(claim.request.requestedAt)
    const nextStatus: SkillGraphRefreshRequestStatus = hasNewerRequest
      ? 'pending'
      : result.succeeded
        ? 'succeeded'
        : 'failed'
    const completedAt = new Date().toISOString()
    const lastError =
      nextStatus === 'failed' ? trimString(result.lastError) ?? 'unknown_error' : null

    const updated = await client.query<SkillGraphRefreshRequestRow>(
      `
UPDATE skill_graph_refresh_requests
SET
  status = $2,
  completed_at = $3::timestamptz,
  last_error = $4,
  updated_at = $3::timestamptz
WHERE job_key = $1
RETURNING
  job_key,
  "window",
  status,
  requested_at,
  started_at,
  completed_at,
  attempt_count,
  last_error,
  last_event_id,
  last_fact_kind,
  request_count,
  updated_at
`,
      [claim.request.jobKey, nextStatus, completedAt, lastError],
    )
    await client.query('COMMIT')

    return mapSkillGraphRefreshRequestRow(
      updated.rows[0] as SkillGraphRefreshRequestRow,
    )
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
