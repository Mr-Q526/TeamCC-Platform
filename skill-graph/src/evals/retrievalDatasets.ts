import { join } from 'path'

export type RetrievalDatasetKind = 'legacy' | 'coverage' | 'benchmark'

export const LEGACY_RETRIEVAL_DATASET_NAME = 'skill-graph-retrieval-cases-v1'
export const COVERAGE_RETRIEVAL_DATASET_NAME = 'skill-graph-retrieval-coverage-v1'
export const BENCHMARK_RETRIEVAL_DATASET_NAME = 'skill-graph-retrieval-benchmark-v1'

export const RETRIEVAL_COVERAGE_DATASET_ID = 'retrieval-coverage-v1'
export const RETRIEVAL_BENCHMARK_DATASET_ID = 'retrieval-benchmark-v1'

export function getEvalRoot(projectRoot = process.cwd()): string {
  return join(projectRoot, 'evals', 'skills')
}

export function getRetrievalRoot(projectRoot = process.cwd()): string {
  return join(getEvalRoot(projectRoot), 'cases', 'retrieval')
}

export function getCoverageCasesDir(projectRoot = process.cwd()): string {
  return join(getRetrievalRoot(projectRoot), 'coverage', 'v1')
}

export function getBenchmarkCasesDir(projectRoot = process.cwd()): string {
  return join(getRetrievalRoot(projectRoot), 'benchmark', 'v1')
}

export function getGeneratedCoverageCasesDir(projectRoot = process.cwd()): string {
  return join(getCoverageCasesDir(projectRoot), 'generated')
}

export function getGeneratedCoverageCasesVersionDir(projectRoot = process.cwd()): string {
  return join(getGeneratedCoverageCasesDir(projectRoot), 'v1')
}

export function describeRetrievalDatasetPreset(
  kind: RetrievalDatasetKind,
  projectRoot = process.cwd(),
): {
  kind: RetrievalDatasetKind
  datasetName: string
  datasetId: string
  casesDir: string
  description: string
} {
  switch (kind) {
    case 'coverage':
      return {
        kind,
        datasetName: COVERAGE_RETRIEVAL_DATASET_NAME,
        datasetId: RETRIEVAL_COVERAGE_DATASET_ID,
        casesDir: getCoverageCasesDir(projectRoot),
        description:
          'Skill Graph retrieval coverage cases used for recall and asset sanity checks.',
      }
    case 'legacy':
      return {
        kind,
        datasetName: LEGACY_RETRIEVAL_DATASET_NAME,
        datasetId: RETRIEVAL_COVERAGE_DATASET_ID,
        casesDir: getCoverageCasesDir(projectRoot),
        description:
          'Deprecated compatibility alias for the retrieval coverage dataset.',
      }
    case 'benchmark':
    default:
      return {
        kind: 'benchmark',
        datasetName: BENCHMARK_RETRIEVAL_DATASET_NAME,
        datasetId: RETRIEVAL_BENCHMARK_DATASET_ID,
        casesDir: getBenchmarkCasesDir(projectRoot),
        description:
          'Skill Graph user-like retrieval benchmark cases used for official retrieval comparisons.',
      }
  }
}
