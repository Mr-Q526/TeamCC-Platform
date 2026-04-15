import { createHash } from 'crypto'
import { listEvalCases, loadEvalCase } from './io.js'
import { resolveLangfuseConfigFromEnv } from './langfuse.js'
import type {
  SkillRetrievalEvalCase,
  SkillRetrievalEvalRequestedMode,
} from './types.js'

type LangfuseDatasetConfig = NonNullable<
  ReturnType<typeof resolveLangfuseConfigFromEnv>
>

export type LangfuseDatasetRecord = {
  id: string
  name: string
  description: string | null
  metadata: Record<string, unknown> | null
  inputSchema: Record<string, unknown> | null
  expectedOutputSchema: Record<string, unknown> | null
}

export type LangfuseDatasetItemRecord = {
  id: string
  datasetId: string
  datasetName: string
  input: Record<string, unknown>
  expectedOutput: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

export type LangfuseRetrievalDatasetItem = {
  input: Record<string, unknown>
  expectedOutput: Record<string, unknown>
  metadata: Record<string, unknown>
}

export type LangfuseDatasetSyncSummary = {
  datasetName: string
  datasetId: string
  createdDataset: boolean
  localCaseCount: number
  remoteItemCountBefore: number
  createdCount: number
  unchangedCount: number
  driftCount: number
  driftCaseIds: string[]
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
    : []
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function trimString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function encodeBasicAuth(publicKey: string, secretKey: string): string {
  return Buffer.from(`${publicKey}:${secretKey}`, 'utf-8').toString('base64')
}

async function requestJson<T>(
  config: LangfuseDatasetConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${config.host}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${encodeBasicAuth(config.publicKey, config.secretKey)}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = await response.text().catch(() => '')
    throw new Error(
      `Langfuse request failed (${response.status} ${response.statusText}) ${payload}`.trim(),
    )
  }

  return (await response.json()) as T
}

export async function listLangfuseDatasets(
  config: LangfuseDatasetConfig,
): Promise<LangfuseDatasetRecord[]> {
  const response = await requestJson<{
    data: Array<Record<string, unknown>>
    meta?: Record<string, unknown>
  }>(config, '/api/public/datasets')

  return (response.data ?? []).map(item => ({
    id: trimString(item.id) ?? '',
    name: trimString(item.name) ?? '',
    description: trimString(item.description),
    metadata:
      item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
        ? (item.metadata as Record<string, unknown>)
        : null,
    inputSchema:
      item.inputSchema && typeof item.inputSchema === 'object' && !Array.isArray(item.inputSchema)
        ? (item.inputSchema as Record<string, unknown>)
        : null,
    expectedOutputSchema:
      item.expectedOutputSchema &&
      typeof item.expectedOutputSchema === 'object' &&
      !Array.isArray(item.expectedOutputSchema)
        ? (item.expectedOutputSchema as Record<string, unknown>)
        : null,
  }))
}

export async function ensureLangfuseDataset(
  config: LangfuseDatasetConfig,
  input: {
    name: string
    description: string
    metadata?: Record<string, unknown>
    inputSchema?: Record<string, unknown>
    expectedOutputSchema?: Record<string, unknown>
  },
): Promise<{ dataset: LangfuseDatasetRecord; created: boolean }> {
  const datasets = await listLangfuseDatasets(config)
  const existing = datasets.find(item => item.name === input.name)
  if (existing) {
    return { dataset: existing, created: false }
  }

  const created = await requestJson<Record<string, unknown>>(config, '/api/public/datasets', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return {
    dataset: {
      id: trimString(created.id) ?? '',
      name: trimString(created.name) ?? input.name,
      description: trimString(created.description),
      metadata:
        created.metadata &&
        typeof created.metadata === 'object' &&
        !Array.isArray(created.metadata)
          ? (created.metadata as Record<string, unknown>)
          : null,
      inputSchema:
        created.inputSchema &&
        typeof created.inputSchema === 'object' &&
        !Array.isArray(created.inputSchema)
          ? (created.inputSchema as Record<string, unknown>)
          : null,
      expectedOutputSchema:
        created.expectedOutputSchema &&
        typeof created.expectedOutputSchema === 'object' &&
        !Array.isArray(created.expectedOutputSchema)
          ? (created.expectedOutputSchema as Record<string, unknown>)
          : null,
    },
    created: true,
  }
}

export async function listLangfuseDatasetItems(
  config: LangfuseDatasetConfig,
  datasetName: string,
): Promise<LangfuseDatasetItemRecord[]> {
  const items: LangfuseDatasetItemRecord[] = []
  let page = 1
  const limit = 100

  while (true) {
    const query = new URLSearchParams({
      datasetName,
      page: String(page),
      limit: String(limit),
    })
    const response = await requestJson<{
      data: Array<Record<string, unknown>>
      meta?: {
        totalPages?: number
      }
    }>(config, `/api/public/dataset-items?${query.toString()}`)

    for (const item of response.data ?? []) {
      items.push({
        id: trimString(item.id) ?? '',
        datasetId: trimString(item.datasetId) ?? '',
        datasetName: trimString(item.datasetName) ?? datasetName,
        input:
          item.input && typeof item.input === 'object' && !Array.isArray(item.input)
            ? (item.input as Record<string, unknown>)
            : {},
        expectedOutput:
          item.expectedOutput &&
          typeof item.expectedOutput === 'object' &&
          !Array.isArray(item.expectedOutput)
            ? (item.expectedOutput as Record<string, unknown>)
            : null,
        metadata:
          item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
            ? (item.metadata as Record<string, unknown>)
            : null,
      })
    }

    const totalPages =
      typeof response.meta?.totalPages === 'number' ? response.meta.totalPages : page
    if (page >= totalPages) {
      break
    }
    page += 1
  }

  return items
}

export async function createLangfuseDatasetItem(
  config: LangfuseDatasetConfig,
  datasetName: string,
  item: LangfuseRetrievalDatasetItem,
): Promise<LangfuseDatasetItemRecord> {
  const created = await requestJson<Record<string, unknown>>(config, '/api/public/dataset-items', {
    method: 'POST',
    body: JSON.stringify({
      datasetName,
      input: item.input,
      expectedOutput: item.expectedOutput,
      metadata: item.metadata,
    }),
  })

  return {
    id: trimString(created.id) ?? '',
    datasetId: trimString(created.datasetId) ?? '',
    datasetName: trimString(created.datasetName) ?? datasetName,
    input:
      created.input && typeof created.input === 'object' && !Array.isArray(created.input)
        ? (created.input as Record<string, unknown>)
        : {},
    expectedOutput:
      created.expectedOutput &&
      typeof created.expectedOutput === 'object' &&
      !Array.isArray(created.expectedOutput)
        ? (created.expectedOutput as Record<string, unknown>)
        : null,
    metadata:
      created.metadata &&
      typeof created.metadata === 'object' &&
      !Array.isArray(created.metadata)
        ? (created.metadata as Record<string, unknown>)
        : null,
  }
}

export function buildRetrievalDatasetItem(
  evalCase: SkillRetrievalEvalCase,
): LangfuseRetrievalDatasetItem {
  const requestedModes = (['bm25', 'bm25_vector', 'bm25_vector_graph'] as const).filter(
    mode => !evalCase.modeOverrides?.[mode]?.disabled,
  )

  const input = {
    queryText: evalCase.query.queryText,
    queryContext: evalCase.query.queryContext,
    cwd: evalCase.query.cwd,
    projectId: evalCase.query.projectId,
    department: evalCase.query.department,
    domainHints: evalCase.query.domainHints,
    sceneHints: evalCase.query.sceneHints,
    priorInjectedSkillIds: evalCase.query.priorInjectedSkillIds,
    priorInvokedSkillIds: evalCase.query.priorInvokedSkillIds,
    limit: evalCase.query.limit,
  }

  const expectedOutput = {
    mustHitSkillIds: evalCase.expected.mustHitSkillIds,
    acceptableSkillIds: evalCase.expected.acceptableSkillIds,
    forbiddenSkillIds: evalCase.expected.forbiddenSkillIds,
    preference: evalCase.expected.preference,
    requestedModes,
  }

  const metadataBase = {
    caseId: evalCase.caseId,
    title: evalCase.title,
    dataset: evalCase.dataset,
    tags: evalCase.tags,
    schemaVersion: evalCase.schemaVersion,
    caseType: evalCase.caseType,
    source: 'skill-graph',
  }

  const syncHash = createLangfuseDatasetItemFingerprint({
    input,
    expectedOutput,
    metadata: metadataBase,
  })

  return {
    input,
    expectedOutput,
    metadata: {
      ...metadataBase,
      syncHash,
    },
  }
}

export function createLangfuseDatasetItemFingerprint(input: {
  input: Record<string, unknown>
  expectedOutput: Record<string, unknown>
  metadata: Record<string, unknown>
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        input: input.input,
        expectedOutput: input.expectedOutput,
        metadata: input.metadata,
      }),
      'utf-8',
    )
    .digest('hex')
}

export function isLangfuseDatasetItemEquivalent(
  localItem: LangfuseRetrievalDatasetItem,
  remoteItem: LangfuseDatasetItemRecord,
): boolean {
  const remoteMetadata = {
    caseId: remoteItem.metadata?.caseId ?? null,
    title: remoteItem.metadata?.title ?? null,
    dataset: remoteItem.metadata?.dataset ?? null,
    tags: Array.isArray(remoteItem.metadata?.tags) ? remoteItem.metadata?.tags : [],
    schemaVersion: remoteItem.metadata?.schemaVersion ?? null,
    caseType: remoteItem.metadata?.caseType ?? null,
    source: remoteItem.metadata?.source ?? null,
  }

  const localMetadata = {
    caseId: localItem.metadata.caseId ?? null,
    title: localItem.metadata.title ?? null,
    dataset: localItem.metadata.dataset ?? null,
    tags: Array.isArray(localItem.metadata.tags) ? localItem.metadata.tags : [],
    schemaVersion: localItem.metadata.schemaVersion ?? null,
    caseType: localItem.metadata.caseType ?? null,
    source: localItem.metadata.source ?? null,
  }

  const remoteHash =
    trimString(remoteItem.metadata?.syncHash) ??
    createLangfuseDatasetItemFingerprint({
      input: remoteItem.input,
      expectedOutput: remoteItem.expectedOutput ?? {},
      metadata: remoteMetadata,
    })

  const localHash = createLangfuseDatasetItemFingerprint({
    input: localItem.input,
    expectedOutput: localItem.expectedOutput,
    metadata: localMetadata,
  })

  return localHash === remoteHash
}

export async function syncRetrievalCasesToLangfuseDataset(input: {
  datasetName: string
  description: string
  casesDir: string
  dryRun?: boolean
}): Promise<LangfuseDatasetSyncSummary> {
  const config = resolveLangfuseConfigFromEnv()
  if (!config) {
    throw new Error(
      'Missing LANGFUSE_HOST, LANGFUSE_PUBLIC_KEY, or LANGFUSE_SECRET_KEY',
    )
  }

  const files = await listEvalCases(input.casesDir)
  const loaded = await Promise.all(files.map(loadEvalCase))
  const retrievalCases = loaded.filter(
    (item): item is SkillRetrievalEvalCase => item.caseType === 'retrieval',
  )

  const { dataset, created } = await ensureLangfuseDataset(config, {
    name: input.datasetName,
    description: input.description,
    metadata: {
      source: 'skill-graph',
      caseType: 'retrieval',
    },
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['queryText'],
      additionalProperties: true,
      properties: {
        queryText: { type: 'string' },
        queryContext: { type: ['string', 'null'] },
        cwd: { type: ['string', 'null'] },
        department: { type: ['string', 'null'] },
        domainHints: { type: 'array', items: { type: 'string' } },
        sceneHints: { type: 'array', items: { type: 'string' } },
        priorInjectedSkillIds: { type: 'array', items: { type: 'string' } },
        priorInvokedSkillIds: { type: 'array', items: { type: 'string' } },
        limit: { type: ['number', 'null'] },
      },
    },
    expectedOutputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['mustHitSkillIds', 'acceptableSkillIds', 'forbiddenSkillIds'],
      additionalProperties: true,
      properties: {
        mustHitSkillIds: { type: 'array', items: { type: 'string' } },
        acceptableSkillIds: { type: 'array', items: { type: 'string' } },
        forbiddenSkillIds: { type: 'array', items: { type: 'string' } },
        requestedModes: { type: 'array', items: { type: 'string' } },
      },
    },
  })

  const remoteItems = await listLangfuseDatasetItems(config, input.datasetName)
  const remoteByCaseId = new Map<string, LangfuseDatasetItemRecord>()
  for (const item of remoteItems) {
    const caseId = trimString(item.metadata?.caseId)
    if (caseId) {
      remoteByCaseId.set(caseId, item)
    }
  }

  let createdCount = 0
  let unchangedCount = 0
  let driftCount = 0
  const driftCaseIds: string[] = []

  for (const evalCase of retrievalCases) {
    const datasetItem = buildRetrievalDatasetItem(evalCase)
    const existing = remoteByCaseId.get(evalCase.caseId)

    if (!existing) {
      if (!input.dryRun) {
        await createLangfuseDatasetItem(config, input.datasetName, datasetItem)
      }
      createdCount += 1
      continue
    }

    if (isLangfuseDatasetItemEquivalent(datasetItem, existing)) {
      unchangedCount += 1
      continue
    }

    driftCount += 1
    driftCaseIds.push(evalCase.caseId)
  }

  return {
    datasetName: dataset.name,
    datasetId: dataset.id,
    createdDataset: created,
    localCaseCount: retrievalCases.length,
    remoteItemCountBefore: remoteItems.length,
    createdCount,
    unchangedCount,
    driftCount,
    driftCaseIds,
  }
}

export function mapLangfuseDatasetItemToRetrievalCase(
  item: LangfuseDatasetItemRecord,
): SkillRetrievalEvalCase {
  const input = item.input ?? {}
  const expectedOutput = item.expectedOutput ?? {}
  const metadata = item.metadata ?? {}
  const requestedModes = new Set(
    toStringArray(expectedOutput.requestedModes).filter(
      (mode): mode is SkillRetrievalEvalRequestedMode =>
        mode === 'bm25' || mode === 'bm25_vector' || mode === 'bm25_vector_graph',
    ),
  )
  const defaultModes: SkillRetrievalEvalRequestedMode[] = [
    'bm25',
    'bm25_vector',
    'bm25_vector_graph',
  ]

  return {
    schemaVersion: '2026-04-12',
    caseType: 'retrieval',
    caseId: trimString(metadata.caseId) ?? item.id,
    title: trimString(metadata.title) ?? trimString(metadata.caseId) ?? item.id,
    dataset: trimString(metadata.dataset) ?? item.datasetName,
    tags: toStringArray(metadata.tags),
    query: {
      queryText: trimString(input.queryText) ?? '',
      queryContext: trimString(input.queryContext),
      cwd: trimString(input.cwd),
      projectId: trimString(input.projectId),
      department: trimString(input.department),
      domainHints: toStringArray(input.domainHints),
      sceneHints: toStringArray(input.sceneHints),
      priorInjectedSkillIds: toStringArray(input.priorInjectedSkillIds),
      priorInvokedSkillIds: toStringArray(input.priorInvokedSkillIds),
      limit: toNullableNumber(input.limit),
    },
    expected: {
      mustHitSkillIds: toStringArray(expectedOutput.mustHitSkillIds),
      acceptableSkillIds: toStringArray(expectedOutput.acceptableSkillIds),
      forbiddenSkillIds: toStringArray(expectedOutput.forbiddenSkillIds),
      preference:
        expectedOutput.preference &&
        typeof expectedOutput.preference === 'object' &&
        !Array.isArray(expectedOutput.preference) &&
        trimString((expectedOutput.preference as Record<string, unknown>).preferredSkillId) &&
        trimString((expectedOutput.preference as Record<string, unknown>).competingSkillId)
          ? {
              preferredSkillId: trimString(
                (expectedOutput.preference as Record<string, unknown>).preferredSkillId,
              ) as string,
              competingSkillId: trimString(
                (expectedOutput.preference as Record<string, unknown>).competingSkillId,
              ) as string,
              expectedDirection: 'preferred_above_competitor',
            }
          : null,
    },
    modeOverrides:
      requestedModes.size > 0
        ? Object.fromEntries(
            defaultModes.map(mode => [
              mode,
              {
                disabled: !requestedModes.has(mode),
                note: null,
              },
            ]),
          )
        : null,
  }
}

export async function loadRetrievalCasesFromLangfuseDataset(input: {
  datasetName: string
  caseId?: string | null
  suite?: string | null
}): Promise<SkillRetrievalEvalCase[]> {
  const config = resolveLangfuseConfigFromEnv()
  if (!config) {
    throw new Error(
      'Missing LANGFUSE_HOST, LANGFUSE_PUBLIC_KEY, or LANGFUSE_SECRET_KEY',
    )
  }

  const items = await listLangfuseDatasetItems(config, input.datasetName)
  return items
    .map(mapLangfuseDatasetItemToRetrievalCase)
    .filter(item => {
      if (input.caseId && item.caseId !== input.caseId) {
        return false
      }
      if (input.suite && !item.caseId.includes(input.suite)) {
        return false
      }
      return true
    })
}
