import * as React from 'react'
import { getSessionId } from '../../bootstrap/state.js'
import { SkillsMenu } from '../../components/skills/SkillsMenu.js'
import { retrieveSkills } from '../../services/skillSearch/provider.js'
import {
  buildSkillSearchQueryContext,
  createSkillDiscoveryAttachment,
  rememberSkillDiscoveryResults,
} from '../../services/skillSearch/prefetch.js'
import { createSkillSearchSignal } from '../../services/skillSearch/signals.js'
import {
  createSkillFactAttribution,
  createSkillTelemetryTraceId,
} from '../../services/skillSearch/telemetry.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { createAttachmentMessage } from '../../utils/attachments.js'

function formatSkillSearchResults(
  query: string,
  response: Awaited<ReturnType<typeof retrieveSkills>>,
): string {
  if (response.candidates.length === 0) {
    return `没有找到和“${query}”相关的技能。`
  }

  const lines = response.candidates.map(candidate => {
    const score = candidate.finalScore.toFixed(2)
    return `  ${candidate.rank}. ${candidate.name} · ${score} · ${candidate.retrievalSource}`
  })

  return [
    `已检索到 ${response.candidates.length} 个相关技能：`,
    '',
    ...lines,
    '',
    '已将这些候选注入当前会话，可直接使用 /<skill-name> 调用。',
  ].join('\n')
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args?: string,
): Promise<React.ReactNode> {
  const trimmedArgs = args?.trim() ?? ''
  if (!trimmedArgs) {
    return <SkillsMenu onExit={onDone} commands={context.options.commands} />
  }

  const [subcommand, ...rest] = trimmedArgs.split(/\s+/)
  if (subcommand !== 'search') {
    onDone('Usage:\n  /skills\n  /skills search <query>', {
      display: 'system',
    })
    return null
  }

  const query = rest.join(' ').trim()
  if (!query) {
    onDone('Usage:\n  /skills search <query>', { display: 'system' })
    return null
  }

  const traceId = createSkillTelemetryTraceId()
  const attribution = createSkillFactAttribution(getSessionId(), traceId, traceId)
  const response = await retrieveSkills({
    queryText: query,
    queryContext: buildSkillSearchQueryContext(context.messages),
    limit: 3,
    traceId: attribution.traceId,
    taskId: attribution.taskId,
    retrievalRoundId: attribution.retrievalRoundId,
    telemetry: true,
  })

  if (response.candidates.length > 0) {
    rememberSkillDiscoveryResults(response.candidates, context, attribution)
    context.setMessages(prev => [
      ...prev,
      createAttachmentMessage(
        createSkillDiscoveryAttachment(
          response,
          createSkillSearchSignal(true),
        ),
      ),
    ])
  }

  onDone(formatSkillSearchResults(query, response), { display: 'system' })
  return null
}
