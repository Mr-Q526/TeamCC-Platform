import { join } from 'path'
import { z } from 'zod/v4'
import { attachAnalyticsSink } from '../src/services/analytics/index.js'
import { setIdentityProfile } from '../src/bootstrap/state.js'
import { checkReadPermissionForTool } from '../src/utils/permissions/filesystem.js'
import type { ToolPermissionContext, PermissionRuleSource } from '../src/Tool.js'

let lastEvent: any = null

attachAnalyticsSink({
  logEvent: (eventName, metadata) => {
    if (eventName === 'tool_permission_decision') {
      lastEvent = { eventName, metadata }
      console.log(`[后台审计埋点网关] 截获事件: ${eventName}`)
      console.dir(metadata)
    }
  },
  logEventAsync: async (eventName, metadata) => {}
})

async function run() {
  setIdentityProfile({
    userId: 100234,
    orgId: 1,
    departmentId: 101, // 前端
    teamId: 1011,
    roleId: 201,
    levelId: 101,
    projectId: 1000
  })

  // Provide exactly what getRuleByContentsForToolName expects
  const emptySources = {
    policySettings: [],
    claudeCodeSettings: [],
    workspaceSettings: [],
    projectSettings: []
  }

  const mockContext = {
    permissions: [],
    alwaysDenyRules: {
      ...emptySources,
      policySettings: ['ReadFile(*backend*)']
    },
    alwaysAskRules: { ...emptySources },
    alwaysAllowRules: { ...emptySources },
    getUnapprovedCommands: () => [],
    recordUnapprovedCommand: () => {},
  } as unknown as ToolPermissionContext

  console.log("\n【测试项 2：在未授权项目中操作 (读取 backend)】")
  lastEvent = null
  const result2 = checkReadPermissionForTool('backend/app/main.py', mockContext)
  console.log("-> 拦截结果:", result2.message)
  if (!lastEvent) throw new Error("审计事件未发射")

  console.log("\n✅ 文件类安全审计打点测试通过！闭环完成！")
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
