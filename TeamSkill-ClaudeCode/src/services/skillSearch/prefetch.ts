import {
  getInvokedSkillsForAgent,
  getProjectRoot,
  getSessionId,
} from '../../bootstrap/state.js'
import type { ToolUseContext } from '../../Tool.js'
import type { Message } from '../../types/message.js'
import type { Attachment } from '../../utils/attachments.js'
import { basename, dirname } from 'path'
import { isSkillSearchEnabled } from './featureCheck.js'
import {
  createSkillSearchSignal,
  type DiscoverySignal,
} from './signals.js'
import {
  createSkillFactAttribution,
  createSkillTelemetryTraceId,
  rememberDiscoveredSkillAttribution,
} from './telemetry.js'
import { retrieveSkills } from './retrieve.js'

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
  const attribution = createSkillFactAttribution(getSessionId(), traceId, traceId)
  const queryContext = buildQueryContext(messages)
  const response = await retrieveSkills({
    cwd: getProjectRoot(),
    queryText: trimmedQuery,
    limit: 3,
    queryContext,
    traceId: attribution.traceId,
    taskId: attribution.taskId,
    retrievalRoundId: attribution.retrievalRoundId,
    telemetry: true,
  })
  const results = response.candidates

  if (results.length === 0) {
    return []
  }

  const alreadyDiscovered = new Set(toolUseContext.discoveredSkillNames ?? [])
  const alreadyDiscoveredIds = new Set(
    [...(toolUseContext.discoveredSkillAttributions?.values() ?? [])]
      .map(item => item.skillId)
      .filter((value): value is string => Boolean(value)),
  )
  const alreadyInvoked = new Set(
    [...getInvokedSkillsForAgent(toolUseContext.agentId ?? null).values()].map(
      skill => skill.skillId ?? skill.skillName,
    ),
  )

  const newResults = results.filter(result => {
    return (
      !alreadyDiscovered.has(result.name) &&
      !alreadyDiscoveredIds.has(result.skillId) &&
      !alreadyInvoked.has(result.skillId)
    )
  })

  if (newResults.length === 0) {
    return []
  }

  for (const result of newResults) {
    toolUseContext.discoveredSkillNames?.add(result.name)
    rememberDiscoveredSkillAttribution(
      toolUseContext.discoveredSkillAttributions,
      {
        skillId: result.skillId,
        name: result.name,
        displayName: result.displayName,
        aliases: result.aliases,
      },
      attribution,
      {
        version: result.version,
        sourceHash: result.sourceHash,
        description: result.description,
        domain: result.domain,
        departmentTags: result.departmentTags,
        sceneTags: result.sceneTags,
        retrievalSource: result.retrievalSource,
        rank: result.rank,
        finalScore: result.finalScore,
      },
    )
  }

  return [
    {
      type: 'skill_discovery',
      skills: newResults.map(result => ({
        skillId: result.skillId,
        name: result.name,
        displayName: result.displayName,
        description: result.description,
        version: result.version,
        sourceHash: result.sourceHash,
        rank: result.rank,
        retrievalSource: result.retrievalSource,
        finalScore: result.finalScore,
        scoreBreakdown: result.finalScoreBreakdown,
      })),
      signal,
      source: 'native',
      retrievalMode: response.retrievalMode,
      dataVersions: response.dataVersions,
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
