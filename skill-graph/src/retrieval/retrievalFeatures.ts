import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import type {
  SkillFeedbackAggregate,
  SkillFeedbackAggregateManifest,
  SkillFactAggregationEventFilter,
} from '../aggregates/skillFactAggregates.js'
import {
  buildSkillFactAggregates,
  readSkillFactEventsForAggregation,
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
  projectId?: string | null
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
  feedbackCount: number
  explicitPositiveCount: number
  explicitNegativeCount: number
  preferenceScore: number
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
  feedbackCount: number
  explicitPositiveCount: number
  explicitNegativeCount: number
  preferenceScore: number
  updatedAt: string
}

export type SkillRetrievalFeatureScoring = {
  graphFeatureScoreFormula: string
  finalScoreFormula: string
  graphFeatureWeights: {
    project: number
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
  projects: Record<string, SkillRetrievalAggregateMetric>
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
  scope: 'project' | 'global' | 'version' | 'department' | 'scene'
  weight: number
  matched: boolean
  matchedKey: string | null
  qualityScore: number | null
  confidence: number | null
  preferenceScore: number | null
  feedbackCount: number | null
  explicitPositiveCount: number | null
  explicitNegativeCount: number | null
  sampleCount: number | null
  invocationCount: number | null
  successRate: number | null
  qualityContribution: number
  preferenceContribution: number
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
  projectScore: number | null
  projectConfidence: number | null
  projectPreferenceScore: number | null
  globalQualityScore: number | null
  globalConfidence: number | null
  globalPreferenceScore: number | null
  versionQualityScore: number | null
  versionConfidence: number | null
  versionPreferenceScore: number | null
  departmentScore: number | null
  departmentConfidence: number | null
  departmentPreferenceScore: number | null
  sceneScore: number | null
  sceneConfidence: number | null
  scenePreferenceScore: number | null
  invocationCount: number | null
  successRate: number | null
  qualityFeatureScore: number
  preferenceFeatureScore: number
  graphFeatureScore: number
  graphFeatureBreakdown: {
    project: number
    global: number
    version: number
    department: number
    scene: number
  }
  qualityFeatureBreakdown: {
    project: number
    global: number
    version: number
    department: number
    scene: number
  }
  preferenceFeatureBreakdown: {
    project: number
    global: number
    version: number
    department: number
    scene: number
  }
  graphFeatureExplanation: SkillGraphFeatureExplanation
}

export type SkillGraphFeatureRequest = Pick<
  SkillRetrievalRequest,
  'queryText' | 'projectId' | 'department' | 'domainHints' | 'sceneHints'
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
export const GENERATED_SKILL_RETRIEVAL_FEATURES_LIVE_FILE =
  'skill-retrieval-features.live.json'
export const GENERATED_SKILL_RETRIEVAL_FEATURES_EXPERIMENT_FILE =
  'skill-retrieval-features.experiment.json'

const GRAPH_FEATURE_WEIGHTS = {
  project: 0.4,
  scene: 0.25,
  department: 0.15,
  version: 0.1,
  global: 0.1,
} as const

const GRAPH_FEATURE_SCORE_FORMULA =
  'qualityRawScore = contextMatched ? 0.40 * project(qualityScore * confidence) + 0.25 * scene(qualityScore * confidence) + 0.15 * department(qualityScore * confidence) + 0.10 * version(qualityScore * confidence) + 0.10 * global(qualityScore * confidence) : 0; preferenceRawScore = contextMatched ? 0.40 * project(preferenceScore) + 0.25 * scene(preferenceScore) + 0.15 * department(preferenceScore) + 0.10 * version(preferenceScore) + 0.10 * global(preferenceScore) : 0'

export type SkillRetrievalFeatureBuildPreset = 'canonical' | 'live' | 'experiment'

export const RETRIEVAL_FEATURE_SCORING: SkillRetrievalFeatureScoring = {
  graphFeatureScoreFormula: GRAPH_FEATURE_SCORE_FORMULA,
  finalScoreFormula:
    'finalScore = recallNormalized + qualityBonus + preferenceBonus',
  graphFeatureWeights: { ...GRAPH_FEATURE_WEIGHTS },
  graphFeatureInputs: [
    'project aggregate matched from request.projectId',
    'scene aggregate matched from request.sceneHints in order',
    'department aggregate matched from request.department',
    'version aggregate keyed by skillId + version + sourceHash',
    'global aggregate keyed by skillId',
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
const DEFAULT_LIVE_OUTPUT_FILE = join(
  PROJECT_ROOT,
  'data',
  'aggregates',
  GENERATED_SKILL_RETRIEVAL_FEATURES_LIVE_FILE,
)
const DEFAULT_EXPERIMENT_OUTPUT_FILE = join(
  PROJECT_ROOT,
  'data',
  'aggregates',
  GENERATED_SKILL_RETRIEVAL_FEATURES_EXPERIMENT_FILE,
)
const DEFAULT_CANONICAL_EXCLUDED_RUN_ID_PREFIXES = [
  'seed-',
  'offline-retrieval-',
  'graph-uplift-',
  'teamcc-sandbox-blind-',
  'replay-diagnosis-',
]
const DEFAULT_RUNTIME_EXCLUDED_RUN_ID_PREFIXES = [
  'offline-retrieval-',
  'graph-uplift-',
  'teamcc-sandbox-blind-',
  'replay-diagnosis-',
]

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

function clamp(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}

function normalizeDepartmentKey(value: string | null | undefined): string | null {
  const trimmed = toStringValue(value)
  if (!trimmed) {
    return null
  }

  return trimmed.startsWith('dept:') ? trimmed.slice(5) : trimmed
}

function normalizeProjectKey(value: string | null | undefined): string | null {
  return toStringValue(value) || null
}

function normalizeSceneKey(value: string | null | undefined): string | null {
  const trimmed = toStringValue(value)
  if (!trimmed) {
    return null
  }

  return trimmed.startsWith('scene:') ? trimmed.slice(6) : trimmed
}

export function factFilterForRetrievalFeaturePreset(
  preset: SkillRetrievalFeatureBuildPreset,
): SkillFactAggregationEventFilter {
  if (preset === 'experiment') {
    return {
      excludeRunIdPrefixes: DEFAULT_RUNTIME_EXCLUDED_RUN_ID_PREFIXES,
      excludeRunIds: ['seed-scene-quality-v1'],
    }
  }

  return {
    excludeSources: ['eval_runner'],
    excludeRunIdPrefixes: DEFAULT_CANONICAL_EXCLUDED_RUN_ID_PREFIXES,
  }
}

export function outputFilesForRetrievalFeaturePreset(
  preset: SkillRetrievalFeatureBuildPreset,
): string[] {
  if (preset === 'experiment') {
    return [DEFAULT_EXPERIMENT_OUTPUT_FILE]
  }

  return preset === 'live'
    ? [DEFAULT_LIVE_OUTPUT_FILE]
    : [DEFAULT_OUTPUT_FILE, DEFAULT_LIVE_OUTPUT_FILE]
}

function makeVersionKey(skillId: string, version: string, sourceHash: string): string {
  return `${skillId}@${version}#${sourceHash.slice(0, 12)}`
}

function preferenceScoreFromAggregate(
  aggregate: Pick<
    SkillFeedbackAggregate,
    'explicitPositiveCount' | 'explicitNegativeCount' | 'feedbackCount' | 'confidence'
  >,
): number {
  if (aggregate.feedbackCount <= 0) {
    return 0
  }

  const netPositive =
    (aggregate.explicitPositiveCount - aggregate.explicitNegativeCount) /
    Math.max(aggregate.feedbackCount, 1)
  const positiveSignal = clamp(netPositive)
  const feedbackConfidence = clamp(
    Math.log1p(aggregate.feedbackCount) / Math.log1p(6),
  )

  return roundMetric(
    clamp(positiveSignal * feedbackConfidence * clamp(aggregate.confidence)),
  )
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
    feedbackCount: aggregate.feedbackCount,
    explicitPositiveCount: aggregate.explicitPositiveCount,
    explicitNegativeCount: aggregate.explicitNegativeCount,
    preferenceScore: preferenceScoreFromAggregate(aggregate),
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
    feedbackCount: aggregate.feedbackCount,
    explicitPositiveCount: aggregate.explicitPositiveCount,
    explicitNegativeCount: aggregate.explicitNegativeCount,
    preferenceScore: preferenceScoreFromAggregate(aggregate),
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
  const feedbackCount = toNumberValue(value.feedbackCount) ?? 0
  const explicitPositiveCount = toNumberValue(value.explicitPositiveCount) ?? 0
  const explicitNegativeCount = toNumberValue(value.explicitNegativeCount) ?? 0
  const preferenceScore = toNumberValue(value.preferenceScore) ?? 0
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
    feedbackCount,
    explicitPositiveCount,
    explicitNegativeCount,
    preferenceScore,
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
  const feedbackCount = toNumberValue(value.feedbackCount) ?? 0
  const explicitPositiveCount = toNumberValue(value.explicitPositiveCount) ?? 0
  const explicitNegativeCount = toNumberValue(value.explicitNegativeCount) ?? 0
  const preferenceScore = toNumberValue(value.preferenceScore) ?? 0

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
    feedbackCount,
    explicitPositiveCount,
    explicitNegativeCount,
    preferenceScore,
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
    projects: parseMetricMap(value.projects),
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
    const projectAggregates = findAggregateByScope(
      aggregates,
      'project',
      aggregate => aggregate.skillId === skill.skillId && Boolean(aggregate.projectId),
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
      projects: Object.fromEntries(
        projectAggregates
          .filter(aggregate => aggregate.projectId)
          .map(aggregate => [
            aggregate.projectId as string,
            featureMetricFromAggregate(aggregate),
          ]),
      ),
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
  filePath = DEFAULT_OUTPUT_FILE,
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

export type WriteSkillRetrievalFeaturesOptions = {
  preset?: SkillRetrievalFeatureBuildPreset
  outputFiles?: string[]
  aggregateManifest?: SkillFeedbackAggregateManifest | null
  aggregateFilePath?: string
  registryManifest?: SkillRegistryManifest | null
  windowDays?: number
  targetSampleCount?: number
  now?: string
  factFilter?: SkillFactAggregationEventFilter
}

async function resolveAggregateManifestForWrite(
  options: WriteSkillRetrievalFeaturesOptions,
): Promise<SkillFeedbackAggregateManifest | null> {
  if (options.aggregateManifest !== undefined) {
    return options.aggregateManifest
  }

  if (options.aggregateFilePath) {
    return readAggregateManifestFromFile(options.aggregateFilePath)
  }

  const preset = options.preset ?? 'canonical'
  const events = await readSkillFactEventsForAggregation({
    windowDays: options.windowDays,
    factFilter: options.factFilter ?? factFilterForRetrievalFeaturePreset(preset),
  })

  return buildSkillFactAggregates(events, {
    windowDays: options.windowDays,
    targetSampleCount: options.targetSampleCount,
    now: options.now,
  })
}

export async function writeSkillRetrievalFeatures(
  options: WriteSkillRetrievalFeaturesOptions = {},
): Promise<SkillRetrievalFeaturesManifest> {
  const [aggregateManifest, registryManifest] = await Promise.all([
    resolveAggregateManifestForWrite(options),
    options.registryManifest === undefined
      ? readSkillRegistry(PROJECT_ROOT)
      : Promise.resolve(options.registryManifest),
  ])
  const manifest = buildSkillRetrievalFeatures(aggregateManifest, registryManifest)
  const preset = options.preset ?? 'canonical'
  const outputFiles =
    options.outputFiles && options.outputFiles.length > 0
      ? options.outputFiles
      : outputFilesForRetrievalFeaturePreset(preset)

  for (const outputFile of outputFiles) {
    await mkdir(dirname(outputFile), { recursive: true })
    await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
  }

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
  project: number
  global: number
  version: number
  department: number
  scene: number
}): number {
  return roundMetric(
    breakdown.project +
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
  preferenceScore: number | null
  feedbackCount: number | null
  explicitPositiveCount: number | null
  explicitNegativeCount: number | null
  sampleCount: number | null
  invocationCount: number | null
  successRate: number | null
  qualityContribution: number
  preferenceContribution: number
  reason: string
}): SkillGraphFeatureSignalExplanation {
  return {
    scope: options.scope,
    weight: options.weight,
    matched: options.matchedKey !== null,
    matchedKey: options.matchedKey,
    qualityScore: options.qualityScore,
    confidence: options.confidence,
    preferenceScore: options.preferenceScore,
    feedbackCount: options.feedbackCount,
    explicitPositiveCount: options.explicitPositiveCount,
    explicitNegativeCount: options.explicitNegativeCount,
    sampleCount: options.sampleCount,
    invocationCount: options.invocationCount,
    successRate: options.successRate,
    qualityContribution: roundMetric(options.qualityContribution),
    preferenceContribution: roundMetric(options.preferenceContribution),
    weightedContribution: roundMetric(
      options.qualityContribution + options.preferenceContribution,
    ),
    reason: options.reason,
  }
}

function aggregateMetricExplanation(options: {
  scope: SkillGraphFeatureSignalExplanation['scope']
  weight: number
  matchedKey: string | null
  metric: SkillRetrievalAggregateMetric | null
  qualityContribution: number
  preferenceContribution: number
  reason: string
}): SkillGraphFeatureSignalExplanation {
  return signalExplanation({
    scope: options.scope,
    weight: options.weight,
    matchedKey: options.matchedKey,
    qualityScore: options.metric?.score ?? null,
    confidence: options.metric?.confidence ?? null,
    preferenceScore: options.metric?.preferenceScore ?? null,
    feedbackCount: options.metric?.feedbackCount ?? null,
    explicitPositiveCount: options.metric?.explicitPositiveCount ?? null,
    explicitNegativeCount: options.metric?.explicitNegativeCount ?? null,
    sampleCount: options.metric?.sampleCount ?? null,
    invocationCount: options.metric?.invocationCount ?? null,
    successRate: options.metric?.successRate ?? null,
    qualityContribution: options.qualityContribution,
    preferenceContribution: options.preferenceContribution,
    reason: options.reason,
  })
}

function versionFeatureExplanation(options: {
  feature: SkillRetrievalVersionFeature | null
  qualityContribution: number
  preferenceContribution: number
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
    preferenceScore: options.feature?.preferenceScore ?? null,
    feedbackCount: options.feature?.feedbackCount ?? null,
    explicitPositiveCount: options.feature?.explicitPositiveCount ?? null,
    explicitNegativeCount: options.feature?.explicitNegativeCount ?? null,
    sampleCount: options.feature?.sampleCount ?? null,
    invocationCount: options.feature?.invocationCount ?? null,
    successRate: options.feature?.successRate ?? null,
    qualityContribution: options.qualityContribution,
    preferenceContribution: options.preferenceContribution,
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

function projectMatchDetails(
  item: SkillRetrievalFeatures | undefined,
  projectId: string | null | undefined,
): {
  key: string | null
  metric: SkillRetrievalAggregateMetric | null
  reason: string
} {
  const normalizedProjectId = normalizeProjectKey(projectId)

  if (!item) {
    return {
      key: null,
      metric: null,
      reason: 'missing retrieval feature item for candidate skillId',
    }
  }

  if (!normalizedProjectId) {
    return {
      key: null,
      metric: null,
      reason: 'request did not provide projectId',
    }
  }

  const metric = item.projects[normalizedProjectId] ?? null
  return {
    key: metric ? normalizedProjectId : null,
    metric,
    reason: metric
      ? `matched project aggregate ${normalizedProjectId}`
      : `no project aggregate matched ${normalizedProjectId}`,
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
  const projectId = normalizeProjectKey(request.projectId)
  const department = normalizeDepartmentKey(request.department)
  const items: SkillGraphFeatures[] = request.candidates.map(candidate => {
    const featureItem = itemsBySkillId.get(candidate.skillId)
    const projectDetails = projectMatchDetails(featureItem, projectId)
    const projectFeature = projectDetails.metric
    const globalFeature = featureItem?.global ?? null
    const versionFeature = featureItem
      ? normalizeCandidateVersionLookup(featureItem, candidate)
      : null
    const departmentFeature =
      featureItem && department ? featureItem.departments[department] ?? null : null
    const sceneDetails = sceneMatchDetails(featureItem, request.sceneHints)
    const sceneFeature = sceneDetails.metric
    const hasContextMatch = Boolean(projectFeature || departmentFeature || sceneFeature)

    const qualityBreakdown = {
      project: roundMetric(
        GRAPH_FEATURE_WEIGHTS.project *
          ((projectFeature?.score ?? 0) * (projectFeature?.confidence ?? 0)),
      ),
      scene: roundMetric(
        GRAPH_FEATURE_WEIGHTS.scene *
          ((sceneFeature?.score ?? 0) * (sceneFeature?.confidence ?? 0)),
      ),
      department: roundMetric(
        GRAPH_FEATURE_WEIGHTS.department *
          ((departmentFeature?.score ?? 0) * (departmentFeature?.confidence ?? 0)),
      ),
      version: roundMetric(
        hasContextMatch
          ? GRAPH_FEATURE_WEIGHTS.version *
              ((versionFeature?.qualityScore ?? 0) * (versionFeature?.confidence ?? 0))
          : 0,
      ),
      global: roundMetric(
        hasContextMatch
          ? GRAPH_FEATURE_WEIGHTS.global *
              ((globalFeature?.score ?? 0) * (globalFeature?.confidence ?? 0))
          : 0,
      ),
    }
    const preferenceBreakdown = {
      project: roundMetric(
        hasContextMatch
          ? GRAPH_FEATURE_WEIGHTS.project * (projectFeature?.preferenceScore ?? 0)
          : 0,
      ),
      scene: roundMetric(
        hasContextMatch
          ? GRAPH_FEATURE_WEIGHTS.scene * (sceneFeature?.preferenceScore ?? 0)
          : 0,
      ),
      department: roundMetric(
        hasContextMatch
          ? GRAPH_FEATURE_WEIGHTS.department *
              (departmentFeature?.preferenceScore ?? 0)
          : 0,
      ),
      version: roundMetric(
        hasContextMatch
          ? GRAPH_FEATURE_WEIGHTS.version * (versionFeature?.preferenceScore ?? 0)
          : 0,
      ),
      global: roundMetric(
        hasContextMatch
          ? GRAPH_FEATURE_WEIGHTS.global * (globalFeature?.preferenceScore ?? 0)
          : 0,
      ),
    }
    const breakdown = {
      project: roundMetric(qualityBreakdown.project + preferenceBreakdown.project),
      scene: roundMetric(qualityBreakdown.scene + preferenceBreakdown.scene),
      department: roundMetric(
        qualityBreakdown.department + preferenceBreakdown.department,
      ),
      version: roundMetric(qualityBreakdown.version + preferenceBreakdown.version),
      global: roundMetric(qualityBreakdown.global + preferenceBreakdown.global),
    }
    const signals: SkillGraphFeatureSignalExplanation[] = [
      aggregateMetricExplanation({
        scope: 'project',
        weight: GRAPH_FEATURE_WEIGHTS.project,
        matchedKey: projectDetails.key,
        metric: projectFeature,
        qualityContribution: qualityBreakdown.project,
        preferenceContribution: preferenceBreakdown.project,
        reason: projectDetails.reason,
      }),
      versionFeatureExplanation({
        feature: versionFeature,
        qualityContribution: qualityBreakdown.version,
        preferenceContribution: preferenceBreakdown.version,
        requestedVersion: toStringValue(candidate.version ?? '') || null,
        requestedSourceHash: toStringValue(candidate.sourceHash ?? '') || null,
        featureItemExists: Boolean(featureItem),
      }),
      aggregateMetricExplanation({
        scope: 'global',
        weight: GRAPH_FEATURE_WEIGHTS.global,
        matchedKey: globalFeature ? 'global' : null,
        metric: globalFeature,
        qualityContribution: qualityBreakdown.global,
        preferenceContribution: preferenceBreakdown.global,
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
        qualityContribution: qualityBreakdown.department,
        preferenceContribution: preferenceBreakdown.department,
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
        qualityContribution: qualityBreakdown.scene,
        preferenceContribution: preferenceBreakdown.scene,
        reason: sceneDetails.reason,
      }),
    ]

    return {
      skillId: candidate.skillId,
      version: toStringValue(candidate.version ?? '') || null,
      sourceHash: toStringValue(candidate.sourceHash ?? '') || null,
      projectScore: projectFeature?.score ?? null,
      projectConfidence: projectFeature?.confidence ?? null,
      projectPreferenceScore: projectFeature?.preferenceScore ?? null,
      globalQualityScore: globalFeature?.score ?? null,
      globalConfidence: globalFeature?.confidence ?? null,
      globalPreferenceScore: globalFeature?.preferenceScore ?? null,
      versionQualityScore: versionFeature?.qualityScore ?? null,
      versionConfidence: versionFeature?.confidence ?? null,
      versionPreferenceScore: versionFeature?.preferenceScore ?? null,
      departmentScore: departmentFeature?.score ?? null,
      departmentConfidence: departmentFeature?.confidence ?? null,
      departmentPreferenceScore: departmentFeature?.preferenceScore ?? null,
      sceneScore: sceneFeature?.score ?? null,
      sceneConfidence: sceneFeature?.confidence ?? null,
      scenePreferenceScore: sceneFeature?.preferenceScore ?? null,
      invocationCount:
        versionFeature?.invocationCount ?? globalFeature?.invocationCount ?? null,
      successRate: versionFeature?.successRate ?? globalFeature?.successRate ?? null,
      qualityFeatureScore: hasContextMatch
        ? graphFeatureScoreFromBreakdown(qualityBreakdown)
        : 0,
      preferenceFeatureScore: hasContextMatch
        ? graphFeatureScoreFromBreakdown(preferenceBreakdown)
        : 0,
      graphFeatureScore: hasContextMatch ? graphFeatureScoreFromBreakdown(breakdown) : 0,
      graphFeatureBreakdown: breakdown,
      qualityFeatureBreakdown: qualityBreakdown,
      preferenceFeatureBreakdown: preferenceBreakdown,
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
