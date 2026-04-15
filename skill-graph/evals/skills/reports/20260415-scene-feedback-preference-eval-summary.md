# 图谱偏好专项评测集 300 条版总结

## 1. 本轮完成了什么

本轮目标不是继续扩“通用召回题库”，而是把 `graph-preference` 专项集补成一套更接近真实业务表达的 300 条测试集，重点验证：

- 已经在图谱里有正反馈的 Skill，能否在同场景下被 `bm25_vector_graph` 排得更靠前。
- 运营真实表达，以及 backend / security 的 adjacent case，是否已经能被专项评测覆盖。
- 图谱加权是否会带来稳定 uplift，而不是随机抬分。

本轮已完成：

- 把 `graph-preference` 专项集从 `63` 条扩到 `300` 条。
- 补了一批运营真实表达：
  - 运营复盘 PPT
  - 老板汇报 deck
  - 讲解动画视频
  - 运营数据表整理 / 透视汇总
- 补齐 backend / security / review 的 adjacent case：
  - 慢接口热点排查 / profiling
  - 异步任务与队列链路
  - 风险导向 code review
  - 漏洞审查
  - 依赖供应链审查
- 跑通 300 条三模式评测：
  - `bm25`
  - `bm25_vector`
  - `bm25_vector_graph`
- 真实向量模式未降级：
  - `bm25_vector.degradedRate = 0`
  - `bm25_vector_graph.degradedRate = 0`

## 2. 数据集结构

专项集目录：

- [graph-preference/v1](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/evals/skills/cases/retrieval/graph-preference/v1)

本轮 300 条 case 的分布：

| 维度 | 数量 |
| --- | ---: |
| 总 case 数 | `300` |
| `frontend` | `120` |
| `backend` | `36` |
| `security` | `36` |
| `design` | `36` |
| `tools` | `32` |
| `review` | `16` |
| `ai` | `12` |
| `general` | `12` |
| `difficulty:direct` | `170` |
| `difficulty:adjacent` | `130` |
| `lang:zh-pure` | `131` |
| `lang:zh-mixed` | `169` |

审计结果：

- caseCount: `300`
- issueCount: `0`
- quotaIssueCount: `0`

审计文件：

- [retrieval-graph-preference-v1-audit-summary.json](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/evals/skills/reports/retrieval-graph-preference-v1-audit-summary.json)

## 3. 正式评测结果

本轮最新 run：

- `offline-retrieval-2026-04-15T02-01-28-568Z-17f92dbb`

run 目录：

- [offline-retrieval-2026-04-15T02-01-28-568Z-17f92dbb](/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph/skill-graph/evals/skills/runs/offline-retrieval-2026-04-15T02-01-28-568Z-17f92dbb)

总体指标：

| mode | Recall@1 | Recall@3 | Recall@5 | MRR | NDCG@3 | degradedRate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `bm25` | `0.680000` | `0.940000` | `0.970000` | `0.809389` | `0.818583` | `0` |
| `bm25_vector` | `0.686667` | `0.953333` | `0.970000` | `0.815667` | `0.830679` | `0` |
| `bm25_vector_graph` | `0.846667` | `0.950000` | `0.970000` | `0.895944` | `0.855326` | `0` |

专项 preference 指标：

| metric | value |
| --- | ---: |
| preferredSkillTop1Rate | `0.846667` |
| preferredSkillBeatsCompetitorRate | `0.653333` |
| wrongIntentHijackRate | `0.100000` |
| graphAppliedRate | `0.686667` |
| preferenceBonusAppliedRate | `0.466667` |

相对 `bm25_vector` 的 Top1 变化：

- Top1 改善 case：`48`
- Top1 回退 case：`0`
- Top1 不变 case：`252`

额外说明：

- 这轮在补定向反馈和收紧 intent 边界后，`homepage` 和 `ppt-maker` 两个失败簇都已经被部分扶起。
- 仍有少量 `adjacent` 表达没有完全解决，但已经不再是上一轮的 `0/12` 和 `0/18`。

## 4. 按 domain 看结果

| domain | caseCount | bm25 R@1 | vector R@1 | graph R@1 | 结论 |
| --- | ---: | ---: | ---: | ---: | --- |
| `frontend` | `120` | `0.416667` | `0.416667` | `0.800000` | 图谱 uplift 进一步增强 |
| `backend` | `36` | `1.000000` | `1.000000` | `1.000000` | backend adjacent 覆盖已经稳定 |
| `security` | `36` | `0.972222` | `0.972222` | `0.972222` | 安全专项非常稳，但 graph 没再往上推 |
| `review` | `16` | `0.812500` | `0.812500` | `0.812500` | 风险评审表达已经稳定 |
| `tools` | `32` | `0.812500` | `0.843750` | `0.843750` | 表格 / 持久浏览器调试已接上，但 graph 没继续拉升 |
| `design` | `36` | `0.694444` | `0.694444` | `0.694444` | design 整体明显改善，主要来自 `ppt-maker` 回升 |
| `ai` | `12` | `0.916667` | `1.000000` | `1.000000` | 去 AI 味专项已经完全稳定 |
| `general` | `12` | `0.666667` | `0.666667` | `0.833333` | planning 类有实质 uplift |

## 5. 本轮最有价值的结论

### 5.1 frontend uplift 已经非常明确

这轮真正被图谱抬起来的，主要是前端一组 “pro vs basic” 场景。

典型提升：

| spec | bm25/vector Top1 | graph Top1 | 说明 |
| --- | ---: | ---: | --- |
| `frontend_component_library_preference` | `0.167` | `0.917` | `component-library-pro` 大幅压过 basic |
| `frontend_docs_preference` | `0.250` | `0.917` | `docs-site-pro` 明显被扶正 |
| `frontend_design_system_preference` | `0.417` | `1.000` | `design-system-builder-pro` 全面胜出 |
| `frontend_settings_preference` | `0.500` | `0.917` | 设置页 pro 版本明显受益 |
| `frontend_developer_portal_preference` | `0.417` | `0.833` | 门户类场景有明显 uplift |
| `frontend_login_preference` | `0.333` | `0.667` | graph 对登录页也有帮助，但还不够稳 |

这说明：

- 当前图谱偏好机制不是“看起来在工作”，而是已经能稳定把一批反馈更好的 pro skill 顶上去。
- 并且这轮 `Top1 hurt = 0`，说明 graph uplift 不是靠牺牲别的 case 硬刷出来的。

### 5.2 backend / security 的 adjacent case 已经补到可验收状态

本轮新增的 backend / security / review 邻近表达没有把系统搞乱，反而说明这些场景已经可以进正式专项评测。

当前表现：

- `backend_background_jobs_preference`: `18/18` Top1 命中
- `backend_performance_preference`: `18/18` Top1 命中
- `security_dependency_audit_preference`: `18/18` Top1 命中
- `security_vulnerability_review_preference`: `17/18` Top1 命中
- `review_risk_code_review_preference`: `13/16` Top1 命中

这说明当前数据集已经不再只是“前端 demo 集”，而是可以正式覆盖：

- 后端开发
- 安全审查
- fix / debug / review

### 5.3 homepage 和 `ppt-maker` 两个失败簇已经被明显扶起

`motion-video-maker` 在运营视频类表达上已经稳定：

- `design_motion_video_preference`: `18/18` Top1 命中

上一轮两个核心失败簇是：

- `frontend_homepage_preference`: `0/12`
- `design_ppt_maker_preference`: `0/18`

这轮改完以后：

- `frontend_homepage_preference`
  - `bm25_vector`: `0.417`
  - `bm25_vector_graph`: `0.667`
- `design_ppt_maker_preference`
  - `bm25_vector`: `0.500`
  - `bm25_vector_graph`: `0.500`

含义很明确：

- `homepage` 已经从完全失败被拉到了可用状态，graph 开始真正扶 `website-homepage-design-pro`
- `ppt-maker` 则主要是 recall / intent 边界被修正后，vector 主路先恢复，再由 graph 保持不回退

## 6. 典型受益与典型失败

### 6.1 典型受益

典型“vector 选 basic，graph 改成 pro”的 case：

- `retrieval_graph_preference_frontend_component_library_preference_004`
- `retrieval_graph_preference_frontend_docs_preference_001`
- `retrieval_graph_preference_frontend_design_system_preference_002`
- `retrieval_graph_preference_frontend_developer_portal_preference_001`
- `retrieval_graph_preference_frontend_login_preference_001`

这些 case 的共性：

- query intent 已经足够聚焦
- preferred / competing skill 在同 domain、同 scene 下可比较
- recall top candidates 差距不离谱
- graph bonus 能把优质 skill 从 `#2/#3` 稳定推到 `#1`

### 6.2 典型失败

#### a. 官网首页仍未完全稳定，但已经脱离全灭状态

`frontend_homepage_preference` 当前：

- `bm25_vector`: `5/12`
- `bm25_vector_graph`: `8/12`

主要现象：

- 直达型 homepage query 已经能稳定把 `website-homepage-design-pro` 顶到 Top1
- 仍有一部分 adjacent query 会被中性 skill `website-homepage-design` 抢走
- 现在残余 blocked reason 主要是 `intent_mismatch` 与个别 `recall_gap_exceeded:0.15`

这说明：

- homepage 这组已经不是“图谱没用”
- 现在剩下的是 recall 邻近表达还不够稳

#### b. `ppt-maker` 已经从完全失败恢复到一半可用

`design_ppt_maker_preference` 当前：

- `bm25_vector`: `9/18`
- `bm25_vector_graph`: `9/18`

主要现象：

- direct / mixed 的“运营汇报 PPT / deck / 页级布局 / 汇报视觉表达”已经多数回到 `ppt-maker`
- 剩余失败主要集中在 adjacent query
- 这些 adjacent case 仍会被 `ppt-course-presentation` 抢走
- 目标 skill 常见 rank 已经从 Top5 附近回到 `#3`，说明 recall 已明显靠近，但 graph 还无法跨过 recall gap gate

这说明现在的主要剩余问题不是“完全判错 intent”，而是：

- 业务汇报 adjacent 表达还不够强
- `ppt-course-presentation` 对“演示文稿 / presentation”仍然占词过多

#### c. 个别 frontend case 仍会被错域词击穿

典型现象：

- 登录页部分 mixed case 被 `security/dependency-supply-chain-audit` 或 `frontend/ai-chat-interface-basic` 抢走
- 开发者门户个别 case 会被 `responsive-navigation-pro` 或 `onboarding-flow-basic` 抢走
- 文档门户的相邻表达会被 `responsive-navigation-pro` 抢走

这说明：

- 一部分 mixed/adjacent query 还不够稳
- 当前 recall 对“auth / portal / onboarding / navigation”这些词的边界仍偏宽

## 7. 本轮结论

这轮结果可以明确下结论：

1. 300 条专项集已经达到可用状态。
2. backend / security / review / tools / 运营真实表达已经被正式纳入专项评测。
3. `bm25_vector_graph` 在这套专项集上有真实 uplift，而不是假提升。
4. 当前图谱偏好最有效的主战场是 frontend 的 `pro vs basic`。
5. `homepage` 和 `ppt-maker` 两个失败簇已经被明显抬起，但还没有完全收口。
6. 当前最明显的剩余短板是：
   - homepage 的邻近表达
   - 运营汇报 PPT 的邻近表达
   - 少量 login / developer-portal / docs 的邻近表达

## 8. 下一步建议

下一轮最值得做的不是继续盲目加 case，而是针对这次暴露出来的失败簇做治理：

1. `homepage`：
   - 继续收窄 `website-homepage-design` 对 adjacent homepage query 的中性抢占。
   - 重点处理剩余 `intent_mismatch` 与 `recall_gap_exceeded:0.15` 的邻近表达。

2. `ppt-maker`：
   - 继续收窄 `ppt-course-presentation` 对 “演示文稿 / presentation” 的泛化边界。
   - 补更贴近“经营复盘 / 管理层汇报 / 业务总结 deck”的 adjacent query 表达。
   - 强化“业务汇报 / 经营分析 / 汇报 deck / presentation narrative”对 `ppt-maker` 的映射。

3. `frontend mixed query boundary`：
   - 继续收窄 `login / portal / docs / navigation` 的交叉误召回。
   - 特别注意 `auth/security` 与 `portal/onboarding/navigation` 的混淆。

4. 保持这套 300 条专项集作为图谱偏好回归集：
   - 以后每次调 graph bonus、intent gate、scene weight，都直接回跑这 300 条。
