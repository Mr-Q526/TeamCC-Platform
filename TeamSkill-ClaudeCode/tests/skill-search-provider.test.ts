import { describe, expect, test } from 'bun:test'
import {
  buildSkillGraphRetrievalRequest,
  normalizeDepartmentHint,
} from '../src/services/skillSearch/provider.js'

describe('skill search provider', () => {
  test('normalizes department labels into retrieval-safe hints', () => {
    expect(normalizeDepartmentHint(' Frontend Platform ')).toBe('frontend-platform')
    expect(normalizeDepartmentHint('增长运营')).toBe('增长运营')
    expect(normalizeDepartmentHint('')).toBeNull()
  })

  test('maps TeamCC request fields into the skill-graph request contract', () => {
    const request = buildSkillGraphRetrievalRequest(
      {
        queryText: 'homepage design',
        queryContext: 'teamcc platform',
        domainHints: ['frontend'],
        sceneHints: ['homepage'],
        referencedFiles: ['src/app/page.tsx'],
        editedFiles: ['src/app/layout.tsx'],
        priorInjectedSkillIds: ['skill-a'],
        priorInvokedSkillIds: ['skill-b'],
        limit: 3,
      },
      {
        cwd: '/tmp/project',
        department: 'frontend-platform',
      },
    )

    expect(request).toEqual({
      queryText: 'homepage design',
      queryContext: 'teamcc platform',
      cwd: '/tmp/project',
      department: 'frontend-platform',
      domainHints: ['frontend'],
      sceneHints: ['homepage'],
      referencedFiles: ['src/app/page.tsx'],
      editedFiles: ['src/app/layout.tsx'],
      priorInjectedSkillIds: ['skill-a'],
      priorInvokedSkillIds: ['skill-b'],
      limit: 3,
    })
  })
})
