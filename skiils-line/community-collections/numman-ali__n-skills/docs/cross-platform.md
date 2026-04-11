# Cross-Platform Compatibility

n-skills works across multiple AI coding agents through a unified approach.

## The Universal Standard

Two files make cross-platform compatibility possible:

1. **SKILL.md** - The [agentskills.io](https://agentskills.io) standard for skill definitions
2. **AGENTS.md** - Universal discovery format (20,000+ repos, native support in major agents)

## Installation by Agent

### Claude Code (Native)

```bash
/plugin marketplace add numman-ali/n-skills
/plugin install zai-cli@n-skills
```

### GitHub Copilot (Native AGENTS.md)

GitHub Copilot [natively reads AGENTS.md](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/) from your repository.

### Codex (Native)

```bash
$skill-installer https://github.com/numman-ali/n-skills/tree/main/skills/tools/zai-cli
```

Or describe: "Install the zai-cli skill from n-skills"

### OpenSkills (Universal)

Works with Cursor, Windsurf, Cline, Aider, and any agent that reads AGENTS.md:

```bash
openskills install numman-ali/n-skills
openskills sync  # Updates AGENTS.md
```

### Factory/Droid (Native AGENTS.md)

Factory's Droid agent natively reads AGENTS.md.

### Claude API / Claude.ai

Skills can be added as system prompts or uploaded as project files.

## Writing Cross-Platform Skills

1. **Use standard SKILL.md format** - Follow agentskills.io
2. **Keep instructions platform-agnostic** - Avoid agent-specific syntax
3. **Document any CLI tools** - Users may need to install them
4. **Test with multiple agents** - At minimum, test with openskills

## How It Works

```
SKILL.md (source of truth)
    ↓
marketplace.json (Claude Code registry)
    ↓
AGENTS.md (universal discovery)
    ↓
Any agent can find and use the skill
```
