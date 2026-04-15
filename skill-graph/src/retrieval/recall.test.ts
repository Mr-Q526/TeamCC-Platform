import { describe, expect, test } from 'bun:test'
import type { SkillEmbeddingsManifest } from '../embeddings/embeddings.js'
import type { SkillRegistryManifest } from '../registry/registry.js'
import { recallSkills } from './recall.js'

const registryManifest: SkillRegistryManifest = {
  schemaVersion: '2026-04-11',
  generatedAt: '2026-04-12T00:00:00.000Z',
  registryVersion: 'sha256:registry',
  skillCount: 19,
  source: 'skills-flat',
  skills: [
    {
      skillId: 'frontend/website-homepage-design-basic',
      name: 'website-homepage-design-basic',
      displayName: 'Website Homepage Design Basic',
      description: 'Basic homepage design',
      aliases: ['官网首页', '首页', '基础版'],
      version: '0.1.0',
      sourceHash: 'sha256:basic',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['design', 'homepage'],
      targetDir: 'website-homepage-design-basic',
      skillFile: 'website-homepage-design-basic/SKILL.md',
    },
    {
      skillId: 'frontend/website-homepage-design-pro',
      name: 'website-homepage-design-pro',
      displayName: 'Website Homepage Design Pro',
      description: 'Pro homepage design',
      aliases: ['高端官网', '首页设计', '专业版'],
      version: '0.1.0',
      sourceHash: 'sha256:pro',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['design', 'homepage'],
      targetDir: 'website-homepage-design-pro',
      skillFile: 'website-homepage-design-pro/SKILL.md',
    },
    {
      skillId: 'frontend/website-homepage-design',
      name: 'website-homepage-design',
      displayName: 'Website Homepage Design',
      description: 'Generic homepage design',
      aliases: ['官网首页', '首页', 'homepage'],
      version: '0.1.0',
      sourceHash: 'sha256:homepage-generic',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['design', 'homepage'],
      targetDir: 'website-homepage-design',
      skillFile: 'website-homepage-design/SKILL.md',
    },
    {
      skillId: 'frontend/admin-dashboard-design',
      name: 'admin-dashboard-design',
      displayName: 'Admin Dashboard Design',
      description: 'Admin dashboard design',
      aliases: ['管理后台设计'],
      version: '0.1.0',
      sourceHash: 'sha256:admin',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['design', 'admin-console'],
      targetDir: 'admin-dashboard-design',
      skillFile: 'admin-dashboard-design/SKILL.md',
    },
    {
      skillId: 'frontend/marketing-landing-page',
      name: 'marketing-landing-page',
      displayName: 'Marketing Landing Page',
      description: 'Campaign page and lead generation landing page focused on conversion',
      aliases: ['营销落地页', '转化页', '页面', 'landing page', 'marketing'],
      version: '0.1.0',
      sourceHash: 'sha256:marketing',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['design'],
      targetDir: 'marketing-landing-page',
      skillFile: 'marketing-landing-page/SKILL.md',
    },
    {
      skillId: 'frontend/settings-page-pro',
      name: 'settings-page-pro',
      displayName: 'Settings Page Pro',
      description: 'Professional settings and configuration page design',
      aliases: ['设置页面', '设置', '配置页', '专业版', '页面'],
      version: '0.1.0',
      sourceHash: 'sha256:settings-pro',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['design'],
      targetDir: 'settings-page-pro',
      skillFile: 'settings-page-pro/SKILL.md',
    },
    {
      skillId: 'frontend/search-results-page-basic',
      name: 'search-results-page-basic',
      displayName: 'Search Results Page Basic',
      description: 'Search results page with filters and result scanning',
      aliases: ['搜索结果', '搜索结果页面', '基础版', '页面'],
      version: '0.1.0',
      sourceHash: 'sha256:search-basic',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['design'],
      targetDir: 'search-results-page-basic',
      skillFile: 'search-results-page-basic/SKILL.md',
    },
    {
      skillId: 'frontend/responsive-navigation-basic',
      name: 'responsive-navigation-basic',
      displayName: 'Responsive Navigation Basic',
      description: 'Responsive navbar and navigation design',
      aliases: ['响应式导航', '导航栏', '导航', '基础版'],
      version: '0.1.0',
      sourceHash: 'sha256:nav-basic',
      domain: 'frontend',
      departmentTags: ['frontend-platform'],
      sceneTags: ['design'],
      targetDir: 'responsive-navigation-basic',
      skillFile: 'responsive-navigation-basic/SKILL.md',
    },
    {
      skillId: 'security/security-threat-model',
      name: 'security-threat-model',
      displayName: 'Security Threat Model',
      description: 'Threat modeling for attack surface and abuse paths',
      aliases: ['安全', '安全审计', '威胁建模', 'threat model'],
      version: '0.1.0',
      sourceHash: 'sha256:threat',
      domain: 'security',
      departmentTags: ['security-platform'],
      sceneTags: ['security-audit'],
      targetDir: 'security-threat-model',
      skillFile: 'security-threat-model/SKILL.md',
    },
    {
      skillId: 'security/rate-limiting-abuse-protection',
      name: 'rate-limiting-abuse-protection',
      displayName: 'Rate Limiting Abuse Protection',
      description: 'Rate limiting and abuse prevention for APIs',
      aliases: ['限流', '速率限制', '防滥用', 'rate limiting', '安全'],
      version: '0.1.0',
      sourceHash: 'sha256:rate',
      domain: 'security',
      departmentTags: ['security-platform'],
      sceneTags: ['security-audit'],
      targetDir: 'rate-limiting-abuse-protection',
      skillFile: 'rate-limiting-abuse-protection/SKILL.md',
    },
    {
      skillId: 'security/security-ownership-map',
      name: 'security-ownership-map',
      displayName: 'Security Ownership Map',
      description: 'Security ownership and bus factor analysis',
      aliases: ['安全所有权', '负责人', '文件归属', 'ownership'],
      version: '0.1.0',
      sourceHash: 'sha256:ownership',
      domain: 'security',
      departmentTags: ['security-platform'],
      sceneTags: ['security-audit'],
      targetDir: 'security-ownership-map',
      skillFile: 'security-ownership-map/SKILL.md',
    },
    {
      skillId: 'infra/vercel-deploy',
      name: 'vercel-deploy',
      displayName: 'Vercel Deploy',
      description: 'Deploy applications to Vercel',
      aliases: ['部署', '发布', '上线', 'vercel', 'deploy'],
      version: '0.1.0',
      sourceHash: 'sha256:vercel',
      domain: 'infra',
      departmentTags: ['infra-platform'],
      sceneTags: ['deploy', 'release'],
      targetDir: 'vercel-deploy',
      skillFile: 'vercel-deploy/SKILL.md',
    },
    {
      skillId: 'general/wechat-toolkit',
      name: 'wechat-toolkit',
      displayName: 'WeChat Toolkit',
      description: '微信公众号文章搜索下载改写发布',
      aliases: ['微信公众号', '公众号', '微信', '改写', '发布'],
      version: '0.1.0',
      sourceHash: 'sha256:wechat',
      domain: 'general',
      departmentTags: ['growth'],
      sceneTags: ['content-generation', 'release'],
      targetDir: 'wechat-toolkit',
      skillFile: 'wechat-toolkit/SKILL.md',
    },
    {
      skillId: 'design/ppt-maker',
      name: 'ppt-maker',
      displayName: 'PPT Maker',
      description:
        'Generate business presentation decks from materials, with outline, page layout and editable deck workflow',
      aliases: ['业务汇报', '汇报 deck', '逐页布局', 'presentation narrative'],
      version: '0.1.0',
      sourceHash: 'sha256:ppt-maker',
      domain: 'design',
      departmentTags: ['growth'],
      sceneTags: ['content-generation', 'design'],
      targetDir: 'ppt-maker',
      skillFile: 'ppt-maker/SKILL.md',
    },
    {
      skillId: 'design/ppt-course-presentation',
      name: 'ppt-course-presentation',
      displayName: 'PPT Course Presentation',
      description:
        'Create classroom course presentations for lesson demos, reading reports and case study sharing',
      aliases: ['课堂汇报', '课程展示', '读书报告', '案例分析'],
      version: '0.1.0',
      sourceHash: 'sha256:ppt-course',
      domain: 'design',
      departmentTags: ['growth'],
      sceneTags: ['content-generation', 'design'],
      targetDir: 'ppt-course-presentation',
      skillFile: 'ppt-course-presentation/SKILL.md',
    },
    {
      skillId: 'ai/humanizer-zh-basic',
      name: 'humanizer-zh-basic',
      displayName: 'Humanizer Zh Basic',
      description: 'Basic Chinese humanizer',
      aliases: ['自然中文', '润色', '基础版'],
      version: '0.1.0',
      sourceHash: 'sha256:human-basic',
      domain: 'ai',
      departmentTags: ['ai-platform'],
      sceneTags: ['content-generation', 'writing'],
      targetDir: 'humanizer-zh-basic',
      skillFile: 'humanizer-zh-basic/SKILL.md',
    },
    {
      skillId: 'ai/humanizer-zh-pro',
      name: 'humanizer-zh-pro',
      displayName: 'Humanizer Zh Pro',
      description: 'Professional Chinese humanizer',
      aliases: ['去 AI 味', '更像人写的', '自然表达', '专业版'],
      version: '0.1.0',
      sourceHash: 'sha256:human-pro',
      domain: 'ai',
      departmentTags: ['ai-platform'],
      sceneTags: ['content-generation', 'writing'],
      targetDir: 'humanizer-zh-pro',
      skillFile: 'humanizer-zh-pro/SKILL.md',
    },
    {
      skillId: 'general/development-plan-doc-basic',
      name: 'development-plan-doc-basic',
      displayName: 'Development Plan Document Basic',
      description: 'Simple development plan document',
      aliases: ['开发计划文档', '简单计划', '基础版', '文档'],
      version: '0.1.0',
      sourceHash: 'sha256:plan-basic',
      domain: 'general',
      departmentTags: ['frontend-platform'],
      sceneTags: ['planning'],
      targetDir: 'development-plan-doc-basic',
      skillFile: 'development-plan-doc-basic/SKILL.md',
    },
    {
      skillId: 'general/development-plan-doc-pro',
      name: 'development-plan-doc-pro',
      displayName: 'Development Plan Document Pro',
      description: 'Detailed professional implementation plan document',
      aliases: ['开发计划文档', '详细开发计划', '专业版', '文档'],
      version: '0.1.0',
      sourceHash: 'sha256:plan-pro',
      domain: 'general',
      departmentTags: ['frontend-platform'],
      sceneTags: ['planning'],
      targetDir: 'development-plan-doc-pro',
      skillFile: 'development-plan-doc-pro/SKILL.md',
    },
  ],
}

const embeddingsManifest: SkillEmbeddingsManifest = {
  schemaVersion: '2026-04-12',
  generatedAt: '2026-04-12T12:00:00.000Z',
  registryVersion: 'sha256:registry',
  embeddingProvider: 'volcengine',
  embeddingModel: 'demo',
  embeddingDim: 2,
  embeddingEndpoint: 'https://example.test/embeddings',
  itemCount: 3,
  items: [
    {
      embeddingId: 'emb-basic',
      skillId: 'frontend/website-homepage-design-basic',
      version: '0.1.0',
      sourceHash: 'sha256:basic',
      objectType: 'skill-summary',
      textHash: 'basic',
      embeddingProvider: 'volcengine',
      embeddingModel: 'demo',
      embeddingDim: 2,
      vector: [0.9, 0.1],
    },
    {
      embeddingId: 'emb-pro',
      skillId: 'frontend/website-homepage-design-pro',
      version: '0.1.0',
      sourceHash: 'sha256:pro',
      objectType: 'skill-summary',
      textHash: 'pro',
      embeddingProvider: 'volcengine',
      embeddingModel: 'demo',
      embeddingDim: 2,
      vector: [1, 0],
    },
    {
      embeddingId: 'emb-admin',
      skillId: 'frontend/admin-dashboard-design',
      version: '0.1.0',
      sourceHash: 'sha256:admin',
      objectType: 'skill-summary',
      textHash: 'admin',
      embeddingProvider: 'volcengine',
      embeddingModel: 'demo',
      embeddingDim: 2,
      vector: [0, 1],
    },
  ],
}

describe('recall skills', () => {
  test('prefers lexical homepage matches with frontend hints', async () => {
    const result = await recallSkills(
      {
        queryText: '做一个官网首页设计',
        queryContext: 'marketing landing hero',
        cwd: '/tmp/demo',
        department: 'dept:frontend-platform',
        limit: 5,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
      },
    )

    expect(result.candidates.length).toBeGreaterThanOrEqual(2)
    expect(
      result.candidates.some(
        candidate =>
          candidate.skillId === 'frontend/website-homepage-design-basic',
      ),
    ).toBe(true)
    expect(
      result.candidates.some(candidate =>
        candidate.skillId.startsWith('frontend/website-homepage-design'),
      ),
    ).toBe(true)
    expect(result.vectorAvailable).toBe(false)
  })

  test('prefers homepage pro over neutral homepage skill for advanced brand-homepage intent', async () => {
    const result = await recallSkills(
      {
        queryText: '品牌官网首页 homepage 前端设计，要求高级感和完整转化结构',
        queryContext: '品牌官网 首屏 hero CTA 高级感 完整转化结构',
        cwd: '/tmp/demo',
        department: 'dept:frontend-platform',
        domainHints: ['frontend'],
        sceneHints: ['scene:homepage', 'scene:design'],
        limit: 5,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
      },
    )

    expect(result.candidates[0]?.skillId).toBe(
      'frontend/website-homepage-design-pro',
    )
    expect(
      result.candidates.find(
        candidate => candidate.skillId === 'frontend/website-homepage-design',
      )?.recallScoreBreakdown.genericPenalty,
    ).toBeLessThan(0)
  })

  test('treats strategic homepage adjacency as pro intent and suppresses neutral homepage hijack', async () => {
    const result = await recallSkills(
      {
        queryText:
          '要把品牌站首屏、价值主张和 CTA 路径重新梳理，做成更像成熟大厂官网的首页体验，不是只拼几个营销模块。',
        queryContext:
          '品牌站 首屏 价值主张 CTA 路径 官网首页 hero narrative proof sequencing',
        cwd: '/tmp/demo',
        department: 'dept:frontend-platform',
        domainHints: ['frontend'],
        sceneHints: ['scene:homepage', 'scene:design'],
        limit: 5,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
      },
    )

    expect(result.candidates[0]?.skillId).toBe(
      'frontend/website-homepage-design-pro',
    )
    expect(result.candidates[0]?.queryIntentKeys).toContain(
      'homepage:strategic',
    )
    expect(result.candidates[0]?.matchedIntentKeys).toContain(
      'homepage:strategic',
    )
    expect(
      result.candidates.find(
        candidate => candidate.skillId === 'frontend/website-homepage-design',
      )?.recallScoreBreakdown.genericPenalty,
    ).toBeLessThanOrEqual(-72)
    expect(
      result.candidates.find(
        candidate => candidate.skillId === 'frontend/marketing-landing-page',
      )?.recallScoreBreakdown.genericPenalty,
    ).toBeLessThanOrEqual(-120)
  })

  test('uses vector recall when query embedding is available', async () => {
    const result = await recallSkills(
      {
        queryText: '专业版高端官网',
        cwd: '/tmp/demo',
        department: 'dept:frontend-platform',
        limit: 3,
      },
      {
        registryManifest,
        embeddingsManifest,
        queryEmbedding: { vector: [1, 0] },
      },
    )

    expect(result.vectorAvailable).toBe(true)
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(
      result.candidates.some(
        candidate =>
          candidate.skillId === 'frontend/website-homepage-design-pro' &&
          candidate.retrievalSource === 'local_hybrid',
      ),
    ).toBe(true)
  })

  test('uses frontend page-type discriminators instead of generic landing pages', async () => {
    const result = await recallSkills(
      {
        queryText: '帮忙设计一个专业的设置页面，要考虑分组、默认值和安全更改',
        queryContext: '前端 设置页面 设计 专业 landing page UX conversion',
        cwd: '/tmp/demo',
        department: 'dept:frontend-platform',
        domainHints: ['frontend'],
        sceneHints: ['scene:design'],
        limit: 5,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
      },
    )

    expect(result.candidates[0]?.skillId).toBe('frontend/settings-page-pro')
    expect(
      result.candidates.find(
        candidate => candidate.skillId === 'frontend/settings-page-pro',
      )?.recallScoreBreakdown.discriminator,
    ).toBeGreaterThan(0)
    const landingRank = result.candidates.findIndex(
      candidate => candidate.skillId === 'frontend/marketing-landing-page',
    )
    const landingCandidate =
      landingRank >= 0 ? result.candidates[landingRank] : null
    expect(landingRank === -1 ? 999 : landingRank + 1).toBeGreaterThan(1)
    if (landingCandidate) {
      expect(landingCandidate.recallScoreBreakdown.genericPenalty).toBeLessThan(0)
    }
  })

  test('routes security subtypes away from generic threat model', async () => {
    const result = await recallSkills(
      {
        queryText: '我要设计一个防止滥用和限制访问频率的安全机制',
        cwd: '/tmp/demo',
        department: 'dept:security-platform',
        domainHints: ['security'],
        sceneHints: ['scene:security-audit'],
        limit: 5,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
      },
    )

    expect(result.candidates[0]?.skillId).toBe(
      'security/rate-limiting-abuse-protection',
    )
    expect(result.candidates[0]?.skillId).not.toBe(
      'security/security-threat-model',
    )
  })

  test('keeps content publishing intent away from deployment skill', async () => {
    const result = await recallSkills(
      {
        queryText: '帮我搜索微信公众号文章，下载下来，用 AI 改写，最后发布到公众号上',
        cwd: '/tmp/demo',
        limit: 5,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
      },
    )

    expect(result.candidates[0]?.skillId).toBe('general/wechat-toolkit')
    expect(result.candidates.map(candidate => candidate.skillId)).not.toContain(
      'infra/vercel-deploy',
    )
  })

  test('applies basic and pro preference to paired skills', async () => {
    const result = await recallSkills(
      {
        queryText: '我需要一个简单的开发计划文档，包含主要步骤和验证说明',
        cwd: '/tmp/demo',
        department: 'dept:frontend-platform',
        limit: 5,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
      },
    )

    expect(result.candidates[0]?.skillId).toBe(
      'general/development-plan-doc-basic',
    )
    expect(
      result.candidates.find(
        candidate => candidate.skillId === 'general/development-plan-doc-basic',
      )?.recallScoreBreakdown.intent,
    ).toBeGreaterThan(0)
  })

  test('recognizes humanizer intent as a discriminator', async () => {
    const result = await recallSkills(
      {
        queryText: '把中文 AI 文案改得更像人写的，去掉 AI 味但保持自然表达',
        cwd: '/tmp/demo',
        department: 'dept:ai-platform',
        sceneHints: ['scene:writing'],
        limit: 5,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
      },
    )

    expect(result.candidates[0]?.skillId).toBe('ai/humanizer-zh-pro')
    expect(result.candidates[0]?.matchedDiscriminatorKeys).toContain(
      'general-task:humanizer',
    )
  })

  test('recognizes development plan intent as a discriminator', async () => {
    const result = await recallSkills(
      {
        queryText: '帮我整理一份开发计划文档，写清里程碑、风险和验收标准',
        cwd: '/tmp/demo',
        department: 'dept:frontend-platform',
        sceneHints: ['scene:planning'],
        limit: 5,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
      },
    )

    expect(
      result.candidates
        .slice(0, 2)
        .map(candidate => candidate.skillId),
    ).toContain('general/development-plan-doc-pro')
    expect(
      result.candidates.find(
        candidate => candidate.skillId === 'general/development-plan-doc-pro',
      )?.matchedDiscriminatorKeys,
    ).toContain('general-task:development-plan')
  })

  test('routes business presentation intent to ppt-maker instead of classroom presentation', async () => {
    const result = await recallSkills(
      {
        queryText:
          '根据这份运营复盘材料生成完整 PPT，要有清晰故事线、页级布局和适合汇报的视觉表达',
        cwd: '/tmp/demo',
        department: 'dept:growth',
        sceneHints: ['scene:content-generation'],
        limit: 5,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
      },
    )

    expect(result.candidates[0]?.skillId).toBe('design/ppt-maker')
    expect(result.candidates[0]?.matchedDiscriminatorKeys).toContain(
      'general-task:business-presentation',
    )
    expect(result.candidates[0]?.skillId).not.toBe(
      'design/ppt-course-presentation',
    )
  })

  test('keeps classroom presentation intent on ppt-course-presentation', async () => {
    const result = await recallSkills(
      {
        queryText:
          '帮我做一份课堂汇报 PPT，要适合课程展示、读书报告和老师同学讨论',
        cwd: '/tmp/demo',
        department: 'dept:growth',
        sceneHints: ['scene:content-generation'],
        limit: 5,
      },
      {
        registryManifest,
        embeddingsManifest: null,
        queryEmbedding: null,
      },
    )

    expect(result.candidates[0]?.skillId).toBe('design/ppt-course-presentation')
    expect(result.candidates[0]?.matchedDiscriminatorKeys).toContain(
      'general-task:course-presentation',
    )
  })
})
