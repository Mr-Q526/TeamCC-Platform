---
schemaVersion: 2026-04-11
skillId: frontend/search-results-page-basic
name: search-results-page-basic
displayName: Search Results Page Basic
description: Use when designing search results, filtering, sorting, faceted navigation, and discovery pages. Basic version focused on query feedback, relevance, filters, and result scanning; emphasizes fast layout, obvious labels, a minimal section set, and a short checklist.
aliases:
  - search-results-page-basic
  - 搜索
  - 搜索结果
  - search results
  - 页面
  - page
  - 基础版
  - basic
  - Search Results Page Basic
  - search
  - results
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
sourceHash: sha256:30e9b0e4c1a49e854426ffa5e37a511b837f13fd7cda48f641a6b84e611c90b1
domain: frontend
departmentTags:
  - frontend-platform
sceneTags:
  - design
---

# Search Results Page Basic

Use this skill when the task is to design search results, filtering, sorting, faceted navigation, and discovery pages.

Goal: produce a quick but usable draft page or interface that supports query feedback, relevance, filters, and result scanning.

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
