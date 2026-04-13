# Skill 评测系统计划

## 1. 目标

本计划的目标不是只做一份离线分数表，而是建立一套可以持续复用的 Skill 评测体系，用来回答以下问题：

1. `skill-graph` 的检索能力是否稳定地把对的 Skill 放到前面。
2. 图谱反馈聚合是否真的对 rerank 产生了正向影响，而不是只在数据上看起来成立。
3. TeamCC 在真实运行链路里，是否真的会：
   - 发起正确检索
   - 展示正确候选
   - 选择正确 Skill
   - 保持稳定身份归因
   - 把反馈写回 `skill-graph`
4. 当结果变差时，能否快速定位问题在 recall、rerank、上下文抽取、执行选择还是反馈回写。

最终交付不是单一脚本，而是四层评测体系：

- 离线检索评测
- 图谱增益评测
- TeamCC 联调盲测
- 回放诊断评测

## 2. 当前基础

当前已经具备的基础能力：

- `skill-graph` 已持有 `skills-flat/`、registry、embeddings、retrieval features、graph assets。
- `retrieveSkills()` 已经是 canonical retrieval 入口。
- `skill_fact_events -> PG -> skill_feedback_aggregates -> Neo4j -> skill-retrieval-features.json` 闭环已经打通。
- 检索结果已经包含可解释输出：
  - `finalScoreBreakdown`
  - `graphFeatureExplanation`
- Neo4j 已经有全量 Skill 元数据和反馈聚合图谱。

当前仍然存在的评测前缺口：

- embeddings 还没有确认 106/106 全覆盖。
- 评测数据集和标签口径还没有冻结。
- TeamCC 端到端盲测方案还没有正式落文档。
- TeamCC 联调需要额外暴露或保留部分调试信息，才能在失败后快速回放。

因此本阶段适合做的是“评测系统建设”，不是直接宣告“检索系统最终验收完成”。

## 3. 评测对象

### 3.1 检索对象

评测的主对象是：

```ts
retrieveSkills(request): Promise<SkillRetrievalResponse>
```

核心比较档位：

- `bm25`
- `bm25_vector`
- `bm25_vector_graph`

### 3.2 端到端对象

TeamCC 联调评测时，评测对象变成真实链路：

```text
TeamCC runtime
  -> retrieval adapter
  -> skill-graph/retrieveSkills()
  -> skill_discovery attachment
  -> SkillTool / slash command
  -> SkillFactEvent
  -> skill-graph aggregates + graph refresh
```

### 3.3 反馈对象

反馈评测主要验证：

- `skill_feedback` 是否成功写入事实表
- 聚合表是否正确更新
- Neo4j 是否正确更新
- retrieval features 是否重建并影响下一轮 rerank

## 4. 评测体系分层

### 4.1 L1 离线检索评测

用途：

- 验证检索算法本身
- 排除 TeamCC UI/模型决策噪声
- 对比不同 retrieval mode

输入：

- 固定 query 集
- 固定 `SkillRetrievalRequest`
- 固定 registry / embeddings / retrieval features snapshot

输出：

- 每个 query 的 TopK 候选
- 关键候选的 recall score / graph score / final score
- 汇总指标

### 4.2 L2 图谱增益评测

用途：

- 验证 graph feedback 是否让正确 Skill 排名提升
- 验证反馈更新不是“写进数据库但对检索没影响”

输入：

- 一组有明确正例 Skill 的 query
- 反馈注入前后的 retrieval features

输出：

- before / after 排名变化
- graph uplift 指标
- 影响分解

### 4.3 L3 TeamCC 联调盲测

用途：

- 模拟真实用户使用 TeamCC
- 不告诉模型应该用哪个 Skill
- 验证 TeamCC 与 `skill-graph` 的接口、选择、执行、反馈链路

盲测原则：

- 测试者只给任务描述
- 不人工指定 Skill
- 重点看真实 topK、最终选择和执行结果

执行形态：

- 为每个 case 准备一个独立沙盒项目。
- 沙盒项目必须是“半成品项目”，而不是空仓库，也不是已经完成的项目。
- TeamCC 在沙盒里像真实接手一个正在开发中的项目一样工作，自主检索、自主选择 Skill、自主执行。
- 测试者不在执行前告诉 TeamCC 应该使用哪个 Skill，也不在执行中人工干预选型。
- 执行结束后，由人工评审或 LLM 评审打分。

#### 4.3.1 沙盒环境设计

L3 盲测不应只喂一句 query，而应提供真实工程上下文。

每个沙盒环境至少包含：

- 一个独立 worktree 或临时仓库
- 已有但未完成的代码结构
- 明确但未完成的需求目标
- 至少一个真实约束：
  - 缺失页面模块
  - 缺失组件
  - 缺失数据处理逻辑
  - 缺失部署配置
  - 缺失文案或设计稿生成
- 可运行的基础命令：
  - 安装
  - 测试
  - 构建
  - 启动或预览

推荐的沙盒项目类型：

- 半成品品牌官网项目
- 半成品管理后台项目
- 半成品表单/低代码项目
- 半成品 PPT/内容生成项目
- 半成品安全审计或部署修复项目

沙盒的核心要求：

- 能逼真触发 Skill 选择问题
- 能让错误 Skill 选择造成明显后果
- 能让正确 Skill 选择带来可观察收益

#### 4.3.2 任务投放方式

每个盲测 case 要包含两部分输入：

1. 用户任务描述
2. 沙盒项目上下文

用户任务描述必须保持自然口语化，例如：

- “把这个半成品官网首页补完整，要求更像大厂品牌官网。”
- “这个后台首页现在太简陋了，补成可交付版本。”
- “基于现有内容，帮我整理一版面向投资人的 PPT。”
- “这个项目的部署链路有问题，帮我排查并修好。”

沙盒项目上下文由仓库本身提供，不通过提示词直接告诉 TeamCC 哪个 Skill 应该使用。

#### 4.3.3 TeamCC 行为要求

盲测时 TeamCC 必须：

- 使用真实 retrieval 入口进行 Skill discovery
- 基于返回候选自行决定是否调用 Skill
- 使用真实执行链路完成任务
- 产出真实代码、文档或配置修改
- 写出真实 `SkillFactEvent`

盲测时不允许：

- 人工直接指定 Skill
- 人工替 TeamCC 重写 request
- 用离线脚本绕过真实 discovery/selection 流程

#### 4.3.4 评分机制

L3 盲测的评分分两层：

1. 结果评分
2. 过程评分

结果评分关注任务是否完成：

- 产物是否满足需求
- 代码或文档质量是否达标
- 是否通过基本测试、构建或预览检查
- 是否出现明显跑偏

过程评分关注 Skill 系统是否工作正确：

- 是否检索到合理候选
- 是否选择了合理 Skill
- 是否存在明显误召回或误选
- 事件归因是否完整
- 反馈是否成功进入闭环

评分执行方式支持两种：

- 人工评分
- LLM 辅助评分

人工评分适合：

- 高价值 case
- UI/体验类 case
- 复杂工程质量判断

LLM 评分适合：

- 批量初筛
- 文档/文案类 case
- 明确 rubric 的代码类 case

推荐口径是：

- 人工作为最终裁决
- LLM 作为初评和解释辅助

#### 4.3.5 评分 Rubric

每个 case 建议至少按以下维度打分：

- `task_outcome_score`
- `retrieval_quality_score`
- `skill_selection_score`
- `execution_quality_score`
- `attribution_integrity_score`
- `feedback_loop_score`
- `overall_pass`

建议使用 `1-5` 或 `0-100` 两种口径之一，但同一轮评测必须统一。

`overall_pass` 的判断建议满足：

1. 任务结果达到可接受标准
2. 最终调用 Skill 属于合理范围
3. 事件链路完整
4. 没有严重跑偏或伪成功

#### 4.3.6 LLM 评分要求

如果使用 LLM 做辅助评分，必须同时保存：

- 被评审 case 输入
- 最终代码 diff 或产物
- retrieval request/response
- Skill 调用记录
- 评分 rubric
- LLM 输出的评分结论和理由

LLM 评分不能只给总分，必须输出：

- 通过/失败
- 主要优点
- 主要问题
- 是否是 retrieval 问题、selection 问题还是 execution 问题

#### 4.3.7 盲测产物留存

每个沙盒 case 至少保留：

- `sandbox-manifest.json`
- `task-brief.md`
- `teamcc-run.log`
- `retrieval-request.json`
- `retrieval-response.json`
- `skill-events.jsonl`
- `final-diff.patch`
- `evaluation-human.json` 或 `evaluation-llm.json`

这样后续才能做失败回放和根因分析。

#### 4.3.8 L3 与前两层评测的关系

L3 盲测不是替代离线评测，而是建立在前两层之上的验收层。

正确顺序应该是：

1. 先完成 L1，确认 retrieval 基础有效
2. 再完成 L2，确认 graph feedback 能影响排序
3. 最后进入 L3，看 TeamCC 在真实项目里是否真的会把这些能力用起来

如果直接跳到 L3，容易出现两个问题：

- 一旦失败，不知道是检索差还是执行差
- 盲测成本高，但不能形成可比较结论

### 4.4 L4 回放诊断评测

用途：

- 对 L3 失败 case 定位原因
- 固定 payload 复现问题
- 排除模型随机性

输入：

- TeamCC 导出的请求上下文
- `SkillRetrievalRequest`
- retrieval response
- 事件日志

输出：

- 失败定位结论
- 问题归属层级

## 5. 评测阶段与优先级

### P0: 评测底座就绪

目标：

- 数据资产齐全
- 脚本入口稳定
- 样本口径统一

必须完成：

1. 补齐 embeddings 全覆盖，达到 registry Skill 数一致。
2. 冻结评测集目录结构。
3. 定义统一输出格式。
4. 定义统一指标口径。

产物：

- `evals/skills/queries/*.json`
- `evals/skills/cases/*.json`
- `evals/skills/reports/*.json`
- `evals/skills/README.md`

验收标准：

- 同一批输入重复跑，结果可重现。
- 缺失 embeddings / graph features 时，有明确降级标识。

### P1: 离线检索评测

目标：

- 先验证 retrieval 本身是否可用

必须完成：

1. 建立 query set。
2. 建立 gold 标注。
3. 输出 `bm25 / bm25_vector / bm25_vector_graph` 对比报告。

验收标准：

- 每个 query 都能输出统一 JSON 结果。
- 能计算 MRR、Recall@K、NDCG@K、Top1 命中率。

### P2: 图谱增益评测

目标：

- 验证反馈聚合对排序的真实提升

必须完成：

1. 选定一组受控 Skill。
2. 在反馈注入前后各跑一轮检索。
3. 形成 uplift 报告。

验收标准：

- 结果里能明确看到：
  - 排名变化
  - `graphFeatureScore` 变化
  - `finalScoreBreakdown` 变化

### P3: TeamCC 联调盲测

目标：

- 验证真实用户链路

必须完成：

1. 定义盲测任务集。
2. 定义 TeamCC 运行记录模板。
3. 定义端到端通过标准。

验收标准：

- 能收集每个 case 的：
  - 原始任务描述
  - TeamCC 传给 `retrieveSkills()` 的 request
  - TopK 候选
  - 最终选择的 Skill
  - 执行结果
  - 回写的 SkillFactEvent

### P4: 回放诊断系统

目标：

- 让盲测失败 case 可以拆解定位

必须完成：

1. 保存 request/response/event snapshot。
2. 增加 replay runner。
3. 输出失败归因模板。

验收标准：

- 同一失败 case 可以稳定重放。
- 可以回答“到底是 recall 错、rerank 错、还是 TeamCC 选错”。

## 6. 评测数据集设计

### 6.1 Query 维度

至少覆盖这些主场景：

- 官网首页 / landing page / marketing page
- 后台 / dashboard / admin console
- 表单 / form builder / complex form
- PPT / 演示稿 / presentation
- 文案 / humanizer / rewriting
- 安全 / audit / threat modeling
- 部署 / release / vercel / infra
- 数据处理 / spreadsheet / csv / excel
- 工具类 / 截图 / 浏览器自动化 / 文档转换

### 6.2 Query 难度

每类至少覆盖三档：

- 明确查询：直接点名需求
- 模糊查询：只有业务描述
- 干扰查询：多个 Skill 都可能相关

### 6.3 Gold 标签

每个 case 至少要有：

- `must_hit_skill_ids`
- `good_skill_ids`
- `bad_skill_ids`
- `expected_scene`
- `expected_domain`
- `notes`

### 6.4 联调任务集

TeamCC 盲测任务要比离线 query 更自然，建议使用用户口语输入，例如：

- “我想做一个大厂品牌官网首页，科技感一点。”
- “帮我设计一个管理后台首页，要有数据卡片和趋势图。”
- “我要做一份路演 PPT，面向投资人。”
- “把这段中文文案润色成更像品牌宣传稿。”
- “帮我做一次安全审计，看看权限边界和威胁面。”

## 7. 指标体系

### 7.1 离线检索指标

- `Recall@1`
- `Recall@3`
- `Recall@5`
- `MRR`
- `NDCG@3`
- `NDCG@5`
- `Top1 exact hit rate`
- `Top3 acceptable hit rate`

### 7.2 图谱增益指标

- `graph_uplift_top1_count`
- `graph_uplift_avg_rank_delta`
- `graph_helped_queries`
- `graph_hurt_queries`
- `graph_neutral_queries`

### 7.3 反馈闭环指标

- `feedback_event_write_success_rate`
- `aggregate_refresh_success_rate`
- `neo4j_refresh_success_rate`
- `retrieval_features_refresh_success_rate`
- `feedback_to_rerank_latency`

### 7.4 TeamCC 联调指标

- `discovery_hit_rate`
- `selection_correct_rate`
- `execution_success_rate`
- `attribution_integrity_rate`
- `feedback_capture_rate`
- `end_to_end_success_rate`

## 8. 输出与报告格式

### 8.1 Case 级输出

每个 case 输出：

```json
{
  "caseId": "homepage-brand-001",
  "queryText": "品牌官网首页homepage前端设计",
  "expectedSkills": ["frontend/website-homepage-design-pro"],
  "retrievalModeResults": {
    "bm25": {},
    "bm25_vector": {},
    "bm25_vector_graph": {}
  },
  "winner": {
    "skillId": "frontend/website-homepage-design-pro",
    "rank": 1,
    "finalScore": 0.824518
  },
  "notes": []
}
```

### 8.2 汇总报告

每次评测输出：

- `summary.json`
- `cases.json`
- `leaderboard.json`
- `uplift.json`
- `failures.json`

### 8.3 人读报告

需要再额外输出一份 markdown：

- 结论摘要
- Top 改善 case
- Top 失败 case
- 失败原因归类
- 下一步建议

## 9. TeamCC 联调盲测方案

### 9.1 盲测原则

- 由测试者只提供任务目标，不指定 Skill 名称。
- TeamCC 走真实运行链路。
- 结果先按最终表现打分，再回看检索和事件。

### 9.2 盲测记录项

每个 case 都必须记录：

- 用户原始输入
- TeamCC 发起检索时间
- `SkillRetrievalRequest`
- 返回候选 TopK
- 被注入的 `skill_discovery` attachment
- 最终选择的 Skill
- 执行状态
- `SkillFactEvent` 列表
- 是否出现 feedback

### 9.3 盲测通过标准

一个 case 判定通过，至少要满足：

1. Top3 中出现至少一个 gold Skill。
2. 最终被调用 Skill 属于 `must_hit_skill_ids` 或 `good_skill_ids`。
3. 事件归因完整，具备 `skillId/version/sourceHash/traceId/taskId/retrievalRoundId`。
4. 执行结果未明显跑偏。

### 9.4 盲测失败分类

- `R1`: recall 失败，正确 Skill 未进 TopK
- `R2`: rerank 失败，正确 Skill 在 TopK 但排序偏低
- `T1`: TeamCC 请求转换错误
- `T2`: TeamCC 注入后模型未选正确 Skill
- `E1`: Skill 执行失败
- `F1`: feedback 未写入或未被聚合

## 10. 回放诊断方案

### 10.1 回放输入

每个失败 case 保存：

- `raw-user-input.json`
- `retrieval-request.json`
- `retrieval-response.json`
- `events.jsonl`
- `post-run-summary.json`

### 10.2 回放目标

能单独重放：

- 只跑 retrieval
- 只跑 rerank
- 只检查 graph features
- 只检查事件归因

### 10.3 回放结论模板

每个失败 case 要输出：

- 问题层级
- 根因
- 是否可复现
- 是否需要 TeamCC 改动
- 是否需要 `skill-graph` 改动

## 11. 脚本与目录规划

建议在 `skill-graph` 下增加：

```text
evals/
  skills/
    README.md
    cases/
    queries/
    fixtures/
    runs/
    reports/
```

建议新增脚本：

- `skills:eval:prepare-dataset`
- `skills:eval:offline`
- `skills:eval:uplift`
- `skills:eval:report`
- `skills:eval:replay`

现有 `eval:skills` 建议逐步升级为统一入口，支持：

- `--mode offline`
- `--mode uplift`
- `--mode replay`

## 12. 需要 TeamCC 配合的地方

本计划的评测系统主体在 `skill-graph`，但 TeamCC 联调盲测必须有这些配合项。

### 12.1 必须配合

1. 能导出或记录实际发送给 `retrieveSkills()` 的 request。
2. 能记录最终选中的 Skill 稳定身份：
   - `skillId`
   - `version`
   - `sourceHash`
3. 能保留 discovery 阶段的 TopK 候选快照。
4. 能导出本次运行产生的 `SkillFactEvent`。

### 12.2 建议配合

1. 增加一个 debug 开关，允许保存 retrieval request/response snapshot。
2. 增加一个 debug 开关，允许保存最终 attachment 内容。
3. 增加一次运行的统一 `session/run id`，方便跨日志关联。

### 12.3 暂不要求

- 不要求 TeamCC 在本阶段做新的在线服务化改造。
- 不要求 TeamCC 改 UI。
- 不要求 TeamCC 改 retrieval owner 边界。

## 13. 分步执行方案

### Step 1

完成评测数据集底座。

具体工作：

- 建 `evals/skills/` 目录
- 冻结 query schema
- 冻结 case schema
- 补齐 embeddings 覆盖检查脚本

### Step 2

完成离线检索评测。

具体工作：

- 跑三档 retrieval mode
- 输出 case 级 JSON
- 输出 summary 报告

### Step 3

完成图谱增益评测。

具体工作：

- 针对受控 Skill 跑 before/after
- 输出 uplift 报告

### Step 4

制定 TeamCC 联调盲测手册。

具体工作：

- 固定盲测任务集
- 固定记录模板
- 固定通过标准

### Step 5

接 TeamCC 做联调盲测。

具体工作：

- 真跑任务
- 收集 request/response/events
- 标记通过与失败

### Step 6

补回放诊断工具。

具体工作：

- 失败 case 回放
- 分类根因
- 形成修复任务列表

## 14. 当前建议执行顺序

按当前项目进度，建议下一步严格按这个顺序推进：

1. 先做 Step 1：评测数据集底座
2. 再做 Step 2：离线检索评测
3. 再做 Step 3：图谱增益评测
4. 最后再做 Step 4-6：TeamCC 联调盲测与回放诊断

原因很直接：

- 如果离线检索都不稳定，盲测会浪费大量时间在无效排障上。
- 如果没有固定评测集，盲测结果不可比较。
- 如果没有回放诊断，盲测失败很难拆原因。

## 15. 本文档的阶段结论

结论不是“马上去做最终盲测”，而是：

- 现在已经可以正式启动评测系统建设。
- 第一优先级是先把 `skill-graph` 的离线评测底座做完整。
- TeamCC 联调盲测应当是这一阶段的后半段验收，不应跳过离线评测直接开跑。

下一步建议直接执行：

```text
Step 1: 建立 evals/skills/ 数据集与 schema
```
