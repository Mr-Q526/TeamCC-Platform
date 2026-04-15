---
schemaVersion: 2026-04-11
skillId: frontend/about-company-page-pro
name: about-company-page-pro
displayName: About Company Page PRO
description: Use when designing about pages, company story pages, team pages, and mission pages. Pro version focused on trust, narrative, people, values, and company proof; emphasizes deep information architecture, strong hierarchy, explicit states, responsive behavior, accessibility, and validation checks.
aliases:
  - about-company-page-pro
  - About Company Page PRO
  - aboutcompanypagepro
  - 关于我们
  - 公司介绍
  - 品牌介绍
  - 品牌
  - about
  - company
  - 关于我们页面
  - 公司介绍页面
version: 0.1.0
sourceHash: sha256:d0e153436c5caf8cf6bc76dc359375f34bb6a3292b6b268b994a44a6a82b36b8
domain: frontend
departmentTags:
  - frontend-platform
sceneTags:
  - design
---

# About Company Page PRO

Use this skill when the task is to design about pages, company story pages, team pages, and mission pages.

Goal: produce a high-quality, production-ready page or interface that supports trust, narrative, people, values, and company proof.

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
