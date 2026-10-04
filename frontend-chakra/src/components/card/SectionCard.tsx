import type { ReactNode } from 'react'
import { Box, Flex, Heading, Text, useColorModeValue } from '@chakra-ui/react'
import Card from '@/components/card/Card'

type Props = Omit<React.ComponentProps<typeof Card>, 'title'> & {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}

// Horizon card with a title row; stands in for shadcn's Card + CardHeader + CardTitle + CardDescription + CardContent.
export default function SectionCard({ title, description, actions, children, ...rest }: Props) {
  const textColor = useColorModeValue('secondaryGray.900', 'white')

  return (
    <Card {...rest}>
      {(title || actions) && (
        <Flex justify="space-between" align="start" gap="12px" mb="16px" wrap="wrap">
          <Box>
            {title && (
              <Heading as="h3" fontSize="lg" fontWeight="700" color={textColor}>
                {title}
              </Heading>
            )}
            {description && (
              <Text fontSize="sm" color="secondaryGray.600" mt="2px">
                {description}
              </Text>
            )}
          </Box>
          {actions && (
            <Flex gap="8px" align="center" wrap="wrap">
              {actions}
            </Flex>
          )}
        </Flex>
      )}
      {children}
    </Card>
  )
}
