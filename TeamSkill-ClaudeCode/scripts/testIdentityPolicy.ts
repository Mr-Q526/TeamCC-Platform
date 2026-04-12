/**
 * Smoke test for identity-based permission policy loader.
 *
 * Validates:
 * 1. loadIdentityPolicyRules() loads the correct policy files by dept/level ID
 * 2. Variable interpolation correctly replaces {{BACKEND_DIR}} etc.
 * 3. Rules with no matching policy file are handled gracefully (no crash)
 * 4. Deny rules are correctly classified as source: 'policySettings'
 * 5. Union merge: dept deny + level deny both appear in the output
 * 6. Source code injection point verification
 */

import { join } from 'path'
import { readFileSync } from 'fs'

const PROJECT_ROOT = import.meta.dir.replace(/\/scripts$/, '')
const CWD = PROJECT_ROOT

async function runTests() {
  console.log('=== Identity Policy Loader Smoke Test ===\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${msg}`)
      failed++
    }
  }

  // ----------------------------------------------------------------
  // Test 1: Loads dept + level policies and interpolates variables
  // ----------------------------------------------------------------
  console.log('Test 1: Load dept-101 + level-301 policy with interpolation')
  const { loadIdentityPolicyRules, resetIdentityPolicyCache } = await import(
    '../src/utils/permissions/identityPolicyLoader.js'
  )

  resetIdentityPolicyCache()
  const rules = await loadIdentityPolicyRules(CWD, {
    departmentId: 101,
    levelId: 301,
  })

  console.log(`  Loaded ${rules.length} total rules`)
  assert(rules.length > 0, 'At least one rule loaded')

  const denyRules = rules.filter(r => r.ruleBehavior === 'deny')
  assert(denyRules.length > 0, 'At least one deny rule returned')

  // All rules should be tagged as policySettings
  const allPolicySource = rules.every(r => r.source === 'policySettings')
  assert(allPolicySource, 'All rules have source === policySettings')
  console.log()

  // ----------------------------------------------------------------
  // Test 2: Variable interpolation
  // ----------------------------------------------------------------
  console.log('Test 2: {{BACKEND_DIR}} replaced with project-env value')

  // project-env.json has BACKEND_DIR = "src/services/"
  const backendDenyRules = denyRules.filter(r =>
    r.ruleValue.ruleContent?.includes('src/services/'),
  )
  assert(
    backendDenyRules.length > 0,
    `{{BACKEND_DIR}} expanded to "src/services/" in ${backendDenyRules.length} rule(s)`,
  )

  // No rules should still contain raw {{...}} template syntax
  const unexpandedRules = rules.filter(r =>
    r.ruleValue.ruleContent?.includes('{{'),
  )
  assert(
    unexpandedRules.length === 0,
    'No unexpanded {{VAR}} placeholders remain',
  )
  console.log()

  // ----------------------------------------------------------------
  // Test 3: SSH rules from level-301 are included
  // ----------------------------------------------------------------
  console.log('Test 3: Level-301 SSH deny rules present')
  const sshDenyRule = denyRules.find(
    r => r.ruleValue.ruleContent?.startsWith('ssh '),
  )
  assert(sshDenyRule !== undefined, 'Bash(ssh *) deny rule loaded from level-301')
  assert(
    sshDenyRule?.ruleValue.toolName === 'Bash',
    'SSH rule targets Bash tool',
  )
  console.log()

  // ----------------------------------------------------------------
  // Test 4: Unknown identity (no policy files) → empty array, no crash
  // ----------------------------------------------------------------
  console.log('Test 4: Unknown identity ID returns empty array gracefully')
  resetIdentityPolicyCache()
  const emptyRules = await loadIdentityPolicyRules(CWD, {
    departmentId: 999,
    levelId: 999,
  })
  assert(Array.isArray(emptyRules), 'Returns an array')
  assert(emptyRules.length === 0, 'Returns empty array for unknown identity')
  console.log()

  // ----------------------------------------------------------------
  // Test 5: Source code injection point verified
  // ----------------------------------------------------------------
  console.log('Test 5: Verify source code injection points')
  const policyLoader = readFileSync(
    join(PROJECT_ROOT, 'src', 'utils', 'permissions', 'identityPolicyLoader.ts'),
    'utf-8',
  )
  assert(
    policyLoader.includes('loadIdentityPolicyRules'),
    'identityPolicyLoader.ts exports loadIdentityPolicyRules',
  )
  assert(
    policyLoader.includes('interpolate'),
    'identityPolicyLoader.ts contains interpolate function',
  )
  assert(
    policyLoader.includes('\\{\\{([A-Z0-9_]+)\\}\\}') ||
      policyLoader.includes('replace(/\\{\\{'),
    'identityPolicyLoader.ts implements {{VAR}} template replacement',
  )

  const permSetup = readFileSync(
    join(
      PROJECT_ROOT,
      'src',
      'utils',
      'permissions',
      'permissionSetup.ts',
    ),
    'utf-8',
  )
  assert(
    permSetup.includes('loadIdentityPolicyRules'),
    'permissionSetup.ts calls loadIdentityPolicyRules',
  )
  assert(
    permSetup.includes('getIdentityProfile'),
    'permissionSetup.ts reads identity from STATE',
  )
  assert(
    permSetup.includes('identityPolicyLoader'),
    'permissionSetup.ts imports from identityPolicyLoader',
  )
  console.log()

  // ----------------------------------------------------------------
  // Test 6: Rule content structure
  // ----------------------------------------------------------------
  console.log('Test 6: Rule structure correctness')
  // Reset and reload dept-101 only (for focused check)
  resetIdentityPolicyCache()
  const dept101Rules = await loadIdentityPolicyRules(CWD, {
    departmentId: 101,
    levelId: 999, // no level file → only dept rules
  })
  const readfileDeny = dept101Rules.find(
    r => r.ruleValue.toolName === 'ReadFile' && r.ruleBehavior === 'deny',
  )
  assert(readfileDeny !== undefined, 'ReadFile deny rule parsed from dept-101')
  assert(
    readfileDeny?.ruleValue.ruleContent?.includes('src/services/'),
    'ReadFile deny ruleContent contains expanded BACKEND_DIR',
  )
  console.log()

  // ----------------------------------------------------------------
  // Summary
  // ----------------------------------------------------------------
  console.log('=== Results ===')
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)
  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('\n  All tests passed ✓')
  }
}

runTests().catch(err => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
