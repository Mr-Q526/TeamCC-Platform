import * as React from 'react'
import { Box, Text } from '../ink.js'
import { getInvokedSkillsForAgent } from '../bootstrap/state.js'
import type { Message } from '../types/message.js'

type InjectedSkillStatus = 'discovered' | 'invoked'

type InjectedSkillEntry = {
  skillId?: string
  name: string
  status: InjectedSkillStatus
  rank?: number
  finalScore?: number
  retrievalSource?: string
}

type InternalInjectedSkillEntry = InjectedSkillEntry & {
  lastSeenOrder: number
}

type Props = {
  messages: Message[]
  maxVisibleSkills?: number
}

function getInjectedSkills(messages: Message[]): InjectedSkillEntry[] {
  const skillByKey = new Map<string, InternalInjectedSkillEntry>()
  let nextSeenOrder = 0

  const ensureSkill = (
    skill: Omit<InjectedSkillEntry, 'status'> & { status: InjectedSkillStatus },
  ): void => {
    const { name, status } = skill
    const trimmed = name.trim()
    if (!trimmed) return
    const key = (skill.skillId?.trim() || trimmed).toLowerCase()
    const existing = skillByKey.get(key)
    if (existing) {
      existing.lastSeenOrder = nextSeenOrder++
      if (status === 'invoked' && existing.status !== 'invoked') {
        existing.status = status
      }
      if (!existing.skillId && skill.skillId) {
        existing.skillId = skill.skillId
      }
      if (skill.rank !== undefined) {
        existing.rank = skill.rank
      }
      if (skill.finalScore !== undefined) {
        existing.finalScore = skill.finalScore
      }
      if (skill.retrievalSource) {
        existing.retrievalSource = skill.retrievalSource
      }
      return
    }
    skillByKey.set(key, {
      skillId: skill.skillId,
      name: trimmed,
      status,
      rank: skill.rank,
      finalScore: skill.finalScore,
      retrievalSource: skill.retrievalSource,
      lastSeenOrder: nextSeenOrder++,
    })
  }

  for (const message of messages) {
    if (message.type !== 'attachment') continue
    const attachment = message.attachment as
      | {
          type: 'skill_discovery'
          skills: Array<{
            skillId?: string
            name: string
            rank?: number
            finalScore?: number
            retrievalSource?: string
          }>
        }
      | {
          type: 'invoked_skills'
          skills: Array<{
            name: string
          }>
        }
      | {
          type: string
        }

    if (attachment.type === 'skill_discovery' && 'skills' in attachment) {
      for (const skill of attachment.skills) {
        ensureSkill({
          skillId: skill.skillId,
          name: skill.name,
          status: 'discovered',
          rank: skill.rank,
          finalScore: skill.finalScore,
          retrievalSource: skill.retrievalSource,
        })
      }
      continue
    }

    if (attachment.type === 'invoked_skills' && 'skills' in attachment) {
      for (const skill of attachment.skills) {
        ensureSkill({
          name: skill.name,
          status: 'invoked',
        })
      }
    }
  }

  // Live invoked-skill state is the authoritative source for skills that have
  // already been loaded in the current session. The message stream only gets
  // invoked_skills attachments during compaction/recovery, so relying on
  // messages alone would miss normal in-session skill usage.
  for (const skill of getInvokedSkillsForAgent(null).values()) {
    ensureSkill({
      skillId: skill.skillId ?? undefined,
      name: skill.skillName,
      status: 'invoked',
    })
  }

  return [...skillByKey.values()]
    .sort((left, right) => {
      if (left.lastSeenOrder !== right.lastSeenOrder) {
        return right.lastSeenOrder - left.lastSeenOrder
      }
      if (left.status !== right.status) {
        return left.status === 'invoked' ? -1 : 1
      }
      if (left.rank !== undefined && right.rank !== undefined && left.rank !== right.rank) {
        return left.rank - right.rank
      }
      return left.name.localeCompare(right.name)
    })
    .map(({ lastSeenOrder: _lastSeenOrder, ...skill }) => skill)
}

export function InjectedSkillsPanel({ messages, maxVisibleSkills = 6 }: Props): React.ReactNode {
  const injectedSkills = React.useMemo(() => getInjectedSkills(messages), [messages])
  const visibleSkills = injectedSkills.slice(0, maxVisibleSkills)
  const hiddenCount = injectedSkills.length - visibleSkills.length

  return (
    <Box flexDirection="column" width="100%" marginBottom={1}>
      <Text dimColor>
        Injected skills <Text bold>({injectedSkills.length})</Text>
      </Text>
      {injectedSkills.length > 0 && (
        <Text dimColor>Latest per skill in this session.</Text>
      )}
      {injectedSkills.length === 0 && (
        <Box paddingLeft={2}>
          <Text dimColor>• no skills injected yet</Text>
        </Box>
      )}
      {visibleSkills.map(skill => (
        <Box key={`${skill.status}:${skill.name}`} paddingLeft={2}>
          <Text dimColor>• </Text>
          <Text>
            {skill.status === 'invoked' ? '[invoked] ' : '[discovered] '}
            <Text bold>{skill.name}</Text>
            {skill.rank !== undefined ? ` #${skill.rank}` : ''}
            {typeof skill.finalScore === 'number'
              ? ` · ${skill.finalScore.toFixed(2)}`
              : ''}
            {skill.retrievalSource ? ` · ${skill.retrievalSource}` : ''}
          </Text>
        </Box>
      ))}
      {hiddenCount > 0 && (
        <Box paddingLeft={2}>
          <Text dimColor>• +{hiddenCount} more</Text>
        </Box>
      )}
      {injectedSkills.length > 0 && (
        <Box paddingLeft={2}>
          <Text dimColor>Type /&lt;skill-name&gt; to invoke one manually.</Text>
        </Box>
      )}
    </Box>
  )
}
