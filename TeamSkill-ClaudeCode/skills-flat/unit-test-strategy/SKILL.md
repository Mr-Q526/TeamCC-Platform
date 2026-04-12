---
schemaVersion: 2026-04-11
skillId: review/unit-test-strategy
name: unit-test-strategy
displayName: Unit Test Strategy
description: Use when working on unit test design, missing test analysis, mocks, fixtures, and behavior coverage. Focus on meaningful assertions, boundary cases, maintainability, and regression prevention.
aliases:
  - unit-test-strategy
  - 单元测试
  - unit test
  - 测试
  - 验证
  - test
  - 策略
  - 方案
  - Unit Test Strategy
  - unit
  - strategy
  - review
  - 代码审查
  - code review
  - 评审
  - backend-platform
  - 后端
  - 服务端
  - server side
version: 0.1.0
sourceHash: sha256:8e7e555605108969f98aefa51ac8504aaeda83149ee2f3b2426d584ea6bd3c59
domain: review
departmentTags:
  - backend-platform
sceneTags:
  - test
  - review
---

# Unit Test Strategy

Use this skill when the task involves unit test design, missing test analysis, mocks, fixtures, and behavior coverage.

Goal: produce reliable engineering guidance and implementation steps focused on meaningful assertions, boundary cases, maintainability, and regression prevention.

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
