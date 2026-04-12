import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE } from '../api/client'
import AppIcon from '../components/AppIcon'
import '../styles/LoginPage.css'

interface LoginPageProps {
  onLogin: (accessToken: string, refreshToken: string) => void
}

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (ref.current) observer.unobserve(ref.current)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }
    return () => observer.disconnect()
  }, [])

  const style = delay ? { transitionDelay: `${delay}ms` } : {}

  return (
    <div ref={ref} className={`reveal ${isVisible ? 'visible' : ''} ${className}`} style={style}>
      {children}
    </div>
  )
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('password123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const featureCards = isZh
    ? [
        {
          icon: 'users' as const,
          title: '统一身份目录',
          body: '组织、团队、角色与账号状态集中维护，减少分散配置。',
        },
        {
          icon: 'templates' as const,
          title: '模板化权限',
          body: '把规则、能力和环境变量封装为可复用模板。',
        },
        {
          icon: 'audit' as const,
          title: '全链路审计',
          body: '关键变更自动留痕，回溯操作来源更直接。',
        },
      ]
    : [
        {
          icon: 'users' as const,
          title: 'Unified Identity',
          body: 'Manage org structure, roles, and account state from one control plane.',
        },
        {
          icon: 'templates' as const,
          title: 'Template Engine',
          body: 'Package rules, capabilities, and env overrides into reusable policies.',
        },
        {
          icon: 'audit' as const,
          title: 'Full Audit Trail',
          body: 'Every critical change is tracked for fast operational review.',
        },
      ]

  const benefitChips = isZh
    ? ['极简操作', '解耦沙盒', 'PBAC引擎', '跨项目管控']
    : ['Minimal Ops', 'Decoupled Sandbox', 'PBAC Engine', 'Cross-project Control']

  const intro = isZh
    ? '深入解耦身份体系与动态权限边界，为您组织的复杂授权结构带来超乎想象的配置灵活性与稳定可追溯性。'
    : 'Decoupled identity matrix and dynamic boundaries, bringing unparalleled flexibility and audit stability to your enterprise access governance.'

  const toggleLanguage = () => {
    i18n.changeLanguage(isZh ? 'en' : 'zh')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        throw new Error(t('login.failed'))
      }

      const data = await response.json()
      onLogin(data.accessToken, data.refreshToken)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing-page-root">
      {/* Fixed Ambient Background */}
      <div className="login-ambient-container">
        <div className="login-ambient-glow login-glow-1"></div>
        <div className="login-ambient-glow login-glow-2"></div>
      </div>

      <main className="landing-scroll-layer">
        {/* Fold 1: Hero Login */}
        <section className="landing-hero-fold">
          <div className="login-glass-window">
            <div className="window-titlebar">
              <div className="mac-dots">
                <span className="mac-dot close"></span>
                <span className="mac-dot minimize"></span>
                <span className="mac-dot maximize"></span>
              </div>
              <div className="window-title-text">Authorization Required - TeamCC Access Gate</div>
            </div>

            <div className="login-grid">
              <section className="login-showcase">
                <div className="showcase-content-wrapper">
                  <span className="page-kicker login-kicker">
                    <AppIcon name="shield" size={18} />
                    TeamCC Admin Workspace
                  </span>
                  <h1>{t('app.title')}</h1>
                  <p className="login-showcase-copy">{intro}</p>

                  <div className="login-chip-row">
                    {benefitChips.map((chip) => (
                      <span key={chip} className="floating-chip">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="login-feature-grid">
                  {featureCards.map((feature) => (
                    <article key={feature.title} className="login-feature-card floating-card">
                      <span className="login-feature-icon">
                        <AppIcon name={feature.icon} size={20} />
                      </span>
                      <div className="stack-sm">
                        <strong>{feature.title}</strong>
                        <p>{feature.body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="login-panel">
                <div className="login-panel-inner">
                  <div className="login-panel-header">
                    <div className="stack-sm">
                      <span className="page-kicker login-kicker-glass">
                        <AppIcon name="spark" size={16} />
                        {t('app.subtitle')}
                      </span>
                      <h2>{isZh ? '控制台入口' : 'Secure Sign In'}</h2>
                      <p className="login-panel-copy">
                        {isZh
                          ? '输入您的授权凭证进入安全加密平面。'
                          : 'Use your admin credentials to enter the secure control plane.'}
                      </p>
                    </div>

                    <button onClick={toggleLanguage} className="button button-globe-glass icon-button">
                      <AppIcon name="globe" size={18} />
                    </button>
                  </div>

                  <form className="login-form" onSubmit={handleSubmit}>
                    <div className="field glass-field">
                      <label htmlFor="username">{t('login.username')}</label>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                        autoComplete="username"
                        className="glass-input"
                        placeholder="e.g. admin"
                      />
                    </div>

                    <div className="field glass-field">
                      <label htmlFor="password">{t('login.password')}</label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        autoComplete="current-password"
                        className="glass-input"
                        placeholder="••••••••••••"
                      />
                    </div>

                    {error && <div className="glass-error-banner">{error}</div>}

                    <button type="submit" className="button button-primary floating-submit" disabled={loading}>
                      {loading ? t('login.loggingIn') : t('login.button')}
                      {!loading && <AppIcon name="arrowRight" size={16} />}
                    </button>
                  </form>

                  <div className="login-demo glass-demo">
                    <span className="page-kicker demo-kicker">
                      <AppIcon name="activity" size={16} />
                      Demo Instructions
                    </span>
                    <div className="login-demo-credentials">
                      <div>
                        <span>{t('login.username')}</span>
                        <code>admin</code>
                      </div>
                      <div>
                        <span>{t('login.password')}</span>
                        <code>password123</code>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="scroll-indicator">
            <span>{isZh ? '向下滑动探索平台特性' : 'Scroll down to explore'}</span>
            <div className="scroll-arrow">
              <AppIcon name="arrowDown" size={16} />
            </div>
          </div>
        </section>

        {/* Fold 2: Architecture Pitch */}
        <section className="landing-section architecture-section">
          <Reveal>
            <div className="section-head">
              <span className="page-kicker text-blue">Beyond RBAC</span>
              <h2>{isZh ? '新一代策略调度控制' : 'Next-gen PBAC Orchestration'}</h2>
              <p>
                {isZh
                  ? '抛弃传统的高耦合静态鉴权系统。TeamCC 采用先进的策略级访问控制架构 (PBAC)。无论业务横跨多少团队与项目集，皆可将最底层拦截策略通过纯净数据驱动映射至不同场景下。彻底终结人员调岗所带来的“权限面条代码”。'
                  : 'Break free from static coupled roles. TeamCC integrates a native PBAC engine mapping declarative constraint structures to high-velocity project scopes without manual role rewrites.'}
              </p>
            </div>
          </Reveal>

          <div className="architecture-diag-container">
            <Reveal delay={150}>
              <div className="arch-layer">
                <AppIcon name="users" size={24} />
                <h3>{isZh ? '身份层' : 'Identity Layer'}</h3>
                <p>{isZh ? '纯粹的人力实体边界，负责映射组织架构、部门基准与职级状态。' : 'Pure HR registry mapping departments and states.'}</p>
              </div>
            </Reveal>
            <Reveal delay={300}>
              <div className="arch-connector"></div>
            </Reveal>
            <Reveal delay={450}>
              <div className="arch-layer active">
                <AppIcon name="spark" size={24} />
                <h3>{isZh ? '调度中枢' : 'Dispatch Hub'}</h3>
                <p>{isZh ? '作为连接底层的主路由，负责监听环境变化并派发访问通行证。' : 'Triple-view central console connecting logic.'}</p>
              </div>
            </Reveal>
            <Reveal delay={600}>
              <div className="arch-connector"></div>
            </Reveal>
            <Reveal delay={750}>
              <div className="arch-layer">
                <AppIcon name="templates" size={24} />
                <h3>{isZh ? '知识库' : 'Decoupled Rules'}</h3>
                <p>{isZh ? '将具体的访问授权规则（Grants）与功能开关（Capabilities）严格剥离封装。' : 'Strictly segregated grants and capability flags.'}</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Fold 3: Bento Box Grid */}
        <section className="landing-section bento-section">
          <Reveal>
            <div className="section-head">
              <span className="page-kicker text-teal">Enterprise Features</span>
              <h2>{isZh ? '化繁为简的管理体验' : 'Enterprise grade simplicity'}</h2>
            </div>
          </Reveal>

          <div className="bento-grid">
            <Reveal className="bento-card bento-wide" delay={100}>
              <AppIcon name="dashboard" size={32} />
              <div className="bento-copy">
                <h3>{isZh ? '全天候控制塔观测' : 'Control Tower Coverage'}</h3>
                <p>
                  {isZh
                    ? '首页总览即时呈现出组织权限健康度、离职挂树账户和超权访问流风险。在极简美学中实现最高效的企业安全信息穿透。'
                    : 'The dashboard gives you an instant heatmap of org health, orphaned accounts, and recent boundary escalations.'}
                </p>
              </div>
            </Reveal>
            
            <Reveal className="bento-card bento-tall" delay={200}>
              <div className="bento-split">
                <AppIcon name="shield" size={32} />
                
                {/* Decorative Mini Graphic to fill space */}
                <div className="bento-sandbox-graphic">
                  <div className="sandbox-mock-header">
                    <span className="dot dot-r"></span>
                    <span className="dot dot-y"></span>
                    <span className="dot dot-g"></span>
                  </div>
                  <div className="sandbox-mock-code">
                    <div className="code-line"><span className="code-key">"user"</span>: <span className="code-str">"jane.doe"</span>,</div>
                    <div className="code-line"><span className="code-key">"action"</span>: <span className="code-str">"drop_table"</span>,</div>
                    <div className="code-line"><span className="code-key">"resource"</span>: <span className="code-str">"prod_db"</span></div>
                    <div className="code-result">
                      <span className="code-denied">✖ ERROR: Implicit Deny</span>
                      <span className="code-passed">✔ DEV ENV: Access Granted</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3>{isZh ? '策略沙盒' : 'Sandbox Emulator'}</h3>
                  <p>
                    {isZh
                      ? '自带模拟演算推导。修改策略前无痛预估该鉴权矩阵所辐射波及的一切边界影响范围。'
                      : 'Mock logic and trace access resolutions safely.'}
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal className="bento-card" delay={150}>
              <AppIcon name="audit" size={28} />
              <div className="bento-copy">
                <h3>{isZh ? '100% 日志穿透' : 'Air-tight Logs'}</h3>
                <p>{isZh ? '所有环境与配置变更全量归档。' : 'Every config mutation is tracked.'}</p>
              </div>
            </Reveal>

            <Reveal className="bento-card" delay={250}>
              <AppIcon name="search" size={28} />
              <div className="bento-copy">
                <h3>{isZh ? '逆向权限溯源' : 'Reverse Search'}</h3>
                <p>{isZh ? '快速定位持有某些权限的人员名单。' : 'Swift reverse capacity inspection.'}</p>
              </div>
            </Reveal>
          </div>
        </section>
        
        {/* Footer Base */}
        <footer className="landing-footer">
          <Reveal>
            <AppIcon name="shield" size={20} />
            <p>TeamCC Admin Project © {new Date().getFullYear()}</p>
            <small>{isZh ? '安全、静默、强大的基础设施' : 'Secure, silent, and capable infrastructure'}</small>
          </Reveal>
        </footer>
      </main>
    </div>
  )
}
