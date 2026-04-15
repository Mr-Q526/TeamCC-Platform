---
schemaVersion: 2026-04-11
skillId: infra/ci-quality-gates
name: ci-quality-gates
displayName: CI Quality Gates
description: Use when working on CI pipelines, required checks, coverage gates, lint gates, and release validation workflows. Focus on fast feedback, required checks, reproducibility, and safe release criteria.
aliases:
  - ci-quality-gates
  - CI Quality Gates
  - ciqualitygates
  - CI
  - 持续集成
  - 质量门禁
  - 质量检查
  - quality gate
  - 门禁
  - required checks
  - quality
  - gates
  - 验证
version: 0.1.0
sourceHash: sha256:623b248e43c6279b31c0d4638490ec6695c8815d2dad35d04acd654f56710106
domain: infra
departmentTags:
  - infra-platform
sceneTags:
  - release
  - test
---

# CI Quality Gates

Use this skill when the task involves CI pipelines, required checks, coverage gates, lint gates, and release validation workflows.

Goal: produce reliable engineering guidance and implementation steps focused on fast feedback, required checks, reproducibility, and safe release criteria.

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
