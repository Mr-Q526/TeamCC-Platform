# TeamCC Admin 集成测试指南

**日期**: 2026-04-12
**阶段**: 企业身份与权限主链路验证

## 测试目标

验证以下链路已经可用：

1. 登录后能拿到 TeamCC 身份
2. 权限 bundle 能被拉取并注入运行时
3. 远端不可达时能回退到缓存
4. token 失效时能触发重新登录
5. 无 TeamCC 配置时仅进入恢复/调试模式

> 注意：本测试指南不再包含 `.claude/identity/active.md` 的任何场景，该方案已废弃。

---

## 环境准备

### 终端 1: 启动 TeamCC Admin

```bash
cd /Users/minruiqing/MyProjects/teamcc-admin
npm run dev
```

### 终端 2: 启动 Claude Code

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/worktrees/teamcc/TeamSkill-ClaudeCode
bun run dev
```

---

## 场景 1: 交互式登录

**目标**: 验证 `/login` 能完成 TeamCC 登录与身份缓存

### 步骤

在 REPL 中执行：

```text
/login
```

然后检查：

```text
/auth status
/identity
```

### 预期结果

- 登录成功
- `/auth status` 显示已登录
- `/identity` 显示 TeamCC 返回的身份信息
- 本地生成：

```text
.claude/teamcc.json
.claude/cache/identity.json
```

---

## 场景 2: 使用环境变量启动

**目标**: 验证预置 token 的非交互路径

### 步骤

先从 TeamCC Admin 获取 token：

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

然后使用环境变量启动：

```bash
TEAMCC_ADMIN_URL=http://localhost:3000 \
TEAMCC_ACCESS_TOKEN=<access-token> \
TEAMCC_REFRESH_TOKEN=<refresh-token> \
bun run dev
```

### 预期结果

- 启动时自动拉取身份
- 启动时自动拉取权限包
- `/identity` 可直接看到身份

---

## 场景 3: 远端不可达但缓存存在

**目标**: 验证缓存回退

### 步骤

1. 先完成一次成功登录
2. 确认以下文件存在：

```text
.claude/cache/identity.json
.claude/cache/permission-bundle-<projectId>.json
```

3. 停掉 `teamcc-admin`
4. 重启 Claude Code

### 预期结果

- 启动不应直接崩掉
- 命中身份缓存
- 命中权限包缓存
- 权限上下文仍可初始化

---

## 场景 4: token 失效或刷新失败

**目标**: 验证重新登录路径

### 步骤

可以用以下任一方式模拟：

1. 手动写入无效 token 到 `.claude/teamcc.json`
2. 在 TeamCC Admin 侧使 refresh token 失效

然后重启 Claude Code，或在 REPL 中检查：

```text
/auth status
```

### 预期结果

- 企业路径下出现需要重新登录的提示
- 用户执行 `/login` 后可恢复

---

## 场景 5: 权限注入验证

**目标**: 验证 TeamCC 权限不是只拉取不生效

### 步骤

1. 在 TeamCC Admin 中为测试项目配置一条明显的 deny 规则
2. 登录 Claude Code
3. 尝试执行会命中该规则的工具行为
4. 打开：

```text
/permissions
```

### 预期结果

- 相关行为被拒绝或按预期进入 ask
- 本地规则与 TeamCC 规则按“最严格原则”工作

---

## 场景 6: 无 TeamCC 配置启动

**目标**: 明确非企业模式的行为边界

### 步骤

1. 移除以下配置：

```text
.claude/teamcc.json
~/.teamcc/config.json
TEAMCC_ADMIN_URL
TEAMCC_ACCESS_TOKEN
TEAMCC_REFRESH_TOKEN
```

2. 启动 Claude Code

### 预期结果

- CLI 仍可用于本地恢复/调试
- 但没有企业身份上下文
- `/identity` 可能为空

---

## 调试建议

### 常用命令

```text
/login
/logout
/auth status
/auth refresh
/identity
/permissions
```

### 调试日志

```bash
DEBUG=*teamcc*,*identity*,*permissions* bun run dev
```

---

## 验收标准

- TeamCC 登录成功后，本地能建立稳定身份缓存
- TeamCC 权限包能影响运行时权限上下文
- 远端不可达但缓存有效时，CLI 仍能维持企业路径的基本可用性
- token 失效时，系统能明确引导重新登录
- 文档、测试和实际代码路径都不再依赖本地身份文件
