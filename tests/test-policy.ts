import { loadIdentityPolicyRules } from './src/utils/permissions/identityPolicyLoader.js';
import { getCwd } from './src/utils/cwd.js';

async function run() {
  const cwd = getCwd();
  console.log("Loading policy...");
  const rules = await loadIdentityPolicyRules(cwd, { departmentId: 101, levelId: 304, roleId: 201 });
  console.log("Loaded rules:", rules.length);
}

run().catch(console.error);
