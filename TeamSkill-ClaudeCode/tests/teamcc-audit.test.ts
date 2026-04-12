import { describe, expect, test } from 'bun:test'
import { normalizeAuditPayloadArgs } from '../src/bootstrap/teamccAudit.js'

describe('TeamCC audit payload normalization', () => {
  test('keeps object payload unchanged for current call signature', () => {
    expect(
      normalizeAuditPayloadArgs({
        toolName: 'Bash',
        decision: 'allow',
      }),
    ).toEqual({
      payload: {
        toolName: 'Bash',
        decision: 'allow',
      },
      options: {},
    })
  })

  test('converts legacy category + payload calls into an object payload', () => {
    expect(
      normalizeAuditPayloadArgs('tool', {
        toolName: 'Bash',
        decision: 'allow',
      }),
    ).toEqual({
      payload: {
        category: 'tool',
        toolName: 'Bash',
        decision: 'allow',
      },
      options: {},
    })
  })

  test('does not spread string categories into numeric keys', () => {
    const { payload } = normalizeAuditPayloadArgs('tool')

    expect(payload).toEqual({ category: 'tool' })
    expect('0' in payload).toBe(false)
  })
})
