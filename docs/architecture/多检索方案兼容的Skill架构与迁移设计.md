# 多检索方案兼容的 Skill 架构与迁移设计

## 目标

本方案用于把 `skiils-line/` 中来源复杂的 Skill 资产迁移为可治理、可检索、可评测、可沉淀的统一 Skill Registry，并同时支持三类检索方案对比：

- 向量匹配元信息：依赖稳定、丰富、可过滤的结构化 metadata 和 embedding 语料。
- 知识图谱加权检索：依赖 Skill、用户、团队、项目、路径、场景、工具、评测集之间的实体关系，以及使用结果沉淀后的边权。
- OpenViking / 路径树检索：依赖稳定的领域分类路径和可步进的树状视图。

迁移产物必须满足两个额外约束：

- 后期可以基于真实使用事件和评测结果建立 Skill 使用沉淀知识图谱，并通过聚合统计生成排序分数。
- 元信息的编码、枚举、字段含义必须有独立规范，避免不同脚本、不同团队各自发明字段。规范见 [Skill元信息编码映射规范.md](./Skill元信息编码映射规范.md)。

## 现状口径

`skiils-line/` 内存在普通目录、社区集合、插件目录、软链、示例 skill 和 vendor 内容。数量统计必须由迁移脚本的 inventory 阶段统一输出，不能在方案或脚本中写死。

当前本地粗扫口径存在差异：

- 不跟随软链：约 1612 个 `SKILL.md`。
- 跟随软链：约 2125 个 `SKILL.md`。
- 大部分 `SKILL.md` 已有基础 frontmatter，但字段通常只包含 `name` 和 `description`。

迁移脚本必须显式记录：

- 是否跟随软链。
- 是否排除 `assets/`、`vendor/`、`node_modules/`、`.git/`。
- 被跳过的路径和原因。
- 被识别为真实 Skill、示例 Skill、引用文档、vendor 文档的数量。

## 核心设计

采用“Registry 唯一源 + Runtime 投影 + 多索引视图”的结构。

不要把 `.claude/skills/` 直接作为唯一源。当前 runtime loader 只支持 `.claude/skills/<skill-name>/SKILL.md` 这种一层目录结构；如果把唯一源设计成 `.claude/skills/<domain>/<skill-name>/SKILL.md`，现有 loader 会找不到第二层 Skill。

### 目录结构

```text
.claude/
  skill-registry/                    # 唯一事实源，人工 review 和迁移脚本写这里
    frontend/
      react-debugger/
        SKILL.md
        references/
        scripts/
        assets/
    security/
      threat-model/
        SKILL.md
        references/

  skills/                            # runtime 投影，生成目录，不作为人工编辑源
    frontend__react-debugger/
      SKILL.md
      references/
      scripts/
      assets/
    security__threat-model/
      SKILL.md
      references/

  indexes/                           # 检索、评测、图谱使用的生成视图
    manifest.json
    vector/
      skills.jsonl
    graph/
      static_nodes_edges.json
      behavior_edges_snapshot.json
    path-tree/
      tree.json
    scores/
      skill_score_snapshot.jsonl
```

### 各目录职责

| 目录 | 职责 | 是否人工编辑 |
|---|---|---|
| `.claude/skill-registry/` | Skill 唯一源，保留业务分类、完整资源、溯源信息和标准 frontmatter | 是 |
| `.claude/skills/` | 兼容当前 Claude Code loader 的 runtime 投影 | 否 |
| `.claude/indexes/` | 向量、图谱、路径树、评分快照等离线索引 | 否 |

默认只把 `reviewState: active` 且满足安全门禁的 Skill 投影到 `.claude/skills/`。`draft`、`review`、`blocked` 状态的 Skill 可进入评测索引，但不得默认进入可执行 runtime 目录。需要评测时使用独立 projection，例如 `.claude/skills-eval/`，并在隔离环境中加载。

## Registry 存储模型

Registry 采用 `{domain}/{skill-name}/SKILL.md` 的两级物理目录。

```text
.claude/skill-registry/
  frontend/
    react-debugger/
      SKILL.md
  backend/
    api-design-reviewer/
      SKILL.md
  infra/
    cloudflare-deploy/
      SKILL.md
  tools/
    pdf-extractor/
      SKILL.md
  general/
    zh-humanizer/
      SKILL.md
```

两级结构只表达稳定业务分类，不承担所有检索语义。更细的分类通过 frontmatter 中的 `taxonomyPath`、`sceneTags`、`techStack`、`departmentTags`、`projectTags` 等字段表达。

Skill 目录必须按整体迁移，不能只复制 `SKILL.md`。如果原 Skill 有 `references/`、`scripts/`、`assets/`、`agents/`，迁移时必须一起复制，并校验 `SKILL.md` 中相对链接仍然可用。

## 标准 Frontmatter

字段编码和枚举以 [Skill元信息编码映射规范.md](./Skill元信息编码映射规范.md) 为准。下面是 Registry 中 `SKILL.md` 的推荐样例：

```yaml
---
schemaVersion: "2026-04-11"
skillId: frontend/react-debugger
name: react-debugger
description: >
  Diagnose React rendering, profiler traces, and avoidable rerenders.
domain: frontend
taxonomyPath: [frontend, react]

sceneTags: [debug, performance]
roleTags: [frontend-engineer]
departmentTags: [frontend-platform]
projectTags: []
techStack: [react, typescript]

requiredTools: [Read, Edit, Bash]
allowed-tools: [Read, Edit, Bash]
paths: []
requiredPaths: []

scope: community
sourceType: import
sourceRepo: community-collections/example
sourcePath: skiils-line/community-collections/example/react-debugger/SKILL.md
sourceHash: sha256:...
licenseHint: unknown

owner: unknown
authors: []
maintainers: []
version: "1.0.0"

reviewState: review
trustLevel: draft
benchmarkSetIds: []
---
```

注意：

- `requiredTools` 是检索、图谱和评测特征，表示 Skill 需要哪些能力。
- `allowed-tools` 是当前 runtime 可解析的权限字段。只有确实要约束或放行 runtime 权限时才写，并且最终必须被全局策略取交集。
- `taxonomyPath` 给 OpenViking / 路径树检索使用。
- `paths` 给 Claude Code 当前条件激活逻辑使用，表示代码路径匹配。
- `requiredPaths` 是治理和审计字段，表示 Skill 允许或建议作用的仓库路径边界。
- `sourcePath` 是迁移溯源字段，不参与 runtime 路径匹配。

## 使用沉淀与知识图谱

后期排序不能只依赖静态 metadata。系统必须沉淀真实使用、评测和反馈，生成可解释的图谱边权和评分快照。

### 事件采集

客户端和评测系统至少记录以下事件，不在事件中写入原始代码内容：

| 事件 | 触发时机 | 核心字段 |
|---|---|---|
| `skill_retrieval_run` | 一次检索产生候选集 | `runId`, `strategy`, `taskScene`, `repoId`, `pathHints`, `candidateSkillIds` |
| `skill_exposed` | Skill 被展示给模型或用户 | `runId`, `skillId`, `rank`, `score`, `features` |
| `skill_selected` | 用户或模型选择 Skill | `runId`, `skillId`, `selectionSource`, `rank` |
| `skill_invoked` | Skill 实际进入执行上下文 | `skillId`, `actorId`, `projectId`, `repoId`, `paths`, `tools` |
| `skill_completed` | 使用 Skill 后任务结束 | `skillId`, `outcome`, `durationMs`, `cost`, `changedPathClasses`, `testSignal` |
| `skill_feedback` | 用户或 reviewer 给反馈 | `skillId`, `rating`, `reasonCode`, `commentHash` |
| `eval_case_result` | 离线评测或 replay 完成 | `benchmarkSetId`, `caseId`, `skillId`, `success`, `score`, `failureReason` |

隐私和安全规则：

- 路径可以保留仓库相对路径或归一化 path class，避免上传敏感绝对路径。
- 不记录代码片段、prompt 全文、secret、原始终端输出。
- 所有事件带 `schemaVersion`、`createdAt`、`clientVersion`、`modelVersion`，用于回放和对比。

### 聚合统计

事件进入离线聚合后，生成三个读侧产物：

```text
skill_daily_stats
skill_score_snapshot
graph_behavior_edges
```

推荐聚合维度：

- `skillId`
- `projectId`
- `repoId`
- `department`
- `role`
- `scene`
- `taxonomyPath`
- `pathClass`
- `modelVersion`
- `timeWindow`

推荐基础指标：

- `exposureCount`
- `selectionCount`
- `invocationCount`
- `successCount`
- `failureCount`
- `selectionRate`
- `successRate`
- `avgDurationMs`
- `avgCost`
- `feedbackScore`
- `evalScore`
- `lastUsedAt`

不要把这些动态分数写回 `SKILL.md`。动态分数应写入 `.claude/indexes/scores/skill_score_snapshot.jsonl` 或中心 Registry 的 score snapshot 表，避免使用行为导致源码频繁变更。

### 图谱节点与边

静态图谱来自 Registry metadata，动态图谱来自使用事件和评测结果。

推荐节点：

- `Skill`
- `SkillVersion`
- `Department`
- `Team`
- `User`
- `Author`
- `Project`
- `Repo`
- `Path`
- `Scene`
- `Role`
- `TechStack`
- `Tool`
- `BenchmarkSet`

推荐静态边：

- `(:Skill)-[:HAS_VERSION]->(:SkillVersion)`
- `(:Skill)-[:OWNED_BY]->(:Team|User)`
- `(:Skill)-[:AUTHORED_BY]->(:Author)`
- `(:Skill)-[:FOR_SCENE]->(:Scene)`
- `(:Skill)-[:FOR_ROLE]->(:Role)`
- `(:Skill)-[:USES_TECH]->(:TechStack)`
- `(:Skill)-[:REQUIRES_TOOL]->(:Tool)`
- `(:Skill)-[:MATCHES_TAXONOMY]->(:Path)`
- `(:Skill)-[:EVALUATED_BY]->(:BenchmarkSet)`

推荐动态边：

- `(:User)-[:SELECTED {count, lastAt}]->(:Skill)`
- `(:User)-[:SUCCEEDED_WITH {count, successRate, weight}]->(:Skill)`
- `(:Project)-[:USES_SKILL {count, successRate, weight}]->(:Skill)`
- `(:Repo)-[:MATCHED_SKILL {count, successRate, weight}]->(:Skill)`
- `(:Scene)-[:PREFERS_SKILL {weight}]->(:Skill)`

边权可以由聚合任务计算：

```text
behaviorWeight =
  log1p(successCount) *
  successRate *
  feedbackMultiplier *
  recencyDecay *
  trustMultiplier
```

其中：

- `feedbackMultiplier` 来自用户反馈和 reviewer 反馈。
- `recencyDecay` 用于降低长期未使用 Skill 的影响。
- `trustMultiplier` 来自 `trustLevel` 和 `reviewState`。

## 检索与排序

三种方案分别生成候选，再进入统一 rerank 层，便于离线评测和 shadow ranking 对比。

### 候选生成

| 候选源 | 输入 | 输出 |
|---|---|---|
| 元信息过滤 | `domain`, `sceneTags`, `roleTags`, `projectTags`, `trustLevel`, `reviewState` | 低成本候选池 |
| 向量检索 | 任务描述、上下文摘要、Skill embedding 语料 | Top-k semantic candidates |
| 图谱检索 | 用户、团队、项目、场景、历史成功边 | Top-k graph candidates |
| OpenViking / 路径树 | `taxonomyPath`, repo path hints, domain path | Top-k path candidates |
| BM25 / 关键词 | 任务文本、Skill name、description、tags | Top-k lexical candidates |

### 统一排序特征

统一 rerank 层读取 `.claude/indexes/scores/skill_score_snapshot.jsonl` 和图谱边权。

初始评分公式建议：

```text
finalScore =
  0.20 * semanticScore +
  0.15 * graphAffinity +
  0.15 * pathMatch +
  0.15 * sceneMatch +
  0.10 * projectMatch +
  0.10 * successRateScore +
  0.05 * feedbackScore +
  0.05 * freshnessScore +
  0.05 * trustScore
```

该公式只作为 V1 基线。每次评测必须记录公式版本、特征版本、索引版本和模型版本。

## 索引产物

### Vector Index

路径：`.claude/indexes/vector/skills.jsonl`

每行示例：

```json
{"skillId":"frontend/react-debugger","embeddingText":"name: react-debugger\ndescription: Diagnose React rendering...\nscene: debug performance\ntech: react typescript","metadata":{"domain":"frontend","sceneTags":["debug","performance"],"roleTags":["frontend-engineer"],"trustLevel":"draft","reviewState":"review","sourceHash":"sha256:..."}}
```

要求：

- `embeddingText` 必须由确定性模板生成，不能直接依赖 LLM 随机摘要。
- 记录 `embeddingModel`、`embeddingVersion`、`generatedAt`。
- 支持 metadata hard filter，例如只检索 `reviewState in [active, review]`。

### Graph Index

路径：

- `.claude/indexes/graph/static_nodes_edges.json`
- `.claude/indexes/graph/behavior_edges_snapshot.json`

静态索引来自 `SKILL.md` frontmatter。动态索引来自聚合后的 usage/eval 事件。

要求：

- 节点 id 必须稳定，例如 `skill:frontend/react-debugger`。
- 边必须有 `source`, `target`, `type`, `weight`, `evidence`, `updatedAt`。
- `evidence` 只引用聚合统计 id 或评测 case id，不写原始敏感内容。

### Path Tree Index

路径：`.claude/indexes/path-tree/tree.json`

OpenViking / 路径树检索使用 `taxonomyPath` 构建，不直接依赖 `.claude/skills/` runtime 投影目录。

示例：

```json
{
  "frontend": {
    "react": {
      "_skills": ["frontend/react-debugger", "frontend/react-performance"]
    }
  }
}
```

要求：

- 树深由 `taxonomyPath` 控制，不由原始来源路径随意继承。
- V1 建议限制为 2 到 3 层，超过部分进入 `sourcePath` 和 `tags`。
- 每个叶子保存 `skillId`，不保存重复的全文。

### Runtime Projection

路径：`.claude/skills/`

默认投影规则：

- 只投影 `reviewState: active`。
- 只投影未被 policy 阻断且 schema 校验通过的 Skill。
- 目录名使用 `${domain}__${name}`，例如 `frontend__react-debugger`，兼容当前一层 loader。
- 投影文件顶部保留标准 frontmatter，并复制 `references/`、`scripts/`、`assets/`、`agents/`。

如果未来改造 runtime loader 支持 `{domain}/{skill}/SKILL.md`，可以移除 runtime 投影层，但 Registry 和 indexes 不需要变。

## 自动化迁移计划

### Phase 0: Inventory

新增 `scripts/inventorySkills.ts`。

职责：

- 只扫描 `SKILL.md`，不把普通 `.md` 文档提升为 Skill。
- 明确 `--follow-symlinks`、`--exclude-vendor`、`--include-samples` 等参数。
- 输出 `inventory.jsonl` 和汇总报告。
- 标记 `real-skill`、`sample-skill`、`vendor-skill`、`broken-symlink`、`duplicate-source`。

### Phase 1: Normalize

新增或重写 `scripts/migrateSkills.ts`。

职责：

- 从原 Skill 目录整体复制到 `.claude/skill-registry/{domain}/{name}/`。
- 保留原有 `name`、`description`、`allowed-tools`、`when_to_use`、`paths` 等字段。
- 对缺失的 `domain`、`taxonomyPath`、`sceneTags`、`roleTags`、`departmentTags`、`techStack`、`requiredTools` 做规则推断；只有规则推断无法覆盖时才调用 LLM。
- LLM API Key 必须从环境变量读取，不得写入源码。
- 所有 LLM 输出必须经过 schema 校验，不合格则进入 `reviewState: blocked` 或写入错误报告，不生成可执行投影。
- 生成 `sourcePath`、`sourceHash`、`sourceRepo`、`sourceType`。
- 检测 slug 冲突，冲突时使用 `domain/name--shortHash`，不得静默覆盖。
- 校验相对链接和资源目录，失败时记录到 migration report。

### Phase 2: Build Indexes

新增 `scripts/buildSkillIndexes.ts`。

职责：

- 读取 `.claude/skill-registry/`。
- 校验 frontmatter 符合 [Skill元信息编码映射规范.md](./Skill元信息编码映射规范.md)。
- 生成 vector、graph、path-tree、scores 的静态初始文件。
- 写入 `.claude/indexes/manifest.json`，记录 schemaVersion、生成时间、输入 hash、脚本版本、错误数量。
- 使用临时目录写入后原子 rename，避免半成品索引被读取。

### Phase 3: Build Runtime Projection

新增 `scripts/buildRuntimeSkillProjection.ts`。

职责：

- 从 Registry 生成 `.claude/skills/`。
- 默认只投影 `active` Skill。
- 支持 `--mode eval` 输出 `.claude/skills-eval/`，用于离线评测加载 `review` 或 `draft` Skill。
- 输出 projection manifest，包含 `skillId -> runtimeName -> sourceHash` 映射。

### Phase 4: Usage Aggregation

新增离线任务或服务端 job。

职责：

- 消费 usage/eval/feedback 事件。
- 生成 `skill_daily_stats`。
- 生成 `skill_score_snapshot`。
- 生成 `behavior_edges_snapshot.json`。
- 对每个分数输出解释特征，方便排序结果审计。

该部分可以在独立评测服务仓库中实现，本仓库只保留事件契约、索引格式和本地构建脚本。

### Phase 5: Validation

每次迁移或构建必须验证：

- Registry 中所有 Skill 都有唯一 `skillId`。
- 所有 required 字段符合编码规范。
- `reviewState != active` 的 Skill 未进入默认 `.claude/skills/`。
- runtime 投影能被当前 loader 加载。
- `references/`、`scripts/`、`assets/` 相对链接未断。
- vector、graph、path-tree 三种索引的 Skill 数量与 manifest 对齐。
- 图谱没有大量孤立节点、脏实体、重复实体。
- path tree 深度在预期范围内。
- 排序评测能输出同一 benchmark 下各策略 Top-k 差异。

## 安全与治理原则

- 不在源码中硬编码模型 API Key。
- 不把未知来源或未 review 的 Skill 默认暴露给 runtime。
- 不让 `requiredTools` 充当权限放行依据。
- 不把动态使用分数写回 `SKILL.md`。
- 不直接迁移普通 Markdown 文档为 Skill。
- 不静默覆盖同名 Skill。
- 不丢弃原 Skill 的 bundled resources。
- 不上传原始代码、secret、终端输出到 telemetry 或 LLM 清洗链路。

## 交付物

| 交付物 | 类型 | 说明 |
|---|---|---|
| [Skill元信息编码映射规范.md](./Skill元信息编码映射规范.md) | 文档 | 字段、枚举、编码、校验、图谱映射规范 |
| `scripts/inventorySkills.ts` | 脚本 | 盘点来源 Skill，输出 inventory |
| `scripts/migrateSkills.ts` | 脚本 | 迁移并规范化 Registry |
| `scripts/buildSkillIndexes.ts` | 脚本 | 生成 vector/graph/path-tree/scores 索引 |
| `scripts/buildRuntimeSkillProjection.ts` | 脚本 | 生成当前 runtime 可加载的一层 `.claude/skills` |
| `.claude/indexes/manifest.json` | 产物 | 所有索引的版本、输入 hash、数量、错误摘要 |

## 推荐落地顺序

1. 先完成编码规范和 schema 校验。
2. 做 inventory dry-run，确认数量口径和排除规则。
3. 迁移 20 个代表性 Skill 做小样本验证。
4. 生成三类索引和 runtime 投影。
5. 跑离线 retrieval benchmark，比较 BM25、vector、graph、path-tree、hybrid。
6. 再扩展到全量迁移。
7. 接入 usage/eval/feedback 事件，开始生成图谱边权和 score snapshot。
