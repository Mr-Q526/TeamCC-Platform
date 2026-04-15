# TeamSkill-ClaudeCode

> TeamCC Platform 的**企业 Agent Runtime**，基于 Claude Code 深度改造。

本目录是 TeamCC Platform 的运行时核心。它不是一个通用的 Claude Code 包装，而是把 Claude Code 改造成 **可识别员工身份、可执行企业权限策略、可被审计** 的团队级 Agent Runtime。

身份、权限、审计由 [`teamcc-admin`](../teamcc-admin/) 作为控制面下发；Skill 检索与数据由 [`skill-graph`](../skill-graph/) 作为数据面提供。本模块负责将这些控制面 / 数据面能力真正注入到 Agent 的运行链路中。

---

## 我们到底改造了什么

### 1. 从"本地用户代理"改造为"企业员工运行时"

在原始 Claude Code 里，模型看到的主要是当前仓库和当前会话上下文。TeamCC 的改造目标是让运行时额外具备"员工身份面"：

- 当前登录员工是谁
- 员工属于哪个部门、团队、角色、级别
- 当前默认项目和当前项目权限边界是什么
- 这轮会话是否已经通过企业鉴权

这些信息不再来自本地手写文档，也不再依赖历史的 `.claude/identity/active.md`。**企业身份唯一真相源是管理平台返回的 `/identity/me`**，客户端只消费远端验证后的 `IdentityEnvelope`。

### 2. 权限判断从"本地配置"升级为"控制面下发"

TeamCC 不把权限看作本地提示词或少量 allowlist，而是真正的控制面：

- `teamcc-admin` 负责登录、身份、权限模板、项目授权、审计查询
- `TeamSkill-ClaudeCode` 负责启动鉴权、运行时注入、工具执行边界控制
- 权限包由 `/policy/bundle` 返回，客户端编译进 `ToolPermissionContext`

当前规则模型遵循：

```text
deny > ask > allow
```

企业权限不是"建议"，而是进入工具判定链路的硬约束。

### 3. 登录态成为启动期和运行时的第一门禁

现在这套运行时已经不是"先启动、再看要不要登录"，而是：

- 普通启动时，先建立 TeamCC 企业会话
- 未认证状态下，不允许进入完整企业运行态
- 只保留 `/login`、`/auth`、`/logout` 这类认证相关入口
- 登录成功后热更新当前 runtime，不要求重启
- 登录取消或失败不会再偷偷落回普通 REPL

### 4. 员工身份持续传导到 Skill / 审计链路

员工身份不只是"你是谁"，还会继续影响：

- Skill 检索时的 `department` hint
- Prompt / Context 里的企业态说明
- Tool 级安全审计
- Skill exposure / selection / invocation 归因
- 图谱事实与离线评测沉淀

身份不只是登录结果，而是整个 Agent 运行链路的基础上下文。

---

## 企业身份与权限如何进入 Runtime

### Step 1. 启动时先建立 TeamCC 会话

运行时启动后，会优先读取 TeamCC 配置：

- 项目级 `.teamcc/config.json`
- 用户级 `~/.teamcc/config.json`
- 环境变量 `TEAMCC_ADMIN_URL` / `TEAMCC_ACCESS_TOKEN` / `TEAMCC_REFRESH_TOKEN`

然后走统一 bootstrap：

1. 校验是否存在有效 TeamCC 配置
2. 通过 access token 调用 `/identity/me`
3. 拿到远端验证后的身份信息并生成 `IdentityProfile`
4. 继续调用 `/policy/bundle`
5. 把权限规则编译进 `ToolPermissionContext`

运行时会得到三种状态之一：

- `unauthenticated` — 未认证，仅允许认证入口
- `authenticated_scoped` — 身份和权限包都就绪，进入完整企业运行态
- `authenticated_restricted` — 身份已确认但权限包拉取失败，进入 fail-closed 受限模式

### Step 2. 身份只认远端，不再认本地票据

本项目已明确取消旧方案：

- 不再使用 `.claude/identity/active.md`
- 不再把本地身份缓存视为企业真相源
- `IdentityProfile` 的语义是"已通过 TeamCC 远端验证的身份摘要"

本地缓存现在只承担：登录后留痕、联调调试、某些退出场景的补充审计。**它不再承担"本地身份恢复即为真相"的职责。**

### Step 3. 权限包真正进入工具判定链路

权限注入不是存在本地而已，而是编译为 `PermissionRule` 并写入：

- `alwaysAllowRules`
- `alwaysDenyRules`
- `alwaysAskRules`

在 `authenticated_restricted` 下运行时会进入 fail-closed 受限模式，默认拒绝高风险能力，包括：`Bash`、`PowerShell`、`Edit`、`Write`、`NotebookEdit`、`Agent`、`RemoteTrigger`。

**身份确认但权限包失败时，系统不会"先放开再说"，而是默认收紧。**

### Step 4. 登录 / 登出会热更新当前 runtime

`/login` 不再只是写 token 文件，而是立刻：

- 获取 `/identity/me`
- 重建 TeamCC session
- 重建 `toolPermissionContext`
- 更新当前会话的身份和权限状态

`/logout` 会同步清掉 runtime identity、TeamCC session state、TeamCC 注入的权限规则。

---

## Skill 检索链路

当前主路径已经收口到 `skill-graph/` 作为 retrieval owner，本模块只保留 runtime adapter：

1. `src/services/skillSearch/provider.ts` 收集运行时上下文
2. 把上下文转换成 `SkillRetrievalRequest`
3. 调用 `@teamcc/skill-graph/retrieval.retrieveSkills()`
4. 消费统一返回的 `SkillRetrievalResponse`

员工身份会进入 Skill 检索链路，至少影响 `department` hint、当前项目上下文、query 的 scene / domain 提示、以及暴露 / 选中 / 调用的 telemetry 归因。

---

## 审计接入点

TeamCC 已经把安全审计接入到多个关键点：

- 启动 / 登录 / 登出 / 退出
- Bash 执行
- 文件写入
- 权限放行 / 拒绝 / 询问

审计上报入口：`src/bootstrap/teamccAudit.ts`，以 fire-and-forget 模式送至 `teamcc-admin` 的 `POST /api/audit`。

---

## 本地启动

### 环境要求

- Node.js 24+
- Bun 1.3.5+
- 已启动的 [`teamcc-admin`](../teamcc-admin/)（提供身份与权限接口）

### 启动命令

```bash
cd TeamSkill-ClaudeCode
bun install
bun run dev
```

启动后优先完成：

```text
/login            # 触发 TeamCC 企业登录
/auth status      # 查看当前鉴权状态
/identity         # 查看当前身份 envelope
/permissions      # 查看当前生效的权限规则
```

验证 Skill 检索：

```text
/skills search 前端登录页
```

### 注册为全局命令（可选）

在你的 shell 配置中添加：

```bash
alias teamcc='bun --env-file=/全路径/TeamSkill-ClaudeCode/.env run /全路径/TeamSkill-ClaudeCode/src/bootstrap-entry.ts'
```

---

## 常用开发命令

```bash
bun run dev          # 启动 CLI
bun run version      # 查看版本
bun test             # 运行测试
```

---

## 目录结构

```text
TeamSkill-ClaudeCode/
├── src/
│   ├── bootstrap/         # 启动链路：鉴权、session、审计
│   │   ├── teamccAuth.ts
│   │   ├── teamccSession.ts
│   │   └── teamccAudit.ts
│   ├── commands/          # CLI 命令：login / auth / identity / permissions / skills
│   ├── tools/             # 工具执行（Bash / Edit / Write 等），统一走权限判定
│   ├── screens/           # REPL 界面
│   ├── services/
│   │   └── skillSearch/   # Skill 检索 runtime adapter，接 skill-graph
│   ├── utils/
│   │   ├── permissions/   # 权限加载、合并、应用
│   │   └── identity.ts    # 身份结构化
│   └── hooks/
│       └── toolPermission/  # 工具权限钩子与审计埋点
├── docs/                  # 本模块文档（架构、运维、参考等）
└── tests/
```

---

## 重点文档

- [TeamCC 集成状态](./docs/guides/TEAMCC_INTEGRATION_STATUS.md)
- [TeamCC 启动指南](./docs/guides/TEAMCC_STARTUP_GUIDE.md)
- [TeamCC 认证指南](./docs/guides/TEAMCC_AUTHENTICATION_GUIDE.md)
- [TeamCC Admin 集成方案](./docs/architecture/20260411-teamcc-admin-integration.md)
- [Skill 检索、注入与重排序方案](./docs/architecture/20260411-skill-retrieval-injection-rerank.md)
- [全链路安全审计对接规范](./docs/reference/TEAMCC_全链路安全审计对接规范.md)
- [TeamCC 迁移实施方案](./docs/migration/TEAMCC迁移实施方案.md)

---

## 当前状态与边界

- **主轴是"企业运行时"**，不是通用开源 CLI 包装
- **正常交互启动默认要求 TeamCC 身份**，未认证状态下只允许认证入口
- **`.teamcc` 是正式目录协议，`.claude` 仍有历史残留**，仓库处于迁移期
- **审计、评测、图谱都已接入**，但仍在持续收口

更多细节见 [`docs/`](./docs/)。
