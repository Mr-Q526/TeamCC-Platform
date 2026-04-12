# Skill Graph 优先级任务清单

**日期**: 2026-04-12  
**状态**: 进行中 In Progress  
**负责人**: skill-graph 项目

## 1. 当前方向

当前项目方向已经明确：

- `skill-graph/` 负责 Skill 数据、registry、embeddings、eval 数据集、Neo4j 资产和后续图谱聚合能力。
- `TeamSkill-ClaudeCode/` 负责 runtime 检索、Skill 调用、终端 UI 和 agent 执行链路。
- 短期目标不是做一套新的 UI，而是把 `skill-graph/` 建成 **Skill 数据和图谱能力的单一真源**。
- 中期目标是补齐 **反馈事件 -> 聚合 -> 图谱更新 -> rerank 特征** 的闭环。
- 长期目标是让 `skill-graph/` 从“数据与脚本项目”演进为“可被 runtime 消费的 graph feature provider / graph service”。

## 2. 已完成基线

以下事项已经完成，可视为后续任务的起点：

- [x] `skills-flat/` 已从 `TeamSkill-ClaudeCode/` 迁入 `skill-graph/`
- [x] `skill-registry.json`、`skill-embeddings.json` 已归属 `skill-graph/skills-flat/`
- [x] Neo4j seed、registry、embedding、eval 脚本已迁入 `skill-graph/scripts/`
- [x] `TeamSkill-ClaudeCode` 已默认优先读取 `skill-graph/skills-flat`
- [x] 兼容入口已保留，`TeamSkill-ClaudeCode` 侧脚本可转发到 `skill-graph`
- [x] graph 文档和 reference 文档已迁入 `skill-graph/docs/`

## 3. 按优先级排序的任务列表

### P0. Ownership 收口与回归保护

这是当前最重要的任务，目标是把已经完成的迁移从“能工作”变成“稳定可维护”。

#### T1. 收口 registry / embeddings ownership

**目标**
- 明确 `skill-graph` 是 registry 和 embeddings 逻辑的 owner，`TeamSkill-ClaudeCode` 只消费接口或产物。

**主要工作**
- 清理 `skill-graph/src/registry/registry.ts` 和 `skill-graph/src/embeddings/embeddings.ts` 的临时实现。
- 去掉它们对 `TeamSkill-ClaudeCode` 工具层实现细节的隐式依赖。
- 抽出最小稳定接口：读取 registry、读取 embeddings、构建 embedding 文本、读取配置。

**完成标准**
- `skill-graph` 自己可以独立运行 registry / embeddings 相关脚本。
- `TeamSkill-ClaudeCode` 不再需要持有这些模块的主实现。

#### T2. 补自动化回归检查

**目标**
- 防止后续改动再次把 owner 关系改回去，或让 `TeamSkill-ClaudeCode` 意外读回旧目录。

**主要工作**
- 补最小 smoke test 或脚本检查：
  - `getSkillRegistryLocations()` 首选 `skill-graph/skills-flat`
  - `skills:build-registry`
  - `eval:skills`
  - `skills:graph:seed-v1`
- 增加文档路径和 canonical path 的静态检查。

**完成标准**
- 新仓库结构下，上述关键入口可以被自动验证。

#### T3. 清理迁移后的文档与兼容说明

**目标**
- 让仓库维护者只会在正确的位置改文档和数据。

**主要工作**
- 补齐 `skill-graph/docs/tasks/` 下的实施文档。
- 继续清理 `TeamSkill-ClaudeCode` 和 `skill-graph` 中残留的旧 owner 表述。
- 把旧重定向文档保持在“只跳转，不重复维护正文”的状态。

**完成标准**
- 文档中不再把 `TeamSkill-ClaudeCode` 写成 graph 资产的 canonical owner。

### P1. 反馈事件与事实层

这是中短期最关键的产品能力任务。没有统一事实层，图谱只能停留在静态数据和演示 seed。

#### T4. 定义统一的 Skill 事实事件契约

**目标**
- 把检索、曝光、选择、调用、验证、任务结果统一成可追溯的事件结构。

**主要工作**
- 在 `skill-graph` 下定义统一事件 schema。
- 明确以下字段必须稳定存在：
  - `taskId`
  - `retrievalRoundId`
  - `skillId`
  - `version`
  - `sourceHash`
  - `rank`
  - `selectedBy`
  - `verification`
  - `taskOutcome`
- 修复当前 UI feedback 中 `skillId=skillName`、`version/sourceHash=unknown` 的归因缺口。

**完成标准**
- 所有后续聚合都能基于统一事实结构，而不是零散 telemetry。

#### T5. 建立原始事件落库层

**目标**
- 让 feedback 不只停留在本地 JSONL，而是能稳定沉淀和回放。

**主要工作**
- 设计原始事件表或事件存储格式。
- 保留 JSONL 作为本地回放备份，但增加可查询、可聚合的事实层。
- 约定幂等键和重放策略。

**完成标准**
- 事件可以按时间窗口、SkillVersion、Project、Department 做查询。

### P2. 聚合与图谱更新

这一阶段才是真正把“Skill 数据项目”升级成“学习型 Skill Graph 项目”。

#### T6. 实现聚合计算

**目标**
- 从原始事件生成 `FeedbackAggregate` 和多维度效果分。

**主要工作**
- 按窗口计算：
  - `selectionRate`
  - `invocationRate`
  - `successRate`
  - `verificationPassRate`
  - `userSatisfaction`
  - `qualityScore`
  - `confidence`
- 产出以下维度聚合：
  - global
  - department
  - scene
  - project
  - version

**完成标准**
- 聚合结果可直接作为 Neo4j 更新输入。

#### T7. 实现图谱异步更新任务

**目标**
- 用聚合结果更新 Neo4j，而不是继续依赖 demo seed。

**主要工作**
- 写入或更新：
  - `FeedbackAggregate` 节点
  - `Department -> Skill`
  - `Scene -> Skill`
  - `Project -> Skill`
  - `SkillVersion` 质量快照
- 明确更新频率：
  - 熔断信号：分钟级
  - 评分聚合：小时级
  - 图谱结构重算：日级

**完成标准**
- Neo4j 中的效果边和聚合节点来自真实事件，而不是手写示例数据。

### P3. 图谱能力接入 runtime

这个阶段才开始让 `skill-graph` 直接影响线上排序质量。

#### T8. 产出 graph feature provider

**目标**
- 让 `TeamSkill-ClaudeCode` 能消费 `skill-graph` 产出的图谱特征，而不是直接查 Neo4j demo 数据。

**主要工作**
- 定义给 runtime 的最小输出：
  - skill 级偏好分
  - version 级质量分
  - department / scene / project 图特征
  - explainable feature breakdown
- 先做离线读取，再决定是否升级为服务接口。

**完成标准**
- `TeamSkill-ClaudeCode` 的 rerank 可以读取 graph features。

#### T9. 图谱特征接入 rerank

**目标**
- 让 Neo4j / 聚合结果真正影响 Skill 排序。

**主要工作**
- 在不重写现有 lexical/hybrid 主链路的前提下，增加 graph feature 分项。
- 用现有评测集验证：
  - recall@k
  - mrr
  - ndcg
  - forbiddenTopK rate

**完成标准**
- 图谱特征接入后，离线指标可验证提升或至少不退化。

### P4. 项目化与服务化

这是长期演进任务，不应抢占前面几层基础能力的优先级。

#### T10. 建立 `skill-graph` 服务边界

**目标**
- 把 `skill-graph` 从脚本项目升级成有清晰接口边界的服务模块。

**主要工作**
- 设计 `graph-api` / `graph-worker` / `aggregate-worker` 的边界。
- 拆分 `src/graph/`、`src/events/`、`src/eval/`、`src/registry/`。
- 规范配置、日志和部署方式。

**完成标准**
- `skill-graph` 可以作为独立服务或独立 worker 运行，而不是只靠脚本。

#### T11. Admin 与观测平台集成

**目标**
- 让 graph 项目进入平台级运营和管理视图。

**主要工作**
- 与 `teamcc-admin` 对接查询入口或管理视图。
- 把 skill 质量、版本表现、聚合结果和风险信号沉淀到可观测平台。

**完成标准**
- 运营或平台侧可以查看 Skill 图谱状态，而不需要直接进 Neo4j Browser。

## 4. 推荐执行顺序

建议严格按以下顺序推进：

1. `T1 Ownership 收口`
2. `T2 自动化回归`
3. `T4 统一事件契约`
4. `T5 原始事件落库`
5. `T6 聚合计算`
6. `T7 图谱异步更新`
7. `T8 graph feature provider`
8. `T9 rerank 接入`
9. `T10 服务化`
10. `T11 Admin/观测集成`

## 5. 本季度最值得完成的里程碑

如果只做一个阶段性交付，我建议目标定成：

**“让 `skill-graph` 成为稳定的数据 owner，并跑通真实 feedback -> aggregate -> graph update 的闭环。”**

对应范围是：

- 完成 `T1`
- 完成 `T2`
- 完成 `T4`
- 完成 `T5`
- 至少做出 `T6` 的第一版

这会比直接做 graph UI 或 graph API 更有价值，因为它先解决了数据可信度和闭环问题。

## 6. 暂不优先做的事项

以下事情暂时不应抢占优先级：

- 重写 `TeamSkill-ClaudeCode` 的 runtime 搜索链路
- 大规模重构 `localSearch.ts`
- 单独做一套 graph 前端 UI
- 直接把 Neo4j 接进线上 without 聚合层
- 在 schema 和事件层没稳定前先做复杂服务化

## 7. 验证口径

任务推进过程中统一用以下标准判断是否真的完成：

- **owner 是否清晰**
  - `skill-graph` 是否成为唯一真源
- **数据是否可重放**
  - 事件、聚合、图谱更新能否复算
- **runtime 是否未被打断**
  - `TeamSkill-ClaudeCode` 还能正常检索、调用、评测
- **排序收益是否可验证**
  - graph feature 接入前后，离线指标有对比结果
