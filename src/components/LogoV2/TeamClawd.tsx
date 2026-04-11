import * as React from 'react'
import { Box } from '../../ink.js'
import { Clawd } from './Clawd.js'

export function TeamClawd() {
  return (
    <Box flexDirection="row" gap={1} alignItems="center">
      <Clawd />
      <Clawd />
      <Clawd />
    </Box>
  )
}
