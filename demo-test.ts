import { loadIdentityPolicyRules } from './src/utils/permissions/identityPolicyLoader.js';
import { loadIdentityProfile } from './src/utils/identity.js';

const DEMO_PROJECT = '/Users/minruiqing/MyProjects/teamcc-demoproject';

async function runTest() {
  console.log('--- 身份信息解析测试 ---');
  const profile = await loadIdentityProfile(DEMO_PROJECT);
  if (!profile) {
    console.error('Failed to load profile');
    return;
  }
  console.log('Profile loaded:', profile);

  console.log('\n--- 策略变量与权限加载测试 ---');
  const rules = await loadIdentityPolicyRules(DEMO_PROJECT, profile);
  console.log(`Loaded ${rules.length} rules.`);
  
  const denyRules = rules.filter(r => r.ruleBehavior === 'deny');
  console.log('\nDeny Rules:');
  denyRules.forEach(r => console.log(`- ${r.ruleValue.toolName}(${r.ruleValue.ruleContent || '*'})`));

  const frontendRules = denyRules.filter(r => r.ruleValue.ruleContent?.includes('backend/'));
  if (frontendRules.length > 0) {
      console.log('\n[PASS] Variable {{BACKEND_DIR}} successfully fully resolved to "backend/"!');
  } else {
      console.log('\n[FAIL] Variable {{BACKEND_DIR}} not resolved correctly.');
  }
}

runTest().catch(console.error);
