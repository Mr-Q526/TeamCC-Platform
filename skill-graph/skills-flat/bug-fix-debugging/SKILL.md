---
schemaVersion: 2026-04-11
skillId: general/bug-fix-debugging
name: bug-fix-debugging
displayName: Bug Fix Debugging
description: Use when diagnosing and fixing bugs, regressions, failing tests, runtime errors, broken behavior, and root-cause issues in code. Focus on reproduction, hypothesis-driven debugging, minimal patches, regression tests, and verification.
aliases:
  - bug-fix-debugging
  - Bug Fix Debugging
  - bugfixdebugging
  - 修复 bug
  - 修 bug
  - bug 修复
  - 问题排查
  - 故障定位
  - 回归测试
  - bug
  - 缺陷
  - 故障
  - 调试
  - bug 排查
  - fix
  - debugging
  - 排查
  - 定位问题
version: 0.1.0
sourceHash: sha256:81edfe381b17bc0f49b7cee49f19b5d23476fa6ace60c6ebf8a742dc67fc7731
domain: general
departmentTags:
  - backend-platform
  - frontend-platform
sceneTags:
  - debug
  - test
---

# Bug Fix Debugging

Use this skill when the task is to find and fix a concrete bug or regression in an existing codebase.

Goal: identify the smallest correct fix, prove the root cause, and leave behind a targeted verification path.

## Working model

1. Reproduce or locate the failure signal before editing.
2. State the suspected root cause and the evidence for it.
3. Read the narrowest relevant code path first.
4. Fix the cause, not just the symptom.
5. Add or update a regression test when the project has a nearby test pattern.
6. Run the smallest useful verification command.

## Rules

- Do not rewrite broad modules just to fix a narrow bug.
- Do not silence errors without explaining why the error is impossible or expected.
- Preserve user changes and unrelated dirty files.
- Prefer one minimal patch plus one validation step over speculative refactors.
- If the bug is caused by ambiguous requirements, state the assumption explicitly.

## Output checklist

- Root cause.
- Files changed.
- Why the fix is safe.
- Validation command and result.
- Remaining risk if verification was incomplete.
