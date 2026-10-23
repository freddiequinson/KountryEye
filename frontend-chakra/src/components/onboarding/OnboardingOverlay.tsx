import { useEffect, useState } from 'react'
import { Box, Button, CloseButton, Flex, Heading, Icon, Text, useColorModeValue } from '@chakra-ui/react'
import { MdChevronLeft, MdChevronRight, MdPlayArrow } from 'react-icons/md'
import { useOnboarding } from '@/contexts/OnboardingContext'
import Card from '@/components/card/Card'

interface SpotlightPosition {
  top: number
  left: number
  width: number
  height: number
}

const TOOLTIP_WIDTH = 320
const TOOLTIP_HEIGHT = 200

export function OnboardingOverlay() {
  const { isOnboarding, currentStep, steps, nextStep, prevStep, stopOnboarding, markOnboardingComplete } = useOnboarding()
  const [spotlightPosition, setSpotlightPosition] = useState<SpotlightPosition | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const trackColor = useColorModeValue('secondaryGray.400', 'whiteAlpha.300')

  const currentStepData = steps[currentStep]

  const handleClose = () => {
    stopOnboarding()
    markOnboardingComplete()
  }

  useEffect(() => {
    if (!isOnboarding || !currentStepData) return

    const updatePosition = () => {
      const element = document.querySelector(currentStepData.target)
      if (!element) {
        // If element not found, center the tooltip
        setSpotlightPosition(null)
        setTooltipPosition({ top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - 160 })
        return
      }

      const rect = element.getBoundingClientRect()
      const padding = 8
      setSpotlightPosition({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      })

      let top = rect.top
      let left = rect.right + 20
      switch (currentStepData.position) {
        case 'top':
          top = rect.top - TOOLTIP_HEIGHT - 20
          left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
          break
        case 'bottom':
          top = rect.bottom + 20
          left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
          break
        case 'left':
          top = rect.top + rect.height / 2 - TOOLTIP_HEIGHT / 2
          left = rect.left - TOOLTIP_WIDTH - 20
          break
      }

      // Keep tooltip within viewport
      setTooltipPosition({
        top: Math.max(20, Math.min(top, window.innerHeight - TOOLTIP_HEIGHT - 20)),
        left: Math.max(20, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 20)),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [isOnboarding, currentStep, currentStepData])

  if (!isOnboarding || !currentStepData) return null

  return (
    <Box position="fixed" inset="0" zIndex="9999" pointerEvents="none">
      {/* SVG mask cuts a hole in the dark overlay so the highlighted element stays crisp */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightPosition && (
              <rect
                x={spotlightPosition.left}
                y={spotlightPosition.top}
                width={spotlightPosition.width}
                height={spotlightPosition.height}
                rx="12"
                ry="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0, 0, 0, 0.75)" mask="url(#spotlight-mask)" />
      </svg>

      {spotlightPosition && (
        <Box
          position="absolute"
          borderRadius="12px"
          border="3px solid"
          borderColor="brand.400"
          boxShadow="0 0 20px 5px rgba(76, 155, 79, 0.5)"
          transition="all 0.3s ease-out"
          {...spotlightPosition}
        />
      )}

      <Card position="absolute" w={`${TOOLTIP_WIDTH}px`} pointerEvents="auto" transition="all 0.3s ease-out" boxShadow="2xl" {...tooltipPosition}>
        <Flex justify="space-between" align="center">
          <Flex align="center" gap="8px">
            <Icon as={MdPlayArrow} color="brand.500" w="20px" h="20px" />
            <Heading size="sm" color={textColor}>
              {currentStepData.title}
            </Heading>
          </Flex>
          <CloseButton size="sm" onClick={handleClose} />
        </Flex>
        <Flex gap="4px" mt="10px" mb="14px">
          {steps.map((_, index) => (
            <Box key={index} h="4px" flex="1" borderRadius="full" bg={index <= currentStep ? 'brand.500' : trackColor} transition="background 0.2s" />
          ))}
        </Flex>
        <Text fontSize="sm" color="secondaryGray.600" lineHeight="tall" mb="16px">
          {currentStepData.description}
        </Text>
        <Flex justify="space-between" align="center">
          <Text fontSize="xs" color="secondaryGray.600">
            Step {currentStep + 1} of {steps.length}
          </Text>
          <Flex gap="8px">
            {currentStep > 0 && (
              <Button size="sm" variant="light" leftIcon={<MdChevronLeft />} onClick={prevStep}>
                Back
              </Button>
            )}
            <Button size="sm" variant="brand" rightIcon={currentStep === steps.length - 1 ? undefined : <MdChevronRight />} onClick={nextStep}>
              {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </Flex>
        </Flex>
      </Card>
    </Box>
  )
}
