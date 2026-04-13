import { randomUUID } from 'crypto'
import { appendFile, mkdir, readFile, readdir } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  createSkillFactEvent,
  type SkillFactContext,
  type SkillFactEvent,
  type SkillFactFeedback,
  type SkillFactKind,
  type SkillFactOutcome,
  type SkillFactRetrieval,
  type SkillFactSource,
} from '../../../../skill-graph/src/events/skillFacts.js'
import {
  hasSkillFactPgConfig,
  insertSkillFactEvent,
  type SkillFactSinkMode,
} from '../../../../skill-graph/src/events/storage.js'
import { publishRefreshRequest } from '../../../../skill-graph/src/refresh/redis.js'
import {
  insertSkillFactEventAndRequestRefresh,
  resolveSkillGraphRefreshMode,
} from '../../../../skill-graph/src/refresh/storage.js'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import { logForDebugging } from '../../utils/debug.js'
import {
  getSkillRegistryLocations,
  readGeneratedSkillRegistry,
} from './registry.js'

export type SkillTelemetryMetadata = {
  skillId: string
  name: string
  displayName: string
  description: string
  aliases: string[]
  version: string
  sourceHash: string
  domain: string
  departmentTags: string[]
  sceneTags: string[]
  skillPath: string
}

export type SkillFactAttribution = {
  traceId: string
  taskId: string
  retrievalRoundId: string
}

export type DiscoveredSkillAttribution = SkillFactAttribution & {
  skillId?: string | null
  name?: string
  displayName?: string
  aliases?: string[]
  version?: string | null
  sourceHash?: string | null
  description?: string
  domain?: string
  departmentTags?: string[]
  sceneTags?: string[]
  retrievalSource?: string | null
  rank?: number | null
  finalScore?: number | null
}

type SkillFactBuildInput = {
  factKind: SkillFactKind
  source?: SkillFactSource | null
  cwd?: string | null
  projectId?: string | null
  department?: string | null
  scene?: string | null
  domain?: string | null
  taskId?: string | null
  traceId?: string | null
  retrievalRoundId?: string | null
  metadata?: SkillTelemetryMetadata | null
  skillId?: string | null
  skillName?: string | null
  skillVersion?: string | null
  sourceHash?: string | null
  retrieval?: Partial<SkillFactRetrieval> | null
  outcome?: Partial<SkillFactOutcome> | null
  feedback?: Partial<SkillFactFeedback> | null
  payload?: Record<string, unknown> | null
  resolutionError?: string | null
}

const metadataCache = new Map<string, Promise<SkillTelemetryMetadata | null>>()
const SKILL_GRAPH_EVENTS_DIR = fileURLToPath(
  new URL('../../../../skill-graph/data/events', import.meta.url),
)

export function resolveSkillFactSinkMode(): SkillFactSinkMode {
  const evalTelemetry = process.env.SKILL_EVAL_TELEMETRY?.trim().toLowerCase()
  if (evalTelemetry === 'off') {
    return 'off'
  }

  const explicitSink = process.env.SKILL_FACT_SINK?.trim().toLowerCase()
  if (
    explicitSink === 'postgres' ||
    explicitSink === 'jsonl' ||
    explicitSink === 'off'
  ) {
    return explicitSink
  }

  return hasSkillFactPgConfig() ? 'postgres' : 'jsonl'
}

function getTelemetryFilePath(cwd?: string): string {
  const explicitPath =
    process.env.SKILL_FACT_EVENTS_PATH?.trim() ??
    process.env.SKILL_EVAL_EVENTS_PATH?.trim()
  if (explicitPath) {
    return explicitPath
  }

  const explicitDir = process.env.SKILL_FACT_EVENTS_DIR?.trim()
  if (explicitDir) {
    return join(explicitDir, 'events.jsonl')
  }

  return join(SKILL_GRAPH_EVENTS_DIR, 'events.jsonl')
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }

  return []
}

function normalizeSkillLookupKey(value: string): string {
  return value.trim().toLowerCase()
}

function toResolutionError(metadata: SkillTelemetryMetadata | null): string | null {
  if (!metadata) {
    return 'skill_metadata_not_found'
  }

  if (!metadata.skillId || !metadata.version || !metadata.sourceHash) {
    return 'skill_identity_incomplete'
  }

  return null
}

function inferBuildResolutionError(
  factKind: SkillFactKind,
  metadata: SkillTelemetryMetadata | null,
  identity: {
    skillId: string | null
    skillVersion: string | null
    sourceHash: string | null
  },
  resolutionError?: string | null,
): string | null {
  if (resolutionError) {
    return resolutionError
  }

  if (identity.skillId && identity.skillVersion && identity.sourceHash) {
    return null
  }

  if (factKind === 'retrieval_run' || factKind === 'eval_outcome') {
    return null
  }

  return toResolutionError(metadata)
}

function lookupKeysForMetadata(
  metadata: Pick<SkillTelemetryMetadata, 'skillId' | 'name' | 'displayName' | 'aliases'>,
): string[] {
  return [
    metadata.skillId,
    metadata.name,
    metadata.displayName,
    ...metadata.aliases,
  ]
    .map(normalizeSkillLookupKey)
    .filter(Boolean)
}

export function createSkillTelemetryTraceId(): string {
  return randomUUID()
}

export function createSkillFactAttribution(
  taskId?: string | null,
  traceId?: string | null,
  retrievalRoundId?: string | null,
): SkillFactAttribution {
  const normalizedTraceId = traceId?.trim() || randomUUID()
  return {
    traceId: normalizedTraceId,
    taskId: taskId?.trim() || normalizedTraceId,
    retrievalRoundId: retrievalRoundId?.trim() || normalizedTraceId,
  }
}

export function rememberDiscoveredSkillAttribution(
  map: Map<string, DiscoveredSkillAttribution> | undefined,
  metadata: Pick<SkillTelemetryMetadata, 'skillId' | 'name' | 'displayName' | 'aliases'>,
  attribution: SkillFactAttribution,
  extra: Omit<DiscoveredSkillAttribution, keyof SkillFactAttribution> = {},
): void {
  if (!map) {
    return
  }

  const value: DiscoveredSkillAttribution = {
    ...attribution,
    ...extra,
    skillId: extra.skillId ?? metadata.skillId,
    name: extra.name ?? metadata.name,
    displayName: extra.displayName ?? metadata.displayName,
    aliases: extra.aliases ?? metadata.aliases,
  }

  for (const key of lookupKeysForMetadata(metadata)) {
    map.set(key, value)
  }
}

export function resolveDiscoveredSkillAttribution(
  map: Map<string, DiscoveredSkillAttribution> | undefined,
  skillName: string,
): DiscoveredSkillAttribution | null {
  if (!map) {
    return null
  }

  return map.get(normalizeSkillLookupKey(skillName)) ?? null
}

export function metadataFromDiscoveredSkill(
  discovered: DiscoveredSkillAttribution | null,
  fallbackName: string,
): SkillTelemetryMetadata | null {
  if (!discovered?.skillId || !discovered.version || !discovered.sourceHash) {
    return null
  }

  return {
    skillId: discovered.skillId,
    name: discovered.name ?? fallbackName,
    displayName: discovered.displayName ?? discovered.name ?? fallbackName,
    description: discovered.description ?? '',
    aliases: discovered.aliases ?? [],
    version: discovered.version,
    sourceHash: discovered.sourceHash,
    domain: discovered.domain ?? 'general',
    departmentTags: discovered.departmentTags ?? [],
    sceneTags: discovered.sceneTags ?? [],
    skillPath: '',
  }
}

export function buildSkillFactEvent(
  input: SkillFactBuildInput,
): SkillFactEvent {
  const metadata = input.metadata ?? null
  const identity = {
    skillId: input.skillId ?? metadata?.skillId ?? null,
    skillVersion: input.skillVersion ?? metadata?.version ?? null,
    sourceHash: input.sourceHash ?? metadata?.sourceHash ?? null,
  }
  const context: Partial<SkillFactContext> = {
    cwd: input.cwd ?? null,
    projectId: input.projectId ?? null,
    department: input.department ?? null,
    scene: input.scene ?? null,
    domain: input.domain ?? metadata?.domain ?? null,
  }

  return createSkillFactEvent({
    factKind: input.factKind,
    source: input.source ?? null,
    runId: process.env.SKILL_EVAL_RUN_ID ?? null,
    traceId: input.traceId ?? null,
    taskId: input.taskId ?? null,
    retrievalRoundId: input.retrievalRoundId ?? null,
    skillId: identity.skillId,
    skillName: metadata?.name ?? input.skillName ?? null,
    skillVersion: identity.skillVersion,
    sourceHash: identity.sourceHash,
    context,
    retrieval: input.retrieval ?? null,
    outcome: input.outcome ?? null,
    feedback: input.feedback ?? null,
    resolutionError: inferBuildResolutionError(
      input.factKind,
      metadata,
      identity,
      input.resolutionError,
    ),
    payload: input.payload ?? null,
  })
}

export async function logSkillFactEvent(event: SkillFactEvent): Promise<void> {
  const sinkMode = resolveSkillFactSinkMode()
  if (sinkMode === 'off') {
    return
  }

  const filePath = getTelemetryFilePath(event.context.cwd ?? undefined)

  if (sinkMode === 'postgres') {
    try {
      const refreshMode = resolveSkillGraphRefreshMode()
      if (refreshMode === 'legacy') {
        await insertSkillFactEvent(event)
        return
      }

      const { request } = await insertSkillFactEventAndRequestRefresh(event)

      try {
        await publishRefreshRequest(request)
      } catch (error) {
        logForDebugging(
          `[skill-telemetry] failed to publish refresh request ${request.jobKey}: ${error}`,
          {
            level: 'warn',
          },
        )
      }

      return
    } catch (error) {
      logForDebugging(
        `[skill-telemetry] failed to write PostgreSQL skill fact event ${event.eventId}: ${error}`,
        {
          level: 'warn',
        },
      )
    }
  }

  try {
    await mkdir(dirname(filePath), { recursive: true })
    await appendFile(filePath, `${JSON.stringify(event)}\n`, 'utf-8')
  } catch (error) {
    logForDebugging(`[skill-telemetry] failed to write ${filePath}: ${error}`, {
      level: 'warn',
    })
  }
}

export async function resolveSkillTelemetryMetadata(
  cwd: string,
  skillName: string,
): Promise<SkillTelemetryMetadata | null> {
  const normalizedName = normalizeSkillLookupKey(skillName)
  if (!normalizedName) {
    return null
  }

  const cacheKey = `${cwd}\n${normalizedName}`
  const cached = metadataCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const loadingPromise = resolveSkillTelemetryMetadataUncached(
    cwd,
    normalizedName,
  )
  metadataCache.set(cacheKey, loadingPromise)
  return loadingPromise
}

export async function resolveSkillTelemetryMetadataWithError(
  cwd: string,
  skillName: string,
): Promise<{
  metadata: SkillTelemetryMetadata | null
  resolutionError: string | null
}> {
  const metadata = await resolveSkillTelemetryMetadata(cwd, skillName)
  return {
    metadata,
    resolutionError: toResolutionError(metadata),
  }
}

async function resolveSkillTelemetryMetadataUncached(
  cwd: string,
  normalizedSkillName: string,
): Promise<SkillTelemetryMetadata | null> {
  for (const location of getSkillRegistryLocations(cwd)) {
    const generatedRegistry = await readGeneratedSkillRegistry(location.dir)
    if (generatedRegistry && generatedRegistry.skills.length > 0) {
      for (const skill of generatedRegistry.skills) {
        if (
          normalizeSkillLookupKey(skill.name) !== normalizedSkillName &&
          normalizeSkillLookupKey(skill.skillId) !== normalizedSkillName &&
          normalizeSkillLookupKey(skill.displayName) !== normalizedSkillName &&
          !skill.aliases.some(
            alias => normalizeSkillLookupKey(alias) === normalizedSkillName,
          )
        ) {
          continue
        }

        return {
          skillId: skill.skillId,
          name: skill.name,
          displayName: skill.displayName,
          description: skill.description,
          aliases: skill.aliases,
          version: skill.version,
          sourceHash: skill.sourceHash,
          domain: skill.domain,
          departmentTags: skill.departmentTags,
          sceneTags: skill.sceneTags,
          skillPath: join(location.dir, skill.skillFile),
        }
      }
    }

    let entries
    try {
      entries = await readdir(location.dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) {
        continue
      }

      const skillPath = join(location.dir, entry.name, 'SKILL.md')
      try {
        const raw = await readFile(skillPath, 'utf-8')
        const { frontmatter } = parseFrontmatter(raw, skillPath)
        const name = toStringValue(frontmatter.name, entry.name)
        const skillId = toStringValue(frontmatter.skillId)

        if (
          normalizeSkillLookupKey(name) !== normalizedSkillName &&
          normalizeSkillLookupKey(entry.name) !== normalizedSkillName &&
          normalizeSkillLookupKey(skillId) !== normalizedSkillName
        ) {
          continue
        }

        return {
          skillId: skillId || `${toStringValue(frontmatter.domain, 'general')}/${name}`,
          name,
          displayName: toStringValue(frontmatter.displayName, name),
          description: toStringValue(frontmatter.description),
          aliases: toStringArray(frontmatter.aliases),
          version: toStringValue(frontmatter.version, '0.0.0'),
          sourceHash: toStringValue(frontmatter.sourceHash),
          domain: toStringValue(frontmatter.domain, 'general'),
          departmentTags: toStringArray(frontmatter.departmentTags),
          sceneTags: toStringArray(frontmatter.sceneTags),
          skillPath,
        }
      } catch {
        continue
      }
    }
  }

  return null
}

export function clearSkillTelemetryMetadataCache(): void {
  metadataCache.clear()
}
