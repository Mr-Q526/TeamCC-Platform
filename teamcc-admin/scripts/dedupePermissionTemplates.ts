import 'dotenv/config'
import { Pool } from 'pg'

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://teamcc_admin:teamcc_admin_dev_password@localhost:5432/teamcc_admin'

async function main() {
  const pool = new Pool({ connectionString })
  const client = await pool.connect()

  try {
    await client.query('begin')

    const { rows: templates } = await client.query<{
      id: number
      name: string
    }>('select id, name from permission_templates order by id')

    const keepByName = new Map<string, number>()
    const remap = new Map<number, number>()

    for (const template of templates) {
      const keepId = keepByName.get(template.name)
      if (keepId) {
        remap.set(template.id, keepId)
      } else {
        keepByName.set(template.name, template.id)
      }
    }

    const { rows: assignments } = await client.query<{
      user_id: number
      project_id: number
      template_ids: string
    }>('select user_id, project_id, template_ids from user_assignments')

    for (const assignment of assignments) {
      const nextIds = [
        ...new Set(
          assignment.template_ids
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isInteger(value) && value > 0)
            .map((id) => remap.get(id) ?? id),
        ),
      ]

      const nextValue = nextIds.join(',')
      if (nextValue === assignment.template_ids) {
        continue
      }

      await client.query(
        `
          update user_assignments
          set template_ids = $1, updated_at = now()
          where user_id = $2 and project_id = $3
        `,
        [nextValue, assignment.user_id, assignment.project_id],
      )
    }

    for (const [duplicateId, keepId] of remap.entries()) {
      await client.query(
        `
          update audit_log
          set target_id = $1
          where target_type = 'template' and target_id = $2
        `,
        [keepId, duplicateId],
      )
    }

    const duplicateIds = [...remap.keys()]
    if (duplicateIds.length > 0) {
      await client.query(
        'delete from permission_templates where id = any($1)',
        [duplicateIds],
      )
    }

    await client.query(
      'create unique index if not exists permission_templates_name_idx on permission_templates (name)',
    )

    await client.query('commit')

    console.log(
      JSON.stringify(
        {
          deletedIds: duplicateIds,
          remap: Object.fromEntries(remap),
        },
        null,
        2,
      ),
    )
  } catch (error) {
    await client.query('rollback')
    console.error('Failed to dedupe permission templates:', error)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

void main()
