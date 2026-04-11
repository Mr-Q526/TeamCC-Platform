import { useState, useEffect } from 'react'
import {
  getInvokedSkillsForAgent,
  useAppState,
} from '../../bootstrap/state.js'
import { logEvent } from '../../services/analytics/index.js'
import { randomUUID } from 'crypto'

export type SkillInfo = {
  skillId: string
  version: string
  sourceHash: string
}

// Global set to prevent asking multiple times for same skill in same session
const surveyedSkills = new Set<string>()

// Simple list of profanity triggers for implicit negative feedback
const PROFANITY_RATES = [/垃圾/, /蠢/, /废/, /智障/, /傻逼/, /md/, /没用/]

export function useSkillFeedbackSurvey(
  isLoading: boolean,
  hasActivePrompt: boolean,
) {
  const [pendingSkill, setPendingSkill] = useState<SkillInfo | null>(null)
  const [inputValue, setInputValue] = useState('')
  const appState = useAppState()

  // Track the most recent skill invoked for profanity interception
  const [lastInvokedSkill, setLastInvokedSkill] = useState<SkillInfo | null>(null)

  // Determine if there is a pending skill feedback needed
  useEffect(() => {
    if (isLoading || hasActivePrompt) return

    const invokedSkills = getInvokedSkillsForAgent(null)
    if (invokedSkills && invokedSkills.length > 0) {
      // Pick the latest invoked skill (or any that hasn't been surveyed)
      for (const skillName of [...invokedSkills].reverse()) {
        const uniqueKey = `${appState.sessionId}-${skillName}`
        if (!surveyedSkills.has(uniqueKey)) {
          // Identify skill metadata (mocked here, ideally pulled from Command resolution)
          const skillObj = {
            skillId: skillName,
            version: 'unknown',
            sourceHash: 'unknown',
          }
          setPendingSkill(skillObj)
          setLastInvokedSkill(skillObj)
          return
        }
      }
    }
  }, [isLoading, state, appState.sessionId])

  const submitFeedback = (rating: 1 | 2 | 3 | 4 | 5, sentiment?: 'positive' | 'negative' | 'neutral') => {
    if (!pendingSkill) return
    
    const uniqueKey = `${appState.sessionId}-${pendingSkill.skillId}`
    surveyedSkills.add(uniqueKey)

    if (rating === 5 && !sentiment) {
      // Provide an implicit skip log
      logEvent('tengu_skill_execution_feedback' as any, {
        eventType: 'skill.feedback.recorded',
        eventId: randomUUID(),
        taskId: appState.sessionId,
        skillName: pendingSkill.skillId,
        skillId: pendingSkill.skillId,
        version: pendingSkill.version,
        sourceHash: pendingSkill.sourceHash,
        feedbackSource: 'user',
        feedbackKind: 'implicit-skip'
      })
    } else {
      // standard explicit rating or implicit comment injection
      logEvent('tengu_skill_execution_feedback' as any, {
        eventType: 'skill.feedback.recorded',
        eventId: randomUUID(),
        taskId: appState.sessionId,
        skillName: pendingSkill.skillId,
        skillId: pendingSkill.skillId,
        version: pendingSkill.version,
        sourceHash: pendingSkill.sourceHash,
        feedbackSource: 'user',
        feedbackKind: sentiment ? 'explicit-comment' : 'explicit-rating',
        rating: rating,
        sentiment: sentiment,
      })
    }
    
    setPendingSkill(null)
    setInputValue('')
  }

  // Exposed hook function to intercept prompts and submit negative feedback
  const interceptProfanity = (text: string): boolean => {
    if (!lastInvokedSkill) return false
    
    const isProfane = PROFANITY_RATES.some(regex => regex.test(text))
    if (isProfane) {
      const uniqueKey = `${appState.sessionId}-${lastInvokedSkill.skillId}`
      surveyedSkills.add(uniqueKey)
      
      logEvent('tengu_skill_execution_feedback' as any, {
        eventType: 'skill.feedback.recorded',
        eventId: randomUUID(),
        taskId: appState.sessionId,
        skillName: lastInvokedSkill.skillId,
        skillId: lastInvokedSkill.skillId,
        version: lastInvokedSkill.version,
        sourceHash: lastInvokedSkill.sourceHash,
        feedbackSource: 'user',
        feedbackKind: 'explicit-comment',
        rating: 1, // lowest according to our mapped logic or -1 underlying
        sentiment: 'negative',
      })
      setPendingSkill(null)
      return true
    }
    return false
  }

  return {
    pendingSkill,
    submitFeedback,
    inputValue,
    setInputValue,
    interceptProfanity
  }
}
