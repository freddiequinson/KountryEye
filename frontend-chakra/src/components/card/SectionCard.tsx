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
        <Flex justify="space-between" align="center" gap="12px" mb="18px" wrap="wrap">
          <Box>
            {title && (
              <Heading as="h3" fontSize="22px" fontWeight="700" lineHeight="1.15" letterSpacing="-0.02em" color={textColor}>
                {title}
              </Heading>
            )}
            {description && (
              <Text fontSize="sm" fontWeight="500" color="secondaryGray.600" mt="6px">
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
