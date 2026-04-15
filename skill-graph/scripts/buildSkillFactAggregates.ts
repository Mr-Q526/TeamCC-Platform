import {
  buildAndWriteSkillFactAggregates,
} from '../src/aggregates/skillFactAggregates.js'
import { closeSkillFactPgPool } from '../src/events/storage.js'
import {
  factFilterForRetrievalFeaturePreset,
  type SkillRetrievalFeatureBuildPreset,
} from '../src/retrieval/retrievalFeatures.js'

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

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag)
}

function parsePreset(argv: string[]): SkillRetrievalFeatureBuildPreset | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--preset') {
      continue
    }

    const value = argv[index + 1]?.trim()
    if (value === 'canonical' || value === 'live' || value === 'experiment') {
      return value
    }
  }

  return undefined
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const preset = parsePreset(argv) ?? 'canonical'
  const manifest = await buildAndWriteSkillFactAggregates({
    windowDays: parseWindowDays(argv),
    targetSampleCount: parseTargetSampleCount(argv),
    writePg: !hasFlag(argv, '--json-only'),
    writeJson: !hasFlag(argv, '--pg-only'),
    factFilter: factFilterForRetrievalFeaturePreset(preset),
  })

  console.log(
    `Built ${preset} ${manifest.itemCount} skill feedback aggregates for ${manifest.window}`,
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
