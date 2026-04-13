# Retrieval Benchmark Cases

`benchmark/v1/` 是正式的 retrieval benchmark 题库。

当前约束：

- 总量固定为 `300` 条
- 采用 user-like query
- 语言采用 `中文为主 + 夹英文术语` 与 `纯中文` 混合
- 难度采用：
  - `difficulty:direct`
  - `difficulty:adjacent`
  - `difficulty:ambiguous`
- 每条 case 只有 `1` 个 `mustHitSkillId`

生成命令：

```bash
export ARK_API_KEY=<your-ark-key>
export VOLC_ARK_CHAT_MODEL=<your-chat-model>
bun run skills:eval:generate-benchmark-cases
```

审计命令：

```bash
bun run skills:eval:audit-benchmark-cases
```

Langfuse dataset：

- `skill-graph-retrieval-benchmark-v1`
