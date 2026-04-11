# TeamCC Admin 身份鉴定集成方案

**日期**: 2026-04-11  
**状态**: 调查与规划阶段

## 目录

1. [现状分析](#现状分析)
2. [集成目标](#集成目标)
3. [系统架构](#系统架构)
4. [集成方案](#集成方案)
5. [实现步骤](#实现步骤)
6. [风险与考虑](#风险与考虑)

---

## 现状分析

### Claude Code 现有身份管理

**当前机制**：
- 使用本地 `.claude/identity/active.md` 文件存储身份信息
- 身份数据为 YAML frontmatter 格式：
  ```yaml
  ---
  user_id: 100235
  org_id: 10
  department_id: 102
  team_id: 1022
  role_id: 202
  level_id: 303
  ---
  ```

**身份配置文件位置**：`.claude/identity/active.md`

**加载流程**：
```
bootstrap/state.ts → loadIdentityProfile() → utils/identity.ts
↓
IdentityProfile {
  userId, orgId, departmentId, teamId, roleId, levelId, projectId
}
↓
映射为人类可读的标签（department, team, role, level）
↓
注入到模型 context 和 skill retrieval
```

**标签映射**（硬编码）：
- `DEPARTMENT_MAP`: 101 → 'frontend', 102 → 'backend', ...
- `ROLE_MAP`: 201 → 'frontend-developer', ...
- `LEVEL_MAP`: 301 → 'p3', 302 → 'p4', ...
- `TEAM_MAP`: 1011 → 'commerce-web', ...

**权限系统**：
- 已存在的权限框架：`src/utils/permissions/`
- 权限规则在 `settings.json` 中定义
- 支持三种行为：`allow`, `deny`, `ask`
- 支持针对工具（Read, Write, Edit, Bash 等）的权限控制

---

## TeamCC Admin 系统

### 核心能力

**后端服务**（teamcc-admin）：
- `/auth/login`: 用户身份验证
- `/identity/me`: 获取当前用户身份信息 (IdentityEnvelope)
- `/policy/bundle?projectId=X`: 获取用户权限配置 (PermissionBundle)

**IdentityEnvelope 格式**：
```typescript
{
  schema: "identity-envelope-v1",
  subject: {
    userId: number,
    username: string,
    email: string,
    departmentId: number,
    teamId: number,
    roleId: number,
    levelId: number,
    defaultProjectId: number
  },
  // ... 时间戳和签名
}
```

**PermissionBundle 格式**：
```typescript
{
  bundleId: string,
  projectId: number,
  subject: { userId, ... },
  rules: [
    { behavior: 'deny'|'allow'|'ask', tool: string, content?: string }
  ],
  capabilities: string[],  // 跨项目权限等
  envOverrides: Record<string, string>
}
```

**数据库架构**：
- 中心化用户/组织/部门/团队/角色/等级管理
- 权限模板（7个预设）
- 用户-项目-模板绑定

---

## 集成目标

### 短期目标（V1）- 本地身份查询

**目标状态**：
- Claude Code 启动时，向 teamcc-admin 验证用户身份
- 从 teamcc-admin 拉取权限配置到本地
- 使用拉取的权限进行工具执行时的权限检查

**关键改进**：
- 消除硬编码的标签映射（DEPARTMENT_MAP 等）
- 权限规则从 teamcc-admin 而不是 settings.json 加载
- 支持跨项目权限（currentProject 特定的权限）

### 长期目标（V2）- 实时权限验证

**后期考虑**：
- 权限实时查询（而不是本地缓存）
- 权限变更的推送通知
- 审计日志集成
- 支持多项目并行工作

---

## 系统架构

### 集成架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Claude Code (启动)                      │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. 读取 .claude/identity/active.md (存在)                    │
│    或 ~/.teamcc/config.json (新增) - 获取 API 凭证          │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 向 teamcc-admin 发起认证请求                              │
│    GET /identity/me (使用存储的 access token)               │
│    或 POST /auth/login (如果无有效 token)                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 获取 IdentityEnvelope 和当前 Project 的 PermissionBundle  │
│    GET /policy/bundle?projectId=1                           │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. 缓存到本地                                                │
│    - IdentityProfile → .claude/identity/cache.json         │
│    - PermissionBundle → .claude/permissions/cache.json     │
│    - 与本地 settings.json 权限合并 (见下文)                 │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. 权限检查时使用合并后的规则                                │
│    工具执行 → permissionCheck() → merged rules              │
└─────────────────────────────────────────────────────────────┘
```

### 权限规则来源合并策略

**当前模式**（仅 settings.json）：
```
Tool 执行
  ↓
checkPermissions()
  ↓
从 settings.json 读取规则
  ↓
allow/deny/ask
```

**新的合并策略**：
```
Tool 执行
  ↓
checkPermissions()
  ↓
┌─ 读取 PermissionBundle（来自 teamcc-admin）
├─ 读取 settings.json（本地管理员规则）
├─ 读取 CLAUDE.md（项目级规则）
└─ 合并：最严格原则（deny > ask > allow）
  ↓
allow/deny/ask
```

**合并示例**：
| 来源 | Read *.md | 行为 | 结果 |
|------|----------|------|------|
| TeamCC Admin | allow | - | allow（默认） |
| settings.json | deny | - | **deny**（覆盖） |
| CLAUDE.md | - | - | 保留 deny |

---

## 集成方案

### 方案 1: 侵入式集成（推荐）

直接修改 Claude Code 的身份和权限系统，将 teamcc-admin 作为权限源。

**优点**：
- 统一的身份来源
- 权限规则完全由 teamcc-admin 管理
- 支持跨项目权限的最佳方式

**缺点**：
- 修改现有代码较多
- 对 teamcc-admin 服务的依赖（需要处理离线情况）
- 需要存储 token 并处理刷新

**实现范围**：
1. 在 bootstrap 阶段添加 teamcc-admin 认证
2. 修改 `loadIdentityProfile()` 支持远程源
3. 新增 `loadPermissionBundle()` 从 teamcc-admin 拉取权限
4. 修改权限检查逻辑以支持多源合并
5. 添加本地缓存和离线降级

### 方案 2: 插件式集成

创建独立的 MCP 服务或插件，负责与 teamcc-admin 通信。

**优点**：
- 不修改核心 Claude Code
- 可独立测试和部署
- 更容易做离线降级

**缺点**：
- 需要新的通信协议
- 权限检查时的延迟增加
- 代码分散

**实现范围**：
1. 创建 `src/plugins/teamccAdmin.ts`
2. 实现 Identity 和 Permissions API 代理
3. 通过钩子集成到权限检查流程

### 方案 3: 混合方案（最实用）

结合上述两种，既修改必要的系统部分，又保持模块化。

**推荐方案细节**：
```
修改范围：
├── src/bootstrap/identity.ts (新) - 处理 teamcc-admin 认证
├── src/utils/identity.ts - 支持远程身份源
├── src/utils/permissions/teamccLoader.ts (新) - 拉取权限
├── src/utils/permissions/permissionsLoader.ts - 集成权限源
└── src/types/permissions.ts - 扩展权限类型

保持不变：
├── src/utils/permissions/permissions.ts - 核心权限检查逻辑
├── src/Tool.ts - 工具执行框架
└── 现有的 settings.json 权限模式
```

---

## 实现步骤

### 第 1 阶段：基础认证与身份拉取

**目标**：Claude Code 能够从 teamcc-admin 获取用户身份信息

#### Step 1.1: 配置存储

创建 `src/bootstrap/teamccAuth.ts`：
```typescript
// 存储 teamcc-admin 的连接信息和凭证
export type TeamCCConfig = {
  apiBase: string            // teamcc-admin 服务地址，默认 http://localhost:3000
  accessToken?: string       // 缓存的 access token
  refreshToken?: string      // 刷新用 token
  tokenExpiry?: number       // token 过期时间戳
}

// 从 ~/.teamcc/config.json 或 .claude/teamcc.json 读取配置
export async function loadTeamCCConfig(): Promise<TeamCCConfig | null>

// 保存 token
export async function saveTeamCCConfig(config: TeamCCConfig): Promise<void>
```

**配置文件位置**（优先级）：
1. `.claude/teamcc.json` (项目级，可提交到 git)
2. `~/.teamcc/config.json` (用户级，敏感信息)
3. 环境变量：`TEAMCC_ADMIN_URL`, `TEAMCC_TOKEN`

#### Step 1.2: 远程身份加载

修改 `src/utils/identity.ts`，添加远程加载能力：
```typescript
export async function loadIdentityProfile(
  cwd: string,
  useRemote?: boolean
): Promise<IdentityProfile | null> {
  // 如果有本地文件，优先使用本地（离线支持）
  const localProfile = await loadLocalIdentityProfile(cwd)
  if (localProfile && !useRemote) {
    return localProfile
  }

  // 尝试从 teamcc-admin 加载
  if (useRemote) {
    try {
      const config = await loadTeamCCConfig()
      if (config) {
        const envelope = await fetchIdentityEnvelope(config)
        return convertEnvelopeToProfile(envelope)
      }
    } catch (e) {
      // 降级到本地配置
      logForDebugging(`Failed to load from teamcc-admin, falling back to local`, { level: 'warn' })
      return localProfile
    }
  }

  return localProfile
}

async function fetchIdentityEnvelope(config: TeamCCConfig): Promise<IdentityEnvelope> {
  const token = await refreshTokenIfNeeded(config)
  const response = await fetch(`${config.apiBase}/identity/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Failed to fetch identity')
  return response.json()
}
```

#### Step 1.3: 在 Bootstrap 中集成

修改 `src/bootstrap/state.ts`：
```typescript
// 在初始化时加载身份信息
async function initializeIdentityProfile() {
  // 1. 尝试从 teamcc-admin 加载
  const remoteProfile = await loadIdentityProfile(cwd, true)
  if (remoteProfile) {
    setIdentityProfile(remoteProfile)
    return
  }

  // 2. 降级到本地
  const localProfile = await loadIdentityProfile(cwd, false)
  if (localProfile) {
    setIdentityProfile(localProfile)
  }
}
```

---

### 第 2 阶段：权限配置拉取与合并

**目标**：从 teamcc-admin 拉取权限规则，与本地规则合并

#### Step 2.1: 权限包加载

创建 `src/utils/permissions/teamccLoader.ts`：
```typescript
export type PermissionSource = 'teamcc-admin' | 'settings.json' | 'claude-md'

export interface MergedRule {
  behavior: 'allow' | 'deny' | 'ask'
  tool: string
  content?: string
  source: PermissionSource
  projectId?: number
}

export async function loadPermissionBundleFromTeamCC(
  config: TeamCCConfig,
  projectId: number
): Promise<PermissionBundle | null> {
  const token = await refreshTokenIfNeeded(config)
  const response = await fetch(
    `${config.apiBase}/policy/bundle?projectId=${projectId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!response.ok) return null
  return response.json()
}
```

#### Step 2.2: 规则合并逻辑

修改 `src/utils/permissions/permissionsLoader.ts`：
```typescript
export async function loadAndMergeRules(
  projectId: number,
  identity: IdentityProfile | null
): Promise<MergedRule[]> {
  const rules: MergedRule[] = []

  // 1. 从 teamcc-admin 加载（如果可用）
  if (identity) {
    const bundle = await loadPermissionBundleFromTeamCC(config, projectId)
    if (bundle) {
      rules.push(...bundle.rules.map(r => ({ ...r, source: 'teamcc-admin', projectId })))
    }
  }

  // 2. 从 settings.json 加载
  const settingsRules = await loadPermissionsFromSettings()
  rules.push(...settingsRules.map(r => ({ ...r, source: 'settings.json' })))

  // 3. 从 CLAUDE.md 加载
  const claudeMdRules = await loadPermissionsFromClaudeMd()
  rules.push(...claudeMdRules.map(r => ({ ...r, source: 'claude-md' })))

  // 4. 合并规则（最严格优先）
  return mergeRules(rules)
}

function mergeRules(rules: MergedRule[]): MergedRule[] {
  // 按 tool + content 分组
  const grouped = groupBy(rules, r => `${r.tool}::${r.content || '*'}`)

  // 对每组应用 "最严格原则"
  // deny > ask > allow
  const merged: MergedRule[] = []
  for (const [key, group] of Object.entries(grouped)) {
    const priority = { deny: 3, ask: 2, allow: 1 }
    const strictest = group.reduce((prev, curr) =>
      priority[curr.behavior] > priority[prev.behavior] ? curr : prev
    )
    merged.push(strictest)
  }

  return merged
}
```

#### Step 2.3: 权限检查集成

修改 `src/utils/permissions/permissions.ts`：
```typescript
export async function checkPermissions(
  tool: string,
  input: any,
  context: { identity?: IdentityProfile, projectId?: number }
): Promise<PermissionResult> {
  // 加载并合并所有规则源
  const rules = await loadAndMergeRules(context.projectId || 1, context.identity)

  // 使用现有的权限匹配逻辑
  const matchedRule = matchRule(rules, tool, input)

  if (matchedRule?.behavior === 'deny') {
    return { allowed: false, reason: 'denied' }
  }

  if (matchedRule?.behavior === 'ask') {
    return { allowed: false, reason: 'ask_permission' }
  }

  return { allowed: true }
}
```

---

### 第 3 阶段：UI 与用户交互

**目标**：提供友好的登录和身份管理界面

#### Step 3.1: 登录命令

创建 `/login` 命令，允许用户认证：
```typescript
// src/commands/auth/login.tsx
export async function loginCommand() {
  const username = await promptUser('Username')
  const password = await promptUser('Password (hidden)', { hidden: true })

  try {
    const result = await loginToTeamCC(username, password)
    saveTeamCCConfig(result.config)
    print('✓ 登录成功，身份已保存到 .claude/teamcc.json')
  } catch (e) {
    print(`✗ 登录失败: ${e.message}`)
  }
}
```

#### Step 3.2: 身份查询命令

创建 `/identity` 命令，显示当前身份：
```typescript
export async function identityCommand() {
  const identity = getIdentityProfile()
  if (!identity) {
    return print('未配置身份信息。运行 /login 进行认证。')
  }

  print(`╭─ 当前身份`)
  print(`├─ 用户 ID: ${identity.userId}`)
  print(`├─ 部门: ${mapDepartment(identity.departmentId)}`)
  print(`├─ 团队: ${mapTeam(identity.teamId)}`)
  print(`├─ 角色: ${mapRole(identity.roleId)}`)
  print(`├─ 等级: ${mapLevel(identity.levelId)}`)
  print(`└─ 组织: ${mapOrg(identity.orgId)}`)
}
```

---

### 第 4 阶段：缓存与离线支持

**目标**：在 teamcc-admin 不可用时，使用本地缓存

#### Step 4.1: 缓存策略

```typescript
export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number  // 秒
}

class IdentityCache {
  private cache = new Map<string, CacheEntry<any>>()

  set<T>(key: string, data: T, ttl = 3600): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const age = (Date.now() - entry.timestamp) / 1000
    if (age > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }
}

// 缓存位置
// - .claude/cache/identity.json (IdentityProfile)
// - .claude/cache/permissions-{projectId}.json (PermissionBundle)
```

#### Step 4.2: 降级逻辑

```typescript
export async function loadIdentityWithFallback(): Promise<IdentityProfile | null> {
  // 1. 尝试从 teamcc-admin
  try {
    const profile = await loadIdentityFromRemote()
    identityCache.set('current', profile, 3600)
    return profile
  } catch (e) {
    logForDebugging('Failed to load from remote', { level: 'warn' })
  }

  // 2. 尝试本地缓存
  const cached = identityCache.get<IdentityProfile>('current')
  if (cached) {
    print('[离线模式] 使用缓存的身份信息')
    return cached
  }

  // 3. 尝试本地文件
  return loadLocalIdentityProfile()
}
```

---

## 风险与考虑

### 技术风险

| 风险 | 影响 | 缓解方案 |
|------|------|--------|
| teamcc-admin 宕机 | 无法登录新用户，现有用户无法刷新权限 | 本地缓存 + 离线降级 |
| Token 泄露 | 身份被冒用 | 在 ~/.teamcc/config.json (gitignore) 中存储 |
| 网络延迟 | 启动变慢 | 异步加载，缓存优化 |
| 权限规则冲突 | 不清楚最终生效的规则 | 合并日志，提供 /permissions 命令查看 |

### 安全风险

| 风险 | 缓解方案 |
|------|--------|
| 本地存储明文 token | 使用操作系统 keychain（macOS）、credential manager（Windows）、pass（Linux） |
| 权限规则被本地修改 | 核心规则来自 teamcc-admin，本地只能补充而非覆盖 |
| 身份信息在启动时暴露 | 不将身份信息写入系统日志，使用诊断日志加密 |

### 依赖关系

- **必须**：teamcc-admin 运行（至少初次登录时）
- **可选**：本地 `settings.json` 和 `CLAUDE.md` 规则

### 向后兼容性

- 现有的 `settings.json` 权限规则继续生效
- `.claude/identity/active.md` 不再需要（但可以保留作为本地备份）
- 无配置时，Claude Code 行为不变（无身份、默认权限）

---

## 下一步

### 建议优先顺序

1. **立即**：完成方案设计评审（本文档）
2. **第 1 周**：实现第 1 阶段（身份认证与拉取）
3. **第 2 周**：实现第 2 阶段（权限合并与检查）
4. **第 3 周**：实现第 3 阶段（UI 与命令）
5. **第 4 周**：测试、优化和缓存完善

### 测试计划

```bash
# 单元测试
npm test -- src/bootstrap/teamccAuth.ts
npm test -- src/utils/permissions/teamccLoader.ts

# 集成测试
# 1. 启动 teamcc-admin
# 2. 启动 Claude Code
# 3. 运行 /login 命令
# 4. 验证权限检查

# 离线测试
# 1. 停止 teamcc-admin
# 2. 验证缓存降级
# 3. 验证本地文件降级
```

---

## 相关文档

- [TeamCC Admin 架构](./20260410-teamcc-admin-architecture.md)
- [Claude Code 权限系统](./permissions.md)
- [身份管理指南](./identity.md)
