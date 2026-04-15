# Skill 评测体系与效果展示

## 1. 这套评测体系在证明什么

`skill-graph` 的目标不是只做“能不能把某个 skill 召回出来”，而是证明两件事：

1. 用户给出自然语言任务时，系统能否稳定找到正确 skill。
2. 当两个 skill 功能接近时，系统能否根据历史反馈，把效果更好的 skill 排到更前面。

因此我们把评测拆成了两层：

- **通用检索评测**
  看 `bm25 / bm25_vector / bm25_vector_graph` 的总体召回与排序稳定性。
- **图谱偏好专项评测**
  专门看“有正反馈的 skill，能不能在同场景下赢过相邻候选”。

## 2. 评测闭环怎么工作的

整个闭环是：

```text
Skill 文档
  -> aliases / registry / embeddings
  -> retrieveSkills()
  -> SkillFactEvent
  -> PG facts / aggregates
  -> retrieval features
  -> bm25_vector_graph rerank
  -> 新一轮评测验证
```

在开发阶段，我们当前默认使用：

- **数据集**：`benchmark` + `graph-preference`
- **图谱特征**：`experiment`

原因很简单：

- 线上真实反馈还不够多
- 如果只看 `canonical/live`，很多 case 上 graph 根本没有足够信号
- 为了验证“设计体系是否有效”，当前开发默认应看 `experiment`

## 3. 我们怎么评测

### 3.1 数据集

当前最重要的两套 retrieval 数据集：

| 数据集 | 数量 | 用途 |
| --- | ---: | --- |
| `benchmark` | 300 | 检查总体检索质量，比较 `bm25 / bm25_vector / bm25_vector_graph` |
| `graph-preference` | 500 | 检查图谱能否把反馈更好的 skill 排在相邻候选前面 |

其中：

- `benchmark` 更像“通用考试”
- `graph-preference` 更像“偏好与反馈是否生效”的专项考试

### 3.2 三种检索模式

| 模式 | 含义 |
| --- | --- |
| `bm25` | 只看 lexical / BM25 |
| `bm25_vector` | 在 `bm25` 基础上加入 embedding 召回 |
| `bm25_vector_graph` | 在 `bm25_vector` 基础上再叠加图谱反馈特征 |

### 3.3 当前默认口径

开发阶段默认看：

- `bm25`
- `bm25_vector`
- `bm25_vector_graph + experiment features`

也就是：

```text
同一批 case
× 三种检索模式
× experiment 图谱特征
```

当前项目里的默认命令也已经按这个口径收口：

```bash
bun run eval:skills
bun run skills:eval:offline
bun run skills:eval:graph-preference
```

如果只想看正式对照快照，再显式跑：

```bash
bun run skills:eval:offline:canonical
bun run skills:eval:graph-preference:canonical
```

## 4. 我们是怎样把正确检索率提上来的

这次不是靠“拍脑袋调权重”，而是按一轮一轮评测驱动做出来的。

### 4.1 第一阶段：先把通用检索跑起来

我们先建立了 `300` 条 user-like benchmark，覆盖：

- frontend
- backend
- security
- tools
- design
- general
- ai
- review

先用它回答最基本的问题：

- `bm25` 能不能召回
- `bm25_vector` 是否比 `bm25` 更稳

这一阶段的结论是：

- 向量召回比纯 lexical 更强
- 检索主链路已经可用

### 4.2 第二阶段：做错误驱动治理

从 benchmark 的失败 case 出发，我们逐步治理了这些问题：

- alias 过宽，导致无关 skill 大面积抢分
- frontend 页面类 skill 被通用 landing/homepage skill 抢占
- security 内部 threat model 过度垄断
- basic / pro 边界不清晰
- intent / discriminator 不足，导致“页面类型”“安全子类”“运营场景”表达不够可区分

这一步的作用是：

- 先把 recall 本身修到“不会明显乱召回”
- 让图谱加权建立在一个更健康的候选集上

### 4.3 第三阶段：建立反馈闭环

然后我们把反馈链路打通成：

```text
skill_fact_events
  -> skill_feedback_aggregates
  -> retrieval features
  -> graph rerank
```

这意味着：

- Skill 的被选中、执行结果、用户反馈，不再只是日志
- 它们会真正进入图谱特征
- 后续检索时，图谱可以把“历史表现更好”的 skill 往前推

### 4.4 第四阶段：做图谱偏好专项集

为了真正验证“图谱是否有效”，我们新建了 `500` 条 `graph-preference` 专项集。

这套题不是测“能不能召回”，而是测：

- 同类 skill 竞争时
- 图谱是否会让“反馈更好”的那个排在前面

例如：

- `component-library-basic` vs `component-library-pro`
- `docs-site-basic` vs `docs-site-pro`
- `settings-page-basic` vs `settings-page-pro`
- `website-homepage-design` vs `website-homepage-design-pro`

### 4.5 第五阶段：用 experiment 图谱特征验证收益

由于当前还没有足够多的真实线上反馈，我们在开发阶段默认使用 `experiment` 图谱特征：

- 真实 feedback 闭环结构不变
- 但允许加入开发期 seed/overlay
- 用来验证“如果反馈信号足够，图谱能否真的提升排序”

这是当前最重要的验证口径。

## 5. 本次最有说服力的结果

### 5.1 500 条图谱偏好专项集

在 `graph-preference + experiment` 下，整体结果是：

| mode | Recall@1 | Recall@3 | MRR |
| --- | ---: | ---: | ---: |
| `bm25` | 0.706 | 0.950 | 0.826333 |
| `bm25_vector` | 0.712 | 0.958 | 0.831833 |
| `bm25_vector_graph` | **0.852** | **0.960** | **0.902767** |

最关键的提升是：

- `Recall@1`: `0.712 -> 0.852`
- `MRR`: `0.831833 -> 0.902767`

这说明：

- 不是只把目标 skill 放进 Top3
- 而是真的把更多正确 skill 推到了 `Top1`

### 5.2 前端场景提升最明显

在 `frontend` 域，图谱偏好效果最强：

| domain | vector R@1 | graph R@1 |
| --- | ---: | ---: |
| `frontend` | 0.520000 | **0.855000** |
| `general` | 0.631579 | **0.789474** |

而且：

- Top1 被 graph 改写的 case：`70`
- `improveCount = 70`
- `hurtCount = 0`

这意味着本轮 graph 改写是**纯正向收益**，没有新增回退。

### 5.3 被成功扶起来的 skill

最典型被图谱扶起来的 skill 包括：

1. `frontend/component-library-pro`
2. `frontend/docs-site-pro`
3. `frontend/design-system-builder-pro`
4. `frontend/developer-portal-pro`
5. `frontend/auth-login-page-pro`
6. `frontend/search-results-page-pro`
7. `frontend/settings-page-pro`
8. `frontend/pricing-page-pro`
9. `general/development-plan-doc-pro`

这证明了一件非常关键的事：

> 我们这套 skill 设计体系，不只是“做出一堆 skill 文档”，而是能利用反馈把更优 skill 逐步学出来，并在检索时真正体现出来。

## 6. 一个非常直观的对照

如果只看 `canonical/live`，同样的 500 条专项集，结果是：

| mode | Recall@1 |
| --- | ---: |
| `bm25_vector` | 0.712 |
| `bm25_vector_graph` | 0.712 |

也就是：

- graph 路径已经跑通了
- 但默认正式图谱里，真实反馈还太少
- 所以它暂时没有足够信号去加分

这反过来说明：

- `experiment` 的提升不是巧合
- 而是因为一旦给图谱足够的 `project / scene / department / preference` 信号，它确实能把正确 skill 稳定抬起来

## 7. 这套体系成功的地方到底是什么

可以把这次成功总结成四点：

### 7.1 不是只做召回，而是做“可学习的 skill 选择”

传统做法通常只看：

- keyword match
- embedding similarity

而我们这里多了一层：

- Skill 的真实使用反馈
- 任务场景上下文
- project / scene / department 画像
- preference-style graph rerank

### 7.2 不是只做模型 prompt，而是做结构化资产

这套体系的核心资产是：

- `skills-flat/` 中的 skill 文档与 frontmatter
- registry / embeddings
- skill fact events
- feedback aggregates
- retrieval features
- benchmark / graph-preference 数据集

因此它不是一次性 prompt 技巧，而是能长期积累的工程资产。

### 7.3 不是靠主观感觉，而是用数据驱动

每一轮治理都能落到评测上：

- 哪个 domain 在掉分
- 哪个 skill 在抢占
- 哪些 case 被 graph 扶起来
- 哪些 case 还被 `intent_mismatch` / `recall_gap_exceeded` 挡住

所以我们不是“觉得变好了”，而是能用数字说明：

- 提高了多少
- 提高在哪些场景
- 还有哪些问题没解决

### 7.4 已经具备向 TeamCC 联调扩展的基础

当前 `skill-graph` 已经具备：

- 统一 retrieval 资产
- 统一评测体系
- 统一事实事件与反馈闭环
- Langfuse 观测
- Neo4j 图谱资产

这意味着下一步不仅可以离线评测，还可以进一步走向：

- TeamCC 沙盒盲测
- 真正的项目内任务执行评估

## 8. 当前仍然诚实存在的不足

这份展示文档也必须把边界说清楚。

当前还没完全解决的点：

1. `canonical/live` 反馈仍然偏稀疏  
   也就是正式默认图谱还不够强。

2. `ppt-maker` 仍然是典型失败簇  
   它经常被 `ppt-course-presentation` 抢走。

3. 仍有一部分 query 更依赖 recall intent 边界，而不是单纯靠 graph 就能修好  
   例如 homepage 某些扩展表达、运营 PPT 邻近表达。

这也意味着：

- 当前最强结论成立在 `experiment` 开发口径下
- 它证明“体系有效”
- 但还不等于“线上默认正式图谱已经完全成熟”

## 9. 适合对外展示的一句话版本

如果需要向别人快速解释这套体系，可以直接用这句话：

> 我们不是只做了一个技能库，而是做了一套可评测、可反馈、可持续优化的 Skill 检索系统。  
> 在 500 条图谱偏好专项集上，`bm25_vector_graph` 在 experiment 口径下把 `Recall@1` 从 `0.712` 提升到了 `0.852`，并且带来了 `70` 个 Top1 正向改写、`0` 个新增回退，证明这套 Skill 设计体系能够利用历史反馈把更优 skill 稳定排到更前面。

## 10. 相关文档

- [20260415-graph-preference-v3-500cases-rerun-after-cli-fix-summary.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/evals/skills/reports/20260415-graph-preference-v3-500cases-rerun-after-cli-fix-summary.md)
- [20260415-skill-eval-data-reading-guide.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/reference/20260415-skill-eval-data-reading-guide.md)
- [20260412-langfuse-local-docker.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/docs/reference/20260412-langfuse-local-docker.md)
- [evals/skills/README.md](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/evals/skills/README.md)
