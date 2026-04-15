# Skill Graph Rerank V2 全量 Benchmark 验收总结

## 1. 本轮目标

本轮不是继续“刷反馈”，而是完成 `skill-graph` 的 graph rerank V2 重设计，并用 300 条 benchmark 验证：

- graph 不再结构性惩罚正确的 recall winner
- canonical/live 与 experiment 资产彻底隔离
- retrieval / aggregate / graph / eval schema 补齐 `projectId`
- `bm25_vector_graph` 至少在 live 口径下不低于 `bm25_vector`

## 2. 本轮实现内容

### 2.1 Canonical / Live / Experiment 资产隔离

- `skill-retrieval-features.json`
  canonical owner，等价于 live 结果。
- `skill-retrieval-features.live.json`
  仅包含真实 runtime facts，不吸收 seed / eval runs。
- `skill-retrieval-features.experiment.json`
  基于 `live + seed overlay` 生成，仅用于实验，不回写 canonical。

过滤口径：

- `canonical/live`
  排除 `eval_runner`，排除 `seed-* / offline-retrieval-* / graph-uplift-* / teamcc-sandbox-blind-* / replay-diagnosis-*`
- `experiment`
  保留 `seed-*` overlay，排除 `offline-retrieval-* / graph-uplift-* / teamcc-sandbox-blind-* / replay-diagnosis-*`

### 2.2 聚合与图特征扩展到 `project`

- `SkillRetrievalRequest` 新增 `projectId?: string | null`
- `SkillRetrievalEvalCase.query` / Langfuse dataset input 新增 `projectId`
- `skill_feedback_aggregates` 新增 `project_id`
- aggregate scope 扩展为：
  - `global`
  - `project`
  - `department`
  - `scene`
  - `version`
- Neo4j graph update 新增：
  - `(:Project)`
  - `(:Project)-[:USED_SKILL]->(:Skill)`
  - `(:FeedbackAggregate)-[:IN_PROJECT]->(:Project)`

### 2.3 Graph Rerank V2

V1 问题：

- 只要 graph path 生效，候选统一变成 `0.70 * recall + 0.30 * graph`
- 没 graph signal 的正确候选被结构性压低
- 少量被刷高 skill 会跨 query 抢 Top1

V2 固定改成：

- `finalScore = recallNormalized + graphBonus`
- 无 graph signal：
  - `finalScore = recallNormalized`
- graph 只加分，不减分
- graph bonus 必须通过：
  - context match gate
  - intent / discriminator gate
  - recall gap gate

context-first graph raw score：

- `project: 0.40`
- `scene: 0.25`
- `department: 0.15`
- `version: 0.10`
- `global: 0.10`

并且：

- 没有 `project / scene / department` 命中时：
  - `graphRawScore = 0`
  - `graphBonus = 0`

### 2.4 Recall -> Rerank explainability

候选新增：

- `queryIntentKeys`
- `queryDiscriminatorKeys`
- `matchedIntentKeys`
- `matchedDiscriminatorKeys`
- `graphEligibility`

`graphEligibility` 包含：

- `eligible`
- `strongestScope`
- `recallGap`
- `bonusCap`
- `blockedReason`

这让 benchmark 可以直接统计：

- graph 为什么没生效
- 是 `no_context_match`
- 还是 `intent_discriminator_mismatch`
- 还是 `recall_gap_exceeded`

### 2.5 TeamCC 配合改动

已补最小配合：

- `TeamSkill-ClaudeCode/src/services/skillSearch/provider.ts`
  - 从 identity 读取 `projectId`
  - 透传给 `@teamcc/skill-graph/retrieval.retrieveSkills()`
  - retrieval telemetry 带上 `projectId`

## 3. 测试与构建状态

### 3.1 单测

已通过：

```bash
bun test skill-graph/src/evals/*.test.ts skill-graph/src/retrieval/*.test.ts skill-graph/src/graph/registryGraphSync.test.ts
```

结果：

- `31 pass`
- `0 fail`

### 3.2 Benchmark 审计

已通过：

```bash
bun run skills:eval:audit-benchmark-cases
```

结果：

- `caseCount = 300`
- `issueCount = 0`
- `quotaIssueCount = 0`

### 3.3 产物刷新

已执行：

```bash
bun run skills:facts:aggregate --preset canonical
bun run skills:facts:build-retrieval-features --preset canonical
bun run skills:facts:build-retrieval-features --preset experiment
```

## 4. 正式 Benchmark 结果

### 4.1 Live 基线

run:

- `offline-retrieval-2026-04-14T16-51-46-886Z-f2600b2d`

总体指标：

| mode | Recall@1 | Recall@3 | Recall@5 | MRR |
| --- | ---: | ---: | ---: | ---: |
| `bm25` | 0.63 | 0.91 | 0.95 | 0.765500 |
| `bm25_vector` | 0.67 | 0.913333 | 0.963333 | 0.792389 |
| `bm25_vector_graph` | 0.67 | 0.913333 | 0.963333 | 0.792389 |

结论：

- live 下，`bm25_vector_graph` 与 `bm25_vector` 完全持平
- 没有任何回退
- 说明 V2 已经修掉了 V1 的结构性惩罚

重点域验收：

| domain | Recall@1 | Recall@3 |
| --- | ---: | ---: |
| `frontend` | 0.644444 | 0.888889 |
| `backend` | 0.666667 | 0.904762 |
| `general` | 0.791667 | 1.000000 |

验收结果：

- `frontend` 达标
- `backend` 达标
- `general` 达标

### 4.2 Experiment

run:

- `offline-retrieval-2026-04-14T16-56-55-301Z-8cb4f19c`

总体指标：

| mode | Recall@1 | Recall@3 | Recall@5 | MRR |
| --- | ---: | ---: | ---: | ---: |
| `bm25_vector` | 0.67 | 0.913333 | 0.963333 | 0.792389 |
| `bm25_vector_graph (experiment)` | 0.666667 | 0.913333 | 0.963333 | 0.790722 |

结论：

- experiment 仍未达到“整体不低于 vector”
- 但退化幅度已经很小：
  - `Recall@1: -0.003333`
  - `MRR: -0.001667`
- 与 V1 的大幅负向污染相比，风险已经明显收敛

### 4.3 Graph Uplift 对比

run:

- `graph-uplift-2026-04-14T16-58-10-109Z-a450f6b4`

结果：

- `upliftCount = 2`
- `neutralCount = 294`
- `hurtCount = 4`

这说明：

- experiment graph 已经不再大面积破坏排序
- 但还没有形成可推广的稳定 uplift

## 5. Graph Coverage 与阻塞原因

### 5.1 Feature 覆盖

`live`:

- `global = 1`
- `version = 1`
- `project = 0`
- `department = 0`
- `scene = 0`

`experiment`:

- `global = 22`
- `version = 22`
- `project = 21`
- `department = 21`
- `scene = 21`

### 5.2 Live 为何完全无 uplift

live benchmark top1 统计：

- `top1Changed = 0`
- `mustHitHurt = 0`
- `mustHitImprove = 0`
- `blockedReason.no_context_match = 300`

原因非常直接：

- benchmark case 当前没有能命中 live aggregates 的 `project / scene / department` graph 先验
- 因此 V2 graph gate 全部判定为 `no_context_match`
- graph bonus 按设计完全不生效

这不是 bug，而是 V2 刻意的“宁可不加分，也不乱加分”。

### 5.3 Experiment 为何只有 2 uplift

experiment top1 统计：

- `top1Changed = 6`
- `mustHitImprove = 2`
- `mustHitHurt = 4`
- `acceptableImprove = 5`
- `acceptableHurt = 2`

top1 blocked reason：

- `none = 37`
- `no_context_match = 249`
- `intent_discriminator_mismatch = 14`

strongest scope：

- `intent = 39`
- `scene = 12`
- `project = 0`
- `department = 0`
- `none = 249`

说明：

- 绝大多数 case 仍然没有 graph context 命中
- 真正吃到 graph bonus 的 case 很少
- `intent_discriminator_mismatch` gate 已经开始挡住跨 query 抬分
- `project` 维度虽然实现了，但 benchmark 当前没有匹配到 experiment 的 project profile

## 6. 变化 Case

### 6.1 Uplift

1. `retrieval_benchmark_frontend_component_library_pro_001`
   `frontend/component-library-pro`
   `rankDelta = +1`
2. `retrieval_benchmark_frontend_website_homepage_design_pro_001`
   `frontend/website-homepage-design-pro`
   `rankDelta = +2`

### 6.2 Hurt

1. `retrieval_benchmark_ai_humanizer_zh_basic_006`
   `ai/humanizer-zh-basic`
   `rankDelta = -1`
2. `retrieval_benchmark_frontend_docs_site_basic_001`
   `frontend/docs-site-basic`
   `rankDelta = -1`
3. `retrieval_benchmark_frontend_docs_site_basic_002`
   `frontend/docs-site-basic`
   `rankDelta = -1`
4. `retrieval_benchmark_frontend_responsive_navigation_basic_001`
   `frontend/responsive-navigation-basic`
   `rankDelta = -1`

域级变化分布：

- `frontend: 2 uplift / 3 hurt / 85 neutral`
- `ai: 0 uplift / 1 hurt / 17 neutral`
- 其他域全部 `neutral`

## 7. Overlay 画像

experiment 中被刷高的 top global skills 主要是：

1. `frontend/website-homepage-design-pro`
2. `ai/humanizer-zh-pro`
3. `frontend/settings-page-pro`
4. `frontend/pricing-page-pro`
5. `frontend/search-results-page-pro`
6. `design/ppt-maker`
7. `frontend/responsive-navigation-pro`
8. `frontend/component-library-pro`
9. `frontend/docs-site-pro`
10. `frontend/auth-login-page-pro`

这也解释了 experiment 的行为边界：

- 它已经可以对“恰好命中 overlay profile 的同类 query”产生 uplift
- 但 overlay 仍偏向少数前端/AI skill，对全量 benchmark 还不够平衡

## 8. 结论

### 8.1 已完成

- Rerank V2 已落地
- V1 的结构性惩罚已消除
- canonical/live 与 experiment 已隔离
- `project` 维度已打通到 aggregate / retrieval features / graph / TeamCC adapter
- live benchmark 已通过“全量不回退”验收

### 8.2 当前不能 promote experiment

原因：

- experiment 整体仍略低于 `bm25_vector`
- uplift 只有 `2` 个 case，hurt 有 `4` 个 case
- benchmark 对 `project` scope 仍然没有真实覆盖
- overlay 仍然集中在少数 seeded skill

### 8.3 当前推荐口径

- **默认上线口径：`live`**
- **实验验证口径：`experiment`**
- **不要把 `experiment` promote 成 canonical snapshot**

## 9. 下一步

优先顺序建议：

1. 补 benchmark 的 `projectId` 画像，而不是继续刷更多 seed。
2. 把 overlay 从“skill-specific seed project”改成“domain/scene shared project profiles”，减少对少数 skill 的偏置。
3. 扩充真实 runtime feedback 覆盖，让 live 至少形成 `scene` 级别信号，而不是只有 1 条 global/version。
4. 等 live 自身出现稳定 graph coverage 后，再做 TeamCC 真实沙盒联调盲测。
