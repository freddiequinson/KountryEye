import { Box, Button, Flex, Icon, Image, Text, useColorModeValue } from '@chakra-ui/react'
import { MdAdd, MdInventory2 } from 'react-icons/md'
import Card from '@/components/card/Card'

// Ported from Horizon components/card/NFT.js: large rounded image, a round chip in its corner,
// name + secondary line, then price on the left and a pill button on the right.
export default function ProductCard({
  image,
  name,
  sub,
  price,
  stock,
  onAdd,
}: {
  image?: string
  name: string
  sub?: string
  price: string
  stock: number
  onAdd: () => void
}) {
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const priceColor = useColorModeValue('brand.600', 'white')
  const imageBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const out = stock <= 0
  const stockColor = stock > 10 ? 'green.500' : stock > 0 ? 'orange.500' : 'red.500'

  return (
    <Card
      p="20px"
      role="group"
      opacity={out ? 0.6 : 1}
      cursor={out ? 'not-allowed' : 'pointer'}
      transition="transform .2s ease, box-shadow .2s ease"
      _hover={out ? undefined : { transform: 'translateY(-4px)', boxShadow: 'cardHover' }}
      onClick={() => !out && onAdd()}
    >
      <Box position="relative" mb="18px" borderRadius="20px" overflow="hidden" bg={imageBg} sx={{ aspectRatio: '4 / 3' }}>
        {image ? (
          <Image src={image} alt={name} w="100%" h="100%" objectFit="cover" transition="transform .35s ease" _groupHover={out ? undefined : { transform: 'scale(1.06)' }} />
        ) : (
          <Flex w="100%" h="100%" align="center" justify="center">
            <Icon as={MdInventory2} w="40px" h="40px" color="secondaryGray.500" />
          </Flex>
        )}
        {/* stock chip sits where Horizon puts the like button */}
        <Flex position="absolute" top="12px" right="12px" align="center" gap="6px" h="30px" px="10px" borderRadius="full" bg="white" color="secondaryGray.900" fontSize="xs" fontWeight="700" boxShadow="0 4px 10px rgba(15,27,45,0.12)">
          <Box w="8px" h="8px" borderRadius="full" bg={stockColor} />
          {out ? 'Out of stock' : `${stock} left`}
        </Flex>
      </Box>
      <Text color={textColor} fontSize="lg" fontWeight="bold" mb="4px" noOfLines={1}>
        {name}
      </Text>
      <Text color="secondaryGray.600" fontSize="sm" fontWeight="400" noOfLines={1}>
        {sub || ' '}
      </Text>
      <Flex align="center" justify="space-between" gap="10px" mt="18px">
        <Text fontWeight="700" fontSize="md" color={priceColor} noOfLines={1}>
          {price}
        </Text>
        <Button variant="darkBrand" size="sm" borderRadius="70px" px="18px" leftIcon={<MdAdd />} isDisabled={out} flexShrink={0}>
          Add
        </Button>
      </Flex>
    </Card>
  )
}
