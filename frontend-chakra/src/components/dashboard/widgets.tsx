import type { ReactNode } from 'react'
import { Box, Flex, Icon, SimpleGrid, Stack, Text, useColorModeValue, type FlexProps, type SimpleGridProps } from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import { MdChevronRight } from 'react-icons/md'

export type QuickAction = { label: string; hint?: string; icon: IconType; color?: string; onClick?: () => void; disabled?: boolean }

const cssVar = (token: string) => `var(--chakra-colors-${token.replace('.', '-')})`

// Action tiles: tinted icon chip, label (+ optional hint) and a chevron that nudges on hover.
export function QuickActions({ actions, columns = 2 }: { actions: QuickAction[]; columns?: SimpleGridProps['columns'] }) {
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.50')
  const textColor = useColorModeValue('secondaryGray.900', 'white')

  return (
    <SimpleGrid columns={columns} spacing="10px">
      {actions.map((action) => {
        const accent = cssVar(action.color || 'brand.500')
        return (
          <Flex
            key={action.label}
            as="button"
            type="button"
            role="group"
            align="center"
            gap="12px"
            p="12px"
            textAlign="left"
            border="1px solid"
            borderColor={borderColor}
            borderRadius="14px"
            onClick={action.onClick}
            disabled={action.disabled}
            opacity={action.disabled ? 0.5 : 1}
            cursor={action.disabled ? 'default' : 'pointer'}
            _hover={action.disabled ? undefined : { bg: hoverBg, borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`, transform: 'translateY(-1px)' }}
            _active={action.disabled ? undefined : { transform: 'scale(0.99)' }}
            transition="all .15s ease"
          >
            <Flex w="40px" h="40px" minW="40px" borderRadius="11px" align="center" justify="center" bg={`color-mix(in srgb, ${accent} 14%, transparent)`} color={action.color || 'brand.600'}>
              <Icon as={action.icon} w="20px" h="20px" />
            </Flex>
            <Box flex="1" minW="0">
              <Text fontSize="14px" fontWeight="700" color={textColor} noOfLines={1}>
                {action.label}
              </Text>
              {action.hint && (
                <Text fontSize="12px" fontWeight="500" color="secondaryGray.600" noOfLines={1}>
                  {action.hint}
                </Text>
              )}
            </Box>
            <Icon as={MdChevronRight} w="18px" h="18px" color="secondaryGray.500" transition="transform .15s ease" _groupHover={{ transform: 'translateX(3px)' }} />
          </Flex>
        )
      })}
    </SimpleGrid>
  )
}

// Bordered list row used for queues, recent items, etc.
export function RowBox(props: FlexProps) {
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.50')
  return <Flex align="center" justify="space-between" gap="12px" p="12px" border="1px solid" borderColor={borderColor} borderRadius="12px" transition="background .15s ease" _hover={{ bg: hoverBg }} {...props} />
}

export function SummaryList({ rows }: { rows: { label: ReactNode; value: ReactNode; color?: string }[] }) {
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')

  return (
    <Stack spacing="0">
      {rows.map((row, i) => (
        <Flex key={i} justify="space-between" align="center" py="11px" borderBottom={i < rows.length - 1 ? '1px dashed' : undefined} borderColor={borderColor}>
          <Text fontSize="sm" fontWeight="500" color="secondaryGray.600">
            {row.label}
          </Text>
          <Text as="div" fontSize="sm" fontWeight="700" color={row.color || textColor}>
            {row.value}
          </Text>
        </Flex>
      ))}
    </Stack>
  )
}
