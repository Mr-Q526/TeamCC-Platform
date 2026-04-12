# Demo Neo4j 必保留关系清单

**日期**: 2026-04-12  
**状态**: Active  
**适用范围**: `skill-graph` demo 版 Neo4j 数据构建

## 1. 一句话结论

Demo 版 Neo4j 不能只保留静态 Skill 拓扑。

**必须同时保留：**

1. 静态关系
2. 使用效果关系
3. 聚合关系
4. 版本级质量字段

否则 demo 无法回答“哪个 Skill 更好、哪个版本更强、哪个部门/场景更偏好哪个 Skill”。

## 2. Demo 固定 Skill 范围

Demo 版至少保留以下 5 个本地真实 skill：

1. `frontend/website-homepage-design-basic`
2. `frontend/website-homepage-design-pro`
3. `frontend/admin-dashboard-design`
4. `backend/rest-api-implementation`
5. `backend/auth-authorization-backend`

其中 homepage 相关的两个 skill：

- `frontend/website-homepage-design-basic`
- `frontend/website-homepage-design-pro`

必须始终存在于 demo 图中。

## 3. Demo 必保留的静态关系

以下静态关系在 demo 版中必须保留：

- `(:Alias)-[:ALIASES_SKILL]->(:Skill)`
- `(:Skill)-[:HAS_VERSION]->(:SkillVersion)`
- `(:Skill)-[:APPLIES_TO_SCENE]->(:Scene)`

这些关系的作用：

- `ALIASES_SKILL`
  支撑别名和检索入口展示
- `HAS_VERSION`
  支撑版本区分和版本效果展示
- `APPLIES_TO_SCENE`
  支撑场景适配关系展示

## 4. Demo 必保留的使用效果关系

以下使用效果关系在 demo 版中必须保留：

- `(:Department)-[:PREFERS_SKILL {score, confidence, sampleCount}]->(:Skill)`
- `(:Scene)-[:SUCCESSFUL_WITH {score, confidence, sampleCount}]->(:Skill)`

这两类关系不能省略。

原因：

- `PREFERS_SKILL`
  用来说明“某个部门更偏好哪个 Skill”
- `SUCCESSFUL_WITH`
  用来说明“某个场景下哪个 Skill 效果更好”

没有这两类关系，demo 只能展示静态知识，不能展示“使用效果”。

## 5. Demo 必保留的聚合关系

以下聚合关系在 demo 版中必须保留：

- `(:FeedbackAggregate)-[:FOR_SKILL]->(:Skill)`
- `(:FeedbackAggregate)-[:FOR_VERSION]->(:SkillVersion)`
- `(:FeedbackAggregate)-[:IN_DEPARTMENT]->(:Department)`
- `(:FeedbackAggregate)-[:IN_SCENE]->(:Scene)`

这些关系的作用：

- `FOR_SKILL`
  说明聚合属于哪个 Skill
- `FOR_VERSION`
  说明聚合属于哪个版本
- `IN_DEPARTMENT`
  说明聚合的部门范围
- `IN_SCENE`
  说明聚合的场景范围

Demo 中如果缺少这些关系，就无法把效果分解释回具体对象。

## 6. Demo 必保留的效果字段

以下字段在 demo 版中必须保留：

### 6.1 Skill 级字段

- `Skill.globalQualityScore`
- `Skill.globalConfidence`

### 6.2 SkillVersion 级字段

- `SkillVersion.qualityScore`
- `SkillVersion.confidence`

### 6.3 FeedbackAggregate 级字段

- `aggregateKey`
- `scopeType`
- `scopeId`
- `window`
- `qualityScore`
- `selectionRate`
- `invocationRate`
- `successRate`
- `verificationPassRate`
- `userSatisfaction`
- `confidence`
- `sampleCount`

这些字段构成 demo 版最小可解释效果层。

## 7. Homepage 两个 Skill 必须体现差异

以下两个 Skill 不能只“存在”，还必须体现明确差异：

- `frontend/website-homepage-design-basic`
- `frontend/website-homepage-design-pro`

差异必须至少体现在：

- `FeedbackAggregate`
- `Department -> Skill` 效果边
- `Scene -> Skill` 效果边
- `SkillVersion.qualityScore`
- `SkillVersion.confidence`

也就是说，demo 中必须能直观看出：

- `pro` 比 `basic` 更强
- 或至少二者在质量分、成功率、置信度上存在可解释差异

如果 homepage 两个 skill 没有差异，demo 就失去版本对比价值。

## 8. Demo 数据构建原则

后续无论使用 seed 脚本、aggregate graph update、还是手工最小导入脚本，demo 数据都必须遵守下面的原则：

1. 不能只导入静态节点和静态关系  
2. 必须导入使用效果关系  
3. 必须导入聚合节点及聚合关系  
4. 必须保留 version 级质量字段  
5. homepage basic/pro 必须有可解释差异  

## 9. 后续实现约束

后续任何 demo Neo4j 清库重建、最小导入、替换 seed、生成 graph update input 的实现，都必须满足本清单。

如果某次实现只保留了：

- `Alias`
- `Skill`
- `SkillVersion`
- `Scene`

但没有保留：

- `PREFERS_SKILL`
- `SUCCESSFUL_WITH`
- `FeedbackAggregate`

则该实现视为 **不符合 demo 要求**。

## 10. 最终结论

Demo 版 Neo4j 的最低标准不是“有 Skill 节点”，而是：

**有静态结构 + 有使用效果 + 有聚合解释 + 有版本差异。**

后续所有 demo 图谱实现都以这份文档为准，不再回退到“只保留静态关系”的方案。
