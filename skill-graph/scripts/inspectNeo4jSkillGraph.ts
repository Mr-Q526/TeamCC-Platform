import { spawn } from 'child_process'

type QuerySpec = {
  name: string
  cypher: string
}

const QUERIES: QuerySpec[] = [
  {
    name: 'nodeCounts',
    cypher: 'MATCH (n) RETURN labels(n) AS labels, count(n) AS count ORDER BY labels',
  },
  {
    name: 'relationshipCounts',
    cypher: 'MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY type',
  },
  {
    name: 'orphanSkills',
    cypher:
      'MATCH (s:Skill) WHERE NOT (s)-[:HAS_VERSION]->(:SkillVersion) RETURN count(s) AS count',
  },
  {
    name: 'skillsWithoutDomain',
    cypher:
      'MATCH (s:Skill) WHERE NOT (s)-[:IN_DOMAIN]->(:Domain) RETURN count(s) AS count',
  },
  {
    name: 'skillsWithoutScene',
    cypher:
      'MATCH (s:Skill) WHERE NOT (s)-[:APPLIES_TO_SCENE]->(:Scene) RETURN count(s) AS count',
  },
  {
    name: 'skillsWithoutDepartment',
    cypher:
      'MATCH (s:Skill) WHERE NOT (s)-[:BELONGS_TO_DEPARTMENT]->(:Department) RETURN count(s) AS count',
  },
  {
    name: 'genericAliasTop10',
    cypher:
      'MATCH (a:Alias)-[r:ALIASES_SKILL]->(:Skill) WITH a, count(r) AS edgeCount, avg(coalesce(r.weight, 1.0)) AS avgWeight RETURN a.name AS alias, coalesce(a.isGeneric, false) AS isGeneric, coalesce(a.skillCount, edgeCount) AS skillCount, edgeCount, avgWeight ORDER BY skillCount DESC, edgeCount DESC LIMIT 10',
  },
  {
    name: 'feedbackTop10',
    cypher:
      'MATCH (fa:FeedbackAggregate)-[:FOR_SKILL]->(s:Skill) WHERE fa.scopeType = "global" RETURN s.skillId AS skillId, fa.qualityScore AS qualityScore, fa.confidence AS confidence, fa.sampleCount AS sampleCount ORDER BY qualityScore DESC, confidence DESC LIMIT 10',
  },
]

function runCypher(cypher: string): Promise<string> {
  const user = process.env.SKILL_NEO4J_USER?.trim() || 'neo4j'
  const password =
    process.env.SKILL_NEO4J_PASSWORD?.trim() || 'skills_dev_password'

  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'exec',
        'teamskill-skill-neo4j',
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

async function main(): Promise<void> {
  for (const query of QUERIES) {
    const output = await runCypher(query.cypher)
    console.log(`\n## ${query.name}`)
    console.log(output)
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
