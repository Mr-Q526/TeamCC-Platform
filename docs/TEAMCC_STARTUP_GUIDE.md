# TeamCC 集成启动指南

## 问题修复

**问题**: Claude Code 启动时卡住，一直停留在启动状态  
**原因**: 尝试连接到 TeamCC Admin 但没有超时，导致启动阻塞  
**解决**: 已添加 5 秒超时和智能跳过逻辑

---

## 启动步骤

### 方式 1: 快速启动（推荐新手）

**不需要 TeamCC Admin 运行：**

```bash
# 方式 A: 直接启动（使用本地身份文件）
teamcc /path/to/your/project

# 或者使用 npm
npm run dev

# 或者使用 bun
bun run ./src/bootstrap-entry.ts /path/to/your/project
```

**预期**：立即启动，无需等待

---

### 方式 2: 集成 TeamCC Admin（需要认证）

**Step 1: 启动 TeamCC Admin**

```bash
# 终端 1
cd /Users/minruiqing/MyProjects/teamcc-admin
npm run dev

# 输出：
# → listening on http://localhost:3000
```

**Step 2: 获取有效的 Token**

```bash
# 向 TeamCC Admin 认证
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'

# 复制返回的 accessToken
# 示例: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Step 3: 使用 Token 启动 Claude Code**

```bash
# 终端 2
cd /Users/minruiqing/MyProjects/TeamSkill-ClaudeCode

# 使用环境变量（推荐）
TEAMCC_ADMIN_URL=http://localhost:3000 \
TEAMCC_ACCESS_TOKEN=<your-token-here> \
teamcc /path/to/your/project

# 或者创建 .claude/teamcc.json（见下文）
teamcc /path/to/your/project
```

**预期**：立即启动，从 TeamCC Admin 获取身份

---

## 配置方式

### 方式 A: 环境变量（临时，推荐开发）

```bash
TEAMCC_ADMIN_URL=http://localhost:3000 \
TEAMCC_ACCESS_TOKEN=eyJhbGc... \
teamcc /your/project
```

### 方式 B: 项目配置文件 (`.claude/teamcc.json`)

在项目根目录创建：

```json
{
  "apiBase": "http://localhost:3000",
  "username": "admin",
  "accessToken": "eyJhbGc...",
  "refreshToken": "c1dd8d..."
}
```

然后启动：

```bash
teamcc /your/project
```

### 方式 C: 本地身份文件 (`.claude/identity/active.md`)

如果没有 TeamCC Admin，编辑：

```yaml
---
user_id: 100
org_id: 10
department_id: 102
team_id: 1022
role_id: 202
level_id: 303
---
```

然后启动：

```bash
teamcc /your/project
```

---

## 故障排除

### Q: 启动仍然卡住

**A**: 
1. 确认 TeamCC Admin 没有在运行（如果没有 token）
2. 检查网络连接
3. 尝试使用本地身份文件而不是远程认证

```bash
# 确保没有 .claude/teamcc.json 或环境变量
rm .claude/teamcc.json
unset TEAMCC_ADMIN_URL TEAMCC_ACCESS_TOKEN

# 创建本地身份文件
mkdir -p .claude/identity
cat > .claude/identity/active.md <<'EOF'
---
user_id: 1
department_id: 102
team_id: 1022
role_id: 202
level_id: 303
---
EOF

# 启动
teamcc /your/project
```

### Q: 显示 "Failed to fetch from TeamCC Admin"

**A**: 
- TeamCC Admin 可能没有运行
- Token 可能已过期
- 网络连接问题

```bash
# 检查 TeamCC Admin 是否运行
curl -s http://localhost:3000/health

# 如果不返回，需要先启动
cd /Users/minruiqing/MyProjects/teamcc-admin
npm run dev
```

### Q: 显示 "No identity configured"

**A**: 
- 这是正常的，如果既没有 TeamCC Admin 也没有本地身份文件
- 创建 `.claude/identity/active.md` 或配置 TeamCC

### Q: 网络超时

**A**: 
- 3-5 秒超时是设计的行为
- 启动时会自动跳过不可用的 TeamCC Admin
- 可以安全地忽略超时警告

---

## 完整示例工作流

### 场景 1: 仅使用本地配置（最简单）

```bash
# 1. 创建项目目录
mkdir -p ~/my-project
cd ~/my-project

# 2. 创建本地身份
mkdir -p .claude/identity
cat > .claude/identity/active.md <<'EOF'
---
user_id: 100
department_id: 102
team_id: 1022
role_id: 202
level_id: 303
---
EOF

# 3. 启动 Claude Code
teamcc ~/my-project

# 4. 验证
/identity
# 输出: User ID: 100, Department: backend, ...
```

### 场景 2: 与 TeamCC Admin 集成（完整）

```bash
# 终端 1: 启动 TeamCC Admin
cd /Users/minruiqing/MyProjects/teamcc-admin
npm run dev

# 终端 2: 获取 Token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' | \
  grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo "Token: $TOKEN"

# 终端 3: 启动 Claude Code
cd /Users/minruiqing/MyProjects/TeamSkill-ClaudeCode
TEAMCC_ADMIN_URL=http://localhost:3000 \
TEAMCC_ACCESS_TOKEN=$TOKEN \
teamcc ~/my-project

# 4. 验证
/identity
# 输出: 来自 TeamCC Admin 的身份信息
```

---

## 超时行为详解

### 启动流程图

```
Claude Code 启动
  │
  ├─ 检查 .claude/teamcc.json 或 env 变量
  │  ├─ 有 accessToken? 
  │  │  ├─ 是 → 尝试从 TeamCC Admin 获取身份 (5秒超时)
  │  │  │    ├─ 成功 → 缓存并继续
  │  │  │    ├─ 超时 → 日志警告，继续
  │  │  │    └─ 失败 → 使用本地缓存
  │  │  │
  │  │  └─ 否 → 跳过 TeamCC
  │  │
  │  └─ 无配置 → 跳过 TeamCC
  │
  ├─ 尝试加载 .claude/cache/identity.json
  │  ├─ 有效 → 使用缓存
  │  └─ 无效/过期 → 继续
  │
  ├─ 尝试加载 .claude/identity/active.md
  │  ├─ 存在 → 使用本地文件
  │  └─ 不存在 → 无身份
  │
  └─ 启动完成（总耗时 < 5 秒）
```

### 日志示例

```
[main] Loaded identity from TeamCC Admin
# → 成功从远程加载

[main] Using cached identity from TeamCC Admin
# → 远程超时，使用本地缓存

[main] Failed to fetch from TeamCC Admin: <timeout error>
# → 超时但有本地文件，继续

[main] Skipping TeamCC: No token configured
# → 正常跳过，使用本地配置
```

---

## 最佳实践

### 开发环境

1. **使用本地身份文件**（最快）
   ```bash
   # 创建一次，然后忘记它
   mkdir -p .claude/identity
   cat > .claude/identity/active.md <<EOF
   ---
   user_id: 100
   department_id: 102
   team_id: 1022
   role_id: 202
   level_id: 303
   ---
   EOF
   ```

2. **如果需要 TeamCC，使用环境变量**
   ```bash
   # 不要提交到 git
   TEAMCC_ADMIN_URL=http://localhost:3000 \
   TEAMCC_ACCESS_TOKEN=$TOKEN \
   teamcc ~/my-project
   ```

### 生产环境

1. **总是配置 TeamCC Admin URL + Token**
2. **使用 CI/CD 变量存储 Token**
3. **启用审计日志**

---

## 相关命令

```bash
# 查看当前身份
/identity

# 启用详细日志
DEBUG=*teamcc*,*identity* teamcc /your/project

# 清除缓存
rm -rf .claude/cache

# 清除 Token
rm .claude/teamcc.json

# 测试 TeamCC Admin 连接
curl http://localhost:3000/health

# 获取新 Token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

---

## 常见问题解答

**Q: 每次启动都要输入 Token?**  
A: 不需要。Token 会被缓存在 `.claude/teamcc.json` 中，使用 `refreshToken` 自动刷新。

**Q: 可以同时运行多个项目吗?**  
A: 可以。每个项目目录有独立的 `.claude/` 配置，不会相互干扰。

**Q: 为什么需要 5 秒超时?**  
A: 防止启动卡住。如果 TeamCC Admin 不可用，5 秒后自动降级到本地配置。

**Q: Token 过期了怎么办?**  
A: 会自动使用 refreshToken 获取新的 accessToken。如果 refreshToken 也过期了，重新运行 `/login`。

**Q: 离线可以使用吗?**  
A: 可以。如果有本地身份文件或缓存，完全可以离线工作。

---

## 更新日志

**2026-04-11**: 
- ✅ 修复启动卡住问题
- ✅ 添加 5 秒超时机制
- ✅ 改进错误处理和日志
- ✅ 支持优雅降级
