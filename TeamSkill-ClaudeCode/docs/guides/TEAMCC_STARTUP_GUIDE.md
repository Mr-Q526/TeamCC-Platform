# TeamCC 企业版启动指南

**更新时间**: 2026-04-12

## 适用范围

本文描述当前收敛后的启动方式：

- `TeamCC Admin` 是企业版的唯一身份与权限源。
- 已取消 `.claude/identity/active.md` 方案。
- 未接入 TeamCC 时，CLI 只能作为本地恢复或调试工具使用，不具备企业身份与权限能力。

---

## 推荐启动方式

### 方式 1: 交互式登录

适合本地开发和日常使用。

#### Step 1: 启动 TeamCC Admin

```bash
cd /Users/minruiqing/MyProjects/teamcc-admin
npm run dev
```

默认地址：

```bash
http://localhost:3000
```

#### Step 2: 启动 Claude Code

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/worktrees/teamcc/TeamSkill-ClaudeCode
bun run dev
```

#### Step 3: 在 REPL 中登录

```text
/login
```

登录成功后可检查：

```text
/auth status
/identity
/permissions
```

---

### 方式 2: 使用预置 token 启动

适合联调、CI 或本地免交互调试。

```bash
TEAMCC_ADMIN_URL=http://localhost:3000 \
TEAMCC_ACCESS_TOKEN=<your-access-token> \
TEAMCC_REFRESH_TOKEN=<optional-refresh-token> \
bun run dev
```

也可以写入项目配置：

```json
{
  "apiBase": "http://localhost:3000",
  "username": "admin",
  "accessToken": "eyJhbGc...",
  "refreshToken": "c1dd8d...",
  "tokenExpiry": 1775896537000
}
```

文件位置：

```text
.claude/teamcc.json
```

---

### 方式 3: 无 TeamCC 的恢复/调试模式

如果既没有环境变量，也没有 TeamCC 配置，CLI 仍可启动，但它不具备以下能力：

- 企业身份注入
- TeamCC 权限包下发
- 企业版 Skill 可见性边界

这个模式只应用于：

- 源码恢复和跑通 CLI
- 调试不依赖企业身份的功能
- 离线查看代码与非企业命令

---

## 启动流程

```text
Claude Code 启动
  │
  ├─ 读取 .claude/teamcc.json / ~/.teamcc/config.json / env
  │
  ├─ 有 TeamCC 配置?
  │  ├─ 否 → 进入本地恢复/调试模式
  │  └─ 是
  │
  ├─ 有 accessToken?
  │  ├─ 否 → 企业路径下提示先登录
  │  └─ 是
  │
  ├─ GET /identity/me
  │  ├─ 成功 → 缓存 identity
  │  └─ 失败 → 尝试 identity cache
  │
  ├─ GET /policy/bundle?projectId=...
  │  ├─ 成功 → 缓存 permission bundle
  │  └─ 失败 → 尝试 permission bundle cache
  │
  └─ 初始化 ToolPermissionContext
```

---

## 常见问题

### Q: 启动后提示没有身份

这通常意味着：

- 还没有登录 TeamCC
- TeamCC 不可达且本地没有有效缓存
- 当前就是无 TeamCC 的恢复/调试模式

排查顺序：

```text
/auth status
/login
/identity
```

### Q: 提示 token 失效或需要重新登录

说明本地 `accessToken` 已过期且刷新失败。处理方式：

```text
/logout
/login
```

如果是环境变量注入方式，直接换新 token 后重启。

### Q: TeamCC 服务不可达时还能不能启动

可以，前提是之前已经成功拉取过缓存。

缓存文件：

```text
.claude/cache/identity.json
.claude/cache/permission-bundle-<projectId>.json
```

如果没有缓存，则企业身份与权限无法建立。

### Q: 现在还能不能用 `.claude/identity/active.md`

不能。该方案已经取消，不再作为企业版入口。

---

## 推荐验证清单

### 初次接入

1. 启动 `teamcc-admin`
2. 启动 Claude Code
3. 执行 `/login`
4. 执行 `/auth status`
5. 执行 `/identity`
6. 打开 `/permissions`

### 离线回退

1. 联机登录一次
2. 停掉 `teamcc-admin`
3. 重新启动 Claude Code
4. 检查是否命中缓存

### 权限验证

1. 在 TeamCC Admin 调整项目权限模板
2. 重启或刷新权限
3. 用 `/permissions` 或实际工具调用验证结果

---

## 相关文档

- `docs/TEAMCC_AUTHENTICATION_GUIDE.md`
- `docs/TEAMCC_INTEGRATION_STATUS.md`
- `docs/architecture/20260411-teamcc-admin-integration.md`
- `docs/architecture/20260411-teamcc-integration-testing.md`
