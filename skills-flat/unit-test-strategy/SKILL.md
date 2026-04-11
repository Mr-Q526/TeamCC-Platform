---
schemaVersion: '2026-04-11'
skillId: review/unit-test-strategy
name: unit-test-strategy
displayName: Unit Test Strategy
description: 'Use when working on unit test design, missing test analysis, mocks, fixtures, and behavior coverage. Focus on meaningful assertions, boundary cases, maintainability, and regression prevention.'
version: '0.1.0'
sourceHash: 'sha256:9df60aeea3b2da929269f9f2c7e7cf022ccd472e22c751e340c745114cbf6a2e'
domain: review
departmentTags: [backend-platform]
sceneTags: [test, review]
---

# Unit Test Strategy

Use this skill when the task involves unit test design, missing test analysis, mocks, fixtures, and behavior coverage.

Goal: produce reliable engineering guidance and implementation steps focused on meaningful assertions, boundary cases, maintainability, and regression prevention.

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
