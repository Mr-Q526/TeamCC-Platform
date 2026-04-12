import { describe, expect, test } from 'bun:test'
import { isTeamCCAuthInput } from '../src/bootstrap/teamccSession.js'

describe('TeamCC session gates', () => {
  test('only slash auth commands are allowed while unauthenticated', () => {
    expect(isTeamCCAuthInput('/login')).toBe(true)
    expect(isTeamCCAuthInput('/auth status')).toBe(true)
    expect(isTeamCCAuthInput('/logout')).toBe(true)

    expect(isTeamCCAuthInput('login')).toBe(false)
    expect(isTeamCCAuthInput('/skills search frontend')).toBe(false)
    expect(isTeamCCAuthInput('帮我改代码')).toBe(false)
  })
})
