# Skill 聚合结果 Demo 阶段简化方案

**日期**: 2026-04-12  
**状态**: Draft  
**适用范围**: `skill-graph/` 聚合结果 V1

## 1. 一句话结论

Demo 阶段不追求“最终最优聚合算法”，而追求：

1. **能从原始事实稳定产出聚合结果**
2. **口径简单、容易解释**
3. **能直接给后续 Neo4j 更新和 demo 展示使用**

因此，V1 采用：

- **离线微批聚合**
- **只做四类 scope**：`global / department / scene / version`
- **先产出 count / rate / score 聚合 JSON**
- **暂不做 project 维度**
- **暂不做复杂去重快照层**
- **暂不做实时图谱写回**

## 2. Demo 阶段目标

### 2.1 要解决的问题

当前已经有：

- 原始事件表：`skill_fact_events`
- 原始事实读取接口：`querySkillFactEvents()`
- 事件类型：`skill_exposed / skill_selected / skill_invoked / skill_completed / skill_failed / skill_feedback`

Demo 阶段要补的是：

- 从原始事实生成一份**稳定的聚合结果文件**
- 用这份结果回答：
  - 哪些 Skill 全局表现更好
  - 哪些 Skill 在某个部门更有效
  - 哪些 Skill 在某个 scene 更有效
  - 哪个 SkillVersion 表现更好

### 2.2 明确不做的事情

Demo 阶段先不做：

- `project` 维度聚合
- attempt snapshot / retrieval snapshot 的复杂去重模型
- 多窗口同时产出（如 `7d + 30d + 90d`）
- 熔断信号和异常检测
- Langfuse / OTel / Admin 联动
- 直接写 Neo4j
- rerank 在线接入

## 3. 推荐的 Demo 聚合口径

### 3.1 输入事件

V1 只消费以下事件：

- `skill_exposed`
- `skill_selected`
- `skill_invoked`
- `skill_completed`
- `skill_failed`
- `skill_feedback`

以下事件在 V1 不进入主聚合：

- `retrieval_run`
- `eval_outcome`

原因：

- `retrieval_run` 更适合做检索链路观察，不直接对应单个 Skill 的最终效果
- `eval_outcome` 在 demo 阶段先单独看评测结果，不和真实任务聚合混算

### 3.2 聚合维度

V1 固定只做四类 scope：

1. `global`
   - `scopeId = global`
2. `department`
   - `scopeId = department`
3. `scene`
   - `scopeId = scene`
4. `version`
   - `scopeId = {skillVersion}#{sourceHash}`

其中：

- `global` 用来看全局表现
- `department` 用来支持后续 `Department -> Skill` 偏好边
- `scene` 用来支持后续 `Scene -> Skill` 成功边
- `version` 用来比较具体版本

### 3.3 聚合主键

V1 聚合主键建议为：

```text
scopeType + scopeId + skillId + window
```

其中：

- `window` 先固定为 `30d`

对应 `aggregateKey`：

```text
agg:skill:{skillId}:{scopeType}:{scopeId}:{window}
```

## 4. Demo 阶段如何计算

### 4.1 先算基础统计项

每条 aggregate 先保留以下统计项：

- `sampleCount`
- `exposureCount`
- `selectionCount`
- `invocationCount`
- `successCount`
- `failureCount`
- `verificationPassCount`
- `feedbackCount`
- `explicitPositiveCount`
- `explicitNegativeCount`
- `avgRankWhenShown`

推荐口径：

- `sampleCount`
  使用该聚合范围内的 **唯一 taskId 数**
- `exposureCount`
  `skill_exposed` 事件数
- `selectionCount`
  `skill_selected` 事件数
- `invocationCount`
  `skill_invoked` 事件数
- `successCount`
  `skill_completed` 事件数
- `failureCount`
  `skill_failed` 事件数
- `verificationPassCount`
  `skill_completed` / `skill_failed` 中 `verificationPassed = true` 的事件数
- `feedbackCount`
  `skill_feedback` 事件数
- `avgRankWhenShown`
  `skill_exposed.retrieval.rank` 的平均值

### 4.2 评分前的比率项

基于基础统计，先计算这些 rate：

- `selectionRate = selectionCount / exposureCount`
- `invocationRate = invocationCount / max(selectionCount, 1)`
- `successRate = successCount / max(invocationCount, 1)`
- `verificationPassRate = verificationPassCount / max(invocationCount, 1)`

这里选择 `invocationRate = invocationCount / selectionCount`，是因为 demo 阶段更关心：

```text
被选中的 Skill，最终有没有真的被执行
```

而不是更复杂的“从曝光到调用”的整链条归因。

### 4.3 用户满意度

`userSatisfaction` 只从 `skill_feedback` 计算。

简化规则：

- 显式 `rating` 存在时：
  - `rating / 5`
- 没有 `rating` 但有 `sentiment` 时：
  - `positive = 1`
  - `neutral = 0.5`
  - `negative = 0`
- 没有任何 feedback 时：
  - 默认 `0.5`

这样做的原因：

- demo 阶段不引入复杂的隐式满意度模型
- 避免没反馈的 Skill 被直接判成低分

### 4.4 综合分数

Demo 阶段建议使用**简化版质量分公式**：

```text
qualityScore =
  0.35 * successRate +
  0.25 * userSatisfaction +
  0.20 * verificationPassRate +
  0.10 * invocationRate +
  0.10 * selectionRate
```

说明：

- 保留 `successRate` 和 `userSatisfaction` 作为最重要信号
- 保留 `verificationPassRate` 体现“系统验证是否通过”
- 保留 `invocationRate` 和 `selectionRate` 体现“从曝光到真实使用”的转化
- **不在 demo 阶段引入**：
  - `freshnessScore`
  - `costPenalty`
  - `failurePenalty`
  - `priorScore`

原因是这些项会显著增加解释成本，但对 demo 价值有限。

如果当前实验脚本已经输出了 `freshnessScore`、`failurePenalty`、`costPenalty` 等扩展字段，demo 展示层可以先忽略它们，不把它们当成 V1 必须依赖的主口径。

### 4.5 置信度

Demo 阶段继续保留 `confidence`，但口径保持简单：

```text
confidence = min(1, log(1 + sampleCount) / log(1 + targetSampleCount))
```

推荐：

- `targetSampleCount = 20`

作用：

- 让样本很少的 Skill 不至于因为一次成功就看起来“绝对高分”
- 为下一步图谱排序和版本比较保留校准能力

## 5. Demo 阶段输出结构

### 5.1 输出位置

V1 聚合结果输出到：

```text
skill-graph/data/aggregates/skill-feedback-aggregates.json
```

### 5.2 输出字段建议

每条 aggregate 至少包含：

```json
{
  "aggregateKey": "agg:skill:frontend/admin-dashboard-design:department:frontend-platform:30d",
  "scopeType": "department",
  "scopeId": "frontend-platform",
  "skillId": "frontend/admin-dashboard-design",
  "skillVersion": null,
  "sourceHash": null,
  "window": "30d",
  "sampleCount": 12,
  "exposureCount": 40,
  "selectionCount": 18,
  "invocationCount": 14,
  "successCount": 11,
  "failureCount": 3,
  "verificationPassCount": 10,
  "feedbackCount": 5,
  "selectionRate": 0.45,
  "invocationRate": 0.7778,
  "successRate": 0.7857,
  "verificationPassRate": 0.7143,
  "userSatisfaction": 0.84,
  "avgRankWhenShown": 1.8,
  "qualityScore": 0.79,
  "confidence": 0.63,
  "updatedAt": "2026-04-12T00:00:00.000Z"
}
```

说明：

- `global / department / scene` 聚合中，`skillVersion` 和 `sourceHash` 可以为 `null`
- `version` 聚合中，`skillVersion` 和 `sourceHash` 必须存在

## 6. 执行方式

### 6.1 运行方式

Demo 阶段采用：

- 手动脚本触发
- 或本地每小时一次微批

脚本入口建议为：

```bash
bun run skills:facts:aggregate
```

### 6.2 数据流

```text
skill_fact_events
  -> querySkillFactEvents()
  -> aggregate runner
  -> skill-feedback-aggregates.json
```

先不做：

```text
aggregate runner -> Neo4j
aggregate runner -> Admin API
aggregate runner -> runtime rerank
```

## 7. Demo 阶段完成标准

满足以下条件即可认为 demo 聚合方案完成：

1. 能稳定从 `skill_fact_events` 读取原始事实
2. 能生成 `global / department / scene / version` 四类聚合结果
3. 每条结果都包含基础 count、核心 rate、`qualityScore`、`confidence`
4. 输出 JSON 文件能被人工检查，也能被后续脚本消费
5. 对缺少 feedback、缺少 verification 的 Skill 不报错，能给出合理默认值

## 8. 后续升级路线

Demo 阶段跑通后，再按这个顺序升级：

1. 加 `project` 维度
2. 把事件级聚合升级成 `attempt snapshot -> aggregate`
3. 支持多窗口（`7d / 30d / 90d`）
4. 加 `freshnessScore`、`failurePenalty`、`priorScore`
5. 直接把聚合结果写回 Neo4j
6. 让 runtime 消费 graph feature

## 9. 推荐结论

对于 demo 阶段，最合适的方案不是“最完整的评分模型”，而是：

**先用简单、可解释、能稳定产出的聚合结果把闭环跑通。**

也就是说，当前最合适的 V1 是：

- 原始事件入 PG
- 定时聚合出 JSON
- 只做四类 scope
- 只保留核心 count / rate / qualityScore / confidence
- 先不引入更复杂的惩罚项和实时图谱更新

这样最容易演示，也最容易后续迭代。
