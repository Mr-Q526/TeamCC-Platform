# Claude Code 改造方案

> 2026-04-12 更新：本文包含早期 `Identity MD` / `.claude/identity/active.md` 方案讨论。当前现行口径已经收敛为 `TeamCC Admin` 唯一身份源；下文相关表述仅保留历史背景，不能再视为实施要求。
>
> 本文只描述 Claude Code 本身的改造，不展开配套评测平台和图谱服务细节。评测结果、score snapshot 和关系查询服务仅作为外部依赖存在。

## 1. 方案目标

本方案要解决的是“怎么把 Claude Code 从个人/项目级工具，改造成支持团队身份、Skill 选择、权限编译和可观测埋点的 runtime”。

目标不是重写 Claude Code，而是在现有实现上增加一层团队控制面，主要包含：

- 身份上下文接入
- Skill 候选筛选与 top-k 暴露
- 身份/项目/Skill 权限交集编译
- Agent 预加载与多 agent 协作增强
- Skill 选择和执行埋点
- 灰度和回退机制

## 2. 当前代码基础

仓库里已经有可复用的底座，改造不需要从零开始。

### 2.1 上下文与记忆

- `src/utils/claudemd.ts` 已经负责加载 `CLAUDE.md`、`CLAUDE.local.md` 和 `.claude/rules/*.md`
- `src/context.ts` 负责把 git status、CLAUDE.md 等内容拼成会话上下文
- `src/memdir/*` 已经有 memory 类型、读取、拼接、提示词和 team memory 机制

### 2.2 Skill 和 Agent

- `src/skills/loadSkillsDir.ts` 支持 Skill frontmatter、paths、allowed-tools、agent、context: fork 等能力
- `src/tools/SkillTool/prompt.ts` 当前会把可用 Skill 作为列表暴露给模型
- `src/tools/AgentTool/loadAgentsDir.ts` 和 `src/tools/AgentTool/runAgent.ts` 支持 agent 预加载 skills

### 2.3 权限与沙箱

- `src/Tool.ts`、`src/utils/permissions/permissionRuleParser.ts`、`src/utils/settings/permissionValidation.ts` 已具备工具级和路径级权限语义
- `src/utils/sandbox/sandbox-adapter.ts` 负责把权限规则落到沙箱层

### 2.4 埋点与可观测

- `src/utils/suggestions/skillUsageTracking.ts` 已经有最基础的 skill usage 记录
- 现有实现还不足以支撑 selector 级别的曝光、选择、覆盖和结果埋点

### 2.5 现状结论

当前代码能支撑“加载 Skill、执行 Agent、做权限检查”，但还不能支撑“按身份和场景筛 Skill、编译出最终有效权限、记录选择链路并灰度切换”。

## 3. 改造目标

### 3.1 runtime 目标

- 让 Claude Code 在启动时识别当前活动身份
- 让主 agent 和 worker agent 只看到经过筛选的 Skill 集合
- 让 Skill 执行始终受到最终权限约束

### 3.2 上下文目标

- 支持项目目录里的 `Identity MD`
- 支持通过 `CLAUDE.local.md` 或项目内固定入口切换身份
- 让身份既能影响权限，也能影响 Skill 暴露和 agent 默认行为

### 3.3 selector 目标

- 先过滤，再排序，再暴露
- 默认只暴露 top-k Skill，不把长尾 Skill 全量丢给模型
- 显式点名 Skill 时可直达，但仍要过权限和状态检查

### 3.4 权限目标

- 最终权限采用交集策略
- 身份策略、项目策略、团队策略、Skill 声明权限共同生效
- 不允许 Skill 变成权限放大器

### 3.5 可观测目标

- 记录曝光、选择、调用、成功、失败、覆盖、反馈
- 让后续的评测系统能回放 Claude Code 的真实决策链路

## 4. 方案边界

本文不做以下内容：

- 不定义评测平台内部存储和图谱 schema
- 不定义离线 benchmark 任务编排
- 不定义服务端评分逻辑

本文只保留一条依赖关系：

- 评测系统和图谱服务作为外部依赖，接收本地埋点和 score snapshot，用于回放和对比。

## 5. 总体架构

改造后的 Claude Code runtime 可以拆成六层：

1. 身份层：读取活动身份 md，生成 `UserProfile`
2. 策略层：把身份和项目策略编译成权限规则
3. Skill 层：加载 Skill 元数据，形成候选池
4. Selector 层：按场景过滤并排序，输出 top-k
5. 执行层：主 agent / worker agent 执行 Skill
6. Telemetry 层：记录选择和执行轨迹

一句话就是：

`Identity MD -> UserProfile -> Policy Rules -> Skill Candidate Pool -> Top-k Selector -> Agent Runtime -> Telemetry`

## 6. 模块改造点

### 6.1 上下文加载

改造 `src/utils/claudemd.ts` 和 `src/context.ts`。

要做的事：

- 增加 TeamCC 身份 profile 的接入逻辑
- 不再允许 `.claude/identity/active.md` 作为正式身份入口
- 清理 `CLAUDE.local.md -> @identity-file` 一类历史兼容思路
- 把远端身份摘要注入系统上下文，并将结构化结果缓存为运行时 profile

结果要求：

- 同一个项目在不同 TeamCC 身份与项目授权下，后续会话能得到不同的权限和 Skill 候选

### 6.2 Skill 元数据与 selector

改造 `src/skills/loadSkillsDir.ts`、`src/services/skillSearch/localSearch.ts`、`src/services/skillSearch/prefetch.ts` 和 `src/tools/SkillTool/prompt.ts`。

要做的事：

- 扩展 Skill frontmatter，支持 `roleTags`、`sceneTags`、`projectTags`、`pathTags`、`trustLevel`、`reviewState`、`benchmarkSetId`
- 在本地构建 Skill index
- 先做候选过滤，再做排序，再做 top-k 暴露
- 让 SkillTool 默认只展示 top-k + 核心 bundled Skill

选择信号建议：

- 场景匹配度
- 项目匹配度
- 角色匹配度
- 路径匹配度
- 信任级别
- 最近使用频率
- 最近反馈分

### 6.3 权限编译

改造 `src/Tool.ts`、`src/utils/permissions/permissionRuleParser.ts`、`src/utils/settings/permissionValidation.ts`、`src/utils/sandbox/sandbox-adapter.ts`。

要做的事：

- 把 Identity MD 编译成权限输入
- 把项目策略、团队策略、Skill `allowed-tools` 统一编译成最终有效权限
- 维持现有 deny / ask / allow / approval 语义
- 对 Bash 前缀规则、文件 glob 规则、MCP server 规则继续沿用现有语义

最终规则：

- `effectivePermission = userBasePermission ∩ orgPolicy ∩ projectPolicy ∩ skillAllowedTools`

### 6.4 Agent 改造

改造 `src/tools/AgentTool/loadAgentsDir.ts` 和 `src/tools/AgentTool/runAgent.ts`。

要做的事：

- 让 agent profile 支持场景和默认 Skill 组
- 在创建 worker agent 时，注入当前身份、有效权限和缩小后的 Skill 集
- 让主 agent 和 worker agent 可以使用不同的候选池

结果要求：

- worker agent 只继承它需要的能力，不继承全量长尾 Skill

### 6.5 埋点改造

改造 `src/utils/suggestions/skillUsageTracking.ts`，并新增 selector 级与 tool 执行级的深层埋点。

建议事件：

- `skill_exposed`
- `skill_selected`
- `skill_invoked`
- `skill_completed`
- `skill_failed`
- `skill_overridden`
- `skill_feedback_submitted`
- **`tool_permission_decision`**: 记录 Tool 执行时的权限判定（如拦截 Deny、自动放行 Allow、触发询问 Ask）。
- **`tool_execution_audit`**: 记录最终执行的底层 Tool 信息（如调用了 `Bash(ssh user@server)` 或特定 MCP 接口）。

要求：

- 埋点要能串起“曝光 -> 选择 -> 执行 -> 反馈”的完整链路。
- 不只记录用了哪个 Skill，还要记录推荐过哪些 Skill 但没被选。
- **高危与联网 Tool 的强制溯源审计**：必须能通过埋点查到“哪个员工，在什么时间，由于自动放行或 **ask 提示后的人工批准**，连到了我的服务器（即精确下钻到底层工具的 usage 与流转状态）”。

### 6.6 灰度接入

建议通过 feature flag 做阶段发布：

- `identity_md_enabled`
- `local_skill_selector_enabled`
- `skill_eval_enabled`
- `graph_affinity_enabled`

回退策略：

- selector 故障时回退到现有全量 Skill 暴露逻辑
- 身份文件缺失时回退到默认 profile
- score snapshot 不可用时只使用本地元数据打分

## 7. 运行时流程

### 7.1 会话启动

1. 读取活动身份 md
2. 编译 `UserProfile`
3. 加载项目和团队策略
4. 编译有效权限
5. 加载 Skill 元数据
6. 生成候选池
7. 暴露 top-k Skill

### 7.2 选择与执行

1. 用户或模型触发任务
2. selector 根据场景筛选候选
3. 排序后输出 top-k
4. 主 agent 或 worker agent 执行 Skill
5. 执行时再次做权限校验

### 7.3 记录与回放

1. 记录 selector trace
2. 记录工具调用和执行结果
3. 记录显式反馈和覆盖行为
4. 将结果传给外部评测系统做回放和对比

## 8. 阶段规划

### Phase 1

- 身份 md 接入
- 权限编译接入
- 本地 Skill selector 接入
- top-k 暴露接入
- 基础埋点接入

### Phase 2

- 多 agent 候选池区分
- 更完整的 Skill selector
- 权限交集收敛
- selector trace 完整化

### Phase 3

- 灰度策略完善
- 回退策略完善
- 与外部评测系统的 score snapshot 对接

## 9. 关键风险

### 9.1 权限放大

Skill 的 `allowed-tools` 不能成为超权入口，最终必须按交集收敛。

### 9.2 身份漂移

本地 md 适合切换上下文，不适合当强认证。需要在文档里明确这一点。

### 9.3 selector 失真

如果候选池太大或排序信号太弱，模型还是会回到“自己选”。V1 必须坚持 top-k 暴露，而不是全量暴露。

### 9.4 灰度风险

新 selector 和旧 selector 要能随时切回，不能把启动链路锁死在新逻辑上。

## 10. 结论

Claude Code 的改造重点不是“多加几个 Skill”，而是把身份、权限、Skill 选择和执行链路做成可控 runtime。评测系统是另一条链路，本文只保留接口依赖，不展开实现。

## 11. 补充工程实现细节 (Phase 1 方案细化)

基于前期讨论，针对 Phase 1 阶段补充以下具体工程落地共识：

### 11.1 Identity MD 的结构定义与验证
Identity MD 作为鉴权引擎的核心输入，主要记录员工身份信息（包含部门、职位、级别等）。
除了单一的身份承托，它同时起着**“权限配置票据”**的关键作用。MD 的 Frontmatter 里面将明确下发并配置好该职工在其职级下允许的工具表以及限制调用的权限（如 `allowed-tools: [...]` 以及 `disallowed-tools: [...]`）。
除了承载元数据与这些具象权限，系统将在加载/读取时进行**强力锁定与状态检测**。包括但不限于：检查身份信息是否在近期发生变更、身份票据是否超时过期。一旦察觉上下文发生篡变，执行环境需立即阻拦后续动作。

### 11.2 基于"叠加 Deny"实现的类交集逻辑
Claude Code 原生的权限检查引擎由 `AllowRules`、`DenyRules`、`AskRules` 复合运行，目前并非完全抽象意义上的集合“交集”（∩），而是遵循“Deny 高于一切”的设计。
由于涉及到 glob 通配与复杂文件路径合并，直接进行规则表达式的逻辑相交成本极高。作为替代实现，架构将在合并与初始化 `ToolPermissionContext` 时，**把组织规则及限制策略直接翻译合并入 Deny 黑名单集合中**。任何超过基础身份上限的操作，利用黑名单截断（如：拦截实习生身份访问特定的敏感内网发版命令），以此在保障原有机制的前提下达成"共同生效、严格受控"的安全目标。

### 11.3 Top-K 动态分配与选择
候选 Skill 将基于多因素通过 Selector 进行动态分配。这为确保上下文窗口的 token 开支且防止模型在大型候选列表前“注意力涣散”——尤其针对复杂多 Skill Agent。
**注：** 在项目初期（Phase 1），动态匹配的返回上限值将其暂定为最相关的 Top-3 暴露给主节点。在后期演进中，将引入更高级的动态分配机制（如决策树剪枝、基于 Token 当前剩余上限的动态智能截断机制等），无需写死静态数值，从而确保候选集更精准、更具扩展性。
