---
schemaVersion: 2026-04-11
skillId: frontend/education-course-page-basic
name: education-course-page-basic
displayName: Education Course Page Basic
description: Use when designing course pages, lesson players, LMS dashboards, and learning paths. Basic version focused on learning hierarchy, progress, practice, and motivation; emphasizes fast layout, obvious labels, a minimal section set, and a short checklist.
aliases:
  - education-course-page-basic
  - 教育
  - 课程
  - 学习
  - 教学
  - 课程页
  - 页面
  - page
  - 基础版
  - basic
  - Education Course Page Basic
  - education
  - course
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
sourceHash: sha256:717ec58a11d432845546c41c244eaa14f3c4da976b917306bec38aac5b102ec1
domain: frontend
departmentTags:
  - frontend-platform
sceneTags:
  - design
---

# Education Course Page Basic

Use this skill when the task is to design course pages, lesson players, LMS dashboards, and learning paths.

Goal: produce a quick but usable draft page or interface that supports learning hierarchy, progress, practice, and motivation.

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
