import { spawn } from 'child_process'
import { join } from 'path'
import { fileURLToPath } from 'url'
import {
  closeSkillFactPgPool,
  querySkillFactPg,
} from '../src/events/storage.js'
import { querySkillFeedbackAggregates } from '../src/aggregates/storage.js'
import { readSkillRetrievalFeatures } from '../src/retrieval/retrievalFeatures.js'

type CountRow = {
  count: string
}

type GroupCountRow = {
  key: string
  count: string
}

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const COMPOSE_FILE = join(PROJECT_ROOT, 'docker-compose.skill-data.yml')
const COMPOSE_PROJECT =
  process.env.SKILL_COMPOSE_PROJECT?.trim() || 'teamskill-claudecode'
const NEO4J_SERVICE = 'skill-neo4j'

function runDockerNeo4jQuery(cypher: string): Promise<string> {
  const user = process.env.SKILL_NEO4J_USER?.trim() || 'neo4j'
  const password =
    process.env.SKILL_NEO4J_PASSWORD?.trim() || 'skills_dev_password'

  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'compose',
        '-p',
        COMPOSE_PROJECT,
        '-f',
        COMPOSE_FILE,
        'exec',
        '-T',
        NEO4J_SERVICE,
        'cypher-shell',
        '-u',
        user,
        '-p',
        password,
        cypher,
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => {
      stdout += String(chunk)
    })
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) {
        resolve(stdout.trim())
        return
      }
      reject(new Error(stderr.trim() || `cypher-shell exited with ${code}`))
    })
  })
}

async function countSkillFactEvents(): Promise<{
  total: number
  byKind: Record<string, number>
}> {
  const total = await querySkillFactPg<CountRow>(
    'SELECT count(*)::text AS count FROM skill_fact_events',
  )
  const byKind = await querySkillFactPg<GroupCountRow>(`
SELECT fact_kind AS key, count(*)::text AS count
FROM skill_fact_events
GROUP BY fact_kind
ORDER BY fact_kind
`)

  return {
    total: Number(total.rows[0]?.count ?? 0),
    byKind: Object.fromEntries(
      byKind.rows.map(row => [row.key, Number(row.count)]),
    ),
  }
}

async function countFeedbackAggregates(): Promise<{
  total: number
  byScope: Record<string, number>
}> {
  const aggregates = await querySkillFeedbackAggregates({ limit: 1000 })
  const byScope: Record<string, number> = {}

  for (const aggregate of aggregates) {
    byScope[aggregate.scopeType] = (byScope[aggregate.scopeType] ?? 0) + 1
  }

  return {
    total: aggregates.length,
    byScope,
  }
}

async function inspectNeo4j(): Promise<Record<string, number | null>> {
  try {
    const output = await runDockerNeo4jQuery(`
MATCH (fa:FeedbackAggregate)
WITH count(fa) AS feedbackAggregates
MATCH (s:Skill)
WITH feedbackAggregates, count(s) AS skills
MATCH (sv:SkillVersion)
RETURN feedbackAggregates, skills, count(sv) AS skillVersions
`)
    const numbers = output.match(/\d+/g)?.map(Number) ?? []
    return {
      feedbackAggregates: numbers.at(-3) ?? null,
      skills: numbers.at(-2) ?? null,
      skillVersions: numbers.at(-1) ?? null,
    }
  } catch {
    return {
      feedbackAggregates: null,
      skills: null,
      skillVersions: null,
    }
  }
}

async function main(): Promise<void> {
  const [facts, aggregates, retrievalFeatures, neo4j] = await Promise.all([
    countSkillFactEvents(),
    countFeedbackAggregates(),
    readSkillRetrievalFeatures(),
    inspectNeo4j(),
  ])

  console.log(
    JSON.stringify(
      {
        skillFactEvents: facts,
        skillFeedbackAggregates: aggregates,
        neo4j,
        retrievalFeatures: retrievalFeatures
          ? {
              generatedAt: retrievalFeatures.generatedAt,
              aggregateGeneratedAt: retrievalFeatures.aggregateGeneratedAt,
              itemCount: retrievalFeatures.itemCount,
            }
          : null,
      },
      null,
      2,
    ),
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
