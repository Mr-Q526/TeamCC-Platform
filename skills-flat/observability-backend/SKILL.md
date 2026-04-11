---
schemaVersion: '2026-04-11'
skillId: infra/observability-backend
name: observability-backend
displayName: Backend Observability
description: 'Use when working on logs, metrics, traces, dashboards, alerts, and production debugging for backend systems. Focus on diagnosability, signal quality, SLOs, and incident response.'
version: '0.1.0'
sourceHash: 'sha256:3c43bfa26c5cdace6f1404d4ac3431e063a3db2576fcc873f380e23d2ea072b7'
domain: infra
departmentTags: [infra-platform]
sceneTags: [debug, incident]
---

# Backend Observability

Use this skill when the task involves logs, metrics, traces, dashboards, alerts, and production debugging for backend systems.

Goal: produce reliable engineering guidance and implementation steps focused on diagnosability, signal quality, SLOs, and incident response.

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
