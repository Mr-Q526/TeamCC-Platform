---
schemaVersion: '2026-04-11'
skillId: backend/rest-api-implementation
name: rest-api-implementation
displayName: REST API Implementation
description: 'Use when working on REST API routes, controllers, validation, pagination, errors, and versioning. Focus on predictable resources, validation, error semantics, and compatibility.'
version: '0.1.0'
sourceHash: 'sha256:3943bc128aedb96bca3c443a2fb9d90eae91c2d1a8c44b7d0a9cba91395b94e5'
domain: backend
departmentTags: [backend-platform]
sceneTags: [architecture, test]
---

# REST API Implementation

Use this skill when the task involves REST API routes, controllers, validation, pagination, errors, and versioning.

Goal: produce reliable engineering guidance and implementation steps focused on predictable resources, validation, error semantics, and compatibility.

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
