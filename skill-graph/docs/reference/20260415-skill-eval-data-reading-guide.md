# Skill 评测数据阅读说明

## 1. 先看什么

读 `skill-graph` 的评测报告时，建议固定按这个顺序看：

1. `caseCount / issueCount / quotaIssueCount`
2. 三种模式总体指标：
   - `bm25`
   - `bm25_vector`
   - `bm25_vector_graph`
3. `Top1` 变化统计：
   - 改善多少
   - 回退多少
   - 不变多少
4. `graphAppliedRate / preferenceBonusAppliedRate`
5. 失败 case 的 `blockedReason`

不要只看一行 `Recall@1` 就下结论。

## 2. 三种模式分别代表什么

- `bm25`
  只看 lexical / BM25 召回，不使用向量，不使用图谱。
- `bm25_vector`
  在 `bm25` 基础上加入向量召回。
- `bm25_vector_graph`
  在 `bm25_vector` 基础上再走 graph rerank。

因此：

- `bm25 -> vector` 的差值，主要回答“向量是否有帮助”。
- `vector -> graph` 的差值，主要回答“图谱加权是否真的把目标 skill 往前推了”。

## 3. 为什么有时三个指标会一样

同一 domain 出现：

```text
bm25 R@1 = vector R@1 = graph R@1
```

不等于“graph 没跑”。

最常见是三种情况：

1. `bm25` 已经把 Top1 做对了，后两层只是加固，没有换人。
2. `vector` 已经把 Top1 做对了，`graph` 给同一个 Top1 加了 bonus，但没有改变 Top1。
3. `graph` 被 gate 挡住了，没有实际 bonus。

所以要结合下面这些字段一起看：

- `top1Changed`
- `graphAppliedRate`
- `preferenceBonusAppliedRate`
- `blockedReason`

## 4. “graph 生效”和“graph 改指标”不是一回事

举例：

- 某个 security case 里，`vector` 已经把正确 skill 放在 `#1`
- `graph` 又给这个 skill 加了 `+0.11`
- 但它仍然还是 `#1`

这时：

- `graph` 是生效的
- 但 `Recall@1` 不会变化

因此：

- `graphBonus > 0` 说明 graph 真的参与了排序
- `Top1 changed` 说明 graph 真的改写了最终赢家

两者不能混为一谈。

## 5. 重点字段怎么解释

### `graphAppliedRate`

表示有多少 case 的 graph 路径被真正应用，而不是直接退化成 `vector`。

### `preferenceBonusAppliedRate`

表示有多少 case 真正吃到了“偏好分”。

这个值更适合判断：

- 正反馈更强的 skill
- 是否真的因为图谱偏好被抬起来

### `wrongIntentHijackRate`

表示图谱加权后，被错误意图候选抢走 Top1 的比例。

这个值越低越好。

### `blockedReason`

常见值：

- `no_context_match`
  没有命中 `project / scene / department` 图谱上下文。
- `intent_mismatch`
  query 带了某个 intent，但 candidate 没对齐。
- `intent_discriminator_mismatch`
  query 带了更强的 page-type / subtype discriminator，但 candidate 不匹配。
- `recall_gap_exceeded:*`
  recall 差距太大，graph 不允许硬抬。

## 6. domain 表格应该怎么读

例如：

```text
backend  36  1.000000  1.000000  1.000000
```

优先解释为：

- 这组 case 已经满分
- graph 没有提升空间
- 不代表 graph 没有参与

又例如：

```text
security  36  0.972222  0.972222  0.972222
```

更可能代表：

- graph 在给正确 Top1 加分
- 但没有把新的 skill 推上 `#1`

只有像下面这样：

```text
frontend  120  0.416667  0.416667  0.800000
```

才说明：

- graph 真的改写了大量 Top1
- 这是明确的 uplift

## 7. 当前报告的推荐口径

当前看 `skill-graph` 报告时，建议同时保留两层口径：

- `benchmark`
  用来看总体检索是否稳定、有无回退。
- `graph-preference`
  用来看“被正反馈更强的 skill 是否在同场景下更容易赢过竞争对手”。

不要只拿 `benchmark` 去判断图谱偏好，也不要只拿 `graph-preference` 去判断通用召回。
