import {
  getSkillGraphSkillsDir,
  readGeneratedSkillRegistry,
} from '../src/registry/registry.js'
import { resetDemoLocalSkillGraph } from '../src/graph/demoLocalSkillGraph.js'

async function main(): Promise<void> {
  const registry = await readGeneratedSkillRegistry(getSkillGraphSkillsDir())
  if (!registry) {
    throw new Error('Missing generated skill registry: skill-graph/skills-flat/skill-registry.json')
  }

  await resetDemoLocalSkillGraph(registry)
  console.log('Reset Neo4j demo graph with 5 local real skills')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
