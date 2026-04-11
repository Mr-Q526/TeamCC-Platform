/**
 * Seed database with initial test data
 */
import { db } from '../src/db/index.js'
import {
  users,
  departments,
  teams,
  roles,
  levels,
  projects,
  permissionTemplates,
  userAssignments,
} from '../src/db/schema.js'
import { hashPassword } from '../src/services/auth.js'

async function seed() {
  try {
    console.log('🌱 Seeding database...')

    // Seed departments
    const deptResults = await db
      .insert(departments)
      .values([
        { id: 101, name: 'frontend', description: 'Frontend Team' },
        { id: 102, name: 'backend', description: 'Backend Team' },
        { id: 103, name: 'qa', description: 'QA Team' },
        { id: 104, name: 'sre', description: 'SRE Team' },
      ])
      .onConflictDoNothing()

    console.log('✓ Departments seeded')

    // Seed roles
    await db
      .insert(roles)
      .values([
        { id: 201, name: 'frontend-developer' },
        { id: 202, name: 'backend-developer' },
        { id: 203, name: 'qa-engineer' },
        { id: 204, name: 'devops-sre' },
      ])
      .onConflictDoNothing()

    console.log('✓ Roles seeded')

    // Seed levels
    await db
      .insert(levels)
      .values([
        { id: 301, name: 'p3' },
        { id: 302, name: 'p4' },
        { id: 303, name: 'p5' },
      ])
      .onConflictDoNothing()

    console.log('✓ Levels seeded')

    // Seed teams
    await db
      .insert(teams)
      .values([
        { id: 1011, name: 'commerce-web' },
        { id: 1021, name: 'payment-infra' },
        { id: 1051, name: 'data-platform' },
      ])
      .onConflictDoNothing()

    console.log('✓ Teams seeded')

    // Seed projects
    await db
      .insert(projects)
      .values([
        { id: 1, name: 'TeamSkill ClaudeCode', code: 'teamcc' },
        { id: 7, name: 'Project Alpha', code: 'proj-alpha' },
        { id: 14, name: 'Project Beta', code: 'proj-beta' },
      ])
      .onConflictDoNothing()

    console.log('✓ Projects seeded')

    // Seed test user
    const passwordHash = await hashPassword('password123')
    await db
      .insert(users)
      .values({
        username: 'admin',
        email: 'admin@example.com',
        passwordHash,
        departmentId: 101,
        teamId: 1011,
        roleId: 201,
        levelId: 302,
        defaultProjectId: 1,
        roles: 'admin',
        status: 'active',
      })
      .onConflictDoNothing()

    console.log('✓ Users seeded (admin/password123)')

    // Seed permission template
    const templateRes = await db
      .insert(permissionTemplates)
      .values({
        name: 'Frontend Developer',
        description: 'Standard permissions for frontend developers',
        rulesJson: JSON.stringify([
          {
            behavior: 'deny',
            tool: 'Read',
            content: '*src/server/**',
          },
          {
            behavior: 'allow',
            tool: 'Read',
            content: '*src/client/**',
          },
        ]),
        capabilitiesJson: JSON.stringify(['policy.read.crossProject:7']),
        envOverridesJson: JSON.stringify({
          BACKEND_DIR: 'src/server/',
          FRONTEND_DIR: 'src/client/',
        }),
        status: 'active',
      })
      .returning({ id: permissionTemplates.id })

    console.log('✓ Permission templates seeded')

    // Assign template to user for project 1
    if (templateRes.length > 0) {
      await db
        .insert(userAssignments)
        .values({
          userId: 1,
          projectId: 1,
          templateIds: String(templateRes[0].id),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing()

      console.log('✓ User assignments seeded')
    }

    console.log('✅ Database seeded successfully!')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

seed()
