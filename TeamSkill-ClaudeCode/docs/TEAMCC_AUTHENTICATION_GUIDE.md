# TeamCC 认证与权限管理指南

**版本**: 1.0  
**日期**: 2026-04-11  
**状态**: ✅ 完全实现

---

## 📋 概述

现在 Claude Code 完全集成了 TeamCC Admin 的认证系统：

✅ **第一次启动**：快速启动，无需认证  
✅ **登陆账户**：使用 `/auth` 命令登陆 TeamCC 账户  
✅ **自动查询**：启动时自动查询账号状态  
✅ **权限更新**：自动更新并加载权限规则  
✅ **缓存支持**：离线时使用缓存，确保功能不中断

---

## 🚀 快速开始（3 步）

### Step 1: 启动 TeamCC Admin

```bash
cd /Users/minruiqing/MyProjects/teamcc-admin
npm run dev

# 输出：
# → listening on http://localhost:3000
```

### Step 2: 启动 Claude Code

```bash
# 添加函数到 shell（如果还没做过）
source ~/.zshrc.teamcc-functions

# 启动
cd /your/project
teamcc

# 或简化：
teamcc /your/project
```

### Step 3: 登陆

在 Claude Code 中运行：

```
/auth
```

输入账号：
```
Username: admin
Password: password123
```

**完成！** 系统会自动：
- 保存认证信息
- 查询你的身份
- 加载权限规则
- 显示登陆成功信息

---

## 📚 详细使用

### 设置 Shell 函数（一次性）

```bash
# 编辑 ~/.zshrc，添加：
source ~/.zshrc.teamcc-functions

# 或手动添加文件内容
cat ~/.zshrc.teamcc-functions >> ~/.zshrc

# 重启 terminal 或运行：
source ~/.zshrc
```

### 启动 Claude Code

```bash
# 方式 1: 当前目录
cd ~/my-project
teamcc

# 方式 2: 指定目录
teamcc ~/my-project

# 方式 3: 绝对路径
teamcc /Users/minruiqing/MyProjects/my-project
```

### 认证命令

#### 登陆

```
/auth
```

交互式输入用户名和密码：
- 向 TeamCC Admin 发送认证请求
- 保存 token 和刷新令牌
- 自动加载权限规则
- 显示登陆信息

#### 查看状态

```
/auth status
```

显示：
- ✅ 认证状态
- 👤 身份信息（用户、部门、团队等）
- 🔐 Token 过期时间
- 配置信息

#### 刷新权限

```
/auth refresh
```

手动重新加载权限规则（无需重启）

#### 登出

```
/auth logout
```

清除本地 token，重启后需要重新登陆

#### 帮助

```
/auth help
```

显示所有可用命令

---

## 🔄 启动流程详解

### 首次启动（未登陆）

```
Claude Code 启动
  ├─ 检查 .claude/teamcc.json（无）
  ├─ 跳过 TeamCC 认证
  ├─ 加载本地身份文件或缓存
  └─ 启动完成（< 1 秒）

状态：❌ Not logged in
操作：运行 /auth 登陆
```

### 登陆后启动

```
Claude Code 启动
  ├─ 找到 .claude/teamcc.json
  ├─ 读取 accessToken
  ├─ 向 TeamCC Admin 查询身份
  ├─ 成功 → 缓存到 .claude/cache/identity.json
  ├─ 自动加载权限规则
  └─ 启动完成（3-5 秒）

状态：✅ Logged in as <username>
```

### 离线启动（无网络）

```
Claude Code 启动
  ├─ 尝试连接 TeamCC Admin
  ├─ 超时（3-5 秒）
  ├─ 使用本地缓存身份
  ├─ 使用本地权限规则
  └─ 启动完成（< 6 秒）

状态：⚠️ Using cached identity
```

---

## 💾 配置文件详解

### `.claude/teamcc.json` - 认证配置

首次登陆时自动创建，包含：

```json
{
  "apiBase": "http://localhost:3000",
  "username": "admin",
  "accessToken": "eyJhbGc...",
  "refreshToken": "c1dd8d...",
  "tokenExpiry": 1775896537000
}
```

**注意**: 此文件包含敏感信息，应该添加到 `.gitignore`：

```
# .gitignore
.claude/teamcc.json
.claude/cache/
```

### `.claude/identity/active.md` - 本地身份

如果没有 TeamCC 认证，创建此文件：

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

### `.claude/cache/` - 缓存目录

自动创建，包含：
- `identity.json` - 身份缓存（1 小时 TTL）
- `permissions-1.json` - 权限缓存（24 小时 TTL）

---

## 🔐 安全最佳实践

### 开发环境

```bash
# 1. 不提交认证信息
echo ".claude/teamcc.json" >> .gitignore
echo ".claude/cache/" >> .gitignore

# 2. 本地化测试
cd ~/my-project
source ~/.zshrc.teamcc-functions
teamcc

# 3. 登陆
# 在 Claude Code 中运行 /auth
```

### 生产环境

```bash
# 1. 使用环境变量（不提交到代码库）
TEAMCC_ADMIN_URL="https://teamcc-admin.example.com" \
TEAMCC_ACCESS_TOKEN="<token>" \
teamcc /production/path

# 2. 或使用 CI/CD secrets
export TEAMCC_ADMIN_URL
export TEAMCC_ACCESS_TOKEN
teamcc /production/path

# 3. 定期刷新权限
# 在 Claude Code 中定期运行 /auth refresh
```

### Token 管理

- **自动刷新**: 5 分钟前过期时自动刷新
- **手动刷新**: 可随时运行 `/auth refresh`
- **过期处理**: 过期 token 自动清除，需要重新 `/auth`

---

## 📊 权限更新工作流

### 自动更新（推荐）

```
启动 Claude Code
  ├─ 加载认证信息
  ├─ 查询 TeamCC Admin 身份
  └─ 自动更新权限规则 ✅

无需手动操作
```

### 手动更新

```bash
# 在 Claude Code 中
/auth refresh

# 系统会：
# 1. 获取最新权限配置
# 2. 与本地规则合并
# 3. 应用"最严格原则"
# 4. 显示加载的规则数量
```

---

## 🧪 测试场景

### 场景 1: 首次使用（无认证）

```bash
# 1. 启动
teamcc ~/my-project

# 2. 验证
/identity
# 输出: No identity configured (正常)

# 3. 登陆
/auth
# 输入: admin / password123

# 4. 验证
/identity
# 输出: 来自 TeamCC 的身份信息
```

### 场景 2: 已认证启动

```bash
# 1. 启动（自动认证）
teamcc ~/my-project

# 2. 查看状态
/auth status
# 输出: ✅ Authenticated
#      Identity: ...
#      Token expires: 59m left

# 3. 刷新权限
/auth refresh
# 输出: ✓ Permissions refreshed
#      500 rules loaded from all sources
```

### 场景 3: TeamCC 不可用

```bash
# 1. 启动（自动降级）
teamcc ~/my-project
# 3-5 秒后启动完成

# 2. 查看状态
/auth status
# 输出: ⚠️ Using cached identity
#      Token might be stale

# 3. 功能正常
# 系统使用缓存身份和本地权限
```

---

## 🔧 故障排除

### Q: 启动卡住或很慢

**A**: 
1. TeamCC Admin 可能没有运行
   ```bash
   curl http://localhost:3000/health
   ```

2. 检查网络连接
   ```bash
   ping localhost:3000
   ```

3. 等待 5 秒（自动超时）

**解决**: TeamCC 不可用时会自动使用本地缓存，继续启动

### Q: 登陆失败 "Connection refused"

**A**: TeamCC Admin 没有运行

```bash
# 启动 TeamCC Admin
cd /Users/minruiqing/MyProjects/teamcc-admin
npm run dev
```

### Q: 登陆失败 "Invalid credentials"

**A**: 用户名或密码错误

```bash
# 确认默认账户
# Username: admin
# Password: password123

# 或在 teamcc-admin 中查看用户列表
npm run seed  # 重新填充测试数据
```

### Q: Token 过期

**A**: 自动刷新或手动刷新

```
/auth refresh
```

或重新登陆：

```
/auth logout
/auth
```

### Q: 权限没有更新

**A**: 手动刷新

```
/auth refresh
```

或重启（自动更新）：

```bash
teamcc /your/project
```

---

## 📈 监控和调试

### 启用详细日志

```bash
DEBUG=*teamcc*,*auth*,*identity* teamcc /your/project
```

日志输出示例：
```
[main] ✅ Loaded identity from TeamCC Admin
[main] ✅ Updated permissions: 500 rules loaded
[auth] Login successful, config saved
```

### 查看配置文件

```bash
# 查看认证配置
cat .claude/teamcc.json | jq .

# 查看身份缓存
cat .claude/cache/identity.json | jq .subject

# 查看权限缓存
cat .claude/cache/permissions-1.json | jq '.rules | length'
```

### 清除所有认证

```bash
# 删除认证配置
rm .claude/teamcc.json

# 清除缓存
rm -rf .claude/cache/

# 清除身份
rm .claude/identity/active.md

# 重启
teamcc /your/project
```

---

## 📞 常见问题

| 问题 | 答案 |
|------|------|
| 每次启动都要登陆吗？ | 不，Token 被缓存并自动刷新 |
| 可以同时登陆多个账户吗？ | 不，但可以用 `/auth logout` 后切换 |
| 离线可以使用吗？ | 可以，系统使用缓存和本地配置 |
| Token 过期怎么办？ | 自动刷新，或手动 `/auth refresh` |
| 如何查看权限规则？ | 暂不支持，将在后续实现 `/permissions` 命令 |
| 能修改权限吗？ | 不能，权限由 TeamCC Admin 定义 |

---

## 🔗 相关文档

- [启动指南](./TEAMCC_STARTUP_GUIDE.md) - 启动问题排查
- [集成方案](./architecture/20260411-teamcc-admin-integration.md) - 架构设计
- [测试指南](./architecture/20260411-teamcc-integration-testing.md) - 详细测试
- [状态报告](./TEAMCC_INTEGRATION_STATUS.md) - 实现进度

---

## 🎯 下一步

### 近期（Phase 3）
- [ ] `/permissions` 命令显示当前权限规则
- [ ] 权限变更通知
- [ ] Token 加密存储

### 中期（Phase 4）
- [ ] 审计日志集成
- [ ] 跨项目权限切换
- [ ] 权限申请流程

---

## 🚀 使用建议

### 对于开发者

1. **首次使用**
   ```bash
   source ~/.zshrc.teamcc-functions
   teamcc ~/my-project
   /auth
   ```

2. **日常使用**
   ```bash
   teamcc ~/my-project
   # 自动认证和权限加载
   ```

3. **多项目切换**
   ```bash
   teamcc ~/project-1
   # ... 工作 ...
   teamcc ~/project-2
   # 每个项目独立的认证
   ```

### 对于团队管理

1. **在 TeamCC Admin 中管理权限**
2. **用户运行 `/auth` 登陆**
3. **权限自动应用和更新**
4. **查看权限应用日志**

---

**祝您使用愉快！有任何问题请参考本指南或查看详细的架构文档。**
