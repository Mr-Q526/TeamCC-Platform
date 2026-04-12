import os

file_path = "/Users/minruiqing/Mynotebook/MRQ的仓库/Agent项目/ClaudeCode 底座 团队版CodingAgent/任务完成记录.md"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# 匹配需要打勾的内容片段
completed_tasks = [
    "冻结 Identity MD 方案为“纯数字 ID + 映射表 + 运行时策略编译”",
    "明确 Identity MD 不直接携带 `allowed-tools`",
    "支持读取 `.claude/identity/active.md`",
    "增加身份文件变更失效机制",
    "缺失身份文件时回退默认 profile 或受限模式",
    "校验 `user_id`",
    "校验 `department_id`",
    "校验 `team_id`",
    "校验 `role_id`",
    "校验 `level_id`",
    "增加非法身份文件报错逻辑",
    "基于 `docs/身份ID对照表.md` 建立本地映射字典",
    "将数字 ID 映射为 `org`",
    "将数字 ID 映射为 `department`",
    "将数字 ID 映射为 `team`",
    "将数字 ID 映射为 `role`",
    "将数字 ID 映射为 `level`",
    "在 `src/utils/claudemd.ts` 增加身份发现入口",
    "在 `src/context.ts` 注入精简身份说明",
    "保证模型看到的是身份摘要，而非完整内部策略",
    "保证 runtime 可直接读取结构化 `UserProfile`",
    "明确组织策略来源",
    "明确项目策略来源",
    "在 `permissionSetup.ts` 实现交集编译",
    "在 `permissionRuleParser.ts` 保持 deny / ask / allow 语义一致",
    "确保 deny 优先级最高",
    "确保用户本地 allow 不能绕过组织 deny",
    "切换不同 `active.md` 后权限结果发生变化",
    "低权限身份无法使用高危 Skill 放大权限",
    "身份文件缺失时系统可安全回退",
    "完成 Identity MD 接入",
    "完成 `UserProfile` 编译",
    "完成权限交集编译",
    "完成基础回退机制",
    "- [ ] 身份接入",
    "- [ ] 权限交集编译"
]

new_lines = []
for line in lines:
    for task in completed_tasks:
        if task in line and "- [ ]" in line:
            line = line.replace("- [ ]", "- [x]")
            break
    new_lines.append(line)

update_log = """
### 🚀 2026-04-11: Phase 1 身份体系与集成策略全链路闭环
- **完成功能**:
  1. 完成身份加载器：支持读取 \`.claude/identity/active.md\`，校验全部 required 数字 ID（若缺失或非法可安全截断或回退），同时利用 \`src/utils/identity.ts\` 返回带缓存的人类可读标签。
  2. 实现环境与权限融合编译引擎（\`/utils/permissions/identityPolicyLoader.ts\`）：加载 \`department-xxx.json\` 和 \`level-xxx.json\`。基于 \`project-env.json\` 提供 \`{{BACKEND_DIR}}\` 形式的数据插值，并将结果合并且作为全局策略对象输出。
  3. 整合至 \`permissionSetup.ts\` 中，在工具装柜初始化时强行通过 Deny 并集完成底座拦截。保证了即使模型本地 allow，一旦被组织 Deny 也会判定为非合规行为而被阻断。
  4. 建立了 \`testDemoProjectPolicy.ts\`，完成了对不同目录级防越权查询与高危系统指令指令（SSH 等）在各种假定运行环境下的安全验收（全部 Pass）。
  5. 重新梳理了根目录的 \`/docs\` 文件夹，为其配置完善的业务模板目录 (bugs, tasks, summaries, architecture 等) 方便后续流程沉淀。
  
- **设计思路**:
  核心思路为隔离原则。身份属性（纯对象）、权限定义（环境与 JSON 文件配置）和模型视角（在 Context 中仅保留文字摘要而不暴露全部管控规则以避免引导其使用技巧规避）。对于最终权限检查采用“并集聚合，Deny 一票否决权”的方式处理，保证下限系统不可穿透。同时针对项目的不同特殊目录以变量替换实现动态匹配。
"""

for i, line in enumerate(new_lines):
    if "> 每次更新目标：需要标注日期 以及完成的功能 和 设计思路。" in line:
        new_lines.insert(i+1, "\n" + update_log + "\n")
        break

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)
