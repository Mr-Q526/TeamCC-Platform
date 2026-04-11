---
schemaVersion: 2026-04-11
skillId: backend/database-schema-design
name: database-schema-design
displayName: Database Schema Design
description: Use when working on relational or document database schema design, indexing, constraints, and migration planning. Focus on data integrity, query shape, indexing, and future-safe migrations.
aliases:
  - 数据库设计
  - 表结构设计
  - 索引设计
  - 迁移方案
  - database-schema-design
  - 数据库
  - 数据表
  - DB
  - 表结构
  - schema
  - 数据建模
  - 索引
  - 设计
  - UI
  - 视觉设计
  - Database Schema Design
  - database
  - design
  - backend
  - 后端
  - 服务端
  - server side
  - architecture
  - 架构
  - 架构设计
  - 模块边界
  - backend-platform
version: 0.1.0
sourceHash: sha256:e4d06b7ebf7effa4855950b05206aa4cc561fe8cab2d4100a619edc7c457ee7d
domain: backend
departmentTags:
  - backend-platform
sceneTags:
  - architecture
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
