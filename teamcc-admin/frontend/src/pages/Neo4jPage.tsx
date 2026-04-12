import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import AppIcon from '../components/AppIcon'
import '../styles/Neo4jPage.css'

interface Neo4jPageProps {
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

export default function Neo4jPage({ browserUrl = DEFAULT_BROWSER_URL }: Neo4jPageProps) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const resolvedUrl = useMemo(
    () => normalizeBrowserUrl(browserUrl || DEFAULT_BROWSER_URL),
    [browserUrl],
  )

  const copy = isZh
    ? {
        introTitle: '图谱浏览器',
        introBody:
          '在管理后台里直接查看本地 Neo4j Browser。适合检查 Skill、Version、FeedbackAggregate 以及部门和场景效果边。',
        openTab: '新标签打开',
        browserCardTitle: '嵌入视图',
        browserCardBody:
          '如果浏览器策略阻止嵌入，直接使用“新标签打开”。当前页面仍保留连接地址和本地访问说明。',
        urlLabel: '浏览器地址',
        userLabel: '默认用户名',
        notesTitle: '使用提示',
        noteOne: '适合快速检查 Demo 图谱里的 Skill、SkillVersion 和 FeedbackAggregate。',
        noteTwo: '如页面无法嵌入，通常是 Browser 的 iframe 策略导致，直接用新标签打开即可。',
        noteThree: '当前默认指向本机 7474 端口，可通过 Vite 环境变量覆盖。',
        defaultUser: 'neo4j',
        iframeTitle: 'Neo4j Browser',
      }
    : {
        introTitle: 'Graph Browser',
        introBody:
          'Open the local Neo4j Browser directly inside admin. Use it to inspect Skill, Version, FeedbackAggregate, and effect edges for department and scene.',
        openTab: 'Open in new tab',
        browserCardTitle: 'Embedded Browser',
        browserCardBody:
          'If browser policy blocks embedding, use the new-tab action. This page still keeps the connection target and local access notes in one place.',
        urlLabel: 'Browser URL',
        userLabel: 'Default username',
        notesTitle: 'Usage Notes',
        noteOne: 'Useful for checking demo graph data such as Skill, SkillVersion, and FeedbackAggregate nodes.',
        noteTwo: 'If the frame does not render, it is usually due to iframe policy. Open it in a new tab instead.',
        noteThree: 'The default target is local port 7474 and can be overridden via a Vite env var.',
        defaultUser: 'neo4j',
        iframeTitle: 'Neo4j Browser',
      }

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
            <h3>{copy.browserCardTitle}</h3>
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

        <div className="neo4j-frame-shell">
          <iframe
            className="neo4j-frame"
            src={resolvedUrl}
            title={copy.iframeTitle}
          />
        </div>
      </section>
    </div>
  )
}
