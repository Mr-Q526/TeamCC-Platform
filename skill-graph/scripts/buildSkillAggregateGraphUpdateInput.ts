import { buildAndWriteSkillAggregateGraphUpdate } from '../src/graph/aggregateGraphUpdate.js'

async function main(): Promise<void> {
  const manifest = await buildAndWriteSkillAggregateGraphUpdate()
  console.log(
    `Built graph update input with ${manifest.feedbackAggregates.length} aggregates, ${manifest.skillUpdates.length} skills, ${manifest.versionUpdates.length} versions`,
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
