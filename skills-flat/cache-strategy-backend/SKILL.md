---
schemaVersion: '2026-04-11'
skillId: backend/cache-strategy-backend
name: cache-strategy-backend
displayName: Backend Cache Strategy
description: 'Use when working on server-side caching, Redis, CDN coordination, invalidation, and freshness rules. Focus on correctness, invalidation, stampede control, and latency reduction.'
version: '0.1.0'
sourceHash: 'sha256:8e95bafceb527178109011bfc2b5f8c9b7aaf3491ed0d56f98a0de42bdb5eac0'
domain: backend
departmentTags: [backend-platform]
sceneTags: [architecture, performance]
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
