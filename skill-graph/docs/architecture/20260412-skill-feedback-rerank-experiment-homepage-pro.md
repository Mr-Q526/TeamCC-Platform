# Skill 反馈图谱重排实验：Homepage PRO 排名提升

日期：2026-04-12

## 结论

本次实验验证了 `skill-graph` 的反馈闭环已经可以影响检索排序：

```text
skill_fact_events(PG)
  -> skill_feedback_aggregates(PG)
  -> Neo4j FeedbackAggregate
  -> skill-retrieval-features.json
  -> retrieveSkills() rerank
```

在对 `website-homepage-design-pro` 注入正向反馈事实并刷新图谱后，查询“品牌官网首页homepage前端设计”时，`website-homepage-design-pro` 从纯 recall 非最高的状态，被图谱特征分拉升到最终第 1。

## 实验输入

查询词：

```text
品牌官网首页homepage前端设计
```

检索上下文：

```text
queryContext: brand corporate homepage frontend design
department: frontend-platform
domainHints: frontend
sceneHints: homepage, design
```

检索模式：

```text
retrievalMode: bm25_vector_graph
```

数据版本：

```text
registryVersion: sha256:bab9e98dae7e8630c548522e9f5fbd06895d6fa58e8046f3027b633c3d6ea070
embeddingsGeneratedAt: 2026-04-11T09:10:32.824Z
retrievalFeaturesGeneratedAt: 2026-04-12T13:46:02.343Z
```

## 目标 Skill 得分

目标：

```text
skillId: frontend/website-homepage-design-pro
name: website-homepage-design-pro
version: 0.1.0
sourceHash: sha256:bef7757ba41ed2bbb44b9675acd16397ed1ed03002a34673ee56776a641be2f2
```

最终结果：

```text
rank: 1
finalScore: 0.79735
recallScore: 746.073146
recallNormalized: 0.88821
graphFeatureScore: 0.585343
retrievalSource: local_lexical
```

图谱特征：

```text
globalQualityScore: 0.9125
globalConfidence: 0.639151
versionQualityScore: 0.9125
versionConfidence: 0.639151
departmentScore: 1
departmentConfidence: 0.588519
sceneScore: 1
sceneConfidence: 0.588519
invocationCount: 6
successRate: 1
```

图谱分解：

```text
version: 0.204129
global: 0.145806
department: 0.117704
scene: 0.117704
```

## Top 5

```text
1. website-homepage-design-pro       finalScore 0.79735   graphFeatureScore 0.585343
2. website-homepage-design           finalScore 0.710925  graphFeatureScore 0.036417
3. website-homepage-design-basic     finalScore 0.599636  graphFeatureScore 0.150067
4. marketing-landing-page            finalScore 0.457796  graphFeatureScore 0
5. careers-page-basic                finalScore 0.310179  graphFeatureScore 0.036416
```

## 关键观察

- `website-homepage-design` 的纯 recall 更高，`recallNormalized = 1`。
- `website-homepage-design-pro` 的 `recallNormalized = 0.88821`，不是召回最高。
- 由于 `website-homepage-design-pro` 的图谱反馈特征更强，`graphFeatureScore = 0.585343`，最终 rerank 后排到第 1。
- 这说明反馈聚合和图谱特征已经能真实进入 `retrieveSkills()` 的最终排序。

## 数据闭环状态

实验刷新后：

```text
skillFactEvents.total: 155
skillFeedbackAggregates.total: 61
Neo4j FeedbackAggregate: 61
retrievalFeatures.itemCount: 106
```

本次为可控实验数据，正向事实带有标记：

```text
source: eval_runner
payload.syntheticBoost: true
payload.boostBatch: 20260412-positive-skill-quality
```

这些数据用于验证反馈图谱闭环能力，不应被误认为真实用户自然反馈。
