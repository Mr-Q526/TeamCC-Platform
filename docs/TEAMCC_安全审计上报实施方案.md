# TeamCC 大规模安全审计上报实施方案 (Audit Trail)

## 1. 业务背景

当前 Claude Code 默认架构下的各类工具（Tools）调用记录（如 `BashTool` 的 Shell 终端命令执行、`FileWriteTool` 源码修改等）虽会在前端组件及 `src/services/analytics/index.js` 留下本地的 `tengu_*` 埋点记录（Telemetry），但这些日志会发往官方后台或停留在主机本地。

企业管理平台（TeamCC）出于数据与资产安全管控（合规要求），需要明确知道**哪一名员工在什么时间，通过 AI 的自动化流程操控服务器或本地设备执行了什么存在潜在安全风险的高危指令（如 `ssh` 生产环境、执行 `rm -rf` 等）**。

因此，我们需要将系统底层敏感工具引擎的调用脉络进行截获，并实时上报至 TeamCC Admin 审计后台接口（Audit Logs）中。

---

## 2. 系统切入点调研 (Research)

根据现有的工具包源码查档（基于 `src/tools/BashTool/BashTool.tsx` 等实现逻辑）：
1. 所有的 Tool 工具类调用都派生自标准或相似的组件执行流，如 `BashTool` 在调用完成前后，会显式调用 `logEvent('tengu_bash_tool_command_executed', { ... })` 完成内置数据留存。
2. 目前的身份鉴权隔离已经完备。本地位于 `~/.claude/cache/identity.json` 中明确存有当前用户的唯一性画像：
   ```json
   {
      "subject": {
         "username": "user-1",
         "departmentId": "frontend/commerce-web"
      }
   }
   ```

## 3. 技术实现架构 (Architecture)

### 3.1. 构建独立的审计管道 (`src/bootstrap/teamccAudit.ts`)

为了与官方原本的 `analytics` 遥测逻辑完全脱耦，我们将创建独立的 TeamCC 审计通道组件。核心代码应具有低延迟（Fire-and-Forget，不阻塞大模型的 Tool 流）和离线优雅降级的能力：

```typescript
// Proposed Code: src/bootstrap/teamccAudit.ts
import { loadCachedIdentity } from './teamccAuth.js'

export async function reportAuditLog(toolName: string, payload: Record<string, any>) {
  try {
    const identity = await loadCachedIdentity(process.cwd())
    if (!identity) return // 未登录或非 TeamCC 环境则跳过

    const adminUrl = process.env.TEAMCC_ADMIN_URL || 'http://127.0.0.1:3000'
    const auditData = {
      timestamp: new Date().toISOString(),
      user: identity.subject.username,
      department: identity.subject.departmentId,
      tool: toolName,
      details: payload,
    }

    // 采用异步后台推送策略，切勿抛出异常阻塞正常调用
    fetch(`${adminUrl}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auditData),
    }).catch(() => {})
  } catch (e) {
    // Audit failed quietly
  }
}
```

### 3.2. 重点工具挂载改造 (Tool Hooks)

通过排查，目前需要受到审计监控的安全敞口通常集中在下面几个高频强功能性的底层接口。

我们将直接在这几个文件的核心执行（`call` / `run` 函数）体内并排追加我们的 `reportAuditLog` 触发。

*   **终端命令执行 (BashTool)**
    *   **文件路径**: `src/tools/BashTool/BashTool.tsx` 
    *   **挂载场景**: 约在 755 行左右官方的 `tengu_bash_tool_command_executed` 触发附近。
    *   **采集数据 (Payload)**: `command`（执行的完整 bash 语句）, `exitCode`（执行结果）。
*   **代码及文件修改 (FileWriteTool 等)**
    *   **文件路径**: `src/tools/FileWriteTool/FileWriteTool.ts`
    *   **挂载场景**: 完成 `fs.writeFile` 或内容覆写时。
    *   **采集数据 (Payload)**: `absolutePath`（目标文件绝对路径）以及新内容的哈希结构。
*   **读取或运行脚本**
    *   **文件路径**: `src/tools/PowerShellTool/PowerShellTool.tsx` (如果是 Windows 跨端开发环境)。

### 3.3. 后端审计系统呈现配合 (TeamCC Admin)

在你的后端 Node.JS 系统（或微服务）中，需要开辟接口 `/api/audit` 来接管日志缓冲池，提供可视化视图给管理者：
*   **追踪关联**: 推荐根据 `conversation-id` 进行审计树展示，这可以帮助审查管理员顺藤摸瓜找到是那一次大语言模型的规划和回复引出了该高危动作。
*   **通知预警**: 如果在 `auditData.details.command` 中正则匹配到 `ssh production` 等极高危词条，可以在 TeamCC 后端直接触发飞书/钉钉的机器人即时告警。

---

## 4. 实施阶段分解 (Phase steps)

如果你确认基于以上调研和思路进行系统化改造，可以随时批准我进行代码编写：
*   [ ] 第一阶段：编写并在内核中导出低阻断的 `teamccAudit.ts`。
*   [ ] 第二阶段：在 `BashTool` 中拦截执行参数并抛出日志到新接口。
*   [ ] 第三阶段：扩展到 `Command` 和其他高危工具组件（如 `PowerShellTool`, `FileWriteTool`）。
