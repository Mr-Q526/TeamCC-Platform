# Skill Evals

统一 Skill 评测系统的数据目录。

当前支持的评测模式：

- `offline-retrieval`
- `graph-uplift`
- `teamcc-sandbox-blind`
- `replay-diagnosis`

本地 Langfuse Docker 部署：

```bash
bun run skills:langfuse:up
```

默认页面：

```text
http://127.0.0.1:3300
```

如果需要把评测 run 发到本地 Langfuse，至少设置：

```bash
export LANGFUSE_HOST=http://127.0.0.1:3300
export LANGFUSE_PUBLIC_KEY=<your-public-key>
export LANGFUSE_SECRET_KEY=<your-secret-key>
```

把 retrieval cases 同步到 Langfuse Dataset：

```bash
bun run skills:langfuse:sync-dataset
```

可选参数：

```bash
bun run skills:langfuse:sync-dataset -- --dataset-kind benchmark --dry-run
bun run skills:langfuse:sync-dataset -- --dataset-kind coverage --dry-run
```

直接从 Langfuse Dataset 拉取 retrieval cases 运行：

```bash
bun run eval:skills --mode offline-retrieval --cases-source langfuse-dataset --dataset-name skill-graph-retrieval-benchmark-v1
```

目录约定：

- `cases/retrieval/coverage/v1/`：coverage dataset，用于召回覆盖与资产 sanity check
- `cases/retrieval/benchmark/v1/`：300 条 user-like benchmark dataset，用于正式检索对比
- `cases/retrieval/coverage/v1/generated/v1/`：按 registry 自动补齐的 coverage cases
- `cases/sandbox/`：TeamCC 沙盒盲测 case
- `sandboxes/`：半成品项目与 fixture artifacts
- `rubrics/`：judge rubric
- `runs/`：每次评测运行的标准化产物
- `reports/`：手工整理的高层报告

生成 retrieval 覆盖 case：

```bash
bun run skills:eval:generate-retrieval-cases
```

生成 300 条 user-like benchmark case：

```bash
export ARK_API_KEY=<your-ark-key>
export VOLC_ARK_CHAT_MODEL=<your-chat-model>
bun run skills:eval:generate-benchmark-cases
```

审计 benchmark case 与抽审清单：

```bash
bun run skills:eval:audit-benchmark-cases
```
