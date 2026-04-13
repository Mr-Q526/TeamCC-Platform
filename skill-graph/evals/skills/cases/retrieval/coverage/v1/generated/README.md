# Retrieval Coverage Generated Cases

`coverage/v1/generated/v1/` 存放按当前 `skills-flat/skill-registry.json` 自动补齐的 coverage retrieval case。

生成规则：

- 以当前 coverage dataset 中尚未覆盖的 `skillId` 为目标
- 每个目标 skill 生成 1 条 retrieval case
- 文件按 `domain/skill-name.yaml` 组织
- 自动补 `dataset: retrieval-coverage-v1`
- 自动补 `tags: [set:coverage, ...]`

重建命令：

```bash
bun run skills:eval:generate-retrieval-cases
```
