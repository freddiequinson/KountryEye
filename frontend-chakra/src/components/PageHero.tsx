import type { ReactNode } from 'react'
import { keyframes } from '@emotion/react'
import { Box, Flex, Heading, Text } from '@chakra-ui/react'

const drift = keyframes`0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(60px, -20px) scale(1.25); }`
const fadeMask = 'linear-gradient(to right, transparent 0%, black 55%)'

// Dark green banner with the clinic photo fading in from the right. Used at the top of dashboards and profile pages.
export default function PageHero({
  eyebrow,
  title,
  description,
  actions,
  children,
  image = '/login.jpg',
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  image?: string
}) {
  return (
    <Box
      position="relative"
      overflow="hidden"
      borderRadius="22px"
      mb="24px"
      color="white"
      bg="linear-gradient(120deg, #0B2415 0%, #14472A 48%, #2F7A3F 100%)"
      boxShadow="0 20px 40px -24px rgba(11, 36, 21, 0.7)"
    >
      <Box
        position="absolute"
        inset="0"
        left={{ base: '30%', md: '45%' }}
        bgImage={`url(${image})`}
        bgSize="cover"
        bgPosition="center 30%"
        opacity={0.55}
        sx={{ maskImage: fadeMask, WebkitMaskImage: fadeMask }}
      />
      {/* decorative rings and glow */}
      <Box position="absolute" top="-90px" left="-60px" w="260px" h="260px" borderRadius="full" border="1px solid rgba(255,255,255,0.08)" />
      <Box position="absolute" top="-140px" left="-110px" w="360px" h="360px" borderRadius="full" border="1px solid rgba(255,255,255,0.05)" />
      <Box position="absolute" bottom="-80px" left="35%" w="220px" h="220px" borderRadius="full" bg="rgba(12, 192, 223, 0.22)" filter="blur(50px)" animation={`${drift} 14s ease-in-out infinite`} />

      <Flex
        position="relative"
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'start', md: 'end' }}
        gap="20px"
        p={{ base: '22px', md: '30px' }}
        minH={{ md: '168px' }}
      >
        <Box maxW="640px">
          {eyebrow && (
            <Text fontSize="12px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color="brand.200" mb="8px">
              {eyebrow}
            </Text>
          )}
          <Heading as="h1" fontSize={{ base: '26px', md: '32px' }} fontWeight="800" letterSpacing="-0.02em" lineHeight="1.12" data-tour="page-title">
            {title}
          </Heading>
          {description && (
            <Text mt="8px" fontSize="15px" fontWeight="500" color="whiteAlpha.800">
              {description}
            </Text>
          )}
          {children && <Box mt="16px">{children}</Box>}
        </Box>
        {actions && (
          <Flex gap="8px" wrap="wrap" flexShrink={0} sx={{ '& > .chakra-button': { backdropFilter: 'blur(10px)' } }} className="hero-actions">
            {actions}
          </Flex>
        )}
      </Flex>
    </Box>
  )
}
