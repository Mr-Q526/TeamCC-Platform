import { randomBytes, randomUUID } from 'crypto'
import type { LangfuseEvalTraceMetadata } from './types.js'

type LangfuseEnvConfig = {
  host: string
  publicKey: string
  secretKey: string
}

export type LangfuseEvalSpanInput = {
  name: string
  startedAt: string
  endedAt: string
  metadata?: Record<string, unknown>
}

export type LangfuseEvalScoreInput = {
  name: string
  value: number | boolean
  comment?: string | null
  observationId?: string | null
}

export type LangfuseEvalTraceInput = {
  metadata: LangfuseEvalTraceMetadata
  input: Record<string, unknown>
  output: Record<string, unknown>
  spans: LangfuseEvalSpanInput[]
  scores: LangfuseEvalScoreInput[]
}

export type LangfuseEvalTraceResult = {
  traceId: string
  observationCount: number
  scoreCount: number
}

function trimString(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null
}

function encodeBasicAuth(publicKey: string, secretKey: string): string {
  return Buffer.from(`${publicKey}:${secretKey}`, 'utf-8').toString('base64')
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex')
}

function bytesBase64FromHex(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64')
}

function normalizeTraceHex(traceId: string): string {
  const cleaned = traceId.replace(/[^a-fA-F0-9]/g, '').toLowerCase()
  if (cleaned.length >= 32) {
    return cleaned.slice(0, 32)
  }
  return `${cleaned}${randomHex(16)}`.slice(0, 32)
}

function buildAttributeValue(
  value: unknown,
): { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } {
  if (typeof value === 'boolean') {
    return { boolValue: value }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value)
      ? { intValue: String(value) }
      : { doubleValue: value }
  }
  if (value === null || value === undefined) {
    return { stringValue: 'null' }
  }
  if (typeof value === 'string') {
    return { stringValue: value }
  }
  return { stringValue: JSON.stringify(value) }
}

function buildAttributes(
  values: Record<string, unknown>,
): Array<{ key: string; value: ReturnType<typeof buildAttributeValue> }> {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      key,
      value: buildAttributeValue(value),
    }))
}

function buildOtlpTracePayload(input: LangfuseEvalTraceInput): {
  traceId: string
  body: Record<string, unknown>
} {
  const traceHex = normalizeTraceHex(input.metadata.traceId || randomUUID())
  const rootSpanHex = randomHex(8)
  const traceId = input.metadata.traceId || traceHex
  const traceTitle =
    typeof input.input.title === 'string' && input.input.title.trim()
      ? `${input.metadata.mode} · ${input.input.title.trim()}`
      : `${input.metadata.mode}:${input.metadata.caseId}`
  const rootStart = input.spans[0]?.startedAt ?? new Date().toISOString()
  const rootEnd =
    input.spans[input.spans.length - 1]?.endedAt ?? new Date().toISOString()
  const spans = [
    {
      traceId: bytesBase64FromHex(traceHex),
      spanId: bytesBase64FromHex(rootSpanHex),
      name: `skill_eval.${input.metadata.mode}`,
      kind: 1,
      startTimeUnixNano: `${Date.parse(rootStart) * 1_000_000}`,
      endTimeUnixNano: `${Date.parse(rootEnd) * 1_000_000}`,
      attributes: buildAttributes({
        'langfuse.trace.name': traceTitle,
        'skill_eval.run_id': input.metadata.runId,
        'skill_eval.case_id': input.metadata.caseId,
        'skill_eval.mode': input.metadata.mode,
        'skill_eval.task_id': input.metadata.taskId,
        'skill_eval.retrieval_round_id': input.metadata.retrievalRoundId,
        'skill_eval.requested_mode': input.metadata.requestedMode,
        'skill_eval.actual_mode': input.metadata.actualMode,
        'skill_eval.skill_id': input.metadata.skillId,
        'skill_eval.skill_version': input.metadata.skillVersion,
        'skill_eval.source_hash': input.metadata.sourceHash,
        'skill_eval.registry_version': input.metadata.registryVersion,
        'skill_eval.embeddings_generated_at': input.metadata.embeddingsGeneratedAt,
        'skill_eval.retrieval_features_generated_at':
          input.metadata.retrievalFeaturesGeneratedAt,
        'skill_eval.input': input.input,
        'skill_eval.output': input.output,
      }),
    },
    ...input.spans.map(span => ({
      traceId: bytesBase64FromHex(traceHex),
      spanId: bytesBase64FromHex(randomHex(8)),
      parentSpanId: bytesBase64FromHex(rootSpanHex),
      name: span.name,
      kind: 1,
      startTimeUnixNano: `${Date.parse(span.startedAt) * 1_000_000}`,
      endTimeUnixNano: `${Date.parse(span.endedAt) * 1_000_000}`,
      attributes: buildAttributes(span.metadata ?? {}),
    })),
  ]

  return {
    traceId,
    body: {
      resourceSpans: [
        {
          resource: {
            attributes: buildAttributes({
              'service.name': 'skill-graph-evals',
              'service.version': '0.1.0',
            }),
          },
          scopeSpans: [
            {
              scope: {
                name: '@teamcc/skill-graph/evals',
                version: '0.1.0',
              },
              spans,
            },
          ],
        },
      ],
    },
  }
}

export function resolveLangfuseConfigFromEnv():
  | LangfuseEnvConfig
  | null {
  const host =
    trimString(process.env.LANGFUSE_HOST) ??
    `http://127.0.0.1:${trimString(process.env.LANGFUSE_WEB_PORT) ?? '3300'}`
  const publicKey =
    trimString(process.env.LANGFUSE_PUBLIC_KEY) ??
    trimString(process.env.LANGFUSE_INIT_PROJECT_PUBLIC_KEY)
  const secretKey =
    trimString(process.env.LANGFUSE_SECRET_KEY) ??
    trimString(process.env.LANGFUSE_INIT_PROJECT_SECRET_KEY)

  if (!host || !publicKey || !secretKey) {
    return null
  }

  return {
    host: host.replace(/\/+$/, ''),
    publicKey,
    secretKey,
  }
}

export function hasLangfuseConfig(): boolean {
  return resolveLangfuseConfigFromEnv() !== null
}

async function postJson(
  config: LangfuseEnvConfig,
  path: string,
  body: unknown,
): Promise<void> {
  const response = await fetch(`${config.host}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${encodeBasicAuth(config.publicKey, config.secretKey)}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await response.text().catch(() => '')
    throw new Error(
      `Langfuse request failed (${response.status} ${response.statusText}) ${payload}`.trim(),
    )
  }
}

export class LangfuseEvalClient {
  constructor(private readonly config: LangfuseEnvConfig) {}

  static fromEnv(): LangfuseEvalClient | null {
    const config = resolveLangfuseConfigFromEnv()
    return config ? new LangfuseEvalClient(config) : null
  }

  async recordTrace(input: LangfuseEvalTraceInput): Promise<LangfuseEvalTraceResult> {
    const tracePayload = buildOtlpTracePayload(input)
    await postJson(this.config, '/api/public/otel/v1/traces', tracePayload.body)

    for (const score of input.scores) {
      await postJson(this.config, '/api/public/scores', {
        traceId: tracePayload.traceId,
        observationId: score.observationId ?? undefined,
        name: score.name,
        value: score.value,
        dataType: typeof score.value === 'boolean' ? 'BOOLEAN' : 'NUMERIC',
        comment: score.comment ?? undefined,
      })
    }

    return {
      traceId: tracePayload.traceId,
      observationCount: input.spans.length + 1,
      scoreCount: input.scores.length,
    }
  }
}
