import { writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildSkillEmbeddingText,
  hashEmbeddingText,
  requestArkEmbeddings,
  type SkillEmbeddingEntry,
} from '../src/services/skillSearch/embeddings.js'
import type { SkillRegistryManifest } from '../src/services/skillSearch/registry.js'

const REGISTRY_FILE = 'skills-flat/skill-registry.json'
const OUTPUT_FILE = 'skills-flat/skill-embeddings.json'

async function main(): Promise<void> {
  const registryRaw = await Bun.file(REGISTRY_FILE).text()
  const registry = JSON.parse(registryRaw) as SkillRegistryManifest

  if (!Array.isArray(registry.skills) || registry.skills.length === 0) {
    throw new Error(`No skills found in ${REGISTRY_FILE}`)
  }

  const texts = registry.skills.map(buildSkillEmbeddingText)
  const result = await requestArkEmbeddings(texts)
  const embeddingDim = result.vectors[0]?.length ?? 0

  const items: SkillEmbeddingEntry[] = registry.skills.map((skill, index) => {
    const text = texts[index] ?? ''
    const vector = result.vectors[index] ?? []

    return {
      embeddingId: `${skill.skillId}:${skill.version}:${skill.sourceHash}:skill-summary`,
      skillId: skill.skillId,
      version: skill.version,
      sourceHash: skill.sourceHash,
      objectType: 'skill-summary',
      textHash: hashEmbeddingText(text),
      embeddingProvider: 'volcengine',
      embeddingModel: result.model,
      embeddingDim,
      vector,
    }
  })

  await writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(
      {
        schemaVersion: '2026-04-11',
        generatedAt: new Date().toISOString(),
        registryVersion: registry.registryVersion,
        embeddingProvider: 'volcengine',
        embeddingModel: result.model,
        embeddingDim,
        embeddingEndpoint: result.endpoint,
        itemCount: items.length,
        items,
      },
      null,
      2,
    )}\n`,
    'utf-8',
  )

  console.log(`Built skill embeddings with ${items.length} items at ${join(OUTPUT_FILE)}`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
