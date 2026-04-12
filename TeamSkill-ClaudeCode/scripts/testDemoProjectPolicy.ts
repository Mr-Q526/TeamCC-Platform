/**
 * 集成测试：在 teamcc-demoproject 中验证身份策略权限鉴权
 *
 * 场景：前端开发者(dept=101, level=301) 尝试操作 backend/ 目录 和 使用 ssh
 * 预期：backend 相关操作被阻断，ssh 被阻断
 */

import { join } from 'path'
import { mkdirSync, writeFileSync, existsSync } from 'fs'

// ---- 目标项目路径 ----
const DEMO_PROJECT = '/Users/minruiqing/MyProjects/teamcc-demoproject'

// ---- 自动初始化测试环境（在目标项目写入 .claude 配置）----
function setupDemoProjectClaudeEnv() {
  const claudeDir = join(DEMO_PROJECT, '.claude')
  const identityDir = join(claudeDir, 'identity')
  const policiesDir = join(claudeDir, 'policies')

  mkdirSync(identityDir, { recursive: true })
  mkdirSync(policiesDir, { recursive: true })

  // 身份文件：前端开发者
  writeFileSync(
    join(identityDir, 'active.md'),
    `---
org: 1
department: 101
team: 1011
role: 201
level: 301
---

# 当前身份

此文件由系统自动生成，标识当前执行者的数字化组织身份。
`
  )

  // project-env.json：后端目录就叫 backend/
  writeFileSync(
    join(claudeDir, 'project-env.json'),
    JSON.stringify({
      _comment: 'teamcc-demoproject 项目目录映射',
      BACKEND_DIR: 'backend/',
      FRONTEND_DIR: 'frontend/',
    }, null, 2)
  )

  // department-101.json：前端部禁止操作后端目录
  writeFileSync(
    join(policiesDir, 'department-101.json'),
    JSON.stringify({
      _comment: '前端部门 (department_id: 101) 禁止操作后端代码目录',
      permissions: {
        deny: [
          'Bash(cd *{{BACKEND_DIR}}*)',
          'Bash(ls *{{BACKEND_DIR}}*)',
          'Bash(cat *{{BACKEND_DIR}}*)',
          'Bash(grep *{{BACKEND_DIR}}*)',
          'Bash(find *{{BACKEND_DIR}}*)',
          'ReadFile(*{{BACKEND_DIR}}*)',
          'Edit(*{{BACKEND_DIR}}*)',
          'Write(*{{BACKEND_DIR}}*)',
          'MultiEdit(*{{BACKEND_DIR}}*)',
          'Glob(*{{BACKEND_DIR}}*)',
        ],
      },
    }, null, 2)
  )

  // level-301.json：P3 禁用 ssh
  writeFileSync(
    join(policiesDir, 'level-301.json'),
    JSON.stringify({
      _comment: 'P3 初级职员 (level_id: 301) 禁止使用高危远程工具',
      permissions: {
        deny: [
          'Bash(ssh *)',
          'Bash(scp *)',
          'Bash(sftp *)',
        ],
      },
    }, null, 2)
  )

  console.log(`✓ 测试环境配置完成：${claudeDir}`)
}

// ---- 规则匹配验证工具（模拟 CC 内核匹配逻辑）----
// CC 使用 bashPermissions.ts 进行前缀匹配，这里重现核心逻辑
function ruleContentMatchesCommand(ruleContent: string, command: string): boolean {
  // 'ssh *' → 前缀 'ssh ' 任意后缀
  // 'ls *backend/*' → 包含 backend/
  const normalized = ruleContent
    .replace(/\*/g, '.*')        // * → .*
    .replace(/\?/g, '.')         // ? → .
  try {
    return new RegExp(`^${normalized}$`).test(command)
  } catch {
    return command.includes(ruleContent.replace(/\*/g, ''))
  }
}

type PermissionRule = {
  source: string
  ruleBehavior: 'deny' | 'allow' | 'ask'
  ruleValue: { toolName: string; ruleContent?: string }
}

function checkDenyRules(rules: PermissionRule[], toolName: string, command: string): PermissionRule | null {
  for (const rule of rules) {
    if (rule.ruleBehavior !== 'deny') continue
    if (rule.ruleValue.toolName !== toolName) continue
    const rc = rule.ruleValue.ruleContent
    if (!rc) {
      // bare tool deny (整个工具被禁)
      return rule
    }
    if (ruleContentMatchesCommand(rc, command)) {
      return rule
    }
  }
  return null
}

// ---- 主测试 ----
async function runTests() {
  console.log('\n=== teamcc-demoproject 权限鉴权集成测试 ===\n')

  // 初始化 .claude 目录
  setupDemoProjectClaudeEnv()
  console.log()

  let passed = 0; let failed = 0
  function assert(cond: boolean, msg: string) {
    if (cond) { console.log(`  ✓ ${msg}`); passed++ }
    else { console.error(`  ✗ FAIL: ${msg}`); failed++ }
  }

  // 加载策略
  const { loadIdentityPolicyRules, resetIdentityPolicyCache } = await import(
    '../src/utils/permissions/identityPolicyLoader.js'
  )
  resetIdentityPolicyCache()

  const rules = await loadIdentityPolicyRules(DEMO_PROJECT, {
    departmentId: 101,
    levelId: 301,
  })

  console.log(`  加载规则总数：${rules.length}`)
  const denyRules = rules.filter(r => r.ruleBehavior === 'deny')
  console.log(`  其中 deny 规则：${denyRules.length}`)
  console.log()

  // ----------------------------------------------------------------
  // 场景 A：前端开发者 尝试操作 backend/ 目录
  // ----------------------------------------------------------------
  console.log('【场景 A】前端访问后端目录 → 预期：全部拒绝')

  const backendExpandedTests: Array<[string, string]> = [
    ['ls backend/app', 'ls backend/ 目录列表'],
    ['cat backend/app/main.py', 'cat 后端源码文件'],
    ['grep "password" backend/app/config.py', 'grep 后端配置文件'],
    ['find backend/ -name "*.py"', 'find 后端目录'],
    ['cd backend/app', 'cd 进入后端目录'],
  ]

  for (const [cmd, desc] of backendExpandedTests) {
    const hit = checkDenyRules(denyRules, 'Bash', cmd)
    assert(hit !== null, `[Bash] ${desc} 被拒绝 (规则: ${hit?.ruleValue.ruleContent ?? 'N/A'})`)
  }

  // ReadFile / Edit / Write / Glob 也要被拦截
  const fileToolTests: Array<[string, string, string]> = [
    ['ReadFile', 'backend/app/main.py', 'ReadFile 读取后端文件'],
    ['Edit', 'backend/app/routes.py', 'Edit 修改后端文件'],
    ['Write', 'backend/app/new.py', 'Write 写入后端新文件'],
    ['Glob', 'backend/**/*.py', 'Glob 查找后端文件'],
  ]

  for (const [tool, arg, desc] of fileToolTests) {
    const hit = checkDenyRules(denyRules, tool, arg)
    assert(hit !== null, `[${tool}] ${desc} 被拒绝`)
  }

  // 前端目录 → 应该放行（不在 deny 规则命中范围）
  console.log()
  console.log('【场景 A 反向】前端访问前端目录 → 预期：不被拒绝')
  const frontendTests: Array<[string, string]> = [
    ['ReadFile', 'frontend/src/App.vue'],
    ['Edit', 'frontend/src/components/Header.vue'],
    ['Bash', 'ls frontend/src'],
  ]
  for (const [tool, arg] of frontendTests) {
    const hit = checkDenyRules(denyRules, tool, arg)
    assert(hit === null, `[${tool}] ${arg} 不在拦截范围`)
  }
  console.log()

  // ----------------------------------------------------------------
  // 场景 B：P3 职员 尝试使用 SSH
  // ----------------------------------------------------------------
  console.log('【场景 B】P3 初级职员使用高危工具 → 预期：全部拒绝')

  const sshTests: Array<[string, string]> = [
    ['ssh root@10.0.0.1', 'SSH 登录生产服务器'],
    ['ssh -i ~/.ssh/id_rsa ubuntu@production.company.com', 'SSH 用密钥登录'],
    ['scp ./dist.zip root@10.0.0.1:/var/www/', 'SCP 上传文件至生产'],
    ['sftp user@fileserver.com', 'SFTP 连接文件服务器'],
  ]

  for (const [cmd, desc] of sshTests) {
    const hit = checkDenyRules(denyRules, 'Bash', cmd)
    assert(hit !== null, `[Bash] ${desc} 被拒绝`)
  }
  console.log()

  // ----------------------------------------------------------------
  // 结果汇总
  // ----------------------------------------------------------------
  console.log('=== 鉴权测试结果 ===')
  console.log(`  通过: ${passed}`)
  console.log(`  失败: ${failed}`)
  if (failed === 0) {
    console.log('\n  ✓ 所有场景鉴权验证通过！身份策略系统运行正常。')
  } else {
    console.error('\n  ✗ 存在鉴权验证失败，请检查策略配置。')
    process.exit(1)
  }
}

runTests().catch(err => {
  console.error('测试崩溃:', err)
  process.exit(1)
})
