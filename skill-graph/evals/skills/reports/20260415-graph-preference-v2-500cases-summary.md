# 图谱偏好专项评测集 500 条版总结

## 1. 本轮做了什么

本轮把 `graph-preference` 专项集从 `308` 条扩到 `500` 条，并重新跑了一轮正式离线检索评测。

本轮目标不是刷新通用 benchmark，而是继续扩大“正反馈更强的 skill 是否能在同场景赢过竞争 skill”的专项覆盖面，尤其补足：

- 前端页面设计偏好
- 后端开发与 debug / review / security 审查
- 运营内容生产与素材整理

同时，本轮补了一份数据阅读说明，避免再把“graph 没改 Top1”和“graph 没参与”混为一谈：

- [20260415-skill-eval-data-reading-guide.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/reference/20260415-skill-eval-data-reading-guide.md)

## 2. 数据集状态

生成脚本：

- `bun run skills:eval:generate-graph-preference-cases`

审计脚本：

- `bun run skills:eval:audit-graph-preference-cases`

审计结果：

- `caseCount = 500`
- `issueCount = 0`
- `quotaIssueCount = 0`

本轮 500 条 case 分布：

| domain | caseCount |
| --- | ---: |
| `frontend` | `200` |
| `backend` | `60` |
| `security` | `60` |
| `design` | `60` |
| `tools` | `54` |
| `review` | `27` |
| `ai` | `20` |
| `general` | `19` |

## 3. 正式 run

run id:

- `offline-retrieval-2026-04-15T02-32-44-027Z-75dd591f`

run 目录：

- [offline-retrieval-2026-04-15T02-32-44-027Z-75dd591f](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/evals/skills/runs/offline-retrieval-2026-04-15T02-32-44-027Z-75dd591f)

## 4. 总体结果

| mode | Recall@1 | Recall@3 | Recall@5 | MRR | Top3 Acceptable Hit | degradedRate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `bm25` | `0.706000` | `0.950000` | `0.976000` | `0.826333` | `0.968000` | `0` |
| `bm25_vector` | `0.712000` | `0.958000` | `0.978000` | `0.831833` | `0.972000` | `0` |
| `bm25_vector_graph` | `0.712000` | `0.958000` | `0.978000` | `0.831833` | `0.972000` | `1` |

最关键的解释：

- `bm25_vector` 相比 `bm25` 有小幅稳定提升。
- `bm25_vector_graph` 这轮 **不是“效果等于 vector”**，而是 **`500 / 500` 都退化成了 `bm25_vector`**。
- 实际 mode 映射是：
  - `bm25 -> bm25`：`500`
  - `bm25_vector -> bm25_vector`：`500`
  - `bm25_vector_graph -> bm25_vector`：`500`

所以这轮 500 条结果只能回答两件事：

1. 扩容后的专项集是稳定可跑的。
2. `bm25_vector` 在这套 500 条上略优于 `bm25`。

这轮 **不能** 用来回答“graph uplift 是否成立”，因为 graph 路径根本没有真正参与。

## 5. 按 domain 看结果

| domain | caseCount | bm25 R@1 | vector R@1 | graph R@1 | 说明 |
| --- | ---: | ---: | ---: | ---: | --- |
| `frontend` | `200` | `0.510000` | `0.520000` | `0.520000` | 这轮 graph 退化到 vector，不能解释为真正图谱 uplift |
| `backend` | `60` | `1.000000` | `1.000000` | `1.000000` | backend 专项已接近满分，向量和图谱都没有额外空间 |
| `security` | `60` | `0.983333` | `0.983333` | `0.983333` | 安全专项非常稳，但 graph 本轮未真正参与 |
| `review` | `27` | `0.740741` | `0.740741` | `0.740741` | 风险评审表达稳定，图谱本轮未参与 |
| `tools` | `54` | `0.777778` | `0.796296` | `0.796296` | vector 有提升，graph 本轮退化 |
| `design` | `60` | `0.666667` | `0.666667` | `0.666667` | design 仍然主要受 recall / intent 边界支配 |
| `ai` | `20` | `0.850000` | `0.900000` | `0.900000` | 去 AI 味场景继续受益于向量 |
| `general` | `19` | `0.684211` | `0.631579` | `0.631579` | general 在这轮 500 条上反而回退，需要单独看 case 质量 |

## 6. Homepage 子集结果

这轮首页偏好子集共 `20` 条。

命中结果：

- `bm25`: `19 / 20`
- `bm25_vector`: `19 / 20`
- `bm25_vector_graph`: `19 / 20`

唯一仍未命中的 case：

- `retrieval_graph_preference_frontend_homepage_preference_007`
  - vector Top1: `frontend/website-homepage-design`
  - graph Top1: `frontend/website-homepage-design`
  - second: `frontend/website-homepage-design-pro`

这说明：

- 本轮 homepage 邻近表达治理是有效的，`20` 条里已经有 `19` 条能把 `pro` 顶到 Top1。
- 剩下的主要问题不是 case 不够，而是中性 `website-homepage-design` 在某些扩展表达里仍有一条 residual 抢占。

## 7. 当前最重要的问题

本轮最大的 blocker 不是 case 数量，而是：

**`bm25_vector_graph` 没真正跑 graph。**

直接证据：

- `bm25_vector_graph.degradedRate = 1`
- `graphAppliedRate = 0`
- `preferenceBonusAppliedRate = 0`
- 实际 mode 为 `bm25_vector_graph -> bm25_vector`，共 `500 / 500`

所以如果现在继续只扩大 case 数量，结论仍然会被这个问题卡住。

## 8. 结论

本轮已经完成：

- `graph-preference` 专项集扩到 `500` 条
- 审计通过，`issueCount = 0`
- 正式 run 跑通，向量模式未降级
- homepage 子集扩大后仍保持 `19 / 20` Top1 命中

但本轮尚未完成的关键目标是：

- **真正评测 graph rerank**

当前最合理的下一步不是继续盲目扩 case，而是先修：

1. 为什么 `retrieveSkills()` 在 `bm25_vector_graph` 请求下仍然统一回落成 `bm25_vector`
2. 为什么 `readSkillRetrievalFeatures()` / graph apply 路径在专项评测里没有真正生效
3. 修完后基于这 `500` 条专项集再跑一次正式图谱 uplift 验收
