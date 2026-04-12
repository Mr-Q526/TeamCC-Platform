export const AGENT_PATHS = {
  FOLDER_NAME: '.teamcc',
  AGENTS_DIR: 'agents',
  project: '.teamcc/agents',
  user: '~/.teamcc/agents',
} as const

export type ModeState = string
