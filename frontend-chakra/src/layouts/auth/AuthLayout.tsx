import type { ReactNode } from 'react'
import { Box, Flex, Heading, Image, Text, useColorModeValue } from '@chakra-ui/react'
import FixedPlugin from '@/components/fixedPlugin/FixedPlugin'

// Ported from Horizon layouts/auth/Default.js: form on the left, clinic photo on the right.
export default function AuthLayout({ children }: { children: ReactNode }) {
  const bg = useColorModeValue('white', 'navy.900')

  return (
    <Flex position="relative" minH="100vh" bg={bg}>
      <Flex
        w="100%"
        maxW={{ md: '66%', lg: '1313px' }}
        mx="auto"
        px={{ lg: '30px', xl: '0px' }}
        ps={{ xl: '70px' }}
        direction="column"
      >
        <Box w={{ base: '100%', lg: '50%' }} pt="40px" ps={{ base: '25px', lg: '0px' }}>
          <Image src="/kountry-logo.png" alt="Kountry Eyecare" w="180px" />
        </Box>
        {children}
        <Box
          display={{ base: 'none', lg: 'block' }}
          minH="100vh"
          h="100%"
          w={{ lg: '50vw', '2xl': '44vw' }}
          position="absolute"
          top="0"
          right="0"
        >
          <Flex
            bgImage="url(/login.jpg)"
            bgSize="cover"
            bgPosition="50%"
            position="absolute"
            inset="0"
            borderBottomLeftRadius={{ lg: '120px', xl: '200px' }}
            overflow="hidden"
          >
            {/* green wash over the photo, heavier at the bottom where the copy sits */}
            <Flex
              direction="column"
              justify="end"
              w="100%"
              p="48px"
              ps={{ lg: '120px', xl: '200px' }}
              bg="linear-gradient(to top, rgba(11,36,21,0.92) 0%, rgba(20,71,42,0.55) 38%, rgba(20,71,42,0.08) 70%)"
            >
              <Text fontSize="12px" fontWeight="700" letterSpacing="0.14em" textTransform="uppercase" color="brand.200" mb="10px">
                Kountry Eyecare
              </Text>
              <Heading color="white" fontSize={{ lg: '34px', xl: '40px' }} fontWeight="800" lineHeight="1.12" maxW="520px" mb="12px">
                Every patient, visit and sale in one clear view.
              </Heading>
              <Text color="whiteAlpha.800" fontWeight="500" maxW="460px" mb="22px">
                Integrated clinic management for front desk, doctors, technicians and the back office.
              </Text>
              <Flex gap="8px" wrap="wrap">
                {['Front desk', 'Consultations', 'Point of sale', 'Inventory', 'Reports'].map((label) => (
                  <Box key={label} px="12px" py="6px" borderRadius="full" fontSize="12px" fontWeight="600" color="white" bg="whiteAlpha.200" border="1px solid" borderColor="whiteAlpha.300" backdropFilter="blur(8px)">
                    {label}
                  </Box>
                ))}
              </Flex>
            </Flex>
          </Flex>
        </Box>
      </Flex>
      <FixedPlugin />
    </Flex>
  )
}

// Shared heading + form column used by every auth page.
export function AuthForm({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  const textColor = useColorModeValue('secondaryGray.900', 'white')

  return (
    <Flex
      maxW={{ base: '100%', md: 'max-content' }}
      w="100%"
      mx={{ base: 'auto', lg: '0px' }}
      me="auto"
      alignItems="start"
      justifyContent="center"
      mb={{ base: '30px', md: '60px' }}
      px={{ base: '25px', md: '0px' }}
      mt={{ base: '40px', md: '10vh' }}
      flexDirection="column"
    >
      <Box me="auto">
        <Heading color={textColor} fontSize="36px" fontWeight="800" mb="8px">
          {title}
        </Heading>
        <Text mb="32px" color="secondaryGray.600" fontWeight="500" fontSize="md">
          {subtitle}
        </Text>
      </Box>
      <Flex direction="column" w={{ base: '100%', md: '420px' }} maxW="100%" me="auto" mb={{ base: '20px', md: 'auto' }}>
        {children}
      </Flex>
    </Flex>
  )
}
