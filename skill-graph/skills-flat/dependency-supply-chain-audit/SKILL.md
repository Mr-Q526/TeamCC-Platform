---
schemaVersion: 2026-04-11
skillId: security/dependency-supply-chain-audit
name: dependency-supply-chain-audit
displayName: Dependency Supply Chain Audit
description: Use when working on dependency review, vulnerable packages, lockfile risk, license concerns, and supply-chain hygiene. Focus on known CVEs, typosquatting risk, lockfile integrity, and update safety.
aliases:
  - dependency-supply-chain-audit
  - 依赖
  - 依赖安全
  - dependency
  - 供应链
  - 软件供应链
  - 链路
  - Dependency Supply Chain Audit
  - supply
  - chain
  - audit
  - security
  - 安全
  - 安全审计
  - security-audit
  - review
  - 代码审查
  - code review
  - 评审
  - security-platform
version: 0.1.0
sourceHash: sha256:74855dfa0a67e1c73d3a4c550b7752bb4510ab0ad972e73f561be24a9fceaf52
domain: security
departmentTags:
  - security-platform
sceneTags:
  - security-audit
  - review
---

# Dependency Supply Chain Audit

Use this skill when the task involves dependency review, vulnerable packages, lockfile risk, license concerns, and supply-chain hygiene.

Goal: produce reliable engineering guidance and implementation steps focused on known CVEs, typosquatting risk, lockfile integrity, and update safety.

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
