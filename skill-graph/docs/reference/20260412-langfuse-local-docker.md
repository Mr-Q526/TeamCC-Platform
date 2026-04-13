# Langfuse 本地 Docker 部署

`skill-graph` 已经把 Langfuse 接入本地 data stack，作为 Skill 评测系统的观测与评分层。

## 启动

在 `skill-graph/` 下执行：

```bash
bun run skills:langfuse:up
```

或者直接启动整套数据服务：

```bash
bun run skills:db:up
```

## 默认端口

- Langfuse Web: `http://127.0.0.1:3300`
- Langfuse Worker health/process port: `127.0.0.1:3031`
- Langfuse Postgres: `127.0.0.1:54330`
- Langfuse Redis: `127.0.0.1:6380`
- Langfuse ClickHouse HTTP: `127.0.0.1:8124`
- Langfuse ClickHouse Native: `127.0.0.1:9002`
- Langfuse MinIO API: `127.0.0.1:9090`
- Langfuse MinIO Console: `127.0.0.1:9091`

这些端口都可以通过环境变量覆盖。

## 停止与日志

```bash
bun run skills:langfuse:down
bun run skills:langfuse:logs
```

## 初始化与评测接入

Langfuse 本地部署启动后，需要在 Web UI 中创建 project，拿到 project keys，然后导出到评测 runner：

```bash
export LANGFUSE_HOST=http://127.0.0.1:3300
export LANGFUSE_PUBLIC_KEY=<your-public-key>
export LANGFUSE_SECRET_KEY=<your-secret-key>
```

之后运行：

```bash
bun run eval:skills --mode offline-retrieval
```

如果配置正确，run 结果会继续写本地 `evals/skills/runs/<runId>/`，同时也会写到 Langfuse。

## 默认原则

- Langfuse 只做观测、trace 浏览、score 承载。
- `skill-graph` 继续持有 canonical facts、aggregates、Neo4j、retrieval features。
- Langfuse 不可用时，评测仍然可以继续运行，只是不会上报到 Langfuse。
