import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getInvokedSkillsForAgent,
  getSessionId,
  type InvokedSkillInfo,
} from '../bootstrap/state.js'
import { logEvent } from '../services/analytics/index.js'
import { randomUUID } from 'crypto'

export type SkillInfo = {
  skillName: string
  skillId: string
  version: string
  sourceHash: string
  invokedAt: number
}

// Simple list of profanity triggers for implicit negative feedback
const PROFANITY_RATES = [/垃圾/, /蠢/, /废/, /智障/, /傻逼/, /md/, /没用/]

const explicitRatingToScore: Record<1 | 2 | 3 | 4, 5 | 4 | 3 | 1> = {
  1: 5,
  2: 4,
  3: 3,
  4: 1,
}

function getMainThreadSkills(): InvokedSkillInfo[] {
  return [...getInvokedSkillsForAgent(null).values()]
}

function getLatestInvokedAt(): number {
  return Math.max(0, ...getMainThreadSkills().map(skill => skill.invokedAt))
}

function toSkillInfo(skill: InvokedSkillInfo): SkillInfo {
  return {
    skillName: skill.skillName,
    skillId: skill.skillName,
    version: 'unknown',
    sourceHash: 'unknown',
    invokedAt: skill.invokedAt,
  }
}

function feedbackKey(skill: SkillInfo): string {
  return `${skill.skillName}:${skill.invokedAt}`
}

export function useSkillFeedbackSurvey(
  isLoading: boolean,
  hasActivePrompt: boolean,
) {
  const [pendingSkill, setPendingSkill] = useState<SkillInfo | null>(null)
  const [feedbackQueue, setFeedbackQueue] = useState<SkillInfo[]>([])
  const sessionId = getSessionId()
  const pendingSkillRef = useRef<SkillInfo | null>(null)
  const wasTaskActiveRef = useRef(false)
  const lastQueuedInvocationAtRef = useRef(getLatestInvokedAt())
  const queuedKeysRef = useRef(new Set<string>())

  useEffect(() => {
    pendingSkillRef.current = pendingSkill
  }, [pendingSkill])

  // A completed task is the transition from loading back to an idle prompt.
  // Queue every main-thread skill invoked during that task.
  useEffect(() => {
    if (isLoading) {
      wasTaskActiveRef.current = true
      return
    }

    if (hasActivePrompt || !wasTaskActiveRef.current) {
      return
    }

    wasTaskActiveRef.current = false
    const lastQueuedInvocationAt = lastQueuedInvocationAtRef.current
    const completedTaskSkills = getMainThreadSkills()
      .filter(skill => skill.invokedAt > lastQueuedInvocationAt)
      .sort((a, b) => a.invokedAt - b.invokedAt)
      .map(toSkillInfo)

    if (completedTaskSkills.length === 0) {
      return
    }

    lastQueuedInvocationAtRef.current = Math.max(
      lastQueuedInvocationAt,
      ...completedTaskSkills.map(skill => skill.invokedAt),
    )

    setFeedbackQueue(prev => {
      const knownKeys = new Set([
        ...queuedKeysRef.current,
        ...prev.map(feedbackKey),
      ])
      if (pendingSkillRef.current) {
        knownKeys.add(feedbackKey(pendingSkillRef.current))
      }

      const additions = completedTaskSkills.filter(skill => {
        const key = feedbackKey(skill)
        if (knownKeys.has(key)) {
          return false
        }
        queuedKeysRef.current.add(key)
        return true
      })

      return additions.length > 0 ? [...prev, ...additions] : prev
    })
  }, [isLoading, hasActivePrompt])

  useEffect(() => {
    if (isLoading || hasActivePrompt || pendingSkill || feedbackQueue.length === 0) {
      return
    }

    const [nextSkill, ...remaining] = feedbackQueue
    setPendingSkill(nextSkill)
    setFeedbackQueue(remaining)
  }, [feedbackQueue, hasActivePrompt, isLoading, pendingSkill])

  const recordFeedback = useCallback(
    (
      skill: SkillInfo,
      feedbackKind: 'explicit-rating' | 'explicit-comment' | 'implicit-skip',
      rating?: number,
      sentiment?: 'positive' | 'negative' | 'neutral',
    ) => {
      logEvent('tengu_skill_execution_feedback' as any, {
        eventType: 'skill.feedback.recorded',
        eventId: randomUUID(),
        taskId: sessionId,
        skillName: skill.skillName,
        skillId: skill.skillId,
        version: skill.version,
        sourceHash: skill.sourceHash,
        feedbackSource: 'user',
        feedbackKind,
        ...(rating !== undefined && { rating }),
        ...(sentiment && { sentiment }),
      })
    },
    [sessionId],
  )

  const submitFeedback = useCallback(
    (
      rating: 1 | 2 | 3 | 4 | 5,
      sentiment?: 'positive' | 'negative' | 'neutral',
    ) => {
      if (!pendingSkill) return

      if (rating === 5 && !sentiment) {
        recordFeedback(pendingSkill, 'implicit-skip')
      } else {
        recordFeedback(
          pendingSkill,
          sentiment ? 'explicit-comment' : 'explicit-rating',
          rating === 5 ? undefined : explicitRatingToScore[rating],
          sentiment,
        )
      }

      setPendingSkill(null)
    },
    [pendingSkill, recordFeedback],
  )

  // Exposed hook function to intercept prompts and submit negative feedback
  const interceptProfanity = useCallback(
    (text: string): boolean => {
      const skill = pendingSkillRef.current
      if (!skill) return false

      const isProfane = PROFANITY_RATES.some(regex => regex.test(text))
      if (!isProfane) {
        return false
      }

      recordFeedback(skill, 'explicit-comment', 1, 'negative')
      setPendingSkill(null)
      return true
    },
    [recordFeedback],
  )

  return {
    pendingSkill,
    submitFeedback,
    interceptProfanity
  }
}
