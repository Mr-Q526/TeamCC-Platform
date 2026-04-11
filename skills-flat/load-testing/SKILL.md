---
schemaVersion: '2026-04-11'
skillId: infra/load-testing
name: load-testing
displayName: Load Testing
description: 'Use when working on load tests for APIs, web services, queues, and critical user flows. Focus on realistic traffic models, throughput, latency percentiles, and bottleneck evidence.'
version: '0.1.0'
sourceHash: 'sha256:6467eb49be493508c0a0dcaab298110165f45722b7d8c0f6d341ba91babdb547'
domain: infra
departmentTags: [infra-platform]
sceneTags: [performance, test]
---

# Load Testing

Use this skill when the task involves load tests for APIs, web services, queues, and critical user flows.

Goal: produce reliable engineering guidance and implementation steps focused on realistic traffic models, throughput, latency percentiles, and bottleneck evidence.

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
