---
schemaVersion: 2026-04-11
skillId: review/code-review-risk-based
name: code-review-risk-based
displayName: Risk Based Code Review
description: Use when working on high-risk diffs touching auth, payments, data loss, concurrency, migrations, or public APIs. Focus on blast radius, invariants, rollback, observability, and edge cases.
aliases:
  - code-review-risk-based
  - Risk Based Code Review
  - code review risk based
  - codereviewriskbased
  - 代码实现
  - 代码审查
  - code review
  - 评审
  - 风险审查
  - risk-based
  - risk
  - based
  - 服务端
  - server side
version: 0.1.0
sourceHash: sha256:2d538d7164e8fc979266af0cbbf7fd12db9d929e302f55e439496980856b6af3
domain: review
departmentTags:
  - backend-platform
sceneTags:
  - review
  - architecture
---

# Risk Based Code Review

Use this skill when the task involves high-risk diffs touching auth, payments, data loss, concurrency, migrations, or public APIs.

Goal: produce reliable engineering guidance and implementation steps focused on blast radius, invariants, rollback, observability, and edge cases.

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
