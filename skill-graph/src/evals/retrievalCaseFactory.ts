import type { SkillRegistryEntry } from '../registry/registry.js'

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function prettyDomain(domain: string): string {
  switch (domain) {
    case 'frontend':
      return '前端'
    case 'backend':
      return '后端'
    case 'infra':
      return '基础设施'
    case 'security':
      return '安全'
    case 'review':
      return '审查'
    case 'tools':
      return '工具'
    case 'ai':
      return 'AI'
    case 'design':
      return '设计'
    case 'general':
    default:
      return '通用'
  }
}

export function departmentForDomain(domain: string): string | null {
  switch (domain) {
    case 'frontend':
      return 'dept:frontend-platform'
    case 'backend':
      return 'dept:backend-platform'
    case 'infra':
      return 'dept:infra-platform'
    case 'security':
      return 'dept:security-platform'
    case 'review':
      return 'dept:frontend-platform'
    case 'tools':
      return 'dept:frontend-platform'
    case 'ai':
      return 'dept:ai-platform'
    case 'design':
      return 'dept:ai-platform'
    case 'general':
    default:
      return null
  }
}

export function sceneHintsForSkill(skill: SkillRegistryEntry): string[] {
  return skill.sceneTags.map(scene => `scene:${scene}`)
}

export function domainAcceptables(
  skill: SkillRegistryEntry,
  registryById: Map<string, SkillRegistryEntry>,
): string[] {
  const base = skill.skillId.split('/')[1] ?? skill.skillId
  const possible: string[] = []
  const add = (skillId: string | null | undefined) => {
    if (!skillId || skillId === skill.skillId || !registryById.has(skillId)) {
      return
    }
    if (!possible.includes(skillId)) {
      possible.push(skillId)
    }
  }

  const pair = base.endsWith('-basic')
    ? `${skill.domain}/${base.replace(/-basic$/, '-pro')}`
    : base.endsWith('-pro')
      ? `${skill.domain}/${base.replace(/-pro$/, '-basic')}`
      : null
  add(pair)

  const byKeyword = (keyword: string, candidates: string[]) => {
    if (base.includes(keyword) || skill.displayName.toLowerCase().includes(keyword)) {
      for (const candidate of candidates) {
        add(candidate)
      }
    }
  }

  switch (skill.domain) {
    case 'frontend':
      byKeyword('homepage', [
        'frontend/marketing-landing-page',
        'frontend/about-company-page-basic',
      ])
      byKeyword('dashboard', [
        'frontend/admin-dashboard-design',
        'frontend/analytics-dashboard-design',
      ])
      byKeyword('design-system', [
        'frontend/design-system-builder-pro',
        'frontend/component-library-pro',
      ])
      byKeyword('component-library', [
        'frontend/design-system-builder-basic',
        'frontend/design-system-builder-pro',
      ])
      byKeyword('docs', ['frontend/docs-site-basic', 'frontend/docs-site-pro'])
      byKeyword('portal', ['frontend/developer-portal-basic', 'frontend/developer-portal-pro'])
      byKeyword('pricing', ['frontend/pricing-page-basic', 'frontend/pricing-page-pro'])
      byKeyword('login', ['frontend/auth-login-page-basic', 'frontend/auth-login-page-pro'])
      byKeyword('search', ['frontend/search-results-page-basic', 'frontend/search-results-page-pro'])
      byKeyword('form', ['frontend/form-builder-basic', 'frontend/form-builder-pro'])
      byKeyword('data-table', ['frontend/data-table-basic', 'frontend/data-table-pro'])
      byKeyword('notification', [
        'frontend/notification-center-basic',
        'frontend/notification-center-pro',
      ])
      byKeyword('settings', ['frontend/settings-page-basic', 'frontend/settings-page-pro'])
      byKeyword('profile', [
        'frontend/profile-account-page-basic',
        'frontend/profile-account-page-pro',
      ])
      byKeyword('onboarding', ['frontend/onboarding-flow-basic', 'frontend/onboarding-flow-pro'])
      byKeyword('checkout', ['frontend/checkout-flow-basic', 'frontend/checkout-flow-pro'])
      byKeyword('careers', ['frontend/careers-page-basic', 'frontend/careers-page-pro'])
      byKeyword('contact-sales', [
        'frontend/contact-sales-page-basic',
        'frontend/contact-sales-page-pro',
      ])
      byKeyword('about-company', [
        'frontend/about-company-page-basic',
        'frontend/about-company-page-pro',
      ])
      byKeyword('saas', ['frontend/saas-workspace-design'])
      byKeyword('security', [
        'frontend/enterprise-security-page-basic',
        'frontend/enterprise-security-page-pro',
      ])
      byKeyword('healthcare', [
        'frontend/healthcare-portal-basic',
        'frontend/healthcare-portal-pro',
      ])
      byKeyword('fintech', [
        'frontend/fintech-dashboard-basic',
        'frontend/fintech-dashboard-pro',
      ])
      byKeyword('ai-chat', ['frontend/ai-chat-interface-basic', 'frontend/ai-chat-interface-pro'])
      byKeyword('responsive-navigation', [
        'frontend/responsive-navigation-basic',
        'frontend/responsive-navigation-pro',
      ])
      byKeyword('education', [
        'frontend/education-course-page-basic',
        'frontend/education-course-page-pro',
      ])
      byKeyword('ecommerce', ['frontend/ecommerce-storefront-design'])
      if (possible.length === 0) {
        add('frontend/website-homepage-design')
        add('frontend/admin-dashboard-design')
      }
      break
    case 'backend':
      byKeyword('api', ['backend/rest-api-implementation', 'backend/backend-api-architecture'])
      byKeyword('graphql', ['backend/graphql-api-implementation'])
      byKeyword('auth', ['backend/auth-authorization-backend'])
      byKeyword('cache', ['backend/cache-strategy-backend'])
      byKeyword('migration', ['backend/data-migration-backfill'])
      byKeyword('database', ['backend/database-schema-design'])
      byKeyword('schema', ['backend/database-schema-design'])
      byKeyword('performance', ['backend/backend-performance-profiling'])
      byKeyword('job', ['backend/background-jobs-queues'])
      byKeyword('queue', ['backend/background-jobs-queues'])
      byKeyword('test', ['backend/api-integration-testing'])
      if (possible.length === 0) {
        add('backend/backend-api-architecture')
        add('backend/rest-api-implementation')
      }
      break
    case 'infra':
      byKeyword('vercel', ['infra/vercel-deploy'])
      byKeyword('deploy', ['infra/vercel-deploy'])
      byKeyword('observability', ['infra/observability-backend'])
      byKeyword('load', ['infra/load-testing'])
      byKeyword('stress', ['infra/stress-testing'])
      byKeyword('ci', ['infra/ci-quality-gates'])
      if (possible.length === 0) {
        add('infra/observability-backend')
        add('infra/vercel-deploy')
      }
      break
    case 'security':
      byKeyword('threat', ['security/security-threat-model'])
      byKeyword('vulnerability', ['security/security-vulnerability-check'])
      byKeyword('audit', ['security/security-vulnerability-check'])
      byKeyword('dependency', ['security/dependency-supply-chain-audit'])
      byKeyword('supply', ['security/dependency-supply-chain-audit'])
      byKeyword('rate', ['security/rate-limiting-abuse-protection'])
      byKeyword('ownership', ['security/security-ownership-map'])
      if (possible.length === 0) {
        add('security/security-best-practices')
        add('security/security-threat-model')
      }
      break
    case 'review':
      byKeyword('risk', ['review/code-review-risk-based'])
      byKeyword('test', ['review/unit-test-strategy'])
      if (possible.length === 0) {
        add('review/code-review-general')
        add('review/code-review-risk-based')
      }
      break
    case 'tools':
      byKeyword('playwright', ['tools/playwright', 'tools/playwright-interactive'])
      byKeyword('screenshot', ['tools/screenshot'])
      byKeyword('spreadsheet', ['tools/spreadsheet'])
      byKeyword('doc', ['tools/doc'])
      byKeyword('pdf', ['tools/pdf'])
      byKeyword('linear', ['tools/linear'])
      if (possible.length === 0) {
        add('tools/playwright')
        add('tools/screenshot')
      }
      break
    case 'ai':
      byKeyword('humanizer', ['ai/humanizer-zh-basic', 'ai/humanizer-zh-pro'])
      byKeyword('transcribe', ['ai/transcribe'])
      if (possible.length === 0) {
        add('ai/humanizer-zh-pro')
        add('ai/transcribe')
      }
      break
    case 'design':
      byKeyword('ppt', ['design/ppt-maker', 'design/ppt-course-presentation'])
      byKeyword('motion', ['design/motion-video-maker'])
      byKeyword('jimeng', ['design/jimeng'])
      if (possible.length === 0) {
        add('design/ppt-maker')
        add('design/motion-video-maker')
      }
      break
    case 'general':
    default:
      byKeyword('bug', ['general/bug-fix-debugging'])
      byKeyword('development-plan', [
        'general/development-plan-doc-basic',
        'general/development-plan-doc-pro',
      ])
      byKeyword('wechat', ['general/wechat-toolkit'])
      byKeyword('xiaohongshu', ['general/xiaohongshu-ops'])
      if (possible.length === 0) {
        add('general/bug-fix-debugging')
        add('general/development-plan-doc-pro')
      }
      break
  }

  return possible.slice(0, 2)
}

export function domainForbidden(domain: string): string[] {
  switch (domain) {
    case 'frontend':
      return ['tools/spreadsheet', 'security/security-threat-model']
    case 'backend':
      return ['frontend/website-homepage-design-pro', 'tools/playwright']
    case 'infra':
      return ['frontend/component-library-basic', 'backend/rest-api-implementation']
    case 'security':
      return ['frontend/marketing-landing-page', 'backend/backend-api-architecture']
    case 'review':
      return ['frontend/website-homepage-design', 'backend/rest-api-implementation']
    case 'tools':
      return ['backend/rest-api-implementation', 'frontend/website-homepage-design-pro']
    case 'ai':
      return ['tools/playwright', 'frontend/admin-dashboard-design']
    case 'design':
      return ['backend/database-schema-design', 'frontend/website-homepage-design']
    case 'general':
    default:
      return ['security/security-threat-model', 'frontend/admin-dashboard-design']
  }
}
