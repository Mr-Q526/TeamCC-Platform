# Claude Code 团队控制面改造详细实施步骤

基于当前落地进度，这份文档重新收敛 Claude Code 的企业版改造主线：**以 TeamCC 作为身份与权限控制面，以 Skill 沉淀作为团队经验资产层。**

## 当前目标

本项目已经不再围绕“本地身份文件 + 本地规则拼装”推进，而是围绕以下两件事推进：

1. **权限鉴定**：让企业身份、权限包和工具执行边界形成稳定闭环。
2. **Skill 沉淀**：让团队经验通过 registry、embedding、graph、feedback 形成可治理资产。

> 2026-04-12 更新：`.claude/identity/active.md` 方案已取消，企业版身份来源统一收敛到 TeamCC Admin。

---

## Phase 1.1: TeamCC 身份接入层

### 目标

在会话初始化阶段建立企业身份上下文，杜绝手写身份票据。

### 主要改造点

#### `src/bootstrap/teamccAuth.ts`

- 读取项目级、用户级和环境变量配置
- 登录、刷新、登出
- 拉取 `/identity/me`
- 维护身份缓存

#### `src/main.tsx`

- 在 `permissionSetup` 之前完成 TeamCC 身份建立
- token 缺失、失效、刷新失败时给出明确路径
- 远端不可达时优先回退缓存

#### `src/utils/identity.ts`

- 将 `IdentityEnvelope` 转换为 `IdentityProfile`
- 为上下文注入和 Skill 选择提供结构化身份数据

### 当前原则

- 不再引入 `.claude/identity/active.md`
- 不再把本地 md 票据当作身份真相源
- 企业路径必须来自 TeamCC

---

## Phase 1.2: 权限编译与运行时注入

### 目标

让 TeamCC 下发的权限包真正影响工具执行边界，而不是停留在“可拉取”的层面。

### 主要改造点

#### `src/utils/permissions/teamccLoader.ts`

- 调用 `/policy/bundle`
- 转换为运行时 `PermissionRule`
- 应用 `envOverrides`
- 做本地缓存回退

#### `src/utils/permissions/permissionSetup.ts`

- 在 `ToolPermissionContext` 初始化时注入 TeamCC rules
- 与本地规则一起进入同一条权限编译链路

#### `src/utils/permissions/rulesMerger.ts`

- 对多源规则执行“最严格原则”合并
- 形成可诊断的来源信息

### 原则

- 企业边界由 TeamCC 权限包定义
- 本地规则可存在，但不能替代企业控制面
- 权限判断必须服务于可审计与可回收

---

## Phase 1.3: Skill 沉淀与选择器

### 目标

让 Skill 从“文件集合”进化为“团队资产集合”。

### 主要改造点

#### `skills-flat/`

- 作为统一 Skill 源目录
- 统一元信息字段

#### `src/services/skillSearch/localSearch.ts`

- 读取 generated registry
- 支持 BM25 + 向量混合召回
- 为后续 rerank 与 graph 留好入口

#### `src/skills/loadSkillsDir.ts`

- 加载 Skill 元信息
- 对接部门、场景、域标签

### 目标状态

- 身份与项目上下文决定 Skill 可见范围
- 检索结果限定在更可信、更贴近场景的候选集
- Skill 使用结果可被持续评估和回流

---

## Phase 1.4: 审计与反馈埋点

### 目标

补齐企业运行时最关键的可观测能力。

### 需要覆盖的信号

- `tool_permission_decision`
- `tool_execution_audit`
- `skill_invoked`
- `skill_completed`
- `skill_feedback`

### 目标效果

- 清楚知道是谁、在什么身份下、触发了什么权限决策
- 清楚知道某个 Skill 是否真的提高了任务完成率

---

## Phase 2: Skill 评测、图谱与重排

### 目标

把 Skill 检索从“静态召回”升级为“可学习的治理系统”。

### 核心方向

- registry 统一产物
- embedding 构建与导入
- Neo4j 图模型
- feedback event
- reranker
- 评测与回放

### 与控制面的关系

- TeamCC 身份决定检索上下文
- 权限边界决定 Skill 是否可执行
- feedback 决定 Skill 是否值得继续推荐

---

## 当前优先级

### P0

1. 清理残留的本地身份文件方案文档和注释
2. 收口 TeamCC 登录、身份、权限的命令与文档
3. 强化 TeamCC 权限来源可见性

### P1

1. 去掉客户端硬编码身份标签映射
2. 补齐权限审计与 Tool 级埋点
3. 让身份与能力边界稳定影响 Skill 检索

### P2

1. 聚合 Skill feedback
2. 回灌到 reranker / graph
3. 建立更完整的评测回放链路

---

## 验证矩阵

| 测试维度 | 前提或情景验证 | 预期效果 |
| :--- | :--- | :--- |
| TeamCC 身份建立 | 本地已登录或存在有效 token | 启动时拉取 `/identity/me` 并挂载 `IdentityProfile` |
| 权限注入 | TeamCC 返回 deny / ask / allow 规则 | 实际工具执行边界发生变化 |
| 缓存回退 | 远端不可达但本地缓存有效 | 启动仍可维持企业路径的基础能力 |
| Skill 检索 | 相同任务在不同身份/项目下执行 | 候选 Skill 集发生合理变化 |
| 审计闭环 | 触发权限拦截或实际工具执行 | 能记录身份、决策与执行信号 |
