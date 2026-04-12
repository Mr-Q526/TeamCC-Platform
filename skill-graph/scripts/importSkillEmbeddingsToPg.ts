import { readFile } from 'fs/promises'
import { spawn } from 'child_process'
import { join } from 'path'
import { fileURLToPath } from 'url'

type SkillEmbeddingEntry = {
  embeddingId: string
  skillId: string
  version: string
  sourceHash: string
  objectType: string
  textHash: string
  embeddingProvider: string
  embeddingModel: string
  embeddingDim: number
  vector: number[]
}

type SkillEmbeddingsManifest = {
  schemaVersion: string
  generatedAt: string
  registryVersion: string
  embeddingProvider: string
  embeddingModel: string
  embeddingDim: number
  embeddingEndpoint: string
  itemCount: number
  items: SkillEmbeddingEntry[]
}

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const COMPOSE_FILE = join(PROJECT_ROOT, 'docker-compose.skill-data.yml')
const COMPOSE_PROJECT =
  process.env.SKILL_COMPOSE_PROJECT?.trim() || 'teamskill-claudecode'
const POSTGRES_SERVICE = 'skill-pg'
const EMBEDDINGS_FILE = join(
  PROJECT_ROOT,
  'skills-flat',
  'skill-embeddings.json',
)

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function vectorLiteral(vector: number[]): string {
  return `'[${vector.join(',')}]'`
}

async function runDockerComposePsql(sql: string): Promise<void> {
  const database = process.env.SKILL_PG_DATABASE?.trim() || 'skills'
  const user = process.env.SKILL_PG_USER?.trim() || 'skills'

  await new Promise<void>((resolve, reject) => {
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
        POSTGRES_SERVICE,
        'psql',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        user,
        '-d',
        database,
      ],
      {
        stdio: ['pipe', 'inherit', 'inherit'],
      },
    )

    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`psql exited with code ${code ?? -1}`))
    })

    child.stdin.write(sql)
    child.stdin.end()
  })
}

async function main(): Promise<void> {
  const raw = await readFile(EMBEDDINGS_FILE, 'utf8')
  const manifest = JSON.parse(raw) as SkillEmbeddingsManifest

  if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
    throw new Error(`No embeddings found in ${EMBEDDINGS_FILE}`)
  }

  const dimension = manifest.embeddingDim || manifest.items[0]?.vector.length || 0
  if (!dimension) {
    throw new Error('Could not resolve embedding dimension')
  }

  const setupSql = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS skill_embeddings (
  embedding_id text PRIMARY KEY,
  skill_id text NOT NULL,
  version text NOT NULL,
  source_hash text NOT NULL,
  object_type text NOT NULL,
  text_hash text NOT NULL,
  embedding_provider text NOT NULL,
  embedding_model text NOT NULL,
  embedding_dim integer NOT NULL,
  embedding vector(${dimension}) NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_embeddings_skill_id
  ON skill_embeddings (skill_id);

CREATE INDEX IF NOT EXISTS idx_skill_embeddings_provider_model
  ON skill_embeddings (embedding_provider, embedding_model);
`

  await runDockerComposePsql(setupSql)

  const batchSize = 10

  for (let index = 0; index < manifest.items.length; index += batchSize) {
    const batch = manifest.items.slice(index, index + batchSize)
    const valueRows = batch.map(item => {
      return `(
${sqlLiteral(item.embeddingId)},
${sqlLiteral(item.skillId)},
${sqlLiteral(item.version)},
${sqlLiteral(item.sourceHash)},
${sqlLiteral(item.objectType)},
${sqlLiteral(item.textHash)},
${sqlLiteral(item.embeddingProvider)},
${sqlLiteral(item.embeddingModel)},
${item.embeddingDim},
${vectorLiteral(item.vector)}::vector(${dimension}),
${sqlLiteral(manifest.generatedAt)}::timestamptz,
now(),
now()
)`
    })

    const upsertSql = `
INSERT INTO skill_embeddings (
  embedding_id,
  skill_id,
  version,
  source_hash,
  object_type,
  text_hash,
  embedding_provider,
  embedding_model,
  embedding_dim,
  embedding,
  generated_at,
  created_at,
  updated_at
)
VALUES
${valueRows.join(',\n')}
ON CONFLICT (embedding_id) DO UPDATE
SET
  skill_id = EXCLUDED.skill_id,
  version = EXCLUDED.version,
  source_hash = EXCLUDED.source_hash,
  object_type = EXCLUDED.object_type,
  text_hash = EXCLUDED.text_hash,
  embedding_provider = EXCLUDED.embedding_provider,
  embedding_model = EXCLUDED.embedding_model,
  embedding_dim = EXCLUDED.embedding_dim,
  embedding = EXCLUDED.embedding,
  generated_at = EXCLUDED.generated_at,
  updated_at = now();
`

    await runDockerComposePsql(upsertSql)
  }

  console.log(
    `Imported ${manifest.items.length} skill embeddings into PostgreSQL (${dimension} dims)`,
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
