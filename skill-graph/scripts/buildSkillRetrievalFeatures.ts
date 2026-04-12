import { writeSkillRetrievalFeatures } from '../src/retrieval/retrievalFeatures.js'

async function main(): Promise<void> {
  const manifest = await writeSkillRetrievalFeatures()
  console.log(
    `Built skill retrieval features with ${manifest.itemCount} skills for window ${manifest.window ?? 'n/a'}`,
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
