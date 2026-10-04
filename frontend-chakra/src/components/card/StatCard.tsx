import type { ReactNode } from 'react'
import { Box, Flex, Icon, Text, useColorModeValue } from '@chakra-ui/react'
import NumberFlow from '@number-flow/react'
import type { IconType } from 'react-icons'
import Card from '@/components/card/Card'

type Props = {
  name: ReactNode
  value: ReactNode
  icon?: IconType
  iconColor?: string
  valueColor?: string
  helpText?: ReactNode
  onClick?: () => void
}

// 'green.500' -> the CSS variable Chakra generates for that token
const cssVar = (token: string) => `var(--chakra-colors-${token.replace('.', '-')})`

// Metric tile: tinted icon chip, label, large value (numbers roll when they change), optional help line.
export default function StatCard({ name, value, icon, iconColor = 'brand.500', valueColor, helpText, onClick }: Props) {
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const accent = cssVar(iconColor)

  return (
    <Card
      p="18px"
      overflow="hidden"
      cursor={onClick ? 'pointer' : undefined}
      onClick={onClick}
      transition="transform .18s ease, box-shadow .18s ease, border-color .18s ease"
      _hover={{ transform: 'translateY(-3px)', boxShadow: 'cardHover', borderColor: `color-mix(in srgb, ${accent} 35%, transparent)` }}
      role="group"
    >
      {/* soft accent glow in the corner */}
      <Box
        position="absolute"
        top="-40px"
        right="-40px"
        w="120px"
        h="120px"
        borderRadius="full"
        bg={`color-mix(in srgb, ${accent} 14%, transparent)`}
        filter="blur(8px)"
        pointerEvents="none"
        transition="transform .3s ease"
        _groupHover={{ transform: 'scale(1.25)' }}
      />
      <Flex align="center" justify="space-between" minH="38px" mb="14px" position="relative">
        <Text fontSize="13px" fontWeight="600" color="secondaryGray.600" noOfLines={1}>
          {name}
        </Text>
        {icon && (
          <Flex w="38px" h="38px" minW="38px" borderRadius="11px" align="center" justify="center" bg={`color-mix(in srgb, ${accent} 14%, transparent)`} color={iconColor}>
            <Icon as={icon} w="20px" h="20px" />
          </Flex>
        )}
      </Flex>
      <Text as="div" display="flex" alignItems="center" minH="36px" fontSize="28px" lineHeight="1" fontWeight="800" letterSpacing="-0.02em" color={valueColor || textColor} position="relative">
        {typeof value === 'number' ? <NumberFlow value={value} /> : value}
      </Text>
      {helpText && (
        <Text fontSize="xs" fontWeight="500" color="secondaryGray.600" mt="6px" position="relative">
          {helpText}
        </Text>
      )}
    </Card>
  )
}
