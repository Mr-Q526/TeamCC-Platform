---
schemaVersion: 2026-04-11
skillId: backend/backend-performance-profiling
name: backend-performance-profiling
displayName: Backend Performance Profiling
description: Use when working on backend performance profiling, slow endpoint analysis, query hotspots, CPU, memory, and latency work. Focus on measurement, profiling evidence, hot path reduction, and regression guards.
aliases:
  - backend-performance-profiling
  - 后端
  - 服务端
  - server side
  - 性能
  - 性能优化
  - 性能分析
  - Backend Performance Profiling
  - backend
  - performance
  - profiling
  - debug
  - 调试
  - 排查
  - 定位问题
  - backend-platform
version: 0.1.0
sourceHash: sha256:9b4d8b9c7a47d9b186fea138434080b028876653514da76635bb1f142b61597c
domain: backend
departmentTags:
  - backend-platform
sceneTags:
  - debug
  - performance
---

# Backend Performance Profiling

Use this skill when the task involves backend performance profiling, slow endpoint analysis, query hotspots, CPU, memory, and latency work.

Goal: produce reliable engineering guidance and implementation steps focused on measurement, profiling evidence, hot path reduction, and regression guards.

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
