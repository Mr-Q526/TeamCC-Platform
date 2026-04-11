---
schemaVersion: 2026-04-11
skillId: general/development-plan-doc
name: development-plan-doc
displayName: Development Plan Document
description: Use when creating an implementation plan, technical design document, development task breakdown, migration plan, or coding roadmap before writing code. Focus on scope, architecture, steps, risks, validation, rollout, and ownership.
aliases:
  - 开发计划文档
  - 技术方案
  - 实施方案
  - 任务拆解
  - 开发路线图
  - coding plan
  - development-plan-doc
  - 计划
  - 开发计划
  - 实施计划
  - 文档
  - 方案文档
  - 技术文档
  - Development Plan Document
  - development plan doc
  - development
  - plan
  - doc
  - Document
  - general
  - 通用
  - architecture
  - 架构
  - 架构设计
  - 模块边界
  - review
  - 代码审查
  - code review
version: 0.1.0
sourceHash: sha256:03a6a9273050dbc187009c93ccdad0a639331436c69a06b32662b8114004f982
domain: general
departmentTags:
  - backend-platform
  - frontend-platform
sceneTags:
  - architecture
  - review
---

# Development Plan Document

Use this skill when the task is to produce a concrete engineering plan before implementation.

Goal: turn an ambiguous coding request into a plan that a developer or coding agent can execute and validate.

## Plan structure

Use this default structure unless the user asks for another format:

1. Background and goal
2. Scope and non-goals
3. Current-state findings
4. Proposed design
5. Implementation steps
6. Validation plan
7. Risks and rollback
8. Open questions

## Rules

- Ground the plan in the actual repository structure when available.
- Separate confirmed facts from assumptions.
- Keep steps independently verifiable.
- Include validation commands or manual checks.
- Call out migration, compatibility, security, and data-loss risks when relevant.
- Do not over-design beyond the requested phase.

## Output checklist

- A clear implementation sequence.
- File or module impact.
- Test and build verification.
- Risk and rollback notes.
- Decisions that need user confirmation.
