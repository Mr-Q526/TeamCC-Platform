import { describe, expect, test } from 'bun:test'
import {
  BENCHMARK_RETRIEVAL_DATASET_NAME,
  COVERAGE_RETRIEVAL_DATASET_NAME,
  describeRetrievalDatasetPreset,
  getBenchmarkCasesDir,
  getCoverageCasesDir,
} from './retrievalDatasets.js'

describe('retrieval dataset presets', () => {
  test('resolves benchmark preset by default', () => {
    const preset = describeRetrievalDatasetPreset('benchmark', '/tmp/project')
    expect(preset.datasetName).toBe(BENCHMARK_RETRIEVAL_DATASET_NAME)
    expect(preset.casesDir).toBe(getBenchmarkCasesDir('/tmp/project'))
  })

  test('resolves coverage preset', () => {
    const preset = describeRetrievalDatasetPreset('coverage', '/tmp/project')
    expect(preset.datasetName).toBe(COVERAGE_RETRIEVAL_DATASET_NAME)
    expect(preset.casesDir).toBe(getCoverageCasesDir('/tmp/project'))
  })
})
