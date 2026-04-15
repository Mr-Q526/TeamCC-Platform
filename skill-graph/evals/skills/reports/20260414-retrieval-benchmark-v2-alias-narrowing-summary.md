# Skill Alias 收窄与 Benchmark V2 复测总结

日期：2026-04-14

## 1. 本轮改动

本轮只改 `skill-graph`，目标是治理 `skills-flat/*/SKILL.md` 中过宽 aliases 对检索的干扰。

核心变化：

- 新增统一 alias policy：`src/skills/aliasPolicy.ts`。
- `scripts/skillMetadataAliasRefresh.ts` 改为使用统一 policy，不再把 domain / scene / department tag 自动写入 aliases。
- 新增 `skills:audit-aliases`，用于统计泛词残留、metadata tag 残留和重复 alias。
- 批量刷新 106 个 skill 的 `aliases` 与 `sourceHash`，并重建 `skill-registry.json` 与 `skill-retrieval-features.json`。
- 将 Ark embedding 默认 endpoint/model 收口到火山 multimodal：
  - endpoint: `https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal`
  - model: `doubao-embedding-vision-251215`

## 2. Alias 收窄结果

| item | before | after |
| --- | ---: | ---: |
| skillCount | 106 | 106 |
| aliasCount | 1958 | 1092 |
| avgAliasesPerSkill | 18.47 | 10.30 |
| maxAliasesPerSkill | 28 | 18 |
| alias audit issueCount | 1064 | 0 |

收窄前最高频问题 alias：

| alias | reason | skillCount |
| --- | --- | ---: |
| `design` | generic_exact | 67 |
| `UI` | generic_exact | 67 |
| `视觉设计` | generic_exact | 67 |
| `设计` | generic_exact | 67 |
| `frontend-platform` | metadata_tag | 62 |
| `Web 前端` | generic_exact | 62 |
| `前端` | generic_exact | 62 |
| `页面开发` | generic_exact | 62 |
| `frontend` | generic_exact | 59 |
| `basic` | generic_exact | 27 |

收窄后仍然重复但未判定为问题的 alias 主要是同族 skill 的合理共享词，例如 `server side`、`服务端`、`code review`、`代码审查`、`ppt`。

## 3. Benchmark 复测状态

运行信息：

| item | value |
| --- | --- |
| runId | `offline-retrieval-2026-04-14T15-25-02-358Z-dc5a85c6` |
| runDir | `evals/skills/runs/offline-retrieval-2026-04-14T15-25-02-358Z-dc5a85c6` |
| caseCount | 300 |
| registryVersion | `sha256:ffa6bd8d1a92bd5c2a2bff3de590bf5ff6df6551a11d2494cf0a2ac979e22e7b` |
| embeddingsGeneratedAt | `2026-04-14T15:24:52.672Z` |
| retrievalFeaturesGeneratedAt | `2026-04-14T15:10:48.994Z` |
| benchmark audit | `issueCount = 0`, `quotaIssueCount = 0` |

本次已完成正式三模式复测：

- 已使用 Ark key 重建 `skill-embeddings.json`。
- embeddings registryVersion 已与当前 registry 对齐。
- `bm25_vector.degradedRate = 0`
- `bm25_vector_graph.degradedRate = 0`
- 以下三模式数字均为正式结果，不再是退化参考。

## 4. 三模式复测结果

| mode | Recall@1 | Recall@3 | Recall@5 | MRR | NDCG@5 | degradedRate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `bm25` | 0.630000 | 0.910000 | 0.950000 | 0.765500 | 0.747690 | 0 |
| `bm25_vector` | 0.670000 | 0.913333 | 0.963333 | 0.792389 | 0.763922 | 0 |
| `bm25_vector_graph` | 0.670000 | 0.913333 | 0.963333 | 0.792389 | 0.763922 | 0 |

与 V1 正式 run 对比：

| mode | V1 Recall@1 | V1 Recall@3 | V1 MRR | V2 Recall@1 | V2 Recall@3 | V2 MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `bm25` | 0.463333 | 0.726667 | 0.599333 | 0.630000 | 0.910000 | 0.765500 |
| `bm25_vector` | 0.490000 | 0.740000 | 0.618778 | 0.670000 | 0.913333 | 0.792389 |
| `bm25_vector_graph` | 0.490000 | 0.740000 | 0.618778 | 0.670000 | 0.913333 | 0.792389 |

解释：

- V2 的 `bm25` 明显提升，说明 alias 收窄 + frontend residual scoring 治理有效。
- `bm25_vector` 相比 `bm25` 继续提升，说明真实 query embedding 已经带来增益。
- `bm25_vector_graph` 在整体指标上与 `bm25_vector` 完全持平，当前图谱特征几乎没有形成可观测 uplift。

## 5. 重点域结果

| domain | Recall@1 | Recall@3 | Recall@5 | MRR | Top3 acceptable hit |
| --- | ---: | ---: | ---: | ---: | ---: |
| frontend | 0.644444 | 0.888889 | 0.944444 | 0.772037 | 0.922222 |
| security | 0.708333 | 1.000000 | 1.000000 | 0.840278 | 1.000000 |
| general | 0.791667 | 1.000000 | 1.000000 | 0.881944 | 1.000000 |

重点变化：

- `frontend` 从 V1 的 Recall@3 0.333333 提升到 0.888889，最大问题域已从“不可用”变成“Top3 基本可用”。
- `security` Recall@1 从 V1 的 0.25 提升到 0.708333，`security-threat-model` 不再垄断安全 Top1。
- `general` 保持 Recall@3 1.0，Recall@1 从 V1 的 0.625 提升到 0.791667。

## 6. 失败 Case 分析

失败定义：以下统计以正式 `bm25_vector_graph` 请求结果为准。

### 6.1 Frontend

Frontend Top1 miss 仍有 36 条，主要不是“完全召回不到”，而是同族 basic/pro 或相邻页面 skill 排序问题。

典型残留：

| caseId | expected | firstExpectedRank | top3 |
| --- | --- | ---: | --- |
| `retrieval_benchmark_frontend_about_company_page_basic_001` | `frontend/about-company-page-basic` | 3 | `website-homepage-design-pro`, `frontend-skill`, `about-company-page-basic` |
| `retrieval_benchmark_frontend_admin_dashboard_design_001` | `frontend/admin-dashboard-design` | 2 | `spreadsheet`, `admin-dashboard-design`, `search-results-page-basic` |
| `retrieval_benchmark_frontend_ai_chat_interface_basic_002` | `frontend/ai-chat-interface-basic` | 2 | `component-library-basic`, `ai-chat-interface-basic`, `enterprise-security-page-basic` |
| `retrieval_benchmark_frontend_data_table_basic_002` | `frontend/data-table-basic` | n/a | `website-homepage-design-pro`, `frontend-skill`, `component-library-basic` |

判断：

- `marketing-landing-page` 抢占已明显下降，但在销售联系页等确实带转化语义的 case 中仍会出现。
- basic/pro 区分仍偏弱，尤其 query 使用“专业/基础”但目标正文也共享大量描述词时。
- `tools/spreadsheet` 抢占管理控制台，说明“表格/清单/标签”类 query 需要再区分“数据表格工具”与“后台 UI 表格”。

### 6.2 Security

Security Top3 已全命中，Top1 miss 8 条。

典型残留：

| caseId | expected | firstExpectedRank | top3 |
| --- | --- | ---: | --- |
| `retrieval_benchmark_security_dependency_supply_chain_audit_002` | `security/dependency-supply-chain-audit` | 2 | `rate-limiting-abuse-protection`, `dependency-supply-chain-audit`, `security-vulnerability-check` |
| `retrieval_benchmark_security_rate_limiting_abuse_protection_001` | `security/rate-limiting-abuse-protection` | 2 | `dependency-supply-chain-audit`, `rate-limiting-abuse-protection`, `security-best-practices` |
| `retrieval_benchmark_security_security_ownership_map_003` | `security/security-ownership-map` | 3 | `rate-limiting-abuse-protection`, `security-threat-model`, `security-ownership-map` |

判断：

- 当前安全域已不是 threat-model 单点抢占，而是 rate-limiting / dependency / best-practices 三类互相抢。
- 下一轮应增加安全子类的互斥惩罚，例如 supply-chain query 不应给 rate-limiting 高分。

### 6.3 General

General Top3 已全命中，Top1 miss 5 条。

典型残留：

| caseId | expected | firstExpectedRank | top3 |
| --- | --- | ---: | --- |
| `retrieval_benchmark_general_bug_fix_debugging_004` | `general/bug-fix-debugging` | 3 | `playwright-interactive`, `playwright`, `bug-fix-debugging` |
| `retrieval_benchmark_general_development_plan_doc_basic_005` | `general/development-plan-doc-basic` | 2 | `development-plan-doc-pro`, `development-plan-doc-basic`, `docs-site-basic` |
| `retrieval_benchmark_general_development_plan_doc_pro_004` | `general/development-plan-doc-pro` | 2 | `vercel-deploy`, `development-plan-doc-pro`, `development-plan-doc-basic` |

判断：

- 调试类 query 容易被 Playwright 抢占，原因是“排查/修复/验证”同时符合交互测试工具。
- 计划文档类 query 仍存在 pro/basic 和 deploy 意图混淆。

## 7. Graph Uplift 状态

本轮已经能得出正式结论：图谱 rerank 基本没有形成有效 uplift。

验证结果：

- 300 个 case 中，`bm25_vector_graph` 与 `bm25_vector` 的 Top1 完全相同：`300 / 300`
- 完整排序完全相同：`297 / 300`
- 仅有 `3 / 300` case 出现低位次序变化，且都是很小的 graph bonus 导致的 2-5 名交换
- 只有 `2` 个 case 的 Top1 候选携带非零 `graphFeatureScore`

结论：

- 当前 graph feature 链路已经接上，但覆盖和权重都偏弱。
- 图谱对最终排序几乎没有实质影响。
- 下一轮要直接排查 `skill-retrieval-features.json` 的非零 scene / department / version signal 覆盖，而不是继续假设 graph rerank 已生效。

## 8. 结论

本轮 alias 收窄已经完成，并且对检索主路径有明显提升：

- 总体 Recall@3：0.726667 -> 0.910000。
- Frontend Recall@3：0.333333 -> 0.888889。
- Security Recall@1：0.25 -> 0.708333。
- General Recall@1：0.625 -> 0.791667。
- `bm25_vector` 相比 `bm25` 又把总体 Recall@1 从 `0.63` 提升到 `0.67`，MRR 从 `0.7655` 提升到 `0.792389`。

当前剩下的核心问题已经收窄为两件事：

- frontend 仍有 basic/pro 和相邻页面 skill 的 Top1 排序问题；
- graph rerank 虽然接上了，但在 300 条 benchmark 上几乎没有实际 uplift。
