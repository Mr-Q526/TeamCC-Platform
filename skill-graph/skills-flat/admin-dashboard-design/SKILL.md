---
schemaVersion: 2026-04-11
skillId: frontend/admin-dashboard-design
name: admin-dashboard-design
displayName: Admin Dashboard Design
description: Use when the task is to design a management console, 管理后台, admin panel, operations dashboard, moderation tool, or back-office web app. Focus on operator efficiency, table-first layout, filters, bulk actions, status visibility, and low-noise product UI.
aliases:
  - admin-dashboard-design
  - Admin Dashboard Design
  - admindashboarddesign
  - 管理后台
  - 后台管理
  - 管理台
  - admin panel
  - 仪表盘
  - 看板
  - 控制台
  - dashboard
  - admin
  - 管理后台设计
  - 后台仪表盘
  - admin dashboard
  - 管理台首页
  - 仪表盘设计
  - dashboard design
version: 0.1.0
sourceHash: sha256:ef09102679aff2ff0be066a14f6c9c4402a79e79e36fec7e22a319a51ddeea14
domain: frontend
departmentTags:
  - frontend-platform
sceneTags:
  - design
---

# Admin Dashboard Design

Use this skill when the page is for operators, support teams, finance teams, content moderators, or internal admins.

Goal: help an experienced operator understand status fast and act with confidence. Optimize for scan speed, row-level actions, and predictable controls.

## Page model

Default structure:

1. Page header: title, scope, freshness, primary action
2. Filter bar: search, status, owner, date range, saved views
3. Summary strip: 3-6 KPIs only if they change decisions
4. Main surface: table, queue, or list as the primary workspace
5. Side panel or drawer: detail, edit, audit log
6. Secondary modules: alerts, failed jobs, notes, recent activity

## Core rules

- Start with the working surface, not a marketing hero.
- Use utility copy and concrete labels.
- Prefer tables for multi-record management; use cards only when records are visual.
- Keep filters sticky when the list is long or frequently refined.
- Put bulk actions near the selection state, not permanently noisy in the header.
- Make status visible with text plus color and icon; never color alone.
- Expose freshness with "last sync", "last updated", or "job age".
- Put destructive actions behind confirmation and show scope before submit.
- Show loading, empty, error, and permission states explicitly.

## Tables and forms

- Columns should answer what, who, when, status, and next action.
- Default sorting must match operator priority, not vanity metrics.
- Inline editing is fine for low-risk fields; use drawers or modals for multi-field edits.
- Bulk actions need count, scope, and undo or confirmation.
- Keep row actions focused: one primary action, overflow for secondary.

## Visual direction

- Calm surfaces, restrained borders, and one accent color.
- Dense but readable spacing.
- Typography should carry hierarchy more than filled cards.
- Charts are secondary unless the page is analytics-first.

## Reject these failures

- Homepage-style hero copy
- Dashboard made only of KPI cards
- Multiple accent colors competing with status semantics
- Hidden filters or hidden destructive actions
- Ambiguous headings like "Overview" when the surface is actually a queue

## Final checks

- Can an operator understand the current state by scanning headings, filters, counts, and rows?
- Is the next action obvious for the top three states?
- Are status, freshness, and ownership visible without clicking in?
