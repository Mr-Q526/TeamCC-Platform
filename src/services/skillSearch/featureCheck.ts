import { getProjectRoot } from '../../bootstrap/state.js'
import { getSkillRegistryLocations } from './registry.js'

export function isSkillSearchEnabled(): boolean {
  if (process.env.CLAUDE_CODE_DISABLE_SKILL_SEARCH === '1') {
    return false
  }

  return getSkillRegistryLocations(getProjectRoot()).length > 0
}
