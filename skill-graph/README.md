# skill-graph

`skill-graph/` 现在是 TeamCC 平台中 Skill 数据、知识图谱资产和离线数据准备链路的主目录。

## 当前边界

当前本项目已经接管以下资产：

- `skills-flat/`
  Skill 数据目录、`skill-registry.json`、`skill-embeddings.json`
- `neo4j/`
  Neo4j Browser 样式和后续图数据库资产
- `scripts/`
  registry、embedding、eval、seed 等数据准备脚本
- `docs/`
  graph 架构、reference、迁移和接手文档

当前 `TeamSkill-ClaudeCode/` 仍保留：

- runtime Skill 检索与调用链路
- agent / REPL / UI 组件
- 对 `skill-graph/skills-flat` 的消费逻辑和兼容入口

也就是说，当前边界已经变成：

```text
skill-graph/           # Skill 数据、graph 资产、seed/eval/registry/embedding
TeamSkill-ClaudeCode/  # runtime 检索、调用、UI，消费 skill-graph 的产物
```

## 推荐迁移顺序

1. 先由 `skill-graph/` 继续统一维护 skill 数据和图谱资产。
2. 再把反馈聚合和图谱异步更新逻辑迁入本项目。
3. 最后让 `TeamSkill-ClaudeCode` 通过接口消费图谱特征，而不是直接持有数据准备逻辑。
