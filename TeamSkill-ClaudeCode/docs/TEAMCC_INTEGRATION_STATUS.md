# TeamCC Admin 集成状态

**最后更新**: 2026-04-12
**状态**: 权限控制主链路已落地，文档收口中

## 总体目标

在 TeamSkill-ClaudeCode 中，将 `TeamCC Admin` 收敛为企业版运行时的唯一身份与权限控制面，并以此支撑两条主线：

- 权限鉴定与工具执行边界控制
- Skill 沉淀、检索、评测与治理

## 当前收敛原则

- 已取消 `.claude/identity/active.md` 方案。
- 企业执行链路不再接受本地身份票据或活动身份文件。
- TeamCC 身份以 `/identity/me` 返回的 `IdentityEnvelope` 为唯一真相源。
- TeamCC 权限以 `/policy/bundle` 返回的 `PermissionBundle` 为唯一企业权限源。
- 未配置 TeamCC 时，CLI 仍可用于源码恢复、调试和非企业模式验证，但不具备企业身份与权限能力。

---

## 实现进度

### ✅ Phase 1: TeamCC 身份接入

**目标**: 启动时拿到 TeamCC 身份，并在运行时挂载 `IdentityProfile`

**已实现**：
- `src/bootstrap/teamccAuth.ts`
  - 项目级配置、用户级配置、环境变量加载
  - `/auth/login`、`/auth/refresh`、登出
  - `/identity/me` 拉取与本地缓存
- `src/main.tsx`
  - 启动时优先读取 TeamCC 配置
  - 远程身份获取
  - token 失效和无 token 的拦截
  - 远程失败时退回身份缓存
- `src/utils/identity.ts`
  - `IdentityEnvelope -> IdentityProfile` 转换
  - 上下文注入所需的身份摘要生成
- `src/commands/identity.tsx`
  - 基础身份查看命令

**当前结论**：
- TeamCC 已经是实际运行路径中的身份来源。
- `.claude/identity/active.md` 仅属于历史方案，不再是目标实现。

---

### ✅ Phase 2: TeamCC 权限包接入与运行时注入

**目标**: 把 TeamCC 权限真正送入工具权限判定链路

**已实现**：
- `src/utils/permissions/teamccLoader.ts`
  - 从 `/policy/bundle` 拉取权限包
  - `PermissionBundleRule -> PermissionRule` 转换
  - `envOverrides` 插值
  - `permission-bundle-{projectId}.json` 缓存与离线回退
- `src/utils/permissions/rulesMerger.ts`
  - 规则分组与最严格原则合并
- `src/utils/permissions/teamccIntegration.ts`
  - TeamCC + 本地规则联合加载与诊断
- `src/utils/permissions/permissionSetup.ts`
  - 在 `ToolPermissionContext` 初始化阶段注入 TeamCC 规则

**当前结论**：
- TeamCC 权限不是“只拉取不生效”，而是已经进入实际权限上下文。
- 本地 `settings.json` / `CLAUDE.md` 仍可参与合并，但企业权限边界以 TeamCC bundle 为主。

---

### 🟡 Phase 3: 命令与运维可见性

**状态**: 已有实现，尚未完全收口

**已存在命令**：
- `/login`
- `/logout`
- `/auth status`
- `/auth refresh`
- `/identity`
- `/permissions`

**仍待完善**：
- 文档与命令行为说明统一
- 更明确的 token 失效、缓存命中、远端不可达提示
- 面向 TeamCC 的权限来源诊断视图

---

### 🟡 Phase 4: 缓存、审计与治理闭环

**状态**: 部分完成

**已实现**：
- 身份缓存：`.claude/cache/identity.json`
- 权限包缓存：`.claude/cache/permission-bundle-{projectId}.json`
- 远端失败时的离线回退

**仍待完善**：
- 缓存策略文档与 TTL 口径统一
- 权限刷新与缓存失效的运维说明
- 审计日志与权限决策可观测性
- 身份标签映射从客户端硬编码迁移到可治理来源

---

## 代码入口

```text
src/
├── bootstrap/
│   ├── teamccAuth.ts
│   └── teamccAudit.ts
├── commands/
│   ├── identity.tsx
│   ├── auth.tsx
│   ├── login/
│   └── logout/
├── utils/
│   ├── identity.ts
│   └── permissions/
│       ├── teamccLoader.ts
│       ├── teamccIntegration.ts
│       ├── rulesMerger.ts
│       └── permissionSetup.ts
└── main.tsx
```

## 配置方式

### 项目级配置 `.claude/teamcc.json`

```json
{
  "apiBase": "http://localhost:3000",
  "username": "admin",
  "accessToken": "eyJhbGc...",
  "refreshToken": "c1dd8d...",
  "tokenExpiry": 1775896537000
}
```

### 用户级配置 `~/.teamcc/config.json`

适用于跨项目复用 TeamCC 凭证。

### 环境变量

```bash
TEAMCC_ADMIN_URL=http://localhost:3000
TEAMCC_ACCESS_TOKEN=eyJhbGc...
TEAMCC_REFRESH_TOKEN=c1dd8d...
```

---

## 快速验证

### 1. 启动 TeamCC Admin

```bash
cd /Users/minruiqing/MyProjects/teamcc-admin
npm run dev
```

### 2. 启动 Claude Code

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/worktrees/teamcc/TeamSkill-ClaudeCode
bun run dev
```

### 3. 在 REPL 中登录并检查状态

```text
/login
/auth status
/identity
/permissions
```

### 4. 验证离线缓存

1. 先在联机状态下成功登录一次。
2. 关闭 `teamcc-admin`。
3. 重新启动 Claude Code。
4. 验证是否命中身份缓存与权限包缓存。

---

## 已知待收口项

- 多份文档仍残留 `.claude/identity/active.md` 的早期设计描述。
- `src/utils/identity.ts` 中的部门、角色、团队映射仍是客户端硬编码。
- `/identity clear` 的语义仍偏弱，更适合作为后续收口项而不是企业主路径命令。
- `/permissions` 目前复用现有权限 UI，仍需补强 TeamCC 来源可见性。

---

## 与 Skill 沉淀主线的关系

权限与 Skill 并不是两套独立工作：

- TeamCC 身份和能力边界决定 Skill 检索与可见范围。
- Skill registry / embedding / graph / feedback 是团队经验沉淀层。
- 企业版目标是“先做权限控制面，再做 Skill 治理闭环”。

Skill 检索与评测的独立进度见：

- `docs/tasks/Skill 检索与评测系统详细实施步骤.md`
- `docs/architecture/Skill 检索与质量评测系统方案.md`
