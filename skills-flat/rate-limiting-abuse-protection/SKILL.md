---
schemaVersion: 2026-04-11
skillId: security/rate-limiting-abuse-protection
name: rate-limiting-abuse-protection
displayName: Rate Limiting Abuse Protection
description: Use when working on rate limiting, abuse prevention, anti-scraping, quota, and API protection design. Focus on fairness, tenant isolation, bypass resistance, and operational controls.
aliases:
  - rate-limiting-abuse-protection
  - 限流
  - 速率限制
  - rate limit
  - rate limiting
  - 配额
  - Rate Limiting Abuse Protection
  - rate
  - limiting
  - abuse
  - protection
  - security
  - 安全
  - 安全审计
  - architecture
  - 架构
  - 架构设计
  - 模块边界
  - security-audit
  - security-platform
version: 0.1.0
sourceHash: sha256:6da8a8706e84977563cb4f349f48e7807a2abe98e093162127e09a49ea6b1b2c
domain: security
departmentTags:
  - security-platform
sceneTags:
  - architecture
  - security-audit
---

# Rate Limiting Abuse Protection

Use this skill when the task involves rate limiting, abuse prevention, anti-scraping, quota, and API protection design.

Goal: produce reliable engineering guidance and implementation steps focused on fairness, tenant isolation, bypass resistance, and operational controls.

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
