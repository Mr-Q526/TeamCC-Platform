# Skill 聚合结果 Demo-first 扩展路线

**日期**: 2026-04-12  
**状态**: Draft  
**适用范围**: `skill-graph/` 聚合结果从 Demo V1 演进到图谱可消费阶段

## 1. 一句话结论

当前聚合方案应该继续走 **Demo-first** 路线：

1. 先把当前 V1 的聚合结果稳定下来
2. 再让这份结果进入 Neo4j demo
3. 最后再升级成更完整的结构化聚合架构

也就是说，下一阶段不是立刻把 V1 改成长期最优模型，而是：

**先保证聚合结果可展示、可解释、可回写图谱。**

## 2. 当前状态

当前仓库已经具备以下基础能力：

- 原始事实表：`skill_fact_events`
- 原始事实查询接口：`querySkillFactEvents()`
- Demo 聚合脚本：`skills:facts:aggregate`
- Demo 聚合产物：
  - `skill-graph/data/aggregates/skill-feedback-aggregates.json`
- Demo 聚合说明文档：
  - [20260412-skill-feedback-aggregate-demo-v1.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/architecture/20260412-skill-feedback-aggregate-demo-v1.md)
- 当前聚合实现：
  - [skillFactAggregates.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/src/aggregates/skillFactAggregates.ts)

当前 V1 已经能产出：

- `global`
- `department`
- `scene`
- `version`

四类 scope 的聚合结果。

### 2.1 当前 V1 为什么适合 demo

当前 V1 适合 demo，原因不是它“最完整”，而是它满足了 demo 最关键的三点：

- 原始事件已经入 PG，可回放
- 聚合结果已经能稳定产出 JSON
- 结果里已经包含 count、rate、score、confidence，足够做演示和图谱 seed 替换

### 2.2 当前 V1 有意简化的地方

以下简化是**有意为之**，不是缺陷：

- 不做 `attempt snapshot`
- 不做 `project` 维度
- 不做多窗口（只保留 `30d`）
- 不做实时图谱写回
- 不做复杂惩罚项、先验分、冷启动学习逻辑
- 不让 runtime 直接消费当前 aggregate

这些简化的目的只有一个：

**把 demo 闭环压到最短路径。**

### 2.3 当前 V1 与实现之间的差异

当前文档和实现存在一个合理但需要被记录的差异：

- V1 文档主口径更简，只强调核心 `count / rate / qualityScore / confidence`
- 当前实现已经额外输出了一些扩展字段，例如：
  - `freshnessScore`
  - `failurePenalty`
  - `costPenalty`
  - `firstEventAt`
  - `lastEventAt`

处理原则：

- 这些扩展字段可以保留
- 但在 demo 语义上，它们不是 V1 的必需主口径
- UI、Neo4j demo、后续 graph update 不应依赖这些扩展字段存在

## 3. 分阶段演进路线

### 3.1 V1 Demo

#### 目标

保持当前聚合结果稳定可产出、可检查、可解释。

#### 保留内容

- 固定四类 scope：
  - `global`
  - `department`
  - `scene`
  - `version`
- 固定单窗口：
  - `30d`
- 固定产物形态：
  - JSON 文件
- 固定主口径：
  - `selectionRate`
  - `invocationRate`
  - `successRate`
  - `verificationPassRate`
  - `userSatisfaction`
  - `qualityScore`
  - `confidence`

#### 本阶段不要动

- 不把 V1 直接改成 `attempt snapshot -> aggregate`
- 不同时引入 `project`
- 不同时引入多窗口
- 不让 UI 或 Neo4j 依赖当前 `qualityScore` 的具体公式细节

#### 完成标准

另一个工程师只看 V1 聚合文件，就能判断：

- 某个 Skill 全局表现如何
- 某个 Skill 在 department / scene 下是否更强
- 某个 version 是否比另一个 version 更稳定

### 3.2 V1.5 Demo+Graph

#### 目标

在不改变 V1 主口径的前提下，让聚合结果成为 Neo4j demo 的正式输入。

#### 新增能力

- 定义 `aggregate -> graph update` 输入映射
- 让当前 aggregate JSON 可以被图谱更新脚本直接读取
- 用聚合结果更新这四类图谱对象：
  - `Skill` 全局质量快照
  - `Department -> Skill`
  - `Scene -> Skill`
  - `SkillVersion`

#### 这一阶段建议新增的稳定接口

- `SkillFeedbackAggregate`
  视为对外稳定输出结构
- `AggregateScopeType`
  继续允许新增 `project`、`domain`
- `aggregateGraphInput` 或同类中间对象
  作为 Neo4j update job 的输入层

#### 本阶段不要动

- 不重写 V1 聚合算法
- 不先引入复杂 snapshot 层
- 不把当前 aggregate 直接接入 runtime rerank
- 不在这一阶段做 Admin 查询接口

#### 完成标准

只用当前聚合结果，就能替换掉 demo seed 里的手写 `FeedbackAggregate` 和主要效果边。

### 3.3 V2 Structured Aggregation

#### 目标

把当前“事件直接聚合”升级成更稳定的结构化聚合。

#### 新增能力

- 引入：

```text
SkillFactEvent
  -> Attempt Snapshot
  -> Aggregates
```

- 支持多窗口：
  - `7d`
  - `30d`
  - `90d`
- 增加 `project` 维度
- 允许更完整的评分模型：
  - `freshnessScore`
  - `failurePenalty`
  - `priorScore`
  - 冷启动策略

#### 这一阶段解决的问题

- 同一个 task / retrieval round 下多事件重复计算
- 版本级效果比较需要更稳定的 attempt 归因
- 图谱和运营侧需要趋势和回溯能力

#### 本阶段新增后，V1 保留的部分

- `aggregateKey = scopeType + scopeId + skillId + window`
- `version` 仍绑定 `skillVersion + sourceHash`
- `SkillFeedbackAggregate` 继续作为输出层，只扩字段，不随意改语义

## 4. 现在要预留什么

### 4.1 要预留的接口和类型

当前就应该把下面这些视为“后续可扩展接口”，不要写死为 demo 临时结构：

- `AggregateScopeType`
  - 当前值：`global / department / scene / version`
  - 后续可扩：`project / domain`
- `SkillFeedbackAggregate`
  - 作为稳定输出层
  - 后续允许新增字段
  - 不随意修改已有字段含义
- `aggregateKey`
  - 继续保留：

```text
scopeType + scopeId + skillId + window
```

- `version` 维度主键
  - 必须继续绑定：

```text
skillVersion + sourceHash
```

### 4.2 要预留的概念，但现在不实现

以下内容现在只需要在设计上预留，不需要立刻实现：

- `attempt snapshot`
- `aggregate -> graph update` 中间输入层
- 多窗口 aggregate manifest
- graph feature provider

## 5. 现在不要做什么

为了保证路线清晰，当前不应做这些事情：

- 不把 demo 阶段一次性升级成长期完整架构
- 不在 V1 里直接塞入 `project`、多窗口、熔断、在线 rerank
- 不让图谱更新脚本依赖 V1 的“某个评分公式常量”
- 不让 UI 把当前 JSON 当成未来最终 API 契约

一句话：

**现在应稳定输出层，不应过早稳定内部实现细节。**

## 6. Demo-first 的最短演进顺序

推荐严格按这个顺序推进：

1. 固化 aggregate 输出字段和 JSON 产物  
2. 增加 Neo4j update input 映射  
3. 用聚合结果更新 `global / department / scene / version` 图谱节点或边  
4. 再考虑 `attempt snapshot`  
5. 最后扩到 `project`、多窗口、runtime feature provider  

为什么这样排：

- 第 1-3 步能最快替换 demo 手写 seed
- 第 4 步开始才是结构升级
- 第 5 步再进入真正的平台化和在线消费

## 7. 迁移触发条件

以下情况出现时，再启动对应升级，不要提前做。

### 7.1 从 V1 升级到 `attempt snapshot`

触发条件：

- demo 需要稳定比较同一个 Skill 的多个 version
- 同一个 task 中出现多条事件导致聚合解释困难
- 需要把“曝光 -> 选择 -> 调用 -> 成功”收口成一次 attempt 语义

### 7.2 从单窗口升级到多窗口

触发条件：

- 需要做趋势图
- 需要看近期效果 vs 长期效果
- 需要回溯版本发布前后表现

### 7.3 增加 `project` 维度

触发条件：

- demo 进入真实项目偏好展示阶段
- 图谱需要 `Project -> Skill` 关系
- 当前 `department / scene` 已不足以表达差异

增加前必须加门槛：

- 只对样本量超过阈值的 project 产出聚合
- 防止图谱边数量在 demo 期过快膨胀

## 8. 兼容原则

后续所有升级都应遵循以下兼容原则：

1. 新字段可以加，旧字段语义不改  
2. `aggregateKey = scopeType + scopeId + skillId + window` 继续保留  
3. `version` 维度必须继续绑定 `skillVersion + sourceHash`  
4. 输出层和内部计算层分离  
5. 当前 V1 文档保留，不做覆盖式重写  

## 9. 推荐结论

当前最合理的路线不是“立刻把聚合做成最终架构”，而是：

**先把 V1 聚合结果变成图谱 demo 的正式输入，再在下一阶段升级内部聚合结构。**

因此，最近两步最值得做的是：

1. 固化 `SkillFeedbackAggregate` 输出结构
2. 增加 `aggregate -> Neo4j update` 映射

而不是马上重构成 `attempt snapshot` 或一次性做 `project + 多窗口 + rerank`。
