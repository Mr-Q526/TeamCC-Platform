import { randomUUID } from 'crypto'
import { mkdir, readFile, readdir, writeFile, appendFile } from 'fs/promises'
import { dirname, join, relative, resolve } from 'path'
import YAML from 'yaml'
import type {
  SkillEvalCase,
  SkillEvalMode,
  SkillEvalRunManifest,
  SkillSandboxEvalCase,
  SkillRetrievalEvalCase,
} from './types.js'

export function createEvalRunId(mode: SkillEvalMode): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${mode}-${timestamp}-${randomUUID().slice(0, 8)}`
}

async function listCaseFilesRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async entry => {
      const nextPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        return listCaseFilesRecursive(nextPath)
      }
      if (entry.isFile() && /\.(json|ya?ml)$/i.test(entry.name)) {
        return [nextPath]
      }
      return []
    }),
  )

  return files.flat().sort()
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
    : []
}

function toNullableNumber(value: unknown, fallback: number | null = null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeRetrievalCase(value: Record<string, unknown>): SkillRetrievalEvalCase {
  const query = toRecord(value.query)
  const expected = toRecord(value.expected)
  const preference = toRecord(expected.preference)
  const modeOverridesRecord = toRecord(value.modeOverrides)
  const requestedModes: Array<'bm25' | 'bm25_vector' | 'bm25_vector_graph'> = [
    'bm25',
    'bm25_vector',
    'bm25_vector_graph',
  ]

  return {
    schemaVersion: '2026-04-12',
    caseType: 'retrieval',
    caseId: toStringValue(value.caseId) ?? 'unknown-case',
    title: toStringValue(value.title) ?? toStringValue(value.caseId) ?? 'Untitled retrieval case',
    dataset: toStringValue(value.dataset),
    tags: toStringArray(value.tags),
    query: {
      queryText: toStringValue(query.queryText) ?? '',
      queryContext: toStringValue(query.queryContext),
      cwd: toStringValue(query.cwd),
      projectId: toStringValue(query.projectId),
      department: toStringValue(query.department),
      domainHints: toStringArray(query.domainHints),
      sceneHints: toStringArray(query.sceneHints),
      priorInjectedSkillIds: toStringArray(query.priorInjectedSkillIds),
      priorInvokedSkillIds: toStringArray(query.priorInvokedSkillIds),
      limit: toNullableNumber(query.limit, null),
    },
    expected: {
      mustHitSkillIds: toStringArray(expected.mustHitSkillIds),
      acceptableSkillIds: toStringArray(expected.acceptableSkillIds),
      forbiddenSkillIds: toStringArray(expected.forbiddenSkillIds),
      preference:
        Object.keys(preference).length > 0 &&
        toStringValue(preference.preferredSkillId) &&
        toStringValue(preference.competingSkillId)
          ? {
              preferredSkillId: toStringValue(preference.preferredSkillId) as string,
              competingSkillId: toStringValue(preference.competingSkillId) as string,
              expectedDirection:
                preference.expectedDirection === 'preferred_above_competitor'
                  ? 'preferred_above_competitor'
                  : 'preferred_above_competitor',
            }
          : null,
    },
    modeOverrides: Object.keys(modeOverridesRecord).length
      ? Object.fromEntries(
          requestedModes.map(mode => {
            const config = toRecord(modeOverridesRecord[mode])
            return [
              mode,
              {
                disabled: Boolean(config.disabled),
                note: toStringValue(config.note),
              },
            ]
          }),
        )
      : null,
  }
}

function normalizeSandboxCase(value: Record<string, unknown>): SkillSandboxEvalCase {
  const projectSeed = toRecord(value.projectSeed)
  const expected = toRecord(value.expected)
  const verification = toRecord(value.verification)
  const execution = toRecord(value.execution)
  const judge = toRecord(value.judge)

  return {
    schemaVersion: '2026-04-12',
    caseType: 'sandbox',
    caseId: toStringValue(value.caseId) ?? 'unknown-case',
    title: toStringValue(value.title) ?? toStringValue(value.caseId) ?? 'Untitled sandbox case',
    dataset: toStringValue(value.dataset),
    tags: toStringArray(value.tags),
    sandboxId: toStringValue(value.sandboxId) ?? 'default-sandbox',
    taskBrief: toStringValue(value.taskBrief) ?? '',
    projectSeed: {
      rootDir: toStringValue(projectSeed.rootDir) ?? '.',
      description: toStringValue(projectSeed.description),
    },
    expected: {
      goodSkillIds: toStringArray(expected.goodSkillIds),
      forbiddenSkillIds: toStringArray(expected.forbiddenSkillIds),
      deliverables: toStringArray(expected.deliverables),
    },
    verification: {
      commands: toStringArray(verification.commands),
    },
    execution: {
      command: toStringValue(execution.command),
      artifactsDir: toStringValue(execution.artifactsDir),
    },
    judge: {
      type: judge.type === 'llm' ? 'llm' : 'human',
      rubricPath: toStringValue(judge.rubricPath),
      resultPath: toStringValue(judge.resultPath),
      command: toStringValue(judge.command),
    },
  }
}

export async function listEvalCases(dir: string): Promise<string[]> {
  return listCaseFilesRecursive(resolve(dir))
}

export async function loadEvalCase(filePath: string): Promise<SkillEvalCase> {
  const raw = await readFile(filePath, 'utf-8')
  const parsed = filePath.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw)
  const record = toRecord(parsed)
  const caseType = toStringValue(record.caseType)

  if (caseType === 'sandbox') {
    return normalizeSandboxCase(record)
  }

  return normalizeRetrievalCase(record)
}

export async function ensureRunLayout(runDir: string): Promise<{
  runDir: string
  artifactsDir: string
}> {
  const resolved = resolve(runDir)
  const artifactsDir = join(resolved, 'artifacts')
  await mkdir(artifactsDir, { recursive: true })
  return { runDir: resolved, artifactsDir }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

export async function appendJsonl(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await appendFile(filePath, `${JSON.stringify(value)}\n`, 'utf-8')
}

export async function writeMarkdownReport(filePath: string, lines: string[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${lines.join('\n').trim()}\n`, 'utf-8')
}

export function buildRunManifest(input: {
  runId: string
  mode: SkillEvalMode
  casesDir: string
  outputDir: string
  caseIds: string[]
  langfuseEnabled: boolean
  assetVersions: SkillEvalRunManifest['assetVersions']
}): SkillEvalRunManifest {
  const normalizedCasesDir = /^[a-z]+:\/\//i.test(input.casesDir)
    ? input.casesDir
    : resolve(input.casesDir)
  return {
    schemaVersion: '2026-04-12',
    runId: input.runId,
    mode: input.mode,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'running',
    caseIds: input.caseIds,
    casesDir: normalizedCasesDir,
    outputDir: resolve(input.outputDir),
    langfuseEnabled: input.langfuseEnabled,
    assetVersions: input.assetVersions,
  }
}

export function finalizeRunManifest(
  manifest: SkillEvalRunManifest,
  status: SkillEvalRunManifest['status'],
): SkillEvalRunManifest {
  return {
    ...manifest,
    status,
    finishedAt: new Date().toISOString(),
  }
}

export function toRelativeArtifactPath(baseDir: string, targetPath: string | null): string | null {
  if (!targetPath) {
    return null
  }
  return relative(baseDir, targetPath)
}
