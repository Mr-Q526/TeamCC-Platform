import { describe, expect, test } from 'bun:test'
import { resolve } from 'path'
import { loadEvalCase } from './io.js'
import { runOfflineRetrievalEval } from './retrieval.js'

const projectRoot = resolve(import.meta.dir, '../..')

describe('offline retrieval eval', () => {
  test('runs retrieval cases and returns mode summaries', async () => {
    const firstCase = await loadEvalCase(
      resolve(
        projectRoot,
        'evals/skills/cases/retrieval/frontend-homepage-brand.yaml',
      ),
    )

    expect(firstCase.caseType).toBe('retrieval')
    if (firstCase.caseType !== 'retrieval') {
      throw new Error('expected retrieval case')
    }

    const result = await runOfflineRetrievalEval({
      projectRoot,
      cases: [firstCase],
      topK: 5,
    })

    expect(result.summary.caseCount).toBe(1)
    expect(result.cases[0]?.modeResults.length).toBeGreaterThanOrEqual(1)
    expect(result.summary.metricsByRequestedMode.bm25.recallAt3).toBeGreaterThanOrEqual(0)
  })
})
