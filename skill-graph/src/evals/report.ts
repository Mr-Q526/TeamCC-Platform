import type {
  GraphUpliftCaseResult,
  ReplayDiagnosisCaseResult,
  RetrievalEvalCaseResult,
  SandboxEvalCaseResult,
  SkillEvalMode,
} from './types.js'

function heading(title: string): string[] {
  return [`# ${title}`, '']
}

export function buildEvalMarkdownReport(input: {
  runId: string
  mode: SkillEvalMode
  cases:
    | RetrievalEvalCaseResult[]
    | GraphUpliftCaseResult[]
    | SandboxEvalCaseResult[]
    | ReplayDiagnosisCaseResult[]
  summary: Record<string, unknown>
}): string[] {
  const lines = [
    ...heading(`Skill Eval Report: ${input.mode}`),
    `- Run ID: \`${input.runId}\``,
    `- Mode: \`${input.mode}\``,
    '',
    '## Summary',
    '',
    '```json',
    JSON.stringify(input.summary, null, 2),
    '```',
    '',
    '## Cases',
    '',
  ]

  if (input.mode === 'offline-retrieval') {
    for (const item of input.cases as RetrievalEvalCaseResult[]) {
      lines.push(`### ${item.caseId}`)
      lines.push(`- Title: ${item.title}`)
      lines.push(`- Dataset: ${item.dataset ?? 'default'}`)
      lines.push(`- Tags: ${item.tags.join(', ') || 'none'}`)
      if (item.expected.preference) {
        lines.push(
          `- Preference: prefer \`${item.expected.preference.preferredSkillId}\` over \`${item.expected.preference.competingSkillId}\``,
        )
      }
      for (const modeResult of item.modeResults) {
        lines.push(
          `- ${modeResult.requestedMode}: actual=${modeResult.actualMode}, firstExpectedRank=${modeResult.firstExpectedRank ?? 'n/a'}, recall@3=${modeResult.recallAt3}, mrr=${modeResult.mrr}`,
        )
      }
      lines.push('')
    }
    return lines
  }

  if (input.mode === 'graph-uplift') {
    for (const item of input.cases as GraphUpliftCaseResult[]) {
      lines.push(`### ${item.caseId}`)
      lines.push(`- Focus Skill: ${item.focusSkillId ?? 'n/a'}`)
      lines.push(
        `- Rank: ${item.baselineRank ?? 'n/a'} -> ${item.experimentRank ?? 'n/a'} (${item.classification})`,
      )
      lines.push(
        `- Final Score Delta: ${item.finalScoreDelta ?? 'n/a'} / Graph Score Delta: ${item.graphScoreDelta ?? 'n/a'}`,
      )
      lines.push('')
    }
    return lines
  }

  if (input.mode === 'teamcc-sandbox-blind') {
    for (const item of input.cases as SandboxEvalCaseResult[]) {
      lines.push(`### ${item.caseId}`)
      lines.push(`- Sandbox: ${item.sandboxId}`)
      lines.push(`- Verification Passed: ${item.verificationPassed}`)
      lines.push(`- Chosen Skill: ${item.chosenSkill.skillId ?? 'n/a'}`)
      lines.push(`- Judge: ${item.judgeResult.summary}`)
      lines.push('')
    }
    return lines
  }

  for (const item of input.cases as ReplayDiagnosisCaseResult[]) {
    lines.push(`### ${item.caseId}`)
    lines.push(`- Category: ${item.failureCategory}`)
    lines.push(`- Summary: ${item.summary}`)
    lines.push('')
  }

  return lines
}
