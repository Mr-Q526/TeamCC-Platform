import { useTranslation } from 'react-i18next'

interface TemplatesPageProps {
  accessToken: string
}

export default function TemplatesPage({ accessToken }: TemplatesPageProps) {
  const { t } = useTranslation()

  return (
    <div className="page">
      <h2>{t('templates.title')}</h2>
      <p>Token: {accessToken.slice(0, 20)}...</p>
      <div className="coming-soon">
        <h3>{t('templates.comingSoon')}</h3>
        <p>{t('templates.desc')}</p>
        <p>{t('templates.features')}</p>
        <ul>
          <li>{t('templates.feature1')}</li>
          <li>{t('templates.feature2')}</li>
          <li>{t('templates.feature3')}</li>
          <li>{t('templates.feature4')}</li>
          <li>{t('templates.feature5')}</li>
          <li>{t('templates.feature6')}</li>
        </ul>
      </div>
    </div>
  )
}
