# Skill 检索、图谱与质量评测系统详细实施落地计划

基于《Skill 检索与质量评测系统方案.md》的整体架构思想，本实施计划详细拆解**图谱沉淀库（Registry & Graph）**和**独立质量评测框架（Eval System）**的工程切片与落地步骤。

---

## 当前进度（2026-04-11）

已完成：

- [x] `skills-flat/` 作为统一 Skill 源目录。
- [x] `SKILL.md` 元信息字段已统一到 `skillId / displayName / description / aliases / version / sourceHash / domain / departmentTags / sceneTags`。
- [x] 新增元信息规范化脚本：`scripts/skillMetadataAliasRefresh.ts`。
- [x] 新增 registry 构建脚本：`scripts/buildSkillRegistry.ts`。
- [x] 新增 runtime 可消费产物：`skills-flat/skill-registry.json`。
- [x] `src/services/skillSearch/localSearch.ts` 优先读取 generated registry。
- [x] `src/services/skillSearch/telemetry.ts` 优先读取 generated registry。
- [x] 新增火山 embedding 客户端：`src/services/skillSearch/embeddings.ts`。
- [x] 新增向量召回模块：`src/services/skillSearch/vectorSearch.ts`。
- [x] 新增 embedding 构建脚本：`scripts/buildSkillEmbeddings.ts`。
- [x] `localSearch` 已升级为 BM25 + 向量混合召回；无 embedding 时自动回退。
- [x] embedding client 已兼容火山 `/api/v3/embeddings/multimodal`。
- [x] 已实际生成 runtime 可消费产物：`skills-flat/skill-embeddings.json`。
- [x] 已完成一次真实向量召回评测验证（非纯 BM25 回退）。
- [x] 已建立 Docker 化 PostgreSQL（pgvector）并导入 `skill-embeddings.json`。
- [x] 已建立 Docker 化 Neo4j，并写入少量测试 Skill mock 图数据。
- [x] 已将 Neo4j 模型升级为面向检索/反馈的 schema v1，并补充 `Task / SkillVersion / FeedbackAggregate` 测试图数据。

下一步：

- [ ] 增加 AK/SK -> 临时 `ARK_API_KEY` 的辅助脚本或本地运行说明。
- [ ] 增加 `SkillRetrievalSnapshot` 与结构化 feedback event。
- [ ] 聚合 `qualityScore / confidence / departmentPreferenceScore`。
- [ ] 把聚合分回灌给 reranker。
- [ ] 把真实 Skill registry / feedback 动态边权全量写入 Neo4j，而不是仅测试数据。

---

## 1. 系统角色定位与依赖关系

**评测独立性原则**：此系统必须**独立运行于业务 Claude Code (CC) 之外**。CC 此时仅作为被评测的“黑盒”或“执行子进程”，评测系统是一个独立的 Backend 服务（Node.js/Python）结合自动化测试 Runner。

*   **模型选型解耦**：
    *   **Worker/执行环境**：固定使用 `MiniMax` 等擅长长上下文及指令遵循的生产模型跑完研发任务。
    *   **Judge/评测环境**：固定使用 `DeepSeek` 等具备强逻辑推理与代码静态分析能力的模型，专门负责抽查、对比和打分。

---

## 2. 工程实现分步走 (Detailed Building Steps)

### Phase 1: 构建 Skill 沉淀与规则评价基座 (MVP)

本阶段核心任务是建立**静态离线评测能力**，暂时不涉及真实的 LLM 长链路执行，仅验证“召回准确率 (Recall@k)”是否靠谱。

#### 1.1 Skill 注册表与结构化落库
- **数据结构定义**：解析项目仓库侧提交的 `SKILL.md`，使用关系型数据库（PG/MySQL）构建中心实体关系数据库。关键表：`Skills` (ID, Name, Metadata, TrustLevel)、`Scenes` (场景字典)、`Roles` (角色字典)。
- **研发同步流水线**: 编写 Git Action，收集各业务团队子仓库 `.claude/skills` 下最新入库的技能，解析其 Frontmatter，验证规范并同步推送到中心 Registry 服务器中（这是所有沉淀的第一步）。

#### 1.2 Baseline 检索器实现 (基线系统搭建)
集成和实现三种对比检索基线接口，以便日后数据对照：
- `Baseline 1`: 全量拉取（模拟原生 CC 无干预状态）。
- `Baseline 2`: 纯规则硬过滤（基于 UserProfile和路径标签，同刚刚改造的 CC Phase 1 同步）。
- `Baseline 3`: 纯文本引擎检索（将 Task 原始问题 Description 交给 Elasticsearch 或 BM25 中间件打分提取）。

#### 1.3 评测用例骨架构建 (Benchmark Cases)
- 提取高频真实研发需求，构建一套 JSON 格式的离线标准测试集 (Benchmark Set)，例如：
  ```json
  {
    "taskId": "case_01",
    "description": "前端页面按钮响应偶发失效，帮我查查并修复",
    "context": {"role": "frontend", "project": "ui-lib"},
    "expectSkills": ["frontend/react-debug", "infra/npm-lock-fix"]
  }
  ```
- **自动化打分脚手架**：循环喂入几千条大盘数据集，分别跑上述 3 个基线检索器，比对期待命中率并计算 Precision / Recall 等传统检索体系的量化指标并存盘输出报表。

---

### Phase 2: 动态质量评测与回放引擎 (Execution Eval & Replay)

本阶段进入“深水区”，不再只评判“技能搜得准不准”，而是引入真实的黑盒执行判定，客观判断“选了这个技能是否反而坑了进度”。

#### 2.1 任务隔离容器与执行器 (Test Runner)
- 构建基于 Docker 的自动化 Runner 平台，在里面 Clone 测试基准项目，并初始化独立的 TeamCC 身份态或身份快照。
- 向处于容器中的客户端 CLI (Claude Code) 定时抛出预设好或者回放的任务指令参数。
- Runner 完成后抓取 CC 最终产出的一切物料（Console 运行控制台日志流、AST 代码改动 Diff 记录）。

#### 2.2 引入专属 "评审官" (Task Judge Model)
- 将模型作为评审判官。编写高度工程结构的专门 Prompt，挂载至 `DeepSeek` 等更强推理基座，固定投喂以下信息：
  `1. 本次测试验收标准`
  `2. 原始研发需求描述`
  `3. CC的会话履历(选了哪些Skill) 与 Diff物料`
- 强制 Judge 输出结构化的 JSON 评判信号以做自动化回收分析，类似：`{"success": true, "rework_needed": false, "error_injected": false, "fatal_error_reason": "none", "score": 85}`。

#### 2.3 Transcript 回放引擎 (Replay Engine)
- 提供提取真实员工历史上出 Bug 时会话里收集到的原生 `transcript.json`。
- 将测试环境自动检出回滚 (Git Checkout) 至该事故发生的具体特定 Commit 点。
- 插入或阻断系统，使用**新版 Top-k 推荐图谱算法**强制诱导大模型尝试换几只不同的“技能弹药库”再次重试，最后用 Judge 对比两者的重做效能差异（是不是不走老路子，换套技能组合就搞定了坑人的问题）。

---

### Phase 3: 图谱进化与 Shadow Ranking 并行演进

此阶段是演进终局，系统跃迁为“成长系生态”，开始利用真实图谱重排搜索结果。

#### 3.1 行为关系图谱库的生长 (Graph DB)
- 引入图数据库中间件 (如 Neo4j，或是利用 Postgres 的关系嵌套插件)。
- 建立核心图谱实体节点集 (`User`, `Skill`, `Project`, `TaskSubtype`)。
- **监听 CC 埋点事件（联动点）**：大量消化上一个子系统中我们强硬埋好的 `tool_execution_audit` 与 `skillUsageTracking` 追踪数据！一旦监测到：一个 `User` (且属于前端组) 使用了某个特定的 `Skill` 并完成提交且没报错，即刻在该用户和对应 Skill 之间生长出一条“高权重指向边”。图谱网络正式激活连通。

#### 3.2 混合/重排与向量推荐 (Hybrid Rerank Retrieval)
- 将中心化库的所有 `SKILL` 信息推入至专用的向量大模型缓存 (Milvus / Qdrant 等 VectorDB)。
- 运行时系统采用**“图谱连通中心度游走 + Semantic 相似度检索”**进行二次重排。假如当前某个生僻业务报错，系统词法匹配不上，而由于近期该项目组内大量资深同事图谱节点高频链接了某冷门 `Fix-Skill`，推荐系统会立即强行将其召回提升至 Top-3 队列防止模型手足无措。

#### 3.3 无风险重叠对比系统 (Shadow Ranking Daemon)
- 在系统大盘架构一个**线上静默侦听服务**，完全不干涉人类运行。
- 当真实人类程序员运用当前的朴素推荐策略拿到日常搜索的 Top-3 Skill 做业务时，Shadow Ranking 服务会在后台使用全新版本的图谱算法隐形进行同样的实时计算生成它的 “模拟 Top-3”。
- 它无需输出也无需干预，只负责静悄悄地把差异对照通过大数据清洗器对比写回落库：`"按老算法他选了A，但我们新算法认为得配 C，稍晚看看他的执行成功率验证是谁对"`。让开发者在完全无停机无回滚风险的情节下迭代新架构。

---

## 3. 下一步交付物结构

这些评测监控大盘和图谱引擎，**绝对不是写在此时此刻你所在的 `TeamSkill-ClaudeCode` （客户端引擎端）里的代码**。它们应当是一个完全独立的微服务与流批处理作业平台工程仓库（如建立 `TeamSkill-Eval-Server`）。

1. **统一数据漏斗中心 (The Telemetry Pipeline)**: 一个高速消息队列大盘（如 Kafka 或轻量的 Redis Stream），以 99.9% 可用性接收自全司全范围分发出去的 Claude CLI 不断倒腾传输回来的各种埋点打桩追踪事件。
2. **离线报表面板 (Dashboard)**: 定期以大屏页面形式生成每日自动产露的 Markdown/HTML 对比矩阵。展示：“昨日本周全量野生暴露策略 vs 本次我们改写的严格身份下发筛选策略，在不同语言模块下的模型抽风执行异常率与失败分布降低程度对比”。用真实量化数据佐证明确客户端做控制面架构限幅拦截这一路线的历史正确性。
