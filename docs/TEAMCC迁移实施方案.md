# TeamCC 迁移实施方案

## 目标

这次迁移建议拆成两件事，不要混在一起做：

1. 品牌与本地运行时脱钩
2. 模型供应商脱钩

当前最应该优先完成的是第 1 件。第 2 件不应该阻塞第 1 件。

## 推荐终态

本地与项目路径统一迁移到 TeamCC：

- `~/.claude` -> `~/.teamcc`
- `~/.claude.json` -> `~/.teamcc/config.json`
- `~/.claude/settings.json` -> `~/.teamcc/settings.json`
- `.claude/` -> `.teamcc/`
- `CLAUDE.md` -> `TEAMCC.md`
- `.claude/CLAUDE.md` -> `.teamcc/TEAMCC.md`
- `.claude/rules/` -> `.teamcc/rules/`
- `CLAUDE_CONFIG_DIR` -> `TEAMCC_CONFIG_DIR`
- `CLAUDE_CODE_*` -> `TEAMCC_*`

核心原则只有一条：

- 只支持一次性迁移兼容
- 不支持长期运行时双读

也就是说，首次启动可以导入旧 Claude 配置，但导入完成后，运行时只认 TeamCC 路径。

## 迁移阶段

### 1. 先增加统一路径抽象层

不要一开始就在全仓库直接替换字符串。应先把路径逻辑收口到少量 helper。

核心入口文件：

- `src/utils/envUtils.ts`
- `src/utils/env.ts`
- `src/utils/config.ts`
- `src/utils/settings/settings.ts`

建议新增的 helper：

- `getTeamCCConfigHomeDir()`
- `getGlobalTeamCCFile()`
- `getTeamCCProjectDirName()`，固定返回 `.teamcc`
- `getTeamCCInstructionFilename()`，固定返回 `TEAMCC.md`

后续所有路径迁移，都应优先改为通过这些 helper 获取。

### 2. 增加一次性迁移器，而不是长期兼容

启动时建议按下面规则执行：

- 如果 `TEAMCC_CONFIG_DIR` 或 `~/.teamcc/` 已存在，则只读取 TeamCC
- 如果 TeamCC 路径不存在，但旧 Claude 路径存在，则执行一次性迁移
- 写入迁移标记，例如 `~/.teamcc/.migrated-from-claude`
- 迁移完成后，运行时不再读取旧路径

建议同时提供显式命令：

- `teamcc migrate-config`

迁移范围建议包括：

- `~/.claude.json` -> `~/.teamcc/config.json`
- `~/.claude/settings.json` -> `~/.teamcc/settings.json`
- `~/.claude/history.jsonl` -> `~/.teamcc/history.jsonl`
- `~/.claude/{skills,keybindings.json,sessions,teams,tasks,uploads,telemetry,backups,...}` -> `~/.teamcc/...`
- 项目内 `.claude/*` -> `.teamcc/*`

### 3. 切断 Claude settings 注入链路

当前“原生 Claude 配置混进来”的核心原因，就是启动链路还会读取 Claude 的用户级 settings 和合并 settings。

关键文件：

- `src/main.tsx`
- `src/entrypoints/init.ts`
- `src/utils/managedEnv.ts`
- `src/utils/settings/settings.ts`

目标行为应改成：

- user settings 只读取 `~/.teamcc/settings.json`
- project settings 只读取 `.teamcc/settings.json`
- local settings 只读取 `.teamcc/settings.local.json`
- 不再默认读取任何 `~/.claude/*` 或 `.claude/*`

### 4. 迁移指令与记忆系统

这是第二大块改造。

关键文件：

- `src/utils/claudemd.ts`
- `src/context.ts`
- `src/utils/config.ts`

推荐终态：

- 用户全局记忆：`~/.teamcc/TEAMCC.md`
- 项目根文件：`TEAMCC.md`
- 项目点目录文件：`.teamcc/TEAMCC.md`
- 规则目录：`.teamcc/rules/*.md`

这里需要联动修改：

- loader
- 文件监听
- memory path detection
- external include warning
- compact/session restore
- 所有相关 UI 和提示文案

### 5. 迁移项目级点目录 `.claude`

项目点目录不是只存 settings，它目前承载了多个运行时职责。

当前内容包括：

- `teamcc.json`
- `identity/active.md`
- `skills/`
- `agents/`
- `commands/`
- `worktrees/`
- `scheduled_tasks.json`
- `agent-memory/`
- `agent-memory-local/`
- `skill-events/`

关键文件：

- `src/bootstrap/teamccAuth.ts`
- `src/utils/identity.ts`
- `src/utils/worktree.ts`
- `src/tools/AgentTool/agentMemory.ts`

### 6. 重命名环境变量命名空间

这是一个大工程，需要单独规划。

当前源码里大致有：

- 约 220 个唯一的 `CLAUDE_CODE_*` 变量
- 约 35 个唯一的 `ANTHROPIC_*` 变量

建议分两批做：

- 第一批：重命名 `CLAUDE_CONFIG_DIR` 和全部 `CLAUDE_CODE_*`
- 第二批：单独决定 `ANTHROPIC_*` 怎么处理

如果短期内底层仍然使用 Anthropic SDK/API，那么 provider 相关的 `ANTHROPIC_*` 可以暂时保留，减少首轮改造爆炸半径。

### 7. 认证层改成 TeamCC 优先，并删除 Claude 回退

虽然 TeamCC 认证已经接入，但 Claude 兼容回退链路还在。

关键文件：

- `src/utils/auth.ts`

必须完成的改造：

- 删除从 `~/.claude`、keychain、`.credentials.json` 读取 Claude 兼容凭证的 fallback
- `apiKeyHelper` 改成只读 TeamCC settings
- `oauthAccount`、`primaryApiKey`、`claudeAiOauth` 改名或移除
- TeamCC token 统一存入 `~/.teamcc/config.json` 或 TeamCC secure storage

### 8. 统一 CLI、包名和用户可见命名

需要修改的文件包括：

- `package.json`
- `src/main.tsx`
- `src/constants/system.ts`
- `src/constants/prompts.ts`

推荐目标：

- CLI 名称：`teamcc`
- 进程标题：`teamcc`
- package 名称：例如 `@teamcc/cli`
- 帮助文案、错误提示、tips、README、skills、模板全部同步改名

### 9. 单独处理 Claude 专属产品能力

这些能力不能只做 rename，要么整体禁用，要么重写。

例如：

- `claude.ai` Remote Control / bridge
- Claude in Chrome
- `claudeAiLimits`
- Claude OAuth Web flow
- `@claude` GitHub workflow 模板
- `code.claude.com`、`platform.claude.com` 等产品链接

关键文件：

- `src/constants/oauth.ts`
- `src/constants/product.ts`
- `src/bridge/bridgeMain.ts`
- `src/services/api/claude.ts`

建议处理方式：

- 如果还没有 TeamCC 对应后端，先整体通过 feature flag 关闭
- 不要留下半改名、半可用的中间态

## 推荐的 PR 拆分

### PR1：路径抽象层 + 一次性迁移器

目标：

- TeamCC 路径抽象建立完成
- 一次性配置迁移器建立完成
- 暂时不做大规模文案清理

### PR2：settings / global config / history / plugins / sessions 脱离 Claude

目标：

- 启动时不再读取任何本机 Claude 配置

### PR3：迁移 `.teamcc` 与 `TEAMCC.md` 指令系统

目标：

- 项目级点目录与指令记忆系统全部切换完成

### PR4：CLI / UI / prompt / 脚本 / 文档 / 包名统一改名

目标：

- 用户可见层不再出现 Claude 品牌

### PR5：下线或替换 Claude 专属产品集成

目标：

- bridge、OAuth、`claude.ai` 链接、Claude 专属集成收尾完成

## 验收标准

迁移完成后，至少需要满足以下条件：

- 修改或删除 `~/.claude/settings.json` 后，`teamcc` 运行行为不再受影响
- 只保留 `.teamcc/`，没有 `.claude/` 也能完整运行
- `TEAMCC.md` 生效，`CLAUDE.md` 不再属于运行时加载路径
- 运行时不再读取 `~/.claude.json`、`~/.claude/history.jsonl`、`~/.claude/plugins`
- 默认命令、帮助、错误提示中不再出现 `claude` 或 `Claude Code`
- 如果 TeamCC 自有后端尚未完成，对应 Claude 专属能力默认禁用，而不是残留半可用状态

## 推荐执行顺序

1. 先完成 PR1 和 PR2
2. 运行时隔离稳定后，再做 PR3
3. 最后完成 PR4 和 PR5

你当前遇到的“启动时混入原生 Claude 配置”的问题，主要由前两阶段导致。只要 PR2 完成，这个问题就会先消失。
