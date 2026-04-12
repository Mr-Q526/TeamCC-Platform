# Skill Graph 接手文档

**日期**: 2026-04-12  
**状态**: 可接手，但尚未独立成项目

## 1. 一句话结论

当前 `skill-graph/` 目录还是拆分预留骨架，真正的 Skill 知识图谱能力仍主要位于 `TeamSkill-ClaudeCode/` 中，且整体状态是：

- 在线检索已经可用，但主路径仍是本地 registry + 本地/混合检索。
- Neo4j schema 和 seed 已有，但更偏演示数据和验证脚本。
- 反馈事件和评测链路已有雏形，但异步聚合、图谱回写、独立 graph service 尚未落地。
- `skill-graph/` 新项目目前没有实际代码、脚本或数据库资产迁入。

## 2. 当前状态总览

### 2.1 项目状态分级

| 模块 | 当前状态 | 说明 |
| --- | --- | --- |
| `skill-graph/` 独立项目 | 未开始 | 只有目录骨架和 README，没有实装代码 |
| Skill 元数据治理 | 已落地 | `skills-flat/*/SKILL.md` + registry 生成链路可用 |
| 在线 Skill 检索 | 已落地 | 本地 lexical / hybrid 检索已接入 runtime |
| 向量召回 | 可选能力 | 依赖 embeddings 文件和 Volcengine Ark 环境变量 |
| Neo4j 图谱 schema | 已设计 | V1 schema 文档和 seed 脚本都存在 |
| Neo4j 作为在线排序源 | 未接入 | 在线排序还没真正使用图谱边权 |
| 反馈埋点 | 部分落地 | JSONL telemetry + analytics feedback 已有，但字段完整性不足 |
| 聚合计算 | 设计完成 | 只有架构文档，没有独立聚合 worker |
| 图谱异步更新 | 设计完成 | 只有原则文档，没有实际消费链路 |
| 离线评测 | 已落地 | 检索评测脚本和样例结果已存在 |

### 2.2 现在“真正在线运行”的主链路

当前线上/运行时主链路不是 Neo4j，而是：

```text
skills-flat/SKILL.md
  -> buildSkillRegistry.ts 生成 skill-registry.json
  -> localSearch.ts 建本地索引并检索
  -> prefetch.ts / turn-0 discovery 生成 skill_discovery attachment
  -> InjectedSkillsPanel 展示候选 Skill
  -> SkillTool 真正选择和调用 Skill
  -> telemetry.ts / analytics 记录使用事件
```

也就是说，当前项目里“Skill 知识图谱”更准确的说法是：

- 有图谱 schema 设计
- 有图数据库 seed 脚本
- 有为图谱准备的静态元数据与反馈事件
- 但 runtime 仍以本地检索系统为主，图谱还不是线上核心依赖

## 3. 目录与边界

### 3.1 `skill-graph/` 当前状态

当前目录：

```text
skill-graph/
  README.md
  docs/
    README.md
    architecture/.gitkeep
    reference/.gitkeep
  neo4j/.gitkeep
  scripts/.gitkeep
  src/.gitkeep
```

结论：

- 当前没有 `src` 服务代码
- 当前没有 `scripts` 迁移脚本
- 当前没有 `neo4j` schema/cypher 资产
- 仍然只是未来独立项目的占位目录

### 3.2 真实实现所在目录

当前 Skill Graph 相关能力主要分布在这里：

- 文档设计：`TeamSkill-ClaudeCode/docs/architecture/`
- 图谱脚本：`TeamSkill-ClaudeCode/scripts/seedNeo4jSkillGraphV1.ts`
- 元数据构建：`TeamSkill-ClaudeCode/scripts/buildSkillRegistry.ts`
- alias 规整：`TeamSkill-ClaudeCode/scripts/skillMetadataAliasRefresh.ts`
- embeddings 构建：`TeamSkill-ClaudeCode/scripts/buildSkillEmbeddings.ts`
- embeddings 导入：`TeamSkill-ClaudeCode/scripts/importSkillEmbeddingsToPg.ts`
- 检索实现：`TeamSkill-ClaudeCode/src/services/skillSearch/`
- 反馈/UI：`TeamSkill-ClaudeCode/src/hooks/useSkillFeedbackSurvey.ts`
- 运行时展示：`TeamSkill-ClaudeCode/src/components/InjectedSkillsPanel.tsx`
- 离线评测：`TeamSkill-ClaudeCode/scripts/skillRetrievalEval.ts`

## 4. 当前能力盘点

### 4.1 静态元数据层

核心目标是把 `SKILL.md` 变成可检索、可评测、可沉淀图谱的标准化资产。

关键文件：

- `TeamSkill-ClaudeCode/scripts/buildSkillRegistry.ts`
- `TeamSkill-ClaudeCode/src/services/skillSearch/registry.ts`
- `skill-graph/docs/architecture/20260411-skill-knowledge-graph-feedback-telemetry.md`

当前事实：

- registry 从 `skills-flat/*/SKILL.md` 提取 `skillId`、`displayName`、`description`、`aliases`、`version`、`sourceHash`、`domain`、`departmentTags`、`sceneTags`
- 当前仓库已生成 `skill-graph/skills-flat/skill-registry.json`
- 当前 registry 生成时间为 `2026-04-12T01:46:38.004Z`
- 当前 registry `skillCount = 106`

这说明 Skill 元数据治理已经不是空想阶段，而是已有统一清单可供检索和后续图谱消费。

### 4.2 在线检索层

关键文件：

- `TeamSkill-ClaudeCode/src/services/skillSearch/localSearch.ts`
- `TeamSkill-ClaudeCode/src/services/skillSearch/prefetch.ts`
- `TeamSkill-ClaudeCode/src/services/skillSearch/featureCheck.ts`

当前事实：

- 支持 turn-0 检索和 inter-turn prefetch
- 支持 lexical + BM25 风格打分
- 支持部门、domain、scene 的加权
- 如果 embeddings 已生成且环境变量齐全，可额外叠加向量召回
- 返回结果通过 `skill_discovery` attachment 注入模型和 UI

关键结论：

- 当前“图谱特征”尚未进入在线重排
- 在线排序分数主要来自文本匹配、向量相似度、部门/domain/scene hint
- `graphScore` 只存在于 Neo4j 设计文档和种子数据示例里，不是 runtime 当前真实分项

### 4.3 向量层

关键文件：

- `TeamSkill-ClaudeCode/scripts/buildSkillEmbeddings.ts`
- `TeamSkill-ClaudeCode/scripts/importSkillEmbeddingsToPg.ts`
- `TeamSkill-ClaudeCode/src/services/skillSearch/embeddings.ts`
- `TeamSkill-ClaudeCode/src/services/skillSearch/vectorSearch.ts`

当前事实：

- embeddings 来源是 registry 摘要文本，不是完整 Skill 内容
- 向量生成依赖 Volcengine Ark API
- 向量检索优先读取本地 `skill-embeddings.json`
- `importSkillEmbeddingsToPg.ts` 可以把 embeddings 导入 pgvector

状态判断：

- 向量能力是“可选增强项”
- 目前不是所有环境默认可用
- 当前在线检索仍可在没有 embeddings 的情况下工作

### 4.4 Neo4j 图谱层

关键文件：

- `skill-graph/docs/architecture/20260411-skill-neo4j-schema-v1.md`
- `TeamSkill-ClaudeCode/scripts/seedNeo4jSkillGraphV1.ts`
- `skill-graph/docker-compose.skill-data.yml`

当前事实：

- 已设计 `Skill / SkillVersion / Task / FeedbackAggregate / Department / Scene / Project / Concept / Alias` 等节点与边
- 已提供 Neo4j Docker 启动方式
- 已提供 V1 seed 脚本写入演示数据
- 文档明确将 Neo4j 定位为“Skill 检索和反馈学习的图特征层”

状态判断：

- 这是目前最完整的图谱设计资产
- 但仍主要用于 schema 验证和演示
- 尚未形成独立 graph API / graph worker / graph aggregation service
- runtime 未直接查询 Neo4j 做在线检索或重排

### 4.5 反馈与观测层

关键文件：

- `TeamSkill-ClaudeCode/src/services/skillSearch/telemetry.ts`
- `TeamSkill-ClaudeCode/src/tools/SkillTool/SkillTool.ts`
- `TeamSkill-ClaudeCode/src/hooks/useSkillFeedbackSurvey.ts`
- `TeamSkill-ClaudeCode/docs/architecture/20260411-skill-feedback-storage-and-async-graph-update.md`
- `TeamSkill-ClaudeCode/docs/architecture/20260411-skill-evaluation-observability-design.md`

当前事实：

- 检索、曝光、选择、调用、完成、失败等事件类型已经定义
- `telemetry.ts` 默认可写本地 JSONL：`.claude/skill-events/events.jsonl`
- `SkillTool` 在选中、调用、完成、失败时会尝试记录 skill telemetry
- UI 已有简单 feedback survey

但这里要特别注意两个现实问题：

1. 当前反馈链路不是完整的图谱事实表
   - 主要还是 runtime telemetry 和 analytics 事件
   - 还没有真正稳定落到统一原始事实层，再聚合更新图谱

2. 当前反馈字段完整性仍有缺口
   - `useSkillFeedbackSurvey.ts` 中 `skillId` 直接取 `skill.skillName`
   - `version` 和 `sourceHash` 当前写的是 `unknown`
   - 这意味着 UI 反馈事件还不能直接高质量归因到 `SkillVersion`

所以“有反馈闭环雏形”是成立的，但“可直接用于版本级图谱学习”目前还不成立。

### 4.6 评测层

关键文件：

- `TeamSkill-ClaudeCode/scripts/skillRetrievalEval.ts`
- `TeamSkill-ClaudeCode/evals/skill-cases/`
- `TeamSkill-ClaudeCode/evals/runs/*`

当前事实：

- 已有 retrieval-only 的离线评测器
- 已有 13 个 case 的样例结果
- 最新一次结果目录：`TeamSkill-ClaudeCode/evals/runs/skill-retrieval-2026-04-12T01-39-44-628Z/`
- 最新 summary 指标：
  - `recallAt1 = 0.8461538461538461`
  - `recallAt3 = 1`
  - `mrr = 0.9230769230769231`
  - `ndcgAt3 = 0.8148110114524929`
  - `forbiddenTop3Rate = 0`

状态判断：

- 离线检索评测已具备基本可用性
- 但当前评测仍以检索效果为主
- 尚未发展成完整的“检索 -> 选择 -> 调用 -> 任务成败 -> 图谱沉淀”评测平台

## 5. 当前运行资产

### 5.1 可直接使用的命令

`TeamSkill-ClaudeCode/package.json` 已暴露的关键脚本：

```text
skills:refresh-aliases
skills:build-registry
skills:build-embeddings
skills:normalize-registry
skills:db:up
skills:db:down
skills:db:import-embeddings
skills:graph:seed-v1
eval:skills
```

### 5.2 数据服务

当前数据服务由 `skill-graph/docker-compose.skill-data.yml` 提供：

- `skill-pg`
  - pgvector/Postgres
  - 默认端口 `54329`
- `skill-neo4j`
  - Neo4j
  - 默认端口 `7474 / 7687`

状态判断：

- 数据服务是存在的
- 但它们属于 `TeamSkill-ClaudeCode` 的本地开发资产
- 不是 `skill-graph/` 独立项目自己的部署单元

## 6. 关键设计文档关系

接手时建议按这个顺序阅读：

1. `skill-graph/README.md`
   - 先确认 `skill-graph/` 当前只是拆分目标，不是现成服务
2. `skill-graph/docs/architecture/20260411-skill-neo4j-schema-v1.md`
   - 理解图谱实体模型
3. `skill-graph/docs/architecture/20260411-skill-knowledge-graph-feedback-telemetry.md`
   - 理解元信息、反馈事件、图谱沉淀原则
4. `TeamSkill-ClaudeCode/docs/architecture/20260411-skill-retrieval-injection-rerank.md`
   - 理解 runtime 当前主链路
5. `TeamSkill-ClaudeCode/docs/architecture/20260411-skill-feedback-storage-and-async-graph-update.md`
   - 理解为什么反馈不应直接改图谱主分
6. `TeamSkill-ClaudeCode/docs/architecture/20260411-skill-evaluation-observability-design.md`
   - 理解评测和观测边界

## 7. 当前最大缺口

### 7.1 `skill-graph/` 独立项目还没有启动

这是最直接的现实：

- 没有 graph service
- 没有 graph API
- 没有 graph worker
- 没有 graph 聚合任务
- 没有 graph 项目自己的 package / runtime / Dockerfile

### 7.2 图谱还没有成为在线检索主路径

现在真正在线工作的，是本地检索系统，不是图谱数据库。

这意味着：

- 当前项目叫“skill graph”没问题
- 但落地阶段更像“为图谱演进做准备的 skill retrieval platform”

### 7.3 反馈到图谱的异步链路尚未落地

文档里已经明确推荐：

- 先写原始事件层
- 再做异步聚合
- 再更新图谱

但代码层面目前还没有看到完整的：

- 原始事件表 schema
- MQ / stream
- 聚合 worker
- FeedbackAggregate 生产器
- Neo4j 增量更新器

### 7.4 版本级反馈归因还不完整

如果后续要让图谱真正学习 `SkillVersion` 效果，必须先补齐：

- 反馈事件中的真实 `skillId`
- 真实 `version`
- 真实 `sourceHash`
- retrieval round / rank / candidate set
- task outcome / verification outcome

目前这部分只有一部分在 telemetry 中存在，另一部分仍缺失或不稳定。

## 8. 接手建议

### 8.1 接手认知

接手这个方向时，不要把当前状态误判为“独立 graph 项目待维护”。  
更准确的判断是：

- 已有一套比较完整的 Skill Graph 设计
- 已有围绕它的 registry、retrieval、telemetry、eval、Neo4j seed
- 但项目形态仍然耦合在 `TeamSkill-ClaudeCode`

### 8.2 建议的接手优先级

建议按这个顺序推进：

1. **先固化迁移边界**
   - 明确哪些文件要迁到 `skill-graph/`
   - 先迁 `neo4j/` schema 与 seed 脚本

2. **再补原始事件层**
   - 统一 skill feedback / retrieval / invocation / verification 事实结构
   - 补齐 `skillId + version + sourceHash + taskId + retrievalRoundId`

3. **再做异步聚合**
   - 生成 `FeedbackAggregate`
   - 产出 Department/Scene/Project/Version 维度聚合结果

4. **最后让图谱真正参与在线排序**
   - 先用离线回灌验证 graph feature 是否能提升排名
   - 再逐步接入 reranker

### 8.3 当前最适合的第一阶段目标

如果现在就要开始正式建设 `skill-graph/`，最合理的第一阶段不是立刻写 graph API，而是：

- 把 `TeamSkill-ClaudeCode` 中的图谱 schema、seed、事件契约、聚合约定迁出来
- 先形成独立的 graph domain 文档和脚本仓位
- 保持 runtime 仍调用老的本地检索链路

这样风险最低，也符合当前仓库已经写在 `skill-graph/README.md` 的迁移顺序。

## 9. 接手时应重点关注的文件

### 9.1 必读文件

- [skill-graph/README.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/README.md)
- [DEVELOPMENT.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/DEVELOPMENT.md)
- [20260411-skill-neo4j-schema-v1.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/architecture/20260411-skill-neo4j-schema-v1.md)
- [20260411-skill-knowledge-graph-feedback-telemetry.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/architecture/20260411-skill-knowledge-graph-feedback-telemetry.md)
- [20260411-skill-retrieval-injection-rerank.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/TeamSkill-ClaudeCode/docs/architecture/20260411-skill-retrieval-injection-rerank.md)

### 9.2 必读代码

- [buildSkillRegistry.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/TeamSkill-ClaudeCode/scripts/buildSkillRegistry.ts)
- [seedNeo4jSkillGraphV1.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/TeamSkill-ClaudeCode/scripts/seedNeo4jSkillGraphV1.ts)
- [localSearch.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/TeamSkill-ClaudeCode/src/services/skillSearch/localSearch.ts)
- [prefetch.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/TeamSkill-ClaudeCode/src/services/skillSearch/prefetch.ts)
- [telemetry.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/TeamSkill-ClaudeCode/src/services/skillSearch/telemetry.ts)
- [SkillTool.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/TeamSkill-ClaudeCode/src/tools/SkillTool/SkillTool.ts)
- [useSkillFeedbackSurvey.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/TeamSkill-ClaudeCode/src/hooks/useSkillFeedbackSurvey.ts)
- [skillRetrievalEval.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/TeamSkill-ClaudeCode/scripts/skillRetrievalEval.ts)

## 10. 最终判断

截至 `2026-04-12`，当前 Skill 知识图谱的状态可以概括为：

```text
设计较完整
+ 检索链路可运行
+ 评测链路已起步
+ Neo4j schema 与 demo 数据已存在
- 图谱尚未成为在线主路径
- 反馈聚合与图谱增量更新未落地
- 独立 skill-graph 项目尚未真正开始实现
```

换句话说，当前最适合的定位不是“维护一个已经成熟的 graph 服务”，而是“接手一个已经完成前期设计和部分运行时铺垫、正准备独立拆分的 Skill Graph 子项目”。
