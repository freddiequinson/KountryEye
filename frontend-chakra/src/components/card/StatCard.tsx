import type { ReactNode } from 'react'
import { Flex, Icon, Stat, StatHelpText, StatLabel, StatNumber, useColorModeValue } from '@chakra-ui/react'
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

// Horizon MiniStatistics layout: round icon box on the left, label + value on the right.
export default function StatCard({ name, value, icon, iconColor = 'brand.500', valueColor, helpText, onClick }: Props) {
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const boxBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')

  return (
    <Card py="15px" cursor={onClick ? 'pointer' : undefined} onClick={onClick} _hover={onClick ? { transform: 'translateY(-2px)' } : undefined} transition="transform 0.15s">
      <Flex my="auto" h="100%" align="center">
        {icon && (
          <Flex w="56px" h="56px" minW="56px" bg={boxBg} borderRadius="50%" align="center" justify="center">
            <Icon as={icon} w="28px" h="28px" color={iconColor} />
          </Flex>
        )}
        <Stat my="auto" ms={icon ? '18px' : '0px'}>
          <StatLabel lineHeight="100%" color="secondaryGray.600" fontSize="sm" mb="4px">
            {name}
          </StatLabel>
          <StatNumber color={valueColor || textColor} fontSize="2xl">
            {value}
          </StatNumber>
          {helpText && (
            <StatHelpText color="secondaryGray.600" fontSize="xs" mb="0">
              {helpText}
            </StatHelpText>
          )}
        </Stat>
      </Flex>
    </Card>
  )
}
