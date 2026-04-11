import { ensureBootstrapMacro } from './bootstrapMacro'
import { runStartupTeamCCMigration } from './utils/teamccPaths.js'

ensureBootstrapMacro()
runStartupTeamCCMigration()

await import('./entrypoints/cli.tsx')
