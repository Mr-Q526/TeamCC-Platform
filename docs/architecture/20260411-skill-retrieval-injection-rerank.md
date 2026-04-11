# Skill 检索、注入与重排序方案

## 1. 文档目标

本文档定义一套适合当前项目阶段的 Skill 检索方案，重点回答四个问题：

1. 在什么时候进行 Skill 检索。
2. 通过什么方式进行召回。
3. 检索之后如何做重排序。
4. 模型和用户如何看到、选择并使用检索到的 Skill。

本文档同时满足两个长期目标：

- 后期接入 Skill 图谱数据库后，可以继续复用当前检索链路，只替换召回源和重排序特征。
- 用户不仅能让模型自动命中 Skill，还能看到当前注入的 Skill，并在需要时手动选择使用。

## 2. 当前约束

### 2.1 Claude Code 现状

当前 Claude Code 对 Skill 的主路径仍然是“注册后直接暴露给模型”：

- `src/commands.ts` 中的 `getSkillToolCommands()` 会把所有符合条件的 prompt command 暴露给 `SkillTool`。
- `src/tools/SkillTool/prompt.ts` 会把这些 Skill 格式化成可见列表，放进模型可见的系统上下文。
- `src/skills/loadSkillsDir.ts` 负责从 `.claude/skills/<skill-name>/SKILL.md` 读取本地 Skill。

这种方式在内置 Skill 数量较少时可行，但项目级 Skill 扩大后会出现三个问题：

1. 全量注入会消耗上下文预算。
2. Skill 越多，模型越难从长列表中稳定选中正确项。
3. 用户无法直观看到“这轮到底注入了哪些 Skill”。

### 2.2 代码里已经预留的能力

当前代码中已经有实验性的 Skill Search 接缝：

- turn-0 用户输入阶段可做同步 discovery
- query 迭代阶段可做异步 prefetch
- 可通过 `skill_discovery` attachment 向模型注入“相关 Skill 卡片”

但对应实现仍然基本为空：

- `src/services/skillSearch/localSearch.ts`
- `src/services/skillSearch/prefetch.ts`
- `src/services/skillSearch/featureCheck.ts`

因此本方案不是推翻重来，而是在现有注入链路上补齐“检索 -> 重排序 -> 注入 -> 选择”的完整闭环。

## 3. 设计目标

### 3.1 V1 目标

V1 版本优先解决以下问题：

- 在用户当前任务上下文下自动召回相关 Skill。
- 控制注入数量，只向模型暴露少量高相关 Skill。
- 在终端 UI 中展示“当前注入的 Skill 列表”。
- 为后期图谱数据库接管检索与排序打好接口层。

### 3.2 非目标

当前版本不追求：

- 一上来就做复杂 embedding 平台。
- 一上来就把评分体系完全写回 `SKILL.md`。
- 一上来就做自动执行决策闭环，不给用户任何干预入口。

## 4. 总体架构

采用四层结构：

1. `Skill Registry`
   使用 `skills-flat/` 作为治理后的 Skill 唯一源。
2. `Search Index`
   生成本地索引，供 runtime 进行快速召回。
3. `Retrieval + Rerank`
   根据当前任务、部门、文件上下文召回候选 Skill 并排序。
4. `Injection + Selection`
   将 top-k Skill 摘要注入给模型，同时在终端 UI 展示给用户，支持后续手动选择。

整体流程：

```text
用户输入 / 文件变化 / 任务阶段变化
  -> 提取检索信号
  -> 过滤候选 Skill
  -> 多路召回
  -> 重排序
  -> 向模型注入 top-k Skill 卡片
  -> 终端 UI 展示当前注入列表
  -> 模型或用户选择 Skill
  -> 加载完整 SKILL.md
  -> 记录反馈与使用事件
  -> 后续沉淀到图谱数据库
```

## 5. 什么时候进行 Skill 检索

Skill 检索不应只在会话开始时做一次，而应是“按信号触发”的。

### 5.1 turn-0 检索

触发时机：用户刚提交一轮新输入时。

目的：

- 这是最关键的一次检索。
- 需要在模型第一次生成前把最相关的 Skill 暴露出来。

输入信号：

- 用户当前输入文本
- 当前部门上下文
- 当前会话已知仓库路径
- 当前文件选择或 `@` 提及文件

实现方式：

- 走同步检索
- 直接产出 `skill_discovery` attachment
- 注入 top-k Skill 摘要，而不是全文

### 5.2 inter-turn 检索

触发时机：模型执行工具后，任务发生明显变化时。

典型信号：

- 新读入了一批关键文件
- 发生代码写入或改动
- 计划阶段切换为执行阶段
- 用户追问一个新的子任务

目的：

- 捕捉中途任务转向
- 避免 turn-0 检索结果长期失效

实现方式：

- 走异步 prefetch
- 在 query 过程中后台完成
- 如果有新结果，再作为 attachment 补充注入

### 5.3 子代理检索

触发时机：子代理接到新任务时。

原则：

- 子代理不应继承主线程的全量 Skill 列表
- 只继承 bundled + MCP 的小静态集
- 根据子代理自己的任务描述再做一次轻量 discovery

原因：

- 子代理上下文更贵
- 子代理任务通常更聚焦，检索范围更小

### 5.4 用户显式触发检索

触发时机：

- 用户说“找一下适合这个任务的 skill”
- 用户打开技能面板查看当前候选
- 用户手动要求重新检索

这一路必须保留，因为你的目标里包含“用户再选择使用检索到的 Skill”。

## 6. 检索输入信号设计

每次检索都需要从当前会话里提取统一的 `RetrievalContext`。

建议字段：

```ts
type RetrievalContext = {
  queryText: string
  department?: string
  cwd: string
  referencedFiles: string[]
  editedFiles: string[]
  activePaths: string[]
  sceneHints: string[]
  domainHints: string[]
  priorInjectedSkillIds: string[]
  priorInvokedSkillIds: string[]
}
```

### 6.1 最重要的输入信号

- `queryText`
  当前用户任务文本，是最强意图信号。
- `department`
  对你们场景非常关键，是第一层过滤条件。
- `referencedFiles / editedFiles`
  能反映当前任务落在哪类代码区域。
- `priorInjectedSkillIds / priorInvokedSkillIds`
  用于去重和抑制重复暴露。

### 6.2 从元信息映射到检索特征

V1 版本使用当前最小元信息：

- `skillId`
- `name`
- `displayName`
- `description`
- `version`
- `sourceHash`
- `domain`
- `departmentTags`
- `sceneTags`

其中：

- `departmentTags` 用于硬过滤和强加权
- `sceneTags` 用于场景召回
- `domain` 用于粗分类与召回约束
- `name / displayName / description` 用于文本检索

## 7. 通过什么方式进行检索

推荐使用“过滤 + 多路召回”的两阶段方案。

### 7.1 第一阶段：硬过滤

先缩小候选集，再做召回。

过滤规则：

1. 如果当前已知部门，则只保留 `departmentTags` 命中的 Skill。
2. 如果任务有明确 domain hint，则优先保留 `domain` 命中的 Skill。
3. 排除已失效、重复、内容异常的 Skill。
4. 可选：排除本轮已经完整加载过且无需重复注入的 Skill。

如果部门为空：

- 不做硬过滤
- 改为部门加权

### 7.2 第二阶段：多路召回

V1 不引入重向量基础设施，先做三路召回。

#### 路线 A：精确匹配召回

字段：

- `name`
- `displayName`
- 规则化别名

适用场景：

- 用户直接说了 `pdf`
- 用户直接说了 `playwright`
- 用户直接说了 `nextjs`

#### 路线 B：关键词 / BM25 召回

字段组合：

- `name`
- `displayName`
- `description`
- `domain`
- `sceneTags`

适用场景：

- 用户没有说 skill 名，但描述了任务意图
- 例如“帮我分析威胁建模”“部署 vercel”“做前端交互测试”

#### 路线 C：上下文规则召回

基于文件与任务上下文做规则加召回。

例如：

- 命中 `app/`, `pages/`, `components/`，前端类 Skill 加权
- 命中 `playwright`, `e2e`, `spec`，测试类 Skill 加权
- 命中 `security`, `threat`, `auth`，安全类 Skill 加权

这一路不是替代文本召回，而是给文本结果补上下文偏置。

### 7.3 候选集合并

三路召回结果合并后，形成候选集。

每个候选项至少保留：

```ts
type CandidateSkill = {
  skillId: string
  name: string
  displayName: string
  description: string
  domain: string
  departmentTags: string[]
  sceneTags: string[]
  recallSources: ('exact' | 'bm25' | 'context')[]
  recallScore: number
}
```

## 8. 检索后的重排序

重排序必须和召回分开设计。

召回负责“不漏掉”，重排序负责“把最值得注入的放前面”。

### 8.1 V1 重排序目标

V1 重排序优先回答：

- 哪些 Skill 最值得注入给模型
- 哪些 Skill 最值得展示给用户

不是回答“哪个 Skill 最终一定要执行”。

### 8.2 V1 重排序特征

建议使用以下特征：

1. `departmentMatchScore`
   当前部门是否命中 `departmentTags`
2. `sceneMatchScore`
   当前任务文本与 `sceneTags` 的匹配程度
3. `domainMatchScore`
   当前任务是否落在该 Skill 的 domain
4. `exactNameBoost`
   是否命中 `name` 或 `displayName`
5. `textRecallScore`
   文本检索得分
6. `pathContextBoost`
   文件路径与上下文规则匹配得分
7. `freshnessPenalty`
   本轮已注入过的 Skill 需要降权，避免刷屏
8. `alreadyInvokedPenalty`
   已完整加载并正在生效的 Skill 再次注入时降权

### 8.3 V1 排序公式

可以先使用线性打分：

```text
finalScore =
  0.35 * textRecallScore +
  0.25 * departmentMatchScore +
  0.15 * sceneMatchScore +
  0.10 * domainMatchScore +
  0.10 * pathContextBoost +
  0.10 * exactNameBoost -
  0.10 * freshnessPenalty -
  0.15 * alreadyInvokedPenalty
```

注意：

- 如果部门是显式输入，`departmentMatchScore` 可以直接从加权改成前置过滤
- `alreadyInvokedPenalty` 不是绝对排除，因为用户可能明确要求继续使用同一 Skill

### 8.4 注入排序与展示排序

建议区分两个列表：

- `modelInjectedTopK`
  真正注入给模型的 top-k
- `userVisibleTopN`
  展示给用户的列表，可比模型注入多 1 到 3 个

建议默认：

- 模型注入 top 3 到 top 5
- 用户展示 top 5 到 top 8

原因：

- 模型上下文要保守
- 用户可见列表可以稍宽一些，给用户选择空间

## 9. 检索后怎么注入给模型

### 9.1 不再全量注入项目 Skill

项目级 Skill 不应继续和 bundled skill 一样走“全量静态列表”。

推荐策略：

- bundled + MCP 保留静态小列表
- 项目级 Skill 全部改走 discovery attachment

这也符合代码里已经预留的方向。

### 9.2 注入内容形态

每个注入项只给摘要卡片，不给全文。

建议字段：

```ts
type InjectedSkillCard = {
  skillId: string
  name: string
  description: string
  domain: string
  matchedBy: string[]
  matchedDepartment?: string
  matchedScenes?: string[]
}
```

注入示例：

```text
Skills relevant to your task:

- nextjs-app-router: Next.js App Router patterns and data fetching best practices
  matched by: domain=frontend, scene=review
- playwright: Browser automation and end-to-end test workflows
  matched by: scene=test, path=app/e2e
```

### 9.3 完整内容加载时机

只有在以下情况下才加载完整 `SKILL.md`：

1. 模型决定调用该 Skill
2. 用户明确选择该 Skill

这一步才进入全文注入。

## 10. 用户如何选择检索到的 Skill

这是本方案必须明确支持的能力。

### 10.1 UI 展示目标

终端 UI 需要展示当前会话级的注入 Skill 列表，而不是只在消息流里留一条摘要。

显示内容建议包括：

- 当前注入 Skill 数量
- Skill 名称列表
- 哪些只是“检索到”
- 哪些已经“实际加载 / 使用”

### 10.2 用户选择路径

建议分两阶段实现。

#### Phase 1

- UI 展示当前注入 Skill 列表
- 用户通过自然语言明确说“使用 xxx skill”
- runtime 将该 Skill 标记为 `user_selected`
- 下轮 query 时把该 Skill 提升到注入列表最前

#### Phase 2

增加显式命令入口，例如：

- `/skills`
  查看当前会话可用 Skill
- `/use-skill <name>`
  手动选择一个 Skill
- `/re-rank-skills`
  基于新上下文重新检索

### 10.3 用户选择后的系统行为

当用户手动选择 Skill 后：

1. 该 Skill 直接进入完整加载队列
2. 本轮或下一轮 query 将其作为强优先级 Skill 注入
3. 记录 `selectionSource = user`

这样后期做图谱和排序时，可以区分：

- 模型自动选中
- 用户主动选中

## 11. 为图谱数据库预留的接口

你后期的目标是“通过 Skill 图谱数据库进行 Skill 检索和打分重排序”，因此 V1 必须把接口抽象清楚。

### 11.1 检索接口抽象

统一定义：

```ts
type SkillRetriever = {
  retrieve(ctx: RetrievalContext): Promise<CandidateSkill[]>
}
```

V1 的实现可以是：

- `LocalMetadataRetriever`
- `Bm25Retriever`
- `ContextRuleRetriever`

后期新增：

- `GraphRetriever`
- `HybridRetriever`

这样 runtime 不需要知道底层是本地 JSON 索引，还是图数据库。

### 11.2 重排序接口抽象

统一定义：

```ts
type SkillReranker = {
  rerank(
    ctx: RetrievalContext,
    candidates: CandidateSkill[],
  ): Promise<CandidateSkill[]>
}
```

V1 可用本地线性权重。

后期可替换成：

- 图谱边权加权
- 使用效果分数
- 用户反馈分数
- 部门偏好权重

### 11.3 图谱数据库进入后新增的特征

后期 `GraphRetriever` / `GraphReranker` 需要读取以下图谱信息：

- `Department -> preferred -> Skill`
- `Scene -> successful_with -> Skill`
- `Skill -> related_to -> Skill`
- `Project -> frequently_uses -> Skill`
- `SkillVersion -> supersedes -> SkillVersion`

这会直接进入重排序特征：

- `departmentPreferenceScore`
- `sceneSuccessScore`
- `projectAffinityScore`
- `relatedSkillBoost`
- `versionPreferenceScore`

## 12. 版本更新设计

Skill 不是静态资产，检索层必须考虑版本演进。

### 12.1 V1 版本标识

当前最小 schema 里已有：

- `skillId`
- `version`
- `sourceHash`

这已经足够做版本化索引。

### 12.2 索引侧原则

索引应区分：

- `Skill`
  稳定 identity
- `SkillVersion`
  某个时间点的具体版本

默认检索只暴露每个 `skillId` 的当前激活版本。

但在图谱和事件层要保留版本信息，这样后期可以回答：

- 某个部门偏好的到底是哪一版 Skill
- 新版本上线后效果是否变好

## 13. 推荐实现阶段

### 13.1 Phase 1

完成以下最小闭环：

- 基于 `skills-flat/` 生成本地 Skill 索引
- 实现 turn-0 检索
- 实现 inter-turn 异步 prefetch
- 实现本地线性重排序
- 注入 `skill_discovery` top-k
- 终端 UI 展示当前注入 Skill 列表

### 13.2 Phase 2

- 增加用户显式选择入口
- 增加检索 telemetry
- 增加 selection / invocation 事件
- 加入 transcript replay 和离线评测

### 13.3 Phase 3

- 接入图谱数据库
- 用图谱边权替代部分本地规则与线性权重
- 加入部门偏好和场景成功率的排序信号

## 14. 工程改造落点

为了保证方案可直接落地，建议按下面的代码边界实施。

### 14.1 检索开关与入口

- `src/services/skillSearch/featureCheck.ts`
  控制 Skill Search 是否开启。
- `src/utils/attachments.ts`
  负责 turn-0 检索触发，以及生成 `skill_discovery` attachment。
- `src/query.ts`
  负责 inter-turn 异步 prefetch 和注入时机。

### 14.2 本地召回与重排序

- `src/services/skillSearch/localSearch.ts`
  实现本地索引召回、BM25/关键词召回、规则召回。
- `src/services/skillSearch/prefetch.ts`
  实现 `getTurnZeroSkillDiscovery()`、`startSkillDiscoveryPrefetch()`、`collectSkillDiscoveryPrefetch()`。
- 可新增：
  - `src/services/skillSearch/indexStore.ts`
    负责加载和缓存本地 Skill 索引。
  - `src/services/skillSearch/rerank.ts`
    负责候选合并和线性重排序。

### 14.3 注入与完整加载

- `src/utils/messages.ts`
  负责把 `skill_discovery` attachment 转成模型可见的 reminder 文本。
- `src/tools/SkillTool/SkillTool.ts`
  负责在模型或用户选中 Skill 后加载完整内容。
- `src/commands.ts`
  保留 bundled + MCP 小静态列表；项目级 Skill 不再作为全量注入主路径。

### 14.4 用户可见与手动选择

- `src/components/InjectedSkillsPanel.tsx`
  展示当前会话注入的 Skill 列表。
- `src/screens/REPL.tsx`
  将注入列表面板接入主 REPL。
- 后续可新增：
  - `src/commands/use-skill/`
    显式手动选择 Skill
  - `src/components/skills/`
    增强查看与选择交互

### 14.5 索引与数据源

- `skills-flat/`
  当前治理后的 Skill 唯一源。
- 可新增：
  - `indexes/skills/manifest.json`
  - `indexes/skills/bm25.json`
  - `indexes/skills/graph-seed.json`

这些索引文件由离线脚本生成，runtime 只读不写。

## 15. 最终结论

本项目不应继续采用“项目级 Skill 全量注入”的设计，而应切换为：

- `bundled + MCP` 小静态列表
- `项目级 Skill` 按需检索
- `top-k 摘要卡片` 注入
- `按需全文加载`
- `用户可见并可选择`
- `后续用图谱数据库接管召回与重排序`

这条路线的优点是：

1. 当前就能落地，不依赖图谱数据库先完成。
2. 与现有 Claude Code 的 `skill_discovery` attachment 机制兼容。
3. 后期图谱数据库上线时，只需要替换检索器和重排序器，不需要重做 runtime 注入链路。
