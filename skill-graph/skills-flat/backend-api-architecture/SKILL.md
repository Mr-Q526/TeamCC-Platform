---
schemaVersion: 2026-04-11
skillId: backend/backend-api-architecture
name: backend-api-architecture
displayName: Backend API Architecture
description: Use when working on backend service architecture, API boundaries, module decomposition, service contracts, and data flow design. Focus on clear ownership, stable interfaces, failure isolation, and maintainability.
aliases:
  - backend-api-architecture
  - Backend API Architecture
  - backendapiarchitecture
  - 服务端
  - server side
  - 服务接口
version: 0.1.0
sourceHash: sha256:5f2c5e93c46886529c2661666e0e57abf8c43a59ee2c82638ad8a1dd5b3ca6d9
domain: backend
departmentTags:
  - backend-platform
sceneTags:
  - architecture
---

# Backend API Architecture

Use this skill when the task involves backend service architecture, API boundaries, module decomposition, service contracts, and data flow design.

Goal: produce reliable engineering guidance and implementation steps focused on clear ownership, stable interfaces, failure isolation, and maintainability.

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
