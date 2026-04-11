# SKILL.md Format Specification

This document describes the SKILL.md format used by n-skills, which follows the [agentskills.io](https://agentskills.io) standard.

## Required Frontmatter

```yaml
---
name: skill-name           # lowercase, hyphens only
description: |             # Include trigger phrases
  What it does.
  When to use it.
  Requirements.
---
```

## Optional Frontmatter

```yaml
version: 1.0.0
license: Apache-2.0
author:
  name: Your Name
  github: username
keywords: [tag1, tag2]
compatibility:
  claude-code: true
  codex: true
```

## Body Structure

```markdown
# Skill Name

## Description (optional)
Expand on the frontmatter description if needed.

## Setup
Any prerequisites or configuration needed.

## Commands/Usage
How to use the skill.

## Examples
Concrete usage examples.

## Advanced
Link to references/ for detailed documentation.
```

## Bundled Resources

Skills can include additional resources:

```
skill-name/
├── SKILL.md           # Required
├── references/        # Extended documentation
│   └── advanced.md
├── scripts/           # Executable code
│   └── helper.py
└── assets/            # Templates, files for output
    └── template.json
```

## Best Practices

1. **Keep SKILL.md concise** - Under 500 lines
2. **Front-load triggers** - Put trigger phrases in the description
3. **Use references/** - Move detailed docs out of SKILL.md
4. **Provide examples** - Concrete, copy-pasteable examples
5. **Document requirements** - API keys, dependencies, etc.
