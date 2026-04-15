---
schemaVersion: 2026-04-11
skillId: infra/stress-testing
name: stress-testing
displayName: Stress Testing
description: Use when working on stress, soak, spike, and capacity tests for production-like systems. Focus on breaking points, degradation behavior, recovery, and resource saturation.
aliases:
  - stress-testing
  - Stress Testing
  - stresstesting
  - 压力测试
  - 压测
  - stress test
  - 测试策略
  - stress
  - 性能
  - 性能优化
  - 性能分析
  - 验证
version: 0.1.0
sourceHash: sha256:381a91017a46759671809b4ec02c6484d2add455d1bf05cfa065cd98f7030b2e
domain: infra
departmentTags:
  - infra-platform
sceneTags:
  - performance
  - test
---

# Stress Testing

Use this skill when the task involves stress, soak, spike, and capacity tests for production-like systems.

Goal: produce reliable engineering guidance and implementation steps focused on breaking points, degradation behavior, recovery, and resource saturation.

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
