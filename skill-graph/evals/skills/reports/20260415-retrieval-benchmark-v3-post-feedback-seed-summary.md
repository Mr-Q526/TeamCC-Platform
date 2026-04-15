# 2026-04-15 Skill Retrieval Benchmark V3 总结

## 1. 本次执行

- Benchmark 审计：
  - `caseCount = 300`
  - `issueCount = 0`
  - `quotaIssueCount = 0`
- 正式 run：
  - `runId = offline-retrieval-2026-04-14T16-01-11-185Z-6f9d00c1`
  - run 目录：
    - `/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/evals/skills/runs/offline-retrieval-2026-04-14T16-01-11-185Z-6f9d00c1`
- 对比基线：
  - `runId = offline-retrieval-2026-04-14T15-25-02-358Z-dc5a85c6`

本轮 benchmark 的唯一变量是：在 `skill-graph` 中注入了一批偏向 `pro` 的反馈事实，并刷新了：

- `skill_fact_events`
- `skill_feedback_aggregates`
- `Neo4j`
- `skill-retrieval-features.json`

因此，这轮结果可以直接回答一个问题：

> 图谱反馈接入后，`bm25_vector_graph` 是否真的比 `bm25_vector` 更好？

答案是：**已经开始显著影响排序，但当前是负向影响，不可直接上线。**

## 2. 总体指标

| mode | Recall@1 | Recall@3 | Recall@5 | MRR | NDCG@5 | Top3 Acceptable Hit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `bm25` | 0.63 | 0.91 | 0.95 | 0.765500 | 0.747690 | 0.940000 |
| `bm25_vector` | 0.67 | 0.913333 | 0.963333 | 0.792389 | 0.763922 | 0.943333 |
| `bm25_vector_graph` | 0.59 | 0.886667 | 0.963333 | 0.737278 | 0.733950 | 0.923333 |

与上一轮正式 run 相比：

- `bm25`：完全不变
- `bm25_vector`：完全不变
- `bm25_vector_graph`：
  - `Recall@1: 0.67 -> 0.59`
  - `Recall@3: 0.913333 -> 0.886667`
  - `MRR: 0.792389 -> 0.737278`
  - `NDCG@5: 0.763922 -> 0.733950`
  - `Top3 Acceptable Hit: 0.943333 -> 0.923333`

结论：

- 图谱路径不再是“接上但没有效果”。
- 图谱路径现在**有明显效果**，但效果方向是错误的。

## 3. 影响范围

`bm25_vector_graph` 相对 `bm25_vector`：

- Top1 改变：`41 / 300`
- Must-hit 受损：`29`
- Must-hit 改善：`5`
- Acceptable 受损：`24`
- Acceptable 改善：`6`

说明：

- 当前 graph rerank 已经开始主导一部分 query 的最终排序。
- 但它把更多原本正确的 Top1 压掉了，而不是帮助修正错误。

## 4. 分域结果

### 4.1 受损最明显的域

| domain | `bm25_vector` Recall@1 | `bm25_vector_graph` Recall@1 | 变化 |
| --- | ---: | ---: | ---: |
| `frontend` | 0.644444 | 0.444444 | -0.200000 |
| `backend` | 0.666667 | 0.619048 | -0.047619 |
| `design` | 0.666667 | 0.611111 | -0.055556 |
| `general` | 0.791667 | 0.708333 | -0.083334 |

`frontend` 是最大受损域，且受损不是偶发抖动，而是系统性偏移。

### 4.2 有改善的域

| domain | `bm25_vector` Recall@3 | `bm25_vector_graph` Recall@3 | 变化 |
| --- | ---: | ---: | ---: |
| `ai` | 0.888889 | 1.000000 | +0.111111 |

`ai` 域是本轮唯一明确受益的区域，主要收益来自：

- `humanizer-zh-pro`
- `humanizer-zh-basic`

这与本轮反馈注入完全一致，说明图谱反馈链路已经真的起效。

## 5. 典型受益 Skill

Top1 改变时，最常见的“赢家”如下：

| skill | 获胜次数 |
| --- | ---: |
| `frontend/website-homepage-design-pro` | 22 |
| `ai/humanizer-zh-pro` | 5 |
| `general/development-plan-doc-pro` | 4 |
| `frontend/component-library-pro` | 3 |
| `frontend/component-library-basic` | 2 |
| `frontend/docs-site-pro` | 2 |
| `design/ppt-maker` | 1 |

这里已经能看出问题：

- 胜出 skill 高度集中。
- 受益 skill 基本就是本轮被人工“刷高”的那些。
- 这些反馈没有被足够严格地限制在更细粒度的 query / scene / task 类型里。

## 6. 典型受损 Case

### 6.1 Frontend 被 `website-homepage-design-pro` 抢占

例子：

- `设计公司介绍页面（专业版）`
  - vector Top1：`frontend/about-company-page-pro`
  - graph Top1：`frontend/website-homepage-design-pro`
- `设计管理控制台的界面`
  - vector Top1：`frontend/admin-dashboard-design`
  - graph Top1：`frontend/website-homepage-design-pro`
- `设计简洁高效的支付流程`
  - vector Top1：`frontend/checkout-flow-basic`
  - graph Top1：`frontend/website-homepage-design-pro`

这说明：

- `website-homepage-design-pro` 的 feedback scope 过粗。
- 当前 graph 信号把“首页设计偏好”错误泛化成了“整个 frontend/design 场景的通用偏好”。

### 6.2 组件库偏好污染到 backend

例子：

- `后端 架构设计`
  - vector Top1：`backend/backend-api-architecture`
  - graph Top1：`frontend/component-library-pro`

这不是 recall 问题，而是 rerank 问题。  
`frontend/component-library-pro` 拿到非零 graph score 后，把没有图谱信号的真正 backend skill 压掉了。

### 6.3 `ppt-maker` 抬升有效，但已经开始泛化

例子：

- `制作社团招新PPT`
  - vector Top1：`design/ppt-club-recruiting`
  - graph Top1：`design/ppt-maker`

这说明 `ppt-maker` 的正反馈生效了，但当前它的 graph 偏好还没有足够区分“通用做 PPT”和“特定 PPT 模板任务”。

## 7. 典型改善 Case

### 7.1 Humanizer 正向修正

例子：

- `优化中文文章使其更自然`
  - vector Top1：`design/jimeng`
  - graph Top1：`ai/humanizer-zh-pro`

这是正确方向的 uplift，说明：

- `skill_fact_events -> aggregates -> retrieval-features -> rerank`
- 这条闭环现在已经能真正改变结果。

### 7.2 Development plan doc 正向修正

例子：

- `编写详细开发计划文档`
  - vector Top1：`infra/vercel-deploy`
  - graph Top1：`general/development-plan-doc-pro`

这个修正方向也是正确的，说明 graph feedback 不是完全失控，而是当前“正反馈 seed 过少、过偏、过集中”。

## 8. 根因诊断

根因不是“图谱没生效”，而是“图谱太生效了，但约束不够”。

### 8.1 当前 rerank 公式会惩罚没有 graph 信号的候选

当前公式：

```text
finalScore = graphFeatures ? 0.70 * recallNormalized + 0.30 * graphFeatureScore : recallNormalized
```

这意味着：

- 有 graphFeatures 的候选，哪怕只是中等 graph 分，也会得到固定的 `0.30` 加权加成。
- 没有 graphFeatures 的候选，即使 lexical/vector 是 Top1，也只能保留原 recall 的 `70%`。

因此，当少数 skill 被人工刷高后，它们会系统性压过大量“无 graph 信号但 recall 正确”的 skill。

### 8.2 当前 feedback seed 的覆盖面太窄

本轮被重点刷高的 skill 只有少数几组：

- `website-homepage-design-pro`
- `humanizer-zh-pro`
- `component-library-pro`
- `development-plan-doc-pro`
- `ppt-maker`
- 以及少数配套 basic/pro skill

结果就是：

- 图谱信号不是“全局统计先验”
- 而更像“少量人工偏好标签”

这会导致局部偏好被跨 query 泛化。

### 8.3 scope 仍然过粗

即使已经有：

- `global`
- `department`
- `scene`
- `version`

但对 frontend 来说，`scene=design` 仍然太粗。  
它无法区分：

- homepage
- about page
- careers page
- checkout
- dashboard
- docs site

所以 `website-homepage-design-pro` 在 `frontend + design` 这一粗 scope 下被过度加权。

## 9. 本轮结论

本轮 benchmark 的价值很高，结论已经很清楚：

1. 图谱反馈闭环已经真正打通了。
2. `bm25_vector_graph` 不再等同于 `bm25_vector`。
3. 当前 graph 信号已经足够强到能系统性改变 Top1。
4. 但在只对少数 skill 注入偏置反馈的前提下，graph rerank 会明显拉坏整体 benchmark。

所以，本轮结果不能作为“graph uplift 成功”，而应视为：

> **反馈闭环验证成功，graph 权重治理失败。**

## 10. 下一步建议

优先级建议如下：

1. 调整 rerank 公式  
   不要让“有 graphFeatures 的候选”天然获得结构性优势。至少要避免把无 graph 信号的正确候选统一压到 `0.70 * recall`。

2. 扩大反馈覆盖  
   不能只给少数 `pro` skill 灌分。要补更多 skill，尤其是同一 domain 下的对照组和竞争组。

3. 收细 scope  
   Frontend 至少要细化到 page-type 级别，否则 `scene=design` 会一直污染排序。

4. 做受控 uplift 实验  
   下一轮不要直接全量 benchmark 验收。应该先挑一个受控 domain，例如：
   - `ai/humanizer`
   - `general/development-plan-doc`
   - `design/ppt`
   单独评估 graph 是否只改善目标 skill，而不伤及相邻 skill。

5. 再决定是否开启全量 graph rerank  
   当前状态下，不建议把这套 graph rerank 作为默认线上排序逻辑。
