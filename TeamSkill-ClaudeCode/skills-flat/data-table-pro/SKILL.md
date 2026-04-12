---
schemaVersion: 2026-04-11
skillId: frontend/data-table-pro
name: data-table-pro
displayName: Data Table PRO
description: Use when designing data tables, grids, admin lists, bulk editing, and dense record management. Pro version focused on columns, sorting, selection, inline actions, and density; emphasizes deep information architecture, strong hierarchy, explicit states, responsive behavior, accessibility, and validation checks.
aliases:
  - data-table-pro
  - 数据
  - data
  - 表格
  - 数据表格
  - data table
  - 专业版
  - pro
  - Data Table PRO
  - table
  - frontend
  - 前端
  - Web 前端
  - 页面开发
  - design
  - 设计
  - UI
  - 视觉设计
  - frontend-platform
version: 0.1.0
sourceHash: sha256:9e4123448435d6cf0697f0701510f9b668eaabf0764c9cac38e796e536e14ad0
domain: frontend
departmentTags:
  - frontend-platform
sceneTags:
  - design
---

# Data Table PRO

Use this skill when the task is to design data tables, grids, admin lists, bulk editing, and dense record management.

Goal: produce a high-quality, production-ready page or interface that supports columns, sorting, selection, inline actions, and density.

## Variant intent

- Use the rigorous version when quality, accessibility, conversion, and maintainability matter.
- Optimize for deep information architecture, strong hierarchy, explicit states, responsive behavior, accessibility, and validation checks.
- Prefer concrete UI decisions over generic advice.

## Default workflow

1. Define the primary user, task, and success action.
2. Map the minimum page structure needed for the scenario.
3. Establish hierarchy: what must be understood first, second, and third.
4. Design responsive behavior for mobile and desktop.
5. Add states: loading, empty, error, success, disabled, and permission where relevant.
6. Run the final checks before delivery.

## Design rules

- Use clear section names and user-facing copy.
- Make the primary action visually dominant and repeat it only when it helps.
- Keep navigation and secondary actions subordinate to the main task.
- Use spacing, typography, and alignment before adding decorative containers.
- Do not hide critical information behind hover-only interactions.
- Preserve keyboard access, readable contrast, and touch targets.

## Pro guidance

- Build a strong visual and interaction thesis before writing components.
- Include proof, context, and state transitions when they affect trust.
- Use component variants intentionally: default, hover, active, focus, disabled, loading, error, and empty.
- Validate information architecture, accessibility, and responsive behavior explicitly.
- Avoid filler sections, ornamental cards, and copy that does not change user confidence.

## Reject these failures

- Ambiguous primary action
- Important status or pricing hidden below the fold
- Dense UI with no scan order
- Decorative visuals that compete with the task
- Missing mobile behavior

## Final checks

- Can the target user understand the page purpose in under five seconds?
- Is the next action clear without reading every paragraph?
- Are edge states and responsive behavior accounted for?
