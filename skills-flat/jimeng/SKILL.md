---
schemaVersion: '2026-04-11'
skillId: design/jimeng
name: jimeng
displayName: Jimeng
description: 'Generate images via Jimeng (即梦) AI image generation API.'
version: '0.1.0'
sourceHash: 'sha256:056bd2e8962345d24155d26b6604568463de3fe6b43b3e5ced463930adec5c5e'
domain: design
departmentTags: [ai-platform]
sceneTags: [content-generation, design]
---
# Jimeng (即梦) Image Generation

Use the bundled script to generate images via the Jimeng AI image generation API.

Generate

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "一只可爱的猫咪在窗台上晒太阳" --filename "output.png"
```

With model / resolution / aspect-ratio options

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "赛博朋克风格的城市夜景" --filename "city.png" --model jimeng-5.0 --resolution 2k --aspect-ratio 16:9
```

Available models

- `jimeng-5.0` (latest)
- `jimeng-4.6`
- `jimeng-4.5`
- `jimeng-4.1`
- `jimeng-4.0` (default)
- `jimeng-3.1`
- `jimeng-3.0`

Cookie / Session

- `JIMENG_COOKIES` env var — one or more session IDs or full cookie strings, separated by `|||` or `,`
- Or set `skills.jimeng.env.JIMENG_COOKIES` in `~/.openclaw/openclaw.json`

Notes

- Resolutions: `1k` (default), `2k`.
- Aspect ratios: `1:1` (default), `4:3`, `3:4`, `16:9`, `9:16`.
- Use timestamps in filenames: `yyyy-mm-dd-hh-mm-ss-name.png`.
- The script prints a `MEDIA:` line for OpenClaw to auto-attach on supported chat providers.
- Do not read the image back; report the saved path only.
