import { closeSkillFactPgPool } from '../src/events/storage.js'
import { closeSkillRedisClient } from '../src/refresh/redis.js'
import { runSkillGraphRefreshWorker } from '../src/refresh/worker.js'

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag)
}

function parseStringFlag(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  const value = index >= 0 ? argv[index + 1]?.trim() : ''
  return value || undefined
}

function parseNumberFlag(argv: string[], flag: string): number | undefined {
  const value = parseStringFlag(argv, flag)
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const consumerName =
    parseStringFlag(argv, '--consumer') ??
    `skill-graph-worker-${process.pid}`

  await runSkillGraphRefreshWorker({
    consumerName,
    once: hasFlag(argv, '--once'),
    blockMs: parseNumberFlag(argv, '--block-ms'),
    count: parseNumberFlag(argv, '--count'),
  })
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
