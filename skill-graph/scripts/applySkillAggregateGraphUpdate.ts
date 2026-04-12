import {
  applySkillAggregateGraphUpdate,
  buildAndWriteSkillAggregateGraphUpdate,
} from '../src/graph/aggregateGraphUpdate.js'

async function main(): Promise<void> {
  const manifest = await buildAndWriteSkillAggregateGraphUpdate()
  await applySkillAggregateGraphUpdate(manifest)
  console.log(
    `Applied skill aggregate graph update with ${manifest.feedbackAggregates.length} aggregates`,
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
