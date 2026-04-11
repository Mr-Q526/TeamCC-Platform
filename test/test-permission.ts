import { loadIdentityPolicyRules } from './src/utils/permissions/identityPolicyLoader.js';
import { getCwd, getOriginalCwd } from './src/utils/cwd.js';
import { applyPermissionRulesToPermissionContext, getPermissionContext } from './src/utils/permissions/permissions.js';
import { matchingRuleForInput } from './src/utils/permissions/filesystem.js';

async function test() {
  const cwd = '/Users/minruiqing/MyProjects/teamcc-demoproject';
  process.env.PWD = cwd;
  process.chdir(cwd);
  
  const rules = await loadIdentityPolicyRules(cwd, { departmentId: 101, levelId: 3 });
  console.log("Loaded rules:", JSON.stringify(rules, null, 2));

  let context = {
    mode: 'auto' as const,
    alwaysAllowRules: { cliArg: [] },
    alwaysDenyRules: { cliArg: [] },
    alwaysAskRules: {},
    isBypassPermissionsModeAvailable: false,
    additionalWorkingDirectories: []
  };

  context = applyPermissionRulesToPermissionContext(context, rules);
  
  console.log("Context policySettings deny rules:", JSON.stringify(context.alwaysDenyRules?.policySettings, null, 2));

  const result = matchingRuleForInput(
    '/Users/minruiqing/MyProjects/teamcc-demoproject/backend/app/main.py',
    context,
    'edit',
    'deny'
  );
  
  const patternsByRoot = (matchingRuleForInput as any).__TEST_getPatternsByRoot?.(context, 'edit', 'deny');
  console.log("Matching Deny Rule:", JSON.stringify(result, null, 2));

  const ignore = require('ignore');
  const patterns = ['*backend/**'];
  const adjusted = patterns.map(pattern => {
        let adjustedPattern = pattern
        if (adjustedPattern.endsWith('/**')) {
          adjustedPattern = adjustedPattern.slice(0, -3)
        }
        return adjustedPattern
  });
  console.log("Adjusted patterns:", adjusted);
  const ig = ignore().add(adjusted);
  console.log("Ignores?", ig.ignores('backend/app/main.py'));
  const igResult = ig.test('backend/app/main.py');
  
  const map = new Map();
  map.set('*backend/**', 'MOCK_RULE');
  
  let resultRule = null;
  let foundRule = null;
  const pRules = context.alwaysDenyRules?.policySettings || [];
  const editRules = pRules.filter((r: any) => r.ruleValue?.toolName === 'Edit');
  
  for (const rule of editRules) {
    const pattern = rule.ruleValue.ruleContent;
    let adjustedPattern = pattern;
    if (adjustedPattern.endsWith('/**')) {
      adjustedPattern = adjustedPattern.slice(0, -3);
    }
    
    const ig = ignore().add(adjustedPattern);
    const relPath = 'backend/app/main.py';
    const igResult = ig.test(relPath);
    console.log("Simulating matchingRuleForInput loop for", pattern);
    console.log("  adjusted:", adjustedPattern);
    console.log("  igResult:", igResult);
  }
}

test().catch(console.error);
