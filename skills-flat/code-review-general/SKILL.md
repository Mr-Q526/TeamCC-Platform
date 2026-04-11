---
schemaVersion: '2026-04-11'
skillId: review/code-review-general
name: code-review-general
displayName: General Code Review
description: 'Use when working on general code review across frontend, backend, scripts, and infrastructure changes. Focus on bugs, regressions, maintainability risks, and missing tests.'
version: '0.1.0'
sourceHash: 'sha256:609382f2f81dce2a144c4335dd59e10c88b08c695f177e3066dfdcf87a5c8d47'
domain: review
departmentTags: [backend-platform]
sceneTags: [review]
---

# General Code Review

Use this skill when the task involves general code review across frontend, backend, scripts, and infrastructure changes.

Goal: produce reliable engineering guidance and implementation steps focused on bugs, regressions, maintainability risks, and missing tests.

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
