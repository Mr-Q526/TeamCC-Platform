# 图谱偏好专项评测集 500 条版复测总结（修复评测入口后）

## 1. 本次复测做了什么

- 修复了 [scripts/skillRetrievalEval.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/scripts/skillRetrievalEval.ts) 的 CLI 默认值问题。
- 修复前：`retrievalFeaturesPath` 默认是 `null`，会把 `bm25_vector_graph` 误跑成“不加载 retrieval features”的路径。
- 修复后：未显式传 `--retrieval-features` 时，评测会自动读取默认 `skill-retrieval-features.json`。
- 增加了回归测试 [scripts/skillRetrievalEval.test.ts](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/scripts/skillRetrievalEval.test.ts)，防止以后再次把 graph 默认关掉。
- 重新执行了 500 条 `graph-preference` 专项集：
  - canonical run：`offline-retrieval-2026-04-15T02-53-33-541Z-a32120cc`
  - experiment run：`offline-retrieval-2026-04-15T02-56-37-276Z-6bfa524d`

## 2. 数据集状态

- 数据集：`graph-preference/v1`
- case 总数：`500`
- audit 结果：`issueCount = 0`，`quotaIssueCount = 0`
- audit 输出：
  - [retrieval-graph-preference-v1-audit-summary.json](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/evals/skills/reports/retrieval-graph-preference-v1-audit-summary.json)
  - [retrieval-graph-preference-v1-review-sample.json](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/evals/skills/reports/retrieval-graph-preference-v1-review-sample.json)

说明：

- `canonical`：默认 `skill-retrieval-features.json`
- `experiment`：`skill-retrieval-features.experiment.json`
- 两次 run 都是真实 `bm25 / bm25_vector / bm25_vector_graph`，`degradedRate = 0`

## 3. 总体结果

### 3.1 canonical 结果

| mode | Recall@1 | Recall@3 | MRR | degradedRate |
| --- | ---: | ---: | ---: | ---: |
| bm25 | 0.706 | 0.950 | 0.826333 | 0 |
| bm25_vector | 0.712 | 0.958 | 0.831833 | 0 |
| bm25_vector_graph | 0.712 | 0.958 | 0.831833 | 0 |

关键解释：

- graph 路径这次已经真正执行了。
- 但 `graphAppliedRate = 0`，`preferenceBonusAppliedRate = 0`。
- 这说明 canonical features 里虽然文件存在，但当前没有足够的 `project / scene / department` 聚合信号命中这 500 条专项 case，因此 graph 没有实际加分。

### 3.2 experiment 结果

| mode | Recall@1 | Recall@3 | MRR | degradedRate |
| --- | ---: | ---: | ---: | ---: |
| bm25 | 0.706 | 0.950 | 0.826333 | 0 |
| bm25_vector | 0.712 | 0.958 | 0.831833 | 0 |
| bm25_vector_graph | 0.852 | 0.960 | 0.902767 | 0 |

关键解释：

- experiment features 把我们注入的正反馈真正带进了 rerank。
- `graphAppliedRate = 0.658`
- `preferenceBonusAppliedRate = 0.488`
- `preferredSkillTop1Rate = 0.852`
- `preferredSkillBeatsCompetitorRate = 0.660`
- `wrongIntentHijackRate = 0.086`

## 4. 按 domain 看结果

| domain | caseCount | canonical graph R@1 | experiment graph R@1 | 结论 |
| --- | ---: | ---: | ---: | --- |
| frontend | 200 | 0.520000 | 0.855000 | 提升最明显，说明 homepage / component-library / docs / auth / search 等前端场景的正反馈已被图谱吃进去 |
| backend | 60 | 1.000000 | 1.000000 | 本来就稳定，图谱没有继续拉升 |
| security | 60 | 0.983333 | 0.983333 | 安全专项已稳定，当前 experiment 没有额外 uplift |
| design | 60 | 0.666667 | 0.666667 | design 里真正被扶起来的主要不是 `ppt-maker`，因此整体不变 |
| tools | 54 | 0.796296 | 0.796296 | tools 仍未受本轮图谱偏好显著影响 |
| review | 27 | 0.740741 | 0.740741 | review 不变 |
| general | 19 | 0.631579 | 0.789474 | development-plan-doc-pro 等 general 偏好已能被 graph 抬升 |
| ai | 20 | 0.900000 | 0.900000 | ai 本身已较稳，本轮不变 |

## 5. 变化面概览

- Top1 被 graph 改写的 case：`70`
- `improveCount = 70`
- `hurtCount = 0`
- 也就是这次 experiment 图谱加权只带来了正向变化，没有新增误伤

最常见的被 graph 扶起来的目标 skill：

1. `frontend/component-library-pro`：14
2. `frontend/docs-site-pro`：11
3. `frontend/design-system-builder-pro`：9
4. `frontend/developer-portal-pro`：9
5. `frontend/auth-login-page-pro`：8
6. `frontend/search-results-page-pro`：7
7. `frontend/settings-page-pro`：5
8. `frontend/pricing-page-pro`：3
9. `general/development-plan-doc-pro`：3

按 tag 看，发生变化的 case 主要集中在：

- `frontend`：67
- `general`：3

## 6. homepage 与 ppt-maker 失败簇分析

### 6.1 homepage

- homepage 相关 case：`20`
- `bm25 Top1 = 19`
- `vector Top1 = 19`
- `experiment graph Top1 = 19`

这说明 homepage 簇目前不是主要瓶颈，图谱也没有额外拉升空间。唯一残留 miss：

- case：`retrieval_graph_preference_frontend_homepage_preference_007`
- 期望：`frontend/website-homepage-design-pro`
- 实际 Top1：`frontend/website-homepage-design`

原因：

- `website-homepage-design-pro` 在这个 case 上没有拿到 graph bonus
- `blockedReason = "intent_mismatch"`
- 也就是说，这不是反馈不足，而是 recall intent 边界还没把这条“扩展表达”稳定识别为 pro/homepage strategic intent

结论：

- homepage 已经不是大失败簇
- 剩余问题更偏向 `intent/discriminator` 规则，而不是 graph feedback 覆盖不足

### 6.2 ppt-maker

- ppt 相关 case：`30`
- `bm25 Top1 = 14`
- `vector Top1 = 14`
- `experiment graph Top1 = 14`

这说明 `ppt-maker` 仍然是当前最大的残留失败簇之一，而且本轮图谱没有把它扶起来。

典型失败模式：

- 目标 skill：`design/ppt-maker`
- 实际 Top1：`design/ppt-course-presentation`
- 典型 case：
  - `retrieval_graph_preference_design_ppt_maker_preference_003`
  - `retrieval_graph_preference_design_ppt_maker_preference_016` 到 `026`

从 case artifact 看，主要有两类原因：

1. `ppt-maker` 被 `recall_gap_exceeded:0.15` 挡住  
   说明它在 recall 阶段就落后太多，graph gate 按当前规则不允许硬抬。

2. `ppt-maker` 被 `intent_mismatch` 挡住  
   说明 query 表达仍然更像“课程讲义/课件演示”，被 `ppt-course-presentation` 吞掉了。

同时，`ppt-course-presentation` 在这些 case 上还能拿到一个小的 graph bonus：

- 典型 `graphBonus = 0.024783`

结论：

- `ppt-maker` 不是“没有反馈”，而是“query intent 边界 + recall gap gate”共同导致 graph 抬不动
- 下一轮如果要继续打这个簇，重点不应该只是继续刷反馈，而要同时改：
  - `ppt-maker / ppt-course-presentation` 的 recall intent 边界
  - `ppt-maker` 在运营场景下的 scene / department 匹配
  - 是否需要为明显的运营 PPT case 放宽 `recall_gap` gate

## 7. 对“为什么之前看起来会退化”的最终结论

之前那份 [20260415-graph-preference-v2-500cases-summary.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/evals/skills/reports/20260415-graph-preference-v2-500cases-summary.md) 里出现“`bm25_vector_graph` 与 `bm25_vector` 完全一致”，主要有两层含义：

1. 第一层是评测入口 bug  
   当时 `skillRetrievalEval.ts` 默认把 `retrievalFeaturesPath` 设成 `null`，导致 graph features 根本没有加载。

2. 第二层是 canonical feature 稀疏  
   修完 bug 之后，canonical run 仍然没有 uplift，因为默认 snapshot 里还没有足够的上下文反馈命中这 500 条专项 case。

所以“退化”并不是图谱权重把排序压坏了，而是：

- 先是评测入口把 graph 关掉了
- 然后修复后发现，默认 canonical 图谱特征还不够强

## 8. 当前结论

- 评测入口 bug 已修复
- 500 条专项集 audit 通过
- canonical run 现在是可信的，但当前默认图谱特征基本没有实际 bonus
- experiment run 已证明：当 `project / scene / department` 的反馈信号足够时，图谱确实能把目标优质 skill 稳定抬上来
- 当前最大的剩余失败簇不是 homepage，而是 `ppt-maker`

## 9. 下一步建议

1. 把 `experiment` 中已验证有效的反馈与特征，挑选性 promote 到 canonical，而不是继续让 canonical 长期为空壳。
2. 单独治理 `ppt-maker / ppt-course-presentation` 的 intent 边界。
3. 对 `ppt-maker` 的运营场景补更贴近真实表达的 `scene/project/department` 反馈。
4. 复跑同一套 500 条专项集，目标是先把 `ppt` 簇的 Top1 拉上来，再看 design 全域是否联动提升。
