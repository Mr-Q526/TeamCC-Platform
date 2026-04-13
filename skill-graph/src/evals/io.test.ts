import { describe, expect, test } from 'bun:test'
import { resolve } from 'path'
import { loadEvalCase } from './io.js'

const projectRoot = resolve(import.meta.dir, '../..')

describe('eval io', () => {
  test('loads retrieval case schema', async () => {
    const value = await loadEvalCase(
      resolve(
        projectRoot,
        'evals/skills/cases/retrieval/frontend-homepage-brand.yaml',
      ),
    )

    expect(value.caseType).toBe('retrieval')
    if (value.caseType === 'retrieval') {
      expect(value.caseId).toBe('retrieval_frontend_homepage_brand_001')
      expect(value.expected.mustHitSkillIds).toContain(
        'frontend/website-homepage-design-pro',
      )
    }
  })

  test('loads sandbox case schema', async () => {
    const value = await loadEvalCase(
      resolve(
        projectRoot,
        'evals/skills/cases/sandbox/homepage-blind-fixture.yaml',
      ),
    )

    expect(value.caseType).toBe('sandbox')
    if (value.caseType === 'sandbox') {
      expect(value.sandboxId).toBe('homepage-blind-fixture')
      expect(value.verification.commands).toContain('test -f index.html')
    }
  })
})
