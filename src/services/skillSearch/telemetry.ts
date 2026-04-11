import { randomUUID } from 'crypto'
import { appendFile, mkdir, readFile, readdir } from 'fs/promises'
import { dirname, join } from 'path'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import { logForDebugging } from '../../utils/debug.js'
import { getSkillRegistryLocations } from './registry.js'

export type SkillTelemetryEventName =
  | 'skill_retrieval_run'
  | 'skill_exposed'
  | 'skill_selected'
  | 'skill_invoked'
  | 'skill_completed'
  | 'skill_failed'
  | 'skill_feedback'

export type SkillTelemetryMode = 'local' | 'off'

export type SkillCandidateTelemetry = {
  skillId: string
  name: string
  displayName: string
  version: string
  sourceHash: string
  domain: string
  departmentTags: string[]
  sceneTags: string[]
  rank?: number
  score?: number
  scoreBreakdown?: Record<string, number>
  retrievalSource?: string
}

export type SkillTelemetryEvent = {
  schemaVersion?: '2026-04-11'
  eventName: SkillTelemetryEventName
  eventId?: string
  traceId?: string
  runId?: string
  createdAt?: string
  cwd?: string
  department?: string | null
  scene?: string | null
  skillId?: string
  skillName?: string
  skillVersion?: string
  sourceHash?: string
  selectedBy?: 'model' | 'user' | 'system' | 'eval_oracle'
  payload?: Record<string, unknown>
}

export type SkillTelemetryMetadata = {
  skillId: string
  name: string
  displayName: string
  description: string
  version: string
  sourceHash: string
  domain: string
  departmentTags: string[]
  sceneTags: string[]
  skillPath: string
}

const metadataCache = new Map<string, Promise<SkillTelemetryMetadata | null>>()

function getTelemetryMode(): SkillTelemetryMode {
  const mode = process.env.SKILL_EVAL_TELEMETRY?.trim().toLowerCase()
  if (mode === 'off') return 'off'
  return 'local'
}

function getTelemetryFilePath(cwd?: string): string {
  const explicitPath = process.env.SKILL_EVAL_EVENTS_PATH?.trim()
  if (explicitPath) {
    return explicitPath
  }

  return join(cwd || process.cwd(), '.claude', 'skill-events', 'events.jsonl')
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

function normalizeSkillName(value: string): string {
  return value.trim().toLowerCase()
}

export function createSkillTelemetryTraceId(): string {
  return randomUUID()
}

export async function logSkillSearchTelemetry(
  event: SkillTelemetryEvent,
): Promise<void> {
  if (getTelemetryMode() === 'off') {
    return
  }

  const normalizedEvent = {
    schemaVersion: '2026-04-11',
    eventId: randomUUID(),
    runId: process.env.SKILL_EVAL_RUN_ID,
    createdAt: new Date().toISOString(),
    ...event,
  }

  const filePath = getTelemetryFilePath(event.cwd)

  try {
    await mkdir(dirname(filePath), { recursive: true })
    await appendFile(filePath, `${JSON.stringify(normalizedEvent)}\n`, 'utf-8')
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
  const normalizedName = normalizeSkillName(skillName)
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

async function resolveSkillTelemetryMetadataUncached(
  cwd: string,
  normalizedSkillName: string,
): Promise<SkillTelemetryMetadata | null> {
  for (const location of getSkillRegistryLocations(cwd)) {
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
          normalizeSkillName(name) !== normalizedSkillName &&
          normalizeSkillName(entry.name) !== normalizedSkillName &&
          normalizeSkillName(skillId) !== normalizedSkillName
        ) {
          continue
        }

        return {
          skillId: skillId || `${toStringValue(frontmatter.domain, 'general')}/${name}`,
          name,
          displayName: toStringValue(frontmatter.displayName, name),
          description: toStringValue(frontmatter.description),
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
