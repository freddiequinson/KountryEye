import type { ReactNode } from 'react'
import { Box, Flex, Icon, Image, Text, useColorModeValue } from '@chakra-ui/react'
import type { IconType } from 'react-icons'

// Ported from Horizon views/admin/marketplace/components/HistoryItem.js:
// a 66px rounded tile (image, icon or short text), name + subtitle, a value and a trailing note.
// The row lifts onto a white card when hovered.
export default function HistoryItem({
  image,
  icon,
  tile,
  tileColor = 'brand.500',
  name,
  sub,
  value,
  end,
  onClick,
}: {
  image?: string
  icon?: IconType
  tile?: ReactNode
  tileColor?: string
  name: ReactNode
  sub?: ReactNode
  value?: ReactNode
  end?: ReactNode
  onClick?: () => void
}) {
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const tileBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const hover = useColorModeValue({ bg: 'white', boxShadow: '0px 40px 58px -20px rgba(112, 144, 176, 0.22)' }, { bg: 'navy.700', boxShadow: 'unset' })

  return (
    <Flex align="center" px={{ base: '12px', md: '20px' }} py="14px" borderRadius="20px" transition="0.2s linear" _hover={hover} cursor={onClick ? 'pointer' : undefined} onClick={onClick}>
      {image ? (
        <Image src={image} w="66px" h="66px" minW="66px" borderRadius="20px" objectFit="cover" me="16px" />
      ) : (
        <Flex w="66px" h="66px" minW="66px" borderRadius="20px" bg={tileBg} color={tileColor} align="center" justify="center" direction="column" me="16px" fontWeight="700" lineHeight="1.1">
          {icon ? <Icon as={icon} w="28px" h="28px" /> : tile}
        </Flex>
      )}
      <Box flex="1" minW="0" me="14px">
        <Text color={textColor} fontSize="md" fontWeight="bold" mb="4px" noOfLines={1}>
          {name}
        </Text>
        {sub && (
          <Text as="div" color="secondaryGray.600" fontSize="sm" fontWeight="400" noOfLines={1}>
            {sub}
          </Text>
        )}
      </Box>
      {value && (
        <Text as="div" fontWeight="700" fontSize="md" color={textColor} me={{ base: '10px', md: '28px' }} whiteSpace="nowrap">
          {value}
        </Text>
      )}
      {end && (
        <Box ms="auto" fontWeight="700" fontSize="sm" color="secondaryGray.600" flexShrink={0}>
          {end}
        </Box>
      )}
    </Flex>
  )
}
