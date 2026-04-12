# TeamCC Admin 集成状态

**最后更新**: 2026-04-11  
**状态**: Phase 1 & 2 完成 ✅

## 🎯 总体目标

在 Claude Code 中集成来自 TeamCC Admin 的身份认证和权限管理系统，实现统一的身份验证和权限检查。

---

## 📊 实现进度

### ✅ Phase 1: 身份认证与拉取（完成）

**目标**: Claude Code 能从 TeamCC Admin 获取用户身份信息

**已实现**：
- [x] `src/bootstrap/teamccAuth.ts` - Token 管理和认证
  - 配置加载 (项目级 + 用户级 + 环境变量)
  - Token 刷新逻辑
  - 远程身份获取
  - 本地缓存支持
  - 登出功能

- [x] `src/utils/identity.ts` 增强
  - `envelopeToProfile()` - IdentityEnvelope 转换
  - `loadLocalIdentityProfile()` - 本地文件分离
  - 支持远程身份源

- [x] `src/main.tsx` 集成
  - 启动时自动认证
  - 三层降级：远程 → 本地缓存 → 本地文件

- [x] `src/commands/identity.tsx` - `/identity` 命令
  - 查看当前身份信息
  - 清除身份配置
  - 友好的错误信息

**关键特性**：
- 远程身份获取失败时自动降级
- 环境变量支持 `TEAMCC_ADMIN_URL`, `TEAMCC_ACCESS_TOKEN`
- Token 过期时自动刷新
- 本地 JSON 缓存

---

### ✅ Phase 2: 权限配置拉取与合并（完成）

**目标**: 从 TeamCC Admin 拉取权限配置，与本地规则合并

**已实现**：
- [x] `src/utils/permissions/teamccLoader.ts` - 权限包加载
  - 从 `/policy/bundle` 端点获取权限
  - 格式转换 (PermissionBundleRule → PermissionRule)
  - 缓存和降级支持
  - 获取 Capabilities 和 EnvOverrides

- [x] `src/utils/permissions/rulesMerger.ts` - 规则合并
  - 分组规则 (tool + content 组合)
  - "最严格原则" 合并 (deny > ask > allow)
  - 规则过滤 (按工具名、按内容)
  - 诊断和调试

- [x] `src/utils/permissions/teamccIntegration.ts` - 集成主模块
  - 加载所有权限源
  - 协调多源合并
  - 诊断汇总

- [x] `src/types/permissions.ts` 更新
  - 添加 `'teamccAdmin'` 到 `PermissionRuleSource`

**关键特性**：
- 多源规则合并：TeamCC Admin + settings.json + CLAUDE.md
- "最严格原则"：deny 覆盖 ask，ask 覆盖 allow
- 源追踪：每条合并规则保留来源信息
- 智能降级：远程失败时使用本地规则
- 规则过滤：支持通配符和 glob 模式

**规则合并示例**：
```
TeamCC Admin:   deny Edit **
Local settings: allow Edit src/client/**
结果:           deny Edit ** (最严格)
```

---

### ⏳ Phase 3: UI 命令与交互（未开始）

**目标**: 提供用户友好的登录和权限管理命令

**计划实现**：
- [ ] `/login` 命令 - 交互式认证
  - 提示输入用户名和密码
  - 向 TeamCC Admin 认证
  - 保存 token 到 .claude/teamcc.json
  
- [ ] `/identity` 命令增强
  - 显示更详细的身份信息
  - 显示缓存状态和过期时间
  
- [ ] `/permissions` 命令 - 查看权限规则
  - 显示所有合并后的规则
  - 按工具分组
  - 显示来源信息
  - 支持查询特定工具的规则
  
- [ ] `/logout` 命令
  - 清除本地 token
  - 清除缓存

---

### ⏳ Phase 4: 高级缓存与离线支持（未开始）

**目标**: 完善缓存策略，支持完全离线工作

**计划实现**：
- [ ] 权限 Bundle 持久化缓存
  - `.claude/cache/permissions-{projectId}.json`
  - 24小时 TTL
  
- [ ] 缓存过期策略
  - 自动过期检查
  - 软过期（使用但尝试刷新）vs 硬过期（不使用）
  
- [ ] 手动刷新命令
  - `/permissions-refresh` - 强制刷新权限
  - `/identity-refresh` - 强制刷新身份
  
- [ ] 审计日志
  - 权限检查日志
  - 规则应用日志
  - 集成到现有审计系统

---

## 📁 代码结构

```
src/
├── bootstrap/
│   └── teamccAuth.ts              ← Phase 1: Token & Auth
├── commands/
│   ├── identity.tsx               ← Phase 1: /identity 命令
│   └── (login.tsx, permissions.tsx 在 Phase 3)
├── utils/
│   ├── identity.ts                ← Phase 1: 身份加载
│   └── permissions/
│       ├── teamccLoader.ts        ← Phase 2: 权限包加载
│       ├── rulesMerger.ts         ← Phase 2: 规则合并
│       ├── teamccIntegration.ts   ← Phase 2: 集成主模块
│       └── permissionsLoader.ts   ← 现有: 本地权限加载
├── main.tsx                       ← Phase 1: 启动集成
└── types/
    └── permissions.ts             ← Phase 2: 新增 teamccAdmin 源

docs/architecture/
├── 20260411-teamcc-admin-integration.md      ← 总体方案
├── 20260411-teamcc-integration-testing.md    ← 测试指南
└── TEAMCC_INTEGRATION_STATUS.md              ← 本文档
```

---

## 🔧 配置示例

### 项目级配置 (`.claude/teamcc.json`)

```json
{
  "apiBase": "http://localhost:3000",
  "username": "admin",
  "accessToken": "eyJhbGc...",
  "refreshToken": "c1dd8d...",
  "tokenExpiry": 1775896537000
}
```

### 环境变量

```bash
TEAMCC_ADMIN_URL=http://localhost:3000
TEAMCC_ACCESS_TOKEN=eyJhbGc...
TEAMCC_REFRESH_TOKEN=c1dd8d...
```

### 本地身份文件 (`.claude/identity/active.md`)

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

---

## 🚀 快速测试

### 1. 启动两个服务

```bash
# 终端 1: TeamCC Admin
cd /Users/minruiqing/MyProjects/teamcc-admin
npm run dev
# → http://localhost:3000

# 终端 2: Claude Code
cd /Users/minruiqing/MyProjects/TeamSkill-ClaudeCode
npm run dev
```

### 2. 验证身份加载

```bash
# 在 Claude Code 中
/identity

# 预期输出 (如果有本地文件或远程身份)
# Current Identity:
#   User ID: 100
#   Department: backend
#   Team: order-service
#   Role: java-developer
#   Level: p5
#   Project ID: 1
```

### 3. 验证权限合并

- 编辑 `settings.json` 添加本地权限
- 检查日志看规则是否正确合并
- 验证权限检查使用了合并后的规则

---

## 🔗 关键集成点

### 身份注入
```typescript
// src/main.tsx
const profile = await loadIdentityProfile(getCwd())
setIdentityProfile(profile)
```

### 权限合并
```typescript
// 未来在 permissions/permissions.ts 中
const merged = await loadAndMergeAllPermissionRules(projectId)
// 在权限检查时使用 merged 规则
```

### 缓存路径
```
.claude/
├── identity/
│   └── active.md
├── cache/
│   ├── identity.json
│   └── permissions-{projectId}.json
└── teamcc.json
```

---

## 📋 已知限制

### Phase 1

- [ ] 尚未实现 `/login` 命令 (需要交互式 I/O)
- [x] Token 刷新已实现
- [x] 离线降级已实现

### Phase 2

- [ ] 权限 Bundle 缓存持久化未实现（框架就位）
- [x] 规则合并已完全实现
- [x] 多源加载已实现
- [x] 智能降级已实现

### General

- 权限检查尚未真正集成到工具执行流程
  - 规则加载已准备好
  - 集成需要修改 `Tool.ts` 中的权限检查逻辑
- 审计日志记录未实现（后续阶段）

---

## 🧪 测试清单

- [ ] 本地身份文件加载
- [ ] 远程身份获取与缓存
- [ ] 本地权限规则加载
- [ ] 远程权限包获取
- [ ] 多源规则合并
- [ ] Token 刷新
- [ ] 离线降级场景
- [ ] 规则优先级正确性
- [ ] 性能 (启动时间)

---

## 🎓 学习资源

### 文档

1. **集成方案**: `docs/architecture/20260411-teamcc-admin-integration.md`
   - 详细的架构设计
   - 4 个阶段的实现步骤
   - 风险评估

2. **测试指南**: `docs/architecture/20260411-teamcc-integration-testing.md`
   - 手动测试场景
   - 调试命令
   - 常见问题

### 代码参考

- Token 管理: `src/bootstrap/teamccAuth.ts`
- 规则合并: `src/utils/permissions/rulesMerger.ts`
- 身份转换: `src/utils/identity.ts` 中的 `envelopeToProfile()`

---

## 📞 支持与讨论

- 问题跟踪: GitHub Issues (待创建)
- 设计讨论: Architecture 文档评论
- 测试反馈: 见测试指南

---

## 下一步行动

### 立即

1. ✅ Phase 1 完成并测试
2. ✅ Phase 2 完成并测试
3. 📝 编写文档（进行中）

### 近期 (1-2 周)

1. 实现 Phase 3: `/login` 和 `/permissions` 命令
2. 集成权限检查到 Tool 执行
3. 完整的端到端测试

### 中期 (2-4 周)

1. 实现 Phase 4: 高级缓存
2. 性能优化
3. 生产部署准备

---

## 版本信息

- Claude Code Commit: f491dc1 (Phase 2 合并)
- TeamCC Admin: 已有 7 个权限模板
- Node.js: 18+
- Bun: 已兼容
