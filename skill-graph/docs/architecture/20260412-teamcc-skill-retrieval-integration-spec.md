# TeamCC Skill 检索接入与接口统一方案（skill-graph 侧落地版）

**日期**: 2026-04-12  
**状态**: Draft  
**适用范围**: 本文档只定义 `skill-graph/` 内的改造范围，同时列出 `TeamSkill-ClaudeCode/` 需要配合的消费改造要求。本文本身只在 `skill-graph/` 目录维护。

## 1. 一句话结论

当前项目已经有：

- TeamCC 侧的本地 Skill 检索实现
- `skill-graph` 侧的 registry、embeddings、原始事实、聚合结果、Neo4j 更新资产

缺的不是“再做一套检索”，而是：

**把 `skill-graph` 统一收口成 TeamCC 可消费的检索资产与图特征提供方。**

目标边界是：

```text
TeamCC 负责：
  检索时机、上下文提取、候选注入、Skill 选择与执行、降级策略

skill-graph 负责：
  registry、embeddings、retrieval feature snapshot、graph feature provider、统一数据契约
```

## 2. 当前状态

### 2.1 TeamCC 已有能力

当前 `TeamSkill-ClaudeCode` 已经具备：

- 本地 registry 读取
- lexical / BM25 风格检索
- 可选向量召回
- `skill_discovery` attachment 注入
- `InjectedSkillsPanel` 展示候选 Skill
- `SkillTool` 选择和执行 Skill

也就是说，TeamCC 当前**不缺“能搜”**，缺的是：

- 没有统一的检索入口
- 没有接入 `skill-graph` 的聚合 / 图特征
- 没有稳定的 response 契约

### 2.2 skill-graph 已有能力

当前 `skill-graph` 已经具备：

- `skill-registry.json`
- `skill-embeddings.json`
- 原始事实表 `skill_fact_events`
- 原始事实查询接口 `querySkillFactEvents()`
- 聚合结果 JSON
- graph update input

核心实现已经在：

- [registry.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/registry/registry.ts)
- [embeddings.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/embeddings/embeddings.ts)
- [storage.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/events/storage.ts)
- [skillFactAggregates.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/aggregates/skillFactAggregates.ts)
- [aggregateGraphUpdate.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/graph/aggregateGraphUpdate.ts)

### 2.3 当前缺口

真正缺的能力有 4 个：

1. `skill-graph` 没有对 TeamCC 暴露统一的 retrieval feature 读取接口
2. 没有 graph / aggregate rerank 的 provider 层
3. TeamCC 侧还没有稳定消费 `qualityScore / confidence / successRate / invocationCount`
4. `skill_discovery` 还没有统一的完整身份与分数协议

## 3. 总体目标

统一后的检索链路固定为：

```text
Recall (lexical + BM25 + vector)
  -> Graph / Aggregate Feature Lookup
  -> Rerank
  -> skill_discovery attachment
  -> SkillTool / 用户选择
```

其中：

- Recall 仍由 TeamCC 发起
- Graph / Aggregate 特征由 `skill-graph` 提供
- Rerank 由 TeamCC 执行，但只消费 `skill-graph` 提供的统一接口结果

## 4. TeamCC 需要做的改造（消费侧要求）

以下内容不是本文档所在仓库内要直接修改的代码，而是 TeamCC 侧必须配合的改造要求。

### 4.1 抽统一检索入口

TeamCC 不应继续在多个入口点分别拼接检索逻辑。  
TeamCC 侧最终应只有一个统一入口：

```ts
retrieveSkills(request): SkillRetrievalResponse
```

所有以下场景都只调这一个入口：

- turn-0 discovery
- inter-turn prefetch
- 子代理 discovery
- 用户显式重检索

### 4.2 TeamCC 不再直接理解 skill-graph 文件结构

TeamCC 不应直接：

- 读取 aggregate JSON 并自己拼字段
- 读取 graph update JSON 并自己解释
- 自己决定 graph feature 的字段优先级

TeamCC 只消费 `skill-graph` 暴露的稳定函数结果。

### 4.3 扩展 skill_discovery attachment

TeamCC 最终向模型和 UI 注入的候选必须至少带：

- `skillId`
- `name`
- `displayName`
- `description`
- `version`
- `sourceHash`
- `rank`
- `retrievalSource`
- `finalScore`
- `finalScoreBreakdown`

### 4.4 SkillTool 归因升级

SkillTool 执行 Skill 时，应优先使用检索返回的稳定身份：

- `skillId`
- `version`
- `sourceHash`

而不是只依赖 `skillName`

### 4.5 TeamCC 降级链路

TeamCC 必须支持以下降级顺序：

1. `BM25 + Vector + Graph Rerank`
2. `BM25 + Vector`
3. `BM25 only`

只要 registry 可读，检索就不应因为 graph features 缺失而整体失效。

## 5. skill-graph 需要做的改造（本仓库真正要做的事）

### 5.1 提供稳定资产读取入口

`skill-graph` 继续作为以下资产的唯一 owner：

- registry
- embeddings
- 原始事实
- aggregates
- graph update input

但需要新增统一读取入口，避免 TeamCC 直接读多个文件。

建议新增并稳定化：

- `readSkillRegistry()`
- `readSkillEmbeddings()`
- `readSkillRetrievalFeatures()`

### 5.2 新增 retrieval feature snapshot

当前 aggregate JSON 偏通用统计，不适合 TeamCC 直接做排序。

因此 `skill-graph` 需要新增一份专门面向检索的 canonical 产物：

```text
skill-graph/data/aggregates/skill-retrieval-features.json
```

这份文件的职责不是通用分析，而是：

- 为 rerank 提供可直接读取的 Skill/Version 特征
- 屏蔽 aggregate 原始结构细节
- 提供稳定、轻量、可缓存的输入

### 5.3 新增 graph feature provider

`skill-graph` 需要新增稳定函数入口：

```ts
getSkillGraphFeatures(request): SkillGraphFeatureResponse
```

它的职责是：

- 接收 TeamCC 的 query context 和 recall candidates
- 从 retrieval feature snapshot 中读取图特征
- 计算 graph feature score
- 返回 explainable breakdown

这样 TeamCC 无需理解 `global / department / scene / version` 的内部查找逻辑。

### 5.4 保持字段语义稳定

`skill-graph` 暴露给 TeamCC 的字段要视为跨项目契约。

允许：

- 新增字段

禁止：

- 随意改变已有字段含义

以下字段必须保持稳定：

- `skillId`
- `version`
- `sourceHash`
- `qualityScore`
- `confidence`
- `score`
- `sampleCount`
- `graphFeatureScore`

## 6. 统一接口规范

V1 不做 HTTP 服务，统一采用：

- `skill-graph` 输出本地文件资产
- `skill-graph` 提供本地函数接口
- TeamCC 通过本地函数消费

### 6.1 检索请求

```ts
type SkillRetrievalRequest = {
  queryText: string
  queryContext?: string
  cwd: string
  department?: string | null
  domainHints?: string[]
  sceneHints?: string[]
  referencedFiles?: string[]
  editedFiles?: string[]
  priorInjectedSkillIds?: string[]
  priorInvokedSkillIds?: string[]
  limit: number
}
```

### 6.2 召回候选

```ts
type SkillRecallCandidate = {
  skillId: string
  name: string
  displayName: string
  description: string
  version: string
  sourceHash: string
  domain: string
  departmentTags: string[]
  sceneTags: string[]
  retrievalSource: 'local_lexical' | 'local_hybrid'
  recallScore: number
  recallScoreBreakdown: {
    exactName: number
    displayName: number
    alias: number
    lexical: number
    bm25: number
    vector: number
    department: number
    domain: number
    scene: number
    penalty: number
  }
}
```

### 6.3 graph / aggregate 特征

```ts
type SkillGraphFeatures = {
  skillId: string
  version: string | null
  sourceHash: string | null
  globalQualityScore: number | null
  globalConfidence: number | null
  versionQualityScore: number | null
  versionConfidence: number | null
  departmentScore: number | null
  departmentConfidence: number | null
  sceneScore: number | null
  sceneConfidence: number | null
  invocationCount: number | null
  successRate: number | null
  graphFeatureScore: number
  graphFeatureBreakdown: {
    global: number
    version: number
    department: number
    scene: number
  }
}
```

### 6.4 最终检索结果

```ts
type SkillRetrievalCandidate = SkillRecallCandidate & {
  graphFeatures: SkillGraphFeatures | null
  finalScore: number
  finalScoreBreakdown: {
    recallNormalized: number
    graphFeatureScore: number
  }
  rank: number
}

type SkillRetrievalResponse = {
  schemaVersion: '2026-04-12'
  generatedAt: string
  queryText: string
  retrievalMode: 'bm25' | 'bm25_vector' | 'bm25_vector_graph'
  candidates: SkillRetrievalCandidate[]
  dataVersions: {
    registryVersion: string | null
    embeddingsGeneratedAt: string | null
    retrievalFeaturesGeneratedAt: string | null
  }
}
```

## 7. V1 排序规则

### 7.1 Recall 阶段

Recall 仍由现有逻辑完成：

- lexical
- BM25
- vector
- `department/domain/scene` hint

### 7.2 Rerank 阶段

V1 固定如下：

```text
finalScore =
  0.70 * recallScoreNormalized +
  0.30 * graphFeatureScore
```

其中：

```text
graphFeatureScore =
  0.35 * (versionQualityScore * versionConfidence) +
  0.25 * (globalQualityScore * globalConfidence) +
  0.20 * (departmentScore * departmentConfidence) +
  0.20 * (sceneScore * sceneConfidence)
```

若某项缺失，则按 `0` 处理。

### 7.3 降级规则

- 无 retrieval feature snapshot  
  仅使用 `recallScoreNormalized`
- 无 vector  
  仅使用 lexical + BM25
- registry 不可读  
  检索整体关闭

## 8. skill-graph 内部实施顺序

本文档约束下，本仓库内真正要落地的顺序应固定为：

1. 补 `readSkillRetrievalFeatures()`  
2. 产出 `skill-retrieval-features.json`  
3. 实现 `getSkillGraphFeatures()`  
4. 为 TeamCC 提供稳定的本地函数接口  
5. 再配合 TeamCC 接入 rerank  

也就是说，在 `skill-graph/` 里当前最先要完成的不是 UI，也不是 HTTP API，而是：

**面向检索的特征快照和 provider 层。**

## 9. 最终结论

后续不应再让：

- TeamCC 直接读 aggregate 原始文件
- TeamCC 自己拼图特征
- TeamCC 和 `skill-graph` 各维护一套排序逻辑

应该收口成：

```text
skill-graph 输出检索资产与图特征
TeamCC 只消费 skill-graph 的统一检索契约
```

本文档所在仓库内，接下来最重要的改造只有两项：

1. 产出 retrieval feature snapshot  
2. 提供 graph feature provider  

这两项完成后，TeamCC 才有稳定基础去接入：

- BM25
- 向量召回
- 成功率
- 使用次数
- 质量分
- 置信度

并进入同一条 Skill 检索主链路。
