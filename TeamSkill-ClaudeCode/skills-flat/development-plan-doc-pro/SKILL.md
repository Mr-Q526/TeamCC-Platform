---
schemaVersion: 2026-04-11
skillId: general/development-plan-doc-pro
name: development-plan-doc-pro
displayName: Development Plan Document PRO
description: Use when creating a serious engineering implementation plan after repository research. Pro version requires investigation before planning and produces a detailed plan down to modules, functions, type definitions, interfaces, data flow, validation, risks, rollout, and task checklist.
aliases:
  - development-plan-doc-pro
  - Development Plan Document PRO
  - 开发计划文档
  - 功能开发规划
  - 技术方案
  - 实施方案
  - 详细开发计划
  - 方法定义
  - 类型定义
  - 接口定义
  - 任务拆解
  - coding plan
  - implementation plan
  - architecture
  - plan
  - doc
  - 计划
  - 开发计划
  - 实施计划
  - 文档
  - 方案文档
  - 技术文档
  - 专业版
  - pro
  - development plan doc pro
  - development
  - Document
  - general
version: 0.1.0
sourceHash: sha256:ed1d41750511f941c42a890949c7e32c12ef1213c1d8060c318a47bb35a409bb
domain: general
departmentTags:
  - backend-platform
  - frontend-platform
sceneTags:
  - architecture
  - planning
  - review
---

# Development Plan Document PRO

Use this skill when the user wants AI to investigate first and then produce a detailed implementation plan before coding.

Goal: create a plan detailed enough that another engineer or agent can implement it without rediscovering the same context.

## Required research phase

Before writing the plan, inspect the repository and identify:

1. Entry points and user-facing flow
2. Relevant modules, services, hooks, components, commands, or scripts
3. Existing types, interfaces, schemas, events, and configuration
4. Similar implementations to reuse
5. Data flow and state ownership
6. Test, build, and runtime validation paths
7. Security, compatibility, migration, and rollback risks

Separate confirmed facts from assumptions. If a key detail cannot be found, mark it as an open question instead of inventing it.

## Plan structure

Use this structure unless the user requests another format:

1. Goal and non-goals
2. Current-state findings
3. Proposed architecture
4. Data model and type definitions
5. Module-by-module implementation plan
6. Function/method/interface changes
7. Event, telemetry, or persistence changes
8. Validation plan
9. Rollout, rollback, and migration notes
10. Risks and open questions
11. Step-by-step task checklist

## Detail requirements

- Name concrete files or modules when known.
- Include proposed function names, signatures, type shapes, or config keys when useful.
- Explain where data enters, how it transforms, and where it is persisted or rendered.
- Include error handling, idempotency, permissions, and observability where relevant.
- Provide validation commands or manual checks.
- Keep speculative pieces clearly labeled.

## Final checks

- Could another agent implement from this plan without redoing all research?
- Are function/type/interface definitions specific enough?
- Are risks, validation, and rollback included?
- Are unknowns explicit rather than hidden?
