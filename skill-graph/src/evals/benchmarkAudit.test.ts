import { describe, expect, test } from 'bun:test'
import {
  auditBenchmarkCases,
  buildBenchmarkReviewSample,
  findIdentityLeak,
} from './benchmarkAudit.js'
import type { SkillRetrievalEvalCase } from './types.js'
import type { SkillRegistryEntry } from '../registry/registry.js'

const targetSkill: SkillRegistryEntry = {
  skillId: 'frontend/website-homepage-design-pro',
  name: 'website-homepage-design-pro',
  displayName: 'Website Homepage Design Pro',
  description: 'Design a conversion-oriented marketing homepage.',
  aliases: [],
  version: '1.0.0',
  sourceHash: 'abc',
  domain: 'frontend',
  departmentTags: ['dept:frontend-platform'],
  sceneTags: ['homepage'],
  targetDir: 'website-homepage-design-pro',
  skillFile: 'website-homepage-design-pro/SKILL.md',
}

const baseCase: SkillRetrievalEvalCase = {
  schemaVersion: '2026-04-12',
  caseType: 'retrieval',
  caseId: 'retrieval_benchmark_frontend_homepage_001',
  title: '官网首页改版',
  dataset: 'retrieval-benchmark-v1',
  tags: ['frontend', 'set:benchmark', 'difficulty:direct', 'lang:zh-mixed'],
  query: {
    queryText: '我要做一个 SaaS 官网首页，强调产品价值、hero 和 CTA。',
    queryContext: 'homepage landing page hero CTA conversion',
    cwd: '/tmp/skill-eval',
    department: 'dept:frontend-platform',
    domainHints: ['frontend'],
    sceneHints: ['scene:homepage'],
    priorInjectedSkillIds: [],
    priorInvokedSkillIds: [],
    limit: 5,
  },
  expected: {
    mustHitSkillIds: [targetSkill.skillId],
    acceptableSkillIds: ['frontend/marketing-landing-page'],
    forbiddenSkillIds: ['tools/spreadsheet'],
  },
  modeOverrides: {},
}

describe('benchmark audit helpers', () => {
  test('detects target identity leak', () => {
    expect(findIdentityLeak('我想用 website-homepage-design-pro 做首页', targetSkill)).toBe(
      'website-homepage-design-pro',
    )
  })

  test('audits benchmark cases with no issue for clean input', () => {
    const summary = auditBenchmarkCases({
      cases: [baseCase],
      registryById: new Map([[targetSkill.skillId, targetSkill]]),
    })
    expect(summary.issueCount).toBe(0)
    expect(summary.byDomain.frontend).toBe(1)
  })

  test('builds deterministic review sample', () => {
    const sample = buildBenchmarkReviewSample([baseCase], 1)
    expect(sample).toHaveLength(1)
    expect(sample[0]?.caseId).toBe(baseCase.caseId)
  })
})
