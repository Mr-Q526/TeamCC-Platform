import {
  buildAndWriteSkillFactAggregates,
} from '../aggregates/skillFactAggregates.js'
import { ensureSkillFeedbackAggregatesTable } from '../aggregates/storage.js'
import {
  closeSkillFactPgPool,
  ensureSkillFactEventsTable,
} from '../events/storage.js'
import {
  applySkillAggregateGraphUpdate,
  buildAndWriteSkillAggregateGraphUpdateFromPg,
} from '../graph/aggregateGraphUpdate.js'
import {
  factFilterForRetrievalFeaturePreset,
  writeSkillRetrievalFeatures,
} from '../retrieval/retrievalFeatures.js'
import {
  acknowledgeRefreshStreamMessage,
  readRefreshStreamMessages,
  type SkillGraphRefreshStreamMessage,
} from './redis.js'
import {
  claimSkillGraphRefreshRequest,
  finalizeSkillGraphRefreshRequest,
  resolveSkillGraphRefreshRunningTimeoutMs,
  type SkillGraphRefreshClaim,
} from './storage.js'

export async function claimNextRefreshJob(
  message: SkillGraphRefreshStreamMessage,
): Promise<SkillGraphRefreshClaim | null> {
  return claimSkillGraphRefreshRequest(message.jobKey, {
    runningTimeoutMs: resolveSkillGraphRefreshRunningTimeoutMs(),
  })
}

export async function runSkillGraphRefreshJob(
  claim: SkillGraphRefreshClaim,
  executor: (window: string) => Promise<void> = executeSkillGraphRefreshPipeline,
): Promise<void> {
  try {
    await executor(claim.request.window)

    await finalizeSkillGraphRefreshRequest(claim, {
      succeeded: true,
    })
  } catch (error) {
    await finalizeSkillGraphRefreshRequest(claim, {
      succeeded: false,
      lastError: error instanceof Error ? error.message : String(error),
    }).catch(() => {})
    throw error
  }
}

export async function executeSkillGraphRefreshPipeline(
  window: string,
): Promise<void> {
  await ensureSkillFactEventsTable()
  await ensureSkillFeedbackAggregatesTable()

  const aggregateManifest = await buildAndWriteSkillFactAggregates({
    windowDays: Number.parseInt(window.replace(/d$/, ''), 10) || undefined,
    writeJson: true,
    writePg: true,
    factFilter: factFilterForRetrievalFeaturePreset('canonical'),
  })
  const graphManifest = await buildAndWriteSkillAggregateGraphUpdateFromPg({
    window: aggregateManifest.window,
    limit: 1000,
  })
  await applySkillAggregateGraphUpdate(graphManifest)
  await writeSkillRetrievalFeatures({
    preset: 'canonical',
    aggregateManifest,
  })
}

export async function processRefreshStreamMessage(
  message: SkillGraphRefreshStreamMessage,
): Promise<void> {
  const claim = await claimNextRefreshJob(message)

  try {
    if (claim) {
      await runSkillGraphRefreshJob(claim)
    }
  } finally {
    await acknowledgeRefreshStreamMessage(message.id).catch(() => {})
  }
}

export async function runSkillGraphRefreshWorker(options: {
  consumerName: string
  once?: boolean
  blockMs?: number
  count?: number
}): Promise<void> {
  do {
    const messages = await readRefreshStreamMessages({
      consumerName: options.consumerName,
      blockMs: options.blockMs,
      count: options.count,
    })

    for (const message of messages) {
      await processRefreshStreamMessage(message)
    }

    if (options.once) {
      break
    }
  } while (true)
}

export async function closeSkillGraphRefreshWorkerResources(): Promise<void> {
  await closeSkillFactPgPool().catch(() => {})
}
