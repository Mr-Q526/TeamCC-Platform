import { publishRefreshRequest } from './redis.js'
import {
  markSkillGraphRefreshPending,
  querySkillGraphRefreshRequests,
  resolveSkillGraphRefreshRunningTimeoutMs,
  type SkillGraphRefreshRequest,
} from './storage.js'

const DEFAULT_RECONCILE_LIMIT = 100
const DEFAULT_PUBLISHING_TIMEOUT_MS = 30 * 1000

function isOlderThan(timestamp: string | null, timeoutMs: number): boolean {
  if (!timestamp) {
    return false
  }

  return Date.now() - Date.parse(timestamp) > timeoutMs
}

async function republishRequest(
  request: SkillGraphRefreshRequest,
): Promise<boolean> {
  const refreshed =
    request.status === 'pending'
      ? request
      : await markSkillGraphRefreshPending(request.jobKey, request.lastError)

  if (!refreshed) {
    return false
  }

  await publishRefreshRequest(refreshed)
  return true
}

export async function reconcileRefreshRequests(options: {
  limit?: number
  publishingTimeoutMs?: number
  runningTimeoutMs?: number
} = {}): Promise<{
  scanned: number
  republished: number
}> {
  const publishingTimeoutMs =
    options.publishingTimeoutMs ?? DEFAULT_PUBLISHING_TIMEOUT_MS
  const runningTimeoutMs =
    options.runningTimeoutMs ?? resolveSkillGraphRefreshRunningTimeoutMs()
  const requests = await querySkillGraphRefreshRequests({
    statuses: ['pending', 'failed', 'publishing', 'running'],
    limit: options.limit ?? DEFAULT_RECONCILE_LIMIT,
  })

  let republished = 0
  for (const request of requests) {
    if (request.status === 'pending' || request.status === 'failed') {
      if (await republishRequest(request).catch(() => false)) {
        republished += 1
      }
      continue
    }

    if (
      request.status === 'publishing' &&
      isOlderThan(request.updatedAt, publishingTimeoutMs)
    ) {
      if (await republishRequest(request).catch(() => false)) {
        republished += 1
      }
      continue
    }

    if (
      request.status === 'running' &&
      isOlderThan(request.startedAt, runningTimeoutMs)
    ) {
      if (await republishRequest(request).catch(() => false)) {
        republished += 1
      }
    }
  }

  return {
    scanned: requests.length,
    republished,
  }
}
