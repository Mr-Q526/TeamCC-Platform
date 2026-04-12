import {
  applySkillAggregateGraphUpdate,
  buildAndWriteSkillAggregateGraphUpdateFromPg,
} from '../src/graph/aggregateGraphUpdate.js'
import { closeSkillFactPgPool } from '../src/events/storage.js'

function parseWindow(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--window') {
      continue
    }

    const value = argv[index + 1]?.trim()
    return value || undefined
  }

  return process.env.SKILL_FACT_AGGREGATE_WINDOW?.trim() || undefined
}

async function main(): Promise<void> {
  const manifest = await buildAndWriteSkillAggregateGraphUpdateFromPg({
    window: parseWindow(process.argv.slice(2)) ?? '30d',
    limit: 1000,
  })
  await applySkillAggregateGraphUpdate(manifest)
  console.log(
    `Applied PG-backed skill aggregate graph update with ${manifest.feedbackAggregates.length} aggregates`,
  )
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await closeSkillFactPgPool().catch(() => {})
  })
