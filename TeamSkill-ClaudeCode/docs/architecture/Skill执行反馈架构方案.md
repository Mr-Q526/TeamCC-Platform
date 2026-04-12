# Skill 执行反馈机制架构方案

本方案的目标是实现一个支持 1-5 分制的反馈问卷，在 Skill（技能）执行完成后触发，以捕获用户的满意度数据（CSAT）并向服务端发送日志埋点。

## 调研与触发点分析
1. **Skill 执行上下文**：Skill 操作是通过 `SkillTool` 工具调用的。它在运行时的状态记录在 `AppState` 的 `getInvokedSkillsForAgent` 集合中。
2. **执行完成的钩子（Hook）**：对 CLI 主线程而言，当 AI 代理完成了围绕该 Skill 的所有交互并重新将控制权交还给用户时（即 `screen === 'prompt'` 且 `!isLoading` 时），即可视为该次任务“执行完成”。
3. **现有设计模式**：项目中目前在 `src/components/FeedbackSurvey/` 目录下已有部分标准的 FeedbackSurvey，同时 `REPL.tsx` 里也有 `<SkillImprovementSurvey>` 的实践。我们将采用这种解耦的模块化方式，新建一个专门处理新功能的 `<SkillFeedbackSurvey>` 组件。

## 方案修改计划

### 新建 `src/components/SkillFeedbackSurvey.tsx`
- 开发基于 `ink` 的全新 UI 组件，参考现有的 `FeedbackSurveyView` 写法。
- 在 CLI 界面显示文案：`你觉得本次执行效果怎么样？：1.非常棒 2.好 3.一般 4.糟糕 5.忽略`
- 进行键盘事件映射，直接拦截数字键 `1-5`。

### 新建 `src/hooks/useSkillFeedbackSurvey.ts`
- 开发状态管理 Hook，保证在每个 Skill 会话结束后只弹窗一次。
- **触发判断条件**：`!isLoading && screen === 'prompt'`。
- **目标检测**：通过 `getInvokedSkillsForAgent(null)` 提取此次会话执行过的 Skill 信息（需要包含 `skillId`, `version`, `sourceHash` 属性），并在 Hook 内部记录已调研过的技能，避免重复弹窗。
- **埋点结构对接**：用户操作后，不再使用简单的 analytics 自定义事件，而是严格遵循《Skill 知识图谱沉淀、反馈闭环与检索埋点设计》中的规范生成 `skill.feedback.recorded` 事件。
  - 需要在上下文中捕获 `traceId` / `taskId`。
  - 对于给出的评分（非常棒、好、一般、糟糕），转换为 `feedbackKind: 'explicit-rating'` 且按照标准映射为 `rating: 5 | 4 | 3 | 1`。
  - 若用户选择了“忽略”，则不上报显式评分，或记录为 `feedbackKind: 'implicit-skip'`。

### 引入基于脏话正则（Profanity RegExp）的隐式负向反馈提取
- **捕获时机**：在用户于命令行继续输入文字对结果进行追问或评价时，拦截输入流（如在 `REPL` 或 `processUserInput` 处）。
- **机制设计**：使用预设的脏话正则表达式（Profanity Regex）匹配用户的输入。若匹配命中，并且此轮对话上文中刚刚包含由 `SkillTool` 执行完毕的技能记录：
  - 无需用户配合主动打分，系统在后台自动截获并生成一次负反馈埋点。
  - **埋点结构**：触发一次 `skill.feedback.recorded`。
    - 指明 `feedbackSource: 'user'`，`feedbackKind: 'explicit-comment'`（或视图谱需要记为业务层负向动作）。
    - 赋予情绪极性标签 `sentiment: 'negative'`。
    - 将被提取的脏话文本摘要化后（需经过脱敏/哈希避免直接明文上传）附上极低的底层评估权重。

### 修改 `src/screens/REPL.tsx`
- 引入这套全新 Hook 并挂载在 `REPL` 组件的渲染树中。
- 当命中展示条件时，像之前的 `<SkillImprovementSurvey>` 那样，在输入框上方渲染 `<SkillFeedbackSurvey>`。
- 整合脏话正则的检测钩子，在 `onSubmit` 前判断拦截。

## 需要用户确定的事项
> [!IMPORTANT]
> 关于打分的按键映射，您列出的是：
> `1: 非常棒`
> `2: 好`
> `3: 一般`
> `4: 糟糕`
> `5: 忽略`
> 我将完全遵循您的要求，使用按键 **1, 2, 3, 4, 5**。如果确认没问题，请告诉我，我就可以开工了。

## 测试验收计划
1. **显性评分测试**：
   - 在命令行里调用一个已有的 Skill（例如：`/review`）。
   - 等待其正常执行、跑完思考并打印输出结果。
   - 当代理结束一轮执行退回 prompt 时，应当能看到反馈提示：“你觉得本次执行效果怎么样？：1.非常棒 2.好 3.一般 4.糟糕 5.忽略”。
   - 按下数字键 `1`（非常棒），看到 UI 成功消失。
   - 验证触发 `skill.feedback.recorded`（`feedbackKind: 'explicit-rating', rating: 5`）。
2. **隐性脏话检测测试**：
   - 调用 Skill，执行后略过打分不选，立刻强行在输入框输入带有经典脏话词库中词汇的句子（如“写的是什么垃圾”等）。
   - 验证终端底层成功触发了规范的隐式负向 `skill.feedback.recorded` 埋点，且 `sentiment: 'negative'`。
3. **数据一致性验证**：
   - 使用 Debug 排错日志或现有测试脚本，验证两个埋点均包含明确的 `eventId`, `taskId`, `skillName`, `version`, `sourceHash`。
   - 不随意修改该 Skill 源文件 `SKILL.md` 内的任何静态信息。
