/**
 * Standalone smoke test for Identity injection — no bun:bundle dependency.
 *
 * Tests the core logic:
 * 1. Read & parse .claude/identity/active.md frontmatter
 * 2. ID → label mapping
 * 3. Context string generation
 */

import { join } from 'path'
import { readFileSync } from 'fs'

const PROJECT_ROOT = import.meta.dir.replace(/\/scripts$/, '')

// ---- Inline reimplementation of the critical parsing (no bun:bundle) ----

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)---\s*\n?/

function parseFrontmatterSimple(markdown: string): Record<string, unknown> {
  const match = markdown.match(FRONTMATTER_REGEX)
  if (!match || !match[1]) return {}

  const result: Record<string, unknown> = {}
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_-]+):\s+(.+)$/)
    if (kv && kv[1] && kv[2]) {
      const val = kv[2].trim()
      // Try parse as number
      const num = Number(val)
      result[kv[1]] = isNaN(num) ? val : num
    }
  }
  return result
}

// ---- Mapping dictionaries (copied from identity.ts for isolation) ----

const DEPT: Record<number, string> = { 101: 'frontend', 102: 'backend', 103: 'qa', 104: 'sre', 105: 'data', 106: 'mobile', 107: 'product', 108: 'operations', 109: 'hr', 110: 'finance', 111: 'security', 112: 'design' }
const ROLE: Record<number, string> = { 201: 'frontend-developer', 202: 'java-developer', 203: 'test-automation', 204: 'devops-sre' }
const LEVEL: Record<number, string> = { 301: 'p3', 302: 'p4', 303: 'p5', 304: 'p6', 305: 'p7' }
const TEAM: Record<number, string> = { 1011: 'commerce-web', 1012: 'growth-mobile', 1013: 'admin-portal', 1021: 'payment-infra', 1022: 'order-service' }

// ---- Tests ----

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

console.log('=== Identity Injection Smoke Test (standalone) ===\n')

// Test 1: Read and parse active.md
console.log('Test 1: Parse .claude/identity/active.md')
const identityPath = join(PROJECT_ROOT, '.claude', 'identity', 'active.md')
let raw: string
try {
  raw = readFileSync(identityPath, 'utf-8')
} catch (e) {
  console.error(`  ✗ Cannot read ${identityPath}:`, e)
  process.exit(1)
}

const fm = parseFrontmatterSimple(raw)
console.log('  Parsed frontmatter:', JSON.stringify(fm))

assert(fm.user_id === 100234, 'user_id === 100234')
assert(fm.org_id === 10, 'org_id === 10')
assert(fm.department_id === 101, 'department_id === 101')
assert(fm.team_id === 1011, 'team_id === 1011')
assert(fm.role_id === 201, 'role_id === 201')
assert(fm.level_id === 304, 'level_id === 304')
console.log()

// Test 2: ID → label mapping
console.log('Test 2: ID → label mapping')
assert(DEPT[101] === 'frontend', 'department 101 → frontend')
assert(ROLE[201] === 'frontend-developer', 'role 201 → frontend-developer')
assert(LEVEL[304] === 'p6', 'level 304 → p6')
assert(TEAM[1011] === 'commerce-web', 'team 1011 → commerce-web')
assert((DEPT[999] ?? `unknown_dept(999)`) === 'unknown_dept(999)', 'unknown dept fallback')
console.log()

// Test 3: Context string generation
console.log('Test 3: Context string generation')
const dept = DEPT[Number(fm.department_id)] ?? `unknown_dept(${fm.department_id})`
const role = ROLE[Number(fm.role_id)] ?? `unknown_role(${fm.role_id})`
const level = LEVEL[Number(fm.level_id)] ?? `unknown_level(${fm.level_id})`
const team = TEAM[Number(fm.team_id)] ?? `unknown_team(${fm.team_id})`

const contextStr = `Current operator identity: department=${dept}, team=${team}, role=${role}, level=${level} (user_id=${fm.user_id})`
console.log(`  Output: "${contextStr}"`)
assert(contextStr.includes('department=frontend'), 'contains department=frontend')
assert(contextStr.includes('role=frontend-developer'), 'contains role=frontend-developer')
assert(contextStr.includes('level=p6'), 'contains level=p6')
assert(contextStr.includes('team=commerce-web'), 'contains team=commerce-web')
assert(contextStr.includes('user_id=100234'), 'contains user_id=100234')
console.log()

// Test 4: Verify source code changes exist
console.log('Test 4: Verify source code injection points')
const stateTs = readFileSync(join(PROJECT_ROOT, 'src', 'bootstrap', 'state.ts'), 'utf-8')
assert(stateTs.includes('identityProfile'), 'state.ts contains identityProfile field')
assert(stateTs.includes('setIdentityProfile'), 'state.ts contains setIdentityProfile')
assert(stateTs.includes('getIdentityProfile'), 'state.ts contains getIdentityProfile')

const setupTs = readFileSync(join(PROJECT_ROOT, 'src', 'setup.ts'), 'utf-8')
assert(setupTs.includes('loadIdentityProfile'), 'setup.ts contains loadIdentityProfile call')
assert(setupTs.includes('setIdentityProfile'), 'setup.ts contains setIdentityProfile call')

const contextTs = readFileSync(join(PROJECT_ROOT, 'src', 'context.ts'), 'utf-8')
assert(contextTs.includes('getIdentityProfile'), 'context.ts imports getIdentityProfile')
assert(contextTs.includes('identityContext'), 'context.ts contains identityContext')
assert(contextTs.includes('buildIdentityContextString'), 'context.ts calls buildIdentityContextString')

const identityTs = readFileSync(join(PROJECT_ROOT, 'src', 'utils', 'identity.ts'), 'utf-8')
assert(identityTs.includes('IdentityProfile'), 'identity.ts exports IdentityProfile type')
assert(identityTs.includes('DEPARTMENT_MAP'), 'identity.ts contains DEPARTMENT_MAP')
assert(identityTs.includes('loadIdentityProfile'), 'identity.ts exports loadIdentityProfile')
assert(identityTs.includes('buildIdentityContextString'), 'identity.ts exports buildIdentityContextString')
console.log()

// Summary
console.log('=== Results ===')
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
if (failed > 0) {
  process.exit(1)
} else {
  console.log('\n  All tests passed ✓')
}
