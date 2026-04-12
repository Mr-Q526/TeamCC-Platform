# TeamCC Platform 开发指南

## 1. 仓库定位

本仓库是 TeamCC 平台 monorepo，当前包含两个实际项目：

```text
teamcc-platform/
  teamcc-admin/          # 身份、权限、审计管理后台
  TeamSkill-ClaudeCode/  # TeamSkill CLI、Skill 检索、评测、Neo4j 图谱脚本
```

当前没有独立的 `skill-graph/` 项目。Skill 图谱能力目前由以下内容承载：

```text
TeamSkill-ClaudeCode/docker-compose.skill-data.yml
TeamSkill-ClaudeCode/scripts/seedNeo4jSkillGraphV1.ts
TeamSkill-ClaudeCode/docs/architecture/20260411-skill-neo4j-schema-v1.md
```

也就是说，现阶段的图谱是：

```text
Neo4j Docker 容器
+ TeamSkill-ClaudeCode 内的 schema / seed 脚本
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

mkdir -p .worktrees
git worktree add .worktrees/<worktree-name> -b <branch-name> main
```

进入 worktree 开发：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/.worktrees/<worktree-name>
```

查看已有 worktree：

```bash
git worktree list
```

当前已创建的 worktree：

```text
/Users/minruiqing/MyProjects/teamcc-platform/.worktrees/admin        admin
/Users/minruiqing/MyProjects/teamcc-platform/.worktrees/eval-runner  wt-eval-runner
/Users/minruiqing/MyProjects/teamcc-platform/.worktrees/teamcc       teamcc
/Users/minruiqing/MyProjects/teamcc-platform/.worktrees/skill-graph  skill-graph
```

### 3.1 为什么要同步 main

worktree 分支不是 `main` 的实时镜像。创建后它会停在创建时的提交。

开始开发前建议同步：

```bash
cd /Users/minruiqing/MyProjects/teamcc-platform/.worktrees/<worktree-name>
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
git worktree remove .worktrees/<worktree-name>
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
cd /Users/minruiqing/MyProjects/teamcc-platform/TeamSkill-ClaudeCode
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
cd /Users/minruiqing/MyProjects/teamcc-platform/TeamSkill-ClaudeCode
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
mkdir -p .worktrees
git worktree add .worktrees/<worktree-name> -b <branch-name> main

cd .worktrees/<worktree-name>
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
