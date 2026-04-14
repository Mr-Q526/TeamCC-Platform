# TeamCC 审计日志语义规范提醒

## 1. 文档目的

本文档不是方案讨论稿，而是对当前实现的**提醒性规范**。

目标只有两个：

- 防止后续继续把内部埋点名直接暴露到管理后台。
- 防止客户端、服务端、前端再次各写一套不一致的审计语义。

适用范围：

- `TeamSkill-ClaudeCode` 客户端主动上报的审计事件
- `teamcc-admin` 后端 `/api/audit` 接收与归因逻辑
- `teamcc-admin` 前端审计页与仪表板展示

不适用范围：

- 后台 CRUD 资源审计（`create / update / delete`）
- 数据库表结构设计

---

## 2. 当前客户端审计事件规范

客户端允许进入 Admin 审计链路的事件名固定为：

- `boot`
- `login`
- `logout`
- `exit`
- `bash_command`
- `file_write`
- `command_execution_error`
- `permission_allow`
- `permission_ask`
- `permission_deny`
- `policy_violation`

### 强提醒

- 不要再把 `tool_permission_decision` 直接写进 Admin 审计表。
- `tool_permission_decision` 只允许继续存在于 analytics/telemetry 体系，不允许作为管理后台动作名展示。

---

## 3. targetType 规范

客户端事件的 `targetType` 固定收敛为：

- `session`
- `command`
- `file`
- `tool`
- `policy`

### 强提醒

- 服务端不得再把客户端事件统一硬写成 `cli_event`。
- 前端不得把所有客户端行为都显示成“CLI 事件”。
- `targetType` 必须原样落库，供前端做对象语义展示。

---

## 4. severity 归因规范

审计严重级别以服务端归因为准，客户端可以不传。

固定规则如下：

- `boot / login / logout / exit` -> `info`
- `bash_command / file_write` -> `info`
- `command_execution_error` -> `warning`
- `permission_allow` -> `info`
- `permission_ask` -> `warning`
- `permission_deny`
  - `Read / Glob / Grep` -> `warning`
  - `Edit / Write / Bash / WebFetch / WebSearch / NotebookEdit` -> `critical`
- `policy_violation` -> `critical`

### 强提醒

- 不要再把被拒绝的高风险工具尝试默认显示成 `info`。
- 如果客户端显式传入更高等级，服务端只允许保留更高值，不允许降级。

---

## 5. 管理后台展示规范

前端必须展示业务语义，而不是内部事件名。

### 动作文案

- `permission_allow` -> `已放行工具使用`
- `permission_ask` -> `触发权限确认`
- `permission_deny` -> `尝试使用被禁止的工具`
- `policy_violation` -> `策略违反`
- `exit` -> `会话退出`

### 对象文案

- `session` -> `会话`
- `command` -> `命令`
- `file` -> `文件`
- `tool` -> `工具`
- `policy` -> `策略`

### 行级摘要

前端应优先用 `details` 生成摘要，而不是只给一个“查看变更”按钮：

- `permission_deny`：显示工具名、目标、命中规则
- `permission_ask`：显示工具名与确认触发原因
- `permission_allow`：显示工具名与放行来源
- `bash_command`：显示命令类型与退出码
- `command_execution_error`：显示错误摘要

### 风险高亮

- `critical`：红色高亮
- `warning`：黄色/橙色弱高亮

### 仪表板统计

“安全违反”卡片当前统计口径为：

- `policy_violation`
- `permission_deny` 且 `severity = critical`

---

## 6. 开发禁忌

以下做法视为违规：

- 新增客户端事件时只改客户端、不改服务端联合类型。
- 新增服务端事件时只改后端、不补前端标签。
- 把内部埋点名直接暴露给管理员。
- 把所有拒绝事件都按 `info` 处理。
- 用“CLI 事件”这种泛化对象名掩盖真实对象语义。

---

## 7. 最小回归检查

每次改动审计链路后，至少手动验证以下场景：

1. `vendor_trash` 触发 `Bash` deny：
   - 动作为 `尝试使用被禁止的工具`
   - 对象为 `工具`
   - 详情里有 `Bash`、目标命令、命中规则
   - `severity = critical`

2. 普通读取触发 ask：
   - 动作为 `触发权限确认`
   - `severity = warning`

3. 正常允许事件：
   - 动作为 `已放行工具使用`
   - `severity = info`

4. 仪表板：
   - “安全违反”数量能统计高风险 deny

---

## 8. 相关实现位置

当前实现主要落在以下位置：

- `TeamSkill-ClaudeCode/src/bootstrap/teamccAudit.ts`
- `TeamSkill-ClaudeCode/src/hooks/toolPermission/permissionLogging.ts`
- `TeamSkill-ClaudeCode/src/hooks/toolPermission/handlers/interactiveHandler.ts`
- `teamcc-admin/src/api/audit.ts`
- `teamcc-admin/frontend/src/pages/AuditPage.tsx`
- `teamcc-admin/frontend/src/pages/Dashboard.tsx`

后续如果调整审计语义，必须同时检查以上链路。
