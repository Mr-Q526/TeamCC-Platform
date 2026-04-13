import { createClient, type RedisClientType } from 'redis'
import {
  markSkillGraphRefreshPending,
  markSkillGraphRefreshPublished,
  markSkillGraphRefreshPublishing,
  type SkillGraphRefreshRequest,
} from './storage.js'

export type SkillGraphRefreshStreamMessage = {
  id: string
  jobKey: string
  window: string
  requestedAt: string
  lastEventId: string | null
}

const DEFAULT_SKILL_REDIS_HOST = '127.0.0.1'
const DEFAULT_SKILL_REDIS_PORT = 6381
const DEFAULT_SKILL_REDIS_PASSWORD = 'skills_redis_password'
const DEFAULT_SKILL_GRAPH_REFRESH_STREAM = 'skill_graph_refresh_stream_v1'
const DEFAULT_SKILL_GRAPH_REFRESH_GROUP = 'skill_graph_refresh_workers'

let redisClient: RedisClientType | null = null
let redisClientKey: string | null = null
let redisConnectPromise: Promise<RedisClientType> | null = null

function trimString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function resolveSkillRedisUrl(): string {
  const explicitUrl = trimString(process.env.SKILL_REDIS_URL)
  if (explicitUrl) {
    return explicitUrl
  }

  const url = new URL('redis://localhost')
  url.hostname = trimString(process.env.SKILL_REDIS_HOST) ?? DEFAULT_SKILL_REDIS_HOST
  url.port = String(
    Number.parseInt(process.env.SKILL_REDIS_PORT ?? '', 10) || DEFAULT_SKILL_REDIS_PORT,
  )

  const password = trimString(process.env.SKILL_REDIS_PASSWORD)
  if (password ?? DEFAULT_SKILL_REDIS_PASSWORD) {
    url.password = password ?? DEFAULT_SKILL_REDIS_PASSWORD
  }

  return url.toString()
}

export function resolveSkillGraphRefreshStream(): string {
  return (
    trimString(process.env.SKILL_GRAPH_REFRESH_STREAM) ??
    DEFAULT_SKILL_GRAPH_REFRESH_STREAM
  )
}

export function resolveSkillGraphRefreshGroup(): string {
  return (
    trimString(process.env.SKILL_GRAPH_REFRESH_GROUP) ??
    DEFAULT_SKILL_GRAPH_REFRESH_GROUP
  )
}

async function getSkillRedisClient(): Promise<RedisClientType> {
  const nextKey = resolveSkillRedisUrl()

  if (redisClient && redisClientKey === nextKey && redisClient.isReady) {
    return redisClient
  }

  if (redisConnectPromise && redisClientKey === nextKey) {
    return redisConnectPromise
  }

  if (redisClient) {
    await redisClient.quit().catch(() => {})
  }

  const client = createClient({
    url: nextKey,
    socket: {
      reconnectStrategy: false,
    },
  })
  redisClient = client
  redisClientKey = nextKey
  redisConnectPromise = client.connect().then(() => client)

  try {
    return await redisConnectPromise
  } catch (error) {
    redisConnectPromise = null
    throw error
  } finally {
    if (client.isReady) {
      redisConnectPromise = null
    }
  }
}

export async function closeSkillRedisClient(): Promise<void> {
  redisConnectPromise = null
  redisClientKey = null
  if (!redisClient) {
    return
  }

  const currentClient = redisClient
  redisClient = null
  if (currentClient.isOpen) {
    await currentClient.quit().catch(() => {})
  }
}

function parseFieldList(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) {
    return {}
  }

  const entries: Array<[string, string]> = []
  for (let index = 0; index < value.length; index += 2) {
    const key = value[index]
    const fieldValue = value[index + 1]
    if (typeof key === 'string' && typeof fieldValue === 'string') {
      entries.push([key, fieldValue])
    }
  }

  return Object.fromEntries(entries)
}

function parseRefreshStreamMessages(
  value: unknown,
): SkillGraphRefreshStreamMessage[] {
  if (!Array.isArray(value)) {
    return []
  }

  const messages: SkillGraphRefreshStreamMessage[] = []
  for (const streamEntry of value) {
    if (!Array.isArray(streamEntry) || streamEntry.length < 2) {
      continue
    }

    const records = streamEntry[1]
    if (!Array.isArray(records)) {
      continue
    }

    for (const record of records) {
      if (!Array.isArray(record) || record.length < 2) {
        continue
      }

      const id = record[0]
      if (typeof id !== 'string') {
        continue
      }

      const fields = parseFieldList(record[1])
      if (!fields.jobKey || !fields.window || !fields.requestedAt) {
        continue
      }

      messages.push({
        id,
        jobKey: fields.jobKey,
        window: fields.window,
        requestedAt: fields.requestedAt,
        lastEventId: fields.lastEventId || null,
      })
    }
  }

  return messages
}

export async function ensureSkillGraphRefreshConsumerGroup(): Promise<void> {
  const client = await getSkillRedisClient()
  const stream = resolveSkillGraphRefreshStream()
  const group = resolveSkillGraphRefreshGroup()

  try {
    await client.sendCommand(['XGROUP', 'CREATE', stream, group, '0', 'MKSTREAM'])
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error)
    if (!message.includes('BUSYGROUP')) {
      throw error
    }
  }
}

export async function publishRefreshRequest(
  request: SkillGraphRefreshRequest,
): Promise<string | null> {
  const publishing = await markSkillGraphRefreshPublishing(
    request.jobKey,
    request.requestedAt,
  )

  if (!publishing) {
    return null
  }

  try {
    const client = await getSkillRedisClient()
    const stream = resolveSkillGraphRefreshStream()
    const messageId = await client.sendCommand([
      'XADD',
      stream,
      '*',
      'jobKey',
      publishing.jobKey,
      'window',
      publishing.window,
      'requestedAt',
      publishing.requestedAt,
      'lastEventId',
      publishing.lastEventId ?? '',
    ])

    await markSkillGraphRefreshPublished(
      publishing.jobKey,
      publishing.requestedAt,
    )

    return typeof messageId === 'string' ? messageId : null
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error)
    await markSkillGraphRefreshPending(publishing.jobKey, message).catch(() => {})
    throw error
  }
}

export async function readRefreshStreamMessages(options: {
  consumerName: string
  count?: number
  blockMs?: number
}): Promise<SkillGraphRefreshStreamMessage[]> {
  await ensureSkillGraphRefreshConsumerGroup()
  const client = await getSkillRedisClient()
  const stream = resolveSkillGraphRefreshStream()
  const group = resolveSkillGraphRefreshGroup()
  const count = Math.max(1, Math.trunc(options.count ?? 1))
  const blockMs = Math.max(1, Math.trunc(options.blockMs ?? 1000))

  const response = await client.sendCommand([
    'XREADGROUP',
    'GROUP',
    group,
    options.consumerName,
    'COUNT',
    String(count),
    'BLOCK',
    String(blockMs),
    'STREAMS',
    stream,
    '>',
  ])

  return parseRefreshStreamMessages(response)
}

export async function acknowledgeRefreshStreamMessage(
  id: string,
): Promise<number> {
  const client = await getSkillRedisClient()
  const stream = resolveSkillGraphRefreshStream()
  const response = await client.sendCommand(['XACK', stream, resolveSkillGraphRefreshGroup(), id])
  return typeof response === 'number' ? response : Number(response ?? 0)
}
