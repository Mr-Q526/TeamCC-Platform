---
schemaVersion: 2026-04-11
skillId: ai/humanizer-zh-basic
name: humanizer-zh-basic
displayName: Humanizer ZH Basic
description: Use as a lightweight baseline/control skill for making Chinese AI-generated text sound less artificial. Basic version focuses on simple synonym replacement, shorter sentences, and reduced obvious AI phrases with limited structural diagnosis.
aliases:
  - humanizer-zh-basic
  - Humanizer ZH Basic
  - humanizerzhbasic
  - 去AI味
  - 去AI味道
  - 去除AI痕迹
  - 中文润色
  - 文章改写
  - basic humanizer
  - control skill
  - baseline skill
  - humanizer
  - zh
  - 智能助手
version: 0.1.0
sourceHash: sha256:7daec2e6437d48057453ce63a8b06147c2d35e020560fb7fabfd62703bf86713
domain: ai
departmentTags:
  - ai-platform
sceneTags:
  - content-generation
  - writing
---

# Humanizer ZH Basic

Use this skill as a simple baseline for removing obvious AI flavor from Chinese text.

Goal: make the text a little more natural without deep editing.

## Basic workflow

1. Shorten long sentences.
2. Remove obvious AI cliches.
3. Replace stiff wording with simpler phrases.
4. Make the tone less formal.
5. Keep the original meaning.

## Common removals

- 赋能
- 闭环
- 生态
- 深远影响
- 重要意义
- 全方位
- 极致体验

## Output

Return the rewritten text. Add a short note only if the user asks.

## Final checks

- Is the text easier to read?
- Are obvious AI words reduced?
- Is the original meaning mostly unchanged?
