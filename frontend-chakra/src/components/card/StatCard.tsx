import type { ReactNode } from 'react'
import { keyframes } from '@emotion/react'
import { Flex, Icon, Stat, StatLabel, StatNumber, Text, useColorModeValue } from '@chakra-ui/react'
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

const rise = keyframes`from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; }`
// cards in a row come in one after another
const stagger = Object.fromEntries([2, 3, 4, 5, 6].map((n) => [`&:nth-of-type(${n})`, { animationDelay: `${(n - 1) * 70}ms` }]))

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

// Horizon MiniStatistics: round icon box on the left, label over a large value.
// Numbers roll when they change; the icon tints to the card's accent colour.
export default function StatCard({ name, value, icon: iconProp, iconColor: iconColorProp, valueColor, helpText, onClick }: Props) {
  const icon = iconProp || iconFor(name)
  // the icon follows the value colour when the caller only set that
  const iconColor = iconColorProp || valueColor || 'brand.500'
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const boxBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')

  return (
    <Card
      py="15px"
      cursor={onClick ? 'pointer' : undefined}
      onClick={onClick}
      transition="transform .18s ease, box-shadow .18s ease"
      _hover={{ transform: 'translateY(-3px)', boxShadow: 'cardHover' }}
      animation={`${rise} .45s cubic-bezier(0.22, 1, 0.36, 1) both`}
      sx={stagger}
    >
      <Flex my="auto" h="100%" align="center">
        <Flex w={{ base: '48px', '2xl': '56px' }} h={{ base: '48px', '2xl': '56px' }} flexShrink={0} borderRadius="50%" bg={boxBg} align="center" justify="center">
          <Icon as={icon} w="28px" h="28px" color={iconColor} />
        </Flex>
        <Stat my="auto" ms="14px" minW="0">
          <StatLabel lineHeight="1.3" color="secondaryGray.600" fontSize="sm" fontWeight="500">
            {name}
          </StatLabel>
          <StatNumber color={valueColor || textColor} fontSize={typeof value === 'string' && value.length > 11 ? 'xl' : '2xl'} fontWeight="700" lineHeight="1.25" whiteSpace="nowrap">
            {typeof value === 'number' ? <NumberFlow value={value} /> : value}
          </StatNumber>
          {helpText && (
            <Text as="div" color="secondaryGray.600" fontSize="xs" fontWeight="500">
              {helpText}
            </Text>
          )}
        </Stat>
      </Flex>
    </Card>
  )
}
