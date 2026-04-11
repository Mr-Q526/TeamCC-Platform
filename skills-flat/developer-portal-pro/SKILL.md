---
schemaVersion: '2026-04-11'
skillId: frontend/developer-portal-pro
name: developer-portal-pro
displayName: Developer Portal PRO
description: 'Use when designing API portals, SDK docs, developer onboarding, keys, logs, and integration pages. Pro version focused on quickstart clarity, examples, credentials, and operational feedback; emphasizes deep information architecture, strong hierarchy, explicit states, responsive behavior, accessibility, and validation checks.'
version: '0.1.0'
sourceHash: 'sha256:287ddca5dafed262cd85aa3365a259887b801e387bc8acb10360153ebdfc1c67'
domain: frontend
departmentTags: [frontend-platform]
sceneTags: [design]
---

# Developer Portal PRO

Use this skill when the task is to design API portals, SDK docs, developer onboarding, keys, logs, and integration pages.

Goal: produce a high-quality, production-ready page or interface that supports quickstart clarity, examples, credentials, and operational feedback.

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
