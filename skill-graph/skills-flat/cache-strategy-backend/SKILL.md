---
schemaVersion: 2026-04-11
skillId: backend/cache-strategy-backend
name: cache-strategy-backend
displayName: Backend Cache Strategy
description: Use when working on server-side caching, Redis, CDN coordination, invalidation, and freshness rules. Focus on correctness, invalidation, stampede control, and latency reduction.
aliases:
  - cache-strategy-backend
  - Backend Cache Strategy
  - cache strategy backend
  - cachestrategybackend
  - Redis 缓存
  - 缓存击穿
  - 缓存雪崩
  - 缓存失效
  - 缓存
  - Redis
  - cache invalidation
  - 服务端
  - server side
  - cache
  - strategy
  - 性能
  - 性能优化
  - 性能分析
version: 0.1.0
sourceHash: sha256:7cf0f9475c6f2294b701afd65a9e9fa4cb905bfa87bd5516fa357cd48675d498
domain: backend
departmentTags:
  - backend-platform
sceneTags:
  - architecture
  - performance
---

# Backend Cache Strategy

Use this skill when the task involves server-side caching, Redis, CDN coordination, invalidation, and freshness rules.

Goal: produce reliable engineering guidance and implementation steps focused on correctness, invalidation, stampede control, and latency reduction.

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
