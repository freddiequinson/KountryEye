import type { ReactNode } from 'react'
import { Box, Flex, Grid, Icon, SimpleGrid, Text, useColorModeValue, type SimpleGridProps } from '@chakra-ui/react'
import type { IconType } from 'react-icons'

// One block of a long form: label column on the left, fields in a grid on the right.
// Stack several inside one Card; each draws a divider above itself except the first.
export function FormSection({
  icon,
  title,
  description,
  columns = { base: 1, md: 2 },
  children,
}: {
  icon?: IconType
  title: ReactNode
  description?: ReactNode
  columns?: SimpleGridProps['columns']
  children: ReactNode
}) {
  const border = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  return (
    <Grid
      templateColumns={{ base: '1fr', lg: '240px 1fr' }}
      gap={{ base: '16px', lg: '32px' }}
      py="24px"
      borderTop="1px solid"
      borderColor={border}
      _first={{ borderTop: 'none', pt: '4px' }}
      _last={{ pb: '4px' }}
    >
      <Flex gap="12px" align="start">
        {icon && (
          <Flex w="36px" h="36px" minW="36px" borderRadius="10px" bg="brand.50" color="brand.600" _dark={{ bg: 'whiteAlpha.100', color: 'brand.300' }} align="center" justify="center">
            <Icon as={icon} w="18px" h="18px" />
          </Flex>
        )}
        <Box>
          <Text fontWeight="700" fontSize="15px" lineHeight="1.3">
            {title}
          </Text>
          {description && (
            <Text fontSize="13px" fontWeight="500" color="secondaryGray.600" mt="3px">
              {description}
            </Text>
          )}
        </Box>
      </Flex>
      <SimpleGrid columns={columns} spacingX="16px" spacingY="18px">
        {children}
      </SimpleGrid>
    </Grid>
  )
}

// Action bar pinned to the bottom of the viewport while a long form scrolls.
export function FormActions({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  const bg = useColorModeValue('rgba(255,255,255,0.9)', 'rgba(17,28,68,0.9)')
  const border = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  return (
    <Flex
      position="sticky"
      bottom="12px"
      zIndex="4"
      mt="20px"
      px="16px"
      py="12px"
      align="center"
      justify="space-between"
      gap="12px"
      bg={bg}
      backdropFilter="blur(12px)"
      border="1px solid"
      borderColor={border}
      borderRadius="14px"
      boxShadow="pop"
    >
      <Text fontSize="13px" fontWeight="500" color="secondaryGray.600" display={{ base: 'none', md: 'block' }}>
        {hint}
      </Text>
      <Flex gap="10px" ms="auto">
        {children}
      </Flex>
    </Flex>
  )
}
