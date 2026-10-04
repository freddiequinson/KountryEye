import type { ReactNode } from 'react'
import { Box, Flex, Icon, Text, useColorModeValue } from '@chakra-ui/react'
import { keyframes } from '@emotion/react'
import NumberFlow from '@number-flow/react'
import type { IconType } from 'react-icons'
import { MdAccessTime, MdApartment, MdCheckCircle, MdErrorOutline, MdEvent, MdInsights, MdInventory2, MdMedicalServices, MdPayments, MdPeople, MdVisibility } from 'react-icons/md'
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

// Cards that don't pass an icon get one picked from their label, so stat rows look consistent.
const ICON_HINTS: [RegExp, IconType][] = [
  [/revenue|sales|income|profit|value|amount|paid|payment|price|top-up|limit|used|owed|memo|fund/i, MdPayments],
  [/patient|employee|staff|user|registration|member|client|referral/i, MdPeople],
  [/waiting|pending|late|due|awaiting|expir/i, MdAccessTime],
  [/consult|prescription|doctor/i, MdMedicalServices],
  [/visit|check-in|day|attendance|present|record/i, MdEvent],
  [/stock|product|item|inventory|asset|warehouse|categor|transfer/i, MdInventory2],
  [/complete|active|created|updated|approved/i, MdCheckCircle],
  [/absent|faulty|out of|alert|rejected/i, MdErrorOutline],
  [/branch/i, MdApartment],
  [/scan/i, MdVisibility],
]
const iconFor = (name: ReactNode) => (typeof name === 'string' ? ICON_HINTS.find(([re]) => re.test(name))?.[1] : undefined) || MdInsights

const rise = keyframes`from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; }`
// cards in a row come in one after another
const stagger = Object.fromEntries([2, 3, 4, 5, 6].map((n) => [`&:nth-of-type(${n})`, { animationDelay: `${(n - 1) * 70}ms` }]))

// 'green.500' -> the CSS variable Chakra generates for that token
const cssVar = (token: string) => `var(--chakra-colors-${token.replace('.', '-')})`

// Metric tile: tinted icon chip, label, large value (numbers roll when they change), optional help line.
export default function StatCard({ name, value, icon: iconProp, iconColor: iconColorProp, valueColor, helpText, onClick }: Props) {
  const icon = iconProp || iconFor(name)
  // the chip follows the value colour when the caller only set that
  const iconColor = iconColorProp || valueColor || 'brand.500'
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
      animation={`${rise} .45s cubic-bezier(0.22, 1, 0.36, 1) both`}
      sx={stagger}
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
        {(
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
