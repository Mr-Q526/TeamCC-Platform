export type DiscoverySignal = 'turn_0_user_input' | 'inter_turn_prefetch'

export function createSkillSearchSignal(
  hasDirectUserInput: boolean,
): DiscoverySignal {
  return hasDirectUserInput ? 'turn_0_user_input' : 'inter_turn_prefetch'
}
