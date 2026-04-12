# TeamCC 图谱接口集成实施案 (Admin Graph API Integration)

这是一个将知识图谱（Neo4j）直接集成到现有 `teamcc-admin` Node.js 后端的轻量级方案。我们将依托现有的 Fastify 框架和鉴权流水线，增加 Graph 驱动和路由模块。

> **注**：图谱数据基于已经定型的 `seedNeo4jSkillGraphV1.ts` 结构构建。

## 1. 依赖与前期准备

- **安装依赖**：需要在 Admin 项目内新增包。执行 `bun add neo4j-driver` (在 `teamcc-admin` 目录下)
- **环境变量**：系统增加 `NEO4J_URI`、`NEO4J_USER`、`NEO4J_PASSWORD` 环境变量。

## 2. 详细改造方案

### [NEW] `teamcc-admin/src/db/neo4j.ts`
建立全局单例图谱连接池，保证应用高性能复用 Driver 连接。
- 创建 `neo4j.driver`，支持通过 `.env` 获取连接账密信息。
- 提供 `getNeo4jSession()` 取出轻量化的 Session，暴露给所有 service 使用。
- 在 `main.ts` 的 `initializeDatabase()` 初始化闭环中，利用声明周期统一管理 Driver 资源的创建与优雅关闭。

### [NEW] `teamcc-admin/src/api/graph.ts`
利用 Fastify Router 对外暴露如下图谱接口（所有接口挂载在既有的 JWT Guard 保护下以统一鉴权）：

1. **`GET /api/graph/skills/recommend`** 
   - **核心检索接口**，由后续的评测终端或 Claude CLI 客户端调用。
   - **入参**：`departmentId` (部门ID)、`sceneId` (场景ID)
   - **核心 Cypher 设计**：根据节点关系匹配，例如根据传入的 `sceneId` 找到 `(:Scene)`，连接回 `(:Skill)`，并按关系边 `[r:SCENE_PERFORMANCE]` 或 `[a:HAS_AGGREGATE]` 身上的 `qualityScore` 进行权重倒排。
   - **结果返回**：推选的 Skill 元信息及推荐解释链路（解释大模型缘何推荐该 Skill）。

2. **`GET /api/graph/skills/:skillId/relations`**
   - 知识结构化关系洞察，用于在后台的大盘 Dashboard (UI) 页面上做展示。
   - **入参**：`skillId` (如 `frontend/admin-dashboard-design`)
   - **核心 Cypher 设计**：`MATCH (s:Skill { skillId: $id })-[r]->(adjacent) RETURN type(r), adjacent`
   - **结果返回**：包含挂载在目前 Skill 身上的 `Concept`（概念）、相似 `Skill`、偏好 `Department` 等星型拓扑全量数据。

3. **`POST /api/graph/events/ingest`**
   - **异步图谱反馈上报入口**，完美对接《Skill执行反馈架构方案》。由于我们为降低复杂度暂时抛弃了 MQ 集群，这将在 Fastify 后端利用 JS 的非阻塞异步特性来处理入库。
   - **入参**：标准的 `SkillTelemetryEvent` 上报结构。
   - **处理逻辑**：主进程收到请求后立即返回 HTTP 202 Accepted，后台通过 `neo4jSession.writeTransaction` 不阻塞地执行图谱更新或日志边的挂载。

### [MODIFY] `teamcc-admin/src/main.ts`
- 挂在导出路由 `import { registerGraphRoutes } from './api/graph.js'`
- `await registerGraphRoutes(fastify)` 完成挂载即可实现 Admin 项目的功能扩展。

## 3. 遗留探讨点

1. **写异步容灾**：Neo4j 的更新和查询可能会稍微拖慢事件摄取速度。现阶段作为第一版，不借助稳定消息队列而直接在 Admin 内部执行软异步函数（Fire and Forget Promise），在强并发或断网时有一定的丢日志风险。
2. **文本混搜结合BM25**：`GET /api/graph/skills/recommend` 目前纯依赖 `Scene` 和 `Department` 作为入口硬条件，如果后续对大模型自然语言依赖变高，可能需要加持基于关键词搜索的 Vector / Text 混合搜索检索支持。
