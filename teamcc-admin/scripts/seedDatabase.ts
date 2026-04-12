import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import {
  departments,
  levels,
  orgs,
  permissionTemplates,
  projects,
  roles,
  teams,
  userAssignments,
  users,
} from '../src/db/schema.js'
import { hashPassword } from '../src/services/auth.js'

async function resetData() {
  await db.execute(sql`
    TRUNCATE TABLE
      api_tokens,
      audit_log,
      teamcc_audit_logs,
      department_policies,
      user_assignments,
      users,
      permission_templates,
      projects,
      teams,
      roles,
      levels,
      departments,
      orgs
    RESTART IDENTITY
  `)
}

async function seed() {
  try {
    console.log('🌱 Resetting demo data...')
    await resetData()

    console.log('🌱 Seeding dictionaries...')
    await db.insert(orgs).values([
      { id: 1, name: 'teamcc', description: 'TeamCC Demo Organization' },
    ])

    await db.insert(departments).values([
      { id: 101, name: 'frontend', description: '前端开发' },
      { id: 102, name: 'backend', description: '后端开发' },
      { id: 103, name: 'operations', description: '运营部门' },
      { id: 104, name: 'outsourcing', description: '垃圾外包' },
    ])

    await db.insert(roles).values([
      { id: 201, name: 'frontend-developer', description: '前端开发工程师' },
      { id: 202, name: 'backend-developer', description: '后端开发工程师' },
      { id: 203, name: 'operations-admin', description: '运营管理员' },
      { id: 204, name: 'outsourcing-contractor', description: '外包协作' },
    ])

    await db.insert(levels).values([
      { id: 301, name: 'p4', description: 'P4 - 独立执行' },
      { id: 302, name: 'p5', description: 'P5 - 核心骨干' },
      { id: 303, name: 'ops', description: '业务运营岗' },
      { id: 304, name: 'vendor', description: '外包临时岗' },
    ])

    await db.insert(teams).values([
      { id: 1001, name: 'teamcc-frontend', description: 'TeamCC Demo 前端组' },
      { id: 1002, name: 'teamcc-backend', description: 'TeamCC Demo 后端组' },
      { id: 1003, name: 'growth-ops', description: 'TeamCC Demo 运营组' },
      { id: 1004, name: 'vendor-quarantine', description: '外包隔离组' },
    ])

    await db.insert(projects).values([
      { id: 1, name: 'teamcc-demoproject', code: 'teamcc-demoproject', status: 'active' },
    ])

    console.log('✓ Dictionaries seeded')

    console.log('🌱 Seeding templates...')
    const templatesData = [
      {
        name: '前端开发',
        description: '可读写前端页面、组件与样式文件，禁止触碰后端代码与数据库脚本。',
        rulesJson: JSON.stringify([
          { behavior: 'allow', tool: 'Read', content: '*frontend/**' },
          { behavior: 'allow', tool: 'Edit', content: '*frontend/**' },
          { behavior: 'allow', tool: 'Grep', content: '*frontend/**' },
          { behavior: 'allow', tool: 'Glob', content: '*frontend/**' },
          { behavior: 'deny', tool: 'Read', content: '*src/api/**' },
          { behavior: 'deny', tool: 'Edit', content: '*src/api/**' },
          { behavior: 'deny', tool: 'Read', content: '*src/db/**' },
          { behavior: 'deny', tool: 'Edit', content: '*src/db/**' },
          { behavior: 'ask', tool: 'Bash', content: 'npm run lint,npm run build' },
        ]),
        capabilitiesJson: JSON.stringify(['ui.preview', 'policy.preview.self']),
        envOverridesJson: JSON.stringify({
          PROJECT_NAME: 'teamcc-demoproject',
          WORKSPACE_SCOPE: 'frontend',
        }),
      },
      {
        name: '后端开发',
        description: '可读写 API、服务与数据库相关目录，禁止改动前端页面资源。',
        rulesJson: JSON.stringify([
          { behavior: 'allow', tool: 'Read', content: '*src/api/**' },
          { behavior: 'allow', tool: 'Edit', content: '*src/api/**' },
          { behavior: 'allow', tool: 'Read', content: '*src/services/**' },
          { behavior: 'allow', tool: 'Edit', content: '*src/services/**' },
          { behavior: 'allow', tool: 'Read', content: '*src/db/**' },
          { behavior: 'allow', tool: 'Edit', content: '*src/db/**' },
          { behavior: 'deny', tool: 'Read', content: '*frontend/src/**' },
          { behavior: 'deny', tool: 'Edit', content: '*frontend/src/**' },
          { behavior: 'ask', tool: 'Bash', content: 'npm run dev,npm run typecheck' },
        ]),
        capabilitiesJson: JSON.stringify(['api.debug', 'policy.preview.self']),
        envOverridesJson: JSON.stringify({
          PROJECT_NAME: 'teamcc-demoproject',
          WORKSPACE_SCOPE: 'backend',
        }),
      },
      {
        name: '运营部门',
        description: '只能处理运营素材和说明文档，不能碰代码与命令行。',
        rulesJson: JSON.stringify([
          { behavior: 'allow', tool: 'Read', content: '*assets/marketing/**' },
          { behavior: 'allow', tool: 'Edit', content: '*assets/marketing/**' },
          { behavior: 'allow', tool: 'Read', content: '*docs/ops/**' },
          { behavior: 'deny', tool: 'Read', content: '*src/**' },
          { behavior: 'deny', tool: 'Edit', content: '*src/**' },
          { behavior: 'deny', tool: 'Bash', content: '**' },
          { behavior: 'deny', tool: 'Write', content: '*src/**' },
        ]),
        capabilitiesJson: JSON.stringify(['campaign.dashboard']),
        envOverridesJson: JSON.stringify({
          PROJECT_NAME: 'teamcc-demoproject',
          WORKSPACE_SCOPE: 'operations',
        }),
      },
      {
        name: '垃圾外包',
        description: '演示最严限制账号，没有代码、命令或写入权限。',
        rulesJson: JSON.stringify([
          { behavior: 'deny', tool: 'Read', content: '**' },
          { behavior: 'deny', tool: 'Edit', content: '**' },
          { behavior: 'deny', tool: 'Write', content: '**' },
          { behavior: 'deny', tool: 'Bash', content: '**' },
          { behavior: 'deny', tool: 'WebFetch', content: '**' },
          { behavior: 'deny', tool: 'WebSearch', content: '**' },
        ]),
        capabilitiesJson: JSON.stringify([]),
        envOverridesJson: JSON.stringify({
          PROJECT_NAME: 'teamcc-demoproject',
          ACCOUNT_MODE: 'restricted',
        }),
      },
    ]

    const insertedTemplates = await db
      .insert(permissionTemplates)
      .values(
        templatesData.map((template) => ({
          ...template,
          status: 'active',
        })),
      )
      .returning({ id: permissionTemplates.id, name: permissionTemplates.name })

    const templateIdMap = Object.fromEntries(insertedTemplates.map((template) => [template.name, template.id]))
    console.log(`✓ Templates seeded (${insertedTemplates.length})`)

    console.log('🌱 Seeding users...')
    const passwordHash = await hashPassword('password123')
    const usersData = [
      {
        username: 'frontend_dev',
        email: 'frontend_dev@teamcc.local',
        orgId: 1,
        departmentId: 101,
        teamId: 1001,
        roleId: 201,
        levelId: 302,
        defaultProjectId: 1,
        roles: 'viewer',
        status: 'active',
      },
      {
        username: 'backend_dev',
        email: 'backend_dev@teamcc.local',
        orgId: 1,
        departmentId: 102,
        teamId: 1002,
        roleId: 202,
        levelId: 302,
        defaultProjectId: 1,
        roles: 'viewer',
        status: 'active',
      },
      {
        username: 'ops_admin',
        email: 'ops_admin@teamcc.local',
        orgId: 1,
        departmentId: 103,
        teamId: 1003,
        roleId: 203,
        levelId: 303,
        defaultProjectId: 1,
        roles: 'admin',
        status: 'active',
      },
      {
        username: 'vendor_trash',
        email: 'vendor_trash@teamcc.local',
        orgId: 1,
        departmentId: 104,
        teamId: 1004,
        roleId: 204,
        levelId: 304,
        defaultProjectId: 1,
        roles: 'viewer',
        status: 'active',
      },
    ]

    const insertedUsers = await db
      .insert(users)
      .values(usersData.map((user) => ({ ...user, passwordHash })))
      .returning({ id: users.id, username: users.username })

    const userIdMap = Object.fromEntries(insertedUsers.map((user) => [user.username, user.id]))
    console.log(`✓ Users seeded (${insertedUsers.length}, password: password123)`)

    console.log('🌱 Seeding assignments...')
    await db.insert(userAssignments).values([
      {
        userId: userIdMap.frontend_dev,
        projectId: 1,
        templateIds: String(templateIdMap['前端开发']),
      },
      {
        userId: userIdMap.backend_dev,
        projectId: 1,
        templateIds: String(templateIdMap['后端开发']),
      },
      {
        userId: userIdMap.ops_admin,
        projectId: 1,
        templateIds: String(templateIdMap['运营部门']),
      },
      {
        userId: userIdMap.vendor_trash,
        projectId: 1,
        templateIds: String(templateIdMap['垃圾外包']),
      },
    ])

    console.log('✓ Assignments seeded (4)')
    console.log('✅ Demo data ready for teamcc-demoproject')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

seed()
