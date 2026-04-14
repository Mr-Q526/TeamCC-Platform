# TeamCC 权限规则规范

## 1. 文档目的

本文档定义 `teamcc-admin` 当前版本的权限规则模型、合成顺序、接口语义和管理约束。

目标有两个：

- 让管理后台、客户端和后端实现对“权限如何生效”有同一套解释。
- 让后续改造有明确基线，避免文档描述与代码实现脱节。

本文档以当前仓库实现为准，核心对应文件如下：

- `src/db/schema.ts`
- `src/services/auth.ts`
- `src/services/policy.ts`
- `src/api/client.ts`
- `src/api/admin.ts`

## 2. 适用范围

本规范覆盖以下对象：

- 员工身份信息 `users`
- 部门策略 `department_policies`
- 权限模板 `permission_templates`
- 项目授权 `user_assignments`
- 客户端身份接口 `/identity/me`
- 客户端权限接口 `/policy/bundle`

本规范不覆盖：

- SSO / OIDC
- 模板签名校验
- 实时下发 / WebSocket 失效通知
- 审批流

## 3. 核心原则

### 3.1 身份与权限分离

员工身份信息用于描述“这个人是谁”，权限信息用于描述“这个人在某个项目下能做什么”。

- 身份信息来源于 `users`
- 权限信息来源于 `department_policies + user_assignments + permission_templates`

员工资料不是权限本身，只有部分身份字段会参与权限计算。

### 3.2 权限按“用户 + 项目”结算

最终权限不是全局一份，而是按以下维度生成：

- `userId`
- `projectId`

同一员工在不同项目下可以拥有不同模板组合和不同最终权限。

### 3.3 默认拒绝优先

规则冲突时遵循严格优先级：

`deny > ask > allow`

如果相同 `tool + content` 出现多条规则，只保留更严格的一条。

### 3.4 账号状态是权限前置条件

只有 `status = active` 的用户可以：

- 登录
- 刷新 token
- 调用客户端权限接口
- 调用管理后台接口

`suspended` 用户视为无效账号，不参与权限结算。

## 4. 数据模型规范

### 4.1 用户身份 `users`

字段说明：

- `id`: 用户 ID
- `username`: 登录名
- `email`: 邮箱
- `orgId`: 组织
- `departmentId`: 部门
- `teamId`: 团队
- `roleId`: 业务角色
- `levelId`: 等级
- `defaultProjectId`: 默认项目
- `status`: 账号状态，当前支持 `active | suspended`
- `roles`: 管理后台系统角色，当前使用逗号分隔字符串，典型值为 `viewer`、`admin`

其中真正参与当前权限计算的字段只有：

- `departmentId`
- `defaultProjectId`
- `status`
- `roles`

其余字段当前主要用于身份展示和组织归档。

### 4.2 部门策略 `department_policies`

字段说明：

- `departmentId`: 部门 ID
- `policyType`: `deny | allow | ask`
- `toolCategory`: 工具分类，例如 `Read`、`Edit`、`Bash`
- `resourcePattern`: 资源匹配模式
- `status`: `active | disabled`

用途：

- 作为部门级基线策略参与权限合成
- 当前仅当用户存在 `departmentId` 时才会生效

当前实现限制：

- 数据库对 `departmentId` 建了唯一索引，因此一个部门当前实际上只能保存一条策略记录
- 这是现状约束，不是长期推荐模型

### 4.3 权限模板 `permission_templates`

字段说明：

- `name`: 模板名称
- `description`: 模板描述
- `version`: 版本号
- `rulesJson`: `PermissionRule[]`
- `capabilitiesJson`: `string[]`
- `envOverridesJson`: `Record<string, string>`
- `status`: `active | archived`

用途：

- 作为可复用权限包，被项目授权引用

生效约束：

- 只有 `status = active` 的模板会参与最终权限计算
- `archived` 模板会被管理后台保留，但不会再进入权限包

### 4.4 项目授权 `user_assignments`

字段说明：

- `userId`
- `projectId`
- `templateIds`: 模板 ID 列表，当前为逗号分隔字符串
- `extraRulesJson`: 附加规则，结构为 `PermissionRule[]`
- `expiresAt`: 过期时间，可空

用途：

- 表示某个员工在某个项目下绑定了哪些模板
- 支持在模板之外追加个人临时规则

生效约束：

- 只有未过期的 assignment 才参与权限计算
- `expiresAt` 为空表示长期有效

## 5. 权限规则结构

### 5.1 PermissionRule

规则结构如下：

```ts
interface PermissionRule {
  behavior: 'deny' | 'allow' | 'ask'
  tool: string
  content?: string
}
```

字段语义：

- `behavior`: 行为决策
- `tool`: 工具分类
- `content`: 命中范围，可为空

当前常见 `tool` 包括：

- `Read`
- `Write`
- `Edit`
- `Glob`
- `Grep`
- `Bash`
- `WebFetch`
- `WebSearch`

### 5.2 Capabilities

`capabilities` 是附加能力声明，采用字符串数组表达，例如：

```json
["policy.read.crossProject:14,21"]
```

当前服务端只做透传与聚合，不负责进一步语义解释。

### 5.3 Env Overrides

`envOverrides` 是权限模板附带的环境变量覆盖，例如：

```json
{
  "BACKEND_DIR": "src/server/",
  "FRONTEND_DIR": "src/client/"
}
```

当前服务端只负责聚合输出，不在服务端执行模式插值展开。

## 6. 权限合成规范

### 6.1 合成输入

权限包 `PermissionBundle` 的输入固定为：

- 有效用户 `userId`
- 目标项目 `projectId`

### 6.2 合成顺序

当前实现按如下顺序处理：

1. 读取用户身份，校验用户必须存在且 `status = active`
2. 读取该用户所在部门的启用策略
3. 读取该用户在目标项目下的 assignment
4. 如果 assignment 未过期，则读取其绑定的全部模板
5. 仅合并启用中的模板
6. 在模板规则之后叠加 `extraRulesJson`
7. 对同一 `tool + content` 的规则做冲突归并

### 6.3 合成优先级

规则来源分层如下：

1. 部门策略
2. 模板规则
3. 个人附加规则

当前实现不是“后层直接覆盖前层”，而是统一进入规则池后按严格度归并。

归并键为：

```text
tool::content
```

归并策略为：

- 若此前不存在规则，则直接写入
- 若已存在，则保留更严格的一条
- 严格度顺序固定为 `deny > ask > allow`

### 6.4 过期规则

assignment 已过期时：

- 模板不再生效
- 附加规则不再生效
- 最终权限只剩部门级基线策略

### 6.5 归档模板

assignment 中即使仍然引用某模板，只要模板已归档：

- 模板规则不生效
- 模板能力不生效
- 模板环境变量不生效

## 7. 身份接口规范

### 7.1 `/identity/me`

返回结构为 `IdentityEnvelope`：

```ts
interface IdentityEnvelope {
  schema: 'teamskill.identity/v1'
  issuedAt: string
  expiresAt: string
  subject: {
    userId: number
    username: string
    orgId: number | null
    departmentId: number
    teamId: number
    roleId: number
    levelId: number
    defaultProjectId: number
  }
}
```

语义说明：

- 这是身份信息，不是完整权限
- 当前有效期固定为 1 小时
- 用户若不是 `active`，该接口返回未授权

## 8. 权限接口规范

### 8.1 `/policy/bundle`

返回结构为 `PermissionBundle`：

```ts
interface PermissionBundle {
  schema: 'teamskill.permissions/v1'
  bundleId: string
  issuedAt: string
  expiresAt: string
  subjectRef: {
    userId: number
    projectId: number
  }
  rules: PermissionRule[]
  capabilities: string[]
  envOverrides: Record<string, string>
}
```

语义说明：

- 权限包只针对当前 token 对应用户
- 当前接口不支持用 admin token 查询“其他用户”的权限包
- 如果未传 `projectId`，默认取用户的 `defaultProjectId`
- 如果用户不是 `active`，该接口返回未授权

### 8.2 过期时间规则

权限包 `expiresAt` 的生成规则如下：

- 默认有效期为 24 小时
- 如果 assignment 设置了更早的 `expiresAt`，则取更早时间
- 如果当前没有有效 assignment，则使用默认 24 小时

## 9. 管理端操作规范

### 9.1 员工管理

员工管理页负责维护：

- 账号信息
- 组织属性
- 系统角色
- 默认项目
- 账号状态

员工管理页不直接存储最终权限。

### 9.2 模板管理

模板管理页负责维护：

- 规则集合
- 能力集合
- 环境变量集合
- 模板状态
- 模板版本

模板被修改时，版本号应递增。

### 9.3 项目授权管理

授权分配是连接“员工”和“模板”的唯一正式入口。

含义为：

- 给某员工在某项目下绑定一组模板
- 可选附加个人规则
- 可选设置过期时间

一个员工在同一项目下当前只允许存在一条 assignment 记录。

## 10. 当前实现边界

以下内容属于当前代码现状，后续演进时应优先关注：

- `department_policies` 当前被唯一索引限制为一部门一条记录
- `templateIds` 当前仍使用逗号分隔字符串，不是规范化关系表
- `capabilities` 目前只是字符串声明，尚未建立严格白名单和解释器
- `envOverrides` 当前仅输出，不负责服务端插值
- `signature` 字段在 wire schema 中预留，但当前未启用签名

## 11. 推荐后续升级方向

建议按以下顺序演进：

1. 将 `department_policies` 调整为一部门多规则
2. 将 `templateIds` 拆为关系表
3. 增加“生效权限预览”聚合接口
4. 为 `capabilities` 建立白名单和结构化解释
5. 引入签名校验与更严格的客户端缓存策略

## 12. 示例

### 12.1 输入

- 用户：`alice`
- `departmentId = frontend`
- `projectId = 7`
- assignment 绑定模板：`前端开发`
- assignment 未过期

### 12.2 合成结果

最终权限包将包含：

- 部门策略中的启用规则
- `前端开发` 模板中的规则
- `前端开发` 模板中的 capabilities
- `前端开发` 模板中的 envOverrides
- assignment 的 `extraRulesJson`

如果模板中某条规则是 `allow Edit(*src/client/**)`，而部门策略中存在同键 `deny Edit(*src/client/**)`，则最终保留 `deny`。
