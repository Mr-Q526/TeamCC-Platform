# Skill 元信息编码映射规范

## 目的

本文定义 Skill Registry 中 `SKILL.md` frontmatter 的字段、编码、枚举、迁移映射和图谱映射规则。所有迁移脚本、索引构建脚本、评测系统、知识图谱聚合任务都必须以本文为契约。

动态使用分数、成功率、曝光量、反馈分不写入 `SKILL.md`。这些数据写入 score snapshot 或图谱边权快照，避免使用行为导致源文件频繁变更。

## 通用编码规则

| 项 | 规则 |
|---|---|
| 字段名 | 使用 camelCase；兼容当前 runtime 的字段保留原名，例如 `allowed-tools`、`when_to_use` |
| id 编码 | 使用小写 kebab-case；允许 `/` 表达层级，例如 `frontend/react-debugger` |
| 数组字段 | 使用 YAML flow array 或 block array；值去重、稳定排序 |
| 空值 | 未知使用 `unknown`；不适用使用空数组 `[]`；不要混用 `none`、`n/a`、`misc` |
| 描述 | `description` 使用一句明确触发语义，不写宣传文案 |
| 时间 | 使用 ISO 8601，例如 `2026-04-11T10:00:00Z` |
| hash | 使用 `sha256:<hex>` |
| 路径 | Registry 里用仓库相对路径，不写本机绝对路径 |
| Secret | frontmatter 不得包含 API Key、token、cookie、密码 |

## 必填字段

| 字段 | 类型 | 示例 | 说明 |
|---|---|---|---|
| `schemaVersion` | string | `"2026-04-11"` | 元信息 schema 版本 |
| `skillId` | string | `frontend/react-debugger` | 全局稳定 id，格式为 `{domain}/{name}` |
| `name` | string | `react-debugger` | skill 短名，小写 kebab-case |
| `description` | string | `Diagnose React rendering issues.` | 触发和能力描述 |
| `domain` | enum | `frontend` | 一级领域，必须与 Registry 第一层目录一致 |
| `taxonomyPath` | string[] | `[frontend, react]` | OpenViking / 路径树分类 |
| `sceneTags` | string[] | `[debug, performance]` | 场景标签 |
| `requiredTools` | string[] | `[Read, Edit, Bash]` | 检索和评测特征，不等于权限放行 |
| `scope` | enum | `community` | Skill 可见范围或来源范围 |
| `sourceType` | enum | `import` | 来源类型 |
| `sourcePath` | string | `skiils-line/foo/SKILL.md` | 原始来源路径 |
| `sourceHash` | string | `sha256:...` | 原始 `SKILL.md` 内容 hash |
| `owner` | string | `unknown` | 当前治理责任人或团队 |
| `version` | semver string | `"1.0.0"` | Skill 内容版本 |
| `reviewState` | enum | `review` | 审核状态 |
| `trustLevel` | enum | `draft` | 信任等级 |

## 推荐字段

| 字段 | 类型 | 示例 | 说明 |
|---|---|---|---|
| `displayName` | string | `React Debugger` | 人类可读名称 |
| `when_to_use` | string | `Use when...` | 当前 runtime 可使用的触发说明字段 |
| `roleTags` | string[] | `[frontend-engineer]` | 适用角色 |
| `departmentTags` | string[] | `[frontend-platform]` | 部门或组织编码 |
| `projectTags` | string[] | `[web-console]` | 项目编码 |
| `techStack` | string[] | `[react, typescript]` | 技术栈 |
| `requiredPaths` | string[] | `[apps/web]` | 治理建议路径边界 |
| `paths` | string[] | `[apps/web/**]` | 当前 Claude Code 条件激活字段 |
| `allowed-tools` | string[] | `[Read, Edit, Bash]` | 当前 runtime 可解析的工具权限字段 |
| `sourceRepo` | string | `community-collections/foo` | 来源仓或集合 |
| `licenseHint` | string | `mit` | 许可证线索，未知为 `unknown` |
| `authors` | string[] | `[github:alice]` | 原始作者 |
| `maintainers` | string[] | `[team:frontend-platform]` | 当前维护者 |
| `benchmarkSetIds` | string[] | `[react-debug-v1]` | 绑定评测集 |
| `deprecatedBy` | string | `frontend/react-profiler` | 废弃替代 Skill |

## 枚举规范

### `domain`

| 编码 | 含义 |
|---|---|
| `frontend` | Web 前端、React、Vue、CSS、浏览器调试 |
| `backend` | 服务端、API、数据库、业务服务 |
| `infra` | 云服务、部署、CI/CD、SRE、可观测性 |
| `mobile` | iOS、Android、React Native、Flutter |
| `data` | 数据分析、Notebook、ETL、BI |
| `design` | Figma、设计系统、视觉生成 |
| `security` | 安全审计、威胁建模、权限、合规 |
| `tools` | 文件处理、PDF、表格、浏览器自动化、通用工具 |
| `ai` | 模型、Agent、RAG、prompt、LLM 应用 |
| `general` | 无法归入以上领域的通用 Skill |

新增 `domain` 必须先更新本文，再更新迁移脚本中的枚举。

### `sceneTags`

| 编码 | 含义 |
|---|---|
| `debug` | 故障排查、bug 定位 |
| `review` | 代码审查、方案审查 |
| `refactor` | 重构、结构优化 |
| `test` | 测试编写、测试修复、验证 |
| `architecture` | 架构设计、模块边界 |
| `release` | 发版、变更管理 |
| `incident` | 线上事故、应急响应 |
| `deploy` | 部署、环境发布 |
| `performance` | 性能分析和优化 |
| `security-audit` | 安全审计、威胁建模 |
| `design` | 设计稿、UI、设计系统 |
| `data-analysis` | 数据处理和分析 |
| `content-generation` | 文案、视频、PPT、图像等内容生成 |

无法判断时使用空数组 `[]`，不要写 `none`。

### `roleTags`

| 编码 | 含义 |
|---|---|
| `frontend-engineer` | 前端工程师 |
| `backend-engineer` | 后端工程师 |
| `fullstack-engineer` | 全栈工程师 |
| `mobile-engineer` | 移动端工程师 |
| `sre` | SRE / 运维工程师 |
| `qa-engineer` | 测试工程师 |
| `security-engineer` | 安全工程师 |
| `data-engineer` | 数据工程师 |
| `designer` | 设计师 |
| `tech-lead` | 技术负责人 |
| `agent-builder` | Agent / Skill 构建者 |

### `departmentTags`

部门编码使用组织内稳定短码，不使用中文名作为机器字段。

| 编码示例 | 中文展示名 |
|---|---|
| `frontend-platform` | 前端平台部 |
| `backend-platform` | 后端平台部 |
| `infra-platform` | 基础设施部 |
| `security-platform` | 安全平台部 |
| `ai-platform` | AI 平台部 |
| `growth` | 增长业务部 |
| `data-platform` | 数据平台部 |

实际公司部门表可以由中心 Registry 维护，本文只定义编码格式。

### `scope`

| 编码 | 含义 |
|---|---|
| `personal` | 个人自用 |
| `project` | 单项目可见 |
| `team` | 团队可见 |
| `platform` | 平台或安全团队发布 |
| `community` | 外部社区来源 |

### `sourceType`

| 编码 | 含义 |
|---|---|
| `original` | 本仓原生编写 |
| `import` | 外部来源导入 |
| `fork` | 从外部来源 fork 后维护 |
| `generated` | 自动生成后进入 review |
| `manual` | 人工补录 |

### `reviewState`

| 编码 | 含义 | Runtime 默认投影 |
|---|---|---|
| `draft` | 草稿，未进入正式 review | 否 |
| `review` | 待审或审核中 | 否 |
| `active` | 审核通过，可默认加载 | 是 |
| `deprecated` | 已废弃，仅保留兼容和追溯 | 否 |
| `blocked` | 安全、许可、质量问题阻断 | 否 |

### `trustLevel`

| 编码 | 含义 |
|---|---|
| `draft` | 未验证来源或质量 |
| `reviewed` | 已人工 review 或评测通过 |
| `signed` | 平台签名或安全团队背书 |

### `requiredTools` 和 `allowed-tools`

`requiredTools` 是检索特征，表示 Skill 通常需要哪些能力。`allowed-tools` 是 runtime 字段，只有在需要影响执行权限时写入。

| 工具编码 | 说明 |
|---|---|
| `Read` | 读文件 |
| `Edit` | 修改已有文件 |
| `Write` | 写新文件 |
| `Bash` | 执行 shell 命令 |
| `Grep` | 搜索文本 |
| `Glob` | 文件匹配 |
| `WebFetch` | 抓取网页 |
| `WebSearch` | 搜索网页 |
| `MCP:<server>` | 指定 MCP server，例如 `MCP:figma` |

如需约束 Bash 命令，`allowed-tools` 应使用 runtime 支持的具体格式，例如 `Bash(npm test:*)`。

## 路径字段区别

| 字段 | 消费方 | 示例 | 含义 |
|---|---|---|---|
| `taxonomyPath` | OpenViking / path-tree index | `[frontend, react]` | 业务分类树 |
| `paths` | Claude Code runtime 条件激活 | `[apps/web/**]` | 代码路径匹配 |
| `requiredPaths` | 治理、审计、图谱 | `[apps/web]` | Skill 适用或允许作用范围 |
| `sourcePath` | 迁移溯源 | `skiils-line/foo/SKILL.md` | 原始来源路径 |

不要用 `sourcePath` 进行检索路由，也不要把 OpenViking 分类路径写进 `paths`。

## 版本和作者规范

### `version`

- 使用 semver 字符串，例如 `"1.0.0"`。
- 外部导入且无版本时默认 `"0.1.0"`。
- 只要 `SKILL.md` 正文或 bundled resources 行为变化，就递增 patch 或 minor。
- 版本不表达审核状态，审核状态使用 `reviewState`。

### `owner`

- 表示当前治理责任主体。
- 个人使用 `user:<handle>`，团队使用 `team:<department-or-team-code>`。
- 未知使用 `unknown`，但 `reviewState: active` 前必须补齐。

### `authors`

- 表示原始作者或来源作者。
- GitHub 来源使用 `github:<login>`。
- 无法识别时使用空数组 `[]`，不要猜测。

### `maintainers`

- 表示当前维护者。
- 至少一个 maintainer 才允许进入 `reviewState: active`。

## 迁移映射规则

| 旧来源 | 新字段 | 规则 |
|---|---|---|
| 原 frontmatter `name` | `name` | 保留并规范为 kebab-case；冲突时追加短 hash |
| 原 frontmatter `description` | `description` | 优先保留；为空时从正文标题或 LLM 摘要生成 |
| 原 frontmatter `when_to_use` | `when_to_use` | 保留 |
| 原 frontmatter `allowed-tools` | `allowed-tools` | 保留并校验格式 |
| 原 frontmatter `paths` | `paths` | 保留并校验为 repo 相对 glob |
| 原路径第一层或规则映射 | `domain` | 不用 `community-collections` 作为 domain，需映射到业务领域 |
| 原路径领域片段 | `taxonomyPath` | 最多保留 2 到 3 层稳定业务分类 |
| 原仓库或集合名 | `sourceRepo` | 记录来源集合 |
| 原文件路径 | `sourcePath` | 记录仓库相对路径 |
| 原 `SKILL.md` 内容 hash | `sourceHash` | 用于去重、追溯和索引一致性 |
| LLM 推断 | `sceneTags`, `roleTags`, `techStack`, `requiredTools` | 只能补缺失字段，必须通过 schema 校验 |

## 图谱映射规则

| Metadata 字段 | 图谱节点 | 图谱边 |
|---|---|---|
| `skillId` | `Skill` | 主节点 |
| `version` | `SkillVersion` | `Skill -HAS_VERSION-> SkillVersion` |
| `owner` | `User` 或 `Team` | `Skill -OWNED_BY-> owner` |
| `authors` | `Author` | `Skill -AUTHORED_BY-> Author` |
| `maintainers` | `User` 或 `Team` | `Skill -MAINTAINED_BY-> maintainer` |
| `departmentTags` | `Department` | `Skill -OWNED_BY_DEPARTMENT-> Department` |
| `sceneTags` | `Scene` | `Skill -FOR_SCENE-> Scene` |
| `roleTags` | `Role` | `Skill -FOR_ROLE-> Role` |
| `techStack` | `TechStack` | `Skill -USES_TECH-> TechStack` |
| `requiredTools` | `Tool` | `Skill -REQUIRES_TOOL-> Tool` |
| `taxonomyPath` | `Path` | `Skill -MATCHES_TAXONOMY-> Path` |
| `benchmarkSetIds` | `BenchmarkSet` | `Skill -EVALUATED_BY-> BenchmarkSet` |

动态图谱边从事件聚合生成，不从 frontmatter 生成。

## 校验规则

迁移和索引构建必须执行以下校验：

- `skillId` 唯一。
- `name` 与 Registry 第二层目录一致。
- `domain` 与 Registry 第一层目录一致。
- `skillId` 等于 `{domain}/{name}`。
- `description` 非空，建议 20 到 300 字符。
- 枚举字段只能使用本文定义的值。
- 数组字段去重并稳定排序。
- `sourceHash` 必须存在。
- `reviewState: active` 时 `owner`、`maintainers`、`licenseHint`、`benchmarkSetIds` 不得缺失。
- `blocked` Skill 必须有错误原因记录在 migration report。
- `allowed-tools` 不得包含超出全局 policy 的工具。
- `paths` 不得包含本机绝对路径或 `../`。
- `SKILL.md` 中的相对链接必须能解析到迁移后的文件。

## 示例

```yaml
---
schemaVersion: "2026-04-11"
skillId: security/threat-model
name: threat-model
description: Build repository-grounded threat models with assets, trust boundaries, abuse paths, and mitigations.
domain: security
taxonomyPath: [security, threat-modeling]
sceneTags: [security-audit, architecture, review]
roleTags: [security-engineer, tech-lead]
departmentTags: [security-platform]
projectTags: []
techStack: []
requiredTools: [Read, Grep, Glob, Write]
allowed-tools: [Read, Grep, Glob, Write]
paths: []
requiredPaths: []
scope: team
sourceType: original
sourceRepo: TeamSkill-ClaudeCode
sourcePath: .claude/skill-registry/security/threat-model/SKILL.md
sourceHash: sha256:...
licenseHint: internal
owner: team:security-platform
authors: []
maintainers: [team:security-platform]
version: "1.0.0"
reviewState: active
trustLevel: reviewed
benchmarkSetIds: [security-threat-model-v1]
---
```
