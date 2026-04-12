# TeamCC Platform 开发指南

## 1. 仓库定位

本仓库是 TeamCC 平台 monorepo，当前包含三个实际项目：

```text
teamcc-platform/
  teamcc-admin/          # 身份、权限、审计管理后台
  TeamSkill-ClaudeCode/  # TeamSkill CLI、runtime Skill 检索/调用、终端 UI
  skill-graph/           # Skill 数据、registry/embedding/eval/seed、Neo4j 图谱资产
```

当前 Skill 图谱能力已经拆分为两层：

```text
skill-graph/
  skills-flat/
  docker-compose.skill-data.yml
  scripts/
  docs/

TeamSkill-ClaudeCode/
  src/services/skillSearch/
  src/skills/
  src/tools/SkillTool/
```

也就是说，现阶段的职责是：

```text
skill-graph/           持有 Skill 数据和图谱资产
+ TeamSkill-ClaudeCode/ 消费这些产物提供 runtime 能力
```

## 2. Git 分支规范

### 2.1 主分支

```text
main
```

`main` 是当前平台主线，代表可用于本地联调和继续开发的最新基线。

### 2.2 历史分支

```text
history/teamcc-admin
history/teamskill
```

这两个分支只用于保留旧仓库历史和 commit message 中的任务总结。

不要把 `history/*` 合并进 `main`。

查询旧历史：

```bash
git log history/teamcc-admin
git log history/teamskill
```

GitHub 首页如果提示 `Compare & pull request`，直接忽略。`history/*` 不是功能分支。

### 2.3 开发分支

当前统一使用这 4 条开发分支：

```text
teamcc
admin
wt-eval-runner
skill-graph
```

各自职责：

```text
teamcc         对原本的 TeamSkill-ClaudeCode / CC 本体进行改造
admin          处理 teamcc-admin 管理平台相关功能
wt-eval-runner 推进 TeamCC / Skill 测评系统
skill-graph    推进 Skill 知识图谱相关开发
```

如果一个任务必须跨多个目录修改，需要在 PR 或任务说明中明确写出修改范围。

## 3. Worktree 开发方式

主工作区：

```text
/Users/minruiqing/MyProjects/teamcc-platform
```

主工作区用于集成验证，不建议直接在这里长期做功能开发。

创建新的 worktree：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform
git fetch origin
git switch main
git pull

mkdir -p worktrees
git worktree add worktrees/<worktree-name> -b <branch-name> main
```

进入 worktree 开发：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/worktrees/<worktree-name>
```

查看已有 worktree：

```bash
git worktree list
```

当前已创建的 worktree：

```text
/Users/minruiqing/MyProjects/teamcc-platform/worktrees/admin        admin
/Users/minruiqing/MyProjects/teamcc-platform/worktrees/eval-runner  wt-eval-runner
/Users/minruiqing/MyProjects/teamcc-platform/worktrees/teamcc       teamcc
/Users/minruiqing/MyProjects/teamcc-platform/worktrees/skill-graph  skill-graph
```

### 3.1 为什么要同步 main

worktree 分支不是 `main` 的实时镜像。创建后它会停在创建时的提交。

开始开发前建议同步：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/worktrees/<worktree-name>
git fetch origin
git merge origin/main
```

这样可以避免基于旧代码继续开发，减少后续合并冲突。

### 3.2 完成功能后

在自己的 worktree 内提交：

```bash
git status
git add <changed-files>
git commit -m "Short imperative summary"
git push -u origin <branch-name>
```

然后在 GitHub 上从对应开发分支向 `main` 提 PR。

### 3.3 清理 worktree

合并完成后：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform
git worktree remove worktrees/<worktree-name>
git branch -d <branch-name>
```

## 4. 本地启动

### 4.1 启动数据服务

Admin 数据库：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/teamcc-admin
docker compose up -d
```

Skill 数据库和 Neo4j：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/skill-graph
bun run skills:db:up
```

确认容器：

```bash
docker ps | grep -E 'teamcc|teamskill|neo4j|pgvector'
```

当前端口：

```text
teamcc-admin-db         localhost:5432
teamskill-skill-pg      localhost:54329
teamskill-skill-neo4j   localhost:7474 / 7687
```

Neo4j Browser：

```text
http://127.0.0.1:7474
username: neo4j
password: skills_dev_password
```

### 4.2 初始化数据

Admin schema 和 seed：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/teamcc-admin
npm ci
npm run db:push
npm run seed
```

Skill 图谱 seed：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/skill-graph
bun run skills:graph:seed-v1
```

### 4.3 启动 Admin 后端

前台启动：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/teamcc-admin
npm run dev
```

后台 screen 启动：

```bash
screen -dmS teamcc-admin-dev bash -lc 'cd /Users/minruiqing/MyProjects/teamcc-platform/teamcc-admin && npm run dev'
```

健康检查：

```bash
curl http://127.0.0.1:3000/health
```

期望：

```json
{"status":"ok"}
```

### 4.4 启动 Admin 前端

首次安装：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/teamcc-admin/frontend
npm ci
```

前台启动：

```bash
npm run dev -- --host 127.0.0.1
```

后台 screen 启动：

```bash
screen -dmS teamcc-admin-frontend bash -lc 'cd /Users/minruiqing/MyProjects/teamcc-platform/teamcc-admin/frontend && npm run dev -- --host 127.0.0.1'
```

访问：

```text
http://127.0.0.1:5173/
```

默认登录：

```text
username: admin
password: password123
```

### 4.5 验证 TeamSkill CLI

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/TeamSkill-ClaudeCode
bun run version
```

期望：

```text
999.0.0-restored (Claude Code)
```

## 5. 停止服务

停止 screen 进程：

```bash
screen -S teamcc-admin-dev -X quit
screen -S teamcc-admin-frontend -X quit
```

停止 Admin 数据库：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/teamcc-admin
docker compose down
```

停止 Skill 数据服务：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/TeamSkill-ClaudeCode
bun run skills:db:down
```

查看仍在监听的端口：

```bash
for p in 3000 5173 5432 54329 7474 7687; do
  echo "== port $p =="
  lsof -nP -iTCP:$p -sTCP:LISTEN || true
done
```

## 6. 401 处理

如果页面出现：

```text
401 Unauthorized
```

通常是浏览器里残留了旧 token。当前前端已经支持受保护 API 返回 401 时自动清理登录态并回到登录页。

如果仍卡住，可以在浏览器 console 执行：

```js
localStorage.removeItem('accessToken')
localStorage.removeItem('refreshToken')
location.reload()
```

## 7. 构建与验证

TeamSkill 基础验证：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/TeamSkill-ClaudeCode
bun run version
docker compose -f docker-compose.skill-data.yml config
```

Admin 后端基础验证：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/teamcc-admin
npm run db:push
npm run seed
curl http://127.0.0.1:3000/health
```

Admin 前端开发态验证：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/teamcc-admin/frontend
npm run dev -- --host 127.0.0.1
```

当前已知：`teamcc-admin/frontend` 的生产构建还存在历史 TypeScript 严格检查问题，例如未使用变量和图标类型不匹配。开发态 Vite 可正常运行，但进入 Docker 镜像或 CI 前必须修复：

```bash
npm run build
```

## 8. Secrets 与忽略文件

不要提交：

```text
.env
.env.local
.env.docker
node_modules
.teamcc
.cache
dist
build
coverage
*.log
```

当前根 `.gitignore` 已忽略这些文件。

如果 GitHub push protection 拦截推送，说明历史或当前提交里含有疑似密钥。不要绕过保护，应删除或重写对应提交后再推送。

## 9. 当前推荐开发流程

普通功能：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform
git fetch origin
git switch main
git pull
mkdir -p worktrees
git worktree add worktrees/<worktree-name> -b <branch-name> main

cd worktrees/<worktree-name>
# 修改代码
git add <files>
git commit -m "Implement feature x"
git push -u origin <branch-name>
```

平台集成验证：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform
git switch main
git pull

cd teamcc-admin
docker compose up -d
npm run db:push
npm run seed

cd ../TeamSkill-ClaudeCode
bun run skills:db:up
bun run skills:graph:seed-v1
bun run version
```

分支合并原则：

```text
history/* 只查历史，不合并
teamcc / admin / wt-eval-runner / skill-graph 开发完成后提 PR 到 main
main      保持可启动、可联调
```

## 10. Docker 运行规范

### 10.1 核心原则

**所有 Docker 服务（数据库、API、前端）统一在主工作区的 `main` 分支启动。**

```text
主工作区 (main)     → 唯一的 Docker 启动位置
各个 worktree       → 只跑裸 dev server（npm run dev / bun run dev），通过网络连主工作区的容器
```

### 10.2 为什么不在 worktree 里启动 Docker

Docker Compose 的 bind mount（如 `- .:/app`、`- ./frontend:/app`）使用相对路径，解析基准是 `docker compose up` 执行时的工作目录。

```yaml
# docker-compose.yml 中的挂载
volumes:
  - ./frontend:/app    # 这个 ./ 指向你执行命令时所在的目录
```

如果在 `worktrees/admin/teamcc-admin/` 启动，Docker 只能看到 `admin` 分支的前端代码。`skill-graph` 分支做的前端修改存在于 `worktrees/skill-graph/teamcc-admin/frontend/`，Docker 完全看不到。

**每个 worktree 是独立的文件目录，Docker 只能挂载一个。** 这意味着：

- ❌ 不可能通过 Docker 同时看到两个分支的修改
- ❌ 在 worktree 里启动 Docker 会让其他分支的改动"消失"
- ❌ 两个 worktree 同时启动同一个 Docker Compose 会导致端口冲突和容器名冲突

### 10.3 正确做法

#### 数据服务（数据库、Neo4j）

始终在主工作区启动，所有 worktree 通过网络端口连接：

```bash
# 在主工作区启动
cd /Users/minruiqing/MyProjects/teamcc-platform/teamcc-admin
docker compose up -d postgres    # 只启动数据库

cd /Users/minruiqing/MyProjects/teamcc-platform/skill-graph
bun run skills:db:up             # pgvector + Neo4j
```

数据库通过 `localhost:5432`、`localhost:54329`、`localhost:7474` 等端口访问，不受文件目录影响。

#### 后端 API

推荐在 worktree 中裸跑 dev server，而不是用 Docker：

```bash
# 在你当前开发的 worktree 里
cd worktrees/<worktree-name>/teamcc-admin
npm run dev
```

如果确实需要 Docker 启动 API 容器（如需要完整的容器化环境），必须先合并代码到 `main`，然后在主工作区启动。

#### 前端

始终在 worktree 中裸跑 Vite dev server：

```bash
# 在你当前开发的 worktree 里
cd worktrees/<worktree-name>/teamcc-admin/frontend
npm install
npm run dev -- --host 127.0.0.1
```

Vite 直接从本地文件系统读取代码，不涉及 Docker 挂载路径问题。

### 10.4 需要同时看到多分支改动时

如果你需要同时验证 `admin` 和 `skill-graph` 两个分支的前端改动，必须先在 Git 层面合并代码：

```bash
# 方案 A：在其中一个 worktree 里合并另一个分支
cd worktrees/admin
git merge skill-graph

# 方案 B：两个分支都合并到 main，然后在主工作区启动
# 1. 各分支提交 PR 到 main
# 2. 合并后：
cd /Users/minruiqing/MyProjects/teamcc-platform
git switch main && git pull
cd teamcc-admin
docker compose up -d
```

### 10.5 服务分层速查

| 服务 | 启动位置 | 启动方式 | 是否受 worktree 隔离影响 |
|------|---------|---------|------------------------|
| PostgreSQL (Admin) | 主工作区 | `docker compose up -d postgres` | ❌ named volume, 通过端口访问 |
| pgvector (Skill) | 主工作区 | `bun run skills:db:up` | ❌ named volume, 通过端口访问 |
| Neo4j | 主工作区 | `bun run skills:db:up` | ❌ named volume, 通过端口访问 |
| Admin API | worktree | `npm run dev` (裸跑) | ✅ 读取本地代码 |
| Admin Frontend | worktree | `npm run dev -- --host 127.0.0.1` (裸跑) | ✅ 读取本地代码 |
| TeamSkill CLI | worktree | `bun run version` | ✅ 读取本地代码 |

### 10.6 docker-compose.yml 里的 api / web 服务何时使用

`teamcc-admin/docker-compose.yml` 中的 `api` 和 `web` 服务适用于：

- 部署到 staging 或生产环境
- 需要容器化完整性测试
- CI/CD 流水线

**日常功能开发时，不要使用它们。** 只启动 `postgres` 服务即可：

```bash
docker compose up -d postgres
```
