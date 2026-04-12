# 基于 Claude Code 的多 Skill Coding Agent PRD

> 目标：基于 Claude Code 已有的 Skill、Agent、Permission、Sandbox、Hook、MCP 和多 agent 协作能力，构建适合团队使用的多 Skill Coding Agent，而不是从零重写一套新的 agent runtime。

---

## 1. 背景

当前 Claude Code 已经具备以下基础能力：

- Skill 可以以 `SKILL.md` 形式沉淀，并声明 `allowed-tools`、`context: fork`、`agent`、`paths` 等元信息。
- Agent 可以预加载多个 Skill，并在独立上下文中执行。
- Permission、Sandbox、Hook、MCP 已形成较完整的工具治理框架。
- 系统已支持多 agent / teammate 协作。
- `CLAUDE.md`、`CLAUDE.local.md`、`.claude/rules/*.md`、`MEMORY.md` 已形成“文件即上下文”的注入模型。

但对于团队场景，仍缺少四类关键能力：

1. 组织化治理：系统不知道“谁在用、属于哪个团队、在什么项目里、拥有哪些能力边界”。
2. Skill 生命周期治理：缺少团队 Skill 的注册、审核、评分、发布和淘汰机制。
3. 面向场景的 Skill 选择：缺少根据身份、项目、业务场景动态选择最合适 Skill 的能力。
4. 可验证的测评体系：缺少判断“这个 Skill 值不值得继续推荐和发布”的统一评估机制。

因此，需要在现有 Claude Code 基础上补齐一层“团队控制面”，把个人 agent 升级为团队可治理的 coding agent。

---

## 2. 产品目标

### 2.1 总体目标

构建一套团队版多 Skill Coding Agent，使其具备以下能力：

- 根据用户身份、团队、项目和场景动态选择合适 Skill。
- 在不牺牲安全性的前提下，把团队经验沉淀为可复用 Skill 资产。
- 支持多 agent / 多 Skill 协作完成复杂研发任务。
- 对 Skill 的使用效果进行反馈闭环和持续优化。
- 通过测评体系把“可用 Skill”升级为“可信 Skill”。

### 2.2 业务目标

- 降低团队内重复 prompt 和重复操作的成本。
- 提高新成员在特定项目中的上手速度。
- 让团队规范、流程、脚手架、代码审查习惯可以被 agent 稳定执行。
- 在企业安全边界内开放更强的自动化能力。

### 2.3 成功标准

- 团队高频研发流程中，30% 以上可被 Skill 化复用。
- 多 Skill Agent 在重点项目中的任务完成效率明显优于无 Skill 基线。
- 高风险工具调用全部纳入团队权限治理和审计。
- Skill 选择结果具备可解释性，且用户可对效果进行显式反馈。
- 团队 Skill 的上线、降权、废弃具备明确测评门槛。

### 2.4 项目拆分

本项目应明确拆成两个相互配合、但可以独立推进的子项目：

1. 改版的 Claude Code
   - 目标是把当前 Claude Code 改造成具备身份感知、Skill top-k 选择、权限编译和多 Skill 协作能力的 runtime。
   - 它回答的是“怎么跑”。
2. 独立的评测系统
   - 目标是持续衡量 Skill 检索效果和使用 Skill 后的任务质量，并和其他检索方式做对比。
   - 它回答的是“跑得好不好，是否优于其他方案”。

两者关系：

- 改版的 Claude Code 产生执行链路和埋点数据。
- 评测系统消费这些数据，产出分数、回归结论和方案对比结果。
- 评测系统的输出再反向驱动 Claude Code 的 selector 和 Skill 治理策略。

建议文档拆分如下：

- 总览 PRD：`docs/基于cc的多skill coding agent架构设计.md`
- runtime 子文档：`docs/Claude Code 改造方案.md`
- evaluation 子文档：`docs/Skill 检索与质量评测系统方案.md`

---

## 3. 非目标

本项目当前阶段不做以下事情：

- 不重写 Claude Code 的 query loop、tool runtime、sandbox runtime。
- 不把所有团队知识都做成 Skill；静态规范和长期知识仍可继续放在 `CLAUDE.md` / memory 中。
- 不在 V1 直接开放“任意员工上传任意可执行 Skill 并全员可见”。
- 不在 V1 追求复杂的在线学习排序系统。
- 不把项目目录里的身份 md 视为真正的企业身份认证凭证；它只是在 V1 中作为“可切换的身份上下文输入”。

---

## 4. 目标用户

### 4.1 直接用户

- 前端、后端、客户端、测试、SRE、数据工程等研发角色
- Tech Lead / Reviewer
- 平台工程和安全治理团队

### 4.2 管理用户

- 团队管理员
- 项目负责人
- 安全与合规管理员
- Skill 维护者 / Reviewer

---

## 5. 核心问题定义

### 5.1 当前个人版 Skill 的问题

- Skill 更像本地或项目级 prompt 资产，缺少团队级治理。
- Skill 数量变多后，模型难以稳定选择最合适 Skill。
- Skill 的效果反馈主要停留在使用者个人感知，难以形成团队资产评价体系。
- 权限控制偏工具和路径规则，缺少组织身份语义。
- 缺少发布前测评和发布后持续评估机制。

### 5.2 团队版要解决的核心问题

1. 如何让系统知道“谁可以用什么 Skill、在哪些场景下使用”。
2. 如何让 Skill 从“个人 prompt”升级为“团队资产”。
3. 如何保证 Skill 不会变成权限放大器。
4. 如何让多 Skill / 多 Agent 组合执行时仍然可控、可追踪、可审计。
5. 如何证明“这个 Skill 的推荐和发布是合理的”，而不是依赖主观印象。

---

## 6. 产品原则

### 6.1 基于现有能力演进

优先复用 Claude Code 已有的：

- Skill 格式和加载机制
- Agent 机制
- Permission / Sandbox / Hook / MCP
- `CLAUDE.md` / `CLAUDE.local.md` / memory 文件上下文机制
- 多 agent 协作能力

### 6.2 默认安全

- Skill 不是普通知识条目，而是可执行资产。
- 任何团队级 Skill 发布都必须经过审核、限制权限、保留审计。
- 团队策略优先于个人偏好和本地 allow 规则。
- 身份 md 可以驱动上下文和策略，但不能单独作为强认证依据。

### 6.3 先做可解释的选择，再做复杂推荐

V1 优先做“基于元数据过滤 + 简单评分排序”的可解释方案。  
V2 再做反馈图谱、离线评分、评测集和回放。  
V3 再考虑图谱数据库、跨仓库统一推荐和更复杂的策略编排。

### 6.4 分层治理

- 个人草稿 Skill
- 项目 Skill
- 团队 Skill
- 平台托管 Skill

不同层级拥有不同的可见性、审核要求和默认信任级别。

### 6.5 本地优先，平台增强

V1 必须允许用户在本地项目目录中通过 md 文件切换身份，不依赖重服务。  
服务端能力用于治理、审计、评分和跨仓共享，而不是替代本地 runtime。

### 6.6 Runtime 与 Evaluation 解耦

Claude Code runtime 和评测系统必须解耦建设：

- runtime 负责真实执行，不应被复杂评测逻辑拖慢主链路。
- evaluation 负责对比实验、离线回放、统一判分和跨方案比较。
- 任何新的检索策略，都应先在评测系统中验证，再灰度进入 runtime。

---

## 7. 核心概念

### 7.1 Identity Profile

用于描述当前操作者身份和执行边界：

- userId
- orgId
- departmentId
- teamId
- role
- title / seniority
- projectId
- repoId
- approvalTier
- defaultWorkspacePaths
- policyBundle

### 7.2 Identity MD

用于存储当前身份信息的 markdown 文件，是 V1 的核心输入形式。

建议采用两层设计：

1. 用户可维护多个身份文件，例如：
   - `.claude/identities/frontend-engineer.md`
   - `.claude/identities/reviewer.md`
   - `.claude/identities/release-owner.md`
2. 会话只读取一个活动身份文件，例如：
   - `.claude/identity/active.md`
   - 或 `CLAUDE.local.md` 中通过 `@.claude/identity/active.md` 引入

切换身份时，用户只需替换活动 md 文件或修改 import 指向。

Identity MD 应同时包含：

- 结构化 frontmatter：供策略编译和 Skill 过滤使用
- 自然语言正文：供模型理解“这个身份的职责、目标、禁区、偏好”

### 7.3 User Profile

`Identity MD` 解析后会被编译为运行时 `UserProfile`，再进一步编译为：

- Skill 可见范围
- 工具权限规则
- 路径权限规则
- 审批要求
- 默认 agent / 默认 Skill 偏好

### 7.4 Skill

可被 agent 调用的能力单元，包含：

- Skill 正文
- Skill 元数据
- 允许工具范围
- 适用场景
- 所属层级
- 发布状态
- 信任级别
- 测评和评分结果

### 7.5 Skill Metadata

用于检索和排序，不直接等于 Skill 正文，建议至少包含：

- name
- description
- owner
- source：personal / project / team / platform / plugin / managed
- scope：personal / project / team / platform
- domain：frontend / backend / mobile / infra / data 等
- scene：debug / review / refactor / release / incident / test 等
- projectTags
- roleTags
- requiredTools
- requiredPaths
- reviewState：draft / review / active / deprecated / blocked
- trustLevel：draft / reviewed / signed
- benchmarkSetId

### 7.6 Agent Profile

用于描述某类 agent 的默认行为：

- agentType
- 默认 system prompt
- 默认 skills
- 允许或禁止工具
- 适用任务类型
- 默认场景标签

### 7.7 Skill Registry

用于管理团队 Skill 的注册、审核、索引、评分和发布。

### 7.8 Skill Score

衡量某个 Skill 在特定场景下是否值得优先推荐的评分。  
它不是单一全局分，而是按角色、项目、场景分桶的快照。

### 7.9 Skill Evaluation

对 Skill 进行验证和测评的体系，至少包含三类：

- 发布前静态检查：元数据完整性、危险命令、权限 lint
- 离线评测：benchmark case、transcript replay、回归测试
- 线上评估：曝光、触发、成功、失败、用户反馈、纠偏成本

---

## 8. 目标方案概览

系统分为七层：

1. 身份层：识别当前用户、团队、项目、仓库和活动身份 md。
2. 策略层：把身份和项目策略编译成工具、路径、网络和 Skill 使用规则。
3. Skill 资产层：管理团队 Skill 的正文、元数据、状态和发布。
4. 选择层：根据场景过滤并排序候选 Skill，输出 top-k 和推荐理由。
5. 执行层：复用 Claude Code 的 Skill / Agent / Tool Runtime 执行。
6. 评估层：收集显式和隐式反馈，执行 benchmark / replay，生成分数快照。
7. 服务层：提供 Registry、事件采集、评分计算、图谱查询和策略分发。

一句话概括：

`Identity MD -> UserProfile -> Policy Rules + Skill Candidate Pool -> Top-k Selection -> Runtime Execution -> Telemetry + Evaluation -> Score Snapshot`

模型分工建议：

- 执行侧模型与评测侧模型分离，避免“会写代码的模型”和“会打分的模型”耦合在同一链路里。
- 写代码、调用 Skill、驱动多 agent 协作的主执行模型可以优先使用 `MiniMax`。
- benchmark 评测、transcript replay 判定、评分解释和失败归因的评测模型可以优先使用 `DeepSeek`。

---

## 9. 功能范围

### 9.1 V1：团队多 Skill Agent MVP

V1 聚焦“可用、可控、可解释”，不追求复杂推荐。

### 9.1.1 身份接入与 Identity MD

V1 允许使用项目目录中的 md 文件作为活动身份输入。

推荐目录结构：

```text
.claude/
  identity/
    active.md
  identities/
    frontend-engineer.md
    reviewer.md
    release-owner.md
```

为了兼容当前 Claude Code 的上下文注入方式，V1 推荐两种落地方式：

- 兼容方案：`CLAUDE.local.md` 只保留一行 `@.claude/identity/active.md`
- 目标方案：改造 Claude Code，使其原生读取 `.claude/identity/active.md`

系统需要能够从该 md 中提取：

- 用户所在部门和团队
- 角色类型
- 所属项目 / 仓库
- 可操作目录范围
- 特定工具是否允许
- 该身份的职责、常见任务和禁区

这些信息最终会被编译成 Claude Code 可理解的权限规则，例如：

- `Bash(ssh:*)` deny
- `Edit(apps/web/**)` allow
- `Edit(services/payment/**)` ask 或 deny
- 特定 MCP server deny

### 9.1.2 团队 Skill Registry

提供一套团队 Skill 资产管理能力：

- 支持个人草稿 Skill 上传
- 支持团队 Skill 的 review 和发布
- 支持按团队、项目、角色、场景维护 Skill 元数据
- 支持启用、停用、废弃

V1 中，团队 Skill 不要求完全独立远程执行仓库，可以先基于：

- managed / project / plugin skill
- 外部 Skill Registry 元数据服务
- 本地或受控目录同步

### 9.1.3 Skill 分层

Skill 分为四层：

| 层级 | 说明 | 默认信任级别 |
|---|---|---|
| 个人草稿 | 个人实验和私有 Skill | 低 |
| 项目 Skill | 仓库内沉淀的项目流程 Skill | 中 |
| 团队 Skill | 经团队审核后共享的 Skill | 高 |
| 平台 Skill | 平台或安全团队发布的 Skill | 最高 |

### 9.1.4 Skill 元数据与分类

V1 不强依赖“深层目录树分类”，而采用“元数据分类 + 展示分组”。

原因：

- 现有 Skill loader 更适合 `skill-name/SKILL.md` 的目录结构。
- 深层目录树不利于统一索引、跨项目复用和后续检索。
- 元数据分类更适合做筛选、排序和多标签展示。

建议分类维度：

- 组织维度：部门 / 团队
- 角色维度：前端 / 后端 / SRE / QA / Reviewer
- 业务维度：支付 / 风控 / 增长 / 基础设施
- 场景维度：编码 / 调试 / 审查 / 发布 / 巡检 / 修复事故
- 路径维度：`apps/web/**`、`services/payment/**`

### 9.1.5 Skill 选择引擎

V1 的 Skill 选择策略：

1. 根据当前身份、项目、路径和任务场景生成候选池。
2. 过滤掉状态不合法、权限不兼容、信任级别不足的 Skill。
3. 根据多维信号进行排序。
4. 输出 top-k Skill 给主 agent 或指定 worker agent。
5. 给出推荐理由，支持审计与解释。

候选过滤建议包含：

- 只保留 `active` 状态 Skill
- 只保留当前身份可见范围内的 Skill
- `requiredTools` 必须落在有效权限内
- `requiredPaths` 与当前工作路径或用户意图相关
- `roleTags`、`projectTags`、`sceneTags` 至少命中其一

V1 的排序信号建议包括：

- 场景匹配度
- 项目匹配度
- 角色匹配度
- 路径匹配度
- 信任级别
- 最近使用频率
- 最近显式反馈得分

建议初始评分公式：

```text
score =
  0.30 * sceneMatch +
  0.20 * projectMatch +
  0.15 * roleMatch +
  0.10 * pathMatch +
  0.10 * trustScore +
  0.10 * usageScore +
  0.05 * feedbackScore
```

输出形式建议：

- 主 agent 默认暴露 top 8 到 top 12 个 Skill
- 专用 worker agent 默认暴露 top 3 到 top 5 个 Skill
- bundled 核心 Skill 可作为保底能力保留

特殊规则：

- 如果用户显式点名某个 Skill，则跳过排序，但不能跳过权限检查和状态检查。
- 如果没有高置信候选，则回退到通用 Skill 集，而不是把全量长尾 Skill 全部暴露给模型。

### 9.1.6 Agent 与 Skill 组合

V1 支持两种组合方式：

- 主 agent 动态调用多个 Skill
- 专用 agent 预加载一组 Skill 执行特定任务

示例：

- `frontend-dev` agent 预加载 `react-debug`、`ui-review`、`test-fix`
- `release-assistant` agent 预加载 `changelog`、`commit-push-pr`、`verify`

### 9.1.7 安全边界

V1 必须明确以下约束：

- Skill 不能突破用户基础权限。
- Skill 声明的 `allowed-tools` 仅能在“用户基础权限 ∩ 团队策略 ∩ Skill 声明权限”范围内生效。
- 团队 Skill 发布必须经过审核。
- 高风险 Skill 默认不能直接由普通成员上传后全员使用。
- 活动身份 md 只能决定“以何种上下文和策略运行”，不能替代真正的企业认证。

### 9.1.8 可观测与审计

至少记录以下事件：

- 哪个身份在什么项目中使用了哪个 Skill
- Skill 是主动被模型调用还是用户显式触发
- Skill 调用了哪些关键工具
- 是否触发权限拦截或审批
- 推荐列表里有哪些候选，最终为何选择某个 Skill
- 结果是否被用户认可

---

### 9.2 V2：选择闭环与测评系统

V2 在 V1 基础上补齐 Skill 效果治理。

### 9.2.1 显式反馈

提供最小可用反馈入口：

- 好 / 一般 / 差
- 是否还会再次使用
- 可选备注

### 9.2.2 隐式反馈

可使用以下信号作为辅助：

- Skill 调用后是否被中断
- 调用后是否迅速改用其他 Skill 或手工操作
- 是否出现大量纠偏对话
- 是否触发权限拒绝或运行失败
- 是否被同角色用户持续复用

### 9.2.3 在线选择评估

不仅记录“调用了哪个 Skill”，还要记录“推荐过哪些 Skill”。

核心事件：

- exposure：哪些 Skill 被纳入 top-k
- selection：最终被选中的 Skill
- invocation：Skill 是否真的执行
- completion：Skill 执行是否成功
- override：用户是否手动改选
- abandonment：Skill 是否被快速放弃

由此可以计算：

- precision@k
- top-1 命中率
- 用户手动覆盖率
- 推荐后实际调用率
- 选择 regret 指标

### 9.2.4 离线评测集

需要为关键场景建立 benchmark case，例如：

- React 调试
- PR review
- 发布流程
- 故障排查
- 测试修复

每个 case 至少包含：

- 输入任务
- 运行上下文或 fixture repo
- 期望命中的 Skill 或 Skill 集
- 禁止工具和禁止路径
- 期望输出或通过条件

### 9.2.5 Transcript Replay 与 Shadow Ranking

对历史真实对话做两类验证：

- replay：使用离线记录的任务重放选择流程，看新排序是否优于旧排序
- shadow ranking：线上继续按旧逻辑执行，但后台计算新逻辑 top-k，用于无风险比较

### 9.2.6 Skill 使用图谱

V2 建立最小版 Skill 使用图谱，记录：

- 用户身份维度
- 团队与项目维度
- 业务和场景维度
- Skill 使用结果
- 反馈和后续行为

该图谱先服务于分析和评分，不要求 V2 初期就强依赖独立图数据库。

### 9.2.7 离线评分与发布门禁

通过定时任务对 Skill 进行离线评分更新：

- 统计使用量
- 统计显式反馈
- 统计失败率
- 统计二次纠偏率
- 统计 benchmark 通过率
- 按场景输出分数快照

并支持：

- 低分 Skill 降权
- 连续失败 Skill 自动进入 review
- benchmark 不达标 Skill 禁止发布为团队级 active

---

### 9.3 V3：中心化团队平台与图谱服务

V3 再考虑以下能力：

- 中心化 Skill Registry 服务
- 中心化 Policy / Profile 校验服务
- 多仓库统一推荐
- 图谱数据库驱动的关系查询
- Skill 评测集和自动回归流水线
- Skill 版本发布和签名

---

## 10. 详细需求

### 10.1 身份与 Identity MD 需求

#### 需求

- 系统必须支持从项目目录的 md 文件读取活动身份。
- 系统必须支持在一个项目内切换不同身份文件。
- 系统必须支持把 frontmatter 编译成 `UserProfile`。
- 系统必须支持把正文注入模型上下文。

#### 验收标准

- 替换活动身份 md 后，重新进入会话可看到不同的 Skill 候选。
- 同一个项目中，不同身份的工具权限和默认 Skill 集不同。
- V1 不依赖远程登录也能完成身份切换。

### 10.2 权限需求

#### 需求

- 支持按工具、路径、网络、MCP server、Skill 名称限制能力。
- 支持 deny / ask / allow / approval 语义。
- 团队策略优先于个人策略。
- Skill `allowed-tools` 必须参与最终交集计算。

#### 典型例子

- 普通员工不允许执行 `ssh`
- 前端角色默认不能修改后端目录
- 发布类 Skill 仅对 release owner 可见
- reviewer 身份可读全仓，但对生产脚本只读不写

### 10.3 Skill 资产需求

#### 需求

- 支持 Skill 草稿、审核、发布、停用、废弃状态。
- 支持 Skill 元数据编辑。
- 支持团队和项目级别的可见性控制。
- 支持 Skill 版本和 benchmarkSet 关联。

#### 验收标准

- 草稿 Skill 默认仅作者可见。
- 团队 Skill 发布后，团队成员可被检索到。
- 停用或废弃的 Skill 不再进入默认推荐结果。
- benchmark 不通过的 Skill 不能升级为团队 active。

### 10.4 Skill 选择需求

#### 需求

- 支持基于身份、项目、角色、场景、路径过滤 Skill。
- 支持输出 top-k 候选 Skill。
- 支持解释“为什么推荐该 Skill”。
- 支持记录 exposure、selection 和 override。

#### 验收标准

- 进入不同项目时，推荐候选发生变化。
- 前端场景不会默认推荐后端专用 Skill。
- 推荐结果可展示命中原因，如“匹配当前项目标签”和“同团队高评分”。
- 用户显式指定 Skill 时，仍然会进行状态和权限校验。

### 10.5 Skill 测评需求

#### 需求

- 支持显式反馈采集。
- 支持隐式行为信号采集。
- 支持 benchmark case 管理和回放。
- 支持离线任务更新 Skill Score。
- 支持将测评结果作为发布门禁。

#### 验收标准

- 用户完成一次 Skill 执行后可提交反馈。
- 新 Skill 可以绑定 benchmarkSet 并执行评测。
- Skill 分数能被后续推荐逻辑读取。
- 明显低分 Skill 会被降权或回退到 review 状态。

### 10.6 多 Agent 协作需求

#### 需求

- 支持主 agent 把任务分派给具备不同 Skill 的 worker agent。
- 支持 agent profile 预加载 Skill。
- 支持在多 agent 场景下继承统一权限边界。
- 支持为不同 worker 注入不同 top-k Skill 集。

#### 验收标准

- 主 agent 可根据任务类型调起不同 worker。
- worker 只能在各自允许的权限范围内执行。
- Skill 调用链和工具调用链可被追踪。

### 10.7 配套服务需求

#### 需求

- 支持 Skill 元数据和状态的中心化管理。
- 支持事件采集和离线评分。
- 支持按关系查询用户、项目、场景与 Skill 的关联。
- 支持将评分结果回灌到本地选择逻辑。

#### 验收标准

- 本地 selector 可以消费服务端下发的 score snapshot。
- 团队管理员可以查询某个 Skill 在哪些项目里表现差。
- 平台可以基于事件数据生成周级评分快照。

---

## 11. 产品流程

### 11.1 身份切换与会话初始化

1. 解析活动身份文件，优先读取 `.claude/identity/active.md`，兼容 `CLAUDE.local.md` 的 import 方案。
2. 将 frontmatter 编译为 `UserProfile`。
3. 加载团队策略和项目策略。
4. 编译得到有效权限规则。
5. 加载当前项目可见的 Skill 集合。
6. 结合身份、项目、路径和场景生成候选 Skill 列表。
7. 将候选 Skill 和简短推荐理由暴露给主 agent 或指定 agent。

### 11.2 Skill 选择流程

1. 根据用户请求识别任务场景。
2. 在候选 Skill 集合中过滤出匹配项。
3. 按评分和上下文匹配度排序。
4. 选出 top-k Skill 供模型调用。
5. 调用前再次检查权限和信任级别。
6. 记录 exposure 和 final selection。

### 11.3 Skill 执行流程

1. 读取 Skill 元数据和正文。
2. 解析 Skill 声明的工具需求和执行方式。
3. 计算最终有效权限。
4. 在主上下文或 forked agent 中执行。
5. 记录 Skill 使用和工具调用事件。

### 11.4 反馈与评分流程

1. 收集显式反馈和隐式行为信号。
2. 写入 `SkillUsageEvent`。
3. 离线任务计算新的 `SkillScoreSnapshot`。
4. 更新下一轮推荐排序。

### 11.5 Skill 发布与测评流程

1. 作者提交或上传 Skill 草稿。
2. 系统执行静态 lint 和危险能力扫描。
3. 运行 benchmarkSet 和基础回归。
4. Reviewer 审核通过后，将状态升级为 `active`。
5. 上线后持续记录线上效果。
6. 分数持续下降或 benchmark 回归失败时，自动降级为 `review` 或 `deprecated`。

---

## 12. 数据模型建议

### 12.1 Identity MD

```yaml
---
user_id: u_123
org_id: org_001
department_id: frontend
team_id: growth-web
role: frontend-engineer
title: senior
project_id: console-web
approval_tier: normal
default_paths:
  - apps/web/**
skill_tags:
  - react
  - ui
deny_tools:
  - Bash(ssh:*)
ask_tools:
  - Edit(services/payment/**)
policy_bundle: growth-web-default
---

你当前以“增长前端工程师”身份工作。
主要职责是维护 console-web、活动页和埋点链路。
禁止绕过发布流程直接操作生产资产。
遇到跨域后端改动时，优先产出 review 建议而不是直接修改。
```

### 12.2 UserProfile

```json
{
  "userId": "u_123",
  "orgId": "org_001",
  "departmentId": "frontend",
  "teamId": "growth-web",
  "role": "frontend-engineer",
  "title": "senior",
  "projectId": "console-web",
  "approvalTier": "normal",
  "defaultWorkspacePaths": ["apps/web/**"],
  "policyBundle": "growth-web-default"
}
```

### 12.3 SkillMeta

```json
{
  "skillId": "frontend/react-debug",
  "name": "react-debug",
  "scope": "team",
  "owner": "frontend-platform",
  "roleTags": ["frontend"],
  "sceneTags": ["debug", "fix"],
  "projectTags": ["console-web"],
  "pathTags": ["apps/web/**"],
  "status": "active",
  "trustLevel": "reviewed",
  "reviewState": "active",
  "benchmarkSetId": "bm_react_debug_v1",
  "requiredTools": ["Read", "Edit", "Bash(npm test:*)"]
}
```

### 12.4 SkillSelectionTrace

```json
{
  "traceId": "sel_001",
  "userId": "u_123",
  "projectId": "console-web",
  "scene": "debug",
  "topK": [
    {
      "skillId": "frontend/react-debug",
      "score": 0.87,
      "reasons": ["scene_match", "project_match", "reviewed_skill"]
    }
  ],
  "selectedSkillId": "frontend/react-debug",
  "selectionMode": "auto"
}
```

### 12.5 SkillUsageEvent

```json
{
  "eventId": "evt_001",
  "traceId": "sel_001",
  "userId": "u_123",
  "projectId": "console-web",
  "scene": "debug",
  "skillId": "frontend/react-debug",
  "result": "success",
  "feedback": "good",
  "correctionTurns": 1,
  "timestamp": 1710000000
}
```

### 12.6 SkillBenchmarkCase

```json
{
  "benchmarkCaseId": "case_react_debug_01",
  "benchmarkSetId": "bm_react_debug_v1",
  "scene": "debug",
  "task": "修复 React 页面首次渲染白屏",
  "expectedSkills": ["frontend/react-debug"],
  "forbiddenTools": ["Bash(ssh:*)"],
  "passCriteria": ["select_expected_skill", "no_forbidden_tool", "task_completed"]
}
```

### 12.7 SkillScoreSnapshot

```json
{
  "skillId": "frontend/react-debug",
  "scene": "debug",
  "role": "frontend-engineer",
  "projectId": "console-web",
  "onlineScore": 0.82,
  "benchmarkScore": 0.91,
  "finalScore": 0.87,
  "version": "2026-04-10"
}
```

### 12.8 Graph Edge

```json
{
  "from": "user:u_123",
  "to": "skill:frontend/react-debug",
  "type": "USED_IN",
  "props": {
    "projectId": "console-web",
    "scene": "debug",
    "success": true,
    "timestamp": 1710000000
  }
}
```

---

## 13. Claude Code 改造方案

### 13.1 总体原则

改造目标不是重写 Claude Code，而是在现有代码结构上增加四个能力：

- 身份文件加载
- Skill 元数据索引
- top-k 选择
- 选择与执行埋点

### 13.2 指令与上下文层改造

建议改造点：

- `src/utils/claudemd.ts`
  - 新增 `.claude/identity/active.md` 的发现和加载逻辑。
  - 或在 V1 先沿用 `CLAUDE.local.md -> @identity-file` 的兼容方案。
- `src/context.ts`
  - 在 `getUserContext()` 中加入身份 md 的解析结果。
  - 将身份正文作为上下文注入，将结构化字段缓存为运行时 profile。
- `src/utils/attachments.ts`
  - 把身份文件也作为可审计的指令附件进行追踪。

目标结果：

- Claude Code 启动时不只读 `CLAUDE.md`，还会读“当前身份”。
- 会话里能区分“团队公共规则”和“当前身份上下文”。

### 13.3 Skill 元数据层改造

建议改造点：

- `src/skills/loadSkillsDir.ts`
  - 扩展 Skill frontmatter，支持 `roleTags`、`sceneTags`、`projectTags`、`pathTags`、`trustLevel`、`reviewState`、`benchmarkSetId`、`owner` 等字段。
  - 保持向后兼容，旧 Skill 无这些字段时走默认值。

目标结果：

- Skill 不再只是正文和 `allowed-tools`，而是可以被索引和排序的结构化资产。

### 13.4 Skill 选择层改造

建议改造点：

- `src/services/skillSearch/localSearch.ts`
  - 从空实现改为真正的本地候选过滤和排序。
- `src/services/skillSearch/prefetch.ts`
  - 预构建本地 Skill 索引，减少每轮选择成本。
- 新增 `skill selection` 运行时结构
  - 输入：`UserProfile + task scene + path context + loaded skills`
  - 输出：`topK + reasons + confidence`

目标结果：

- Claude Code 从“全量列举 Skill 给模型”升级为“先筛选再暴露”。

### 13.5 Skill Tool 暴露方式改造

建议改造点：

- `src/tools/SkillTool/prompt.ts`
  - 从当前“所有命令都纳入 prompt，描述裁剪”的方式，调整为“默认只暴露 top-k + 核心 bundled Skill”。
  - 保留显式用户点名 Skill 的直达路径。

目标结果：

- 减少上下文噪音。
- 降低模型在长尾 Skill 间误选的概率。

### 13.6 权限编译改造

建议改造点：

- 新增 `IdentityProfile -> PermissionRules` 编译模块。
- 结合以下现有模块完成编译和校验：
  - `src/utils/permissions/permissionRuleParser.ts`
  - `src/utils/settings/permissionValidation.ts`
  - `src/utils/sandbox/sandbox-adapter.ts`
  - `src/Tool.ts`

关键规则：

- 最终权限 = 用户基础权限 ∩ 项目/团队策略 ∩ Skill `allowed-tools`
- 身份 md 产生的是规则输入，不是直接绕过底层校验的超级权限

### 13.7 Agent 改造

建议改造点：

- `src/tools/AgentTool/loadAgentsDir.ts`
  - 扩展 agent profile 对场景和默认 Skill 组的表达能力。
- `src/tools/AgentTool/runAgent.ts`
  - 在创建 subagent 时，注入当前 `UserProfile`、有效权限和缩小后的 Skill 集。

目标结果：

- 多 agent 场景下，worker 使用的 Skill 集不必与主 agent 完全相同。

### 13.8 埋点与测评改造

建议改造点：

- `src/utils/suggestions/skillUsageTracking.ts`
  - 从“只记录 usageCount + lastUsedAt”扩展到更细粒度事件。
- 新增埋点事件：
  - skill_exposed
  - skill_selected
  - skill_invoked
  - skill_completed
  - skill_failed
  - skill_overridden
  - skill_feedback_submitted

目标结果：

- 既能知道“用了什么”，也能知道“推荐了什么但没被选”。

### 13.9 兼容与灰度策略

建议通过 feature flag 分阶段接入：

- `identity_md_enabled`
- `local_skill_selector_enabled`
- `skill_eval_enabled`
- `graph_affinity_enabled`

兜底策略：

- selector 故障时回退到当前全量 Skill 暴露逻辑
- identity md 缺失时回退到默认 profile
- 服务端 score snapshot 不可用时仅使用本地元数据打分

---

## 14. 配套服务架构

### 14.1 服务分层

建议拆成五类服务：

1. Skill Registry Service
2. Policy / Profile Validation Service
3. Event Ingestion Service
4. Evaluation & Scoring Service
5. Graph Query Service

### 14.2 Skill Registry Service

职责：

- 管理 Skill 元数据、版本、审核状态、发布状态
- 记录 owner、reviewer、benchmarkSet 绑定关系
- 向客户端下发最新的元数据和 score snapshot

建议存储：

- Skill 正文：Git 仓库或对象存储
- Skill 元数据：Postgres

### 14.3 Policy / Profile Validation Service

V1 不是必选。

原因：

- 用户已经明确希望通过本地 md 文件切换身份。
- 这更适合本地体验、演示和灰度阶段。

但在团队化后建议增加一个轻量校验服务，用于：

- 校验 `Identity MD` frontmatter 格式
- 下发团队策略 bundle
- 校验身份 md 是否来自允许模板

注意：

- 如果没有签名或校验链，本地 md 只能视为“声明身份”，不能视为“可信认证身份”。

### 14.4 Event Ingestion 与 Evaluation Service

职责：

- 接收选择、执行、反馈事件
- 聚合形成日 / 周级分数快照
- 运行 benchmark、transcript replay、shadow ranking
- 产出推荐分和发布门禁结果

推荐输出：

- `SkillScoreSnapshot`
- `SkillHealthReport`
- `LowQualitySkillList`

### 14.5 图谱数据库规划

图谱数据库不是 V1 必需，但应在 PRD 中预留。

建议节点：

- User
- Team
- Project
- Repo
- Scene
- Skill
- Tool
- Path
- BenchmarkSet

建议边：

- `(:User)-[:BELONGS_TO]->(:Team)`
- `(:User)-[:USES]->(:Skill)`
- `(:Skill)-[:FOR_SCENE]->(:Scene)`
- `(:Skill)-[:REQUIRES_TOOL]->(:Tool)`
- `(:Skill)-[:MATCHES_PATH]->(:Path)`
- `(:Project)-[:USES_SKILL]->(:Skill)`
- `(:Skill)-[:EVALUATED_BY]->(:BenchmarkSet)`

图谱的主要用途：

- 查询某角色在某项目中最常成功的 Skill 组合
- 查询某个低分 Skill 的影响范围
- 支撑跨项目冷启动推荐
- 生成更强的推荐解释链路

### 14.6 存储选型建议

建议按阶段演进：

| 阶段 | 推荐方案 | 原因 |
|---|---|---|
| V1 | 本地文件 + Postgres | 成本最低，足够支撑元数据、事件和快照 |
| V2 | Postgres + Redis + 对象存储 | 支撑更稳定的评分和缓存 |
| V2.5 / V3 | 在 Postgres 旁路增加图谱数据库 | 仅当多跳关系查询和解释需求明显增长时引入 |

建议原则：

- Postgres 仍作为权威元数据源
- 图谱数据库更适合作为读侧加速层，而不是唯一真相源
- 不建议在 V1 直接把所有能力都压在图谱数据库上

### 14.7 模型分工建议

建议在 PRD 中明确“执行模型”和“评测模型”分离：

- 写代码模型：主 agent、worker agent、Skill 执行链路优先使用 `MiniMax`
- 评测模型：benchmark 判分、replay 审核、shadow ranking 分析、失败归因优先使用 `DeepSeek`

这样做的原因：

- 执行链路更关注代码生成、工具调用和多轮任务推进
- 评测链路更关注一致性判分、批量分析和成本控制
- 两条链路分离后，后续替换模型时对线上执行稳定性影响更小

工程要求：

- 模型选择必须做成配置项，而不是写死在代码里
- Agent runtime 读取执行模型配置
- Evaluation Service 读取评测模型配置
- benchmark 与线上推荐逻辑都要记录所用模型版本，便于回放和归因

---

## 15. 与当前 Claude Code 能力的对齐

### 15.1 可直接复用

- Skill frontmatter：`allowed-tools`、`context: fork`、`agent`、`paths`
- Agent frontmatter：`skills`、`tools`、`disallowedTools`、`permissionMode`
- Skill 动态发现和按路径激活
- Skill 在 fork agent 中执行
- 多 agent / teammate 执行能力
- 工具级和路径级权限规则
- Sandbox 和网络限制
- Hook 和 MCP 基础设施
- `CLAUDE.md` / `CLAUDE.local.md` / `.claude/rules/*.md` 的上下文注入机制

### 15.2 当前实现与目标方案的差异

| 方向 | 当前现状 | 本 PRD 目标 |
|---|---|---|
| Skill 选择 | 主要是列举 + 模型自行选择 | 增加身份和场景驱动的 top-k 过滤与排序 |
| Skill 检索 | `localSearch.ts` 仍为空实现 | 建立最小可用本地 selector |
| 权限模型 | 偏工具 / 路径规则 | 增加身份语义并编译成规则 |
| 身份输入 | 主要依赖 `CLAUDE.md` / `CLAUDE.local.md` 文本上下文 | 增加可切换的 Identity MD |
| Skill 反馈 | 有局部 usage 和 survey 能力 | 增加统一 Skill 选择和测评体系 |
| 服务化 | 以本地加载为主 | 增加 Registry、事件、评分和图谱服务 |

### 15.3 设计约束

以下约束需要在方案里明确：

- 当前 Skill 目录结构更适合扁平化 `skill-name/SKILL.md`，不适合深层树状目录作为主索引。
- 当前 Skill 的 `allowed-tools` 更接近“追加 allow”，团队版需要在策略层把它收敛为“交集权限”。
- 非 MCP Skill 可能包含内联 shell 执行能力，因此团队级公开 Skill 必须增加信任治理。
- 当前 Skill prompt 主要是“把所有 Skill 列给模型”，因此 top-k 选择必须改到 prompt 暴露之前。

---

## 16. 关键风险

### 16.1 Skill 成为权限放大器

风险：

- Skill 声明过宽的 `allowed-tools`
- Skill 间接获得超出用户基础权限的能力

缓解：

- 最终权限取交集
- 团队 Skill 必须审核
- 高风险 Skill 默认不开放自动发布

### 16.2 公共 Skill 库安全风险

风险：

- 上传的 Skill 可能包含恶意命令
- Skill 可能试图修改 settings / skills / hooks

缓解：

- 区分草稿和已审核 Skill
- 审核通过后才可团队可见
- 团队 Skill 默认限制高风险工具
- 团队 Skill 增加静态 lint 和 benchmark 门禁

### 16.3 Identity MD 被伪造或漂移

风险：

- 用户可手工修改身份 md，造成“身份声明”和真实身份不一致
- 老旧身份文件造成策略偏差

缓解：

- 在 PRD 中明确：V1 的身份 md 主要用于本地体验和灰度，不是强认证
- V2 增加模板校验、签名或服务端下发策略
- 会话启动时展示当前活动身份摘要，避免误用

### 16.4 检索和图谱复杂度过高

风险：

- 一开始就做复杂向量检索和图谱，会拖慢落地

缓解：

- V1 用规则过滤 + 简单排序
- V2 用事件和评测先做 score snapshot
- 图谱数据库后置到 V2.5 / V3

### 16.5 反馈噪声和测评失真

风险：

- 单次点赞/点踩不足以代表 Skill 质量
- benchmark 过于理想化，和真实使用脱节

缓解：

- 结合显式反馈和隐式信号
- 引入 replay 和 shadow ranking
- 采用按场景分桶的分数，而非全局单分数

---

## 17. 指标设计

### 17.1 北极星指标

- 团队任务中由 Skill 成功辅助完成的占比

### 17.2 过程指标

- 每周活跃 Skill 数
- 每周团队 Skill 使用次数
- top-k 推荐命中率
- Skill 推荐后实际调用率
- 用户手动覆盖率
- 高风险工具调用拦截率

### 17.3 质量指标

- Skill 调用后平均纠偏轮次
- Skill 执行失败率
- benchmark 通过率
- replay 胜率
- Skill 带来的平均时间节省

---

## 18. 里程碑规划

### Phase 1：本地优先 MVP

- 完成 Identity MD 接入
- 完成身份到权限规则的编译
- 完成 Skill 元数据扩展
- 完成本地 top-k 过滤与排序
- 完成团队 Skill 发布状态管理

### Phase 2：选择闭环与评分

- 完成显式反馈采集
- 完成 exposure / selection / result 埋点
- 完成 benchmarkSet 和 replay
- 完成离线评分任务
- 完成低分降权和推荐优化

### Phase 3：平台化与图谱增强

- 完成中心化 Skill Registry
- 完成事件与评分服务
- 完成图谱读侧查询能力
- 完成 Skill 版本发布与审核流水线

---

## 19. MVP 建议

为了尽快落地，建议 MVP 只做下面这些：

1. 身份输入先使用本地 md 文件，不先做企业级身份系统打通。
2. `CLAUDE.local.md -> @identity-file` 可作为第一阶段兼容实现。
3. Skill 分类先做元数据，不做深层目录树。
4. Skill 选择先做过滤 + 简单排序，不做向量检索。
5. 团队 Skill 先只开放给审核通过的受控来源。
6. 图谱数据库先做数据模型设计，不强行在 MVP 落库。
7. 测评先做 benchmark + replay，不先做复杂在线学习。

---

## 20. 开放问题

- 团队 Skill 的审核主体是谁，平台还是项目 owner？
- 团队 Skill 发布后，是否允许项目级覆盖？
- `Identity MD` 最终是走本地模板、签名文件，还是服务端下发？
- Skill Score 的权重如何在“线上效果”和“离线 benchmark”之间分配？
- 图谱数据库是否真的需要独立部署，还是 Postgres edge table 足够？
- 团队 Skill 是否必须禁止内联 shell，还是允许受控白名单？

---

## 21. 一句话总结

这个项目的本质不是“给 Claude Code 多加几个 Skill”，而是在现有 Skill、Agent 和文件上下文机制之上，加上一层团队治理、选择和测评能力，让 Skill 从个人 prompt 资产升级为团队可控、可复用、可评估的研发能力单元。
