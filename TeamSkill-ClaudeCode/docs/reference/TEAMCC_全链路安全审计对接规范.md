# TeamCC 全链路安全审计对接规范 (Audit Trail)

本文档旨在明确 Claude Code 客户端（TeamCC）与管理后台服务端（Admin）在敏感操作追踪与审计上报工程中的核心交互规约。

---

## 1. 客户端侧行动纲领 (TeamCC Client 端实施规范)

客户端（Claude Code）作为第一线的行为捕获器，将负责在不阻塞主干业务的前提下，向 Admin 推送埋点信号。

### 1.1 新增底层网络投递信使模块
**建设 `src/bootstrap/teamccAudit.ts`**
*   **非阻塞投递**：基于 `Fetch API` 构建 Fire-and-Forget 数据流投递机制。
*   **容错降级**：当内网失联或服务宕机时，`catch` 到任何投掷失败事件均静默吞没，保证开发人员的 CLI 体验不被网络故障中断。
*   **强制鉴权提取**：该信使组件每次调用前必须从 `src/bootstrap/teamccAuth.ts` 中解析并提取缓存的 **AccessToken**，上报时将其携带在 `Headers -> Authorization: Bearer <token>` 下。

### 1.2 关键行为挂载钩子 (Hooks)

在系统的几大生命周期咽喉上嵌入上报指令（Payload 中默认附加发起人的 `userId`、`departmentId`、`timestamp` 等基础画像）：

| 切入场景 | 埋点位置溯源 | 拦截数据流 (Log Payload) |
| :--- | :--- | :--- |
| **启动 (Boot)** | `src/cli.tsx` 或引导程序起始处 | `version` (当前客户端版本) |
| **登录 (Login)** | `src/commands/login/teamccLogin.tsx` | 成功置换令牌并收到大后端 `IdentityEnvelope` 时，携带 `username` |
| **Bash 终端调用** | `src/tools/BashTool/BashTool.tsx` | 劫持底层执行输出流附近，抽离 `command` (明文指令内容)、`commandType`、`exitCode`、`stdout_length` |
| **文件篡写 (*预留)**| `src/tools/FileWriteTool/..` | 文件篡改时的 `absolutePath` 指纹 |

---

## 2. 后台服务侧行动纲领 (Admin 后端核心工作)

TeamCC Admin 承担着总路由、校验留存和警报触发的管控职能。

### 2.1 建设接收微服务入口
**开放路由：`POST /api/audit`**

接受来源于前端投递的基础统一体（Schema），期望的通用 JSON 体例如下：
```json
{
  "timestamp": "2026-04-12T10:00:00.000Z",
  "userId": 1088,
  "departmentId": 101,
  "eventType": "bash_command", /* boot | login | bash_command | file_write */
  "details": {
    "command": "rm -rf /usr/local/bin",
    "exitCode": 1,
    "stdout_length": 105
  }
}
```

### 2.2 严格校验及反欺骗网关 (Auth & Vali)
既然我们确定了链路不能是非法投机的裸露接口：
*   **路由阻断层**：验证请求头中的 `Authorization: Bearer <Token>`。如果无令牌或令牌失效（包含离线期的假伪装令牌），接口直接返回 `401 Unauthorized` 物理阻断记录（虽前端不关心响应，但服务端绝不落库越权脏数据）。
*   **ID 一致性校验**：反向解密 JWT Token。核对 Token 内含声明的用户 `userId` 是否与 Body 中传上来的 `userId` 强一致，严防终端脚本恶意仿冒他人的账号上报虚假执行。

### 2.3 设计持久化落库及异动告警 (Alert Flow)
*   **事件大宽表**：落库到 ElasticSearch 或 MySQL （`teamcc_audit_logs` 表）。
*   **高危动作即时拦截 (Pub/Sub)**：基于 `eventType === 'bash_command'` 且对其 `details.command` 进行正则表达式筛查（或危险命令字典库匹配）。一旦发现如 `sudo`、`chown`、高危 `ssh` 直连等违规动作，直接触发企业飞书微应用/钉钉 webhook 发送红色警报大群弹窗。
