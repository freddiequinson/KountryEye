import type { ReactNode } from 'react'
import { Box, Flex, Heading, Text, useColorModeValue } from '@chakra-ui/react'

// Page title row: the heading carries data-tour="page-title" for the onboarding tours.
export default function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  const textColor = useColorModeValue('secondaryGray.900', 'white')

  return (
    <Flex justify="space-between" align={{ base: 'start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap="12px" mb="20px">
      <Box>
        <Heading size="lg" color={textColor} data-tour="page-title">
          {title}
        </Heading>
        {description && (
          <Text color="secondaryGray.600" mt="4px">
            {description}
          </Text>
        )}
      </Box>
      {actions && (
        <Flex gap="8px" wrap="wrap">
          {actions}
        </Flex>
      )}
    </Flex>
  )
}
