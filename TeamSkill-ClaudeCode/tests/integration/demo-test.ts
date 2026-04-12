/**
 * ----------------------------------------------------------------------------
 * 集成测试方案：基于身份体系的局部环境沙箱拦截鉴权测试
 * ----------------------------------------------------------------------------
 * 此脚本旨在验证本系统中【动态权限引擎】的闭环正确性。
 *
 * 测试目标：
 * 1. 验证 identity.ts 能否正确地从目标项目 (teamcc-demoproject/.claude/identity/active.md) 中
 *    提取结构化的身份原数据，并将其正确对应到部门 (departmentId) 和职级 (levelId) 映射。
 * 2. 验证 identityPolicyLoader.ts 能根据拉取到的身份属性，动态寻址读取 .claude/policies 下的
 *    部门策略（department-xxx.json) 与 职级策略（level-xxx.json）。
 * 3. 验证 project-env.json 的宏变量是否在权限挂载前被成功插值展开（如: 将 {{BACKEND_DIR}}
 *    解析展开拼接到限制性表达式中 `Bash(cd *backend/*)` ）。
 * 4. 验证系统能将涉及危险操作的各种命令统一归集至 Deny List 供后续 `checkCommand` 执行核对。
 *
 * 预期输出：
 *  - Profile loaded: 输出包含 101/301 职级的用户对象
 *  - 所有的限制性变量都被成功字符串展开
 *  - Deny Rules 中必须包含多项由 Backend 与 SSH 管控导致的锁定项，这表明即使
 *    最终在沙箱层面工具（Bash/Edit/ReadFile）处于开启状态，也将被这些约束硬性收网。
 */

import { loadIdentityPolicyRules } from '../../src/utils/permissions/identityPolicyLoader.js';
import { loadIdentityProfile } from '../../src/utils/identity.js';

// 指向我们的隔离实验沙箱目录
const DEMO_PROJECT = '/Users/minruiqing/MyProjects/teamcc-demoproject';

async function runTest() {
  console.log('=== [步骤1] 身份信息与元数据引擎装载验证 ===');
  // 通过配置目标目录取得活跃 Identity 对象（相当于启动时的自动环境装柜）
  const profile = await loadIdentityProfile(DEMO_PROJECT);
  if (!profile) {
    console.error('⨯ [FAIL] 未能读取有效的身份配置，或者缺失必须校验的字段。');
    return;
  }
  console.log('✓ Profile 对象捕获成功:', profile);

  console.log('\\n=== [步骤2] 本地策略变量解析与交集规则构建 ===');
  // 结合取回的 profile 读取并拼接各种约束组合
  const rules = await loadIdentityPolicyRules(DEMO_PROJECT, profile);
  console.log(`✓ 策略编译器已命中装载： ${rules.length} 条组合规则。`);
  
  // 引擎采用“宁可少权不越权”与 Deny一票否决 优先机制，聚焦全部 deny 拦截行为
  const denyRules = rules.filter(r => r.ruleBehavior === 'deny');
  console.log('\\n=== 权限拦截网格 (Deny List) ===');
  denyRules.forEach(r => console.log(`🔒 防御触发项： ${r.ruleValue.toolName}(${r.ruleValue.ruleContent || '*'})`));

  // 变量插值模块的执行断言
  console.log('\\n=== [步骤3] 环境变量宏插值探针分析 ===');
  const frontendRules = denyRules.filter(r => r.ruleValue.ruleContent?.includes('backend/'));
  
  // 如果包含 'backend/' 的规则产生，这说明系统成功读取目标项目 teamcc-demoproject 里的 project-env 映射并取代了未知的 {{BACKEND_DIR}}。
  if (frontendRules.length > 0) {
      console.log('✓ [PASS] Variable 宏插值机制运行正常，{{BACKEND_DIR}} 成功转化为项目特有物理路径 "backend/"!');
  } else {
      console.error('⨯ [FAIL] Variable 插值失效或未编译通过，可能导致物理目录越权。');
  }
  
  console.log('\\n=== 第一阶段集成系统集成自检：完毕 ===');
}

runTest().catch(console.error);
