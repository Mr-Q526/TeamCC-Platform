# TeamCC 目录协议统一规范

**日期**: 2026-04-12  
**状态**: Draft  
**适用范围**: `TeamSkill-ClaudeCode/` + `skill-graph/`

## 1. 结论

当前仓库已经不是“全部使用 `.claude/`”，而是处于 **`.claude` 与 `.teamcc` 混用阶段**：

- `TeamSkill-ClaudeCode` 的一部分核心路径、迁移测试、权限模型已经切到 `.teamcc`
- 但仍有大量 runtime 文案、路径校验、hooks/agents/skills/memory/任务说明和部分落盘逻辑继续引用 `.claude`
- `skill-graph` 的 Skill 数据 owner 已经独立，graph facts 默认已切到 `skill-graph/data/events/`，但 runtime 侧仍存在不少 `.claude` 历史路径

因此必须统一成一套规范，避免：

- 同一个功能在 `.claude` 和 `.teamcc` 各维护一份
- runtime 配置在 `TeamSkill-ClaudeCode`，图谱事实数据却散落在项目 `.claude/`
- 文档、UI 提示、测试和真实路径长期不一致

## 2. 统一规范

### 2.1 TeamCC 目录协议

从现在开始，**TeamCC 项目的正式目录协议统一为 `.teamcc`**：

- 用户级目录：`~/.teamcc/`
- 项目级目录：`<project>/.teamcc/`

`.claude` 的定位变成：

- **仅作为历史迁移来源**
- 启动迁移时允许读取
- 不再作为新功能或新写入的目标路径

也就是说，新的 TeamCC 功能不允许再新增任何 `.claude/*` 写入。

### 2.2 Skill / Graph 数据规范

Skill 和知识图谱相关资产分两类管理：

#### A. Runtime 配置类

这类属于 `TeamSkill-ClaudeCode` owner，统一走 `.teamcc`：

- 项目设置：`.teamcc/settings.json`
- 本地覆盖：`.teamcc/settings.local.json`
- 本地 skill：`.teamcc/skills/`
- 规则与 memory：`.teamcc/TEAMCC.md`、`.teamcc/rules/`
- agents / hooks / scheduled tasks / identity / team runtime 目录

#### B. Skill Graph 数据类

这类属于 `skill-graph` owner，不应继续挂在 runtime 的 `.teamcc` 或 `.claude` 下：

- Skill 数据：`skill-graph/skills-flat/`
- registry / embeddings：`skill-graph/skills-flat/*.json`
- eval case / eval run：`skill-graph/evals/`
- graph facts / 原始事件：`skill-graph/data/events/`
- 聚合结果：`skill-graph/data/aggregates/`
- graph update 中间产物：`skill-graph/data/graph/`

**原则**：

- `.teamcc` 存放 runtime 配置与用户/项目工作态
- `skill-graph/` 存放图谱域数据与数据准备产物
- 不再把 graph facts 写回项目运行目录下的 `.claude/skill-events/` 或 `.teamcc/skill-events/`

### 2.3 目标效果

统一完成后，效果应当是：

1. `TeamSkill-ClaudeCode` 只负责运行时体验、设置、技能调用、UI、权限与工作区管理  
2. `skill-graph` 只负责 Skill 数据、graph facts、评测、聚合与图谱更新  
3. 用户看到的目录协议只有 `.teamcc`，不会再被 `.claude` 混淆  
4. 图谱事实数据不再依赖 runtime 当前工作目录，而是统一沉淀到 `skill-graph/data/`

## 3. 各自需要改的地方

### 3.1 `TeamSkill-ClaudeCode` 负责改的部分

这些属于 runtime 目录协议和平台层配置，不应放到 `skill-graph` 里改。

#### A. 设置系统

目标效果：

- 只把 `.teamcc/settings.json`、`.teamcc/settings.local.json` 作为正式写入目标
- `.claude/settings*.json` 只在启动迁移阶段读取

代表模块：

- `src/utils/settings/settings.ts`
- `src/utils/config.ts`
- `src/services/settingsSync/types.ts`
- `tests/settings-path-migration.test.ts`
- `tests/teamcc-project-migration.test.ts`

#### B. 本地 Skill / Agent / Hook / Memory 目录

目标效果：

- UI、提示文案、路径扫描、创建命令全部统一为 `.teamcc/*`
- 不再向用户提示“把 skill 放在 `.claude/skills/`”

代表模块：

- `src/skills/loadSkillsDir.ts`
- `src/tools/AgentTool/agentMemory.ts`
- `src/utils/claudemd.ts`
- `src/components/skills/SkillsMenu.tsx`
- `src/commands/init.ts`
- `src/commands/init-verifiers.ts`
- `src/components/agents/*`
- `src/components/hooks/*`

#### C. 权限与路径校验

目标效果：

- 把危险目录、受保护配置目录、sandbox deny list、permission UI 中的 `.claude` 全部统一为 `.teamcc`
- 兼容迁移期可以同时识别 `.claude`，但不能把它继续当 canonical target

代表模块：

- `src/utils/permissions/filesystem.ts`
- `src/utils/sandbox/sandbox-adapter.ts`
- `src/tools/BashTool/pathValidation.ts`
- `src/tools/PowerShellTool/pathValidation.ts`
- `src/components/permissions/FilePermissionDialog/*`

#### D. 定时任务、团队态、会话态和其他 runtime 存储

目标效果：

- 所有新的持久化目录都落到 `~/.teamcc/` 或 `<project>/.teamcc/`
- 文档、prompt、帮助文案全部同步

代表模块：

- `src/utils/cronTasks.ts`
- `src/utils/cronTasksLock.ts`
- `src/utils/swarm/*`
- `src/entrypoints/agentSdkTypes.ts`
- `src/tools/ScheduleCronTool/*`
- `src/commands/identity.tsx`
- `src/outputStyles/loadOutputStylesDir.ts`

#### E. 文档与 UI 提示

目标效果：

- 所有用户可见文案改成 `.teamcc`
- `.claude` 只允许出现在“兼容迁移”说明中

代表位置：

- `src/components/*`
- `src/commands/*`
- `docs/TEAMCC迁移实施方案.md`

### 3.2 `skill-graph` 负责改的部分

这些属于 graph domain 数据和事实层，不应继续依赖 runtime 项目的工作目录。

#### A. Skill 事实事件落盘路径

目标效果：

- graph facts 不再默认写到 `<cwd>/.claude/skill-events/events.jsonl`
- 改成写到 `skill-graph/data/events/`
- runtime 只发事件，不决定 graph 数据最终放在哪个项目目录

代表模块：

- `TeamSkill-ClaudeCode/src/services/skillSearch/telemetry.ts`
  这里的 writer 要从“按 cwd 落本地隐藏目录”改成“按 skill-graph canonical 路径落 graph facts”
- `skill-graph/src/events/skillFacts.ts`
- 后续新增的 `skill-graph/src/events/storage.ts`

#### B. 原始事件、聚合结果、图谱中间层目录

目标效果：

- `skill-graph/data/events/`：原始 fact JSONL / future DB export
- `skill-graph/data/aggregates/`：聚合结果
- `skill-graph/data/graph/`：Neo4j update input / snapshots

这部分统一由 `skill-graph` 维护，不放到 `.teamcc`

#### C. 文档与开发说明

目标效果：

- graph 文档中不再把 `.claude/skill-events` 写成正式落盘路径
- 明确 graph data 与 runtime config 的边界

代表文档：

- `skill-graph/README.md`
- `DEVELOPMENT.md`
- `skill-graph/docs/architecture/*`

## 4. 最终目录标准

### 4.1 `TeamSkill-ClaudeCode` 侧

```text
~/.teamcc/
  config.json
  settings.json
  skills/
  agents/
  teams/
  tasks/
  rules/
  TEAMCC.md

<project>/.teamcc/
  settings.json
  settings.local.json
  skills/
  agents/
  rules/
  TEAMCC.md
  scheduled_tasks.json
  identity/
```

### 4.2 `skill-graph` 侧

```text
skill-graph/
  skills-flat/
  evals/
  data/
    events/
    aggregates/
    graph/
  scripts/
  docs/
```

## 5. 迁移规则

### 5.1 允许兼容读取

迁移期间允许：

- 从 `.claude/*` 读取旧配置
- 从 `.claude/*` 迁移旧文件
- 在启动阶段自动搬迁到 `.teamcc/*`

### 5.2 禁止继续写入

从规范生效开始，禁止：

- 新增任何 `.claude/*` 作为默认写入目标
- 新增任何对用户可见的 `.claude` canonical 文案
- 把 graph facts 继续写到工作区 `.claude/skill-events/`

## 6. 建议执行顺序

1. `TeamSkill-ClaudeCode` 先完成 runtime 目录协议清理  
2. `skill-graph` 把 graph facts 从 `.claude/skill-events` 迁出到 `skill-graph/data/events/`  
3. 补自动化回归：
   - runtime 新写入只落 `.teamcc`
   - graph facts 只落 `skill-graph/data/events/`
   - `.claude` 仅作为迁移输入，不再作为输出

## 7. 一句话规范

**TeamCC 的运行时目录统一使用 `.teamcc`；Skill Graph 的事实数据统一放在 `skill-graph/` 项目内；`.claude` 只保留为历史迁移来源，不再作为新的 canonical 路径。**
