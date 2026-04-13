# skill-graph 文档目录

此目录沿用仓库现有文档规范，当前划分三个子目录：

- `architecture/`
  存放 Skill 知识图谱的架构设计、迁移方案、数据流说明和关键实验记录。
- `reference/`
  存放 schema、字段字典、事件契约、Cypher 约定和 Neo4j Browser 演示查询等参考定义。
- `tasks/`
  存放按优先级排序的任务清单、阶段性实施计划和执行跟踪文档。

当前 `skill-graph/` 还包含一个与文档并列的数据目录：

- `data/`
  存放 graph facts、聚合结果、图谱更新中间产物等运行期数据资产。

后续新增文档时，建议继续使用 `YYYYMMDD-简短标题.md` 命名格式。

当前重点文档：

- `tasks/20260412-skill-evaluation-system-plan.md`
  Skill 全量评测体系的分层计划，覆盖离线检索、图谱增益、TeamCC 沙盒盲测与回放诊断。
- `tasks/20260414-teamcc-sandbox-orchestrator-checklist.md`
  真实 TeamCC 沙盒 orchestrator 的设计边界、artifact 契约、实现分期与验收标准。
- `reference/20260412-neo4j-browser-demo-queries.md`
  Neo4j Browser 演示查询清单，用于查看 Skill/Scene/Project/FeedbackAggregate 图谱。
- `reference/20260412-langfuse-local-docker.md`
  本地 Langfuse Docker 部署与评测接入说明。
