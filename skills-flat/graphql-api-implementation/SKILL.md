---
schemaVersion: 2026-04-11
skillId: backend/graphql-api-implementation
name: graphql-api-implementation
displayName: GraphQL API Implementation
description: Use when working on GraphQL schemas, resolvers, mutations, subscriptions, and dataloader patterns. Focus on schema clarity, N+1 avoidance, auth boundaries, and client ergonomics.
aliases:
  - GraphQL API
  - resolver
  - dataloader
  - N+1 查询
  - graphql-api-implementation
  - GraphQL
  - schema
  - mutation
  - API
  - 接口
  - 服务接口
  - GraphQL API Implementation
  - implementation
  - Graph
  - QL
  - backend
  - 后端
  - 服务端
  - server side
  - architecture
  - 架构
  - 架构设计
  - 模块边界
  - test
  - 测试
  - 验证
  - backend-platform
version: 0.1.0
sourceHash: sha256:2db34c44acb8dfbf60e10e057b2554fdb348f7fc0864056b70b9a36d06fc1c96
domain: backend
departmentTags:
  - backend-platform
sceneTags:
  - architecture
  - test
---

# GraphQL API Implementation

Use this skill when the task involves GraphQL schemas, resolvers, mutations, subscriptions, and dataloader patterns.

Goal: produce reliable engineering guidance and implementation steps focused on schema clarity, N+1 avoidance, auth boundaries, and client ergonomics.

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
