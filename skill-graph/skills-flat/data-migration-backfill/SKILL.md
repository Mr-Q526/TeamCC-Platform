---
schemaVersion: 2026-04-11
skillId: backend/data-migration-backfill
name: data-migration-backfill
displayName: Data Migration Backfill
description: Use when working on schema migrations, data migrations, backfills, dual writes, and rollout plans. Focus on reversibility, idempotency, batching, verification, and rollback safety.
aliases:
  - data-migration-backfill
  - 数据
  - data
  - 迁移
  - 数据迁移
  - migration
  - 数据回填
  - 补数据
  - backfill
  - Data Migration Backfill
  - backend
  - 后端
  - 服务端
  - server side
  - architecture
  - 架构
  - 架构设计
  - 模块边界
  - release
  - backend-platform
version: 0.1.0
sourceHash: sha256:eadcec67071b149d9280b770b579ad88c397b551f269bd1fe89ea56e8c512332
domain: backend
departmentTags:
  - backend-platform
sceneTags:
  - architecture
  - release
---

# Data Migration Backfill

Use this skill when the task involves schema migrations, data migrations, backfills, dual writes, and rollout plans.

Goal: produce reliable engineering guidance and implementation steps focused on reversibility, idempotency, batching, verification, and rollback safety.

## Working model

1. Identify the affected system, data, users, and failure modes.
2. Define invariants, inputs, outputs, ownership, and rollback needs.
3. Prefer small, auditable changes with explicit validation.
4. Call out security, performance, concurrency, and data-loss risks when relevant.
5. Finish with concrete verification steps and residual risks.

## Rules

- Ground recommendations in the current codebase or runtime evidence.
- Prefer explicit contracts, typed boundaries, and defensive validation.
- Do not hide operational concerns behind generic best practices.
- Include negative cases, edge cases, and failure behavior.
- For review tasks, list findings first with file and line references when possible.
- For test or performance tasks, define the workload, success criteria, and measurement method.

## Checklist

- Are assumptions and ownership boundaries explicit?
- Are risky changes reversible or safely deployable?
- Are observability and diagnostics sufficient for production issues?
- Are tests or validation steps targeted to the actual risk?
- Are security and data-integrity concerns addressed?
