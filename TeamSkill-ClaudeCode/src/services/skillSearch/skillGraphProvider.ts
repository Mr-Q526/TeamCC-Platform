import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { logForDebugging } from '../../utils/debug.js'
import {
  getSkillRegistryLocations,
  readGeneratedSkillRegistry,
  type SkillRegistryManifest,
} from './registry.js'
import {
  readGeneratedSkillEmbeddings,
  type SkillEmbeddingsManifest,
} from './embeddings.js'

export type SkillGraphAggregate = {
  aggregateKey: string
  scopeType: 'global' | 'department' | 'scene' | 'version'
  scopeId: string
  skillId: string
  skillVersion: string | null
  sourceHash: string | null
  department: string | null
  scene: string | null
  window: string
  sampleCount: number
  qualityScore: number
  confidence: number
  updatedAt: string
}

export type SkillRetrievalFeaturesManifest = {
  schemaVersion: string
  generatedAt: string
  window: string
  windowDays: number
  source: string
  itemCount: number
  items: SkillGraphAggregate[]
}

export type SkillGraphFeatures = {
  skillId: string
  version: string | null
  sourceHash: string | null
  globalQualityScore: number | null
  globalConfidence: number | null
  versionQualityScore: number | null
  versionConfidence: number | null
  departmentScore: number | null
  departmentConfidence: number | null
  sceneScore: number | null
  sceneConfidence: number | null
  graphFeatureScore: number
  graphFeatureBreakdown: {
    global: number
    version: number
    department: number
    scene: number
  }
}

type IndexedSkillRetrievalFeatures = {
  manifest: SkillRetrievalFeaturesManifest
  globalBySkillId: Map<string, SkillGraphAggregate>
  versionByIdentity: Map<string, SkillGraphAggregate>
  departmentBySkillId: Map<string, Map<string, SkillGraphAggregate>>
  sceneBySkillId: Map<string, Map<string, SkillGraphAggregate>>
}

type SkillFeatureCandidate = {
  skillId: string
  version: string
  sourceHash: string
}

type SkillFeatureQueryContext = {
  department?: string | null
  sceneHints?: string[]
}

const SKILL_GRAPH_ROOT = fileURLToPath(
  new URL('../../../../skill-graph', import.meta.url),
)
const SKILL_RETRIEVAL_FEATURES_FILE = join(
  SKILL_GRAPH_ROOT,
  'data',
  'aggregates',
  'skill-feedback-aggregates.json',
)

const retrievalFeaturesCache = new Map<
  string,
  Promise<IndexedSkillRetrievalFeatures | null>
>()

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toNumberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeHint(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function buildVersionIdentityKey(
  skillId: string,
  version: string | null | undefined,
  sourceHash: string | null | undefined,
): string | null {
  const normalizedVersion = normalizeHint(version)
  const normalizedSourceHash = normalizeHint(sourceHash)

  if (!skillId || !normalizedVersion || !normalizedSourceHash) {
    return null
  }

  return `${skillId}::${normalizedVersion}::${normalizedSourceHash}`
}

export function buildSkillFeatureResultKey(candidate: SkillFeatureCandidate): string {
  return (
    buildVersionIdentityKey(
      candidate.skillId,
      candidate.version,
      candidate.sourceHash,
    ) ?? candidate.skillId
  )
}

function parseAggregate(value: unknown): SkillGraphAggregate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const scopeType = toStringValue(record.scopeType) as SkillGraphAggregate['scopeType']
  if (
    scopeType !== 'global' &&
    scopeType !== 'department' &&
    scopeType !== 'scene' &&
    scopeType !== 'version'
  ) {
    return null
  }

  const skillId = toStringValue(record.skillId)
  if (!skillId) {
    return null
  }

  return {
    aggregateKey: toStringValue(record.aggregateKey),
    scopeType,
    scopeId: toStringValue(record.scopeId),
    skillId,
    skillVersion: toNullableString(record.skillVersion),
    sourceHash: toNullableString(record.sourceHash),
    department: toNullableString(record.department),
    scene: toNullableString(record.scene),
    window: toStringValue(record.window),
    sampleCount: toNumberValue(record.sampleCount),
    qualityScore: toNumberValue(record.qualityScore),
    confidence: toNumberValue(record.confidence),
    updatedAt: toStringValue(record.updatedAt),
  }
}

function setScopedAggregate(
  target: Map<string, Map<string, SkillGraphAggregate>>,
  skillId: string,
  scopeId: string,
  aggregate: SkillGraphAggregate,
): void {
  const scopeKey = normalizeHint(scopeId)
  if (!scopeKey) {
    return
  }

  const scoped = target.get(skillId) ?? new Map<string, SkillGraphAggregate>()
  scoped.set(scopeKey, aggregate)
  target.set(skillId, scoped)
}

function indexRetrievalFeatures(
  manifest: SkillRetrievalFeaturesManifest,
): IndexedSkillRetrievalFeatures {
  const globalBySkillId = new Map<string, SkillGraphAggregate>()
  const versionByIdentity = new Map<string, SkillGraphAggregate>()
  const departmentBySkillId = new Map<string, Map<string, SkillGraphAggregate>>()
  const sceneBySkillId = new Map<string, Map<string, SkillGraphAggregate>>()

  for (const aggregate of manifest.items) {
    switch (aggregate.scopeType) {
      case 'global':
        globalBySkillId.set(aggregate.skillId, aggregate)
        break
      case 'version': {
        const key = buildVersionIdentityKey(
          aggregate.skillId,
          aggregate.skillVersion,
          aggregate.sourceHash,
        )
        if (key) {
          versionByIdentity.set(key, aggregate)
        }
        break
      }
      case 'department':
        setScopedAggregate(
          departmentBySkillId,
          aggregate.skillId,
          aggregate.scopeId,
          aggregate,
        )
        break
      case 'scene':
        setScopedAggregate(sceneBySkillId, aggregate.skillId, aggregate.scopeId, aggregate)
        break
      default:
        break
    }
  }

  return {
    manifest,
    globalBySkillId,
    versionByIdentity,
    departmentBySkillId,
    sceneBySkillId,
  }
}

export function clearSkillGraphProviderCache(): void {
  retrievalFeaturesCache.clear()
}

export async function readSkillRegistry(
  cwd: string,
): Promise<SkillRegistryManifest | null> {
  for (const location of getSkillRegistryLocations(cwd)) {
    const manifest = await readGeneratedSkillRegistry(location.dir)
    if (manifest && manifest.skills.length > 0) {
      return manifest
    }
  }

  return null
}

export async function readSkillEmbeddings(
  cwd: string,
): Promise<SkillEmbeddingsManifest | null> {
  for (const location of getSkillRegistryLocations(cwd)) {
    const manifest = await readGeneratedSkillEmbeddings(location.dir)
    if (manifest && manifest.items.length > 0) {
      return manifest
    }
  }

  return null
}

export async function readSkillRetrievalFeatures():
  Promise<IndexedSkillRetrievalFeatures | null> {
  const cached = retrievalFeaturesCache.get(SKILL_RETRIEVAL_FEATURES_FILE)
  if (cached) {
    return cached
  }

  const loadingPromise = (async () => {
    if (!existsSync(SKILL_RETRIEVAL_FEATURES_FILE)) {
      return null
    }

    try {
      const raw = await getFsImplementation().readFile(
        SKILL_RETRIEVAL_FEATURES_FILE,
        { encoding: 'utf-8' },
      )
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (!Array.isArray(parsed.items)) {
        return null
      }

      const items = parsed.items
        .map(parseAggregate)
        .filter((item): item is SkillGraphAggregate => item !== null)

      return indexRetrievalFeatures({
        schemaVersion: toStringValue(parsed.schemaVersion, '2026-04-12'),
        generatedAt: toStringValue(parsed.generatedAt),
        window: toStringValue(parsed.window),
        windowDays: toNumberValue(parsed.windowDays),
        source: toStringValue(parsed.source),
        itemCount:
          typeof parsed.itemCount === 'number' ? parsed.itemCount : items.length,
        items,
      })
    } catch (error) {
      logForDebugging(
        `[skill-graph-provider] failed to read retrieval features ${SKILL_RETRIEVAL_FEATURES_FILE}: ${error}`,
        { level: 'warn' },
      )
      return null
    }
  })()

  retrievalFeaturesCache.set(SKILL_RETRIEVAL_FEATURES_FILE, loadingPromise)
  return loadingPromise
}

function scoreFeature(aggregate: SkillGraphAggregate | null): number {
  if (!aggregate) {
    return 0
  }

  return aggregate.qualityScore * aggregate.confidence
}

function getBestSceneAggregate(
  indexed: IndexedSkillRetrievalFeatures,
  skillId: string,
  sceneHints: string[],
): SkillGraphAggregate | null {
  const sceneMap = indexed.sceneBySkillId.get(skillId)
  if (!sceneMap || sceneHints.length === 0) {
    return null
  }

  let best: SkillGraphAggregate | null = null
  let bestScore = -1

  for (const hint of sceneHints) {
    const normalizedHint = normalizeHint(hint)
    if (!normalizedHint) continue
    const aggregate = sceneMap.get(normalizedHint)
    if (!aggregate) continue
    const candidateScore = scoreFeature(aggregate)
    if (candidateScore > bestScore) {
      best = aggregate
      bestScore = candidateScore
    }
  }

  return best
}

export async function getSkillGraphFeatures(
  queryContext: SkillFeatureQueryContext,
  candidates: SkillFeatureCandidate[],
): Promise<Map<string, SkillGraphFeatures>> {
  const indexed = await readSkillRetrievalFeatures()
  const results = new Map<string, SkillGraphFeatures>()

  if (!indexed || candidates.length === 0) {
    return results
  }

  const department = normalizeHint(queryContext.department)
  const sceneHints = queryContext.sceneHints
    ?.map(normalizeHint)
    .filter((hint): hint is string => Boolean(hint)) ?? []

  for (const candidate of candidates) {
    const identityKey = buildVersionIdentityKey(
      candidate.skillId,
      candidate.version,
      candidate.sourceHash,
    )
    const globalAggregate = indexed.globalBySkillId.get(candidate.skillId) ?? null
    const versionAggregate = identityKey
      ? indexed.versionByIdentity.get(identityKey) ?? null
      : null
    const departmentAggregate = department
      ? indexed.departmentBySkillId.get(candidate.skillId)?.get(department) ?? null
      : null
    const sceneAggregate = getBestSceneAggregate(
      indexed,
      candidate.skillId,
      sceneHints,
    )

    if (
      !globalAggregate &&
      !versionAggregate &&
      !departmentAggregate &&
      !sceneAggregate
    ) {
      continue
    }

    const graphFeatureBreakdown = {
      global: scoreFeature(globalAggregate),
      version: scoreFeature(versionAggregate),
      department: scoreFeature(departmentAggregate),
      scene: scoreFeature(sceneAggregate),
    }

    const graphFeatureScore =
      0.35 * graphFeatureBreakdown.version +
      0.25 * graphFeatureBreakdown.global +
      0.2 * graphFeatureBreakdown.department +
      0.2 * graphFeatureBreakdown.scene

    results.set(buildSkillFeatureResultKey(candidate), {
      skillId: candidate.skillId,
      version: versionAggregate?.skillVersion ?? null,
      sourceHash: versionAggregate?.sourceHash ?? null,
      globalQualityScore: globalAggregate?.qualityScore ?? null,
      globalConfidence: globalAggregate?.confidence ?? null,
      versionQualityScore: versionAggregate?.qualityScore ?? null,
      versionConfidence: versionAggregate?.confidence ?? null,
      departmentScore: departmentAggregate?.qualityScore ?? null,
      departmentConfidence: departmentAggregate?.confidence ?? null,
      sceneScore: sceneAggregate?.qualityScore ?? null,
      sceneConfidence: sceneAggregate?.confidence ?? null,
      graphFeatureScore,
      graphFeatureBreakdown,
    })
  }

  return results
}
