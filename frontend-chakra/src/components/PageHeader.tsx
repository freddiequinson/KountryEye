import type { ReactNode } from 'react'
import { Box, Flex, Heading, Text, useColorModeValue } from '@chakra-ui/react'

// Page title row: the heading carries data-tour="page-title" for the onboarding tours.
export default function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  const textColor = useColorModeValue('secondaryGray.900', 'white')

  return (
    <Flex justify="space-between" align={{ base: 'start', md: 'end' }} direction={{ base: 'column', md: 'row' }} gap="16px" mb="24px">
      <Box minW="0">
        <Heading as="h1" fontSize={{ base: '24px', md: '28px' }} fontWeight="800" letterSpacing="-0.02em" lineHeight="1.15" color={textColor} data-tour="page-title">
          {title}
        </Heading>
        {description && (
          <Text color="secondaryGray.600" fontSize="sm" fontWeight="500" mt="6px">
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
