import * as React from 'react'
import { Box, Text } from '../ink.js'
import { getInvokedSkillsForAgent } from '../bootstrap/state.js'
import type { Message } from '../types/message.js'

type InjectedSkillStatus = 'discovered' | 'invoked'

type InjectedSkillEntry = {
  name: string
  status: InjectedSkillStatus
}

type Props = {
  messages: Message[]
  maxVisibleSkills?: number
}

function getInjectedSkills(messages: Message[]): InjectedSkillEntry[] {
  const skillByKey = new Map<string, InjectedSkillEntry>()
  const orderedKeys: string[] = []

  const ensureSkill = (name: string, status: InjectedSkillStatus): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()
    const existing = skillByKey.get(key)
    if (existing) {
      if (status === 'invoked' && existing.status !== 'invoked') {
        existing.status = status
      }
      return
    }
    skillByKey.set(key, {
      name: trimmed,
      status,
    })
    orderedKeys.push(key)
  }

  for (const message of messages) {
    if (message.type !== 'attachment') continue
    const attachment = message.attachment

    if (attachment.type === 'skill_discovery') {
      for (const skill of attachment.skills) {
        ensureSkill(skill.name, 'discovered')
      }
      continue
    }

    if (attachment.type === 'invoked_skills') {
      for (const skill of attachment.skills) {
        ensureSkill(skill.name, 'invoked')
      }
    }
  }

  // Live invoked-skill state is the authoritative source for skills that have
  // already been loaded in the current session. The message stream only gets
  // invoked_skills attachments during compaction/recovery, so relying on
  // messages alone would miss normal in-session skill usage.
  for (const skill of getInvokedSkillsForAgent(null).values()) {
    ensureSkill(skill.skillName, 'invoked')
  }

  return orderedKeys.map(key => skillByKey.get(key)!)
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
