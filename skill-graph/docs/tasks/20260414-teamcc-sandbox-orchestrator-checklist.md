# 真实 TeamCC 沙盒 Orchestrator 设计与实现清单

## 1. 目标

把当前 `fixture` 型 sandbox eval 升级为**真实 TeamCC 沙盒盲测 orchestrator**。

目标形态不是读取预制 artifact，而是：

```text
评测 case
  -> 创建独立工作目录
  -> 复制半成品项目
  -> 启动 TeamCC
  -> TeamCC 自主检索 / 选 Skill / 执行任务
  -> 收集 retrieval / skill / diff / judge artifact
  -> 输出统一 run 结果
```

## 2. 当前现状

当前 `skill-graph/src/evals/sandbox.ts` 能做的是：

- 读取 sandbox case
- 进入已有 sandbox 目录
- 可选执行一条命令
- 读取或拷贝预先存在的 artifact
- 跑 verification
- 读取 judge 结果

当前不能做的是：

- 为每个 case 创建一次性独立 workdir
- 复制半成品项目到新 workdir
- 真正启动一个 TeamCC runtime/CLI 实例
- 发送任务并等待 TeamCC 自主完成
- 在运行过程中实时采集 TeamCC 产生的 artifact
- 对一次 TeamCC run 做生命周期管理和超时回收

因此当前 sandbox 仍然是 **fixture validator**，不是 **真实盲测 orchestrator**。

## 3. 目标边界

### 3.1 `skill-graph` owner

这份 orchestrator 应由 `skill-graph` 持有，负责：

- case schema
- sandbox 准备
- workdir 生命周期管理
- TeamCC 进程编排
- artifact 收集
- verification / judge 执行
- 结果落盘

### 3.2 TeamCC 需要提供的最小接口

TeamCC 不需要先改 UI，但至少需要提供可脚本化运行入口和稳定 artifact 协议。

最小必需项：

- 一个可从命令行启动的 TeamCC 入口
- 能指定 `cwd`
- 能指定一次任务输入
- 能在项目目录下产出下列文件之一：
  - `retrieval-request.json`
  - `retrieval-response.json`
  - `skill-discovery-attachment.json`
  - `chosen-skill.json`
  - `skill-events.jsonl`
  - `final-diff.patch`
- 运行结束时可判断成功、失败、超时

如果 TeamCC 暂时还不能直接产出这些文件，至少要能把它们写入 stdout/stderr 或单一 log，再由 orchestrator 拆分。

## 4. 目标执行链路

一次真实 L3 盲测的标准链路：

```text
load case
  -> provision sandbox workdir
  -> copy project seed
  -> materialize task brief
  -> launch TeamCC process
  -> wait / poll / timeout
  -> collect TeamCC artifacts
  -> run verification commands
  -> run judge
  -> persist run result
  -> classify failure if needed
```

## 5. 核心组件设计

### 5.1 Sandbox Provisioner

职责：

- 为每个 case 生成唯一 `sandboxRunId`
- 创建目录：
  - `<runDir>/sandboxes/<sandboxRunId>/`
- 将 `projectSeed.rootDir` 指向的半成品项目复制到该目录
- 生成 `sandbox-manifest.json`

最低输出：

- `sandboxRunId`
- `sandboxRoot`
- `projectRoot`
- `taskBriefPath`

### 5.2 TeamCC Launcher

职责：

- 以独立进程启动 TeamCC
- 注入：
  - `cwd`
  - 任务描述
  - 运行标识
  - artifact 输出位置
- 记录：
  - pid
  - startedAt
  - exitCode
  - stdout / stderr log

建议统一环境变量：

- `TEAMCC_EVAL_RUN_ID`
- `TEAMCC_EVAL_CASE_ID`
- `TEAMCC_EVAL_SANDBOX_ID`
- `TEAMCC_EVAL_ARTIFACT_DIR`
- `TEAMCC_EVAL_TASK_FILE`

### 5.3 Artifact Collector

职责：

- 从 TeamCC 输出目录中收集标准 artifact
- 将 artifact 复制到：
  - `<runDir>/artifacts/<caseId>/`
- 补充缺失状态：
  - `requestLogged`
  - `responseLogged`
  - `eventsLogged`

标准 artifact 清单：

- `raw-input.json`
- `retrieval-request.json`
- `retrieval-response.json`
- `skill-discovery-attachment.json`
- `chosen-skill.json`
- `skill-events.jsonl`
- `final-diff.patch`
- `teamcc-run.stdout.log`
- `teamcc-run.stderr.log`
- `judge-result.json`

### 5.4 Verification Runner

职责：

- 在复制后的 `projectRoot` 中执行 case 的 verification commands
- 保存：
  - command
  - exitCode
  - stdout
  - stderr

### 5.5 Judge Runner

职责：

- 支持 `human` 与 `llm`
- 读取：
  - task brief
  - final diff
  - verification results
  - retrieval / skill artifacts
- 输出统一 `SkillEvalJudgeResult`

### 5.6 Failure Classifier

职责：

- 针对失败 case 追加初步失败归因

最小分类：

- `T1` TeamCC 启动或 request adaptation 错误
- `T2` TeamCC 检索后未选合理 Skill
- `E1` 执行失败
- `F1` artifact/feedback 链路缺失

## 6. Case Schema 需要补充的字段

当前 `SkillSandboxEvalCase` 还不够驱动真实 orchestrator，建议增加：

- `projectSeed.copyMode`
  - `copy`
  - `rsync`
  - `git-worktree`
- `execution.entryCommand`
  - 真正启动 TeamCC 的命令模板
- `execution.timeoutSeconds`
- `execution.idleTimeoutSeconds`
- `execution.env`
  - 额外环境变量
- `artifactContract.mode`
  - `files`
  - `stdout-jsonl`
  - `combined-log`
- `artifactContract.required`
  - 必须收集到的 artifact 文件列表
- `cleanup.keepSandboxOnFailure`

## 7. 建议目录结构

```text
skill-graph/evals/skills/
  sandboxes/
    <sandbox-id>/
      seed/
      fixtures/
      rubric/
  runs/
    <run-id>/
      run-manifest.json
      summary.json
      report.md
      sandboxes/
        <sandbox-run-id>/
      artifacts/
        <case-id>/
```

## 8. 实现清单

### Phase 1: 让 orchestrator 真的能启动 TeamCC

- [ ] 新增 `src/evals/sandboxOrchestrator.ts`
- [ ] 抽离 `sandbox.ts` 中与 fixture 复制、verification、judge 相关的公共逻辑
- [ ] 新增 `provisionSandboxWorkdir()`
- [ ] 新增 `launchTeamccRun()`
- [ ] 新增 `waitForTeamccExit()`
- [ ] 新增 `collectSandboxArtifacts()`
- [ ] 新增超时与中断清理逻辑

### Phase 2: 扩展 sandbox case schema

- [ ] 为 sandbox case 增加真实运行所需字段
- [ ] 保持对旧 fixture case 的兼容
- [ ] 新增 schema 验证测试

### Phase 3: 接 TeamCC artifact 协议

- [ ] 明确 TeamCC 输出目录与文件名约定
- [ ] 在 orchestrator 中实现 artifact completeness 检查
- [ ] 缺失关键 artifact 时直接标记失败

### Phase 4: 真实盲测 runner

- [ ] 在 `skillRetrievalEval.ts` 中增加 `teamcc-sandbox-live` 模式
- [ ] 让 `teamcc-sandbox-blind` 继续保留为 fixture mode
- [ ] 为 live mode 写独立 summary 与 report

### Phase 5: 验收与回放

- [ ] 至少新增 3 个真实半成品 sandbox cases
- [ ] 跑通 1 次真实 TeamCC live sandbox eval
- [ ] 失败 case 自动输出 replay-ready artifact

## 9. 验收标准

达到以下条件，才能认为“真实 TeamCC 沙盒 orchestrator 已可用”：

1. 能为每个 case 创建独立 workdir，不污染源 seed。
2. 能真实启动 TeamCC 进程，而不是读取预制 artifact。
3. 能稳定收集 retrieval / skill / diff / judge artifact。
4. 至少一个 case 能完整跑通并给出 `overallPass`。
5. 失败 case 能区分：
   - 启动失败
   - 检索/选择失败
   - 执行失败
   - artifact 缺失

## 10. 首批实现建议

建议先只做 1 个最小 live case：

- `homepage-blind-live`

原因：

- 场景清晰
- skill 候选稳定
- verification 简单
- 适合先打通 orchestrator 全链路

完成这个 case 后，再扩到：

- `admin-dashboard-live`
- `ppt-maker-live`
- `vercel-deploy-live`

## 11. 当前结论

当前评测体系里：

- L1 离线检索评测：已可用
- L2 图谱增益评测：已可用
- L3 TeamCC 盲测：**框架已搭，真实 orchestrator 尚未实现**

因此下一步工作的重点，不是继续讨论“能不能做真实盲测”，而是按这份清单把 orchestrator 真正落地。
