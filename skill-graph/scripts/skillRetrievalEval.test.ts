import { describe, expect, test } from 'bun:test'
import { parseArgs } from './skillRetrievalEval.ts'

describe('skillRetrievalEval CLI defaults', () => {
  test('keeps retrieval features undefined when no override is provided', () => {
    const options = parseArgs([])

    expect(options.retrievalFeaturesPath).toBeUndefined()
    expect(options.baselineRetrievalFeaturesPath).toBeUndefined()
    expect(options.experimentRetrievalFeaturesPath).toBeUndefined()
  })

  test('resolves retrieval features override when explicitly provided', () => {
    const options = parseArgs([
      '--retrieval-features',
      './data/aggregates/skill-retrieval-features.experiment.json',
    ])

    expect(options.retrievalFeaturesPath).toContain(
      'data/aggregates/skill-retrieval-features.experiment.json',
    )
  })
})
