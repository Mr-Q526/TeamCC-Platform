# TeamCC Platform

TeamCC 是一个围绕 Coding Agent（目前基于 Claude Code 改造）做企业级管控的项目。核心解决两个问题：

1. **员工用 Coding Agent 时，怎么管住权限？** —— 防止 Agent 越权操作、乱删文件、访问不该碰的代码。
2. **团队用 Agent 积累的经验（Skill），怎么沉淀下来复用？** —— 不让好的实践停留在个人脑子里，而是变成团队资产。

---

## 🛡️ 企业级权限管控

### 问题

把 Claude Code 直接交给团队用，最大的风险就是"过度信任"。Agent 有能力读写任意文件、执行任意命令，如果不做约束：

- 实习生可能让 Agent 改了不该改的核心模块
- Agent 可能执行破坏性的 shell 命令（`rm -rf`、`docker down` 之类）
- 不同项目组的代码和密钥没有隔离，存在横向越权

### 做法

TeamCC 的思路是：**身份 → 权限包 → 运行时拦截 → 审计**，形成闭环。

#### 1. 统一身份接入

Claude Code 启动时，先从 TeamCC Admin 拉取当前用户的身份信息（部门、角色、项目），不依赖本地手写配置文件。

```
src/bootstrap/teamccAuth.ts   → 登录、token 刷新、身份拉取
src/utils/identity.ts         → 身份数据结构化，给后续权限判断和 Skill 选择用
```

#### 2. 权限包下发与注入

管理员在 Admin 后台配置好各角色的权限策略（哪些目录可读写、哪些命令禁止执行、哪些工具需要审批），TeamCC 在运行时把这些规则注入到 Claude Code 的权限管道里。

```
src/utils/permissions/teamccLoader.ts   → 从后端拉权限包，转成运行时规则
src/utils/permissions/rulesMerger.ts    → 多来源规则按"最严格"原则合并
```

关键点：**企业规则优先级高于本地配置**。员工不能通过修改本地 `.claude/` 配置文件绕过企业策略。deny 规则绝对优先。

#### 3. 运行时拦截

当 Agent 要执行某个操作时（写文件、跑命令、调工具），权限引擎实时判断：

- **allow**：直接放行
- **deny**：立即阻断，Agent 无法执行
- **ask**：弹出审批，需要上级确认

#### 4. 全链路审计

每次操作都会以 fire-and-forget 方式上报到 Admin 后台，记录：谁、什么身份、做了什么、结果如何。

```
src/bootstrap/teamccAudit.ts  → 审计上报（boot / bash_command / file_write / tool_permission_decision）
```

Admin 后台提供审计日志查询，以及基于 Neo4j 的权限拓扑可视化（人 → 角色 → 可操作资源的关系图）。

---

## 🧠 Skill 沉淀体系

个人用 Agent 的痛点是每次都要重新教；团队的痛点是好的经验出不了个人目录。TeamCC 把 Skill 从散落的文件变成可检索、可评价、可流转的团队资产。

- **结构化存储**：Skill 统一管理，带标准元信息（适用场景、部门标签、依赖关系）。底层用 pgvector 做向量检索，Neo4j 存 Skill 之间的关系图谱。
- **按上下文自动召回**：不需要手动找 Skill。Agent 启动时根据项目目录、用户身份、任务描述，自动用 BM25 + 向量混合检索召回最匹配的 Skill。
- **越用越好**：记录每个 Skill 的调用结果和用户反馈，数据回流到排序模型和图谱，好用的排名上升，不好用的下沉。
- **跨团队流转**：一个人沉淀的 Skill 经评测验证后，可被整个团队甚至跨部门调用。

```
审计事件类型：skill_invoked / skill_completed / skill_feedback
```

#### 4. 团队级流转

一个人沉淀的 Skill，经过评测验证后，可以被整个团队甚至跨部门使用。通过 Neo4j 图谱可以清楚看到 Skill 的来源、依赖关系和使用热度。

---

## 本地开发

详细的启动步骤、分支规范、Docker 用法见 [DEVELOPMENT.md](./DEVELOPMENT.md)。

快速概览：

```bash
# 启动数据库
cd teamcc-admin && docker compose up -d
cd skill-graph && bun run skills:db:up

# 初始化数据
cd teamcc-admin && npm ci && npm run db:push && npm run seed
cd skill-graph && bun run skills:graph:seed-v1

# 启动 Admin 后台
cd teamcc-admin && npm run dev              # 后端 :3000
cd teamcc-admin/frontend && npm run dev     # 前端 :5173

# 验证 TeamSkill CLI
cd TeamSkill-ClaudeCode && bun run version
```

---

## 技术栈

| 层 | 技术 |
|---|---|
| Coding Agent 内核 | Claude Code（TypeScript，深度改造） |
| Admin 后端 | Node.js + Hono + Drizzle ORM |
| Admin 前端 | React + Vite |
| 关系型数据库 | PostgreSQL |
| 向量检索 | pgvector |
| 图数据库 | Neo4j |
| 运行时 | Bun / Node.js |
| 容器 | Docker Compose |
