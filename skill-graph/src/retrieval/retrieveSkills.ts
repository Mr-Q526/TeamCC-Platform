import { recallSkills, type RecallResult } from './recall.js'
import { rerankSkills } from './rerank.js'
import { readSkillRetrievalFeatures } from './retrievalFeatures.js'
import type {
  SkillRetrievalRequest,
  SkillRetrievalResponse,
} from './types.js'

type RetrieveSkillAssets = Parameters<typeof recallSkills>[1] & {
  retrievalFeaturesManifest?: Awaited<ReturnType<typeof readSkillRetrievalFeatures>>
}

export async function retrieveSkills(
  request: SkillRetrievalRequest,
  assets: RetrieveSkillAssets = {},
): Promise<SkillRetrievalResponse> {
  const generatedAt = new Date().toISOString()
  const recallResult: RecallResult = await recallSkills(request, assets)

  if (recallResult.candidates.length === 0) {
    return {
      schemaVersion: '2026-04-12',
      generatedAt,
      queryText: request.queryText,
      retrievalMode: 'bm25',
      candidates: [],
      dataVersions: {
        registryVersion: recallResult.registryVersion,
        embeddingsGeneratedAt: recallResult.embeddingsGeneratedAt,
        retrievalFeaturesGeneratedAt: null,
      },
    }
  }

  const enableGraph = recallResult.vectorAvailable
  const rerankResult = await rerankSkills(request, recallResult.candidates, {
    enableGraph,
    retrievalFeaturesManifest: assets.retrievalFeaturesManifest,
  })

  return {
    schemaVersion: '2026-04-12',
    generatedAt,
    queryText: request.queryText,
    retrievalMode: recallResult.vectorAvailable
      ? rerankResult.graphApplied
        ? 'bm25_vector_graph'
        : 'bm25_vector'
      : 'bm25',
    candidates: rerankResult.candidates,
    dataVersions: {
      registryVersion: recallResult.registryVersion,
      embeddingsGeneratedAt: recallResult.embeddingsGeneratedAt,
      retrievalFeaturesGeneratedAt: rerankResult.retrievalFeaturesGeneratedAt,
    },
  }
}
