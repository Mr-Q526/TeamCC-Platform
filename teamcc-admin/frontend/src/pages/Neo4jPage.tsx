import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  exportSkillWeights,
  getSkillExecutionStats,
  getSkillGraphCapabilities,
  importSkills,
  type ReservedSkillResponse,
  type SkillGraphCapabilitiesResponse,
} from '../api/client'
import AppIcon from '../components/AppIcon'
import '../styles/Neo4jPage.css'

interface Neo4jPageProps {
  accessToken: string
  browserUrl?: string
}

function normalizeBrowserUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (trimmed.endsWith('/browser')) {
    return `${trimmed}/`
  }
  return `${trimmed}/browser/`
}

const DEFAULT_BROWSER_URL = 'http://127.0.0.1:7474/browser/'

export default function Neo4jPage({ accessToken, browserUrl = DEFAULT_BROWSER_URL }: Neo4jPageProps) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const resolvedUrl = useMemo(
    () => normalizeBrowserUrl(browserUrl || DEFAULT_BROWSER_URL),
    [browserUrl],
  )
  const [capabilities, setCapabilities] = useState<SkillGraphCapabilitiesResponse | null>(null)
  const [capabilityError, setCapabilityError] = useState('')
  const [requestState, setRequestState] = useState<'idle' | 'loading'>('idle')
  const [requestMessage, setRequestMessage] = useState('')

  const copy = isZh
    ? {
        introTitle: '图谱浏览器',
        introBody:
          '当前页面不再尝试内嵌 Neo4j Browser，而是引导你直接打开本地 Browser 链接。这样可以避开浏览器的 iframe 安全限制。',
        openTab: '新标签打开',
        openHintTitle: '打开这个链接',
        browserCardBody:
          '点击下方按钮后会在新标签页打开 Neo4j Browser。适合检查 Skill、Version、FeedbackAggregate 以及部门和场景效果边。',
        urlLabel: '浏览器地址',
        userLabel: '默认用户名',
        notesTitle: '使用提示',
        noteOne: '适合快速检查 Demo 图谱里的 Skill、SkillVersion 和 FeedbackAggregate。',
        noteTwo: 'Neo4j Browser 默认拒绝被 iframe 嵌入，所以管理后台只保留跳转入口。',
        noteThree: '当前默认指向本机 7474 端口，可通过 Vite 环境变量覆盖。',
        defaultUser: 'neo4j',
        skillTitle: 'Skill 图谱能力',
        skillBody: '这里先挂出和 skill-graph 服务对接的能力入口，后续由 skill-graph 服务实现真实逻辑。',
        loadCapabilities: '刷新能力状态',
        importLabel: 'Skill 导入',
        exportLabel: '权重导出',
        statsLabel: '执行统计',
        reserved: '预留接口',
        implemented: '已实现',
        notImplemented: '未实现',
        pendingMessage: '等待 skill-graph 服务接入',
      }
    : {
        introTitle: 'Graph Browser',
        introBody:
          'This page no longer tries to embed Neo4j Browser. Instead, it guides you to open the local browser URL directly so iframe policy does not block the experience.',
        openTab: 'Open in new tab',
        openHintTitle: 'Open this link',
        browserCardBody:
          'Use the button below to open Neo4j Browser in a new tab. It is still the best place to inspect Skill, Version, FeedbackAggregate, and effect relationships.',
        urlLabel: 'Browser URL',
        userLabel: 'Default username',
        notesTitle: 'Usage Notes',
        noteOne: 'Useful for checking demo graph data such as Skill, SkillVersion, and FeedbackAggregate nodes.',
        noteTwo: 'Neo4j Browser blocks iframe embedding by default, so admin keeps this as a jump page instead.',
        noteThree: 'The default target is local port 7474 and can be overridden via a Vite env var.',
        defaultUser: 'neo4j',
        skillTitle: 'Skill Graph Capabilities',
        skillBody: 'This page also hosts reserved capability entry points for the future skill-graph service integration.',
        loadCapabilities: 'Refresh capability state',
        importLabel: 'Skill Import',
        exportLabel: 'Weight Export',
        statsLabel: 'Execution Stats',
        reserved: 'Reserved API',
        implemented: 'Implemented',
        notImplemented: 'Not implemented',
        pendingMessage: 'Waiting for skill-graph service integration',
      }

  useEffect(() => {
    let cancelled = false

    const loadCapabilities = async () => {
      try {
        const response = await getSkillGraphCapabilities(accessToken)
        if (!cancelled) {
          setCapabilities(response)
          setCapabilityError('')
        }
      } catch (error) {
        if (!cancelled) {
          setCapabilityError((error as Error).message)
        }
      }
    }

    void loadCapabilities()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  const runReservedAction = async (request: Promise<ReservedSkillResponse>) => {
    setRequestState('loading')
    setRequestMessage('')
    try {
      const response = await request
      setRequestMessage(response.message)
    } catch (error) {
      setRequestMessage((error as Error).message)
    } finally {
      setRequestState('idle')
    }
  }

  const capabilityCards = [
    {
      key: 'import',
      label: copy.importLabel,
      endpoint: capabilities?.capabilities.import.endpoint ?? '/admin/skills/import',
      implemented: capabilities?.capabilities.import.implemented ?? false,
      action: () => runReservedAction(importSkills(accessToken, { dryRun: true })),
    },
    {
      key: 'export',
      label: copy.exportLabel,
      endpoint: capabilities?.capabilities.weightExport.endpoint ?? '/admin/skills/weights/export',
      implemented: capabilities?.capabilities.weightExport.implemented ?? false,
      action: () => runReservedAction(exportSkillWeights(accessToken, { format: 'json', scope: 'global', window: '30d' })),
    },
    {
      key: 'stats',
      label: copy.statsLabel,
      endpoint: capabilities?.capabilities.executionStats.endpoint ?? '/admin/skills/execution-stats',
      implemented: capabilities?.capabilities.executionStats.implemented ?? false,
      action: () => runReservedAction(getSkillExecutionStats(accessToken, { window: '30d', groupBy: 'skill' })),
    },
  ]

  return (
    <div className="page-stack neo4j-page">
      <section className="neo4j-hero">
        <article className="surface neo4j-intro-card">
          <span className="page-kicker">
            <AppIcon name="graph" size={16} />
            Neo4j Browser
          </span>
          <h2>{copy.introTitle}</h2>
          <p>{copy.introBody}</p>
          <div className="neo4j-action-row">
            <a
              className="button button-primary"
              href={resolvedUrl}
              target="_blank"
              rel="noreferrer"
            >
              <AppIcon name="arrowRight" size={16} />
              {copy.openTab}
            </a>
          </div>
        </article>

        <article className="surface neo4j-meta-card">
          <div className="neo4j-meta-grid">
            <div className="neo4j-meta-item">
              <span>{copy.urlLabel}</span>
              <strong>{resolvedUrl}</strong>
            </div>
            <div className="neo4j-meta-item">
              <span>{copy.userLabel}</span>
              <strong>{copy.defaultUser}</strong>
            </div>
          </div>
          <div className="neo4j-note-list">
            <h3>{copy.notesTitle}</h3>
            <p>{copy.noteOne}</p>
            <p>{copy.noteTwo}</p>
            <p>{copy.noteThree}</p>
          </div>
        </article>
      </section>

      <section className="surface neo4j-browser-card">
        <div className="neo4j-browser-head">
          <div>
            <h3>{copy.openHintTitle}</h3>
            <p>{copy.browserCardBody}</p>
          </div>
          <a
            className="button button-secondary"
            href={resolvedUrl}
            target="_blank"
            rel="noreferrer"
          >
            <AppIcon name="arrowRight" size={16} />
            {copy.openTab}
          </a>
        </div>

        <div className="neo4j-link-shell">
          <code className="neo4j-link-code">{resolvedUrl}</code>
        </div>
      </section>

      <section className="surface neo4j-skill-card">
        <div className="neo4j-browser-head">
          <div>
            <h3>{copy.skillTitle}</h3>
            <p>{copy.skillBody}</p>
          </div>
          <button
            className="button button-secondary"
            onClick={() => void getSkillGraphCapabilities(accessToken).then(setCapabilities).catch((error) => setCapabilityError((error as Error).message))}
          >
            <AppIcon name="refresh" size={16} />
            {copy.loadCapabilities}
          </button>
        </div>

        {capabilityError ? <div className="error-banner">{capabilityError}</div> : null}
        {requestMessage ? <div className="neo4j-inline-note">{requestMessage}</div> : null}

        <div className="neo4j-capability-grid">
          {capabilityCards.map((card) => (
            <article key={card.key} className="neo4j-capability-item">
              <div className="stack-sm">
                <strong>{card.label}</strong>
                <span className={`status-pill ${card.implemented ? 'active' : 'missing'}`}>
                  {card.implemented ? copy.implemented : copy.notImplemented}
                </span>
              </div>
              <code>{card.endpoint}</code>
              <p>{copy.pendingMessage}</p>
              <button
                className="button button-secondary button-sm"
                onClick={card.action}
                disabled={requestState === 'loading'}
              >
                <AppIcon name="arrowRight" size={14} />
                {copy.reserved}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
