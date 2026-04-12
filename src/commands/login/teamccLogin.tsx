import * as React from 'react'
import { Box, Text, useInput } from '../../ink.js'
import TextInput from '../../components/TextInput.js'
import {
  loginToTeamCC,
  saveTeamCCConfig,
  fetchIdentityFromTeamCC,
  cacheIdentity,
} from '../../bootstrap/teamccAuth.js'
import { reportAuditLog } from '../../bootstrap/teamccAudit.js'

export function TeamCCLogin({
  onDone,
}: {
  onDone: (success: boolean) => void
}) {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [usernameCursor, setUsernameCursor] = React.useState(0)
  const [passwordCursor, setPasswordCursor] = React.useState(0)
  const [step, setStep] = React.useState<'username' | 'password' | 'loading'>(
    'username',
  )
  const [error, setError] = React.useState('')

  useInput((input, key) => {
    if (key.escape) {
      onDone(false)
    }
  })

  const handleUsernameSubmit = (val: string) => {
    if (val.trim()) {
      setStep('password')
      setError('')
    }
  }

  const handlePasswordSubmit = async (val: string) => {
    if (!val) return
    setStep('loading')
    setError('')
    try {
      // 1. Invoke TeamCC Login
      const adminUrl = process.env.TEAMCC_ADMIN_URL || 'http://127.0.0.1:3000'
      const { config } = await loginToTeamCC(username, val, adminUrl)
      // 2. Save config locally
      await saveTeamCCConfig(process.cwd(), config)
      // 3. Fetch Identity Payload based on new token
      const identity = await fetchIdentityFromTeamCC(config)
      // 4. Cache it for offline capabilities
      await cacheIdentity(process.cwd(), identity)
      
      // 5. Fire Audit Log
      reportAuditLog(process.cwd(), 'login', { username: identity.subject.username })

      onDone(true)
    } catch (err) {
      setError((err as Error).message || '登录失败，请检查用户名和密码')
      setStep('username')
      setUsername('')
      setPassword('')
    }
  }

  if (step === 'loading') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text>正在进行 TeamCC 认证与身份同步...</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      {error ? <Text color="error">错误: {error}</Text> : null}

      {step === 'username' ? (
        <React.Fragment>
          <Text>请输入你的 TeamCC 用户名:</Text>
          <TextInput
            value={username}
            onChange={setUsername}
            onSubmit={handleUsernameSubmit}
            cursorOffset={usernameCursor}
            onChangeCursorOffset={setUsernameCursor}
            focus={true}
            showCursor={true}
          />
        </React.Fragment>
      ) : (
        <React.Fragment>
          <Text>用户名: {username}</Text>
          <Text>请输入密码:</Text>
          <TextInput
            value={password}
            onChange={setPassword}
            onSubmit={handlePasswordSubmit}
            cursorOffset={passwordCursor}
            onChangeCursorOffset={setPasswordCursor}
            focus={true}
            mask="*"
            showCursor={true}
          />
        </React.Fragment>
      )}
    </Box>
  )
}
