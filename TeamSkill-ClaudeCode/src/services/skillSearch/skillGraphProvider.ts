import {
  clearSkillRetrievalCache,
  getSkillGraphFeatures as getSkillGraphFeaturesFromGraph,
  readSkillEmbeddings as readSkillEmbeddingsFromGraph,
  readSkillRegistry as readSkillRegistryFromGraph,
  readSkillRetrievalFeatures as readSkillRetrievalFeaturesFromGraph,
  type SkillGraphFeatures,
  type SkillRetrievalFeaturesManifest,
} from '@teamcc/skill-graph/retrieval'

type SkillFeatureCandidate = {
  skillId: string
  version: string
  sourceHash: string
}

type SkillFeatureQueryContext = {
  department?: string | null
  sceneHints?: string[]
  domainHints?: string[]
  queryText?: string
}

export { type SkillGraphFeatures, type SkillRetrievalFeaturesManifest }

function normalizeHint(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function buildSkillFeatureResultKey(candidate: SkillFeatureCandidate): string {
  const version = normalizeHint(candidate.version)
  const sourceHash = normalizeHint(candidate.sourceHash)
  return version && sourceHash
    ? `${candidate.skillId}::${version}::${sourceHash}`
    : candidate.skillId
}

export function clearSkillGraphProviderCache(): void {
  clearSkillRetrievalCache()
}

export async function readSkillRegistry(cwd: string) {
  return readSkillRegistryFromGraph(cwd)
}

export async function readSkillEmbeddings(cwd: string) {
  return readSkillEmbeddingsFromGraph(cwd)
}

export async function readSkillRetrievalFeatures() {
  return readSkillRetrievalFeaturesFromGraph()
}

export async function getSkillGraphFeatures(
  queryContext: SkillFeatureQueryContext,
  candidates: SkillFeatureCandidate[],
): Promise<Map<string, SkillGraphFeatures>> {
  const response = await getSkillGraphFeaturesFromGraph({
    queryText: queryContext.queryText ?? '',
    department: queryContext.department ?? null,
    domainHints: queryContext.domainHints ?? [],
    sceneHints: queryContext.sceneHints ?? [],
    candidates,
  })

  return new Map(
    response.items.map(item => [buildSkillFeatureResultKey(item), item] as const),
  )
}
