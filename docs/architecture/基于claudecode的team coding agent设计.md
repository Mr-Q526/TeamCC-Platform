# 基于 Claude Code 的 Team Coding Agent 设计

> 目标：不是重新设计一个 ReAct agent，而是基于 Claude Code 已有的安全、权限、沙箱、Skill、团队记忆和可观测机制，升级为适合企业团队使用的 coding agent。

---

## 1. 核心判断

Claude Code 的强点不只是会调用工具，而是围绕工具调用建立了一套控制面：

- 工具调用前有 schema 校验和 tool 自校验。
- 文件写入要求先读再写，并检查 stale write。
- Bash 不是简单字符串执行，而是 parser、subcommand、重定向、危险路径、classifier 多层判断。
- 权限不是一个总开关，而是 deny / ask / allow、permission mode、tool-specific checkPermissions 的组合。
- sandbox 会把文件和网络访问范围转成 runtime config，包住 Bash/PowerShell 子进程。
- Skill 会被加载成 command-like entry，并可以声明 allowed-tools。
- Team Memory 已经有同步和 secret scan 雏形。
- Enterprise 方向已有 managed settings、policy settings、policy limits、managed MCP 等基础。

因此，企业版 team coding agent 的重点不是再写一个 harness，而是补齐团队治理：

- 身份和组织上下文。
- 企业策略中心。
- 审批和审计。
- 强制沙箱和网络出口管控。
- Skill 生命周期治理。
- 团队知识 ACL 和 DLP。
- 成本预算和质量评测。

---

## 2. CC 现有机制与企业版改造对比

| 方向 | Claude Code 现有机制 | 企业版需要增强 | 作用 |
|---|---|---|---|
| Tool 输入 | zod schema、validateInput、PreToolUse hook | 统一工具风险模型、结构化策略请求 | 防止模型乱传参数或绕过工具协议 |
| 文件写入 | 先 Read 再 Edit/Write、mtime stale check | 受保护路径、两阶段 diff 审查、codeowner 审批 | 防止覆盖用户改动和误改关键文件 |
| Bash 安全 | parser、只读 allowlist、危险路径、classifier、sandbox | 命令风险分级、企业审批、命令审计回放 | 控制最危险的元能力 |
| 权限 | allow / deny / ask、permission mode、managed settings | RBAC + ABAC + repo/path/tool/action 策略 | 按部门、角色、仓库限制能力 |
| 沙箱 | 文件读写、网络域名、settings/skills 禁写 | 强制启用、企业 profile、fail closed、远程隔离执行 | 防止误删、数据外传和能力自修改 |
| Skill | 本地/project/managed/plugin/MCP skill，allowed-tools | 企业 Skill Registry、权限范围、评分、评测、发布审批 | 把经验沉淀为可控团队资产 |
| Team Memory | repo 维度同步、secret scan | ACL、部门隔离、知识有效期、DLP、来源追踪 | 共享知识但不泄漏敏感信息 |
| MCP/Hook | allowlist、managed-only、URL/env 限制雏形 | Connector 治理、hook 签名、权限最小化 | 防止外部工具成为绕过通道 |
| 预算 | token budget、task budget、session cost | 部门/项目/用户预算、超限审批、成本归因 | 控制企业成本 |
| 可观测 | telemetry、tool decision、cost 事件 | 安全审计、质量 dashboard、评测回放 | 支持治理、追责和持续优化 |

---

## 3. 企业版总体设计

企业版可以分成六个控制面：

1. Identity Context：知道是谁在用、属于哪个部门、在哪个项目和仓库。
2. Policy Engine：决定某个 tool action 是否 allow / ask / deny / approval。
3. Tool Runtime：执行工具，但必须经过 schema、validateInput、hook、permission、sandbox。
4. Enterprise Skill Registry：管理团队 Skill 的发布、权限、评测和排序。
5. Team Knowledge Layer：管理团队 memory、项目规范、CI 经验、业务知识。
6. Audit and Evaluation：记录每次行为，并用评测和 telemetry 改进系统。

一句话：

> 模型只负责提出意图，企业控制面负责判断、限制、执行、记录和评估。

---

## 4. 身份与组织上下文

### CC 当前状态

CC 已经有一些企业能力的基础，例如：

- remote managed settings
- policy settings
- policy limits
- first-party OAuth 下的 team memory sync
- managed MCP

但普通个人版 session 的核心对象仍偏向本地开发者，缺少完整的企业组织上下文。

### 企业版设计

每个 agent session 都应绑定以下信息：

- 用户身份：userId、email、SSO/OAuth 身份。
- 组织身份：orgId、tenantId。
- 部门身份：departmentId、teamId。
- 角色身份：role，如前端、后端、SRE、实习生、代码 reviewer。
- 项目身份：projectId、repoId、repo path。
- 安全上下文：policyVersion、device trust、network zone。

### 有什么用

身份上下文不是展示用的，而是所有策略判断的输入。

例子：

- 前端实习生只能改 `apps/web/**`，改 `infra/**` 需要审批。
- SRE 可以读 Kubernetes 状态，但不能随意执行 delete/apply。
- 支付仓库的鉴权模块只能由支付组和安全组批准修改。
- 外包身份不能使用会访问内网数据库的 MCP。

企业版面试表达：

> 团队版 coding agent 的第一步不是增强模型，而是让每个工具动作都能归因到人、部门、仓库和策略版本。

---

## 5. 企业 Policy Engine

### CC 当前状态

CC 已有：

- `permissions.allow`
- `permissions.deny`
- `permissions.ask`
- `defaultMode`
- `disableBypassPermissionsMode`
- `allowManagedPermissionRulesOnly`
- `allowedMcpServers`
- `deniedMcpServers`
- `allowManagedMcpServersOnly`
- sandbox network/filesystem settings

这些机制已经能表达一部分规则，但更像工具本地配置和 managed settings 的组合。

### 企业版设计

新增统一 Policy Engine，把每次工具动作转换成策略请求：

- 谁：用户、部门、角色、项目。
- 在哪里：仓库、路径、分支、工作区。
- 做什么：read、write、execute、network、skill、mcp。
- 用什么：Read、Edit、Write、Bash、MCP、Skill。
- 风险如何：low、medium、high、critical。
- 结果是什么：allow、ask、deny、approval、sandbox-only。

### 策略例子

| 场景 | 策略 |
|---|---|
| 修改 README | 普通开发者 allow |
| 修改 CI 配置 | ask 或 codeowner approval |
| 修改支付逻辑 | 仅支付组 allow，其他组 approval |
| 运行 `npm test` | allow |
| 运行 `rm -rf` | ask，高危路径 deny |
| 访问公网域名 | 默认 deny，按 allowlist |
| 使用生产数据库 MCP | 仅 SRE approval |
| 新增团队 Skill | 需要 reviewer 发布 |

### 有什么用

Policy Engine 把“人、仓库、路径、工具、命令、网络、Skill”统一起来，而不是散落在 prompt 和本地配置里。

企业版的关键不是能不能写规则，而是规则有优先级：

```text
企业 deny > 企业 approval > 企业 ask > 用户 deny > 用户 ask > 用户 allow > 默认 ask
```

这样用户本地不能用 allow 规则绕过组织安全策略。

---

## 6. 元能力工具的权限设计

### CC 当前状态

Bash、Read、Edit、Write 这种工具是 coding agent 的元能力。

CC 对它们已经做了很多控制：

- Read/Edit/Write 会检查路径权限。
- Edit/Write 要先读再写。
- Bash 会解析命令、拆 subcommand、检查重定向和危险路径。
- Bash 可进入 sandbox。
- deny / ask / allow 规则统一进入 permission context。

Skill 的 `allowed-tools` 在当前 CC 中更像“额外预批准的工具规则”。也就是说，Skill 调用后，`allowed-tools` 会被加入 permission allow rules。它不是严格的“只有这些工具能用，没写的一律不能用”。

### 企业版改造

企业版建议把“基础能力”和“Skill 能力范围”拆开：

1. Base Capability：由组织、角色、项目决定用户最多能用什么。
2. Skill Capability：由 Skill 声明它运行时需要哪些工具。
3. Effective Capability：最终权限取交集，而不是简单追加 allow。

例如：

| 层级 | 能力 |
|---|---|
| 用户基础权限 | Read、Edit(apps/web/**)、Bash(npm test:*)、Bash(git diff:*) |
| Skill 声明权限 | Read、Bash(git diff:*)、Bash(npm test:*) |
| 最终有效权限 | Read、Bash(git diff:*)、Bash(npm test:*) |

如果 Skill 声明了 `Bash(curl:*)`，但用户基础权限没有网络命令能力，则最终不能用。

### 有什么用

这样能保留 Bash/File 作为底层元能力，但避免 Skill 成为权限放大器。

面试表达：

> 在个人版里，Skill 的 allowed-tools 可以理解为便捷的预批准规则。企业版里我会把它改成能力上限，最终权限取用户基础权限、团队策略和 Skill 声明权限的交集。

---

## 7. Bash 安全审查设计

### CC 当前状态

CC 的 Bash 安全机制已经比较完整：

- tree-sitter / legacy parser 解析命令。
- 解析失败或太复杂时倾向 ask。
- 复合命令会拆成 subcommands。
- deny 优先于 ask，ask 优先于 allow。
- 只读命令有 allowlist。
- 重定向目标在原始命令上检查。
- `rm`、`rmdir` 会检查危险删除路径。
- auto mode 会剥离 `Bash(*)`、`Bash(python:*)`、`Bash(node:*)` 等危险 allow 规则。
- sandbox 可限制文件和网络。

### 企业版改造

设计一个 Bash 安全审查器，给每条命令打风险等级。

| 风险级别 | 例子 | 处理方式 |
|---|---|---|
| low | `git status`、`rg keyword`、`ls` | 可自动 allow 或 sandbox allow |
| medium | `npm test`、`pnpm lint`、`git diff` | 允许但记录 telemetry |
| high | `npm install`、`curl`、`docker run`、写配置文件 | ask 或 approval |
| critical | `rm -rf ~`、`git reset --hard`、`kubectl delete`、`curl | sh` | 默认 deny 或强审批 |

### 审查内容

- 是否包含解释器执行任意代码，如 `python -c`、`node -e`、`sh -c`。
- 是否包含下载后执行，如 `curl ... | sh`。
- 是否包含 destructive git，如 `reset --hard`、`clean -fd`、`push --force`。
- 是否删除关键目录，如 home、root、`.ssh`、`.git`、`.claude`。
- 是否写入 shell 配置，如 `.zshrc`、`.bashrc`。
- 是否访问非 allowlist 网络域名。
- 是否修改 CI/CD、infra、deployment 文件。
- 是否在非 sandbox 环境运行。

### 有什么用

企业不是不能让 agent 用 Bash，而是要把 Bash 从“任意 shell”变成“可分类、可审批、可审计的操作”。

---

## 8. 沙箱和网络出口管控

### CC 当前状态

CC 的 sandbox adapter 会把 settings 和权限规则转换成 runtime config，包括：

- allowRead
- denyRead
- allowWrite
- denyWrite
- allowedDomains
- deniedDomains
- unix socket、local binding、proxy 等网络配置

它主要包住 Bash/PowerShell 子进程。

默认会保护：

- settings 文件。
- managed settings 目录。
- `.claude/skills`。
- bare git repo 关键路径。

### 企业版改造

企业版应提供强制 sandbox profile。

Profile 来源：

- 组织策略。
- 部门策略。
- 仓库策略。
- 角色策略。
- 临时审批结果。

Profile 内容：

- 可写路径：仅当前 repo 的允许范围。
- 可读路径：默认 repo 内，敏感目录需要审批。
- 禁写路径：settings、skills、hooks、agents、credentials、shell config。
- 网络域名：默认 deny，按 allowlist 开放。
- 命令执行：默认 sandbox，unsandboxed 需要 break-glass 审批。
- 环境变量：敏感 env 不注入子进程，或只注入白名单。

### managed policy 锁死网络

企业管理员可以设置：

- 只允许访问 GitHub、公司内网文档、公司包管理源。
- 禁止访问 pastebin、未知公网、个人服务器。
- 用户本地不能追加网络 allowlist。
- runtime 遇到未知域名时不弹窗，而是直接拒绝。

有什么用：

- 防 prompt injection 把代码、日志、token 发到外部域名。
- 防 MCP 或 Bash 子进程私自访问未授权服务。
- 满足企业合规和数据出境要求。

---

## 9. 文件写入和代码变更治理

### CC 当前状态

CC 已有：

- 文件必须先 Read 再 Edit/Write。
- 写入前检查 mtime，防 stale write。
- 写入前和写入时都做检查，减少 TOCTOU。
- 对 settings 文件有额外校验。
- 对 team memory 写入做 secret scan。
- UNC 路径避免提前触发 SMB 认证泄漏。

### 企业版改造

设计两阶段写入和代码审查流程：

1. Agent 生成 diff，不直接落盘或先进入 pending patch。
2. 安全审查器检查 diff。
3. 需要时触发 codeowner 或模块 owner 审批。
4. 批准后写入工作区。
5. 自动运行最小验证集。
6. 记录最终变更、审批人、测试结果。

### 安全审查点

- 是否修改敏感路径：auth、payment、infra、deploy、CI、permissions。
- 是否引入 secret。
- 是否新增外部网络访问。
- 是否修改依赖版本或 lockfile。
- 是否修改 agent 自身配置，如 `.claude/settings`、`.claude/skills`。
- 是否删除测试。
- 是否绕过安全检查，如关闭 lint、跳过 auth、修改 feature flag。

### 有什么用

对个人开发者来说，直接 Edit 足够高效；对企业团队来说，关键变更必须有可解释 diff、审批和验证结果。

---

## 10. Enterprise Skill Registry

### CC 当前状态

CC 支持多来源 Skill：

- bundled
- managed
- user
- project
- plugin
- MCP
- experimental remote skill

本地/project/managed Skill 会从 `.claude/skills/<skill-name>/SKILL.md` 加载，解析成 command-like entry。

SkillTool 执行前会：

- 检查 skill 名字是否为空。
- 检查当前 commands 列表里是否存在该 skill。
- 检查是否 `disableModelInvocation`。
- 检查是否 prompt-based skill。
- 检查 SkillTool 自身权限。

远程 Skill 更严格，必须先进入当前 session 的 discovered remote skill state。

### 企业版改造

设计企业 Skill Registry。

每个 Skill 需要有：

- 名称和版本。
- Owner 和维护部门。
- 适用仓库、路径、技术栈。
- 允许角色和部门。
- 风险等级。
- 需要的工具能力。
- 评测结果。
- 使用成功率。
- 最近失败原因。
- 发布状态：draft、reviewing、published、deprecated。
- 回滚版本。

### Skill 排序

不要只靠向量相似度或本地使用频率。

企业版排序可以综合：

- 当前 repo/path 是否匹配。
- 当前用户角色和部门是否匹配。
- Skill 的团队质量分。
- 评测集得分。
- 用户个人使用频率。
- 最近失败率。
- 是否已发布稳定版本。

### Skill 发布审查

设计 Skill 安全审查流程：

1. 作者提交 Skill。
2. 静态检查 frontmatter：allowed-tools、hooks、model、executionContext。
3. 安全检查：是否请求 Bash、MCP、网络、写敏感路径。
4. 评测回放：在 golden tasks 上运行。
5. reviewer 审批。
6. 小范围灰度。
7. 正式发布。
8. 持续监控失败率和风险事件。

### 有什么用

Skill 是团队经验资产，但也可能成为权限放大和 prompt injection 的载体。企业版需要把 Skill 当成“可发布、可评测、可回滚的软件包”治理。

---

## 11. Team Memory 和知识治理

### CC 当前状态

CC 已有 Team Memory 同步能力：

- 按 repo 同步团队记忆。
- 本地 watch 变更后 debounced push。
- 服务端 hash/ETag 做增量同步和冲突处理。
- 写入 team memory 前有 secret scan。

### 企业版改造

把 memory 分成多层：

- 个人 memory：用户偏好、常用工作流。
- repo memory：测试命令、目录结构、发布流程、常见坑。
- team memory：团队规范、代码风格、review 规则。
- department memory：业务术语、系统边界、内部知识。
- org policy memory：公司安全规范、合规要求。

### 治理规则

- 每条 memory 有来源、owner、更新时间和有效期。
- 不同角色看到不同 memory。
- 同步前做 secret scan 和 DLP。
- 高敏知识只能在特定项目或网络环境可见。
- stale memory 降权或提示过期。
- memory 修改也进入审计。

### 有什么用

团队版 agent 需要共享知识，但不能把“所有知识塞进所有人的上下文”。企业知识要按权限、时效和来源进入上下文。

---

## 12. MCP 和 Hook 治理

### CC 当前状态

CC 已经有：

- allowedMcpServers
- deniedMcpServers
- allowManagedMcpServersOnly
- managed hooks only
- HTTP hook URL allowlist
- hook env vars allowlist

### 企业版改造

MCP 和 Hook 都应该纳入企业治理。

MCP 治理：

- 建企业 MCP Registry。
- 每个 MCP server 标注 owner、用途、数据范围、风险等级。
- 每个 MCP tool 单独授权，不只按 server 授权。
- 生产环境 MCP 默认 approval。
- 未登记 MCP 默认 deny。
- MCP 返回内容做敏感信息处理。

Hook 治理：

- Hook 必须来自 managed policy 或已签名插件。
- HTTP hook 只能访问 allowlist URL。
- Hook 可读取的 env vars 必须白名单。
- Hook 修改 tool input 时必须记录 diff。
- Hook 失败策略区分 fail open 和 fail closed。

### 有什么用

MCP 和 Hook 是扩展能力，但也是绕过边界的高风险入口。企业版需要让它们像内部服务一样有注册、授权、审计和下线机制。

---

## 13. 预算和成本治理

### CC 当前状态

CC 已有：

- token budget。
- task budget。
- max budget USD。
- session cost tracking。
- classifier cost telemetry。

### 企业版改造

企业版预算应按多维度控制：

- 用户日预算。
- 团队月预算。
- 项目预算。
- 仓库预算。
- 单任务预算。
- 高成本模型审批。
- 超预算自动降级模型或停止任务。

### 有什么用

coding agent 会长时间跑、频繁读代码、调用子 agent 和 classifier，成本容易失控。企业版需要让成本可归因、可限制、可审批。

---

## 14. 审计和 Telemetry

### CC 当前状态

CC 已有不少 telemetry：

- tool_decision
- Bash command executed
- permission rejected
- classifier decision
- skill invocation
- sandbox violation annotation
- cost tracking

### 企业版改造

审计 audit 用于追责和合规：

- 谁发起任务。
- 哪个 agent session。
- 使用哪个模型。
- 调用了哪些工具。
- 每个工具为什么 allow/ask/deny。
- 命中哪个 policy version。
- 用户或审批人是谁。
- 最终 diff 是什么。
- 测试结果是什么。
- 是否出现 sandbox violation 或 secret scan 拦截。

Telemetry 用于质量和效率：

- 任务成功率。
- 平均完成时间。
- 工具失败率。
- Bash 高风险命令比例。
- Skill 命中率和误调用率。
- 每个 Skill 的成功率。
- 每个团队的 token/cost 消耗。
- policy denial rate。
- sandbox violation rate。

### 有什么用

企业版不能只看“这次 demo 成功了”。必须能做事故回放、成本归因、质量改进和策略迭代。

---

## 15. 安全审查体系

这里可以设计一个独立的 Agent Safety Review 模块，分成三层。

### 15.1 执行前审查

在工具执行前检查：

- 工具类型。
- 命令风险。
- 文件路径风险。
- 网络域名风险。
- MCP server 风险。
- Skill 来源风险。
- 是否命中敏感仓库或敏感目录。

结果：

- allow：低风险，直接执行。
- ask：需要用户确认。
- approval：需要 codeowner/security reviewer。
- deny：禁止执行。
- sandbox-only：只能在 sandbox 中执行。

### 15.2 执行中约束

执行中约束包括：

- sandbox 文件系统限制。
- 网络 egress 限制。
- timeout。
- output size limit。
- background task 管理。
- secret 输出检测。
- sandbox violation 记录。

### 15.3 执行后审查

执行后检查：

- 是否修改了非预期文件。
- 是否产生 secret。
- 是否修改了依赖、CI、部署配置。
- 是否删除测试。
- 是否测试失败。
- 是否产生高风险 telemetry。
- 是否需要回滚。

### 有什么用

这样企业版不是在“执行前问一次就结束”，而是形成完整闭环：

```text
preflight review -> constrained execution -> postflight review -> audit/eval
```

---

## 16. 推荐落地路线

### Phase 1：身份、审计、策略接入

功能：

- 接入 SSO/OAuth。
- 给 session 注入 user/team/project/repo 上下文。
- 建基础 Policy Engine。
- 记录 tool decision、policy denial、cost、diff。

价值：

- 先解决可归因和可回放。
- 不改变太多 agent loop，风险低。

### Phase 2：工具权限和沙箱企业化

功能：

- Bash/File/MCP/Skill 都接入统一 Policy Engine。
- 强制 sandbox profile。
- managed network allowlist。
- unsandboxed command 需要审批。
- 高风险 Bash 命令审查。

价值：

- 控制误删、越权访问和数据外传。

### Phase 3：Enterprise Skill Registry

功能：

- Skill owner、版本、状态、评分。
- Skill 安全审查和发布流程。
- Skill allowed-tools 改成能力上限。
- Skill 评测和灰度。

价值：

- 把团队经验变成可复用但受控的资产。

### Phase 4：Team Knowledge Governance

功能：

- memory 分层：个人、repo、team、department、org policy。
- ACL、DLP、secret scan。
- stale memory 降权。
- memory 修改审计。

价值：

- 让 agent 更懂团队上下文，同时避免敏感知识扩散。

### Phase 5：评测、质量和成本平台

功能：

- coding task benchmark。
- security red-team benchmark。
- Skill recall benchmark。
- budget dashboard。
- tool error 和 denial dashboard。

价值：

- 从“能跑”变成“可持续改进”。

---

## 17. 面试总结表达

可以这样说：

> 我会把 Claude Code 看成一个成熟的个人 coding agent 底座。它已经有工具 schema、自校验、权限、Bash 安全、sandbox、Skill、team memory、managed settings 等关键机制。企业版不应该从零重写 harness，而应该把这些机制升级成组织级控制面：身份上下文、统一 Policy Engine、强制沙箱、网络出口管控、MCP/Hook 治理、Enterprise Skill Registry、Team Memory ACL、审计和评测平台。

再进一步：

> 对个人版来说，`allowed-tools` 可以是 Skill 的便捷预授权；对企业版来说，Skill 不能成为权限放大器。我会把它设计成能力上限，并和用户基础权限、团队策略取交集。Bash/File 仍然是 coding agent 的底层元能力，但必须被拆成更细的路径、命令、网络和风险等级策略。

最后一句：

> 企业版 team coding agent 的核心不是让模型更自由，而是在安全边界内让模型更高效。

