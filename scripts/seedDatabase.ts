/**
 * Seed database with comprehensive test data
 */
import { db } from '../src/db/index.js'
import {
  users,
  departments,
  teams,
  roles,
  levels,
  projects,
  orgs,
  permissionTemplates,
  userAssignments,
} from '../src/db/schema.js'
import { hashPassword } from '../src/services/auth.js'

async function seed() {
  try {
    console.log('🌱 Seeding database with comprehensive data...')

    // Seed organizations
    await db
      .insert(orgs)
      .values([
        { id: 10, name: 'org_tech_hub', description: 'Technology Organization' },
        { id: 20, name: 'org_business', description: 'Business Organization' },
      ])
      .onConflictDoNothing()

    console.log('✓ Organizations seeded')

    // Seed departments
    await db
      .insert(departments)
      .values([
        { id: 101, name: 'frontend', description: 'Frontend Development' },
        { id: 102, name: 'backend', description: 'Backend Development' },
        { id: 103, name: 'qa', description: 'Quality Assurance' },
        { id: 104, name: 'sre', description: 'Site Reliability Engineering' },
        { id: 105, name: 'data', description: 'Data & Analytics' },
        { id: 106, name: 'mobile', description: 'Mobile Development' },
        { id: 107, name: 'product', description: 'Product Management' },
        { id: 108, name: 'operations', description: 'Operations' },
      ])
      .onConflictDoNothing()

    console.log('✓ Departments seeded')

    // Seed roles
    await db
      .insert(roles)
      .values([
        { id: 201, name: 'frontend-developer', description: 'Frontend Developer' },
        { id: 202, name: 'java-developer', description: 'Backend Developer' },
        { id: 203, name: 'test-automation', description: 'QA Engineer' },
        { id: 204, name: 'devops-sre', description: 'DevOps/SRE' },
      ])
      .onConflictDoNothing()

    console.log('✓ Roles seeded')

    // Seed levels
    await db
      .insert(levels)
      .values([
        { id: 301, name: 'p3', description: 'P3 - Junior' },
        { id: 302, name: 'p4', description: 'P4 - Intermediate' },
        { id: 303, name: 'p5', description: 'P5 - Senior' },
        { id: 304, name: 'p6', description: 'P6 - Staff' },
        { id: 305, name: 'p7', description: 'P7 - Principal' },
      ])
      .onConflictDoNothing()

    console.log('✓ Levels seeded')

    // Seed teams
    await db
      .insert(teams)
      .values([
        { id: 1011, name: 'commerce-web', description: 'E-commerce Web Team' },
        { id: 1012, name: 'growth-mobile', description: 'Growth Mobile Team' },
        { id: 1013, name: 'admin-portal', description: 'Admin Portal Team' },
        { id: 1021, name: 'payment-infra', description: 'Payment Infrastructure' },
        { id: 1022, name: 'order-service', description: 'Order Service Team' },
        { id: 1051, name: 'data-platform', description: 'Data Platform Team' },
        { id: 1052, name: 'algorithm', description: 'Algorithm Team' },
        { id: 1071, name: 'product-growth', description: 'Product Growth' },
        { id: 1072, name: 'product-platform', description: 'Product Platform' },
      ])
      .onConflictDoNothing()

    console.log('✓ Teams seeded')

    // Seed projects
    await db
      .insert(projects)
      .values([
        { id: 1, name: 'TeamSkill ClaudeCode', code: 'teamcc' },
        { id: 7, name: 'Commerce Platform', code: 'commerce' },
        { id: 14, name: 'Payment System', code: 'payment' },
        { id: 21, name: 'Data Analytics', code: 'analytics' },
      ])
      .onConflictDoNothing()

    console.log('✓ Projects seeded')

    // Seed users
    const commonPassword = await hashPassword('password123')

    const usersList = [
      { username: 'admin', email: 'admin@example.com', deptId: 101, teamId: 1011, roleId: 201, levelId: 304 },
      { username: 'alice', email: 'alice@example.com', deptId: 101, teamId: 1011, roleId: 201, levelId: 303 },
      { username: 'bob', email: 'bob@example.com', deptId: 102, teamId: 1021, roleId: 202, levelId: 303 },
      { username: 'carol', email: 'carol@example.com', deptId: 102, teamId: 1022, roleId: 202, levelId: 302 },
      { username: 'david', email: 'david@example.com', deptId: 103, teamId: 1013, roleId: 203, levelId: 302 },
      { username: 'emma', email: 'emma@example.com', deptId: 104, teamId: 1021, roleId: 204, levelId: 303 },
      { username: 'frank', email: 'frank@example.com', deptId: 105, teamId: 1051, roleId: 202, levelId: 302 },
      { username: 'grace', email: 'grace@example.com', deptId: 106, teamId: 1012, roleId: 201, levelId: 302 },
      { username: 'henry', email: 'henry@example.com', deptId: 107, teamId: 1071, roleId: 202, levelId: 303 },
    ]

    for (const u of usersList) {
      await db
        .insert(users)
        .values({
          username: u.username,
          email: u.email,
          passwordHash: commonPassword,
          departmentId: u.deptId,
          teamId: u.teamId,
          roleId: u.roleId,
          levelId: u.levelId,
          defaultProjectId: 1,
          roles: u.username === 'admin' ? 'admin' : 'viewer',
          status: 'active',
        })
        .onConflictDoNothing()
    }

    console.log(`✓ Users seeded (${usersList.length} users, all password: password123)`)

    // Seed permission templates
    const templatesData = [
      {
        name: 'Frontend Developer',
        description: 'Standard permissions for frontend developers',
        rules: [
          { behavior: 'deny' as const, tool: 'Read', content: '*src/server/**' },
          { behavior: 'deny' as const, tool: 'Edit', content: '*src/server/**' },
          { behavior: 'allow' as const, tool: 'Read', content: '*src/client/**' },
          { behavior: 'allow' as const, tool: 'Edit', content: '*src/client/**' },
        ],
        capabilities: ['policy.read.crossProject:7'],
        envOverrides: { BACKEND_DIR: 'src/server/', FRONTEND_DIR: 'src/client/' },
      },
      {
        name: 'Backend Developer',
        description: 'Standard permissions for backend developers',
        rules: [
          { behavior: 'allow' as const, tool: 'Read', content: '*src/server/**' },
          { behavior: 'allow' as const, tool: 'Edit', content: '*src/server/**' },
          { behavior: 'deny' as const, tool: 'Read', content: '*src/client/**' },
          { behavior: 'deny' as const, tool: 'Edit', content: '*src/client/**' },
        ],
        capabilities: ['policy.read.crossProject:14'],
        envOverrides: { BACKEND_DIR: 'src/server/', DATABASE_HOST: 'db.internal' },
      },
      {
        name: 'QA Engineer',
        description: 'Read-only access for testing',
        rules: [
          { behavior: 'allow' as const, tool: 'Read', content: '**' },
          { behavior: 'deny' as const, tool: 'Edit', content: '**' },
          { behavior: 'deny' as const, tool: 'Write', content: '**' },
          { behavior: 'deny' as const, tool: 'Bash', content: '**' },
        ],
        capabilities: [],
        envOverrides: { TEST_ENV: 'true' },
      },
      {
        name: 'DevOps/SRE',
        description: 'Infrastructure and deployment access',
        rules: [
          { behavior: 'allow' as const, tool: 'Read', content: '**' },
          { behavior: 'allow' as const, tool: 'Edit', content: '*infra/**' },
          { behavior: 'allow' as const, tool: 'Bash', content: 'docker,kubectl,terraform' },
          { behavior: 'ask' as const, tool: 'Bash', content: 'rm -rf' },
        ],
        capabilities: ['policy.read.crossProject:7,14,21'],
        envOverrides: { CLUSTER: 'prod', NAMESPACE: 'default' },
      },
      {
        name: 'Data Analyst',
        description: 'Data access and analysis',
        rules: [
          { behavior: 'allow' as const, tool: 'Read', content: '*data/**' },
          { behavior: 'allow' as const, tool: 'Read', content: '*analytics/**' },
          { behavior: 'deny' as const, tool: 'Edit', content: '*data/sensitive/**' },
        ],
        capabilities: [],
        envOverrides: { DATABASE_READONLY: 'true' },
      },
    ]

    const templateIds: Record<string, number> = {}
    for (const t of templatesData) {
      const res = await db
        .insert(permissionTemplates)
        .values({
          name: t.name,
          description: t.description,
          rulesJson: JSON.stringify(t.rules),
          capabilitiesJson: JSON.stringify(t.capabilities),
          envOverridesJson: JSON.stringify(t.envOverrides),
          status: 'active',
        })
        .returning({ id: permissionTemplates.id })
        .onConflictDoNothing()

      if (res.length > 0) {
        templateIds[t.name] = res[0].id
      }
    }

    console.log(`✓ Permission templates seeded (${Object.keys(templateIds).length} templates)`)

    // Seed user assignments
    const assignmentsData = [
      { username: 'admin', projectId: 1, templates: ['Frontend Developer', 'Backend Developer'] },
      { username: 'alice', projectId: 1, templates: ['Frontend Developer'] },
      { username: 'alice', projectId: 7, templates: ['Frontend Developer'] },
      { username: 'bob', projectId: 1, templates: ['Backend Developer'] },
      { username: 'bob', projectId: 14, templates: ['Backend Developer'] },
      { username: 'carol', projectId: 14, templates: ['Backend Developer'] },
      { username: 'david', projectId: 1, templates: ['QA Engineer'] },
      { username: 'david', projectId: 7, templates: ['QA Engineer'] },
      { username: 'emma', projectId: 14, templates: ['DevOps/SRE'] },
      { username: 'frank', projectId: 21, templates: ['Data Analyst'] },
      { username: 'grace', projectId: 7, templates: ['Frontend Developer'] },
      { username: 'henry', projectId: 1, templates: ['Backend Developer'] },
    ]

    for (const a of assignmentsData) {
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.username, a.username),
      })

      if (user) {
        const tids = a.templates
          .map((t) => templateIds[t])
          .filter(Boolean)
          .join(',')

        if (tids) {
          await db
            .insert(userAssignments)
            .values({
              userId: user.id,
              projectId: a.projectId,
              templateIds: tids,
            })
            .onConflictDoNothing()
        }
      }
    }

    console.log(`✓ User assignments seeded (${assignmentsData.length} assignments)`)

    console.log('✅ Database seeded successfully!')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

seed()
