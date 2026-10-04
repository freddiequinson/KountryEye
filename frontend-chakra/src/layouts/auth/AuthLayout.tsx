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
            <Flex
              direction="column"
              justify="end"
              w="100%"
              p="48px"
              ps={{ lg: '120px', xl: '200px' }}
              bgGradient="linear(to-t, blackAlpha.700, transparent)"
            >
              <Heading color="white" fontSize="3xl" mb="8px">
                Kountry Eyecare
              </Heading>
              <Text color="whiteAlpha.800">Integrated Clinic Management System</Text>
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
  const textColor = useColorModeValue('navy.700', 'white')

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
        <Heading color={textColor} fontSize="36px" mb="10px">
          {title}
        </Heading>
        <Text mb="36px" ms="4px" color="gray.400" fontWeight="400" fontSize="md">
          {subtitle}
        </Text>
      </Box>
      <Flex direction="column" w={{ base: '100%', md: '420px' }} maxW="100%" me="auto" mb={{ base: '20px', md: 'auto' }}>
        {children}
      </Flex>
    </Flex>
  )
}
