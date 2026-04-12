# Skill 知识图谱 Neo4j Schema V1

这版 schema 不再把 Neo4j 当“分类展示图”，而是把它当 **Skill 检索和反馈学习的图特征层**。

## 目标

- 支持从 `Task / Query` 反推更合适的 `SkillVersion`
- 保留 `Skill` 和 `SkillVersion` 的差异，允许 `pro/basic` 共存
- 记录 `Selected / Invoked / Succeeded / Failed` 这类真实使用关系
- 把 `Department / Project / Scene` 的偏好和成功率作为图特征沉淀
- 保留 `FeedbackAggregate` 节点，方便后续把聚合分喂给 reranker

## 节点

```cypher
(:Skill {skillId, displayName, displayNameZh, domain, description, descriptionZh, activeVersionKey, globalQualityScore, globalConfidence})
(:SkillVersion {versionKey, skillId, version, sourceHash, qualityTier, active, qualityScore, confidence, promptStyle, releaseDate})
(:Alias {name, normalizedName})
(:Concept {conceptId, name, nameZh, kind})
(:Scene {sceneId, name, nameZh})
(:Department {departmentId, name, nameZh})
(:Project {projectId, name, nameZh, repo})
(:Task {taskId, title, titleZh, query, queryZh, status, source, createdAt})
(:FeedbackAggregate {aggregateKey, scopeType, scopeId, window, qualityScore, selectionRate, invocationRate, successRate, verificationPassRate, userSatisfaction, confidence, sampleCount})
```

## 关系

```cypher
(:Alias)-[:ALIASES_SKILL]->(:Skill)
(:Skill)-[:HAS_VERSION]->(:SkillVersion)
(:SkillVersion)-[:UPGRADES]->(:SkillVersion)
(:Skill)-[:MATCHES_CONCEPT {weight}]->(:Concept)
(:Skill)-[:APPLIES_TO_SCENE {weight}]->(:Scene)
(:Department)-[:PREFERS_SKILL {score, confidence, sampleCount}]->(:Skill)
(:Scene)-[:SUCCESSFUL_WITH {score, confidence, sampleCount}]->(:Skill)
(:Project)-[:SUCCEEDS_WITH {score, successRate, invocationCount}]->(:Skill)
(:Skill)-[:RELATED_TO {weight, reason}]->(:Skill)

(:Task)-[:BELONGS_TO_DEPARTMENT]->(:Department)
(:Task)-[:IN_PROJECT]->(:Project)
(:Task)-[:PRIMARY_SCENE]->(:Scene)
(:Task)-[:REQUESTS_CONCEPT {weight}]->(:Concept)
(:Task)-[:SELECTED {rank, finalScore, bm25Score, vectorScore, graphScore, injected}]->(:SkillVersion)
(:Task)-[:INVOKED {sequence}]->(:SkillVersion)
(:Task)-[:SUCCEEDED_WITH {verificationPassed, userRating, durationMinutes}]->(:SkillVersion)
(:Task)-[:FAILED_WITH {reason}]->(:SkillVersion)

(:FeedbackAggregate)-[:FOR_SKILL]->(:Skill)
(:FeedbackAggregate)-[:FOR_VERSION]->(:SkillVersion)
(:FeedbackAggregate)-[:IN_DEPARTMENT]->(:Department)
(:FeedbackAggregate)-[:IN_SCENE]->(:Scene)
(:FeedbackAggregate)-[:IN_PROJECT]->(:Project)
```

## 为什么这样建

- `Skill` 表示能力单元，`SkillVersion` 表示可被实际注入的版本。
- `Task -> Selected/Invoked/Succeeded/Failed -> SkillVersion` 才能真正表达“推荐是否有效”。
- `FeedbackAggregate` 单独成节点，而不是只塞进边属性，是为了后面支持多窗口统计、版本统计和解释链路。
- `Department / Project / Scene` 的关系边直接提供图排序特征，后续 reranker 不需要再实时算一次聚合。
- 英文 `label / relationship type` 保持不变，中文只作为展示字段，不影响检索和图计算。
- Browser 展示如果想完全中文化，可以导入 [browser-style.grass](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/neo4j/browser-style.grass)。

## 当前测试数据

已写入一批演示数据，包含：

- `8` 个 Skill
- `10` 个 SkillVersion
- `5` 个 Task
- 若干 `Concept / Scene / Department / Project`
- 若干 `FeedbackAggregate`

其中专门包含一个 `basic -> failed`、`pro -> succeeded` 的例子，用来验证版本差异：

- `frontend/admin-dashboard-design@1.0.0-basic` 失败
- `frontend/admin-dashboard-design@2.2.0-pro` 成功

## 建议查看查询

看整体节点分布：

```cypher
MATCH (n)
RETURN labels(n)[0] AS label, count(*) AS count
ORDER BY label;
```

看中文展示字段：

```cypher
MATCH (s:Skill)
RETURN s.skillId, s.displayNameZh, s.descriptionZh
ORDER BY s.skillId;
```

看任务如何选择和调用 SkillVersion：

```cypher
MATCH (t:Task)-[r:SELECTED]->(sv:SkillVersion)<-[:HAS_VERSION]-(s:Skill)
RETURN t.taskId, t.title, r.rank, s.skillId, sv.version, r.finalScore, r.graphScore
ORDER BY t.taskId, r.rank;
```

中文版任务视图：

```cypher
MATCH (t:Task)-[r:SELECTED]->(sv:SkillVersion)<-[:HAS_VERSION]-(s:Skill)
RETURN t.taskId, t.titleZh, r.rank, s.displayNameZh, sv.version, r.finalScore, r.graphScore
ORDER BY t.taskId, r.rank;
```

看失败后升级到更好版本的例子：

```cypher
MATCH (t:Task)-[:FAILED_WITH]->(bad:SkillVersion)<-[:UPGRADES]-(good:SkillVersion)<-[:SUCCEEDED_WITH]-(t)
RETURN t.taskId, bad.version AS failedVersion, good.version AS recoveredVersion;
```

看某个项目更偏好哪些 Skill：

```cypher
MATCH (p:Project {projectId: 'project:order-service'})-[r:SUCCEEDS_WITH]->(s:Skill)
RETURN p.name, s.skillId, r.score, r.successRate, r.invocationCount
ORDER BY r.score DESC;
```

看某个任务请求的概念如何映射到 Skill：

```cypher
MATCH (t:Task {taskId: 'task:ui-dashboard-001'})-[rq:REQUESTS_CONCEPT]->(c:Concept)<-[m:MATCHES_CONCEPT]-(s:Skill)
RETURN t.taskId, c.name, s.skillId, rq.weight, m.weight
ORDER BY rq.weight DESC, m.weight DESC;
```
