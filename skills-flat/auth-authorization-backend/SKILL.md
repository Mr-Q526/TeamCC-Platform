---
schemaVersion: '2026-04-11'
skillId: backend/auth-authorization-backend
name: auth-authorization-backend
displayName: Backend Auth Authorization
description: 'Use when working on authentication, authorization, sessions, API keys, RBAC, ABAC, and tenant boundaries. Focus on least privilege, secure defaults, session safety, and auditable permission checks.'
version: '0.1.0'
sourceHash: 'sha256:6d0c5fa5935044dfe46da249b1150f237daab956690dcc1fd678c4fc95c0d293'
domain: backend
departmentTags: [backend-platform]
sceneTags: [architecture, security-audit]
---

# Backend Auth Authorization

Use this skill when the task involves authentication, authorization, sessions, API keys, RBAC, ABAC, and tenant boundaries.

Goal: produce reliable engineering guidance and implementation steps focused on least privilege, secure defaults, session safety, and auditable permission checks.

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
