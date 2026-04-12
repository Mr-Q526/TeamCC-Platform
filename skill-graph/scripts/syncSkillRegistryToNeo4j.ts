import { syncSkillRegistryToNeo4j } from '../src/graph/registryGraphSync.js'

async function main(): Promise<void> {
  const summary = await syncSkillRegistryToNeo4j()
  console.log(JSON.stringify(summary, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
