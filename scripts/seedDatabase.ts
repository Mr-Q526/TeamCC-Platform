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
        { id: 101, name: 'frontend', description: '前端开发部' },
        { id: 102, name: 'backend', description: '后端开发部' },
        { id: 103, name: 'qa', description: '测试部' },
        { id: 104, name: 'sre', description: '可靠性工程部' },
        { id: 105, name: 'data', description: '数据部' },
        { id: 106, name: 'mobile', description: '移动开发部' },
        { id: 107, name: 'product', description: '产品部' },
        { id: 108, name: 'operations', description: '运营部' },
      ])
      .onConflictDoNothing()

    console.log('✓ Departments seeded')

    // Seed roles
    await db
      .insert(roles)
      .values([
        { id: 201, name: 'frontend-developer', description: '前端开发工程师' },
        { id: 202, name: 'java-developer', description: '后端开发工程师' },
        { id: 203, name: 'test-automation', description: '测试工程师' },
        { id: 204, name: 'devops-sre', description: '运维工程师' },
      ])
      .onConflictDoNothing()

    console.log('✓ Roles seeded')

    // Seed levels
    await db
      .insert(levels)
      .values([
        { id: 301, name: 'p3', description: 'P3 - 初级' },
        { id: 302, name: 'p4', description: 'P4 - 中级' },
        { id: 303, name: 'p5', description: 'P5 - 高级' },
        { id: 304, name: 'p6', description: 'P6 - 资深' },
        { id: 305, name: 'p7', description: 'P7 - 首席' },
      ])
      .onConflictDoNothing()

    console.log('✓ Levels seeded')

    // Seed teams
    await db
      .insert(teams)
      .values([
        { id: 1011, name: 'commerce-web', description: '商城Web团队' },
        { id: 1012, name: 'growth-mobile', description: '增长移动团队' },
        { id: 1013, name: 'admin-portal', description: '管理后台团队' },
        { id: 1021, name: 'payment-infra', description: '支付基础设施' },
        { id: 1022, name: 'order-service', description: '订单服务团队' },
        { id: 1051, name: 'data-platform', description: '数据平台团队' },
        { id: 1052, name: 'algorithm', description: '算法团队' },
        { id: 1071, name: 'product-growth', description: '产品增长团队' },
        { id: 1072, name: 'product-platform', description: '产品平台团队' },
      ])
      .onConflictDoNothing()

    console.log('✓ Teams seeded')

    // Seed projects
    await db
      .insert(projects)
      .values([
        { id: 1, name: 'TeamSkill ClaudeCode', code: 'teamcc' },
        { id: 7, name: '商城平台', code: 'commerce' },
        { id: 14, name: '支付系统', code: 'payment' },
        { id: 21, name: '数据分析', code: 'analytics' },
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
        name: '前端开发',
        description: '前端开发人员标准权限',
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
        name: '后端开发',
        description: '后端开发人员标准权限',
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
        name: '测试工程师',
        description: '测试人员只读权限',
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
        name: '运维工程师',
        description: '基础设施和部署权限',
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
        name: '数据分析师',
        description: '数据访问和分析权限',
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
