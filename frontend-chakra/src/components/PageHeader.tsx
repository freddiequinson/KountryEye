import type { ReactNode } from 'react'
import { Box, Flex, Heading, Text, useColorModeValue } from '@chakra-ui/react'

const STOPS = '#0B2415 0%, #14472A 50%, #2F7A3F 100%'

// Page title row as the dark green banner (after the POS and Attendance banners).
// The heading carries data-tour="page-title" for the onboarding tours.
// `children` sit under the title inside the banner (a search box, filters).
// `plain` keeps the bare title row, for pages that already open with a banner of their own.
export default function PageHeader({
  title,
  description,
  actions,
  children,
  plain,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  plain?: boolean
}) {
  const textColor = useColorModeValue('secondaryGray.900', 'white')

  if (plain) {
    return (
      <Flex justify="space-between" align={{ base: 'start', md: 'end' }} direction={{ base: 'column', md: 'row' }} gap="16px" mb="24px">
        <Box minW="0">
          <Heading as="h1" fontSize={{ base: '26px', md: '34px' }} fontWeight="800" letterSpacing="-0.02em" lineHeight="1.15" color={textColor} data-tour="page-title">
            {title}
          </Heading>
          {description && (
            <Text color="secondaryGray.600" fontSize="md" fontWeight="500" mt="6px">
              {description}
            </Text>
          )}
        </Box>
        {actions && (
          <Flex gap="8px" wrap="wrap" flexShrink={0}>
            {actions}
          </Flex>
        )}
      </Flex>
    )
  }

  return (
    <Box
      position="relative"
      overflow="hidden"
      borderRadius="20px"
      mb="24px"
      color="white"
      bg={`linear-gradient(120deg, ${STOPS})`}
      boxShadow="0 20px 40px -24px rgba(11, 36, 21, 0.7)"
    >
      <Box position="absolute" top="-120px" right="-60px" w="340px" h="340px" borderRadius="full" border="1px solid rgba(255,255,255,0.08)" />
      <Box position="absolute" top="-90px" right="22%" w="220px" h="220px" borderRadius="full" bg="rgba(12, 192, 223, 0.2)" filter="blur(50px)" />

      <Flex position="relative" justify="space-between" align={{ base: 'start', md: 'end' }} direction={{ base: 'column', md: 'row' }} gap="16px" p={{ base: '22px', md: '30px' }}>
        <Box minW="0" flex="1" sx={{ '.chakra-badge': { bg: 'white', color: 'secondaryGray.900', boxShadow: 'none' } }}>
          <Heading as="h1" fontSize={{ base: '26px', md: '34px' }} fontWeight="800" letterSpacing="-0.02em" lineHeight="1.15" data-tour="page-title">
            {title}
          </Heading>
          {description && (
            <Text as="div" color="whiteAlpha.800" fontSize="md" fontWeight="500" mt="6px">
              {description}
            </Text>
          )}
          {children && <Box mt="18px">{children}</Box>}
        </Box>
        {actions && (
          <Flex gap="8px" wrap="wrap" flexShrink={0} className="banner-actions">
            {actions}
          </Flex>
        )}
      </Flex>
    </Box>
  )
}
