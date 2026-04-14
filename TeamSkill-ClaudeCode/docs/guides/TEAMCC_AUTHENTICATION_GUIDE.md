# TeamCC 认证与权限管理指南

**版本**: 2.0
**日期**: 2026-04-12
**状态**: 与当前企业版实现对齐

## 概述

当前 TeamSkill-ClaudeCode 的认证口径已经收敛：

- `TeamCC Admin` 是唯一身份源。
- `PermissionBundle` 是企业权限控制面的主要输入。
- 本地身份文件方案已取消。
- 权限和 Skill 治理是同一控制面的两侧，不再分开描述。

---

## 你需要知道的几件事

### 1. 登录方式

优先使用：

```text
/login
```

也支持：

```text
/auth
```

### 2. 常用命令

```text
/login
/logout
/auth status
/auth refresh
/identity
/permissions
```

### 3. 启动时会发生什么

如果本地已有 TeamCC 配置，Claude Code 会在启动时：

1. 读取 token
2. 请求 `/identity/me`
3. 请求 `/policy/bundle`
4. 缓存 identity 和 permission bundle
5. 初始化权限上下文

如果远端失败但本地缓存仍有效，则回退到缓存。

---

## 快速开始

### Step 1: 启动 TeamCC Admin

```bash
cd /Users/minruiqing/MyProjects/teamcc-admin
npm run dev
```

### Step 2: 启动 Claude Code

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/worktrees/teamcc/TeamSkill-ClaudeCode
bun run dev
```

### Step 3: 登录

在 REPL 中执行：

```text
/login
```

成功后建议立刻检查：

```text
/auth status
/identity
/permissions
```

---

## 命令说明

### `/login`

首选的人机交互式登录入口。

行为：

- 提示输入用户名和密码
- 调用 `POST /auth/login`
- 保存本地配置
- 拉取身份
- 写入身份缓存

### `/logout`

清理 TeamCC 配置并删除主要缓存：

- `.claude/teamcc.json`
- `.claude/cache/identity.json`
- `.claude/cache/permission-bundle-<projectId>.json`

### `/auth status`

查看当前 TeamCC 状态：

- 是否已登录
- 当前身份摘要
- token 过期信息
- API 地址

### `/auth refresh`

手动刷新 TeamCC 权限规则。

适用于：

- 后台权限模板刚调整
- 需要验证最新 bundle
- 调试权限规则生效情况

### `/identity`

查看当前挂载到运行时的身份信息。

### `/permissions`

查看当前权限 UI。它已经纳入当前命令集合，但 TeamCC 来源可见性仍在继续优化。

---

## 配置与缓存

### 项目级配置

```text
.claude/teamcc.json
```

示例：

```json
{
  "apiBase": "http://localhost:3000",
  "username": "admin",
  "accessToken": "eyJhbGc...",
  "refreshToken": "c1dd8d...",
  "tokenExpiry": 1775896537000
}
```

### 用户级配置

```text
~/.teamcc/config.json
```

适合在多个项目之间复用 TeamCC 凭证。

### 环境变量

```bash
TEAMCC_ADMIN_URL=http://localhost:3000
TEAMCC_ACCESS_TOKEN=...
TEAMCC_REFRESH_TOKEN=...
```

### 缓存目录

```text
.claude/cache/identity.json
.claude/cache/permission-bundle-<projectId>.json
```

---

## 启动模式

### 模式 A: 企业正常模式

前提：

- 已登录 TeamCC，或已注入有效 token

结果：

- 启动时自动获取身份
- 自动拉取权限包
- 权限上下文按企业配置初始化

### 模式 B: 缓存回退模式

前提：

- 之前成功登录过
- 当前远端暂时不可达

结果：

- 使用本地 identity cache 和 permission bundle cache
- 维持有限的离线可用性

### 模式 C: 恢复/调试模式

前提：

- 没有任何 TeamCC 配置

结果：

- CLI 可以启动
- 但不具备企业身份与权限能力

---

## 安全建议

### 1. 不把认证文件提交到仓库

```gitignore
.claude/teamcc.json
.claude/cache/
```

### 2. 优先使用 `/login` 或用户级配置

避免在项目脚本中长期硬编码 token。

### 3. token 失效时优先重新登录

```text
/logout
/login
```

### 4. 不再维护本地身份文件

`.claude/identity/active.md` 及其派生工作流已经废弃，不应继续出现在新文档、新脚本或新流程中。

---

## 常见问题

### Q: 执行 `/identity` 仍然显示没有身份

说明当前没有成功建立 TeamCC 身份上下文。优先检查：

1. `teamcc-admin` 是否正在运行
2. token 是否有效
3. 本地是否已有有效缓存

### Q: 可以完全离线工作吗

可以离线命中缓存，但不能把“完全离线 + 无历史缓存”视为企业主路径。

### Q: 为什么不能再用 `.claude/identity/active.md`

因为企业版身份与权限必须可审计、可回收、可失效、可统一下发。本地身份票据满足不了这四点。

---

## 相关文档

- `docs/TEAMCC_STARTUP_GUIDE.md`
- `docs/TEAMCC_INTEGRATION_STATUS.md`
- `docs/architecture/20260411-teamcc-admin-integration.md`
- `docs/architecture/20260411-teamcc-integration-testing.md`
