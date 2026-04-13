# Neo4j Browser 演示查询手册

本文档回答一个问题：打开 Neo4j Browser 后应该看什么，才能确认 `skill-graph` 已经把 Skill 全量元数据、反馈聚合和检索图特征同步进图谱。

## 前置命令

在 `skill-graph/` 下执行：

```bash
bun run skills:db:up
bun run skills:graph:sync-registry
bun run skills:graph:refresh-from-facts
bun run skills:graph:inspect
```

然后打开 Neo4j Browser：

```text
http://localhost:7474
```

默认本地开发账号通常是：

```text
username: neo4j
password: skillgraph-local
```

如果密码不同，以 `docker-compose.skill-data.yml` 中的 `NEO4J_AUTH` 为准。

## 1. 总览图谱

先看 200 个节点，确认图谱不是空的：

```cypher
MATCH (n)
RETURN n
LIMIT 200;
```

应该能看到这些节点类型：

- `Skill`
- `SkillVersion`
- `Alias`
- `Domain`
- `Department`
- `Scene`
- `FeedbackAggregate`
- `Project`

## 2. 节点数量

确认 registry 全量同步和反馈聚合都已经存在：

```cypher
MATCH (n)
RETURN labels(n)[0] AS label, count(n) AS count
ORDER BY label;
```

当前本地演示数据的参考值：

```text
Skill: 106
SkillVersion: 108
Alias: 696
Domain: 9
Department: 7
Scene: 16
FeedbackAggregate: 61
```

`SkillVersion` 可能大于 `Skill`，因为历史 demo 或不同版本聚合会保留额外版本节点。

## 3. 全量 Skill 元数据图

看 Skill 到版本、领域、部门、场景的主结构：

```cypher
MATCH path = (s:Skill)-[:HAS_VERSION]->(:SkillVersion)
OPTIONAL MATCH (s)-[:IN_DOMAIN]->(d:Domain)
OPTIONAL MATCH (s)-[:BELONGS_TO_DEPARTMENT]->(dept:Department)
OPTIONAL MATCH (s)-[:APPLIES_TO_SCENE]->(scene:Scene)
RETURN s, d, dept, scene
LIMIT 80;
```

重点看：

- `Skill.skillId`
- `Skill.name`
- `SkillVersion.version`
- `SkillVersion.sourceHash`
- `Domain.name`
- `Department.name`
- `Scene.name`

## 4. Alias 权重治理效果

看泛化 alias 是否被降权：

```cypher
MATCH (a:Alias)-[r:ALIASES_SKILL]->(s:Skill)
WHERE a.isGeneric = true
RETURN
  a.name AS alias,
  a.skillCount AS skillCount,
  round(avg(r.weight) * 1000) / 1000 AS avgWeight,
  collect(s.name)[0..8] AS sampleSkills
ORDER BY skillCount DESC, alias ASC
LIMIT 20;
```

预期现象：

- `design`、`UI`、`前端`、`视觉设计` 等高共享 alias 权重很低。
- 泛化 alias 不再强推某个具体 Skill。
- 低共享 alias 仍保留较高权重。

对比非泛化 alias：

```cypher
MATCH (:Alias)-[r:ALIASES_SKILL]->(:Skill)
RETURN
  r.isGeneric AS isGeneric,
  count(r) AS relationshipCount,
  round(avg(r.weight) * 1000) / 1000 AS avgWeight
ORDER BY isGeneric;
```

## 5. 反馈聚合 Top Skill

看当前全局反馈分最高的 Skill：

```cypher
MATCH (fa:FeedbackAggregate)-[:FOR_SKILL]->(s:Skill)
WHERE fa.scopeType = "global"
RETURN
  s.skillId AS skillId,
  s.name AS name,
  fa.qualityScore AS qualityScore,
  fa.confidence AS confidence,
  fa.sampleCount AS sampleCount,
  fa.successRate AS successRate,
  fa.userSatisfaction AS userSatisfaction
ORDER BY fa.qualityScore DESC, fa.confidence DESC
LIMIT 20;
```

当前实验数据里应能看到：

- `ai/humanizer-zh-pro`
- `design/ppt-maker`
- `frontend/website-homepage-design-pro`

这些 Skill 的反馈分已经被测试数据刷高，用于验证反馈会影响 rerank。

## 6. 场景偏好关系

看某个场景下哪些 Skill 表现好：

```cypher
MATCH (scene:Scene)-[r:SUCCESSFUL_WITH]->(s:Skill)
RETURN
  scene.name AS scene,
  s.skillId AS skillId,
  r.score AS score,
  r.confidence AS confidence,
  r.sampleCount AS sampleCount
ORDER BY scene, r.score DESC, r.confidence DESC
LIMIT 50;
```

首页设计场景可以单独看：

```cypher
MATCH (scene:Scene {name: "homepage"})-[r:SUCCESSFUL_WITH]->(s:Skill)
RETURN
  scene.name AS scene,
  s.skillId AS skillId,
  s.name AS name,
  r.score AS score,
  r.confidence AS confidence,
  r.sampleCount AS sampleCount
ORDER BY r.score DESC, r.confidence DESC;
```

## 7. 部门偏好关系

看部门维度的 Skill 偏好：

```cypher
MATCH (dept:Department)-[r:PREFERS_SKILL]->(s:Skill)
RETURN
  dept.name AS department,
  s.skillId AS skillId,
  r.score AS score,
  r.confidence AS confidence,
  r.sampleCount AS sampleCount
ORDER BY department, r.score DESC, r.confidence DESC
LIMIT 50;
```

前端平台部门可以单独看：

```cypher
MATCH (dept:Department {name: "frontend-platform"})-[r:PREFERS_SKILL]->(s:Skill)
RETURN
  dept.name AS department,
  s.skillId AS skillId,
  s.name AS name,
  r.score AS score,
  r.confidence AS confidence,
  r.sampleCount AS sampleCount
ORDER BY r.score DESC, r.confidence DESC;
```

## 8. SkillVersion 绑定反馈

确认反馈聚合不是只挂在 Skill 上，而是能绑定到具体版本：

```cypher
MATCH (sv:SkillVersion)<-[:FOR_VERSION]-(fa:FeedbackAggregate)-[:FOR_SKILL]->(s:Skill)
RETURN
  s.skillId AS skillId,
  sv.version AS version,
  sv.sourceHash AS sourceHash,
  fa.scopeType AS scopeType,
  fa.qualityScore AS qualityScore,
  fa.confidence AS confidence,
  fa.sampleCount AS sampleCount
ORDER BY fa.qualityScore DESC, fa.confidence DESC
LIMIT 30;
```

重点看 `skillId + version + sourceHash` 是否完整。

## 9. Website Homepage Design Pro 验收查询

用于验证“反馈聚合提升检索图特征”的演示 Skill：

```cypher
MATCH (s:Skill {skillId: "frontend/website-homepage-design-pro"})
OPTIONAL MATCH (s)-[:HAS_VERSION]->(sv:SkillVersion)
OPTIONAL MATCH (fa:FeedbackAggregate)-[:FOR_SKILL]->(s)
RETURN
  s,
  collect(DISTINCT sv) AS versions,
  collect(DISTINCT fa) AS feedbackAggregates;
```

只看分数：

```cypher
MATCH (fa:FeedbackAggregate)-[:FOR_SKILL]->(s:Skill {skillId: "frontend/website-homepage-design-pro"})
RETURN
  fa.scopeType AS scopeType,
  fa.scopeId AS scopeId,
  fa.qualityScore AS qualityScore,
  fa.confidence AS confidence,
  fa.sampleCount AS sampleCount,
  fa.successRate AS successRate,
  fa.userSatisfaction AS userSatisfaction
ORDER BY scopeType, scopeId;
```

## 10. 图谱健康检查

查孤儿 Skill：

```cypher
MATCH (s:Skill)
WHERE NOT (s)-[:HAS_VERSION]->(:SkillVersion)
RETURN s.skillId AS skillId, s.name AS name
ORDER BY skillId;
```

查缺少 domain 的 Skill：

```cypher
MATCH (s:Skill)
WHERE NOT (s)-[:IN_DOMAIN]->(:Domain)
RETURN s.skillId AS skillId, s.name AS name
ORDER BY skillId;
```

查缺少 scene 的 Skill：

```cypher
MATCH (s:Skill)
WHERE NOT (s)-[:APPLIES_TO_SCENE]->(:Scene)
RETURN s.skillId AS skillId, s.name AS name
ORDER BY skillId;
```

查缺少 department 的 Skill：

```cypher
MATCH (s:Skill)
WHERE NOT (s)-[:BELONGS_TO_DEPARTMENT]->(:Department)
RETURN s.skillId AS skillId, s.name AS name
ORDER BY skillId;
```

当前已知 `tools/linear` 可能缺少 department，这是元数据治理问题，不影响图谱同步链路。

## 11. 检索特征快照对应关系

Neo4j 是图谱展示与关系查询层，`retrieveSkills()` 当前在线 rerank 使用的是快照：

```text
skill-graph/data/aggregates/skill-retrieval-features.json
```

刷新链路：

```bash
bun run skills:graph:refresh-from-facts
```

检查快照：

```bash
bun run skills:graph:inspect-feedback-loop
```

如果 Neo4j 里分数已更新，但检索分数没变，优先确认 `skill-retrieval-features.json` 是否已经重建。
