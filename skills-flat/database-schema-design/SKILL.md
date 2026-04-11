---
schemaVersion: '2026-04-11'
skillId: backend/database-schema-design
name: database-schema-design
displayName: Database Schema Design
description: 'Use when working on relational or document database schema design, indexing, constraints, and migration planning. Focus on data integrity, query shape, indexing, and future-safe migrations.'
version: '0.1.0'
sourceHash: 'sha256:dd7cb117dc3a2f2fed6db2c63c02818f8dce2521f057482fa6950875d0976e80'
domain: backend
departmentTags: [backend-platform]
sceneTags: [architecture]
---

# Database Schema Design

Use this skill when the task involves relational or document database schema design, indexing, constraints, and migration planning.

Goal: produce reliable engineering guidance and implementation steps focused on data integrity, query shape, indexing, and future-safe migrations.

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
