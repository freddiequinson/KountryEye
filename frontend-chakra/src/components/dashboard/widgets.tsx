import type { ReactNode } from 'react'
import { Flex, Icon, SimpleGrid, Stack, Text, useColorModeValue, type FlexProps, type SimpleGridProps } from '@chakra-ui/react'
import type { IconType } from 'react-icons'

export type QuickAction = { label: string; icon: IconType; onClick?: () => void; disabled?: boolean }

export function QuickActions({ actions, columns = 2 }: { actions: QuickAction[]; columns?: SimpleGridProps['columns'] }) {
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const textColor = useColorModeValue('secondaryGray.900', 'white')

  return (
    <SimpleGrid columns={columns} spacing="12px">
      {actions.map((action) => (
        <Flex
          key={action.label}
          as="button"
          type="button"
          direction="column"
          align="center"
          p="16px"
          border="1px solid"
          borderColor={borderColor}
          borderRadius="16px"
          onClick={action.onClick}
          disabled={action.disabled}
          opacity={action.disabled ? 0.5 : 1}
          cursor={action.disabled ? 'default' : 'pointer'}
          _hover={action.disabled ? undefined : { bg: hoverBg }}
          transition="background 0.15s"
        >
          <Icon as={action.icon} w="24px" h="24px" mb="8px" color={action.disabled ? 'secondaryGray.600' : 'brand.500'} />
          <Text fontSize="sm" fontWeight="500" color={action.disabled ? 'secondaryGray.600' : textColor}>
            {action.label}
          </Text>
        </Flex>
      ))}
    </SimpleGrid>
  )
}

// Bordered list row used for queues, recent items, etc.
export function RowBox(props: FlexProps) {
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  return <Flex align="center" justify="space-between" gap="12px" p="12px" border="1px solid" borderColor={borderColor} borderRadius="12px" {...props} />
}

export function SummaryList({ rows }: { rows: { label: ReactNode; value: ReactNode; color?: string }[] }) {
  const textColor = useColorModeValue('secondaryGray.900', 'white')

  return (
    <Stack spacing="12px">
      {rows.map((row, i) => (
        <Flex key={i} justify="space-between" align="center">
          <Text fontSize="sm" color="secondaryGray.600">
            {row.label}
          </Text>
          <Text fontWeight="600" color={row.color || textColor}>
            {row.value}
          </Text>
        </Flex>
      ))}
    </Stack>
  )
}
