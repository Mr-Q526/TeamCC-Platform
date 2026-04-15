# TeamCC Admin

TeamCC Admin 是 TeamCC 平台里的身份、权限与审计管理后台，对接 `TeamSkill-ClaudeCode` 客户端，负责把“谁可以在什么项目里做什么”从散落的人工约定，收敛成可管理、可预览、可审计的后端服务和可视化控制台。

当前仓库实现由两部分组成：

- 后端：`Fastify + TypeScript + Drizzle ORM + PostgreSQL`
- 前端：`React 19 + Vite + TypeScript + i18next`

README 以当前 `teamcc-admin` 目录中的代码为准，不把方案文档中的远期设计误写成已完成能力。

## 1. 项目定位

这个项目解决的是 TeamCC/TeamSkill 客户端在团队内落地时的权限治理问题：

- 员工有组织身份：部门、团队、角色、职级、默认项目
- 权限不是写死在账号里，而是按“用户 + 项目”结算
- 权限来自多个来源：部门策略、权限模板、项目授权、个人附加规则
- 客户端需要拿到统一的身份包和权限包
- 管理端需要看到变更记录和风险行为，而不是只依赖客户端提示词约束

当前代码已覆盖的核心场景：

- 管理员工身份档案
- 管理部门级基线策略
- 管理权限模板
- 按项目分配模板与附加规则
- 预览某个用户在某个项目下的最终生效权限
- 接收并展示 TeamCC 客户端审计事件
- 提供 skill-graph 集成的预留入口
- 提供 Neo4j Browser 跳转页

## 2. 设计原则

### 2.1 身份与权限分离

`users` 表维护的是“这个人是谁”，不是“这个人最终拥有什么权限”。

- 身份字段：`orgId`、`departmentId`、`teamId`、`roleId`、`levelId`、`defaultProjectId`
- 权限来源：`department_policies + user_assignments + permission_templates`

### 2.2 权限按“用户 + 项目”结算

同一个员工在不同项目里可以绑定不同模板，因此最终权限不是全局唯一的一份，而是：

- 输入：`userId + projectId`
- 输出：`PermissionBundle`

### 2.3 冲突优先级固定

规则冲突时使用固定优先级：

```text
deny > ask > allow
```

归并键是：

```text
tool::content
```

也就是说，同一个工具和资源范围下，只保留更严格的那条规则。

### 2.4 账号状态是前置条件

只有 `status = active` 的用户才能：

- 登录
- 刷新 token
- 请求 `/identity/me`
- 请求 `/policy/bundle`
- 访问 `/admin/*`

`suspended` 用户会被直接拦截。

## 3. 当前架构

```text
TeamCC Client / Admin Web
        |
        v
   Fastify API
   ├─ /auth/*              登录、刷新、登出
   ├─ /identity/me         身份包
   ├─ /policy/bundle       权限包
   ├─ /admin/*             后台管理接口
   └─ /api/audit           客户端审计接入
        |
        v
   PostgreSQL
   ├─ users
   ├─ department_policies
   ├─ permission_templates
   ├─ user_assignments
   ├─ audit_log
   └─ dictionaries...
```

职责划分如下：

- 后端 `src/`
  - 认证、权限结算、管理接口、审计接口
- 前端 `frontend/src/`
  - 登录页、仪表盘、员工页、模板页、授权页、部门策略页、审计页、Neo4j 页
- 数据层 `src/db/` + `drizzle/`
  - Drizzle schema、初始化、SQL 迁移
- 脚本 `scripts/`
  - 初始化数据、模板清理、Docker 开发入口

## 4. 目录结构

```text
teamcc-admin/
├─ docs/                    设计说明与规范文档
├─ drizzle/                 SQL 迁移
├─ frontend/                React 管理台
│  ├─ src/api/              前端 API 封装
│  ├─ src/pages/            页面实现
│  ├─ src/styles/           页面样式
│  └─ src/i18n/             中英文文案
├─ scripts/                 seed / dev-entrypoint 等脚本
├─ src/
│  ├─ api/                  路由定义
│  ├─ db/                   数据库 schema 与连接
│  ├─ services/             认证与权限结算
│  ├─ types/                对外共享的 wire schema
│  └─ main.ts               服务入口
├─ .env.example
├─ docker-compose.yml
└─ README.md
```

## 5. 技术栈

### 5.1 后端

- Node.js `>= 20`
- Fastify 4
- Drizzle ORM
- PostgreSQL 16
- `bcryptjs` 用于密码哈希
- 自定义 HMAC JWT，用于 access token

### 5.2 前端

- React 19
- Vite 8
- TypeScript
- `i18next + react-i18next`

### 5.3 基础设施

- Docker Compose 用于本地 PostgreSQL / API / Web 开发容器
- Neo4j Browser 通过跳转页接入，不做 iframe 内嵌

## 6. 核心数据模型

### 6.1 字典表

用于维护组织身份信息：

- `orgs`
- `departments`
- `teams`
- `roles`
- `levels`
- `projects`

### 6.2 用户表 `users`

记录员工身份与后台系统角色：

- 登录身份：`username`、`email`、`passwordHash`
- 组织属性：`orgId`、`departmentId`、`teamId`、`roleId`、`levelId`
- 默认项目：`defaultProjectId`
- 账号状态：`status`
- 后台角色：`roles`

其中 `roles` 当前是逗号分隔字符串，典型值：

- `viewer`
- `admin`

### 6.3 部门策略 `department_policies`

部门级基线策略，字段包括：

- `departmentId`
- `policyType`
- `toolCategory`
- `resourcePattern`
- `description`
- `status`

这层策略会直接进入权限归并过程。当前数据库已经允许一个部门存在多条策略记录。

### 6.4 权限模板 `permission_templates`

可复用权限包，主要字段：

- `name`
- `description`
- `version`
- `rulesJson`
- `capabilitiesJson`
- `envOverridesJson`
- `status`

注意：

- 编辑模板时版本号会自增
- 只有 `status = active` 的模板会进入最终权限结算
- 已归档模板仍保留在后台，但不会被应用

### 6.5 项目授权 `user_assignments`

表示某个员工在某个项目中的权限绑定：

- `userId`
- `projectId`
- `templateIds`
- `extraRulesJson`
- `expiresAt`

约束：

- 主键是 `(userId, projectId)`
- 已过期 assignment 不参与权限结算
- `extraRulesJson` 只追加规则，不追加能力或环境变量

### 6.6 审计表 `audit_log`

当前管理后台查询和展示使用的是共享表 `audit_log`：

- 后台资源变更审计：用户、模板、assignment、部门策略
- 客户端行为审计：登录、命令、文件写入、权限放行/拒绝、策略违反

仓库里还定义了 `teamcc_audit_logs`，但当前主链路读写使用的是 `audit_log`。

## 7. 权限模型

### 7.1 结算来源

当前实现中的权限来源有三层：

1. 部门策略 `department_policies`
2. 模板规则 `permission_templates.rulesJson`
3. 个人附加规则 `user_assignments.extraRulesJson`

附加输出：

- `capabilities` 仅来自模板
- `envOverrides` 仅来自模板

### 7.2 结算流程

`src/services/policy.ts` 中的 `buildEffectivePolicyPreview()` 和 `buildPermissionBundle()` 是核心实现。

实际流程：

1. 校验用户存在且为 `active`
2. 读取用户身份并构造 `IdentitySubject`
3. 加载用户部门下的启用策略
4. 加载该用户在目标项目下的 assignment
5. 过滤已过期 assignment
6. 读取 assignment 绑定的模板
7. 过滤非激活模板
8. 合并模板规则、能力、环境变量
9. 叠加 assignment 的 `extraRulesJson`
10. 以 `tool::content` 为键归并规则，执行 `deny > ask > allow`
11. 返回最终规则，同时输出来源追踪与被压制规则

### 7.3 预览能力

管理台不只是取最终结果，还支持“为什么会变成这样”的追踪。

`GET /admin/users/:id/effective-policy` 会返回：

- `assignment`
- `templates`
- `departmentPolicies`
- `effective.rules`
- `effective.capabilities`
- `effective.envOverrides`
- `effectiveRules`
- `suppressedRules`

这让管理员能直接看到：

- 哪些规则生效了
- 哪些规则被更严格的规则压制了
- 每条规则来自部门策略、模板还是 assignment 额外规则

补充说明：

- `IdentityEnvelope` 默认有效期是 `1 小时`
- `PermissionBundle` 默认有效期是 `24 小时`
- 如果 assignment 设置了更早的 `expiresAt`，权限包会取更早的过期时间

## 8. 认证模型

### 8.1 Token 结构

- Access Token：自定义 HMAC JWT，TTL `15 分钟`
- Refresh Token：数据库持久化的 opaque token，TTL `7 天`

### 8.2 相关接口

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

前端会在 access token 过期时自动尝试刷新，刷新失败则清空本地登录态。

### 8.3 管理后台鉴权

所有 `/admin/*` 接口都需要：

- 合法 access token
- 用户处于 `active`
- `roles` 中包含 `admin`

## 9. 审计模型

### 9.1 客户端事件

当前允许进入管理后台审计链路的事件：

- `boot`
- `login`
- `logout`
- `exit`
- `bash_command`
- `file_write`
- `command_execution_error`
- `permission_allow`
- `permission_ask`
- `permission_deny`
- `policy_violation`

### 9.2 严重级别归因

服务端会根据事件类型和工具类型推导严重级别：

- `info`
- `warning`
- `critical`

例如：

- 普通 `permission_allow` -> `info`
- `permission_ask` -> `warning`
- `permission_deny` 且工具是 `Bash` / `Edit` / `Write` / `WebFetch` / `WebSearch` -> `critical`
- `policy_violation` -> `critical`

### 9.3 安全告警

以下情况会触发 webhook 告警：

- 命中危险 bash 命令模式
- `policy_violation` 且严重级别为 `critical`
- 高风险工具的 `permission_deny`

可选环境变量：

- `FEISHU_WEBHOOK_URL`
- `DINGTALK_WEBHOOK_URL`

## 10. 前端页面说明

当前前端已实现这些页面：

- `LoginPage`
  - 登录入口
- `Dashboard`
  - 数据总览、近期活动、导航入口
- `UsersPage`
  - 员工 CRUD、组织信息维护、生效权限预览
- `AssignmentsPage`
  - 按员工/项目/模板视角查看授权关系，新增或撤销 assignment
- `TemplatesPage`
  - 模板 CRUD、规则/能力/环境变量编辑、版本展示
- `PoliciesPage`
  - 部门策略 CRUD
- `AuditPage`
  - 审计列表、筛选与详情展开
- `Neo4jPage`
  - 跳转到本地 Neo4j Browser，并展示 skill-graph 预留能力入口

前端支持中英文切换，语言设置保存在浏览器 `localStorage` 中。

## 11. API 概览

### 11.1 客户端接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/auth/login` | 用户名密码登录 |
| `POST` | `/auth/refresh` | 刷新 access token |
| `POST` | `/auth/logout` | 撤销 refresh token |
| `GET` | `/identity/me` | 获取身份包 |
| `GET` | `/policy/bundle?projectId=<id>` | 获取权限包 |
| `POST` | `/api/audit` | 接收客户端审计事件 |

### 11.2 管理接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/admin/dictionaries` | 获取字典表 |
| `GET` | `/admin/users` | 获取用户列表 |
| `POST` | `/admin/users` | 创建用户 |
| `PUT` | `/admin/users/:id` | 更新用户 |
| `DELETE` | `/admin/users/:id` | 停用用户 |
| `GET` | `/admin/templates` | 获取模板列表 |
| `POST` | `/admin/templates` | 创建模板 |
| `PUT` | `/admin/templates/:id` | 更新模板并自增版本 |
| `DELETE` | `/admin/templates/:id` | 归档模板 |
| `GET` | `/admin/assignments` | 获取所有 assignment |
| `GET` | `/admin/users/:id/assignments` | 获取某用户 assignment |
| `POST` | `/admin/users/:id/assignments` | 创建或更新某用户 assignment |
| `DELETE` | `/admin/users/:id/assignments/:projectId` | 删除某用户某项目 assignment |
| `GET` | `/admin/users/:id/effective-policy` | 生效权限预览 |
| `GET` | `/admin/department-policies` | 获取部门策略 |
| `POST` | `/admin/department-policies` | 创建部门策略 |
| `PUT` | `/admin/department-policies/:id` | 更新部门策略 |
| `DELETE` | `/admin/department-policies/:id` | 禁用部门策略 |
| `GET` | `/admin/audit` | 审计列表 |
| `GET` | `/admin/skills/capabilities` | skill-graph 预留能力 |
| `POST` | `/admin/skills/import` | 预留接口，当前返回 501 |
| `GET` | `/admin/skills/weights/export` | 预留接口，当前返回 501 |
| `GET` | `/admin/skills/execution-stats` | 预留接口，当前返回 501 |

## 12. 本地开发

### 12.1 依赖要求

- Node.js `20+`
- npm
- Docker / Docker Compose
- 本地 PostgreSQL 端口 `5432` 未被占用

### 12.2 初始化后端

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/worktrees/admin/teamcc-admin
cp .env.example .env
npm install
docker compose up -d postgres
npm run db:push
npm run seed
npm run dev
```

后端启动后默认地址：

- API: `http://127.0.0.1:3000`
- 健康检查: `http://127.0.0.1:3000/health`

### 12.3 初始化前端

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/worktrees/admin/teamcc-admin/frontend
npm install
npm run dev
```

前端默认地址：

- Web: `http://127.0.0.1:5173`

### 12.4 一键 Docker 开发

仓库提供了完整的 `docker-compose.yml`，其中：

- `postgres`：PostgreSQL
- `api`：后端服务
- `web`：Vite 前端

API 容器启动时会自动执行：

1. `npm install`
2. `npm run db:push`
3. `npm run seed`
4. `npm run dev`

前端容器启动时会自动执行：

1. `npm install`
2. `npm run dev -- --host 0.0.0.0 --port 5173`

直接启动：

```bash
docker compose up -d --build postgres api web
```

### 12.5 Worktree 使用注意

当前 `docker-compose.yml` 已改成相对路径挂载：

- `.:/app`
- `./frontend:/app`

并且已经移除固定 `container_name`，容器名改为由 Compose 自动生成。  
这意味着仓库 clone 到任意目录后，都可以直接启动，不再依赖某台机器上的绝对路径。

但在 worktree 中联调时，仍推荐：

- 只用 Compose 起 `postgres`
- API 和前端直接在当前 worktree 本机启动

因为容器只会挂载你执行 `docker compose` 时所在目录对应的那一份代码。

## 13. 环境变量

### 13.1 后端必需变量

参考 `.env.example`：

```env
PORT=3000
HOST=127.0.0.1
DATABASE_URL=postgresql://teamcc_admin:teamcc_admin_dev_password@localhost:5432/teamcc_admin
JWT_SECRET=dev-secret-change-in-production
LOG_LEVEL=info
```

当前代码实际直接消费的关键变量：

- `PORT`
- `HOST`
- `DATABASE_URL`
- `JWT_SECRET`

`LOG_LEVEL` 已出现在示例文件里，但当前代码没有单独读取它做日志等级配置。

### 13.2 可选变量

- `FEISHU_WEBHOOK_URL`
- `DINGTALK_WEBHOOK_URL`
- `VITE_NEO4J_BROWSER_URL`
- `VITE_API_PROXY_TARGET`

其中：

- `VITE_NEO4J_BROWSER_URL` 用于前端 Neo4j 跳转页
- `VITE_API_PROXY_TARGET` 只影响 Vite dev server 的 `/api` 代理配置

## 14. 默认演示数据

`npm run seed` 会重建演示数据。

### 14.1 项目

- `teamcc-demoproject`（`id = 1`）

### 14.2 默认账号

所有账号默认密码：

```text
password123
```

| 用户名 | 身份 | 后台角色 |
| --- | --- | --- |
| `frontend_dev` | 前端开发 | `viewer` |
| `backend_dev` | 后端开发 | `viewer` |
| `ops_admin` | 运营管理员 | `admin` |
| `vendor_trash` | 外包受限账号 | `viewer` |

推荐用来登录管理台的账号：

```text
ops_admin / password123
```

### 14.3 默认模板

- `前端开发`
- `后端开发`
- `运营部门`
- `垃圾外包`

### 14.4 默认授权关系

四个默认用户都已在 `teamcc-demoproject` 下绑定对应模板，方便直接查看：

- 模板命中
- 生效权限
- 被压制规则
- 审计记录

## 15. 可用脚本

### 15.1 后端

```bash
npm run dev
npm run build
npm start
npm run typecheck
npm run db:push
npm run db:studio
npm run seed
```

### 15.2 前端

```bash
cd frontend
npm run dev
npm run build
npm run preview
npm run lint
```

## 16. 设计文档索引

`docs/` 目录下当前最重要的三份文档：

- `docs/TEAMCC_身份与权限分配架构方案.md`
  - 说明 PBAC 背景、页面职责拆分和远期目标
- `docs/TEAMCC_权限规则规范.md`
  - 说明当前版本规则结构、结算顺序、接口语义
- `docs/TEAMCC_审计日志语义规范提醒.md`
  - 说明客户端事件命名、严重级别和后台展示语义

推荐阅读顺序：

1. 先看本 README，了解当前实际落地能力
2. 再看 `权限规则规范`，理解后端结算逻辑
3. 最后看 `架构方案`，区分未来规划和当前实现

## 17. 当前状态与已知限制

这部分很重要，目的是防止把“设计目标”误认为“已经交付”。

当前已经完成：

- 用户、模板、assignment、部门策略的基础 CRUD
- 按项目结算权限包
- 生效权限预览与规则来源追踪
- 管理台审计列表
- 客户端审计接入与安全 webhook 告警
- 中英文管理界面

当前仍是预留或未完成：

- SSO / OIDC
- 模板签名校验
- 审批流
- Team Policy 继承层
- 客户端实时失效通知 / WebSocket / SSE
- 真正的 skill-graph 服务集成
- Neo4j Browser 内嵌
- 自动化测试体系

当前实现上的几个注意点：

- 前端 API 地址写死为 `http://localhost:3000`
- skill-graph 接口大多是保留占位，不要当成可用生产能力
- `teamcc_audit_logs` 不是当前主查询链路
- Docker Compose 在 worktree 中默认挂载路径不正确，需要手动调整

## 18. 适合什么场景

这个项目目前最适合：

- 本地演示 TeamCC 权限模型
- 联调 TeamCC 客户端的身份包与权限包
- 验证“用户 + 项目”权限结算
- 演练管理侧审计展示和高风险行为告警
- 继续往 SSO、审批流、skill-graph 集成方向扩展

如果你的目标是直接上生产，还需要先补齐：

- 企业认证体系
- 更严格的鉴权与签名校验
- 更完整的审计存储与查询模型
- 自动化测试
- 配置化部署与环境隔离
