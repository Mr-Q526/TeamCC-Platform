import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { join } from 'path'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { logForDebugging } from '../../utils/debug.js'
import type { SkillRegistryEntry } from './registry.js'

export const GENERATED_SKILL_EMBEDDINGS_FILE = 'skill-embeddings.json'
const DEFAULT_ARK_EMBEDDINGS_URL =
  'https://ark.cn-beijing.volces.com/api/v3/embeddings'

export type EmbeddingProvider = 'volcengine'

export type SkillEmbeddingEntry = {
  embeddingId: string
  skillId: string
  version: string
  sourceHash: string
  objectType: 'skill-summary'
  textHash: string
  embeddingProvider: EmbeddingProvider
  embeddingModel: string
  embeddingDim: number
  vector: number[]
}

export type SkillEmbeddingsManifest = {
  schemaVersion: string
  generatedAt: string
  registryVersion: string
  embeddingProvider: EmbeddingProvider
  embeddingModel: string
  embeddingDim: number
  embeddingEndpoint: string
  itemCount: number
  items: SkillEmbeddingEntry[]
}

type ArkEmbeddingResponse = {
  data?:
    | {
        embedding?: number[]
      }
    | Array<{
        embedding?: number[]
      }>
}

const queryEmbeddingCache = new Map<string, Promise<number[] | null>>()

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeEmbeddingVector(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number')
    : []
}

function extractArkEmbeddingVectors(payload: ArkEmbeddingResponse): number[][] {
  if (Array.isArray(payload.data)) {
    return payload.data
      .map(item => normalizeEmbeddingVector(item.embedding))
      .filter(vector => vector.length > 0)
  }

  if (isRecord(payload.data)) {
    const vector = normalizeEmbeddingVector(payload.data.embedding)
    return vector.length > 0 ? [vector] : []
  }

  return []
}

function isMultimodalEmbeddingEndpoint(endpoint: string): boolean {
  return endpoint.toLowerCase().includes('/embeddings/multimodal')
}

async function requestArkEmbeddingVector(
  endpoint: string,
  apiKey: string,
  model: string,
  input: unknown,
): Promise<number[]> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Ark embeddings request failed with ${response.status} ${response.statusText}`,
    )
  }

  const payload = (await response.json()) as ArkEmbeddingResponse
  const vectors = extractArkEmbeddingVectors(payload)
  const vector = vectors[0]

  if (!vector || vector.length === 0) {
    throw new Error('Ark embeddings response did not contain a valid vector')
  }

  return vector
}

export function buildSkillEmbeddingText(skill: SkillRegistryEntry): string {
  return [
    `skillId: ${skill.skillId}`,
    `name: ${skill.name}`,
    `displayName: ${skill.displayName}`,
    `description: ${skill.description}`,
    `aliases: ${skill.aliases.join(', ')}`,
    `domain: ${skill.domain}`,
    `departmentTags: ${skill.departmentTags.join(', ')}`,
    `sceneTags: ${skill.sceneTags.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function getArkEmbeddingConfig(): {
  apiKey: string | null
  endpoint: string
  model: string | null
} {
  return {
    apiKey:
      process.env.ARK_API_KEY?.trim() ||
      process.env.VOLC_ARK_API_KEY?.trim() ||
      null,
    endpoint:
      process.env.VOLC_ARK_EMBEDDINGS_URL?.trim() || DEFAULT_ARK_EMBEDDINGS_URL,
    model:
      process.env.VOLC_ARK_EMBEDDING_MODEL?.trim() ||
      process.env.VOLC_ARK_EMBEDDING_ENDPOINT_ID?.trim() ||
      null,
  }
}

export async function readGeneratedSkillEmbeddings(
  dir: string,
): Promise<SkillEmbeddingsManifest | null> {
  const filePath = join(dir, GENERATED_SKILL_EMBEDDINGS_FILE)
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const raw = await getFsImplementation().readFile(filePath, {
      encoding: 'utf-8',
    })
    const parsed = JSON.parse(raw)
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
      return null
    }

    const items = parsed.items
      .filter(isRecord)
      .map(item => ({
        embeddingId: toStringValue(item.embeddingId),
        skillId: toStringValue(item.skillId),
        version: toStringValue(item.version),
        sourceHash: toStringValue(item.sourceHash),
        objectType: 'skill-summary' as const,
        textHash: toStringValue(item.textHash),
        embeddingProvider: 'volcengine' as const,
        embeddingModel: toStringValue(item.embeddingModel),
        embeddingDim:
          typeof item.embeddingDim === 'number' ? item.embeddingDim : 0,
        vector: Array.isArray(item.vector)
          ? item.vector.filter((value): value is number => typeof value === 'number')
          : [],
      }))
      .filter(item => item.skillId && item.vector.length > 0)

    return {
      schemaVersion: toStringValue(parsed.schemaVersion, '2026-04-11'),
      generatedAt: toStringValue(parsed.generatedAt),
      registryVersion: toStringValue(parsed.registryVersion),
      embeddingProvider: 'volcengine',
      embeddingModel: toStringValue(parsed.embeddingModel),
      embeddingDim:
        typeof parsed.embeddingDim === 'number' ? parsed.embeddingDim : 0,
      embeddingEndpoint: toStringValue(
        parsed.embeddingEndpoint,
        DEFAULT_ARK_EMBEDDINGS_URL,
      ),
      itemCount:
        typeof parsed.itemCount === 'number' ? parsed.itemCount : items.length,
      items,
    }
  } catch (error) {
    logForDebugging(
      `[skill-embeddings] failed to read generated embeddings ${filePath}: ${error}`,
      { level: 'warn' },
    )
    return null
  }
}

export async function requestArkEmbeddings(
  texts: string[],
): Promise<{
  vectors: number[][]
  model: string
  endpoint: string
}> {
  const config = getArkEmbeddingConfig()
  if (!config.apiKey) {
    throw new Error(
      'Missing ARK_API_KEY or VOLC_ARK_API_KEY for Volcengine Ark embeddings',
    )
  }
  if (!config.model) {
    throw new Error(
      'Missing VOLC_ARK_EMBEDDING_MODEL or VOLC_ARK_EMBEDDING_ENDPOINT_ID for Volcengine Ark embeddings',
    )
  }

  let vectors: number[][] = []

  if (isMultimodalEmbeddingEndpoint(config.endpoint)) {
    const concurrency = 8

    for (let index = 0; index < texts.length; index += concurrency) {
      const batch = texts.slice(index, index + concurrency)
      const batchVectors = await Promise.all(
        batch.map(text =>
          requestArkEmbeddingVector(config.endpoint, config.apiKey, config.model, [
            {
              type: 'text',
              text,
            },
          ]),
        ),
      )
      vectors.push(...batchVectors)
    }
  } else {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        input: texts,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Ark embeddings request failed with ${response.status} ${response.statusText}`,
      )
    }

    vectors = extractArkEmbeddingVectors(
      (await response.json()) as ArkEmbeddingResponse,
    )
  }

  if (vectors.length !== texts.length) {
    throw new Error(
      `Ark embeddings response count mismatch: expected ${texts.length}, got ${vectors.length}`,
    )
  }

  return {
    vectors,
    model: config.model,
    endpoint: config.endpoint,
  }
}

export function hashEmbeddingText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export async function embedQueryText(
  query: string,
): Promise<{
  vector: number[]
  model: string
  endpoint: string
} | null> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return null
  }

  const queryHash = hashEmbeddingText(trimmedQuery)
  const cached = queryEmbeddingCache.get(queryHash)
  if (cached) {
    const vector = await cached
    if (!vector) {
      return null
    }
    const config = getArkEmbeddingConfig()
    return {
      vector,
      model: config.model || 'unknown',
      endpoint: config.endpoint,
    }
  }

  const loadingPromise = requestArkEmbeddings([trimmedQuery])
    .then(result => result.vectors[0] ?? null)
    .catch(error => {
      logForDebugging(
        `[skill-embeddings] query embedding failed: ${error instanceof Error ? error.message : error}`,
        { level: 'warn' },
      )
      return null
    })

  queryEmbeddingCache.set(queryHash, loadingPromise)
  const vector = await loadingPromise
  if (!vector) {
    return null
  }

  const config = getArkEmbeddingConfig()
  return {
    vector,
    model: config.model || 'unknown',
    endpoint: config.endpoint,
  }
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0
  }

  let dot = 0
  let leftNorm = 0
  let rightNorm = 0

  for (let i = 0; i < left.length; i++) {
    const leftValue = left[i] ?? 0
    const rightValue = right[i] ?? 0
    dot += leftValue * rightValue
    leftNorm += leftValue * leftValue
    rightNorm += rightValue * rightValue
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}
