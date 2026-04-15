# TeamCC Platform

> 面向团队协作的企业级 Coding Agent 平台。基于 Claude Code 深度改造，核心解决 **员工使用 AI Agent 的权限管控** 与 **团队 Skill 资产沉淀** 两个关键问题。

---

## 项目目的

把 Claude Code 这类强大但"过度信任"的 Coding Agent，改造成企业可以放心交给团队用的工具：

1. **权限管控**：防止 Agent 越权操作、执行破坏性命令、访问不该碰的代码。每次工具调用都走统一的身份 + 权限判定链路，可放行、可拦截、可审计。
2. **Skill 沉淀**：团队成员用 Agent 积累的经验不再停留在个人目录，而是变成可检索、可评价、可流转的团队资产。底层用知识图谱记录"部门 → 场景 → Skill → 调用结果"，用数据反哺 Skill 推荐和质量评价。

---

## 已实现成果

当前仓库已不是 PoC，而是一套运行中的三层协作系统。关键数据：

| 维度 | 指标 |
|------|------|
| Claude Code 运行时改造 | **2000+ TS/TSX 源文件**，覆盖启动鉴权、权限注入、工具拦截、审计埋点 |
| Skill 知识图谱 | **109 个 Skill** 已入库，支持向量 + BM25 混合检索 |
| 企业管控接口 | **4 组核心 API**（`auth` / `identity` / `policy` / `audit`），完整覆盖登录 → 权限下发 → 审计上报链路 |
| 文档体系 | **140+ 架构/参考/运维文档**，已按类型分类归档 |

### 核心能力落地情况

- ✅ **企业身份注入**：启动即鉴权，身份唯一真相源是管理平台 `/identity/me`
- ✅ **权限控制面**：`deny > ask > allow` 规则编译进 `ToolPermissionContext`，fail-closed 受限模式
- ✅ **全链路审计**：启动 / 登录 / Bash / 文件写入 / 权限决策全部上报 `teamcc-admin`
- ✅ **Skill 检索收口**：`skill-graph` 作为统一 retrieval owner，支持身份驱动的部门/场景 hint
- ✅ **图谱驱动评分**：Skill 调用反馈异步回写 Neo4j，定时聚合为重排权重

### Skill 检索评测（最新：`graph-preference` 专项 500 条）

Skill 检索不是“拍脑袋上线”，而是每次变更都要经过离线评测。当前最新结论基于 `graph-preference/v1` 的 **500 条**专项集：

- 数据集审计：`issueCount = 0`
- 正式对照组：`canonical`
- 当前开发默认口径：`experiment`
- 最新直接复测报告：
  [graph-preference 500 cases 复测总结（修复评测入口后）](./skill-graph/evals/skills/reports/20260415-graph-preference-v3-500cases-rerun-after-cli-fix-summary.md)
- 对外展示版总结：
  [三种 Skill 检索方式评测与图谱增益分析](./skill-graph/docs/reference/20260415-%E4%B8%89%E7%A7%8DSkill%E6%A3%80%E7%B4%A2%E6%96%B9%E5%BC%8F%E8%AF%84%E6%B5%8B%E4%B8%8E%E5%9B%BE%E8%B0%B1%E5%A2%9E%E7%9B%8A%E5%88%86%E6%9E%90.md)

**500 cases 总体结果：**

| 条件 | 模式 | Recall@1 | Recall@3 | Recall@5 | MRR |
|------|------|---------:|---------:|---------:|----:|
| `canonical` | `bm25` | 0.706 | 0.950 | 0.976 | 0.826333 |
| `canonical` | `bm25_vector` | 0.712 | 0.958 | 0.978 | 0.831833 |
| `canonical` | `bm25_vector_graph` | 0.712 | 0.958 | 0.978 | 0.831833 |
| `experiment` | `bm25` | 0.706 | 0.950 | 0.976 | 0.826333 |
| `experiment` | `bm25_vector` | 0.712 | 0.958 | 0.978 | 0.831833 |
| `experiment` | `bm25_vector_graph` | **0.852** | **0.960** | **0.978** | **0.902767** |

**核心结论：**

- `bm25_vector` 相比 `bm25` 有稳定小幅提升。
- `bm25_vector_graph` 在 `canonical` 下与 `bm25_vector` 持平，说明图谱路径已打通，但默认正式图谱信号还偏稀疏。
- `bm25_vector_graph` 在 `experiment` 下显著优于 `bm25_vector`：
  - `Recall@1: 0.712 -> 0.852`
  - `MRR: 0.831833 -> 0.902767`
  - Top1 被正向改写 `70` 个 case
  - `hurtCount = 0`

**按业务域看，图谱 uplift 主要集中在已具备正反馈积累的域：**

| domain | caseCount | vector R@1 | graph R@1（experiment） |
|--------|----------:|-----------:|-------------------------:|
| `frontend` | 200 | 0.520 | **0.855** |
| `general` | 19 | 0.632 | **0.789** |
| `backend` | 60 | 1.000 | 1.000 |
| `security` | 60 | 0.983 | 0.983 |
| `design` | 60 | 0.667 | 0.667 |
| `tools` | 54 | 0.796 | 0.796 |
| `review` | 27 | 0.741 | 0.741 |
| `ai` | 20 | 0.900 | 0.900 |

这说明 TeamCC 的 Skill 体系已经不是“静态知识库检索”，而是具备了“反馈进入图谱后，持续把更优 Skill 往前推”的能力。

### 界面预览

![管理平台-员工管理](./imgs/管理平台-员工管理.png)
*管理后台：员工与身份管理*

![管理后台-审计日志](./imgs/管理后台-审计日志.png)
*管理后台：全链路审计日志*

![管理平台-权限拓扑图谱](./imgs/管理平台-neo4j图谱（skill数据未完成）.png)
*管理后台：基于 Neo4j 的权限拓扑可视化*

![neo4j图谱-展示skill的存储](./imgs/neo4j图谱-展示skill的存储.png)
*Skill 知识图谱：部门 → 场景 → Skill → 调用记录*

---

## 项目结构

本仓库是 monorepo，由三个协作子项目组成：

```mermaid
flowchart LR
    U["Employee"]
    R["TeamSkill-ClaudeCode<br/>企业 Agent Runtime"]
    A["teamcc-admin<br/>身份 / 权限 / 审计控制面"]
    G["skill-graph<br/>Skill 数据 / 检索 / 图谱 / 评测"]

    U --> R
    R <--> A
    R <--> G
```

### 🛠️ [`TeamSkill-ClaudeCode/`](./TeamSkill-ClaudeCode/) — 企业 Agent Runtime

基于 Claude Code 深度改造的运行时核心。负责：

- 启动期鉴权与会话建立
- 企业身份与权限规则注入工具链
- Skill 检索适配与 runtime 执行
- 全链路审计事件埋点与上报

**→ [详细文档](./TeamSkill-ClaudeCode/README.md)**

### 🔐 [`teamcc-admin/`](./teamcc-admin/) — 管理控制面

`Fastify + TypeScript + Drizzle ORM + PostgreSQL` + `React 19` 前端。负责：

- 员工身份档案与部门策略
- 权限模板与项目授权
- 用户在项目下的最终权限预览
- Claude Code 审计事件的接收与查询

**→ [详细文档](./teamcc-admin/README.md)**

### 📊 [`skill-graph/`](./skill-graph/) — Skill 数据与检索

Skill 的数据面与检索 owner。负责：

- Skill registry 与 embeddings 管理
- 统一检索 API（lexical + BM25 + 向量）
- 调用反馈事件的异步图谱回写
- 评测基准与离线评测 runner

**→ [详细文档](./skill-graph/README.md)**

---

## 快速开始

详细启动步骤、分支规范、Docker 用法见 [DEVELOPMENT.md](./DEVELOPMENT.md)。

快速概览：

```bash
# 1. 一键启动全部服务（Admin 平台、数据库、图数据库等）
./scripts/platform.sh start

# 2. 初始化 Skill 知识图谱数据
cd skill-graph && bun install && bun run skills:graph:seed-v1

# 3. 启动企业版 Claude Code CLI
cd TeamSkill-ClaudeCode && bun install && bun run dev
```

启动后在 CLI 中完成 `/login` 即可进入企业运行态。

---

## 技术栈

| 层 | 技术 |
|---|---|
| Agent 运行时 | Claude Code（TypeScript，深度改造）+ Bun |
| Admin 后端 | Node.js + Fastify + Drizzle ORM |
| Admin 前端 | React 19 + Vite + i18next |
| 关系型数据库 | PostgreSQL |
| 向量检索 | pgvector |
| 图数据库 | Neo4j |
| 容器编排 | Docker Compose |

---

## 平台级文档

- [开发工作流](./DEVELOPMENT.md) — 启动、分支、Docker、worktree 规范
- [Worktree 协作说明](./WORKTREE_NOTICE.md)
- 子项目详细文档：[TeamSkill-ClaudeCode](./TeamSkill-ClaudeCode/README.md) · [teamcc-admin](./teamcc-admin/README.md) · [skill-graph](./skill-graph/README.md)

---

## 一句话总结

TeamCC Platform 的本质不是"给 Claude Code 增加几个企业命令"，而是：

**把 Claude Code 的运行时改造成企业员工上下文驱动的安全执行环境，并围绕它搭建起 Skill 治理、权限控制、全链路审计的完整闭环。**
