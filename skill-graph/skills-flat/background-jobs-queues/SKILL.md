---
schemaVersion: 2026-04-11
skillId: backend/background-jobs-queues
name: background-jobs-queues
displayName: Background Jobs Queues
description: Use when working on queues, workers, scheduled jobs, retries, idempotency, and async workflows. Focus on idempotency, retry policy, dead-letter handling, and operational visibility.
aliases:
  - 后台任务队列
  - 异步队列
  - 任务重试
  - 幂等任务
  - 死信队列
  - background-jobs-queues
  - 后台任务
  - 异步任务
  - 后台作业
  - 任务队列
  - 定时任务
  - job
  - scheduled job
  - 队列
  - worker
  - 重试
  - 幂等
  - dead-letter queue
  - Background Jobs Queues
  - background
  - jobs
  - queues
  - backend
  - 后端
  - 服务端
  - server side
  - architecture
  - 架构
version: 0.1.0
sourceHash: sha256:4856687a2e468f2f3059758a505110e9942a705950903fedab8d6cdcc001b5db
domain: backend
departmentTags:
  - backend-platform
sceneTags:
  - architecture
  - debug
---

# Background Jobs Queues

Use this skill when the task involves queues, workers, scheduled jobs, retries, idempotency, and async workflows.

Goal: produce reliable engineering guidance and implementation steps focused on idempotency, retry policy, dead-letter handling, and operational visibility.

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
