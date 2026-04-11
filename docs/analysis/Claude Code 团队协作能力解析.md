# Claude Code 团队协作能力解析

> 基于 Claude Code v999.0.0-restored 代码库分析

---

## 目录

1. [团队内存 (Team Memory)](#1-团队内存-team-memory)
2. [多智能体协作 (Multi-Agent / Swarms)](#2-多智能体协作-multi-agent--swarms)
3. [分层配置系统 (Settings Hierarchy)](#3-分层配置系统-settings-hierarchy)
4. [企业级策略管理 (Policy Settings)](#4-企业级策略管理-policy-settings)
5. [SSH 配置共享](#5-ssh-配置共享)

---

## 1. 团队内存 (Team Memory)

### 1.1 概念

团队内存是项目级别的**共享知识库**，存储在 `<memoryBase>/projects/<project>/memory/team/` 目录下。所有团队成员在会话开始时同步，成员贡献的内容对整个团队可见。

### 1.2 存储内容类型

| 类型 | 作用域 | 用途 | 示例 |
|------|--------|------|------|
| **user** | 始终私有 | 用户角色、目标、知识背景 | "我是数据科学家，专注于可观测性" |
| **feedback** | 通常团队 | 需要避免或保持的做法 | "不要在测试中 mock 数据库 — 曾因 mock 与实际环境差异导致生产问题" |
| **project** | 私有或团队 | 进行中的工作、目标、截止日期 | "2026-03-05 开始代码冻结，移动端正在切 release 分支" |
| **reference** | 通常团队 | 外部系统引用 | "管道 bug 在 Linear 项目 INGEST 中追踪" |

### 1.3 存储结构

```
<memoryBase>/projects/<sanitized-project>/memory/team/
├── MEMORY.md           # 索引文件（入口点）
├── user_role.md        # 用户角色记忆
├── feedback_*.md       # 反馈记忆（通常为团队可见）
├── project_*.md        # 项目记忆
└── reference_*.md      # 外部引用记忆
```

- **MEMORY.md**: 索引文件，最多 200 行，每个条目约 150 字符
- **每个记忆独立文件**: 使用 frontmatter 格式（name、description、type）

### 1.4 上下文注入机制

Team Memory 的加载分为**两个层面**，与 CLAUDE.md 的直接注入不同：

| 组成部分 | 加载方式 | 说明 |
|---------|---------|------|
| **MEMORY.md 索引** | 直接注入系统提示词 | 会话开始时自动加载，包含所有记忆的指针列表 |
| **具体记忆文件**（user_role.md 等） | 按需加载 | AI 判断需要时，通过 `findRelevantMemories()` 筛选后读取 |

**MEMORY.md 索引内容示例**：
```markdown
# Memory

- [integration-tests-no-mocks](feedback_integration_tests.md) — 不要 mock 数据库
- [user_data_scientist](user_data_scientist.md) — 用户是数据科学家
```

**具体记忆文件加载流程**：
1. AI 收到用户 query，判断可能需要查看相关记忆
2. 调用 `findRelevantMemories()` 用 Sonnet 模型筛选最相关的记忆（最多 5 个）
3. 被选中的记忆文件才会被加载到上下文中

**与 CLAUDE.md 的对比**：

| 维度 | CLAUDE.md | Team Memory MEMORY.md 索引 | Team Memory 具体记忆文件 |
|------|-----------|---------------------------|------------------------|
| 加载方式 | 直接全文注入 | 直接注入 | 按需加载 |
| 触发 | 始终生效 | 始终生效 | AI 判断相关时 |
| 筛选 | 无（全部加载） | 无（全部加载） | Sonnet 模型筛选（最多 5 个） |
| 内容 | 静态文档 | 索引（指针列表） | 实际记忆内容 |

### 1.5 Frontmatter 格式

```markdown
---
name: {{记忆名称}}
description: {{单行描述 — 用于判断相关性}}
type: {{user, feedback, project, reference}}
---

{{记忆内容 — 包含规则/事实，**Why:** 和 **How to apply:** 行}}
```

### 1.6 同步机制

**双向同步**:
- **Pull**: 从服务器 `GET /api/claude_code/team_memory?repo={owner/repo}` 拉取
- **Push**: 仅上传与服务器 SHA-256 哈希不同的文件（增量上传）
- **冲突解决**: 412 Precondition Failed 时，重新获取最新哈希表并重试

**Watcher**: 使用 `fs.watch({recursive: true})` 监听团队内存目录，变更后 2 秒防抖推送

### 1.7 安全保护

`secretScanner.ts` 基于 gitleaks 规则，防止 60+ 种敏感信息进入团队内存：

- **云 API**: AWS、GCP、Azure、DigitalOcean
- **AI API**: Anthropic、OpenAI、HuggingFace
- **VCS**: GitHub PATs、GitLab tokens
- **通信**: Slack、Twilio、SendGrid
- **开发工具**: NPM、PyPI、Databricks、Pulumi
- **支付**: Stripe、Shopify

检测到敏感信息的文件**写入前被拦截**，并警告用户。

### 1.8 关键文件

| 文件 | 用途 |
|------|------|
| `src/memdir/teamMemPaths.ts` | 路径解析、安全验证（符号链接/路径遍历检查） |
| `src/memdir/teamMemPrompts.ts` | 自动+团队内存组合模式 prompt 构建（行为指令，不含实际内容） |
| `src/memdir/memoryTypes.ts` | 四种记忆类型定义、frontmatter 格式 |
| `src/memdir/memdir.ts` | 核心记忆加载、MEMORY.md 截断 |
| `src/memdir/findRelevantMemories.ts` | 按需加载具体记忆文件的筛选逻辑（Sonnet 模型） |
| `src/utils/claudemd.ts` | 内存文件加载入口，MEMORY.md 索引注入上下文 |
| `src/services/teamMemorySync/index.ts` | 服务器 API 同步（pull/push + 增量上传） |
| `src/services/teamMemorySync/watcher.ts` | fs.watch 文件监听器（2 秒防抖） |
| `src/services/teamMemorySync/secretScanner.ts` | 客户端敏感信息检测 |

---

## 2. 多智能体协作 (Multi-Agent / Swarms)

### 2.1 概念

Claude Code 支持通过 `--agent-id`、`--agent-name`、`--team-name`、`--agent-color` 等 CLI 参数标识团队成员，并支持三种团队成员运行模式。

### 2.2 团队配置存储

团队配置存储在 `~/.claude/teams/{team-name}/config.json`，包含：
- 团队成员列表（agent ID、name、color、tmux pane ID）
- 每个成员权限模式
- 独立 git worktree 路径（隔离工作环境）

### 2.3 三种团队成员模式

| 模式 | 说明 | 进程隔离 | API 客户端 |
|------|------|----------|------------|
| **tmux** | 在 tmux pane 中运行 | 独立 OS 进程 | 每个成员独立实例 |
| **in-process** | 在同一 Node.js 进程内运行 | 共享进程（AsyncLocalStorage 隔离） | 与 leader 共享 |
| **auto** | 根据环境自动选择 tmux 或 in-process | 取决于选择 | 取决于选择 |

#### tmux 模式

- 通过 `tmux split-window` 在独立 pane 中启动成员
- **在 tmux 内**: leader 占 30%（左侧），成员共享 70%（右侧）
- **在普通终端**: 创建 `claude-swarm` tmux session，平等平铺
- 支持 pane 边框颜色和标题显示
- 终止: `tmux kill-pane`（强制杀死）

#### in-process 模式

- 使用 **AsyncLocalStorage** 实现上下文隔离
- 每个成员有独立的 `AbortController`
- 注册到 `AppState.tasks`（类型: `in_process_teammate`）
- 共享 leader 的 API 客户端和 MCP 连接
- 终止: 优雅停止（通过 mailbox 发送关闭请求）或强制 `AbortController.abort()`

#### auto 模式

根据环境自动选择（缓存决策，会话生命周期内固定）：

| 条件 | 结果 |
|------|------|
| 非交互模式（`-p`） | in-process |
| `teammateMode === 'in-process'` | in-process |
| `teammateMode === 'tmux'` | tmux pane |
| 已在 tmux 内 | tmux pane |
| iTerm2 + it2 CLI 可用 | iTerm2 pane |
| iTerm2 + 无 it2 + tmux | tmux pane fallback |
| 之前的 spawn 回退到 in-process | in-process |
| 其他情况 | in-process |

### 2.4 团队成员模式特点对比

| 方面 | tmux 模式 | in-process 模式 |
|------|-----------|-----------------|
| 进程隔离 | 独立 OS 进程 | 同一 Node.js 进程 |
| 上下文隔离 | 独立环境变量/CLI 参数 | AsyncLocalStorage |
| API 客户端 | 每成员独立实例 | 与 leader 共享 |
| 启动速度 | 慢（新建进程） | 快（内存内） |
| 外部依赖 | 需要 tmux | 无 |
| 终止方式 | `kill-pane` tmux 命令 | `AbortController.abort()` |
| 资源占用 | 较高（独立进程） | 较低（共享进程） |

### 2.5 关键文件

| 文件 | 用途 |
|------|------|
| `src/utils/teammate.ts` | 团队成员身份工具（agent ID、name、team 上下文） |
| `src/utils/swarm/spawnUtils.ts` | CLI flags 和环境变量传递 |
| `src/utils/swarm/teamHelpers.ts` | 团队配置文件管理（config.json 读写） |
| `src/utils/swarm/backends/TmuxBackend.ts` | tmux pane 管理实现 |
| `src/utils/swarm/backends/InProcessBackend.ts` | 进程内执行实现 |
| `src/utils/swarm/backends/registry.ts` | 后端选择逻辑和缓存 |
| `src/utils/swarm/backends/detection.ts` | tmux/iTerm2 环境检测 |
| `src/components/teams/TeamsDialog.tsx` | 团队对话框 UI |
| `src/tools/TeamCreateTool/TeamCreateTool.ts` | 团队创建工具 |

---

## 3. 分层配置系统 (Settings Hierarchy)

### 3.1 优先级顺序（低 → 高）

```
Plugin settings → User settings → Project settings → Local settings → Flag settings → Policy settings
```

| 层级 | 路径 | 说明 |
|------|------|------|
| Plugin settings | 插件目录 | 最低优先级 |
| User settings | `~/.claude/settings.json` | 用户全局设置 |
| Project settings | `.claude/settings.json` | 项目共享设置 |
| Local settings | `.claude/settings.local.json` | gitignore 的本地覆盖 |
| **Flag settings** | `--settings` CLI 参数 | 会话级命令行参数 |
| **Policy settings** | 托管策略（最高） | 企业/团队管理员下发 |

### 3.2 Flag Settings 详解

**来源**:
1. `--settings /path/to/settings.json` CLI 参数指定的文件
2. SDK 内联设置 via `setFlagSettingsInline()`

**特点**:
- **只读**: 无法通过设置 UI 修改
- **会话级**: 不持久化到磁盘
- **始终启用**: 即使通过 `--setting-sources` 限制源，flagSettings 也会被包含
- **信任源**: 跳过危险模式权限提示

**使用场景**:
```bash
claude --settings /path/to/team-settings.json
```

### 3.3 关键文件

| 文件 | 用途 |
|------|------|
| `src/utils/settings/settings.ts` | 核心设置加载/合并逻辑 |
| `src/utils/settings/types.ts` | 设置类型定义 |
| `src/commands/config/config.tsx` | 配置命令 UI |
| `src/bootstrap/state.ts` | 状态管理（flag settings 路径） |

---

## 4. 企业级策略管理 (Policy Settings)

### 4.1 概念

Policy Settings 是**托管设置**，由企业/团队管理员统一下发，具有最高优先级，用于：
- 强制执行安全策略
- 锁定自定义能力
- 分发团队标准化配置

### 4.2 策略来源（按优先级）

1. **Remote managed settings**（远程托管）
2. **MDM**（macOS plist / HKLM）
3. `managed-settings.json` + `managed-settings.d/`（配置片段目录）
4. **HKCU**（用户可写，回退）

### 4.3 企业/团队管理功能

| 设置项 | 说明 |
|--------|------|
| `allowedMcpServers` | 企业 MCP 服务器白名单 |
| `deniedMcpServers` | 企业 MCP 服务器黑名单 |
| `strictKnownMarketplaces` | 企业市场限制 |
| `blockedMarketplaces` | 屏蔽的市场列表 |
| `extraKnownMarketplaces` | 预配置插件源（团队共享） |
| `strictPluginOnlyCustomization` | 锁定自定义仅限插件 |
| `allowManagedHooksOnly` | 仅允许托管设置的钩子 |
| `allowManagedPermissionRulesOnly` | 仅使用托管的权限规则 |
| `allowedHttpHookUrls` | 允许的 HTTP 钩子 URL |
| `httpHookAllowedEnvVars` | HTTP 钩子允许的环境变量 |
| `sshConfigs` | 团队预配置 SSH 连接 |
| `channelsEnabled` | 团队频道通知 |
| `allowedChannelPlugins` | 允许的频道插件 |

### 4.4 托管设置目录

- **主文件**: `/etc/claude/managed-settings.json`
- **片段目录**: `/etc/claude/managed-settings.d/`
  - 允许团队/组织分发策略片段，无需协调编辑

---

## 5. SSH 配置共享

### 5.1 概念

`sshConfigs` 设置允许团队管理员预配置 SSH 连接，供团队成员使用。

### 5.2 配置结构

```json
{
  "sshConfigs": [
    {
      "name": "production",
      "host": "prod.example.com",
      "user": "deploy",
      "identityFile": "~/.ssh/prod_key"
    }
  ]
}
```

### 5.3 使用场景

- 团队成员通过 Claude Code 直接连接预配置的远程服务器
- 无需手动管理 SSH 密钥和配置
- 集中管理敏感连接信息（配合团队策略）

---

## 附录

### A. 团队协作架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Policy Settings                       │
│         (企业/团队管理员下发, 最高优先级)                   │
│              /etc/claude/managed-settings.d/              │
└─────────────────────────────────────────────────────────┘
                           ↑
┌─────────────────────────────────────────────────────────┐
│                   Flag Settings                         │
│              (--settings CLI 参数)                       │
└─────────────────────────────────────────────────────────┘
                           ↑
┌─────────────────────────────────────────────────────────┐
│                Local / Project / User                    │
│     (.claude/settings.local.json → settings.json)       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Team Memory                          │
│    <memoryBase>/projects/<project>/memory/team/         │
│         (双向同步, 敏感信息扫描)                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              Multi-Agent (Swarms)                       │
│     tmux pane / in-process / auto 模式                   │
│         ~/.claude/teams/<team>/config.json              │
└─────────────────────────────────────────────────────────┘
```

### B. 关键代码路径

```
src/
├── memdir/
│   ├── teamMemPaths.ts          # 团队内存路径
│   ├── teamMemPrompts.ts        # 团队内存 prompt
│   ├── memoryTypes.ts           # 记忆类型
│   ├── memdir.ts                # 核心加载逻辑
│   └── findRelevantMemories.ts  # 按需加载筛选逻辑
├── services/
│   └── teamMemorySync/
│       ├── index.ts             # 服务器同步
│       ├── watcher.ts           # 文件监听
│       └── secretScanner.ts     # 敏感信息扫描
├── utils/
│   ├── teammate.ts              # 团队成员身份
│   ├── claudemd.ts              # 内存文件加载入口（MEMORY.md 注入）
│   ├── swarm/
│   │   ├── teamHelpers.ts       # 团队配置管理
│   │   ├── spawnUtils.ts       # Spawn 工具
│   │   └── backends/
│   │       ├── TmuxBackend.ts  # tmux 后端
│   │       ├── InProcessBackend.ts  # 进程内后端
│   │       ├── registry.ts      # 后端注册
│   │       └── detection.ts     # 环境检测
│   └── settings/
│       ├── settings.ts         # 设置核心
│       └── types.ts            # 类型定义
├── components/
│   └── teams/
│       └── TeamsDialog.tsx     # 团队 UI
└── tools/
    └── TeamCreateTool/
        └── TeamCreateTool.ts   # 团队创建
```

### C. CLI 标志

| 标志 | 说明 |
|------|------|
| `--agent-id` | 智能体唯一标识 |
| `--agent-name` | 智能体名称 |
| `--team-name` | 团队名称 |
| `--agent-color` | 智能体颜色（UI 显示） |
| `--teammate-mode` | 团队成员模式（tmux/in-process/auto） |
| `--settings` | Flag settings 文件路径 |

---

*文档更新时间: 2026-04-08*
*基于 Claude Code v999.0.0-restored 分析*
