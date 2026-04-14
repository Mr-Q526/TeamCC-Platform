# 身份信息 MD 规范设计（已废弃）

> 2026-04-12 更新：本文描述的是早期本地身份文件方案，现已不再作为 TeamSkill-ClaudeCode 的实施方案。

## 当前口径

- 企业版身份来源统一收敛到 `TeamCC Admin`
- 运行时身份真相源为 `/identity/me` 返回的 `IdentityEnvelope`
- 已取消 `.claude/identity/active.md`、活动身份文件和本地身份票据切换方案

## 为什么废弃

本地身份文件无法满足企业版要求：

- 不可统一下发
- 不可统一失效
- 不可审计
- 不适合作为权限控制与 Skill 治理的基础面

## 保留本文的原因

仅用于保留历史设计脉络，帮助理解项目早期为什么会出现：

- Identity MD
- 活动身份文件
- `CLAUDE.local.md -> @identity-file`

这些关键词。

## 替代阅读

- `docs/TEAMCC_INTEGRATION_STATUS.md`
- `docs/TEAMCC_AUTHENTICATION_GUIDE.md`
- `docs/architecture/20260411-teamcc-admin-integration.md`
