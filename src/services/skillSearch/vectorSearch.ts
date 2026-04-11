import { getProjectRoot } from '../../bootstrap/state.js'
import { logForDebugging } from '../../utils/debug.js'
import { getSkillRegistryLocations } from './registry.js'
import {
  cosineSimilarity,
  embedQueryText,
  readGeneratedSkillEmbeddings,
} from './embeddings.js'

export type VectorSkillSearchResult = {
  skillId: string
  version: string
  sourceHash: string
  score: number
}

export async function searchSkillVectors(
  cwd: string,
  query: string,
  limit = 20,
): Promise<VectorSkillSearchResult[]> {
  const embeddingQuery = await embedQueryText(query)
  if (!embeddingQuery) {
    return []
  }

  for (const location of getSkillRegistryLocations(cwd || getProjectRoot())) {
    const manifest = await readGeneratedSkillEmbeddings(location.dir)
    if (!manifest || manifest.items.length === 0) {
      continue
    }

    const scored = manifest.items
      .map(item => ({
        skillId: item.skillId,
        version: item.version,
        sourceHash: item.sourceHash,
        score: cosineSimilarity(embeddingQuery.vector, item.vector),
      }))
      .filter(item => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)

    if (scored.length > 0) {
      return scored
    }
  }

  return []
}

export async function hasGeneratedSkillEmbeddings(cwd: string): Promise<boolean> {
  for (const location of getSkillRegistryLocations(cwd || getProjectRoot())) {
    const manifest = await readGeneratedSkillEmbeddings(location.dir)
    if (manifest && manifest.items.length > 0) {
      return true
    }
  }

  return false
}

export function vectorSearchAvailable(): boolean {
  const hasApiKey =
    Boolean(process.env.ARK_API_KEY?.trim()) ||
    Boolean(process.env.VOLC_ARK_API_KEY?.trim())
  const hasModel =
    Boolean(process.env.VOLC_ARK_EMBEDDING_MODEL?.trim()) ||
    Boolean(process.env.VOLC_ARK_EMBEDDING_ENDPOINT_ID?.trim())

  if (!hasApiKey || !hasModel) {
    logForDebugging(
      '[skill-vector-search] missing ARK_API_KEY/VOLC_ARK_API_KEY or embedding model env; vector recall disabled',
      { level: 'info' },
    )
    return false
  }

  return true
}
