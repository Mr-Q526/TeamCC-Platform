import { join } from 'path'

export type RetrievalDatasetKind = 'legacy' | 'coverage' | 'benchmark' | 'graph-preference'

export const LEGACY_RETRIEVAL_DATASET_NAME = 'skill-graph-retrieval-cases-v1'
export const COVERAGE_RETRIEVAL_DATASET_NAME = 'skill-graph-retrieval-coverage-v1'
export const BENCHMARK_RETRIEVAL_DATASET_NAME = 'skill-graph-retrieval-benchmark-v1'
export const GRAPH_PREFERENCE_RETRIEVAL_DATASET_NAME =
  'skill-graph-retrieval-graph-preference-v1'

export const RETRIEVAL_COVERAGE_DATASET_ID = 'retrieval-coverage-v1'
export const RETRIEVAL_BENCHMARK_DATASET_ID = 'retrieval-benchmark-v1'
export const RETRIEVAL_GRAPH_PREFERENCE_DATASET_ID = 'retrieval-graph-preference-v1'

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

export function getGraphPreferenceCasesDir(projectRoot = process.cwd()): string {
  return join(getRetrievalRoot(projectRoot), 'graph-preference', 'v1')
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
          'Skill Graph 检索覆盖测试集，用于检查每个 skill 是否可召回，以及 registry、embeddings、graph features 等资产是否正常。',
      }
    case 'legacy':
      return {
        kind,
        datasetName: LEGACY_RETRIEVAL_DATASET_NAME,
        datasetId: RETRIEVAL_COVERAGE_DATASET_ID,
        casesDir: getCoverageCasesDir(projectRoot),
        description:
          '已废弃的兼容数据集别名，实际指向 retrieval coverage 测试集。',
      }
    case 'benchmark':
    default:
      return {
        kind: 'benchmark',
        datasetName: BENCHMARK_RETRIEVAL_DATASET_NAME,
        datasetId: RETRIEVAL_BENCHMARK_DATASET_ID,
        casesDir: getBenchmarkCasesDir(projectRoot),
        description:
          'Skill Graph 通用检索 benchmark 数据集，用于正式比较 bm25、bm25_vector、bm25_vector_graph 的召回与排序效果。',
      }
    case 'graph-preference':
      return {
        kind,
        datasetName: GRAPH_PREFERENCE_RETRIEVAL_DATASET_NAME,
        datasetId: RETRIEVAL_GRAPH_PREFERENCE_DATASET_ID,
        casesDir: getGraphPreferenceCasesDir(projectRoot),
        description:
          'Skill Graph 图谱偏好专项评测集，用于验证在同意图场景下，反馈效果更好的 skill 是否会被 graph rerank 排到更前。',
      }
  }
}
