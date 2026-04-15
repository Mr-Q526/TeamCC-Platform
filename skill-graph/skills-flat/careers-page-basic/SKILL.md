---
schemaVersion: 2026-04-11
skillId: frontend/careers-page-basic
name: careers-page-basic
displayName: Careers Page Basic
description: Use when designing careers pages, job boards, recruiting funnels, and employer brand pages. Basic version focused on role discovery, culture proof, benefits, and application clarity; emphasizes fast layout, obvious labels, a minimal section set, and a short checklist.
aliases:
  - careers-page-basic
  - Careers Page Basic
  - careerspagebasic
  - 招聘
  - 加入我们
  - 职位页面
  - careers
  - 招聘页面
  - careers page
version: 0.1.0
sourceHash: sha256:2470622680f5cc40293521106bd6e1d3d5d601663263e73dc09d07254261b4a7
domain: frontend
departmentTags:
  - frontend-platform
sceneTags:
  - design
---

# Careers Page Basic

Use this skill when the task is to design careers pages, job boards, recruiting funnels, and employer brand pages.

Goal: produce a quick but usable draft page or interface that supports role discovery, culture proof, benefits, and application clarity.

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
