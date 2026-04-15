---
schemaVersion: 2026-04-11
skillId: frontend/saas-workspace-design
name: saas-workspace-design
displayName: SaaS Workspace Design
description: Use when the task is to design a SaaS product UI, B2B web app, 工作台, product workspace, settings-heavy application, or multi-pane web tool. Focus on workflow clarity, navigation depth, density balance, state design, and operational efficiency.
aliases:
  - saas-workspace-design
  - SaaS Workspace Design
  - saasworkspacedesign
  - SaaS
  - 工作台
  - B2B 产品
  - workspace
  - Saa
version: 0.1.0
sourceHash: sha256:fe3a4f785faa1a51d2bcbb6802ac01374ab57229cf151cfa111e8bff2f855775
domain: frontend
departmentTags:
  - frontend-platform
sceneTags:
  - design
---

# SaaS Workspace Design

Use this skill for productized web applications where users spend time doing work, not just reading marketing content.

Goal: reduce chrome, clarify workflow, and make high-frequency actions feel fast. Optimize for repeat use, navigation memory, and state predictability.

## Workspace model

Design around these layers:

1. Navigation: workspace switcher, section nav, contextual tabs
2. Primary surface: the object, canvas, table, timeline, or editor
3. Secondary context: inspector, activity, comments, details, or docs
4. Action layer: create, save, publish, assign, or share

## Core rules

- Start from the main job to be done, not from a dashboard card grid.
- Use persistent navigation for repeated workflows.
- Distinguish global navigation from page-level tabs and from inline controls.
- Prefer layout-based grouping over nested cards.
- Use one accent color for key actions and states; let typography and spacing do the rest.
- Dense is acceptable when scan order stays obvious.

## State design

- Show draft, saved, syncing, error, and published states clearly.
- If collaboration exists, expose presence, ownership, and recent change context.
- Empty states should suggest the first meaningful action, not generic welcome copy.
- Long-running actions need progress, cancel, or background execution cues.

## Settings and forms

- Group settings by mental model, not backend schema.
- Keep destructive or billing-sensitive controls separated from routine toggles.
- Use inline helper text when the consequence is not obvious.
- For advanced settings, default to progressive disclosure.

## Interaction

- Keyboard shortcuts, quick search, and command surfaces matter for expert workflows.
- Drawers and panels should preserve context rather than force hard page switches.
- Use motion to reinforce structure: panel reveal, tab transition, save feedback.

## Reject these failures

- Marketing copy pasted into product headers
- Equal visual weight for every module
- Sidebars full of unclear icons
- Multiple sticky bars fighting for attention
- Settings pages that mirror raw JSON or API names

## Final checks

- Can a repeat user build navigation memory after one session?
- Is the main work surface obviously more important than chrome?
- Are key system states visible without requiring refresh or guesswork?
