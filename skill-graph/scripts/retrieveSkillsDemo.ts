import { retrieveSkills } from '../src/retrieval/retrieveSkills.js'

async function main(): Promise<void> {
  const queryText = process.argv.slice(2).join(' ').trim() || '高端官网首页设计'
  const response = await retrieveSkills({
    queryText,
    queryContext: 'marketing landing homepage hero',
    cwd: process.cwd(),
    department: 'dept:frontend-platform',
    sceneHints: ['scene:homepage'],
    domainHints: ['frontend'],
    limit: 5,
  })

  console.log(JSON.stringify(response, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
