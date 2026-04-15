import { writeFile } from 'fs/promises'
import { resolve } from 'path'
import YAML from 'yaml'
import { listEvalCases, loadEvalCase } from '../src/evals/io.js'
import { getBenchmarkCasesDir } from '../src/evals/retrievalDatasets.js'
import { readGeneratedSkillRegistry } from '../src/registry/registry.js'

type CliOptions = {
  casesDir: string
}

const PROJECT_ROOT = resolve(process.cwd())

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    casesDir: getBenchmarkCasesDir(PROJECT_ROOT),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    if (arg === '--cases-dir' && next) {
      options.casesDir = resolve(next)
      index += 1
    }
  }

  return options
}

function departmentForSkill(departmentTags: string[]): string | null {
  const first = departmentTags[0]?.trim()
  if (!first) {
    return null
  }
  return first.startsWith('dept:') ? first : `dept:${first}`
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const registry = await readGeneratedSkillRegistry(resolve(PROJECT_ROOT, 'skills-flat'))
  if (!registry) {
    throw new Error('Missing skill registry at skills-flat/skill-registry.json')
  }

  const registryById = new Map(registry.skills.map(skill => [skill.skillId, skill] as const))
  const files = await listEvalCases(options.casesDir)

  let updated = 0

  for (const filePath of files) {
    const evalCase = await loadEvalCase(filePath)
    if (evalCase.caseType !== 'retrieval') {
      continue
    }

    const targetSkillId = evalCase.expected.mustHitSkillIds[0]
    if (!targetSkillId) {
      continue
    }

    const skill = registryById.get(targetSkillId)
    if (!skill) {
      continue
    }

    const expectedDepartment = departmentForSkill(skill.departmentTags)
    if ((evalCase.query.department ?? null) === expectedDepartment) {
      continue
    }

    const nextCase = {
      ...evalCase,
      query: {
        ...evalCase.query,
        department: expectedDepartment,
      },
    }

    const body = YAML.stringify(nextCase).replace(
      /^schemaVersion: 2026-04-12$/m,
      'schemaVersion: "2026-04-12"',
    )
    await writeFile(filePath, body, 'utf-8')
    updated += 1
  }

  console.log(
    JSON.stringify(
      {
        casesDir: options.casesDir,
        updated,
      },
      null,
      2,
    ),
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
