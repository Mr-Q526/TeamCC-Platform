# Skill Retrieval Benchmark V1 总结

生成时间：2026-04-14

数据来源：

- benchmark run: `evals/skills/runs/offline-retrieval-2026-04-13T17-07-17-932Z-3082947f/`
- benchmark audit: `evals/skills/reports/retrieval-benchmark-v1-audit-summary.json`
- review sample: `evals/skills/reports/retrieval-benchmark-v1-review-sample.json`

## 1. 任务完成情况

本轮已经把 retrieval 评测数据从单一混合题库拆成两层：

| 数据集 | 数量 | 用途 | 本地路径 | Langfuse dataset |
| --- | ---: | --- | --- | --- |
| coverage | 106 | 检查每个 skill 至少可被召回，验证 registry / alias / embedding / graph assets 是否工作 | `evals/skills/cases/retrieval/coverage/v1/` | `skill-graph-retrieval-coverage-v1` |
| benchmark | 300 | 正式检索对比题库，使用 user-like query 比较 `bm25 / bm25_vector / bm25_vector_graph` | `evals/skills/cases/retrieval/benchmark/v1/` | `skill-graph-retrieval-benchmark-v1` |

已完成项：

- 新建 `skills:eval:generate-benchmark-cases`，使用模板骨架 + Ark LLM 改写生成 300 条 user-like retrieval cases。
- 新建 `skills:eval:audit-benchmark-cases`，做全量自动审计，并生成 36 条分层抽审清单。
- 将 `eval:skills` 默认 retrieval cases 切到 benchmark dataset。
- 将 Langfuse sync 默认切到 benchmark dataset，同时保留 `--dataset-kind coverage`。
- coverage cases 已迁入 `coverage/v1/` 并统一标记 `set:coverage`。
- benchmark cases 已统一标记 `set:benchmark / difficulty:* / lang:*`。
- benchmark 和 coverage 都已同步到 Langfuse。
- 已对 benchmark dataset 跑完整 `offline-retrieval`。
- 已创建 Langfuse dataset run：`retrieval-bm25_vector_graph-2026-04-13T17-09-18-113Z`。

## 2. Benchmark 数据状态

Benchmark 总量固定为 300 条，审计结果为：

| 检查项 | 结果 |
| --- | ---: |
| caseCount | 300 |
| issueCount | 0 |
| quotaIssueCount | 0 |
| missing skillId | 0 |
| duplicate / near-duplicate | 0 |
| identity leak | 0 |
| review sample | 36 |

Domain 配比：

| domain | count |
| --- | ---: |
| frontend | 90 |
| backend | 42 |
| design | 36 |
| tools | 30 |
| security | 24 |
| infra | 24 |
| general | 24 |
| ai | 18 |
| review | 12 |

Difficulty 配比：

| difficulty | count |
| --- | ---: |
| `difficulty:direct` | 150 |
| `difficulty:adjacent` | 105 |
| `difficulty:ambiguous` | 45 |

Language 配比：

| language | count |
| --- | ---: |
| `lang:zh-mixed` | 210 |
| `lang:zh-pure` | 90 |

## 3. 整体评测结果

本轮完整运行了 300 条 benchmark，每条 case 对比三种模式。

| mode | Recall@1 | Recall@3 | Recall@5 | MRR | NDCG@5 | degradedRate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `bm25` | 0.463333 | 0.726667 | 0.813333 | 0.599333 | 0.611168 | 0 |
| `bm25_vector` | 0.49 | 0.74 | 0.826667 | 0.618778 | 0.623991 | 0 |
| `bm25_vector_graph` | 0.49 | 0.74 | 0.826667 | 0.618778 | 0.623991 | 0 |

结论：

- `bm25_vector` 相比 `bm25` 有小幅提升。
- `bm25_vector_graph` 在这 300 条 benchmark 上与 `bm25_vector` 完全持平。
- 当前 graph rerank 没有在这版 user-like benchmark 上带来额外 uplift。
- 后续应优先分析 graph feature 覆盖、feedback aggregate 覆盖，以及 frontend 场景下的过强通用页面 skill。

## 4. Frontend / Security / General 重点分析

失败定义：

- Top1 miss：目标 skill 不在第 1 名。
- Top3 miss：目标 skill 不在前 3 名。
- Top5 miss：目标 skill 不在前 5 名。
- 以下分析默认使用 `bm25_vector_graph` 结果。

### 4.1 概览

| domain | total | Top1 miss | Top3 miss | Top5 miss | 主要 Top1 抢占者 |
| --- | ---: | ---: | ---: | ---: | --- |
| frontend | 90 | 76 | 60 | 45 | `frontend/marketing-landing-page` 58 次 |
| security | 24 | 18 | 5 | 1 | `security/security-threat-model` 18 次 |
| general | 24 | 9 | 0 | 0 | `infra/vercel-deploy` 5 次 |

## 5. Frontend 失败分析

Frontend 是当前最大问题域。

关键指标：

| metric | value |
| --- | ---: |
| total | 90 |
| Recall@1 | 0.155556 |
| Recall@3 | 0.333333 |
| Recall@5 | 0.5 |
| MRR | 0.263148 |
| Top1 miss | 76 |
| Top3 miss | 60 |
| Top5 miss | 45 |

Top1 抢占者：

| skillId | count |
| --- | ---: |
| `frontend/marketing-landing-page` | 58 |
| `security/security-threat-model` | 5 |
| `frontend/website-homepage-design` | 3 |
| `frontend/design-system-builder-basic` | 2 |

主要现象：

- `frontend/marketing-landing-page` 对大量“页面设计 / 转化 / 布局 / 视觉”类 query 过强，覆盖了 settings、search results、navigation、profile、pricing、docs 等更细粒度页面 skill。
- 多数 frontend query 的自然表达都包含“设计页面、布局、响应式、可访问性、状态”等泛化词，当前检索更容易把它们归到通用 landing page。
- `frontend` 内部 skill 非常密集，很多页面 skill 共享 alias 和描述词；没有足够强的 page-type 特征时，细粒度 skill 排不上来。
- graph rerank 没有纠正这个问题，说明当前 graph features 对这些细粒度 frontend skill 的区分信号不足或未命中。

代表失败 case：

| caseId | query | expected | rank | top5 |
| --- | --- | --- | ---: | --- |
| `retrieval_benchmark_frontend_settings_page_pro_001` | 帮忙设计一个专业的设置页面，要考虑分组、后果清晰、默认值、安全更改... | `frontend/settings-page-pro` | n/a | `marketing-landing-page`, `security-threat-model`, `website-homepage-design-pro`, `website-homepage-design`, `enterprise-security-page-basic` |
| `retrieval_benchmark_frontend_search_results_page_basic_001` | 帮忙设计一个基础版的搜索结果页面，要考虑查询反馈、相关性、过滤器和结果扫描... | `frontend/search-results-page-basic` | n/a | `marketing-landing-page`, `website-homepage-design-pro`, `website-homepage-design-basic`, `website-homepage-design`, `pricing-page-basic` |
| `retrieval_benchmark_frontend_responsive_navigation_basic_001` | 帮忙设计一个响应式的导航栏，要考虑不同设备的屏幕尺寸... | `frontend/responsive-navigation-basic` | n/a | `marketing-landing-page`, `website-homepage-design-pro`, `website-homepage-design`, `website-homepage-design-basic`, `pricing-page-basic` |
| `retrieval_benchmark_frontend_profile_account_page_basic_001` | 帮忙设计一个个人资料页面，要体现所有权、可编辑性、隐私和账户状态可见性... | `frontend/profile-account-page-basic` | 5 | `marketing-landing-page`, `website-homepage-design-pro`, `website-homepage-design`, `website-homepage-design-basic`, `profile-account-page-basic` |

建议：

- 降低 `marketing-landing-page` 对泛化“页面设计 / 布局 / 转化”词的全局抢占权重。
- 为 frontend 细粒度页面 skill 增加 page-type discriminators，例如 `settings / search results / navigation / profile / account / onboarding / checkout`。
- 在 rerank 中加入 same-domain page-type match bonus，而不是只依赖 recallScore。
- 对 frontend benchmark 单独做一次 error-driven alias 治理。

## 6. Security 失败分析

Security 的 Top5 召回基本可用，但 Top1 被 `security/security-threat-model` 强烈抢占。

关键指标：

| metric | value |
| --- | ---: |
| total | 24 |
| Recall@1 | 0.25 |
| Recall@3 | 0.791667 |
| Recall@5 | 0.958333 |
| MRR | 0.509722 |
| Top1 miss | 18 |
| Top3 miss | 5 |
| Top5 miss | 1 |

Top1 抢占者：

| skillId | count |
| --- | ---: |
| `security/security-threat-model` | 18 |

主要现象：

- `security-threat-model` 对“风险、审计、安全、攻击面、威胁”等安全通用语义过强，几乎成为 security 域的默认 Top1。
- `security-best-practices`、`security-ownership-map`、`rate-limiting-abuse-protection`、`dependency-supply-chain-audit` 的目标常在 Top5 内，但排序被 threat model 压住。
- `rate-limiting-abuse-protection` 在一条纯中文抽象 query 中跌出 Top5，说明“防滥用 / 限制访问频率”没有稳定绑定到“限流 / API 被刷 / 频控 / abuse protection”。

代表失败 case：

| caseId | query | expected | rank | top5 |
| --- | --- | --- | ---: | --- |
| `retrieval_benchmark_security_security_ownership_map_004` | 我想分析一下代码库的安全所有权，看看哪些人负责哪些文件，以及是否存在安全风险。 | `security/security-ownership-map` | 4 | `security-threat-model`, `rate-limiting-abuse-protection`, `dependency-supply-chain-audit`, `security-ownership-map`, `security-vulnerability-check` |
| `retrieval_benchmark_security_security_best_practices_003` | 对我的代码进行安全最佳实践审查，并提供改进建议。 | `security/security-best-practices` | 5 | `security-threat-model`, `rate-limiting-abuse-protection`, `dependency-supply-chain-audit`, `security-vulnerability-check`, `security-best-practices` |
| `retrieval_benchmark_security_rate_limiting_abuse_protection_002` | 我要设计一个防止滥用和限制访问频率的安全机制，以确保系统的稳定性和公平性。 | `security/rate-limiting-abuse-protection` | n/a | `security-threat-model`, `dependency-supply-chain-audit`, `enterprise-security-page-basic`, `enterprise-security-page-pro`, `security-best-practices` |

建议：

- 对 `security-threat-model` 做 alias 降权，尤其是 `security / risk / audit / threat` 这类泛化词。
- 为 security 子类建立更强的 discriminator：
  - `ownership-map`: 所有权、代码负责人、bus factor、人员到文件、敏感代码归属。
  - `rate-limiting`: 接口被刷、频控、限流、防滥用、验证码、API abuse。
  - `supply-chain`: 依赖包、锁文件、许可证、投毒、包来源、CVE。
  - `best-practices`: 安全基线、最佳实践、代码审查、修复建议。
- graph rerank 应针对 security 子类引入 scope-specific preference，不能只让 threat model 吃到通用安全反馈。

## 7. General 失败分析

General 域不是召回问题，主要是 Top1 排序问题。

关键指标：

| metric | value |
| --- | ---: |
| total | 24 |
| Recall@1 | 0.625 |
| Recall@3 | 1 |
| Recall@5 | 1 |
| MRR | 0.798611 |
| Top1 miss | 9 |
| Top3 miss | 0 |
| Top5 miss | 0 |

Top1 抢占者：

| skillId | count |
| --- | ---: |
| `infra/vercel-deploy` | 5 |
| `general/development-plan-doc-pro` | 2 |
| `tools/playwright-interactive` | 2 |

主要现象：

- `general/xiaohongshu-ops` 和 `general/wechat-toolkit` 被 `infra/vercel-deploy` 抢 Top1，说明“发布 / 执行 / 复盘 / workflow”这类词触发了部署类 skill。
- `development-plan-doc-basic` 被 `development-plan-doc-pro` 抢 Top1，这是合理的 pro/basic 排序偏好问题，不是召回失败。
- `bug-fix-debugging` 被 Playwright 相关工具抢 Top1，但目标仍在第 3 名，说明“debug / test / 验证”语义会偏向工具执行 skill。

代表 Top1 miss case：

| caseId | query | expected | rank | top5 |
| --- | --- | --- | ---: | --- |
| `retrieval_benchmark_general_xiaohongshu_ops_001` | 我需要小红书全流程运营服务，包括定位、选题、内容制作、发布执行和事后复盘... | `general/xiaohongshu-ops` | 2 | `vercel-deploy`, `xiaohongshu-ops`, `wechat-toolkit`, `ci-quality-gates`, `development-plan-doc-pro` |
| `retrieval_benchmark_general_wechat_toolkit_002` | 帮我搜索微信公众号文章，然后下载下来，再用AI改写一下，最后发布到公众号上。 | `general/wechat-toolkit` | 2 | `vercel-deploy`, `wechat-toolkit`, `ci-quality-gates`, `data-migration-backfill`, `transcribe` |
| `retrieval_benchmark_general_development_plan_doc_basic_002` | 我需要一个简单的开发计划文档，包含主要步骤、大致文件和验证说明。 | `general/development-plan-doc-basic` | 2 | `development-plan-doc-pro`, `development-plan-doc-basic`, `doc`, `database-schema-design`, `docs-site-basic` |
| `retrieval_benchmark_general_bug_fix_debugging_004` | 最近代码运行有问题，帮我debug一下，看看哪里出了bug，然后给我个patch修复一下... | `general/bug-fix-debugging` | 3 | `playwright-interactive`, `playwright`, `bug-fix-debugging`, `unit-test-strategy`, `stress-testing` |

建议：

- 对 `infra/vercel-deploy` 的 `发布` 语义做上下文限制：只有部署、上线、构建、托管、域名、环境变量等词同时出现时才强加分。
- `general/xiaohongshu-ops` 和 `general/wechat-toolkit` 应加强内容平台、运营、公众号、小红书等实体词权重。
- 对 `basic/pro` 成对 skill 建立明确版本偏好策略：用户说“简单 / 基础 / 快速”时偏 basic；说“详细 / 复杂 / 专业”时偏 pro。
- 对 debug 类 query，区分“修代码”与“浏览器自动化测试”，避免 Playwright 抢所有 debug/test query。

## 8. 关于 `coverage/v1/generated/v1`

“输出到 `coverage/v1/generated/v1`，并自动打上 `set:coverage`，以后再跑不会回到旧目录”的意思是：

- 旧状态：自动生成的 retrieval cases 放在 `cases/retrieval/generated/v1/`，和 curated cases、benchmark cases 混在同一层。
- 新状态：自动补齐 skill 覆盖的 cases 只放到 `cases/retrieval/coverage/v1/generated/v1/`。
- `set:coverage` 是一个 tag，明确告诉评测系统和人类 reviewer：这些 case 是 coverage probe，不是正式 user-like benchmark。
- 以后再运行 `bun run skills:eval:generate-retrieval-cases`，脚本会只检查和补齐 `coverage/v1/`，不会再把生成文件写回旧的 `cases/retrieval/generated/v1/`。
- 这样可以避免把“按 skill 名称反向构造的覆盖性探针”误混进正式 benchmark。

一句话：

> `coverage/v1/generated/v1` 是覆盖性测试数据的自动生成区，不是正式 benchmark 题库。

正式 benchmark 题库只看：

```text
evals/skills/cases/retrieval/benchmark/v1/
```

## 9. 下一步建议

优先级建议：

1. 先做 frontend error-driven alias / rerank 治理，因为 frontend 是最大失败来源。
2. 再做 security 子类 discriminator 和 `security-threat-model` 降权。
3. general 只需要做少量排序修正，不是当前主风险。
4. graph rerank 需要单独排查：为什么在 300 条 benchmark 上 `bm25_vector_graph` 与 `bm25_vector` 完全持平。
