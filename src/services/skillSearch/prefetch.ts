import { getInvokedSkillsForAgent, getProjectRoot } from '../../bootstrap/state.js'
import type { ToolUseContext } from '../../Tool.js'
import type { Message } from '../../types/message.js'
import type { Attachment } from '../../utils/attachments.js'
import { basename, dirname } from 'path'
import { isSkillSearchEnabled } from './featureCheck.js'
import { localSkillSearch } from './localSearch.js'
import {
  createSkillSearchSignal,
  type DiscoverySignal,
} from './signals.js'
import {
  createSkillTelemetryTraceId,
  logSkillSearchTelemetry,
} from './telemetry.js'

export type SkillDiscoveryPrefetchHandle = {
  promise: Promise<Attachment[]>
}

const CONTINUATION_QUERIES = new Set([
  '继续',
  '继续吧',
  '继续做',
  '继续执行',
  '继续处理',
  '继续完成',
  '继续一下',
  '接着',
  '接着做',
  '然后',
  '然后呢',
  '接下来',
  '往下做',
  '继续下去',
  'go on',
  'continue',
  'keep going',
])

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .map(block => {
      if (!block || typeof block !== 'object') {
        return ''
      }

      const text = 'text' in block ? block.text : ''
      return typeof text === 'string' ? text : ''
    })
    .filter(Boolean)
    .join('\n')
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/[。！？，、,.!?]/g, '')
}

function isContinuationQuery(query: string): boolean {
  const normalized = normalizeQuery(query)
  return normalized.length > 0 && CONTINUATION_QUERIES.has(normalized)
}

function getLatestRelevantUserQuery(
  messages: Message[],
  input?: string | null,
): string {
  const directInput = input?.trim() ?? ''
  if (directInput && !isContinuationQuery(directInput)) {
    return directInput
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message?.type !== 'user') continue

    const content = extractTextContent(message.message.content)
    const trimmedContent = content.trim()
    if (!trimmedContent) continue
    if (isContinuationQuery(trimmedContent)) continue
    return trimmedContent
  }

  if (directInput) {
    return directInput
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message?.type !== 'user') continue

    const content = extractTextContent(message.message.content)
    if (content.trim()) {
      return content.trim()
    }
  }

  return ''
}

function collectMessageContextHints(messages: Message[]): string[] {
  const hints = new Set<string>()

  for (let i = messages.length - 1; i >= 0 && hints.size < 6; i--) {
    const message = messages[i]
    if (message?.type !== 'attachment') continue

    const attachment = message.attachment as Record<string, unknown>
    for (const key of ['path', 'displayPath', 'filename']) {
      const value = attachment[key]
      if (typeof value !== 'string' || !value.trim()) continue
      const leaf = basename(value)
      if (leaf) hints.add(leaf)
      const parent = basename(dirname(value))
      if (parent) hints.add(parent)
    }
  }

  return [...hints]
}

function buildQueryContext(messages: Message[]): string {
  const projectRoot = getProjectRoot()
  const projectLeaf = basename(projectRoot)
  const projectParent = basename(dirname(projectRoot))
  const contextTokens = new Set<string>()

  if (projectLeaf) contextTokens.add(projectLeaf)
  if (
    projectParent &&
    projectParent !== projectLeaf &&
    ['frontend', 'backend', 'app', 'web', 'client', 'server'].includes(
      projectLeaf.toLowerCase(),
    )
  ) {
    contextTokens.add(projectParent)
  }

  for (const hint of collectMessageContextHints(messages)) {
    contextTokens.add(hint)
  }

  return [...contextTokens].join(' ')
}

async function buildSkillDiscoveryAttachments(
  query: string,
  messages: Message[],
  toolUseContext: ToolUseContext,
  signal: DiscoverySignal,
): Promise<Attachment[]> {
  if (!isSkillSearchEnabled()) {
    return []
  }

  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return []
  }

  const traceId = createSkillTelemetryTraceId()
  const queryContext = buildQueryContext(messages)
  const results = await localSkillSearch({
    cwd: getProjectRoot(),
    query: trimmedQuery,
    limit: 3,
    queryContext,
    traceId,
  })

  if (results.length === 0) {
    return []
  }

  const alreadyDiscovered = new Set(
    [...(toolUseContext.discoveredSkillNames ?? [])].map(name =>
      name.toLowerCase(),
    ),
  )
  const alreadyInvoked = new Set(
    [...getInvokedSkillsForAgent(toolUseContext.agentId ?? null).values()].map(
      skill => skill.skillName.toLowerCase(),
    ),
  )

  const newResults = results.filter(result => {
    const key = result.name.toLowerCase()
    return !alreadyDiscovered.has(key) && !alreadyInvoked.has(key)
  })

  if (newResults.length === 0) {
    return []
  }

  for (const result of newResults) {
    toolUseContext.discoveredSkillNames?.add(result.name)
  }

  await logSkillSearchTelemetry({
    eventName: 'skill_exposed',
    traceId,
    cwd: getProjectRoot(),
    payload: {
      query: trimmedQuery,
      queryContext,
      signal,
      source: 'native',
      topK: newResults.length,
      candidates: newResults.map(result => ({
        skillId: result.skillId,
        name: result.name,
        displayName: result.displayName,
        version: result.version,
        sourceHash: result.sourceHash,
        domain: result.domain,
        departmentTags: result.departmentTags,
        sceneTags: result.sceneTags,
        rank: result.rank,
        score: result.score,
        scoreBreakdown: result.scoreBreakdown,
        retrievalSource: result.retrievalSource,
      })),
      suppressedCandidates: results
        .filter(result => !newResults.includes(result))
        .map(result => ({
          skillId: result.skillId,
          name: result.name,
          reason: alreadyDiscovered.has(result.name.toLowerCase())
            ? 'already_discovered'
            : 'already_invoked',
        })),
    },
  })

  return [
    {
      type: 'skill_discovery',
      skills: newResults.map(result => ({
        name: result.name,
        description: result.description,
      })),
      signal,
      source: 'native',
    },
  ]
}

export async function getTurnZeroSkillDiscovery(
  input: string,
  messages: Message[],
  toolUseContext: ToolUseContext,
): Promise<Attachment[]> {
  const query = getLatestRelevantUserQuery(messages, input)
  return buildSkillDiscoveryAttachments(
    query,
    messages,
    toolUseContext,
    createSkillSearchSignal(true),
  )
}

export function startSkillDiscoveryPrefetch(
  input: string | null,
  messages: Message[],
  toolUseContext: ToolUseContext,
): SkillDiscoveryPrefetchHandle | null {
  if (!isSkillSearchEnabled()) {
    return null
  }

  const query = getLatestRelevantUserQuery(messages, input)
  if (!query) {
    return null
  }

  return {
    promise: buildSkillDiscoveryAttachments(
      query,
      messages,
      toolUseContext,
      createSkillSearchSignal(Boolean(input)),
    ),
  }
}

export async function collectSkillDiscoveryPrefetch(
  handle: SkillDiscoveryPrefetchHandle,
): Promise<Attachment[]> {
  return handle.promise
}
