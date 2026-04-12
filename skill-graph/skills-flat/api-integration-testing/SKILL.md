---
schemaVersion: 2026-04-11
skillId: backend/api-integration-testing
name: api-integration-testing
displayName: API Integration Testing
description: Use when working on API integration tests across services, databases, auth, and external dependencies. Focus on contract correctness, realistic fixtures, isolation, and deterministic assertions.
aliases:
  - api-integration-testing
  - API
  - 接口
  - 服务接口
  - 测试
  - 测试策略
  - testing
  - API Integration Testing
  - integration
  - backend
  - 后端
  - 服务端
  - server side
  - test
  - 验证
  - backend-platform
version: 0.1.0
sourceHash: sha256:7bf16bc4af3988d4dd30e902c218e9584214e9cecbd5fe4105c444932158175e
domain: backend
departmentTags:
  - backend-platform
sceneTags:
  - test
---

# API Integration Testing

Use this skill when the task involves API integration tests across services, databases, auth, and external dependencies.

Goal: produce reliable engineering guidance and implementation steps focused on contract correctness, realistic fixtures, isolation, and deterministic assertions.

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
