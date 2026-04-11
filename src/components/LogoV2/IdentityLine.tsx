import * as React from 'react'
import { Text } from '../../ink.js'
import { formatIdentityLines } from '../../utils/logoV2Utils.js'

type Props = {
  username?: string | null
  maxWidth?: number
}

export function IdentityLine({
  username = null,
  maxWidth,
}: Props): React.ReactNode {
  const lines = formatIdentityLines(username, maxWidth)
  if (lines.length === 0) {
    return null
  }

  return (
    <>
      {lines.map((line) => (
        <Text key={line} dimColor={true}>
          {line}
        </Text>
      ))}
    </>
  )
}
