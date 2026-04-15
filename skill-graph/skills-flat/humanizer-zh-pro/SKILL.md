---
schemaVersion: 2026-04-11
skillId: ai/humanizer-zh-pro
name: humanizer-zh-pro
displayName: Humanizer ZH PRO
description: Use when rewriting Chinese articles to remove AI-style writing traces while preserving meaning, factual boundaries, author voice, rhythm, and information density. Pro version focuses on diagnosis, structural editing, natural phrasing, evidence discipline, and publication-ready prose.
aliases:
  - humanizer-zh-pro
  - Humanizer ZH PRO
  - humanizerzhpro
  - 去AI味
  - 去AI味道
  - 去除AI痕迹
  - 中文润色
  - 文章改写
  - 真人写作
  - 自然表达
  - humanizer
  - Chinese writing
  - article rewriting
  - zh
  - 智能助手
version: 0.1.0
sourceHash: sha256:7336bb4589acd2cb6d036edbbb99154a8f0e9582809ffdb8b9a6fbd2a05ef6d5
domain: ai
departmentTags:
  - ai-platform
sceneTags:
  - content-generation
  - writing
---

# Humanizer ZH PRO

Use this skill to turn AI-like Chinese prose into natural, credible writing.

Goal: preserve the author's meaning while removing template structure, inflated claims, empty abstraction, and machine-like rhythm.

## Workflow

1. Diagnose the text before rewriting: identify cliches, fake authority, vague abstractions, repetitive sentence rhythm, and over-neat structure.
2. Preserve facts and intent: do not add examples, statistics, names, dates, or claims unless provided.
3. Rebuild paragraph logic: move from topic sentence to specific evidence, consequence, and concrete observation.
4. Vary sentence rhythm naturally: mix short and medium sentences; avoid forced three-part parallelism.
5. Replace inflated words with precise verbs and nouns.
6. Keep a consistent author voice: do not over-polish into corporate PR.
7. Return both the rewritten version and a short edit note when useful.

## Rewrite rules

- Delete empty phrases such as "重要意义", "深远影响", "全面赋能", "生态闭环" unless they are necessary quoted terms.
- Replace "提升/优化/促进/推动" with the actual action or result.
- Avoid unsupported "业内普遍认为", "专家表示", "数据显示".
- Reduce over-balanced structures like "不仅...而且..." and "从...到...".
- Keep repeated core terms stable instead of rotating synonyms unnaturally.
- Preserve useful roughness when it makes the writing feel human.

## Banned expressions

Do not use these expressions in rewritten output unless they are part of a quoted source that must be preserved:

- 一刀
- 值得看
- 值得
- 不是...而是...
- 这就是为什么
- 为什么很重要
- 很有价值的

When the source text contains one of these expressions, rewrite it into a more direct statement instead of carrying it over.

## Output format

Default:

1. Rewritten article
2. Edit notes, only if they help the user understand major changes

For short text, return only the rewritten text unless the user asks for explanation.

## Final checks

- Did the meaning stay the same?
- Did any unsupported information get added?
- Does the text sound like a person with a specific view, not a generic assistant?
- Are the paragraphs less templated and more concrete?
- Are all banned expressions removed from the rewritten output?
