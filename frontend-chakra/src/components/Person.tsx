import type { ReactNode } from 'react'
import { Avatar, Box, Button, Flex, Heading, Icon, SimpleGrid, Text, useColorModeValue } from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import { MdArrowBack } from 'react-icons/md'
import Card from '@/components/card/Card'

const AVATAR_COLORS = ['brand.600', 'secondary.600', 'orange.500', 'blue.500', 'purple.500', 'pink.500', 'teal.500']
// Same name always gets the same colour.
const colorFor = (name: string) => AVATAR_COLORS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_COLORS.length]

// Table cell for a person: initials avatar, name and an optional second line.
export function PersonCell({ name, sub, src }: { name: string; sub?: ReactNode; src?: string }) {
  const clean = name.trim() || 'Unknown'
  return (
    <Flex align="center" gap="12px" minW="0">
      <Avatar name={clean} src={src} w="34px" h="34px" size="sm" borderRadius="10px" bg={colorFor(clean)} color="white" />
      <Box minW="0">
        <Text fontWeight="700" noOfLines={1}>
          {clean}
        </Text>
        {sub && (
          <Text as="div" fontSize="xs" fontWeight="500" color="secondaryGray.600" noOfLines={1}>
            {sub}
          </Text>
        )}
      </Box>
    </Flex>
  )
}

export type Fact = { icon: IconType; label: string; value: ReactNode }

// Top of a detail page (patient, employee): cover strip, overlapping avatar, name + badges, actions,
// then a grid of key facts and an optional side panel (e.g. a balance).
export function EntityHeader({
  name,
  subtitle,
  avatarSrc,
  badges,
  actions,
  facts = [],
  aside,
  onBack,
}: {
  name: string
  subtitle?: ReactNode
  avatarSrc?: string
  badges?: ReactNode
  actions?: ReactNode
  facts?: Fact[]
  aside?: ReactNode
  onBack?: () => void
}) {
  const ring = useColorModeValue('white', 'navy.800')
  const border = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const clean = name.trim() || 'Unknown'

  return (
    <Card p="0" overflow="hidden" mb="20px">
      <Box h="76px" position="relative" bg="linear-gradient(120deg, #0B2415 0%, #14472A 55%, #3E8141 100%)">
        <Box position="absolute" top="-60px" right="8%" w="200px" h="200px" borderRadius="full" border="1px solid rgba(255,255,255,0.1)" />
        <Box position="absolute" top="-20px" right="16%" w="120px" h="120px" borderRadius="full" bg="rgba(12,192,223,0.18)" filter="blur(30px)" />
        {onBack && (
          <Button position="absolute" top="12px" left="12px" size="sm" variant="ghost" color="white" _hover={{ bg: 'whiteAlpha.200' }} leftIcon={<MdArrowBack />} onClick={onBack}>
            Back
          </Button>
        )}
      </Box>

      <Flex px={{ base: '18px', md: '26px' }} gap="18px" align={{ base: 'start', md: 'end' }} direction={{ base: 'column', md: 'row' }} mt="-30px">
        <Avatar name={clean} src={avatarSrc} w="84px" h="84px" size="xl" borderRadius="22px" bg={colorFor(clean)} color="white" border="4px solid" borderColor={ring} flexShrink={0} />
        <Box flex="1" minW="0" pb="4px">
          <Flex align="center" gap="10px" wrap="wrap">
            <Heading as="h1" fontSize={{ base: '22px', md: '26px' }} fontWeight="800" data-tour="page-title">
              {clean}
            </Heading>
            {badges}
          </Flex>
          {subtitle && (
            <Text fontSize="sm" fontWeight="500" color="secondaryGray.600" mt="2px">
              {subtitle}
            </Text>
          )}
        </Box>
        {actions && (
          <Flex gap="8px" wrap="wrap" pb="4px">
            {actions}
          </Flex>
        )}
      </Flex>

      <Flex direction={{ base: 'column', xl: 'row' }} mt="20px" borderTop="1px solid" borderColor={border}>
        <SimpleGrid flex="1" columns={{ base: 1, sm: 2, lg: 3 }} spacingX="24px" spacingY="16px" px={{ base: '18px', md: '26px' }} py="20px">
          {facts.map((fact) => (
            <Flex key={fact.label} gap="12px" align="center" minW="0">
              <Flex w="36px" h="36px" minW="36px" borderRadius="10px" bg="secondaryGray.300" _dark={{ bg: 'whiteAlpha.100' }} color="secondaryGray.700" align="center" justify="center">
                <Icon as={fact.icon} w="18px" h="18px" />
              </Flex>
              <Box minW="0">
                <Text fontSize="11px" fontWeight="700" letterSpacing="0.06em" textTransform="uppercase" color="secondaryGray.500">
                  {fact.label}
                </Text>
                <Text as="div" fontSize="sm" fontWeight="600" noOfLines={1}>
                  {fact.value}
                </Text>
              </Box>
            </Flex>
          ))}
        </SimpleGrid>
        {aside && (
          <Box w={{ base: '100%', xl: '300px' }} flexShrink={0} borderLeftWidth={{ base: '0', xl: '1px' }} borderTopWidth={{ base: '1px', xl: '0' }} borderStyle="solid" borderColor={border} px="22px" py="20px">
            {aside}
          </Box>
        )}
      </Flex>
    </Card>
  )
}
