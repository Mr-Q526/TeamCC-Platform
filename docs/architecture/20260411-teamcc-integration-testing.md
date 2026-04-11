# TeamCC Admin 集成测试指南

**日期**: 2026-04-11  
**阶段**: Phase 1 & 2 完成，测试验证

## 快速开始

### 环境设置

```bash
# 终端 1: 启动 TeamCC Admin
cd /Users/minruiqing/MyProjects/teamcc-admin
npm run dev
# 输出: 后端运行在 http://localhost:3000

# 终端 2: 启动 Claude Code
cd /Users/minruiqing/MyProjects/TeamSkill-ClaudeCode
npm run dev
# 或者使用 TeamCC Admin URL
TEAMCC_ADMIN_URL=http://localhost:3000 npm run dev
```

### 测试场景 1: 身份认证（Phase 1）

**目标**：验证 Claude Code 能从 TeamCC Admin 获取用户身份

#### 步骤 1: 验证身份加载

```bash
# 在 Claude Code REPL 中
/identity

# 预期输出（无身份时）：
# No identity configured.
# Identity can be loaded from:
# 1. TeamCC Admin (remote)...
# 2. Local file — .claude/identity/active.md
```

#### 步骤 2: 使用本地身份文件

```bash
# 创建 .claude/identity/active.md
cat > .claude/identity/active.md <<'EOF'
---
user_id: 100
org_id: 10
department_id: 102
team_id: 1022
role_id: 202
level_id: 303
---
EOF

# 重新启动 Claude Code
npm run dev

# 验证
/identity

# 预期输出：
# Current Identity:
#   User ID: 100
#   Org: org_tech_hub
#   Department: backend
#   Team: order-service
#   Role: java-developer
#   Level: p5
#   Project ID: 1
```

#### 步骤 3: 从 TeamCC Admin 加载身份

```bash
# 确保 TeamCC Admin 正在运行并已填充数据
# 在 teamcc-admin 目录中运行过 npm run seed

# 创建 .claude/teamcc.json
cat > .claude/teamcc.json <<'EOF'
{
  "apiBase": "http://localhost:3000",
  "username": "admin"
}
EOF

# 使用凭证登录 (模拟)
# 实际上需要从 teamcc-admin 获取有效的 token
# 为了测试，可以直接创建以下文件

# 执行 login 获取 token (future command)
# /login
# Username: admin
# Password: password123

# 或者手动设置 token
TEAMCC_ACCESS_TOKEN="<从 teamcc-admin /auth/login 获取的 token>" npm run dev

# 验证
/identity

# 预期输出：
# Current Identity:
#   User ID: 1
#   Department: frontend
#   Team: commerce-web
#   Role: frontend-developer
#   Level: p6
#   Project ID: 1
#   ... (来自 TeamCC Admin)
```

---

### 测试场景 2: 权限配置（Phase 2）

**目标**：验证权限规则从 TeamCC Admin 和本地设置被正确加载和合并

#### 步骤 1: 准备权限配置

```bash
# 在 TeamCC Admin 中，确保已有权限模板数据
# npm run seed 已创建了 7 个模板

# 创建 Claude Code 的本地权限配置
cat > settings.json <<'EOF'
{
  "permissions": {
    "allow": [
      "Read src/**"
    ],
    "deny": [
      "Edit src/server/**",
      "Write /private/**"
    ],
    "ask": [
      "Bash rm -rf"
    ]
  }
}
EOF
```

#### 步骤 2: 验证权限加载

```typescript
// 在 Claude Code 源代码中测试（需要修改 main.tsx）
import { loadAndMergeAllPermissionRules } from './utils/permissions/teamccIntegration.js'

// 执行合并
const merged = await loadAndMergeAllPermissionRules(1)

// 预期输出（日志）：
// [teamcc-integration] Loaded 0 rules from TeamCC Admin (no token yet)
// [teamcc-integration] Loaded 3 rules from local settings
// [teamcc-integration] Merged 3 rules into 3 merged rules
```

#### 步骤 3: 验证规则优先级

```bash
# 创建冲突的规则场景

# settings.json:
{
  "permissions": {
    "allow": ["Read **"],
    "deny": ["Read src/private/**"]
  }
}

# 预期行为：
# 当检查 src/private/secret.txt 时:
# - 本地 allow: Read **
# - 本地 deny: Read src/private/**
# 结果: deny (最严格原则)
```

#### 步骤 4: 测试多源规则合并

```bash
# 假设 TeamCC Admin 返回：
# deny: Edit **
# allow: Read **

# 本地 settings.json：
# allow: Edit src/client/**
# ask: Bash rm

# 合并后规则：
# - Read ** → allow (只有一个源)
# - Edit ** → deny (teamcc: deny > local: allow)
# - Bash rm → ask (只有一个源)
```

---

## 调试命令

### 查看身份信息

```bash
/identity
# 显示当前加载的身份

/identity clear
# 清除身份配置
```

### 查看权限规则（未来实现）

```bash
/permissions
# 显示所有合并后的权限规则，包括来源信息
```

### 启用调试日志

```bash
DEBUG=*identity*,*teamcc* npm run dev
# 或
DEBUG=*permissions*,*rules* npm run dev
```

---

## 常见问题

### Q: 身份加载失败，提示 "No access token available"

**A**: 
1. 检查 `.claude/teamcc.json` 中是否有有效的 token
2. 或者使用本地 `.claude/identity/active.md` 文件
3. 或者等待 `/login` 命令实现

### Q: 权限规则没有生效

**A**:
1. 检查 `settings.json` 的格式是否正确：
   ```json
   {
     "permissions": {
       "allow": ["Read **"],
       "deny": ["Edit /path/**"],
       "ask": ["Bash *"]
     }
   }
   ```
2. 检查权限规则是否与工具名称匹配（如 "Read", "Edit", "Write", "Bash")
3. 查看调试日志了解规则加载过程

### Q: 本地规则和 TeamCC Admin 规则如何优先级？

**A**: 使用"最严格原则"：
- deny > ask > allow
- 与来源无关，只看行为严格程度
- 例如：本地 allow + TeamCC deny = 最终 deny

---

## 手动集成测试

### 验证 IdentityProfile 转换

```typescript
import { envelopeToProfile } from './utils/identity.js'

const envelope = {
  schema: 'identity-envelope-v1',
  subject: {
    userId: 1,
    username: 'admin',
    email: 'admin@example.com',
    departmentId: 102,
    teamId: 1022,
    roleId: 202,
    levelId: 303,
    defaultProjectId: 7
  },
  timestamp: '2026-04-11T00:00:00Z',
  expiry: '2026-04-12T00:00:00Z'
}

const profile = envelopeToProfile(envelope, 7)
// 预期：
// {
//   userId: 1,
//   departmentId: 102,
//   teamId: 1022,
//   roleId: 202,
//   levelId: 303,
//   projectId: 7,
//   orgId: null
// }
```

### 验证规则合并

```typescript
import { mergeRules } from './utils/permissions/rulesMerger.js'

const rules = [
  {
    source: 'userSettings',
    ruleBehavior: 'allow',
    ruleValue: { toolName: 'Read', ruleContent: '**' }
  },
  {
    source: 'teamccAdmin',
    ruleBehavior: 'deny',
    ruleValue: { toolName: 'Read', ruleContent: 'src/private/**' }
  },
  {
    source: 'projectSettings',
    ruleBehavior: 'allow',
    ruleValue: { toolName: 'Edit', ruleContent: 'src/client/**' }
  }
]

const merged = mergeRules(rules)
// 预期：
// [
//   {
//     source: 'teamccAdmin',
//     ruleBehavior: 'deny',
//     ruleValue: { toolName: 'Read', ruleContent: 'src/private/**' },
//     mergedFrom: [...]  // 所有同目标的规则
//   },
//   {
//     source: 'projectSettings',
//     ruleBehavior: 'allow',
//     ruleValue: { toolName: 'Edit', ruleContent: 'src/client/**' },
//     mergedFrom: [...]
//   }
// ]
```

---

## 性能考虑

### 缓存策略

- **Identity**: 缓存 TTL 1 小时 (`.claude/cache/identity.json`)
- **PermissionBundle**: 缓存 TTL 24 小时 (`.claude/cache/permissions-{projectId}.json`)
- 启动时异步加载，不阻塞初始化

### 离线支持

1. 如果 TeamCC Admin 不可用，自动降级到本地缓存
2. 如果本地缓存过期，自动降级到本地文件
3. 整个链条都失败时，使用空权限配置（全部 allow）

---

## 下一步（Phase 3 & 4）

### Phase 3: UI 命令

- [ ] `/login` - 认证命令
- [ ] `/identity` - 查看身份 (已实现基础)
- [ ] `/permissions` - 查看权限规则
- [ ] `/logout` - 登出

### Phase 4: 高级缓存

- [ ] 实现权限 bundle 缓存持久化
- [ ] 缓存过期策略
- [ ] 手动刷新命令 `/permissions-refresh`
- [ ] 审计日志集成

---

## 文件清单

### 新增文件

- `src/bootstrap/teamccAuth.ts` - Token 和认证管理
- `src/commands/identity.tsx` - /identity 命令
- `src/utils/permissions/teamccLoader.ts` - 权限包加载
- `src/utils/permissions/rulesMerger.ts` - 规则合并
- `src/utils/permissions/teamccIntegration.ts` - 集成主模块

### 修改文件

- `src/main.tsx` - 启动时加载身份
- `src/utils/identity.ts` - 支持远程身份源
- `src/commands.ts` - 注册 identity 命令
- `src/types/permissions.ts` - 添加 teamccAdmin 源

---

## 文件位置参考

```
TeamSkill-ClaudeCode/
├── .claude/
│   ├── identity/
│   │   └── active.md (本地身份文件)
│   ├── teamcc.json (teamcc-admin 配置)
│   └── cache/
│       ├── identity.json (身份缓存)
│       └── permissions-1.json (权限缓存)
├── docs/architecture/
│   ├── 20260411-teamcc-admin-integration.md (总体方案)
│   ├── 20260411-teamcc-integration-testing.md (本文件)
├── src/
│   ├── bootstrap/
│   │   └── teamccAuth.ts
│   ├── commands/
│   │   └── identity.tsx
│   ├── utils/permissions/
│   │   ├── teamccLoader.ts
│   │   ├── rulesMerger.ts
│   │   └── teamccIntegration.ts
│   └── ...
└── ...
```

---

## 相关文档

- [TeamCC Admin 集成方案](./20260411-teamcc-admin-integration.md) - 总体设计
- [TeamCC Admin 架构](../teamcc-admin-architecture.md) - API 设计
