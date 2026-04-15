# skill-graph

`skill-graph` 是 TeamCC 平台中 Skill 数据、检索资产、反馈事实、聚合结果、图谱资产与评测系统的唯一 owner。

它不是 TeamCC 的运行时 UI 项目，也不是一个独立 HTTP 服务。它当前的核心职责是：

- 持有 `skills-flat/` 中的 Skill 文档与元数据
- 生成并维护 registry、embeddings、retrieval features
- 定义统一 Skill 事实事件契约
- 将事实事件落到 PostgreSQL，并聚合成图谱与检索特征
- 将聚合结果同步到 Neo4j
- 提供本地函数式检索入口 `retrieveSkills()`
- 提供完整的离线评测、图谱偏好评测与 Langfuse 观测能力

## 项目定位

当前仓库边界已经明确分成两层：

```text
skill-graph/           # Skill 数据、检索资产、事实/聚合/图谱、评测系统
TeamSkill-ClaudeCode/  # runtime 检索触发、技能执行、agent/UI、反馈采集与消费
```

更具体地说：

- `skill-graph` 负责“知识与数据”
- `TeamSkill-ClaudeCode` 负责“运行时调用与产品交互”

因此：

- `skill-graph` 不负责运行时面板、REPL、SkillTool UI
- `TeamCC` 不应继续持有自己的 registry / embeddings / graph feature 主实现

## 当前能力概览

截至当前版本，`skill-graph` 已经具备以下能力：

- `106` 个 Skill 的统一数据目录 `skills-flat/`
- 基于 Skill 文档生成 `skill-registry.json`
- 基于火山引擎 Ark 生成 `skill-embeddings.json`
- 本地检索入口 `retrieveSkills(request)`
- 统一事实事件模型 `SkillFactEvent`
- PostgreSQL 原始事实表 `skill_fact_events`
- PostgreSQL 聚合表 `skill_feedback_aggregates`
- Neo4j 图谱更新链路
- Redis 刷新队列与 one-shot/worker 刷新管线
- Langfuse Dataset / Trace / Score 集成
- 两套主要评测集：
  - `benchmark`：`300` 条通用检索题
  - `graph-preference`：`500` 条图谱偏好专项题

## 核心设计目标

这个项目解决的不是单一问题，而是一条完整的数据闭环：

1. 把 Skill 文档、别名、域标签、场景标签统一收口
2. 把 Skill 检索变成可解释、可评测、可持续优化的能力
3. 把 TeamCC 运行时产生的 Skill 事件变成可聚合事实
4. 让反馈进入 PostgreSQL、Neo4j 与 retrieval features
5. 用标准化评测持续验证检索质量和图谱增益

设计上重点追求四件事：

- 单一真源：Skill 数据、检索资产、图谱资产只在 `skill-graph` 持有
- 可解释：召回分、图谱分、最终分都能回溯
- 可评测：每轮改动都能落到 benchmark / graph-preference 数据集
- 可积累：反馈不是日志，而是可进入下一轮检索的资产

## 总体架构

```text
skills-flat/
  -> registry
  -> embeddings
  -> retrieveSkills()
  -> SkillFactEvent
  -> PostgreSQL(skill_fact_events)
  -> PostgreSQL(skill_feedback_aggregates)
  -> Neo4j
  -> retrieval-features.json
  -> 下一轮检索 / 评测
```

按模块拆分可以理解为六层：

### 1. Skill 数据层

由 `skills-flat/` 持有：

- Skill 目录
- `SKILL.md`
- frontmatter aliases
- `skill-registry.json`
- `skill-embeddings.json`

### 2. 检索层

由 `src/retrieval/` 持有：

- `recall.ts`
- `rerank.ts`
- `retrieveSkills.ts`
- `retrievalFeatures.ts`
- `types.ts`

这层的输出是稳定的 `SkillRetrievalResponse`。

### 3. 事实事件层

由 `src/events/` 持有：

- `skillFacts.ts`
- `storage.ts`

这层定义并存储 canonical `SkillFactEvent`。

### 4. 聚合层

由 `src/aggregates/` 持有：

- 从 `skill_fact_events` 读取事件
- 计算 `skill_feedback_aggregates`
- 生成 JSON snapshot 和 PG 聚合表

### 5. 图谱层

由 `src/graph/` 持有：

- 将 registry 同步到 Neo4j
- 将聚合结果同步到 Neo4j
- 构建图谱更新 manifest

### 6. 评测与观测层

由 `src/evals/` 持有：

- retrieval eval
- graph uplift eval
- TeamCC sandbox blind eval 预留
- replay diagnosis
- Langfuse trace / dataset / score

## 目录说明

```text
skill-graph/
├── skills-flat/                 Skill 数据目录与生成资产
├── src/
│   ├── registry/               registry 读取与解析
│   ├── embeddings/             embeddings 读取与请求 Ark 的能力
│   ├── retrieval/              recall / rerank / retrieveSkills
│   ├── events/                 SkillFactEvent 契约与存储
│   ├── aggregates/             PG 聚合与 JSON snapshot
│   ├── graph/                  Neo4j registry / aggregate 同步
│   ├── refresh/                Redis 刷新队列与 worker
│   └── evals/                  评测、Langfuse、replay、报告生成
├── scripts/                    对外 CLI 入口
├── data/
│   ├── aggregates/             聚合结果与 retrieval features
│   └── graph/                  图谱更新中间产物
├── neo4j/                      Neo4j Browser 样式等资产
├── evals/skills/
│   ├── cases/                  retrieval / sandbox 数据集
│   ├── runs/                   每次评测运行产物
│   ├── reports/                汇总结论文档
│   └── datasets/               Langfuse 对应的数据组织
├── docs/                       架构、参考、任务与接手文档
└── docker-compose.skill-data.yml
```

## 检索接口

当前对外的检索主入口是本地函数调用：

```ts
retrieveSkills(request): Promise<SkillRetrievalResponse>
```

请求结构见 [src/retrieval/types.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/retrieval/types.ts)。

最小调用示例：

```ts
import { retrieveSkills } from '@teamcc/skill-graph/src/retrieval/retrieveSkills'

const response = await retrieveSkills({
  queryText: '我想做一个品牌官网首页，强调高级感和完整首屏叙事',
  queryContext: 'frontend homepage hero brand',
  cwd: process.cwd(),
  projectId: 'project:homepage-refresh',
  department: 'dept:frontend-platform',
  domainHints: ['frontend'],
  sceneHints: ['scene:homepage', 'scene:design'],
  limit: 5,
})
```

返回结果包含：

- `retrievalMode`
- `candidates`
- `recallScoreBreakdown`
- `graphFeatures`
- `graphEligibility`
- `finalScoreBreakdown`
- `dataVersions`

这意味着调用方不仅知道“谁排第一”，还知道“为什么排第一”。

## 检索实现要点

当前检索链路分为两步：

### Recall

`src/retrieval/recall.ts` 负责：

- exact name / display name / alias 命中
- lexical / BM25 风格打分
- embedding 相似度
- department / domain / scene hint 加权
- query intent / discriminator 识别

### Rerank

`src/retrieval/rerank.ts` 负责：

- 读取 retrieval features
- 计算 project / scene / department / version / global 维度信号
- 根据 graph eligibility 做 gated bonus
- 输出最终排序

当前采用的是“只加分、不减分”的 graph rerank 设计：

- 没有 graph signal 的候选，不会被统一打折
- graph 只能在上下文匹配且 recall 不离谱时提升候选

这避免了早期版本中“graph 一开就结构性压低正确候选”的问题。

## 事实事件与反馈闭环

`skill-graph` 当前的 canonical 事件模型是 `SkillFactEvent`，见：

- [src/events/skillFacts.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/events/skillFacts.ts)

当前已定义的事件类型包括：

- `retrieval_run`
- `skill_exposed`
- `skill_selected`
- `skill_invoked`
- `skill_completed`
- `skill_failed`
- `skill_feedback`
- `eval_outcome`

这些事件最终进入 PostgreSQL 表：

- `skill_fact_events`

再由聚合层计算为：

- `skill_feedback_aggregates`

聚合维度当前包括：

- `global`
- `project`
- `department`
- `scene`
- `version`

聚合指标包括：

- `selectionRate`
- `invocationRate`
- `successRate`
- `verificationPassRate`
- `userSatisfaction`
- `qualityScore`
- `confidence`
- `sampleCount`
- `avgRankWhenShown`
- `freshnessScore`
- `failurePenalty`

## 图谱层与 Neo4j

Neo4j 当前用于承载 Skill 图谱资产与聚合结果，主要由两类写入构成：

### 1. Registry Sync

把 Skill 基础静态信息写入 Neo4j，例如：

- `(:Skill)`
- `(:SkillVersion)`

### 2. Aggregate Sync

把反馈聚合结果写入 Neo4j，例如：

- `(:FeedbackAggregate)`
- `(:Scene)-[:PREFERS]->(:Skill)`
- `(:Department)-[:PREFERS_SKILL]->(:Skill)`
- `(:Project)-[:USED_SKILL]->(:Skill)`

对应实现见：

- [src/graph/registryGraphSync.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/graph/registryGraphSync.ts)
- [src/graph/aggregateGraphUpdate.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/graph/aggregateGraphUpdate.ts)

## 刷新管线

当前提供两种刷新方式：

### 1. 直接批处理刷新

```bash
bun run skills:graph:refresh-from-facts
```

这条命令会顺序执行：

1. 从 `skill_fact_events` 计算聚合
2. 写 PG + JSON snapshot
3. 更新 Neo4j
4. 重建 retrieval features

### 2. Redis 驱动的刷新 worker

由 `src/refresh/` 持有：

- Redis Stream / queue 协议
- refresh request 存储与 claim
- worker 执行管线

当前适合做开发期异步刷新验证，但还不是完整的长期服务化平台。

## 评测系统

评测系统是 `skill-graph` 当前最重要的组成部分之一。

### 数据集

当前主要有三类 retrieval 数据集：

- `coverage`
  自动覆盖每个 skill 至少有一条召回检查题
- `benchmark`
  `300` 条通用检索题，用于比较三种检索方式
- `graph-preference`
  `500` 条图谱偏好专项题，用于验证“反馈更好的 skill 是否会被抬到前面”

### 评测模式

当前支持：

- `offline-retrieval`
- `graph-uplift`
- `teamcc-sandbox-blind`
- `replay-diagnosis`

### 默认口径

开发阶段，当前默认评测口径使用：

- `experiment` retrieval features

也就是：

- `bun run eval:skills`
- `bun run skills:eval:offline`
- `bun run skills:eval:graph-preference`

默认都会读取：

- `data/aggregates/skill-retrieval-features.experiment.json`

原因是：

- 线上真实反馈还不够密
- `canonical/live` 更适合作为正式对照组
- 开发阶段需要优先验证“体系是否有效”

如果要跑正式对照：

```bash
bun run skills:eval:offline:canonical
bun run skills:eval:graph-preference:canonical
```

### Langfuse

Langfuse 当前只负责：

- trace 浏览
- dataset 管理
- score 记录
- experiment 可视化

它不是业务真源。业务真源仍然是：

- `skill_fact_events`
- `skill_feedback_aggregates`
- Neo4j
- retrieval features snapshots

## 基础设施

当前 `docker-compose.skill-data.yml` 会拉起以下服务：

- PostgreSQL + pgvector
- Redis
- Neo4j
- Langfuse Web / Worker
- Langfuse Postgres / Redis / ClickHouse / MinIO

默认开发端口：

- Skill PG: `54329`
- Skill Redis: `6381`
- Neo4j HTTP: `7474`
- Neo4j Bolt: `7687`
- Langfuse Web: `3300`

## 环境变量

常用环境变量如下：

### Embeddings / Benchmark Generation

- `ARK_API_KEY` 或 `VOLC_ARK_API_KEY`
- `VOLC_ARK_EMBEDDING_MODEL` 或 `VOLC_ARK_EMBEDDING_ENDPOINT_ID`
- `VOLC_ARK_CHAT_MODEL`

### PostgreSQL

- `SKILL_PG_URL`
- `SKILL_PG_HOST`
- `SKILL_PG_PORT`
- `SKILL_PG_DATABASE`
- `SKILL_PG_USER`
- `SKILL_PG_PASSWORD`

### Redis

- `SKILL_REDIS_URL`
- `SKILL_REDIS_HOST`
- `SKILL_REDIS_PORT`
- `SKILL_REDIS_PASSWORD`

### Neo4j

- `SKILL_NEO4J_USER`
- `SKILL_NEO4J_PASSWORD`

### Langfuse

- `LANGFUSE_HOST`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`

## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 启动基础设施

```bash
bun run skills:db:up
```

### 3. 构建 Skill 资产

```bash
bun run skills:refresh-aliases
bun run skills:build-registry
bun run skills:build-embeddings
```

### 4. 初始化事实表

```bash
bun run skills:facts:init-db
```

### 5. 体验一次本地检索

```bash
bun run skills:retrieve:demo "我想做一个高端官网首页"
```

### 6. 刷新图谱与 retrieval features

```bash
bun run skills:graph:refresh-from-facts
```

### 7. 跑评测

```bash
bun run skills:eval:offline
bun run skills:eval:graph-preference
```

## 常用工作流

### 工作流 1：新增或修改 Skill 后重建资产

```bash
bun run skills:refresh-aliases
bun run skills:build-registry
bun run skills:build-embeddings
```

### 工作流 2：查看当前 retrieval 输出

```bash
bun run skills:retrieve:demo "品牌官网首页设计"
```

### 工作流 3：把事实刷新进图谱

```bash
bun run skills:facts:aggregate
bun run skills:graph:apply-aggregates-from-pg
bun run skills:facts:build-retrieval-features
```

或者直接：

```bash
bun run skills:graph:refresh-from-facts
```

### 工作流 4：跑通用 benchmark

```bash
bun run skills:eval:offline
```

### 工作流 5：跑图谱偏好专项集

```bash
bun run skills:eval:graph-preference
```

### 工作流 6：同步 Langfuse 数据集

```bash
bun run skills:langfuse:sync-dataset
bun run skills:langfuse:sync-graph-preference-dataset
```

## TeamCC 集成边界

TeamCC 当前应该把 `skill-graph` 当作本地依赖模块消费，而不是重新实现搜索主链路。

TeamCC 应负责：

- 从运行时上下文组装 `SkillRetrievalRequest`
- 调用 `retrieveSkills()`
- 展示候选
- 执行被选中的 skill
- 发射 canonical `SkillFactEvent`

`skill-graph` 应负责：

- Skill 文档与元数据
- registry / embeddings / retrieval features
- recall / rerank / graph features
- 事实存储、聚合、图谱、评测

当前不做的事包括：

- HTTP 服务化检索接口
- 在线 Neo4j 查询参与 recall
- 运行时 UI 面板
- TeamCC 的 SkillTool / REPL / prefetch 逻辑

## 当前默认认知

如果你第一次接手这个项目，建议按下面的方式理解：

1. `skill-graph` 已经不是实验目录，而是 Skill 数据与图谱资产的正式 owner。
2. 检索接口已经可用，主入口是 `retrieveSkills()`。
3. 反馈闭环已经打通到 PG、Neo4j 和 retrieval features。
4. 默认评测口径当前看 `experiment`，因为它更能反映这套体系在开发阶段的真实上限。
5. `canonical/live` 当前更适合作为正式对照组，而不是当前最强效果组。

## 推荐阅读顺序

如果要系统接手，推荐按这个顺序阅读：

1. [docs/reference/20260415-三种Skill检索方式评测与图谱增益分析.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/reference/20260415-三种Skill检索方式评测与图谱增益分析.md)
2. [docs/reference/20260415-skill-eval-onboarding.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/reference/20260415-skill-eval-onboarding.md)
3. [docs/reference/20260415-skill-eval-data-reading-guide.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/reference/20260415-skill-eval-data-reading-guide.md)
4. [docs/reference/20260412-neo4j-browser-demo-queries.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/reference/20260412-neo4j-browser-demo-queries.md)
5. [docs/tasks/20260412-skill-evaluation-system-plan.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/tasks/20260412-skill-evaluation-system-plan.md)
6. [src/retrieval/retrieveSkills.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/retrieval/retrieveSkills.ts)
7. [src/events/skillFacts.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/events/skillFacts.ts)
8. [src/aggregates/skillFactAggregates.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/aggregates/skillFactAggregates.ts)

## 相关文档

- [docs/README.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/README.md)
- [evals/skills/README.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/evals/skills/README.md)
- [docs/reference/20260412-langfuse-local-docker.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/reference/20260412-langfuse-local-docker.md)
