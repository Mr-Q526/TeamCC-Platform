import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import type {
  SkillFeedbackAggregate,
  SkillFeedbackAggregateManifest,
} from '../aggregates/skillFactAggregates.js'
import {
  getSkillGraphSkillsDir,
  readSkillRegistry,
  type SkillRegistryEntry,
  type SkillRegistryManifest,
} from '../registry/registry.js'

export type SkillRetrievalRequest = {
  queryText: string
  queryContext?: string
  cwd: string
  department?: string | null
  domainHints?: string[]
  sceneHints?: string[]
  referencedFiles?: string[]
  editedFiles?: string[]
  priorInjectedSkillIds?: string[]
  priorInvokedSkillIds?: string[]
  limit: number
}

export type SkillRecallCandidate = {
  skillId: string
  name?: string
  displayName?: string
  description?: string
  version?: string | null
  sourceHash?: string | null
  domain?: string
  departmentTags?: string[]
  sceneTags?: string[]
  retrievalSource?: 'local_lexical' | 'local_hybrid'
  recallScore?: number | null
  recallScoreBreakdown?: Record<string, number> | null
}

export type SkillRetrievalAggregateMetric = {
  score: number
  confidence: number
  sampleCount: number
  invocationCount: number
  successRate: number
  updatedAt: string
}

export type SkillRetrievalVersionFeature = {
  version: string
  sourceHash: string
  versionKey: string
  qualityScore: number
  confidence: number
  sampleCount: number
  invocationCount: number
  successRate: number
  updatedAt: string
}

export type SkillRetrievalFeatureScoring = {
  graphFeatureScoreFormula: string
  finalScoreFormula: string
  graphFeatureWeights: {
    version: number
    global: number
    department: number
    scene: number
  }
  graphFeatureInputs: string[]
}

export type SkillRetrievalFeatures = {
  skillId: string
  name: string
  displayName: string
  description: string
  version: string
  sourceHash: string
  versionKey: string
  domain: string
  departmentTags: string[]
  sceneTags: string[]
  global: SkillRetrievalAggregateMetric | null
  versions: SkillRetrievalVersionFeature[]
  departments: Record<string, SkillRetrievalAggregateMetric>
  scenes: Record<string, SkillRetrievalAggregateMetric>
}

export type SkillRetrievalFeaturesManifest = {
  schemaVersion: '2026-04-12'
  generatedAt: string
  registryVersion: string | null
  aggregateGeneratedAt: string | null
  window: string | null
  scoring: SkillRetrievalFeatureScoring
  itemCount: number
  items: SkillRetrievalFeatures[]
}

export type SkillGraphFeatureSignalExplanation = {
  scope: 'global' | 'version' | 'department' | 'scene'
  weight: number
  matched: boolean
  matchedKey: string | null
  qualityScore: number | null
  confidence: number | null
  sampleCount: number | null
  invocationCount: number | null
  successRate: number | null
  weightedContribution: number
  reason: string
}

export type SkillGraphFeatureExplanation = {
  formula: string
  signals: SkillGraphFeatureSignalExplanation[]
  missingSignals: string[]
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
  invocationCount: number | null
  successRate: number | null
  graphFeatureScore: number
  graphFeatureBreakdown: {
    global: number
    version: number
    department: number
    scene: number
  }
  graphFeatureExplanation: SkillGraphFeatureExplanation
}

export type SkillGraphFeatureRequest = Pick<
  SkillRetrievalRequest,
  'queryText' | 'department' | 'domainHints' | 'sceneHints'
> & {
  candidates: Array<
    Pick<SkillRecallCandidate, 'skillId' | 'version' | 'sourceHash'>
  >
}

export type SkillGraphFeatureResponse = {
  schemaVersion: '2026-04-12'
  generatedAt: string
  sourceFeaturesGeneratedAt: string | null
  items: SkillGraphFeatures[]
}

export const GENERATED_SKILL_RETRIEVAL_FEATURES_FILE =
  'skill-retrieval-features.json'

const GRAPH_FEATURE_WEIGHTS = {
  version: 0.35,
  global: 0.25,
  department: 0.2,
  scene: 0.2,
} as const

const GRAPH_FEATURE_SCORE_FORMULA =
  'graphFeatureScore = 0.35 * version(qualityScore * confidence) + 0.25 * global(qualityScore * confidence) + 0.20 * department(qualityScore * confidence) + 0.20 * scene(qualityScore * confidence)'

export const RETRIEVAL_FEATURE_SCORING: SkillRetrievalFeatureScoring = {
  graphFeatureScoreFormula: GRAPH_FEATURE_SCORE_FORMULA,
  finalScoreFormula:
    'finalScore = graphFeatures ? 0.70 * recallNormalized + 0.30 * graphFeatureScore : recallNormalized',
  graphFeatureWeights: { ...GRAPH_FEATURE_WEIGHTS },
  graphFeatureInputs: [
    'version aggregate keyed by skillId + version + sourceHash',
    'global aggregate keyed by skillId',
    'department aggregate matched from request.department',
    'scene aggregate matched from request.sceneHints in order',
  ],
}

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DEFAULT_AGGREGATE_FILE = join(
  PROJECT_ROOT,
  'data',
  'aggregates',
  'skill-feedback-aggregates.json',
)
const DEFAULT_OUTPUT_FILE = join(
  PROJECT_ROOT,
  'data',
  'aggregates',
  GENERATED_SKILL_RETRIEVAL_FEATURES_FILE,
)

function resolveRetrievalFeaturesFilePath(filePath?: string): string {
  return (
    filePath ||
    process.env.SKILL_RETRIEVAL_FEATURES_PATH?.trim() ||
    DEFAULT_OUTPUT_FILE
  )
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function toNumberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
  }

  return []
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6))
}

function normalizeDepartmentKey(value: string | null | undefined): string | null {
  const trimmed = toStringValue(value)
  if (!trimmed) {
    return null
  }

  return trimmed.startsWith('dept:') ? trimmed.slice(5) : trimmed
}

function normalizeSceneKey(value: string | null | undefined): string | null {
  const trimmed = toStringValue(value)
  if (!trimmed) {
    return null
  }

  return trimmed.startsWith('scene:') ? trimmed.slice(6) : trimmed
}

function makeVersionKey(skillId: string, version: string, sourceHash: string): string {
  return `${skillId}@${version}#${sourceHash.slice(0, 12)}`
}

function featureMetricFromAggregate(
  aggregate: SkillFeedbackAggregate,
): SkillRetrievalAggregateMetric {
  return {
    score: roundMetric(aggregate.qualityScore),
    confidence: roundMetric(aggregate.confidence),
    sampleCount: aggregate.sampleCount,
    invocationCount: aggregate.invocationCount,
    successRate: roundMetric(aggregate.successRate),
    updatedAt: aggregate.updatedAt,
  }
}

function versionFeatureFromAggregate(
  aggregate: SkillFeedbackAggregate,
): SkillRetrievalVersionFeature | null {
  if (!aggregate.skillVersion || !aggregate.sourceHash) {
    return null
  }

  return {
    version: aggregate.skillVersion,
    sourceHash: aggregate.sourceHash,
    versionKey: makeVersionKey(
      aggregate.skillId,
      aggregate.skillVersion,
      aggregate.sourceHash,
    ),
    qualityScore: roundMetric(aggregate.qualityScore),
    confidence: roundMetric(aggregate.confidence),
    sampleCount: aggregate.sampleCount,
    invocationCount: aggregate.invocationCount,
    successRate: roundMetric(aggregate.successRate),
    updatedAt: aggregate.updatedAt,
  }
}

function readAggregateManifestFromFile(
  filePath = DEFAULT_AGGREGATE_FILE,
): Promise<SkillFeedbackAggregateManifest | null> {
  if (!existsSync(filePath)) {
    return Promise.resolve(null)
  }

  return readFile(filePath, 'utf-8')
    .then(raw => JSON.parse(raw) as SkillFeedbackAggregateManifest)
    .catch(() => null)
}

function parseRetrievalAggregateMetric(
  value: unknown,
): SkillRetrievalAggregateMetric | null {
  if (!isRecord(value)) {
    return null
  }

  const score = toNumberValue(value.score)
  const confidence = toNumberValue(value.confidence)
  const sampleCount = toNumberValue(value.sampleCount)
  const invocationCount = toNumberValue(value.invocationCount)
  const successRate = toNumberValue(value.successRate)
  const updatedAt = toStringValue(value.updatedAt)

  if (
    score === null ||
    confidence === null ||
    sampleCount === null ||
    invocationCount === null ||
    successRate === null ||
    !updatedAt
  ) {
    return null
  }

  return {
    score,
    confidence,
    sampleCount,
    invocationCount,
    successRate,
    updatedAt,
  }
}

function parseRetrievalVersionFeature(
  value: unknown,
): SkillRetrievalVersionFeature | null {
  if (!isRecord(value)) {
    return null
  }

  const qualityScore = toNumberValue(value.qualityScore)
  const confidence = toNumberValue(value.confidence)
  const sampleCount = toNumberValue(value.sampleCount)
  const invocationCount = toNumberValue(value.invocationCount)
  const successRate = toNumberValue(value.successRate)

  if (
    !toStringValue(value.version) ||
    !toStringValue(value.sourceHash) ||
    !toStringValue(value.versionKey) ||
    qualityScore === null ||
    confidence === null ||
    sampleCount === null ||
    invocationCount === null ||
    successRate === null ||
    !toStringValue(value.updatedAt)
  ) {
    return null
  }

  return {
    version: toStringValue(value.version),
    sourceHash: toStringValue(value.sourceHash),
    versionKey: toStringValue(value.versionKey),
    qualityScore,
    confidence,
    sampleCount,
    invocationCount,
    successRate,
    updatedAt: toStringValue(value.updatedAt),
  }
}

function parseMetricMap(
  value: unknown,
): Record<string, SkillRetrievalAggregateMetric> {
  if (!isRecord(value)) {
    return {}
  }

  const entries = Object.entries(value)
    .map(([key, item]) => [key, parseRetrievalAggregateMetric(item)] as const)
    .filter((entry): entry is [string, SkillRetrievalAggregateMetric] => entry[1] !== null)

  return Object.fromEntries(entries)
}

function parseRetrievalFeatureItem(value: unknown): SkillRetrievalFeatures | null {
  if (!isRecord(value)) {
    return null
  }

  const skillId = toStringValue(value.skillId)
  const name = toStringValue(value.name)
  const displayName = toStringValue(value.displayName)
  const description = toStringValue(value.description)
  const version = toStringValue(value.version)
  const sourceHash = toStringValue(value.sourceHash)
  const versionKey = toStringValue(value.versionKey)
  const domain = toStringValue(value.domain)

  if (
    !skillId ||
    !name ||
    !displayName ||
    !description ||
    !version ||
    !sourceHash ||
    !versionKey ||
    !domain
  ) {
    return null
  }

  return {
    skillId,
    name,
    displayName,
    description,
    version,
    sourceHash,
    versionKey,
    domain,
    departmentTags: toStringArray(value.departmentTags),
    sceneTags: toStringArray(value.sceneTags),
    global: parseRetrievalAggregateMetric(value.global),
    versions: Array.isArray(value.versions)
      ? value.versions
          .map(parseRetrievalVersionFeature)
          .filter((item): item is SkillRetrievalVersionFeature => item !== null)
      : [],
    departments: parseMetricMap(value.departments),
    scenes: parseMetricMap(value.scenes),
  }
}

function findAggregateByScope(
  aggregates: SkillFeedbackAggregate[],
  scopeType: SkillFeedbackAggregate['scopeType'],
  predicate: (aggregate: SkillFeedbackAggregate) => boolean,
): SkillFeedbackAggregate[] {
  return aggregates.filter(
    aggregate => aggregate.scopeType === scopeType && predicate(aggregate),
  )
}

export function buildSkillRetrievalFeatures(
  aggregateManifest: SkillFeedbackAggregateManifest | null,
  registryManifest: SkillRegistryManifest | null,
): SkillRetrievalFeaturesManifest {
  const generatedAt = new Date().toISOString()
  const items: SkillRetrievalFeatures[] = []
  const aggregates = aggregateManifest?.items ?? []

  for (const skill of registryManifest?.skills ?? []) {
    const globalAggregate =
      findAggregateByScope(
        aggregates,
        'global',
        aggregate =>
          aggregate.skillId === skill.skillId && aggregate.scopeId === 'global',
      )[0] ?? null

    const versionAggregates = findAggregateByScope(
      aggregates,
      'version',
      aggregate => aggregate.skillId === skill.skillId,
    )
      .map(versionFeatureFromAggregate)
      .filter((item): item is SkillRetrievalVersionFeature => item !== null)
      .sort((left, right) => left.versionKey.localeCompare(right.versionKey))

    const departmentAggregates = findAggregateByScope(
      aggregates,
      'department',
      aggregate => aggregate.skillId === skill.skillId && Boolean(aggregate.department),
    )
    const sceneAggregates = findAggregateByScope(
      aggregates,
      'scene',
      aggregate => aggregate.skillId === skill.skillId && Boolean(aggregate.scene),
    )

    items.push({
      skillId: skill.skillId,
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      version: skill.version,
      sourceHash: skill.sourceHash,
      versionKey: makeVersionKey(skill.skillId, skill.version, skill.sourceHash),
      domain: skill.domain,
      departmentTags: skill.departmentTags,
      sceneTags: skill.sceneTags,
      global: globalAggregate ? featureMetricFromAggregate(globalAggregate) : null,
      versions: versionAggregates,
      departments: Object.fromEntries(
        departmentAggregates
          .filter(aggregate => aggregate.department)
          .map(aggregate => [
            aggregate.department as string,
            featureMetricFromAggregate(aggregate),
          ]),
      ),
      scenes: Object.fromEntries(
        sceneAggregates
          .filter(aggregate => aggregate.scene)
          .map(aggregate => [
            aggregate.scene as string,
            featureMetricFromAggregate(aggregate),
          ]),
      ),
    })
  }

  return {
    schemaVersion: '2026-04-12',
    generatedAt,
    registryVersion: registryManifest?.registryVersion ?? null,
    aggregateGeneratedAt: aggregateManifest?.generatedAt ?? null,
    window: aggregateManifest?.window ?? null,
    scoring: RETRIEVAL_FEATURE_SCORING,
    itemCount: items.length,
    items: items.sort((left, right) => left.skillId.localeCompare(right.skillId)),
  }
}

export async function readSkillRetrievalFeatures(
  filePath = resolveRetrievalFeaturesFilePath(),
): Promise<SkillRetrievalFeaturesManifest | null> {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
      return null
    }

    const items = parsed.items
      .map(parseRetrievalFeatureItem)
      .filter((item): item is SkillRetrievalFeatures => item !== null)

    return {
      schemaVersion: '2026-04-12',
      generatedAt: toStringValue(parsed.generatedAt),
      registryVersion: toStringValue(parsed.registryVersion) || null,
      aggregateGeneratedAt: toStringValue(parsed.aggregateGeneratedAt) || null,
      window: toStringValue(parsed.window) || null,
      scoring: RETRIEVAL_FEATURE_SCORING,
      itemCount:
        typeof parsed.itemCount === 'number' ? parsed.itemCount : items.length,
      items,
    }
  } catch {
    return null
  }
}

export async function writeSkillRetrievalFeatures(
  outputFile = DEFAULT_OUTPUT_FILE,
): Promise<SkillRetrievalFeaturesManifest> {
  const [aggregateManifest, registryManifest] = await Promise.all([
    readAggregateManifestFromFile(),
    readSkillRegistry(PROJECT_ROOT),
  ])
  const manifest = buildSkillRetrievalFeatures(aggregateManifest, registryManifest)
  await mkdir(dirname(outputFile), { recursive: true })
  await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
  return manifest
}

function normalizeCandidateVersionLookup(
  item: SkillRetrievalFeatures,
  candidate: Pick<SkillRecallCandidate, 'version' | 'sourceHash'>,
): SkillRetrievalVersionFeature | null {
  const version = toStringValue(candidate.version ?? '')
  const sourceHash = toStringValue(candidate.sourceHash ?? '')

  if (version && sourceHash) {
    return (
      item.versions.find(
        feature =>
          feature.version === version && feature.sourceHash === sourceHash,
      ) ?? null
    )
  }

  if (version) {
    return item.versions.find(feature => feature.version === version) ?? null
  }

  return null
}

function graphFeatureScoreFromBreakdown(breakdown: {
  global: number
  version: number
  department: number
  scene: number
}): number {
  return roundMetric(
    breakdown.global +
      breakdown.version +
      breakdown.department +
      breakdown.scene,
  )
}

function signalExplanation(options: {
  scope: SkillGraphFeatureSignalExplanation['scope']
  weight: number
  matchedKey: string | null
  qualityScore: number | null
  confidence: number | null
  sampleCount: number | null
  invocationCount: number | null
  successRate: number | null
  weightedContribution: number
  reason: string
}): SkillGraphFeatureSignalExplanation {
  return {
    scope: options.scope,
    weight: options.weight,
    matched: options.matchedKey !== null,
    matchedKey: options.matchedKey,
    qualityScore: options.qualityScore,
    confidence: options.confidence,
    sampleCount: options.sampleCount,
    invocationCount: options.invocationCount,
    successRate: options.successRate,
    weightedContribution: roundMetric(options.weightedContribution),
    reason: options.reason,
  }
}

function aggregateMetricExplanation(options: {
  scope: SkillGraphFeatureSignalExplanation['scope']
  weight: number
  matchedKey: string | null
  metric: SkillRetrievalAggregateMetric | null
  contribution: number
  reason: string
}): SkillGraphFeatureSignalExplanation {
  return signalExplanation({
    scope: options.scope,
    weight: options.weight,
    matchedKey: options.matchedKey,
    qualityScore: options.metric?.score ?? null,
    confidence: options.metric?.confidence ?? null,
    sampleCount: options.metric?.sampleCount ?? null,
    invocationCount: options.metric?.invocationCount ?? null,
    successRate: options.metric?.successRate ?? null,
    weightedContribution: options.contribution,
    reason: options.reason,
  })
}

function versionFeatureExplanation(options: {
  feature: SkillRetrievalVersionFeature | null
  contribution: number
  requestedVersion: string | null
  requestedSourceHash: string | null
  featureItemExists: boolean
}): SkillGraphFeatureSignalExplanation {
  const requestedIdentity = [
    options.requestedVersion ? `version=${options.requestedVersion}` : null,
    options.requestedSourceHash ? `sourceHash=${options.requestedSourceHash}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return signalExplanation({
    scope: 'version',
    weight: GRAPH_FEATURE_WEIGHTS.version,
    matchedKey: options.feature?.versionKey ?? null,
    qualityScore: options.feature?.qualityScore ?? null,
    confidence: options.feature?.confidence ?? null,
    sampleCount: options.feature?.sampleCount ?? null,
    invocationCount: options.feature?.invocationCount ?? null,
    successRate: options.feature?.successRate ?? null,
    weightedContribution: options.contribution,
    reason: options.feature
      ? `matched exact SkillVersion aggregate ${options.feature.versionKey}`
      : options.featureItemExists
        ? `missing SkillVersion aggregate for ${requestedIdentity || 'candidate identity'}`
        : 'missing retrieval feature item for candidate skillId',
  })
}

function sceneMatchDetails(
  item: SkillRetrievalFeatures | undefined,
  sceneHints: string[] | undefined,
): {
  key: string | null
  metric: SkillRetrievalAggregateMetric | null
  reason: string
} {
  const normalizedHints = (sceneHints ?? [])
    .map(normalizeSceneKey)
    .filter((hint): hint is string => hint !== null)

  if (!item) {
    return {
      key: null,
      metric: null,
      reason: 'missing retrieval feature item for candidate skillId',
    }
  }

  if (normalizedHints.length === 0) {
    return {
      key: null,
      metric: null,
      reason: 'request did not provide sceneHints',
    }
  }

  for (const hint of normalizedHints) {
    const match = item.scenes[hint]
    if (match) {
      return {
        key: hint,
        metric: match,
        reason: `matched scene aggregate ${hint}`,
      }
    }
  }

  return {
    key: null,
    metric: null,
    reason: `no scene aggregate matched hints: ${normalizedHints.join(', ')}`,
  }
}

export async function getSkillGraphFeatures(
  request: SkillGraphFeatureRequest,
  manifest?: SkillRetrievalFeaturesManifest | null,
): Promise<SkillGraphFeatureResponse> {
  const resolvedManifest =
    manifest === undefined ? await readSkillRetrievalFeatures() : manifest
  const itemsBySkillId = new Map(
    (resolvedManifest?.items ?? []).map(item => [item.skillId, item] as const),
  )
  const generatedAt = new Date().toISOString()
  const department = normalizeDepartmentKey(request.department)
  const items: SkillGraphFeatures[] = request.candidates.map(candidate => {
    const featureItem = itemsBySkillId.get(candidate.skillId)
    const globalFeature = featureItem?.global ?? null
    const versionFeature = featureItem
      ? normalizeCandidateVersionLookup(featureItem, candidate)
      : null
    const departmentFeature =
      featureItem && department ? featureItem.departments[department] ?? null : null
    const sceneDetails = sceneMatchDetails(featureItem, request.sceneHints)
    const sceneFeature = sceneDetails.metric

    const breakdown = {
      version: roundMetric(
        GRAPH_FEATURE_WEIGHTS.version *
          ((versionFeature?.qualityScore ?? 0) * (versionFeature?.confidence ?? 0)),
      ),
      global: roundMetric(
        GRAPH_FEATURE_WEIGHTS.global *
          ((globalFeature?.score ?? 0) * (globalFeature?.confidence ?? 0)),
      ),
      department: roundMetric(
        GRAPH_FEATURE_WEIGHTS.department *
          ((departmentFeature?.score ?? 0) * (departmentFeature?.confidence ?? 0)),
      ),
      scene: roundMetric(
        GRAPH_FEATURE_WEIGHTS.scene *
          ((sceneFeature?.score ?? 0) * (sceneFeature?.confidence ?? 0)),
      ),
    }
    const signals: SkillGraphFeatureSignalExplanation[] = [
      versionFeatureExplanation({
        feature: versionFeature,
        contribution: breakdown.version,
        requestedVersion: toStringValue(candidate.version ?? '') || null,
        requestedSourceHash: toStringValue(candidate.sourceHash ?? '') || null,
        featureItemExists: Boolean(featureItem),
      }),
      aggregateMetricExplanation({
        scope: 'global',
        weight: GRAPH_FEATURE_WEIGHTS.global,
        matchedKey: globalFeature ? 'global' : null,
        metric: globalFeature,
        contribution: breakdown.global,
        reason: globalFeature
          ? 'matched global aggregate'
          : featureItem
            ? 'missing global aggregate for candidate skillId'
            : 'missing retrieval feature item for candidate skillId',
      }),
      aggregateMetricExplanation({
        scope: 'department',
        weight: GRAPH_FEATURE_WEIGHTS.department,
        matchedKey: departmentFeature && department ? department : null,
        metric: departmentFeature,
        contribution: breakdown.department,
        reason: departmentFeature && department
          ? `matched department aggregate ${department}`
          : !featureItem
            ? 'missing retrieval feature item for candidate skillId'
            : department
              ? `no department aggregate matched ${department}`
              : 'request did not provide department',
      }),
      aggregateMetricExplanation({
        scope: 'scene',
        weight: GRAPH_FEATURE_WEIGHTS.scene,
        matchedKey: sceneDetails.key,
        metric: sceneFeature,
        contribution: breakdown.scene,
        reason: sceneDetails.reason,
      }),
    ]

    return {
      skillId: candidate.skillId,
      version: toStringValue(candidate.version ?? '') || null,
      sourceHash: toStringValue(candidate.sourceHash ?? '') || null,
      globalQualityScore: globalFeature?.score ?? null,
      globalConfidence: globalFeature?.confidence ?? null,
      versionQualityScore: versionFeature?.qualityScore ?? null,
      versionConfidence: versionFeature?.confidence ?? null,
      departmentScore: departmentFeature?.score ?? null,
      departmentConfidence: departmentFeature?.confidence ?? null,
      sceneScore: sceneFeature?.score ?? null,
      sceneConfidence: sceneFeature?.confidence ?? null,
      invocationCount:
        versionFeature?.invocationCount ?? globalFeature?.invocationCount ?? null,
      successRate: versionFeature?.successRate ?? globalFeature?.successRate ?? null,
      graphFeatureScore: graphFeatureScoreFromBreakdown(breakdown),
      graphFeatureBreakdown: breakdown,
      graphFeatureExplanation: {
        formula: GRAPH_FEATURE_SCORE_FORMULA,
        signals,
        missingSignals: signals
          .filter(signal => !signal.matched)
          .map(signal => `${signal.scope}: ${signal.reason}`),
      },
    }
  })

  return {
    schemaVersion: '2026-04-12',
    generatedAt,
    sourceFeaturesGeneratedAt: resolvedManifest?.generatedAt ?? null,
    items,
  }
}
