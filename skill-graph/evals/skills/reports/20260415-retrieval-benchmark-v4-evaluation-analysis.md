# Skill 检索与图谱加权本轮测评总结

## 1. 结论摘要

本轮测评的核心结论是：

- 检索主链路已经稳定，`bm25_vector` 明显优于 `bm25`
- Graph Rerank V2 已经修掉了上一轮“结构性伤害排序”的问题
- 但图谱加权还没有形成稳定正收益，当前状态更接近“安全可控，但信号不足”

当前最准确的判断是：

- **检索能力：可用**
- **图谱加权：已安全，但暂未有效**
- **默认上线口径：`live`**
- **实验验证口径：`experiment`，当前不建议提升为 canonical**

## 2. 本轮测评范围

本轮基于 300 条 retrieval benchmark，重点验证：

- `bm25`
- `bm25_vector`
- `bm25_vector_graph`

同时对比两种图谱特征来源：

- `live`
  仅使用 PG 中真实 runtime facts 生成的 retrieval features
- `experiment`
  使用 `live + seed overlay` 生成的实验图谱特征

相关原始报告：

- [20260415-retrieval-benchmark-v4-rerank-redesign-summary.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/evals/skills/reports/20260415-retrieval-benchmark-v4-rerank-redesign-summary.md)

## 3. 关键结果

### 3.1 Live 结果

| mode | Recall@1 | Recall@3 | Recall@5 | MRR |
| --- | ---: | ---: | ---: | ---: |
| `bm25` | 0.63 | 0.91 | 0.95 | 0.765500 |
| `bm25_vector` | 0.67 | 0.913333 | 0.963333 | 0.792389 |
| `bm25_vector_graph` | 0.67 | 0.913333 | 0.963333 | 0.792389 |

结论：

- `bm25_vector` 相比 `bm25` 有稳定提升
- `bm25_vector_graph` 与 `bm25_vector` 完全持平
- 说明 graph 排序逻辑已经不再伤害结果
- 但也说明 live 图谱当前几乎没有产生实际 uplift

重点域结果：

| domain | Recall@1 | Recall@3 |
| --- | ---: | ---: |
| `frontend` | 0.644444 | 0.888889 |
| `backend` | 0.666667 | 0.904762 |
| `general` | 0.791667 | 1.000000 |

### 3.2 Experiment 结果

| mode | Recall@1 | Recall@3 | Recall@5 | MRR |
| --- | ---: | ---: | ---: | ---: |
| `bm25_vector` | 0.67 | 0.913333 | 0.963333 | 0.792389 |
| `bm25_vector_graph (experiment)` | 0.666667 | 0.913333 | 0.963333 | 0.790722 |

结论：

- experiment 下 graph 已经开始影响排序
- 但整体仍略低于 `bm25_vector`
- 当前 experiment 仍不能作为正式默认口径

### 3.3 Graph Uplift 结果

| 指标 | 数值 |
| --- | ---: |
| upliftCount | 2 |
| neutralCount | 294 |
| hurtCount | 4 |

这说明：

- graph 已经不是“完全无效”
- 但正向收益非常少
- 当前更像“少量可见变化”，而不是“稳定可推广增益”

## 4. 本轮已经解决了什么

### 4.1 已解决 V1 的结构性缺陷

上一轮的主要问题是：

- 只要启用 graph，所有候选都会被改写成固定混合分
- 没 graph signal 的正确候选也会被统一压低

本轮 V2 已修正为：

- `finalScore = recallNormalized + graphBonus`
- graph 只加分，不减分
- 无 context match 时直接不给 bonus

结果就是：

- `live` 下 `bm25_vector_graph` 不再回退
- 重点域 `frontend / backend / general` 全部达成“不低于 vector baseline”

### 4.2 已完成 live / experiment 隔离

当前口径已经清晰：

- `live` 只看真实 runtime facts
- `experiment` 才允许叠加 seed overlay
- `canonical` 默认等于 `live`

这一步很重要，因为它避免了“实验 seed 直接污染正式图谱”。

## 5. 当前不足与原因分析

### 5.1 最大问题不是公式，而是 live 图谱数据太稀薄

当前 `live` feature 覆盖：

- `global = 1`
- `version = 1`
- `project = 0`
- `department = 0`
- `scene = 0`

这意味着：

- 真实图谱几乎没有可命中的上下文先验
- graph gate 大部分时候都会判定为 `no_context_match`
- 所以 `bm25_vector_graph` 在 live 下只能退化为 `bm25_vector`

这不是 rerank 代码错了，而是**真实反馈覆盖根本不够支撑图谱排序**。

### 5.2 当前 300 条 benchmark 更适合测“检索”，不够适合测“图谱加权”

这套 benchmark 已经足够验证：

- recall 是否正常
- bm25/vector 是否提升
- graph 是否造成回退

但它还不够适合回答：

- 正反馈更强的 skill，是否能在相关 query 里更稳定地排前

根因包括：

- 当前 case 基本没有真正可命中的 `projectId` 画像
- `department / scene` 传了，但粒度仍偏粗
- 缺少一组专门面向 graph preference 的对照题

所以当前 300 条题库适合做“非回退验收”，不适合单独作为“图谱增益验收”。

### 5.3 Seed overlay 仍然偏向少数 skill

experiment 里被显著抬高的 skill 主要集中在：

- `frontend/website-homepage-design-pro`
- `ai/humanizer-zh-pro`
- 一批 frontend `*-pro`
- `design/ppt-maker`

这会带来两个问题：

- 对少数 query 能产生 uplift
- 但难以代表真实全局偏好

所以现在 experiment 的结果是：

- 有变化
- 但变化不平衡
- 仍然存在 4 个 hurt case

### 5.4 现有 graph 分数仍然更偏“综合质量”，而不是“显式好评偏好”

当前 aggregate 的 `qualityScore` 是综合分，主要由这些项构成：

- successRate
- userSatisfaction
- verificationPassRate
- invocationRate
- selectionRate
- freshness
- failurePenalty

这使它更适合表达“整体质量”，但还不够直接表达：

- 哪个 skill 在同类候选里更受显式正反馈偏好

所以现阶段即使某个 skill 被用户明确打了更高正反馈，也不会自然形成足够强、足够精准的排序偏好信号。

### 5.5 `project` 维度已打通，但尚未真正发挥作用

本轮已经把 `projectId` 打通到了：

- retrieval request
- aggregates
- retrieval features
- Neo4j
- TeamCC provider

但 benchmark 里尚未形成真实可命中的 project profile，因此：

- 代码层面支持了
- 评测层面还没有真正用起来

这也是为什么当前 strongest scope 里 `project = 0`。

## 6. 当前状态应该如何理解

当前不是“图谱没用”，也不是“图谱错了”，而是：

- **图谱排序逻辑已经修安全了**
- **图谱数据还不够支撑稳定收益**

更直接地说：

- 现在可以放心继续做 graph 能力，不用担心它像 V1 一样大面积伤害排序
- 但还不能宣称“图谱加权已经显著提升了检索效果”

## 7. 下一步建议

优先级建议如下：

1. 扩真实 runtime feedback，让 `live` 至少形成可命中的 `scene / department / project` 聚合。
2. 新增 graph-preference benchmark，专门验证“有正反馈的 skill 是否能在同意图候选里稳定排前”。
3. 把 experiment overlay 从“刷高几个 skill”改成“同意图对照 profile”，降低少数 skill 偏置。
4. 在 retrieval features 中补一层“显式正反馈 preferenceScore”，不要只依赖综合 `qualityScore`。
5. 等 live 图谱本身出现稳定命中后，再做 TeamCC 沙盒联调盲测。

## 8. 一句话总结

本轮测评最大的成果，不是 graph 已经显著提分，而是：

- **vector 检索已经稳定可用**
- **graph rerank 已经修到不会伤害排序**
- **接下来真正的瓶颈，已经从“公式设计”转成了“真实反馈覆盖与图谱偏好建模”**
