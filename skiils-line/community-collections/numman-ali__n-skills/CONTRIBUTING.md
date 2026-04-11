# Contributing to n-skills

This is a **curated marketplace**. All submissions are reviewed for quality and compliance with the [Agent Skills specification](https://agentskills.io/specification).

---

## Official Specification Reference

n-skills follows the **agentskills.io** open standard, adopted by Claude Code, Codex, and other AI tools.

### SKILL.md Requirements

Every skill MUST have a `SKILL.md` file with YAML frontmatter:

```yaml
---
name: skill-name
description: A description of what this skill does and when to use it.
---

# Skill Name

[Instructions for the AI agent]
```

### Required Frontmatter Fields

| Field | Constraints |
|-------|-------------|
| `name` | **Max 64 characters.** Lowercase letters, numbers, and hyphens only. Must not start or end with hyphen. No consecutive hyphens. **Must match parent directory name.** |
| `description` | **Max 1024 characters.** Should describe what the skill does AND when to use it. Include keywords for agent discovery. |

### Optional Frontmatter Fields

| Field | Purpose |
|-------|---------|
| `license` | License name or path to LICENSE file |
| `compatibility` | Environment requirements (e.g., "Requires python>=3.8") |
| `metadata` | Key-value pairs for author, version, etc. |
| `allowed-tools` | Space-delimited list of pre-approved tools |

### Name Field Rules

```yaml
# VALID
name: pdf-processing
name: data-analysis
name: code-review

# INVALID
name: PDF-Processing      # uppercase not allowed
name: -pdf               # cannot start with hyphen
name: pdf--processing    # consecutive hyphens not allowed
name: my_skill           # underscores not allowed
```

### Description Best Practices

**Good:**
```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction.
```

**Poor:**
```yaml
description: Helps with PDFs.
```

---

## Skill Compliance Checklist

Use this checklist when adding any new skill:

### SKILL.md File

- [ ] File is named exactly `SKILL.md` (case-sensitive)
- [ ] YAML frontmatter is valid (starts and ends with `---`)
- [ ] `name` field present and <= 64 characters
- [ ] `name` is lowercase, letters/numbers/hyphens only
- [ ] `name` matches the parent directory name exactly
- [ ] `description` field present and <= 1024 characters
- [ ] `description` includes what the skill does AND when to use it
- [ ] `description` includes trigger keywords for discovery

### Directory Structure

- [ ] Skill folder name matches `name` field in SKILL.md
- [ ] Folder is in correct category: `skills/{category}/{skill-name}/`
- [ ] Categories: `tools`, `automation`, `workflow`, `development`, `productivity`, `data`, `documentation`

```
skill-name/
├── SKILL.md              # Required
├── references/           # Optional: supporting docs
├── scripts/              # Optional: executable code
└── assets/               # Optional: templates, configs
```

### sources.yaml Entry

- [ ] Entry added to `sources.yaml`
- [ ] `name` matches SKILL.md name field
- [ ] `description` matches SKILL.md description
- [ ] `target.category` matches folder location
- [ ] `target.path` is correct path to skill folder
- [ ] `author` info is complete (name, github)
- [ ] `license` is SPDX identifier (MIT, Apache-2.0, etc.)
- [ ] `homepage` links to project repo

### Quality Standards

- [ ] Instructions are clear and actionable
- [ ] Working examples provided
- [ ] No hardcoded secrets or API keys
- [ ] No security vulnerabilities in scripts
- [ ] License is Apache-2.0 or MIT compatible

---

## Two Ways to Contribute

### Option 1: External Skill (Recommended)

Keep your skill in your own repo, we sync it automatically.

**Benefits:**
- You maintain full ownership and control
- Updates sync automatically (daily)
- Clear attribution preserved

**Process:**

1. Open an [issue](https://github.com/numman-ali/n-skills/issues) with:
   - Your repo URL
   - Path to skill folder
   - Brief description

2. If approved, submit a PR adding your entry to `sources.yaml`:

```yaml
- name: your-skill
  description: What it does and when to use it. Include trigger keywords.
  source:
    repo: your-username/your-repo
    path: skills/your-skill
    ref: main
  target:
    category: tools
    path: skills/tools/your-skill
  author:
    name: Your Name
    github: your-username
  license: MIT
  homepage: https://github.com/your-username/your-repo
```

### Option 2: Native Skill

Submit the skill directly to this repo.

1. Fork this repository
2. Add your skill to the appropriate category under `skills/`
3. Add an entry to `sources.yaml` with `native: true`
4. Run the checklist above
5. Open a PR

---

## Marketplace Structure

**Important:** This marketplace uses a single plugin namespace (`n-skills`) for all skills.

Skills display in Claude Code as: `n-skills:skill-name`

The `marketplace.json` consolidates all skills under one plugin. Do NOT create separate plugin entries per skill.

---

## Review Process

1. **Issue triage** - We assess fit for the marketplace
2. **Compliance check** - SKILL.md validated against spec
3. **Manual review** - Quality and usefulness evaluated
4. **Security audit** - Scripts and dependencies reviewed
5. **Merge** - Entry added, sync begins

PRs are typically reviewed within 1-2 days.

---

## Validation

Use the official validator before submitting:

```bash
# Install the skills-ref validator
npm install -g @agentskills/skills-ref

# Validate your skill
skills-ref validate ./path/to/your-skill
```

---

## Questions?

- Open an [issue](https://github.com/numman-ali/n-skills/issues)
- DM [@nummanali](https://x.com/nummanali) on X
