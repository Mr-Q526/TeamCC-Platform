---
schemaVersion: 2026-04-11
skillId: review/code-review-general
name: code-review-general
displayName: General Code Review
description: Use when working on general code review across frontend, backend, scripts, and infrastructure changes. Focus on bugs, regressions, maintainability risks, and missing tests.
aliases:
  - code-review-general
  - General Code Review
  - code review general
  - codereviewgeneral
  - 代码实现
  - 代码审查
  - code review
  - 评审
  - 服务端
  - server side
version: 0.1.0
sourceHash: sha256:29276f5d3edf1f1aef29beab0b0147ec135fae251dd46f24179b573b83d0350e
domain: review
departmentTags:
  - backend-platform
sceneTags:
  - review
---

# General Code Review

Use this skill when the task involves general code review across frontend, backend, scripts, and infrastructure changes.

Goal: produce reliable engineering guidance and implementation steps focused on bugs, regressions, maintainability risks, and missing tests.

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
