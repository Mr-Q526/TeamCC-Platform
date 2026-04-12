# Skill Graph 迁移清单

**日期**: 2026-04-12  
**目标**: 从 `TeamSkill-ClaudeCode/` 拆出 `skill-graph/` 独立项目的首批文件、模块和迁移优先级

## 1. 迁移原则

迁移顺序建议固定为三层：

1. **先迁静态资产和契约**
   - 文档
   - schema
   - seed
   - reference
2. **再迁离线计算和数据准备**
   - registry
   - alias refresh
   - embeddings
   - eval
3. **最后再考虑在线链路解耦**
   - runtime telemetry sink
   - graph feature provider
   - rerank 接入

不要一开始就把 `TeamSkill-ClaudeCode` 里的 runtime/UI 代码整体搬到 `skill-graph/`。  
新项目的第一阶段应当是 **graph domain / data / ingestion / aggregation**，不是 REPL UI。

## 2. 迁移优先级总表

### P0: 必须先迁

这些内容最适合作为 `skill-graph/` 的第一批落地资产。

| 优先级 | 源文件/目录 | 建议迁入位置 | 模块归类 | 原因 |
| --- | --- | --- | --- | --- |
| P0 | `TeamSkill-ClaudeCode/docs/architecture/20260411-skill-neo4j-schema-v1.md` | `skill-graph/docs/architecture/` | graph schema | 这是知识图谱实体模型主文档 |
| P0 | `TeamSkill-ClaudeCode/docs/architecture/20260411-skill-knowledge-graph-feedback-telemetry.md` | `skill-graph/docs/architecture/` | event contract | 定义 Skill 元信息、反馈结构和图谱沉淀规则 |
| P0 | `TeamSkill-ClaudeCode/docs/architecture/20260411-skill-feedback-storage-and-async-graph-update.md` | `skill-graph/docs/architecture/` | aggregation principle | 这是图谱异步更新原则的核心文档 |
| P0 | `TeamSkill-ClaudeCode/docs/reference/Skill元信息编码映射规范.md` | `skill-graph/docs/reference/` | metadata reference | 这是静态元信息映射的参考规范 |
| P0 | `TeamSkill-ClaudeCode/neo4j/browser-style.grass` | `skill-graph/neo4j/` | graph asset | Neo4j Browser 展示样式应由 graph 项目持有 |
| P0 | `TeamSkill-ClaudeCode/scripts/seedNeo4jSkillGraphV1.ts` | `skill-graph/scripts/` | seed script | 当前唯一成型的图谱写入脚本 |

### P1: 应尽快迁

这些内容决定 `skill-graph/` 是否能独立拥有数据准备和离线构建能力。

| 优先级 | 源文件/目录 | 建议迁入位置 | 模块归类 | 原因 |
| --- | --- | --- | --- | --- |
| P1 | `TeamSkill-ClaudeCode/scripts/buildSkillRegistry.ts` | `skill-graph/scripts/` | registry build | graph 项目需要独立生成 Skill 静态清单 |
| P1 | `TeamSkill-ClaudeCode/scripts/skillMetadataAliasRefresh.ts` | `skill-graph/scripts/` | metadata normalize | alias 治理应属于 graph/data ingestion 范畴 |
| P1 | `TeamSkill-ClaudeCode/src/services/skillSearch/registry.ts` | `skill-graph/src/registry/registry.ts` | registry reader | 当前 registry 读取能力应从 runtime 搜索层剥离出来 |
| P1 | `TeamSkill-ClaudeCode/scripts/buildSkillEmbeddings.ts` | `skill-graph/scripts/` | embeddings build | embeddings 是 graph/retrieval 数据资产的一部分 |
| P1 | `TeamSkill-ClaudeCode/scripts/importSkillEmbeddingsToPg.ts` | `skill-graph/scripts/` | vector ingest | 这是 pgvector 数据导入入口 |
| P1 | `TeamSkill-ClaudeCode/src/services/skillSearch/embeddings.ts` | `skill-graph/src/embeddings/embeddings.ts` | embeddings domain | embedding manifest、hash、provider config 都应下沉到新项目 |
| P1 | `TeamSkill-ClaudeCode/docker-compose.skill-data.yml` | `skill-graph/docker-compose.skill-data.yml` 或根目录平台 compose | infra asset | 图谱和向量数据服务不应长期挂在 TeamSkill 项目名下 |

### P2: 第二阶段迁移

这些内容重要，但应该建立在 P0/P1 稳定之后。

| 优先级 | 源文件/目录 | 建议迁入位置 | 模块归类 | 原因 |
| --- | --- | --- | --- | --- |
| P2 | `TeamSkill-ClaudeCode/scripts/skillRetrievalEval.ts` | `skill-graph/scripts/` 或 `skill-graph/evals/` | retrieval eval | 如果 skill-graph 接手检索质量，就应拥有评测执行器 |
| P2 | `TeamSkill-ClaudeCode/evals/skill-cases/` | `skill-graph/evals/skill-cases/` | eval dataset | 评测 case 应归属检索/图谱侧治理 |
| P2 | `TeamSkill-ClaudeCode/evals/runs/` | `skill-graph/evals/runs/` | eval artifacts | 建议只迁移历史摘要，避免无界复制 |
| P2 | `TeamSkill-ClaudeCode/docs/architecture/20260411-skill-evaluation-observability-design.md` | `skill-graph/docs/architecture/` | observability design | 图谱项目需要这份观测设计来补齐闭环 |
| P2 | `TeamSkill-ClaudeCode/src/services/skillSearch/telemetry.ts` | `skill-graph/src/events/telemetry.ts` | event sink / schema | 先拆 schema 和 sink interface，再决定 runtime 是否继续本地写 JSONL |

### P3: 只抽公共接口，不建议整块迁

这些模块仍然高度耦合 `TeamSkill-ClaudeCode` 的 runtime，不适合现在整体搬走。

| 优先级 | 源文件/目录 | 建议动作 | 原因 |
| --- | --- | --- | --- |
| P3 | `TeamSkill-ClaudeCode/src/services/skillSearch/localSearch.ts` | 拆公共 scorer/interface，不整文件迁移 | 当前直接依赖 runtime 的搜索路径和项目上下文 |
| P3 | `TeamSkill-ClaudeCode/src/services/skillSearch/vectorSearch.ts` | 只抽底层 vector data access | 当前仍是 runtime search 过程的一部分 |
| P3 | `TeamSkill-ClaudeCode/src/services/skillSearch/prefetch.ts` | 保留在 TeamSkill | 这是 attachment 注入逻辑，不是 graph 服务逻辑 |
| P3 | `TeamSkill-ClaudeCode/src/services/skillSearch/featureCheck.ts` | 保留在 TeamSkill | 这是 runtime feature toggle |
| P3 | `TeamSkill-ClaudeCode/src/services/skillSearch/signals.ts` | 保留在 TeamSkill | 这是会话级 discovery signal 提取 |
| P3 | `TeamSkill-ClaudeCode/src/services/skillSearch/remoteSkillLoader.ts` | 保留在 TeamSkill | 远端 Skill 加载属于 runtime 调用层 |
| P3 | `TeamSkill-ClaudeCode/src/services/skillSearch/remoteSkillState.ts` | 保留在 TeamSkill | 状态管理明显属于 runtime |
| P3 | `TeamSkill-ClaudeCode/src/tools/SkillTool/SkillTool.ts` | 保留在 TeamSkill | Skill 执行器是宿主产品能力，不是 graph 项目 |
| P3 | `TeamSkill-ClaudeCode/src/components/InjectedSkillsPanel.tsx` | 保留在 TeamSkill | 这是终端 UI 组件 |
| P3 | `TeamSkill-ClaudeCode/src/hooks/useSkillFeedbackSurvey.ts` | 先抽事件契约，再保留 UI hook | 目前仍耦合 REPL 生命周期与 analytics |

## 3. 建议的新项目模块结构

迁移后建议把 `skill-graph/` 先整理成下面这类结构：

```text
skill-graph/
  docs/
    architecture/
    reference/
  neo4j/
    browser-style.grass
    schema/
    queries/
  scripts/
    seedNeo4jSkillGraphV1.ts
    buildSkillRegistry.ts
    skillMetadataAliasRefresh.ts
    buildSkillEmbeddings.ts
    importSkillEmbeddingsToPg.ts
    skillRetrievalEval.ts
  src/
    registry/
      registry.ts
      types.ts
    embeddings/
      embeddings.ts
      types.ts
    events/
      telemetry.ts
      eventSchema.ts
    graph/
      neo4jClient.ts
      seed/
      aggregates/
    eval/
      metrics.ts
      runner.ts
```

第一阶段不必强行写 `graph-api`。  
先把离线脚本、schema 和契约收拢进新项目，边界会更稳。

## 4. 分模块拆分建议

### 4.1 Graph Schema 与图数据库资产

**优先级**: P0

应迁文件：

- `TeamSkill-ClaudeCode/docs/architecture/20260411-skill-neo4j-schema-v1.md`
- `TeamSkill-ClaudeCode/neo4j/browser-style.grass`
- `TeamSkill-ClaudeCode/scripts/seedNeo4jSkillGraphV1.ts`

建议在迁移时做的顺手重构：

- 把 `seedNeo4jSkillGraphV1.ts` 中内嵌的大量 mock data 拆成 `fixtures/`
- 把 schema 约束、节点写入、关系写入拆成独立模块
- 给 `neo4j/` 增加 `constraints.cypher` 和 `seed.cypher` 导出版本

### 4.2 Registry / Metadata Ingestion

**优先级**: P1

应迁文件：

- `TeamSkill-ClaudeCode/scripts/buildSkillRegistry.ts`
- `TeamSkill-ClaudeCode/scripts/skillMetadataAliasRefresh.ts`
- `TeamSkill-ClaudeCode/src/services/skillSearch/registry.ts`
- `TeamSkill-ClaudeCode/docs/reference/Skill元信息编码映射规范.md`

为什么它应该归 `skill-graph/`：

- registry 不是 UI 功能
- registry 是 Skill 数据治理资产
- alias 规整和 frontmatter 规范化，本质上属于图谱 ingestion

建议迁移后的边界：

- `skill-graph/` 负责生成和发布 registry manifest
- `TeamSkill-ClaudeCode` 只消费 manifest，不再拥有主实现

### 4.3 Embeddings / Vector Data

**优先级**: P1

应迁文件：

- `TeamSkill-ClaudeCode/scripts/buildSkillEmbeddings.ts`
- `TeamSkill-ClaudeCode/scripts/importSkillEmbeddingsToPg.ts`
- `TeamSkill-ClaudeCode/src/services/skillSearch/embeddings.ts`

为什么它应该归 `skill-graph/`：

- embeddings 是检索数据资产，不是 REPL UI 能力
- 后续如果 graph/rerank 要学习向量和图特征，数据构建必须由 graph 项目持有

迁移时建议拆分：

- `embeddings.ts`
  - 保留 manifest schema、hash、provider config、读取逻辑
- runtime query embedding 调用
  - 可以先保留在 `TeamSkill-ClaudeCode`
  - 后续再改成调用 `skill-graph` 提供的接口或共享包

### 4.4 Telemetry / Event Contract

**优先级**: P2

应迁内容：

- `TeamSkill-ClaudeCode/src/services/skillSearch/telemetry.ts`
- `TeamSkill-ClaudeCode/docs/architecture/20260411-skill-feedback-storage-and-async-graph-update.md`
- `TeamSkill-ClaudeCode/docs/architecture/20260411-skill-evaluation-observability-design.md`

但迁移方式不要是“整文件平移”，而要拆成两部分：

1. `eventSchema`
   - 事件名
   - 字段契约
   - trace/run id 约定
2. `sink adapter`
   - JSONL sink
   - future PG sink
   - future MQ sink

这样 `TeamSkill-ClaudeCode` 仍可继续记录事件，但 schema 的拥有权会转移到 `skill-graph/`。

### 4.5 Eval / Quality Benchmarks

**优先级**: P2

应迁内容：

- `TeamSkill-ClaudeCode/scripts/skillRetrievalEval.ts`
- `TeamSkill-ClaudeCode/evals/skill-cases/`
- 评测结果中的 `summary.json`

迁移建议：

- 历史 `results.jsonl` 不必全量搬运
- 优先保留 `summary.json` 和 case 数据集
- 后续让 `skill-graph/` 成为检索评测结果的单一归档位置

## 5. 暂不迁移的内容

这些模块不应在第一阶段迁入 `skill-graph/`：

- `TeamSkill-ClaudeCode/src/services/skillSearch/prefetch.ts`
- `TeamSkill-ClaudeCode/src/services/skillSearch/signals.ts`
- `TeamSkill-ClaudeCode/src/tools/SkillTool/SkillTool.ts`
- `TeamSkill-ClaudeCode/src/components/InjectedSkillsPanel.tsx`
- `TeamSkill-ClaudeCode/src/hooks/useSkillFeedbackSurvey.ts`
- `TeamSkill-ClaudeCode/src/screens/REPL.tsx`

原因很直接：

- 它们属于宿主产品运行时
- 它们直接依赖会话状态、消息流、attachment、UI、agent 执行器
- 即便未来会调用 graph 项目，也不应该被 graph 项目反向吸收

## 6. 建议的实施批次

### 批次 A: 建骨架

目标：

- 让 `skill-graph/` 拥有自己的文档、neo4j 资产和基础脚本

建议迁移：

- P0 全部内容

完成标志：

- `skill-graph/neo4j/` 不再是空目录
- `skill-graph/scripts/` 至少可运行 graph seed
- `skill-graph/docs/` 成为 graph 相关文档主目录

### 批次 B: 数据治理独立

目标：

- 让 `skill-graph/` 成为 registry / alias / embeddings 的拥有者

建议迁移：

- P1 全部内容

完成标志：

- `skill-graph` 可以独立生成 registry
- `TeamSkill-ClaudeCode` 改为读取外部生成的 registry/embeddings

### 批次 C: 观测与评测收口

目标：

- 统一事件契约和离线评测 ownership

建议迁移：

- P2 全部内容

完成标志：

- telemetry schema 由 `skill-graph` 定义
- eval case 和 summary 收口到 `skill-graph`

### 批次 D: 在线特征接入

目标：

- 让图谱真正参与在线排序

建议动作：

- 不直接迁 runtime
- 改为在 `TeamSkill-ClaudeCode` 中接入 `skill-graph` 暴露的 graph feature provider / rerank interface

## 7. 最终建议

如果现在只做一次最有价值的拆分，我建议优先搬这 6 项：

1. `20260411-skill-neo4j-schema-v1.md`
2. `20260411-skill-knowledge-graph-feedback-telemetry.md`
3. `20260411-skill-feedback-storage-and-async-graph-update.md`
4. `browser-style.grass`
5. `seedNeo4jSkillGraphV1.ts`
6. `Skill元信息编码映射规范.md`

原因是这 6 项几乎不依赖 runtime，却能立即把 `skill-graph/` 从“空骨架”变成“有真实 graph domain 资产的项目”。

## 8. 一句话版本

优先迁 **文档、schema、seed、reference、registry、embeddings**；  
暂时不要迁 **REPL、SkillTool、Injected UI、prefetch runtime**。  
先让 `skill-graph/` 成为 **图谱数据和契约的拥有者**，再让它逐步变成 **在线检索特征提供者**。
