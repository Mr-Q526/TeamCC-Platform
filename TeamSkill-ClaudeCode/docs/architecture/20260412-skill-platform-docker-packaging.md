# Skill 平台 Docker Compose 启动方案

## 1. 文档目标

本文档定义一套面向本地开发、评测和演示环境的 Docker 打包建议，用于把 TeamCC Admin、Skill 评测系统和 Skill 图谱系统统一启动起来。

目标是：

- 除 TeamCC 终端以外，admin、评测、图谱项目都可以通过 Docker 一键启动。
- TeamCC 终端不作为常驻服务启动。
- 评测系统可以在容器环境内并行启动多个 agent，对同一个项目执行测试任务。
- Postgres、pgvector、Neo4j 等数据服务具备清晰的数据卷、健康检查和生命周期。
- 本地开发时尽量减少启动成本，但不牺牲后续 CI、并发评测和数据维护能力。

## 2. 结论摘要

推荐采用：

```text
1 个 docker-compose.skill-platform.yml 作为统一入口
+ 多个职责清晰的应用容器：admin、eval-api、eval-worker、graph-api、graph-worker
+ 独立数据容器：postgres + pgvector、neo4j
+ 可选基础设施容器：redis / queue
```

用户启动方式保持为一条命令：

```bash
docker compose -f docker-compose.skill-platform.yml up -d
```

工程实现上拆成多个容器：

- `teamcc-admin`
- `skill-eval-api`
- `skill-eval-worker`
- `skill-graph-api`
- `skill-graph-worker`
- `postgres`
- `neo4j`

不建议把 admin、eval、graph 打进同一个长期运行容器。多项目场景下，拆成多个容器更利于独立构建、独立日志、独立健康检查、独立重启和后续扩展。

不建议把 Postgres 和 Neo4j 塞进应用容器。数据库可以和应用容器一起由同一个 Compose 文件启动，但应保留独立容器和独立 volume。

## 3. 系统边界

### 3.0 Monorepo 目录方案

当前阶段推荐先采用低风险 monorepo 方案 A：合并为一个 Git 仓库，但保留原项目目录名。

目录结构：

```text
teamcc-platform/
  teamcc-admin/
  TeamSkill-ClaudeCode/
  skill-graph/
  docker-compose.skill-platform.yml
  .env.docker.example
  scripts/
    platform
  docs/
```

该方案的目标是先降低本地启动和 Docker build 成本，不在第一阶段强行重命名或重排项目结构。

保留原目录名的好处：

- 迁移成本最低。
- 原有脚本、README、Dockerfile 和路径引用改动较少。
- 更容易对照历史仓库和历史提交。
- 可以先跑通 Compose 平台，再决定是否整理为 `apps/`、`packages/` 结构。

约束是：

- 三个项目仍然保持独立模块边界。
- admin、eval、graph 不应随意跨目录 import 对方内部代码。
- 共享类型、事件 schema、数据库 schema 后续可以再抽到公共目录。

### 3.0.1 Git 仓库管理方案

采用：

```text
一个 monorepo Git 仓库
+ 多个 git worktree
```

不采用：

```text
外层 teamcc-platform Git 仓库
+ 内层 teamcc-admin/.git
+ 内层 TeamSkill-ClaudeCode/.git
+ 内层 skill-graph/.git
```

原因是嵌套 Git 仓库会让提交、diff、CI、Docker build context 和评测回放变复杂。平台级变更经常同时涉及 compose、admin、eval、graph 和 schema，如果保留三个独立 Git 仓库，就很难保证一次提交代表一套完整可运行的平台版本。

合并后只保留 `teamcc-platform/.git`。三个项目目录只是普通子目录：

```text
teamcc-platform/
  .git/
  teamcc-admin/
  TeamSkill-ClaudeCode/
  skill-graph/
```

旧项目仓库可以保留为只读备份，但不要把它们的 `.git` 复制进 monorepo。

### 3.0.2 复制式合并步骤

本方案使用复制方式迁移，不使用 `git subtree`、`git filter-repo` 或 submodule。这样迁移成本最低，但会丢失三个旧仓库在新仓库中的逐文件历史。旧仓库历史仍可通过归档仓库查询。

假设当前目录结构是：

```text
~/MyProjects/
  teamcc-admin/
  TeamSkill-ClaudeCode/
  skill-graph/
```

第一步，创建新的 monorepo 根目录：

```bash
cd ~/MyProjects
mkdir teamcc-platform
cd teamcc-platform
git init
```

第二步，复制三个项目目录。推荐用 `rsync`，因为它可以显式排除 `.git`、依赖目录和构建产物：

```bash
rsync -a \
  --exclude .git \
  --exclude node_modules \
  --exclude dist \
  --exclude build \
  --exclude coverage \
  --exclude .next \
  --exclude .turbo \
  --exclude .cache \
  --exclude .teamcc \
  ../teamcc-admin/ ./teamcc-admin/

rsync -a \
  --exclude .git \
  --exclude node_modules \
  --exclude dist \
  --exclude build \
  --exclude coverage \
  --exclude .next \
  --exclude .turbo \
  --exclude .cache \
  --exclude .teamcc \
  ../TeamSkill-ClaudeCode/ ./TeamSkill-ClaudeCode/

rsync -a \
  --exclude .git \
  --exclude node_modules \
  --exclude dist \
  --exclude build \
  --exclude coverage \
  --exclude .next \
  --exclude .turbo \
  --exclude .cache \
  --exclude .teamcc \
  ../skill-graph/ ./skill-graph/
```

如果 `skill-graph/` 暂时还不存在，可以先创建空目录或跳过复制：

```bash
mkdir -p skill-graph
```

第三步，在 monorepo 根目录新增平台级文件：

```text
teamcc-platform/
  docker-compose.skill-platform.yml
  .env.docker.example
  .gitignore
  scripts/
    platform
  docs/
```

根目录 `.gitignore` 至少包含：

```gitignore
node_modules
dist
build
coverage
.next
.turbo
.cache
.teamcc
.env
.env.local
.env.docker
*.log
```

第四步，确认没有嵌套 `.git`：

```bash
find . -name .git -type d
```

期望只看到：

```text
./.git
```

如果误复制了子项目 `.git`，删除子项目内的 `.git` 目录：

```bash
rm -rf teamcc-admin/.git
rm -rf TeamSkill-ClaudeCode/.git
rm -rf skill-graph/.git
```

第五步，提交首次导入：

```bash
git add .
git commit -m "Import platform projects"
```

第六步，配置远端仓库：

```bash
git remote add origin <teamcc-platform-git-url>
git branch -M main
git push -u origin main
```

第七步，将旧仓库设置为只读或归档：

```text
teamcc-admin       archived / read-only
TeamSkill-ClaudeCode archived / read-only
skill-graph        archived / read-only
```

后续新开发都进入 `teamcc-platform`，避免新旧仓库同时演进。

### 3.0.3 Worktree 并行开发方案

主目录 `teamcc-platform/` 作为集成工作区，保持干净，用于启动完整平台和最终验证。

不同 agent 使用不同 worktree 和不同分支：

```bash
cd ~/MyProjects/teamcc-platform

git worktree add ../wt-admin-auth -b codex/admin-auth main
git worktree add ../wt-eval-runner -b codex/eval-runner main
git worktree add ../wt-graph-ingest -b codex/graph-ingest main
git worktree add ../wt-platform-docker -b codex/platform-docker main
```

目录结构：

```text
~/MyProjects/
  teamcc-platform/       main，集成验证
  wt-admin-auth/         codex/admin-auth
  wt-eval-runner/        codex/eval-runner
  wt-graph-ingest/       codex/graph-ingest
  wt-platform-docker/    codex/platform-docker
```

每个 worktree 都包含完整 monorepo：

```text
wt-eval-runner/
  teamcc-admin/
  TeamSkill-ClaudeCode/
  skill-graph/
  docker-compose.skill-platform.yml
```

建议分支和目录所有权：

```text
codex/admin-*     主要修改 teamcc-admin/
codex/eval-*      主要修改 TeamSkill-ClaudeCode/
codex/graph-*     主要修改 skill-graph/
codex/platform-*  主要修改 docker-compose、scripts、共享配置、根目录文档
```

如果一个任务需要跨多个项目改动，应明确声明写入范围，例如：

```text
本分支修改 TeamSkill-ClaudeCode/ 和 docker-compose.skill-platform.yml
不修改 teamcc-admin/ 和 skill-graph/
```

共享文件由 `codex/platform-*` 分支优先承接，避免多个 agent 同时修改：

```text
docker-compose.skill-platform.yml
.env.docker.example
scripts/platform
共享事件 schema
数据库 migration
跨项目类型定义
```

### 3.0.4 Worktree 集成流程

每个 agent 在自己的 worktree 内提交：

```bash
git status
git add <changed-files>
git commit -m "Implement eval runner sandbox"
```

集成时在主工作区合并：

```bash
cd ~/MyProjects/teamcc-platform
git switch main
git pull
git merge codex/eval-runner
```

合并后运行平台级验证：

```bash
docker compose -f docker-compose.skill-platform.yml up -d
./scripts/platform doctor
```

如果多个 worktree 需要同时启动 Docker Compose，必须使用不同 project name：

```bash
docker compose -p eval_runner -f docker-compose.skill-platform.yml up -d
docker compose -p graph_ingest -f docker-compose.skill-platform.yml up -d
```

但 host 端口仍会冲突，例如 `3000`、`3100`、`3200`、`5432`、`7474`、`7687`。因此默认策略是：

- 主工作区启动完整平台。
- 普通 agent worktree 只启动自己需要的服务或使用测试命令。
- 多套平台并行运行时，必须通过 `.env` 覆盖端口和 volume 前缀。

完成后清理 worktree：

```bash
git worktree list
git worktree remove ../wt-eval-runner
git branch -d codex/eval-runner
```

### 3.1 包含的项目

Docker 平台包含以下服务镜像：

```text
teamcc-admin
TeamSkill-ClaudeCode / skill-eval
skill-graph
postgres + pgvector
neo4j
```

其中 `skill-eval-api` 和 `skill-eval-worker` 可以复用同一个 `skill-eval` 镜像，通过不同 command 启动；`skill-graph-api` 和 `skill-graph-worker` 也可以复用同一个 `skill-graph` 镜像。

如果图谱能力暂时还在 `TeamSkill-ClaudeCode/` 内，可以先让 graph 服务复用 `TeamSkill-ClaudeCode/` 的镜像和命令；后续独立成 `skill-graph/` 目录后，再切换为独立 build context。

### 3.2 不包含的项目

Docker 平台包不启动 TeamCC 终端。

TeamCC 终端仍然作为用户本地交互入口存在，或者在评测任务中由 eval worker 按需作为子进程启动。它不应作为 Docker 平台的常驻服务。

### 3.3 数据服务边界

Postgres 和 Neo4j 不打入 app 镜像，原因是：

- 数据库有独立的数据卷和备份恢复需求。
- 数据库健康检查、启动顺序、日志和升级策略与应用进程不同。
- 评测并发任务会产生大量运行数据，数据库生命周期不应绑定到 app 容器重建。
- 后续 CI 或远端部署时，可以替换成托管数据库，而不需要重做 app 镜像。

## 4. 推荐拓扑

```text
Host / Browser / CLI
        |
        v
docker compose network
  ├─ teamcc-admin       :3000
  ├─ skill-eval-api     :3100
  ├─ skill-eval-worker  background
  ├─ skill-graph-api    :3200
  ├─ skill-graph-worker background
  ├─ postgres + pgvector
  └─ neo4j
```

共享 volume 建议：

```text
skill_pg_data
skill_neo4j_data
skill_eval_runs
skill_eval_cache
skill_graph_cache
```

## 5. 服务职责

### 5.1 teamcc-admin

Admin 负责身份、项目和策略：

- 用户登录。
- 身份查询。
- 项目权限。
- policy bundle。
- admin 配置管理。

评测系统需要身份和权限信息时，通过 `TEAMCC_ADMIN_URL` 调用 admin API，不直接依赖本地 TeamCC 终端。

### 5.2 skill-eval

Skill Eval 负责完整评测链路：

- 创建 eval run。
- 创建 eval case。
- 准备 sandbox workspace。
- 并行启动多个 agent。
- 收集日志、diff、artifact。
- 执行 verifier。
- 写入评分、trace 和结果。
- 将 Skill 使用事件和评测结果投递给图谱系统。

### 5.3 skill-graph

Skill Graph 负责沉淀长期效果关系：

- 消费 Skill 使用事件。
- 消费用户反馈。
- 消费评测结果。
- 更新 Neo4j 中的 Skill、Task、Concept、Project、Version 关系。
- 维护边权、推荐依据和可解释路径。

### 5.4 postgres + pgvector

Postgres 负责结构化数据和向量数据：

- admin 账号、项目、策略数据。
- skill registry。
- skill version。
- skill embedding。
- feedback fact。
- eval run、case、agent run。
- retrieval snapshot。
- score 和 artifact 元信息。

### 5.5 neo4j

Neo4j 负责图谱关系：

- Skill 与 Skill 的相似、依赖、替代关系。
- Skill 与 Concept、Task、Project 的关系。
- SkillVersion 与效果数据的关系。
- 使用反馈和评测结果沉淀出来的动态边权。

## 6. 运行模式

### 6.1 一键启动平台

本地启动命令：

```bash
docker compose -f docker-compose.skill-platform.yml up -d
```

启动完成后：

```text
Admin       http://localhost:3000
Eval API    http://localhost:3100
Graph API   http://localhost:3200
Neo4j UI    http://localhost:7474
Postgres    localhost:5432
```

### 6.2 一次性执行评测

可通过 eval worker 容器执行一次性评测命令：

```bash
docker compose -f docker-compose.skill-platform.yml exec skill-eval-worker \
  bun run eval:skills
```

后续如果有 eval server，也可以通过 Eval API 创建 run。

### 6.3 图谱初始化

图谱初始化可以由 entrypoint 自动执行，也可以保留手动命令：

```bash
docker compose -f docker-compose.skill-platform.yml exec skill-graph-worker \
  bun run skills:graph:seed-v1
```

V1 建议自动执行幂等 schema 初始化，手动执行 mock seed 或大量数据导入。

## 7. 多容器镜像设计

### 7.1 镜像划分

V1 推荐按项目划分镜像：

```text
teamcc-admin
skill-eval
skill-graph
```

其中：

```text
teamcc-admin      -> 启动 admin-api
skill-eval        -> 启动 eval-api 或 eval-worker
skill-graph       -> 启动 graph-api 或 graph-worker
```

`skill-eval-api` 和 `skill-eval-worker` 使用同一个镜像、不同 command。这样可以保证 API 和 worker 代码版本一致，同时让两个进程拥有独立容器生命周期。

`skill-graph-api` 和 `skill-graph-worker` 同理。

采用 monorepo 方案 A 后，Compose 文件放在 `teamcc-platform/` 根目录，三个项目使用根目录下的相对路径作为 build context：

```yaml
teamcc-admin:
  build:
    context: ./teamcc-admin

skill-eval-api:
  build:
    context: ./TeamSkill-ClaudeCode
    dockerfile: docker/eval.Dockerfile

skill-graph-api:
  build:
    context: ./skill-graph
```

如果图谱代码暂时位于 `TeamSkill-ClaudeCode/` 内，可以先让 `skill-graph-api` 和 `skill-graph-worker` 使用 `./TeamSkill-ClaudeCode` 作为 build context，并指定 `TeamSkill-ClaudeCode/` 内的 graph Dockerfile 或 command。后续图谱独立出来后，再切换为 `./skill-graph`。

### 7.2 进程管理

每个容器只运行一个主要进程，不需要 `supervisord`。

进程清单：

```text
teamcc-admin       -> bun run start
skill-eval-api     -> bun run eval:server
skill-eval-worker  -> bun run eval:worker
skill-graph-api    -> bun run graph:server
skill-graph-worker -> bun run graph:worker
```

这样做的好处：

- 单个进程挂掉时，只重启对应容器。
- 每个服务有独立 healthcheck。
- 日志天然按容器拆分。
- 后续可以单独扩容 `skill-eval-worker`。
- admin、eval、graph 可以独立构建和发布。

如果 `TeamSkill-ClaudeCode/` 或 `skill-graph/` 还没有 `eval:server`、`eval:worker`、`graph:server`、`graph:worker` 脚本，可以先用占位命令或只启动已有的 eval/graph seed 命令，等服务化模块补齐后再切换。

### 7.3 entrypoint 职责

每个服务镜像的 `entrypoint.sh` 建议只做本服务启动前置工作，不承载跨服务编排逻辑。跨服务编排由 Compose 的 `depends_on`、healthcheck 和显式 migration job 负责。

建议拆成：

```text
admin-migrate       一次性执行 admin migration
eval-migrate        一次性执行 eval migration
graph-migrate       一次性执行 graph schema 初始化
teamcc-admin        等待 migration 后启动
skill-eval-api      等待 admin、postgres、neo4j 后启动
skill-eval-worker   等待 eval-api、graph-api 后启动
skill-graph-api     等待 postgres、neo4j 后启动
skill-graph-worker  等待 graph-api 后启动
```

所有 migration 和 schema 初始化都必须幂等。V1 如果不想引入单独 migration job，也可以在服务 entrypoint 中执行幂等初始化，但要避免多个副本同时跑同一段 migration。

## 8. docker-compose 结构建议

文件名建议：

```text
docker-compose.skill-platform.yml
```

服务建议：

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: teamcc
      POSTGRES_USER: teamcc
      POSTGRES_PASSWORD: teamcc
    volumes:
      - skill_pg_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U teamcc -d teamcc"]
      interval: 5s
      timeout: 3s
      retries: 30

  neo4j:
    image: neo4j:5-community
    environment:
      NEO4J_AUTH: neo4j/teamccneo4j
    volumes:
      - skill_neo4j_data:/data
      - skill_neo4j_logs:/logs
    ports:
      - "7474:7474"
      - "7687:7687"
    healthcheck:
      test: ["CMD-SHELL", "cypher-shell -u neo4j -p teamccneo4j 'RETURN 1'"]
      interval: 10s
      timeout: 5s
      retries: 30

  teamcc-admin:
    build:
      context: ./teamcc-admin
    environment:
      TEAMCC_LOCAL_ENABLED: "false"
      DATABASE_URL: postgres://teamcc:teamcc@postgres:5432/teamcc
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3000:3000"

  skill-graph-api:
    build:
      context: ./skill-graph
    command: bun run graph:server
    environment:
      DATABASE_URL: postgres://teamcc:teamcc@postgres:5432/teamcc
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USER: neo4j
      NEO4J_PASSWORD: teamccneo4j
    volumes:
      - skill_graph_cache:/data/cache
    depends_on:
      postgres:
        condition: service_healthy
      neo4j:
        condition: service_healthy
    ports:
      - "3200:3200"

  skill-graph-worker:
    build:
      context: ./skill-graph
    command: bun run graph:worker
    environment:
      DATABASE_URL: postgres://teamcc:teamcc@postgres:5432/teamcc
      GRAPH_API_URL: http://skill-graph-api:3200
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USER: neo4j
      NEO4J_PASSWORD: teamccneo4j
    volumes:
      - skill_graph_cache:/data/cache
    depends_on:
      - skill-graph-api

  skill-eval-api:
    build:
      context: ./TeamSkill-ClaudeCode
      dockerfile: docker/eval.Dockerfile
    command: bun run eval:server
    environment:
      TEAMCC_LOCAL_ENABLED: "false"
      TEAMCC_ADMIN_URL: http://teamcc-admin:3000
      SKILL_GRAPH_URL: http://skill-graph-api:3200
      SKILL_EVAL_POSTGRES_URL: postgres://teamcc:teamcc@postgres:5432/teamcc
      SKILL_NEO4J_URI: bolt://neo4j:7687
      SKILL_EVAL_RUN_ROOT: /data/evals/runs
      SKILL_EVAL_PARALLELISM: "4"
      SKILL_EVAL_PORT_RANGE: 41000-41999
    volumes:
      - skill_eval_runs:/data/evals
      - skill_eval_cache:/data/cache
    depends_on:
      - teamcc-admin
      - skill-graph-api
    ports:
      - "3100:3100"

  skill-eval-worker:
    build:
      context: ./TeamSkill-ClaudeCode
      dockerfile: docker/eval.Dockerfile
    command: bun run eval:worker
    environment:
      TEAMCC_LOCAL_ENABLED: "false"
      TEAMCC_ADMIN_URL: http://teamcc-admin:3000
      SKILL_EVAL_API_URL: http://skill-eval-api:3100
      SKILL_GRAPH_URL: http://skill-graph-api:3200
      SKILL_EVAL_POSTGRES_URL: postgres://teamcc:teamcc@postgres:5432/teamcc
      SKILL_NEO4J_URI: bolt://neo4j:7687
      SKILL_EVAL_RUN_ROOT: /data/evals/runs
      SKILL_EVAL_PARALLELISM: "4"
      SKILL_EVAL_PORT_RANGE: 41000-41999
    volumes:
      - skill_eval_runs:/data/evals
      - skill_eval_cache:/data/cache
    depends_on:
      - skill-eval-api
      - skill-graph-api

volumes:
  skill_pg_data:
  skill_neo4j_data:
  skill_neo4j_logs:
  skill_eval_runs:
  skill_eval_cache:
  skill_graph_cache:
```

这里假设 compose 文件位于 monorepo 根目录 `teamcc-platform/`，三个项目分别位于：

```text
teamcc-platform/teamcc-admin
teamcc-platform/TeamSkill-ClaudeCode
teamcc-platform/skill-graph
```

如果 graph 代码暂时还在 `TeamSkill-ClaudeCode/` 内，可以把 `skill-graph-api` 和 `skill-graph-worker` 的 build context 改为 `./TeamSkill-ClaudeCode`，并指定 `TeamSkill-ClaudeCode/` 内的 graph Dockerfile 或 command。

## 9. 环境变量建议

`.env.docker` 建议包含：

```env
POSTGRES_DB=teamcc
POSTGRES_USER=teamcc
POSTGRES_PASSWORD=teamcc

NEO4J_USER=neo4j
NEO4J_PASSWORD=teamccneo4j

TEAMCC_LOCAL_ENABLED=false
TEAMCC_ADMIN_URL=http://teamcc-admin:3000

SKILL_EVAL_POSTGRES_URL=postgres://teamcc:teamcc@postgres:5432/teamcc
SKILL_GRAPH_URL=http://skill-graph-api:3200
SKILL_NEO4J_URI=bolt://neo4j:7687
SKILL_EVAL_RUN_ROOT=/data/evals/runs
SKILL_EVAL_PARALLELISM=4
SKILL_EVAL_PORT_RANGE=41000-41999
```

模型 API key、embedding API key、Langfuse key 等敏感配置只放 `.env.docker` 或本机 secret 管理，不写入 Dockerfile。

## 10. 并行评测沙盒方案

V1 推荐由 `skill-eval-worker` 容器负责创建独立目录隔离 agent run。

目录结构：

```text
/data/evals/runs/<runId>/
  run.json
  cases/
  sandboxes/
    <caseId>/
      <agentRunId>/
        workspace/
        home/
        tmp/
        logs/
        artifacts/
        diff.patch
        status.txt
        result.json
```

每个 agent run 独立设置：

```env
HOME=/data/evals/runs/<runId>/sandboxes/<caseId>/<agentRunId>/home
TMPDIR=/data/evals/runs/<runId>/sandboxes/<caseId>/<agentRunId>/tmp
SKILL_EVAL_RUN_ID=<runId>
SKILL_EVAL_CASE_ID=<caseId>
SKILL_EVAL_AGENT_RUN_ID=<agentRunId>
SKILL_EVAL_WORKSPACE=/data/evals/runs/<runId>/sandboxes/<caseId>/<agentRunId>/workspace
SKILL_EVAL_ARTIFACT_DIR=/data/evals/runs/<runId>/sandboxes/<caseId>/<agentRunId>/artifacts
```

每个 agent run 必须拥有：

- 独立 workspace。
- 独立 HOME。
- 独立 TMPDIR。
- 独立日志目录。
- 独立端口租约。
- 独立结果文件。

这样可以并行执行：

```text
case A + agent 1
case A + agent 2
case A + agent 3
case B + agent 1
case B + agent 2
```

并保证互不污染。

`skill-eval-api` 和 `skill-eval-worker` 共享 `skill_eval_runs` volume。API 负责展示 run 状态和 artifact，worker 负责写入 sandbox、日志和结果。

## 11. Sandbox 工作区来源

建议按优先级支持三种策略：

### 11.1 git worktree

如果被测项目是 Git 仓库，优先使用 `git worktree`：

```text
source repo -> worktree per agentRunId
```

优点：

- 创建快。
- 易于产出 diff。
- 易于清理。
- 不需要完整复制 `.git` 历史。

### 11.2 copy fallback

如果项目不是 Git 仓库，使用目录复制：

```text
source directory -> sandbox workspace
```

复制时应排除：

```text
node_modules
.git
.next
dist
build
coverage
.turbo
.cache
```

### 11.3 template cache

对于大型项目，可先准备只读 template，然后每个 agent 从 template 快速复制：

```text
project template -> agent workspace
```

后续如果在 Linux 环境中需要进一步优化，可以使用 reflink、overlayfs 或 volume snapshot。

## 12. 端口和资源租约

并行 agent 可能需要启动 dev server 或测试服务，因此 eval worker 必须有端口租约机制。

建议配置：

```env
SKILL_EVAL_PORT_RANGE=41000-41999
```

每个 agent run 分配：

```text
basePort
apiPort
webPort
debugPort
```

端口租约写入：

```text
/data/evals/runs/<runId>/leases/ports.json
```

agent 结束后释放租约。异常退出时由 run cleanup 回收。

## 13. 事件流

推荐事件流：

```text
eval-worker
  -> 写 eval run / case / agent run 到 Postgres
  -> 写本地 JSONL 备份
  -> 产出 artifacts
  -> 调 graph-api ingest
  -> graph-worker 更新 Neo4j
```

Admin 不进入评测热路径，只在评测开始前提供身份和权限信息。

## 14. 健康检查

平台整体健康检查建议拆成服务级 healthcheck：

```text
teamcc-admin       /health /ready
skill-eval-api     /health /ready
skill-eval-worker  worker heartbeat
skill-graph-api    /health /ready
skill-graph-worker worker heartbeat
postgres           pg_isready
neo4j              cypher-shell RETURN 1
```

可以额外提供一个用户侧聚合检查命令：

```bash
./scripts/platform doctor
```

输出示例：

```text
Postgres            ok
Neo4j               ok
TeamCC Admin        ok
Skill Eval API      ok
Skill Eval Worker   ok
Skill Graph API     ok
Skill Graph Worker  ok
```

Compose 层面应优先依赖服务级 healthcheck，不依赖单个聚合平台容器。

## 15. 日志与产物

日志建议优先走 Docker stdout/stderr，并按容器拆分：

```text
docker compose logs teamcc-admin
docker compose logs skill-eval-api
docker compose logs skill-eval-worker
docker compose logs skill-graph-api
docker compose logs skill-graph-worker
```

如需长期保留文件日志，可以额外挂载 `/data/logs`，但不应依赖文件日志作为唯一观测入口。

评测产物写入：

```text
/data/evals/runs/<runId>/
```

每个 agent run 至少保留：

- `prompt.txt`
- `transcript.jsonl`
- `stdout.log`
- `stderr.log`
- `diff.patch`
- `status.txt`
- `result.json`
- `verifier-result.json`

## 16. 安全边界

V1 的 Compose 多容器方案适合本地开发和内部评测，不应直接作为不可信多租户沙盒。

需要注意：

- 不在镜像中写死 API key。
- agent run 不共享 HOME 和 TMPDIR。
- agent run 不共享 workspace。
- 限制并发数。
- 限制 agent 可访问的 host 路径。
- 清理 sandbox 时只能删除 `/data/evals/runs/<runId>` 下的目录。

如果后续要运行不可信任务，建议升级为 ephemeral agent worker 容器：

```text
skill-eval-worker -> Docker socket -> agent-worker container per agent run
```

这会比容器内子进程隔离更安全，也更适合 CI。

## 17. V1 落地文件建议

建议新增：

```text
teamcc-platform/docker-compose.skill-platform.yml
teamcc-platform/scripts/platform
teamcc-platform/.env.docker.example
teamcc-platform/TeamSkill-ClaudeCode/docker/eval.Dockerfile
teamcc-platform/TeamSkill-ClaudeCode/docker/eval-entrypoint.sh
```

如果 graph 是独立项目，则在 graph 项目中新增自己的 Dockerfile：

```text
teamcc-platform/skill-graph/Dockerfile
teamcc-platform/skill-graph/docker/graph-entrypoint.sh
```

如果 graph 暂时仍在 `TeamSkill-ClaudeCode/` 内，则新增：

```text
teamcc-platform/TeamSkill-ClaudeCode/docker/graph.Dockerfile
teamcc-platform/TeamSkill-ClaudeCode/docker/graph-entrypoint.sh
```

建议复用或升级：

```text
teamcc-platform/skill-graph/docker-compose.skill-data.yml
```

当前已有 `skill-graph/docker-compose.skill-data.yml` 包含 Postgres / pgvector 和 Neo4j，V1 可以基于它扩展出平台 compose，避免重复维护数据服务配置。

## 18. 分阶段实施

### Phase 1：Compose 平台可启动

- 建立 monorepo 根目录 `teamcc-platform/`。
- 使用复制方式将 `teamcc-admin/`、`TeamSkill-ClaudeCode/`、`skill-graph/` 放入同一个 Git 仓库。
- 复制时排除子项目 `.git`、`node_modules`、构建产物和本地缓存。
- 确认 monorepo 内只保留 `teamcc-platform/.git`，不保留嵌套 Git 仓库。
- 保留三个项目原目录名，先不做 `apps/` 目录重构。
- 为 admin、eval、graph、platform 四类任务建立 worktree 分支规范。
- 新增 eval Dockerfile。
- 接入 admin Dockerfile。
- 接入 graph Dockerfile 或 graph command。
- 新增 compose 文件。
- 启动 Postgres、Neo4j、admin、eval-api、eval-worker、graph-api、graph-worker。
- 每个服务至少有 healthcheck 或占位健康检查。
- 新增 `scripts/platform up/down/logs/doctor` 包装命令。

### Phase 2：评测 worker 可并行执行

- 实现 run root。
- 实现 sandbox manager。
- 实现 port lease。
- 实现并行 agent run。
- 每个 agent run 输出日志、diff、result。

### Phase 3：图谱消费评测结果

- eval worker 写入 Skill 使用事件。
- graph worker 消费事件。
- Neo4j 更新 Skill / Task / Concept / Project / Version 关系。
- 支持从 Neo4j 查询 Skill 效果和推荐依据。

### Phase 4：升级 agent 隔离

- 增加 agent-worker 镜像。
- eval worker 通过 Docker socket 创建 ephemeral worker 容器。
- 支持 CPU、memory、timeout 限制。
- 支持 CI 中大规模并发评测。

## 19. 当前推荐决策

当前阶段建议采用：

```text
一个 docker compose 命令作为用户入口
采用一个 monorepo Git 仓库，目录为 teamcc-platform/teamcc-admin、teamcc-platform/TeamSkill-ClaudeCode、teamcc-platform/skill-graph
采用多个 git worktree 支持不同 agent 并行开发
admin、eval-api、eval-worker、graph-api、graph-worker 拆成独立应用容器
Postgres + pgvector 独立数据容器
Neo4j 独立数据容器
TeamCC 终端不作为常驻服务启动
```

这个方案兼顾：

- 本地一键启动。
- 用户理解成本低。
- 多项目生命周期清晰。
- 多 agent 并行开发互不踩工作区。
- 单服务故障隔离更好。
- 数据服务可维护。
- 评测并发可扩展。
- 后续可以平滑升级到 agent worker 子容器隔离。
