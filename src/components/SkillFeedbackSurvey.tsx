import React from 'react'
import { Box, Text } from '../ink.js'
import { useDebouncedDigitInput } from './FeedbackSurvey/useDebouncedDigitInput.js'

type Props = {
  onSelect: (rating: 1 | 2 | 3 | 4 | 5) => void
  inputValue: string
  setInputValue: (value: string) => void
  message?: string
}

const RESPONSE_INPUTS = ['1', '2', '3', '4', '5'] as const
type ResponseInput = (typeof RESPONSE_INPUTS)[number]
const inputToResponse: Record<ResponseInput, 1 | 2 | 3 | 4 | 5> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
} as const

const isValidResponseInput = (input: string): input is ResponseInput =>
  (RESPONSE_INPUTS as readonly string[]).includes(input)

const DEFAULT_MESSAGE = '你觉得本次执行效果怎么样？(可选)'

export function SkillFeedbackSurvey({
  onSelect,
  inputValue,
  setInputValue,
  message = DEFAULT_MESSAGE,
}: Props): React.ReactNode {
  useDebouncedDigitInput({
    inputValue,
    setInputValue,
    isValidDigit: isValidResponseInput,
    onDigit: digit => onSelect(inputToResponse[digit]),
  })

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color="ansi:cyan">● </Text>
        <Text bold>{message}</Text>
      </Box>

      <Box marginLeft={2} flexDirection="row">
        <Box width={16}>
          <Text>
            <Text color="ansi:cyan">1</Text>: 非常棒
          </Text>
        </Box>
        <Box width={10}>
          <Text>
            <Text color="ansi:cyan">2</Text>: 好
          </Text>
        </Box>
        <Box width={10}>
          <Text>
            <Text color="ansi:cyan">3</Text>: 一般
          </Text>
        </Box>
        <Box width={10}>
          <Text>
            <Text color="ansi:cyan">4</Text>: 糟糕
          </Text>
        </Box>
        <Box>
          <Text>
            <Text color="ansi:cyan">5</Text>: 忽略
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
