# Skill 元信息编码映射规范

## 目的

本文定义当前阶段 Skill Registry 中 `SKILL.md` frontmatter 的最小契约。当前版本只服务三个目标：

1. 按“部门”快速过滤 Skill。
2. 为知识图谱沉淀提供稳定的 Skill、版本、部门、场景关系。
3. 用中英双语别名提升检索召回，并把自然语言表达归一到稳定 Skill 节点。

本规范刻意保持极简。当前版本不要求引入审核状态、信任等级、来源追溯、运行时兼容字段，也不要求覆盖所有治理维度。

动态使用分数、成功率、曝光量、反馈分等数据不写入 `SKILL.md`。这些数据必须写入事件流、聚合快照或图谱边权快照。

## 设计原则

- `skillId` 是 Skill 的稳定主键，版本变化时不变。
- `version` 和 `sourceHash` 用于刻画 SkillVersion。
- `departmentTags` 是部门过滤主字段。
- `sceneTags` 是部门-场景-Skill 图谱关系的主字段。
- `aliases` 是检索别名字段，用于承接中文、英文、缩写和业务口语表达。
- `domain` 用于一级分组和基础索引。
- frontmatter 只保留静态、稳定、可审计的信息。

## 通用编码规则

| 项 | 规则 |
|---|---|
| 字段名 | 使用 camelCase |
| id 编码 | 使用小写 kebab-case；`skillId` 格式为 `{domain}/{name}` |
| 数组字段 | 使用 YAML flow array 或 block array；值去重、稳定排序 |
| 空值 | 未知标量使用 `unknown`；不适用数组使用 `[]` |
| 描述 | `description` 使用一句能力描述，不写宣传文案 |
| hash | 使用 `sha256:<hex>` |
| Secret | frontmatter 不得包含 API Key、token、cookie、密码 |

## 最小必填字段

以下字段是当前阶段唯一主契约。

| 字段 | 类型 | 示例 | 说明 |
|---|---|---|---|
| `schemaVersion` | string | `"2026-04-11"` | 元信息 schema 版本 |
| `skillId` | string | `frontend/frontend-skill` | Skill 稳定主键，格式为 `{domain}/{name}` |
| `name` | string | `frontend-skill` | skill 短名，小写 kebab-case |
| `displayName` | string | `Frontend Skill` | 人类可读名称 |
| `description` | string | `Design and implement visually strong frontend experiences.` | Skill 能力摘要 |
| `aliases` | string[] | `[前端, UI, frontend]` | 检索别名、同义词、触发词；中英双语，不作为主键 |
| `version` | semver string | `"0.1.0"` | 当前 Skill 内容版本 |
| `sourceHash` | string | `sha256:...` | 当前 `SKILL.md` 内容 hash |
| `domain` | enum | `frontend` | 一级领域 |
| `departmentTags` | string[] | `[frontend-platform]` | 部门过滤主字段 |
| `sceneTags` | string[] | `[design, architecture]` | 场景主字段 |

## 可选字段

以下字段不是当前主契约，仅在你明确需要时再补。

| 字段 | 类型 | 示例 | 说明 |
|---|---|---|---|
| `sourceRepo` | string | `skiils-line` | 来源仓或集合 |
| `roleTags` | string[] | `[frontend-engineer]` | 适用角色 |
| `techStack` | string[] | `[react, nextjs]` | 技术栈标签 |

## `aliases` 编码规则

`aliases` 用于解决“用户说法”和“Skill 正式名称/英文描述”不一致的问题。它是检索入口词，不是 Skill 身份主键。

推荐包含：

- 中文业务词，例如 `后台任务`、`死信队列`、`官网首页`。
- 英文技术词，例如 `queue`、`dead-letter queue`、`landing page`。
- 常见缩写，例如 `RBAC`、`CI`、`CDN`。
- 同义表达，例如 `落地页`、`营销页`、`campaign page`。

不推荐包含：

- 过宽泛词，例如 `代码`、`项目`、`功能`。
- 临时热词或一次性业务词。
- 与 Skill 能力无关的流量词。

图谱中应把 alias 映射到稳定节点：

```text
alias: 死信队列 -> Concept: dead-letter-queue
alias: 幂等 -> Concept: idempotency
alias: 官网首页 -> Skill: frontend/website-homepage-design
```

## 枚举规范

### `domain`

| 编码 | 含义 |
|---|---|
| `frontend` | Web 前端、React、Vue、CSS、浏览器调试 |
| `backend` | 服务端、API、数据库、业务服务 |
| `infra` | 云服务、部署、CI/CD、SRE、可观测性 |
| `mobile` | iOS、Android、React Native、Flutter |
| `data` | 数据分析、Notebook、ETL、BI |
| `design` | 设计系统、视觉生成、Figma |
| `security` | 安全审计、威胁建模、权限、合规 |
| `tools` | 文件处理、PDF、表格、浏览器自动化、通用工具 |
| `ai` | 模型、Agent、RAG、prompt、LLM 应用 |
| `general` | 无法归入以上领域的通用 Skill |

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

无法判断时使用空数组 `[]`。

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

## 版本规则

### `skillId`

- `skillId` 表示逻辑上的同一个 Skill。
- 只要还是同一 Skill 的迭代，`skillId` 不变。
- 不同来源但语义完全不同的 Skill，必须使用不同 `skillId`。

### `version`

- 使用 semver 字符串，例如 `"1.0.0"`。
- 外部导入且无版本时默认 `"0.1.0"`。
- 只要 `SKILL.md` 正文或 bundled resources 行为变化，就递增 `patch` 或 `minor`。
- `version` 只表达内容演进，不表达审核流程、信任等级或来源状态。

### `sourceHash`

- `sourceHash` 记录当前 SkillVersion 对应的内容 hash。
- `sourceHash` 计算时排除 `sourceHash` 字段本身，避免自引用。
- Skill 正文或执行语义变化时必须递增 `version`。
- 仅 `aliases`、`departmentTags`、`sceneTags` 等静态检索元信息变化时，可以保持 `version` 不变，但 `sourceHash` 会变化；迁移批次必须在 manifest 或提交说明中记录。
- 非元信息迁移场景下，`version` 未变化但 `sourceHash` 变化时，视为异常，需要人工确认。
- 图谱和索引中应同时保留 `skillId` 与 `version + sourceHash`。

## 迁移映射规则

| 旧来源 | 新字段 | 规则 |
|---|---|---|
| 原 frontmatter `name` | `name` | 保留并规范为 kebab-case；冲突时追加短 hash |
| 原 frontmatter `description` | `description` | 优先保留；为空时从正文标题或摘要生成 |
| 原名称、描述、目录名、人工词库 | `aliases` | 提取中英双语别名，去重并稳定排序 |
| 原路径第一层或规则映射 | `domain` | 必须映射到本文定义的业务领域 |
| 人工标注或规则映射 | `departmentTags` | 作为部门过滤主字段 |
| 人工标注或 LLM 辅助 | `sceneTags` | 只允许补静态、稳定场景 |
| 原 `SKILL.md` 内容 hash | `sourceHash` | 用于版本比对和异常检测 |

## 图谱映射规则

### 静态节点

- `Skill`
- `SkillVersion`
- `Department`
- `Scene`
- `Domain`

### 静态边

| Metadata 字段 | 图谱节点 | 图谱边 |
|---|---|---|
| `skillId` | `Skill` | 主节点 |
| `version` + `sourceHash` | `SkillVersion` | `Skill -HAS_VERSION-> SkillVersion` |
| `departmentTags` | `Department` | `Skill -FOR_DEPARTMENT-> Department` |
| `sceneTags` | `Scene` | `Skill -FOR_SCENE-> Scene` |
| `domain` | `Domain` | `Skill -IN_DOMAIN-> Domain` |
| `aliases` | `Alias` / `Concept` | `Skill -HAS_ALIAS-> Alias`，后续可归并到 Concept |

动态图谱边必须从事件和反馈聚合生成，不从 frontmatter 直接生成。

## 校验规则

迁移和索引构建必须执行以下校验：

- `skillId` 唯一。
- `name` 与目录名一致。
- `skillId` 等于 `{domain}/{name}`。
- `description` 非空。
- `aliases` 必须存在，可为空数组但不能缺字段。
- `version` 必须是合法 semver 字符串。
- `sourceHash` 必须存在且格式为 `sha256:<hex>`。
- `departmentTags` 必须存在，可为空数组但不能缺字段。
- `sceneTags` 必须存在，可为空数组但不能缺字段。
- `domain` 只能使用本文定义的枚举值。
- 数组字段去重并稳定排序。

## 最小示例

```yaml
---
schemaVersion: "2026-04-11"
skillId: frontend/frontend-skill
name: frontend-skill
displayName: Frontend Skill
description: Design and implement visually strong frontend experiences.
version: "0.1.0"
sourceHash: sha256:...
domain: frontend
departmentTags: [frontend-platform]
sceneTags: [design, architecture]
---
```
