# TeamCC Admin 企业身份与权限集成方案

**日期**: 2026-04-12
**状态**: 方案已收敛，主链路已落地

## 1. 结论先行

当前方案已经明确收敛到以下原则：

- `TeamCC Admin` 是企业版运行时的唯一身份源。
- `TeamCC PermissionBundle` 是企业版权限控制面的主要真相源。
- `.claude/identity/active.md` 及相关本地身份票据方案已经取消。
- 本项目的主目标是：
  - 权限鉴定与工具边界控制
  - Skill 沉淀、检索、评测与治理

这意味着文档和实现都不再应该围绕“本地身份切换”组织，而应围绕“远端控制面 + 本地缓存回退”组织。

---

## 2. 为什么取消本地身份文件

企业版 Coding Agent 的身份与权限至少要满足：

- 可统一下发
- 可过期和撤销
- 可审计
- 可跨项目治理

本地身份文件方案的问题是：

- 身份来源不可验证
- 无法统一失效
- 容易出现文档和实际授权不一致
- 不适合作为 Skill 治理的基础身份面

因此，当前保留的本地状态只应是：

- TeamCC 配置
- TeamCC 缓存

而不是本地手写身份票据。

---

## 3. 系统边界

### 3.1 TeamCC Admin 负责什么

- 登录与 token 刷新
- 身份查询：`/identity/me`
- 权限包查询：`/policy/bundle`
- 项目级能力边界与环境覆盖下发

### 3.2 TeamSkill-ClaudeCode 负责什么

- 在启动时建立 TeamCC 身份上下文
- 在运行时把权限包注入 `ToolPermissionContext`
- 对远端失败做缓存回退
- 将身份与能力边界传递给 Skill 检索和执行层

---

## 4. 当前运行时架构

```text
Claude Code 启动
  │
  ├─ 读取 .claude/teamcc.json / ~/.teamcc/config.json / env
  │
  ├─ TeamCC 已配置?
  │  ├─ 否 → 进入本地恢复/调试模式
  │  └─ 是
  │
  ├─ 校验 accessToken / refreshToken
  │
  ├─ GET /identity/me
  │  ├─ 成功 → 写入 identity cache
  │  └─ 失败 → 尝试读取 identity cache
  │
  ├─ GET /policy/bundle?projectId=...
  │  ├─ 成功 → 写入 permission bundle cache
  │  └─ 失败 → 尝试读取 permission bundle cache
  │
  ├─ setIdentityProfile(...)
  │
  └─ permissionSetup()
      ├─ 加载本地规则
      └─ 注入 TeamCC rules
```

---

## 5. 当前实现落点

### 5.1 身份链路

- `src/bootstrap/teamccAuth.ts`
  - TeamCC 配置读取
  - 登录、刷新、登出
  - 身份拉取与缓存
- `src/main.tsx`
  - 启动时优先建立 TeamCC 身份
  - 远端失败时尝试缓存回退
- `src/utils/identity.ts`
  - `IdentityEnvelope -> IdentityProfile`

### 5.2 权限链路

- `src/utils/permissions/teamccLoader.ts`
  - 拉取 bundle
  - 插值 `envOverrides`
  - 缓存 bundle
- `src/utils/permissions/permissionSetup.ts`
  - 在 `ToolPermissionContext` 初始化阶段注入 TeamCC 规则
- `src/utils/permissions/rulesMerger.ts`
  - 多源规则合并诊断

### 5.3 命令面

- `/login`
- `/logout`
- `/auth status`
- `/auth refresh`
- `/identity`
- `/permissions`

---

## 6. 与 Skill 沉淀体系的关系

权限控制面和 Skill 沉淀体系必须共用一套企业身份基础：

- 身份决定 Skill 检索可见范围
- 权限决定 Skill 执行可触达边界
- 反馈与评测再回流到 Skill registry、embedding、graph、reranker

因此，TeamCC 集成不是孤立的“登录能力”，而是 Skill 治理的控制面基座。

---

## 7. 当前仍待收口的问题

### 7.1 文档侧

- 多份旧文档仍把 `.claude/identity/active.md` 写成正式入口
- 多份架构草案仍保留“兼容方案”描述

### 7.2 实现侧

- 身份标签映射仍部分保留客户端硬编码
- `/permissions` 仍偏向现有权限 UI，TeamCC 来源可见性不足
- `/identity clear` 的行为语义仍需收口

### 7.3 治理侧

- 权限审计闭环仍需加强
- Skill feedback / graph / rerank 还在持续演进

---

## 8. 后续建议

### 近期

1. 清理所有文档中的本地身份文件描述
2. 统一命令文案，以 `/login` 和 `/logout` 为主入口
3. 补齐 TeamCC 权限来源诊断

### 中期

1. 替换客户端硬编码身份标签映射
2. 打通权限审计与 Tool 级埋点
3. 让 TeamCC 能力边界稳定影响 Skill 检索与推荐

### 长期

1. 建立 Skill 反馈闭环
2. 引入更稳定的 graph / rerank 控制面
3. 让 TeamCC 成为 Skill 治理与权限治理的统一控制面
