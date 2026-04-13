import { resolve } from 'path'
import {
  syncRetrievalCasesToLangfuseDataset,
} from '../src/evals/langfuseDatasets.js'
import {
  describeRetrievalDatasetPreset,
  type RetrievalDatasetKind,
} from '../src/evals/retrievalDatasets.js'

type CliOptions = {
  datasetKind: RetrievalDatasetKind
  datasetName: string
  description: string
  casesDir: string
  dryRun: boolean
  strict: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const preset = describeRetrievalDatasetPreset('benchmark', process.cwd())
  const options: CliOptions = {
    datasetKind: 'benchmark',
    datasetName: preset.datasetName,
    description: preset.description,
    casesDir: preset.casesDir,
    dryRun: false,
    strict: false,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--dataset-kind' && next) {
      const kind =
        next === 'legacy' || next === 'coverage' || next === 'benchmark'
          ? next
          : 'benchmark'
      const resolved = describeRetrievalDatasetPreset(kind, process.cwd())
      options.datasetKind = kind
      options.datasetName = resolved.datasetName
      options.description = resolved.description
      options.casesDir = resolved.casesDir
      index += 1
    } else if (arg === '--dataset-name' && next) {
      options.datasetName = next
      index += 1
    } else if (arg === '--description' && next) {
      options.description = next
      index += 1
    } else if (arg === '--cases-dir' && next) {
      options.casesDir = resolve(next)
      index += 1
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--strict') {
      options.strict = true
    }
  }

  return options
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const summary = await syncRetrievalCasesToLangfuseDataset(options)

  console.log(JSON.stringify(summary, null, 2))

  if (options.strict && summary.driftCount > 0) {
    throw new Error(
      `Langfuse dataset drift detected for ${summary.driftCount} case(s): ${summary.driftCaseIds.join(', ')}`,
    )
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
