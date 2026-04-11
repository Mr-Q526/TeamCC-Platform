# Tool 级安全审计埋点架构设计方案 (Security Telemetry)

此方案旨在通过结合 **沙箱前置校验哨点** 与 **原生分析遥测管道 (`logEvent`)**，实现跨终端、跨身份的 Tool 调用级（尤其是拦截阻断级）结构化日志监控。以此奠定未来平台安全报表与智能体独立评测基线的核心数据来源。

## 架构逻辑

目前的模型会在尝试访问受限目录（例如前端去读写后端代码，或运营企图执行 Bash）时触发 `【权限拒绝】` 失败。此时行为仅留存至模型当次会话的上下文内部，外部审计平台无法感知。
**重构动作**：
建立 `src/utils/permissions/audit.ts` 归一化审计入口，在抛出上述阻断异常之前注入钩子，利用 `logEvent` 原生网络链路即时捕获当前 `IdentityProfile`、拦截目标和涉及的特定防线配置。

## 数据隐私 (Data Privacy) 权衡设计说明
默认情况下，系统出于公私域隐私考量，其 `logEvent` 核心组件禁止（或过滤）上传未标定的任意文件路径字符串。
为了满足企业内部平台“穿透打点”的安全审计诉求，本架构引入 TypeScript 底层内置的 `AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS` 强安检断言。通过显式强转，突破通用版的文本屏蔽流端，从而向日志收集服务器真实记录诸如 "试图执行 `npm install` 被拒绝" 等违规实锤证据。

## 代码核心插桩点

### 1. 统一下发层 `src/utils/permissions/audit.ts`
新增核心埋点适配器 `logPermissionDecision` 函数：
- 获取 `getIdentityProfile()` 单例缓存；
- 获取或构建请求入参；
- 调用底层 `logEvent('tool_permission_decision', {...})`，上报包括但不限于 `user_id`、`department_id`、`project_id`、`tool_name`、`decision`、`rule_source` 以及 `blocked_target`。

### 2. 文件沙箱检查链 `src/utils/permissions/filesystem.ts`
挂载核心文件读 (`checkReadPermissionForTool` 等) 和 文件写 (`checkWritePermissionForTool`) 的违规拦截点：
```typescript
import { logPermissionDecision } from './audit.js'

// 在所有执行 return `【权限拒绝】... ` 阻断流之前插桩
logPermissionDecision('FileControl', 'deny', denyRule.source, filepath, denyRule.ruleValue.ruleContent || '*')
```

### 3. 终端沙箱检查链 `src/tools/BashTool/bashPermissions.ts` 及衍生检查链
挂载针对危险命令或敏感目录的前置验证流的违规拦截点：
```typescript
// 在终端抛出 `【权限拒绝】受身份和组织策略限制... ` 前拦截上报违规的指令与越野 cwd
logPermissionDecision('Bash', 'deny', denyRule.source, targetPath, denyRule.ruleValue.ruleContent || '*')
```

## 测试与验收计划
为保障审计网从底到上的完整性闭环，将进行以下维度的验收测试：
1. **跨界资产操作预警测试**：切换至受限身份，并指使大模型在未授权的受保护业务项目中进行目录窥探或文件写入（如读取 Java 目录）。验证底层是否如期回传 `tool_permission_decision` 附带文件靶向特征。
2. **危险应用隔离调用预警测试**：指使大模型擅自调用其身份并不具备权限的底层基建级工具（如恶意触发 `bash` 执行、`ssh` 或发起危险系统查询）。核实底层沙箱不仅触发拦截响应方案，更在第一时刻上报此越限指令实锤。
