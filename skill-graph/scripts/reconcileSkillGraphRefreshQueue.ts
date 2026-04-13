import { closeSkillFactPgPool } from '../src/events/storage.js'
import { closeSkillRedisClient } from '../src/refresh/redis.js'
import { reconcileRefreshRequests } from '../src/refresh/reconcile.js'

function parseNumberFlag(argv: string[], flag: string): number | undefined {
  const index = argv.indexOf(flag)
  const value = index >= 0 ? argv[index + 1]?.trim() : ''
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const result = await reconcileRefreshRequests({
    limit: parseNumberFlag(argv, '--limit'),
    publishingTimeoutMs: parseNumberFlag(argv, '--publishing-timeout-ms'),
    runningTimeoutMs: parseNumberFlag(argv, '--running-timeout-ms'),
  })

  console.log(
    `Reconciled ${result.scanned} refresh requests, republished ${result.republished}`,
  )
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await closeSkillRedisClient().catch(() => {})
    await closeSkillFactPgPool().catch(() => {})
  })
