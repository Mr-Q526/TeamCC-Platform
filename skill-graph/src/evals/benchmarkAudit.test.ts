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

const acceptableSkill: SkillRegistryEntry = {
  ...targetSkill,
  skillId: 'frontend/marketing-landing-page',
  name: 'marketing-landing-page',
  displayName: 'Marketing Landing Page',
  sourceHash: 'marketing',
}

const forbiddenSkill: SkillRegistryEntry = {
  ...targetSkill,
  skillId: 'tools/spreadsheet',
  name: 'spreadsheet',
  displayName: 'Spreadsheet',
  domain: 'tools',
  departmentTags: ['tools-platform'],
  sceneTags: ['analysis'],
  sourceHash: 'sheet',
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
    projectId: 'proj:homepage',
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
    preference: null,
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
      registryById: new Map([
        [targetSkill.skillId, targetSkill],
        [acceptableSkill.skillId, acceptableSkill],
        [forbiddenSkill.skillId, forbiddenSkill],
      ]),
    })
    expect(summary.issueCount).toBe(0)
    expect(summary.byDomain.frontend).toBe(1)
  })

  test('builds deterministic review sample', () => {
    const sample = buildBenchmarkReviewSample([baseCase], 1)
    expect(sample).toHaveLength(1)
    expect(sample[0]?.caseId).toBe(baseCase.caseId)
  })

  test('flags target domain mismatch', () => {
    const summary = auditBenchmarkCases({
      cases: [
        {
          ...baseCase,
          tags: ['backend', 'set:benchmark', 'difficulty:direct', 'lang:zh-mixed'],
        },
      ],
      registryById: new Map([
        [targetSkill.skillId, targetSkill],
        [acceptableSkill.skillId, acceptableSkill],
        [forbiddenSkill.skillId, forbiddenSkill],
      ]),
    })
    expect(
      summary.issues.some(issue => issue.type === 'target-domain-mismatch'),
    ).toBe(true)
  })

  test('flags invalid preference shape', () => {
    const competingSkill: SkillRegistryEntry = {
      ...targetSkill,
      skillId: 'frontend/website-homepage-design-basic',
      name: 'website-homepage-design-basic',
      displayName: 'Website Homepage Design Basic',
      sourceHash: 'def',
    }

    const summary = auditBenchmarkCases({
      cases: [
        {
          ...baseCase,
          tags: [
            'frontend',
            'set:graph-preference',
            'difficulty:direct',
            'lang:zh-mixed',
          ],
          expected: {
            mustHitSkillIds: [targetSkill.skillId],
            acceptableSkillIds: [],
            forbiddenSkillIds: [],
            preference: {
              preferredSkillId: targetSkill.skillId,
              competingSkillId: competingSkill.skillId,
              expectedDirection: 'preferred_above_competitor',
            },
          },
        },
      ],
      registryById: new Map([
        [targetSkill.skillId, targetSkill],
        [competingSkill.skillId, competingSkill],
        [forbiddenSkill.skillId, forbiddenSkill],
      ]),
    })
    expect(summary.issues.some(issue => issue.type === 'invalid-preference')).toBe(
      true,
    )
  })

  test('accepts specific scene hints when skill identity matches scene', () => {
    const loginSkill: SkillRegistryEntry = {
      ...targetSkill,
      skillId: 'frontend/auth-login-page-pro',
      name: 'auth-login-page-pro',
      displayName: 'Auth Login Page Pro',
      sceneTags: ['design'],
      sourceHash: 'login',
    }
    const loginBasic: SkillRegistryEntry = {
      ...loginSkill,
      skillId: 'frontend/auth-login-page-basic',
      name: 'auth-login-page-basic',
      displayName: 'Auth Login Page Basic',
      sourceHash: 'login-basic',
    }

    const summary = auditBenchmarkCases({
      cases: [
        {
          ...baseCase,
          tags: [
            'frontend',
            'set:graph-preference',
            'difficulty:direct',
            'lang:zh-mixed',
          ],
          query: {
            ...baseCase.query,
            queryText: '设计企业级登录页，支持 SSO、异常态和安全提示',
            queryContext: 'login sign in sso security hint',
            sceneHints: ['scene:login', 'scene:design'],
          },
          expected: {
            mustHitSkillIds: [loginSkill.skillId],
            acceptableSkillIds: [loginBasic.skillId],
            forbiddenSkillIds: [forbiddenSkill.skillId],
            preference: {
              preferredSkillId: loginSkill.skillId,
              competingSkillId: loginBasic.skillId,
              expectedDirection: 'preferred_above_competitor',
            },
          },
        },
      ],
      registryById: new Map([
        [loginSkill.skillId, loginSkill],
        [loginBasic.skillId, loginBasic],
        [forbiddenSkill.skillId, forbiddenSkill],
      ]),
    })
    expect(summary.issues.some(issue => issue.type === 'target-scene-mismatch')).toBe(
      false,
    )
  })
})
