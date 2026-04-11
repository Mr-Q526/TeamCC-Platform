---
schemaVersion: '2026-04-11'
skillId: frontend/component-library-basic
name: component-library-basic
displayName: Component Library Basic
description: 'Use when designing component libraries, UI kits, reusable React components, and implementation examples. Basic version focused on API clarity, variants, states, and usage consistency; emphasizes fast layout, obvious labels, a minimal section set, and a short checklist.'
version: '0.1.0'
sourceHash: 'sha256:2a91d34686464f3a8bb4c300340c4ee9e5ed04e57761a778c9914faa34ce1d5b'
domain: frontend
departmentTags: [frontend-platform]
sceneTags: [design]
---

# Component Library Basic

Use this skill when the task is to design component libraries, UI kits, reusable React components, and implementation examples.

Goal: produce a quick but usable draft page or interface that supports API clarity, variants, states, and usage consistency.

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
