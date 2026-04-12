import {
  buildAndWriteSkillFactAggregates,
} from '../src/aggregates/skillFactAggregates.js'
import { closeSkillFactPgPool } from '../src/events/storage.js'

function parseWindowDays(argv: string[]): number | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--window-days') {
      continue
    }

    const value = Number.parseInt(argv[index + 1] ?? '', 10)
    if (Number.isFinite(value) && value > 0) {
      return value
    }
  }

  const envValue = Number.parseInt(
    process.env.SKILL_FACT_AGGREGATE_WINDOW_DAYS ?? '',
    10,
  )
  return Number.isFinite(envValue) && envValue > 0 ? envValue : undefined
}

function parseTargetSampleCount(argv: string[]): number | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--target-sample-count') {
      continue
    }

    const value = Number.parseInt(argv[index + 1] ?? '', 10)
    if (Number.isFinite(value) && value > 0) {
      return value
    }
  }

  const envValue = Number.parseInt(
    process.env.SKILL_FACT_AGGREGATE_TARGET_SAMPLE_COUNT ?? '',
    10,
  )
  return Number.isFinite(envValue) && envValue > 0 ? envValue : undefined
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const manifest = await buildAndWriteSkillFactAggregates({
    windowDays: parseWindowDays(argv),
    targetSampleCount: parseTargetSampleCount(argv),
  })

  console.log(
    `Built ${manifest.itemCount} skill feedback aggregates for ${manifest.window}`,
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
