---
schemaVersion: 2026-04-11
skillId: frontend/data-table-basic
name: data-table-basic
displayName: Data Table Basic
description: Use when designing data tables, grids, admin lists, bulk editing, and dense record management. Basic version focused on columns, sorting, selection, inline actions, and density; emphasizes fast layout, obvious labels, a minimal section set, and a short checklist.
aliases:
  - data-table-basic
  - Data Table Basic
  - datatablebasic
  - 表格
  - 数据表格
  - data table
  - table
version: 0.1.0
sourceHash: sha256:616a33ba2ac8e0b036510967a00f97b685ae92d3e93876cf1131d5f3a9f83b62
domain: frontend
departmentTags:
  - frontend-platform
sceneTags:
  - design
---

# Data Table Basic

Use this skill when the task is to design data tables, grids, admin lists, bulk editing, and dense record management.

Goal: produce a quick but usable draft page or interface that supports columns, sorting, selection, inline actions, and density.

## Variant intent

- Use the lightweight draft version for quick prototypes, rough alternatives, or retrieval-quality comparisons. Keep it shippable, but accept simpler structure and fewer refinements.
- Optimize for fast layout, obvious labels, a minimal section set, and a short checklist.
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

## Basic guidance

- Start from a simple recognizable layout and keep the section count low.
- It is acceptable to use conventional patterns if the page remains clear.
- Add only the most important states and interactions.
- Avoid over-polishing; this version is useful for quick drafts and baseline comparisons.
- Mark any assumptions that a stronger version should revisit.

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
