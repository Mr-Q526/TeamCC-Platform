import { useTranslation } from 'react-i18next'

interface UsersPageProps {
  accessToken: string
}

export default function UsersPage({ accessToken }: UsersPageProps) {
  const { t } = useTranslation()

  return (
    <div className="page">
      <h2>{t('users.title')}</h2>
      <p>Token: {accessToken.slice(0, 20)}...</p>
      <div className="coming-soon">
        <h3>{t('users.comingSoon')}</h3>
        <p>{t('users.desc')}</p>
        <p>{t('users.features')}</p>
        <ul>
          <li>{t('users.feature1')}</li>
          <li>{t('users.feature2')}</li>
          <li>{t('users.feature3')}</li>
          <li>{t('users.feature4')}</li>
          <li>{t('users.feature5')}</li>
        </ul>
      </div>
    </div>
  )
}
