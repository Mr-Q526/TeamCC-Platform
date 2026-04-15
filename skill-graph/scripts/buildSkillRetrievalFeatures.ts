import {
  type SkillRetrievalFeatureBuildPreset,
  writeSkillRetrievalFeatures,
} from '../src/retrieval/retrievalFeatures.js'

function parsePreset(argv: string[]): SkillRetrievalFeatureBuildPreset | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--preset') {
      continue
    }

    const value = argv[index + 1]?.trim()
    if (value === 'canonical' || value === 'live' || value === 'experiment') {
      return value
    }
  }

  const envValue = process.env.SKILL_RETRIEVAL_FEATURE_PRESET?.trim()
  return envValue === 'canonical' || envValue === 'live' || envValue === 'experiment'
    ? envValue
    : undefined
}

async function main(): Promise<void> {
  const preset = parsePreset(process.argv.slice(2)) ?? 'canonical'
  const manifest = await writeSkillRetrievalFeatures({ preset })
  console.log(
    `Built ${preset} skill retrieval features with ${manifest.itemCount} skills for window ${manifest.window ?? 'n/a'}`,
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
