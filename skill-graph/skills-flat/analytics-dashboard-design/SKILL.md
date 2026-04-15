---
schemaVersion: 2026-04-11
skillId: frontend/analytics-dashboard-design
name: analytics-dashboard-design
displayName: Analytics Dashboard Design
description: Use when the task is to design a BI dashboard, 数据大屏, analytics workspace, reporting console, KPI board, or monitoring page. Focus on question-first information hierarchy, chart choice, filter clarity, metric context, and decision-ready layout.
aliases:
  - analytics-dashboard-design
  - Analytics Dashboard Design
  - analyticsdashboarddesign
  - 数据分析
  - 分析看板
  - BI
  - 指标看板
  - 仪表盘
  - 看板
  - 控制台
  - dashboard
  - analytics
  - 数据看板设计
  - BI 看板
  - analytics dashboard
  - 仪表盘设计
  - dashboard design
version: 0.1.0
sourceHash: sha256:af5666a9ece8cdd0ec73bb133a58809c142f73a0461bb08782be6a51a21e54be
domain: frontend
departmentTags:
  - frontend-platform
sceneTags:
  - design
---

# Analytics Dashboard Design

Use this skill when the page exists to help someone monitor, compare, diagnose, or decide from data.

Goal: answer the top questions in one screen before showing supporting detail. Optimize for trends, context, and confidence, not decoration.

## Working model

Before building, define three things:

- primary questions: the top 3 questions the dashboard must answer
- decision owner: who acts on the data and how often
- freshness model: real-time, hourly, daily, weekly, or static

## Default structure

1. Global controls: date range, environment, segment, saved view
2. Key metrics: 3-5 headline KPIs with clear labels and deltas
3. Trend zone: one or two charts showing movement over time
4. Breakdown zone: dimensions, cohorts, channels, regions, or segments
5. Diagnostic detail: table, funnel, or event list
6. Notes and exceptions: anomalies, alerts, definitions, freshness

## Chart rules

- Pick charts by question, not by novelty.
- Line charts for trend, bars for comparison, area only when cumulative context matters.
- Use consistent units, decimal precision, and time buckets.
- Label axes and legends clearly; never rely on hover alone to explain the chart.
- Reserve accent color for the main series and use muted support colors for context.
- If a chart needs a paragraph to explain it, simplify it or split it.

## Layout rules

- Put the most decision-driving metric in the first visual band.
- Keep filters visible and predictable.
- Align related charts to the same time range and vocabulary.
- Use cards only when they group meaningfully; avoid a wall of equal-weight boxes.
- Show metric definitions and last-updated times near the data.

## Interaction rules

- Drill-down should preserve global filters.
- Hover states add detail; they should not reveal the only useful information.
- Empty states must explain whether data is missing, filtered out, or delayed.
- Export actions must reflect the current filter state.

## Reject these failures

- Decorative gradients behind production charts
- Too many chart types on one page
- KPI rows with no time context or comparison baseline
- Legends that require color memory without labels
- Full-screen "executive summary" banners that push real data below the fold

## Final checks

- Can a user answer the top three questions in under 10 seconds?
- Are metric definitions and freshness visible without hunting?
- Does every chart earn its space by changing a decision?
