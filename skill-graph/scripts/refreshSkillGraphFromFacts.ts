import {
  buildAndWriteSkillFactAggregates,
} from '../src/aggregates/skillFactAggregates.js'
import { ensureSkillFeedbackAggregatesTable } from '../src/aggregates/storage.js'
import {
  closeSkillFactPgPool,
  ensureSkillFactEventsTable,
} from '../src/events/storage.js'
import {
  applySkillAggregateGraphUpdate,
  buildAndWriteSkillAggregateGraphUpdateFromPg,
} from '../src/graph/aggregateGraphUpdate.js'
import { writeSkillRetrievalFeatures } from '../src/retrieval/retrievalFeatures.js'

function parseWindowDays(argv: string[]): number | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--window-days') {
      continue
    }

    const value = Number.parseInt(argv[index + 1] ?? '', 10)
    if (Number.isFinite(value) && value > 0) {
      return value
    }
  }

  return undefined
}

async function main(): Promise<void> {
  const windowDays = parseWindowDays(process.argv.slice(2))
  await ensureSkillFactEventsTable()
  await ensureSkillFeedbackAggregatesTable()

  const aggregateManifest = await buildAndWriteSkillFactAggregates({
    windowDays,
    writeJson: true,
    writePg: true,
  })
  console.log(
    `Stored ${aggregateManifest.itemCount} feedback aggregates for ${aggregateManifest.window}`,
  )

  const graphManifest = await buildAndWriteSkillAggregateGraphUpdateFromPg({
    window: aggregateManifest.window,
    limit: 1000,
  })
  await applySkillAggregateGraphUpdate(graphManifest)
  console.log(
    `Applied ${graphManifest.feedbackAggregates.length} feedback aggregates to Neo4j`,
  )

  const retrievalFeatures = await writeSkillRetrievalFeatures()
  console.log(
    `Rebuilt retrieval features with ${retrievalFeatures.itemCount} skills`,
  )
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await closeSkillFactPgPool().catch(() => {})
  })
