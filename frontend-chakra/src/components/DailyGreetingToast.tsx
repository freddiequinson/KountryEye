import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Flex,
  Heading,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { MdAccessTime, MdMenuBook } from 'react-icons/md'
import { useAuthStore } from '@/stores/auth'
import { useOnboarding } from '@/contexts/OnboardingContext'
import api from '@/lib/api'

const FALLBACK_QUOTES = [
  { verse: 'Jeremiah 29:11', text: 'For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future.' },
  { verse: 'Philippians 4:13', text: 'I can do all things through Christ who strengthens me.' },
  { verse: 'Proverbs 3:5-6', text: 'Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.' },
  { verse: 'Isaiah 41:10', text: 'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you.' },
  { verse: 'Psalm 23:1', text: 'The LORD is my shepherd, I lack nothing.' },
]

function getFallbackQuote(): { verse: string; text: string } {
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
  return FALLBACK_QUOTES[dayOfYear % FALLBACK_QUOTES.length]
}

function getStorageKey(userId: number): string {
  const today = new Date().toISOString().split('T')[0]
  return `daily_greeting_shown_${userId}_${today}`
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DailyGreetingToast() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { isOnboarding } = useOnboarding()
  const [isVisible, setIsVisible] = useState(false)
  const [quote, setQuote] = useState<{ verse: string; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const tint = useColorModeValue('brand.50', 'whiteAlpha.100')

  useEffect(() => {
    if (!user?.id) return
    // Don't show greeting while onboarding is active - wait for it to complete
    if (isOnboarding) return
    if (localStorage.getItem(getStorageKey(user.id))) return

    // Fetch verse from API (Groq-powered)
    api
      .get('/daily-verse')
      .then((response) => setQuote({ verse: response.data.verse, text: response.data.text }))
      .catch(() => setQuote(getFallbackQuote()))
      .finally(() => setIsLoading(false))

    const timer = setTimeout(() => setIsVisible(true), 500)
    return () => clearTimeout(timer)
  }, [user?.id, isOnboarding])

  const handleDismiss = () => {
    if (user?.id) localStorage.setItem(getStorageKey(user.id), 'true')
    setIsVisible(false)
  }

  const handleStartDay = () => {
    handleDismiss()
    navigate('/attendance')
  }

  if (!user) return null

  return (
    <Modal isOpen={isVisible} onClose={handleDismiss} isCentered size="xl" motionPreset="scale">
      <ModalOverlay backdropFilter="blur(8px)" bg="blackAlpha.300" />
      <ModalContent borderRadius="20px" mx="16px">
        <ModalHeader bgGradient={`linear(to-r, ${tint}, transparent)`} borderTopRadius="20px" py="24px">
          <Heading size="lg" color={textColor} mb="4px">
            {getGreeting()}, {user.first_name}!
          </Heading>
          <Text fontSize="sm" fontWeight="normal" color="secondaryGray.600">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </ModalHeader>
        <ModalCloseButton top="20px" />
        <ModalBody py="24px">
          <Flex gap="16px" p="20px" bg={tint} borderRadius="16px" mb="24px">
            <Flex p="8px" bg="brand.500" borderRadius="12px" h="fit-content">
              <Icon as={MdAccessTime} color="white" w="24px" h="24px" />
            </Flex>
            <Box>
              <Text fontWeight="600" color={textColor} mb="2px">
                Remember to clock in
              </Text>
              <Text fontSize="sm" color="secondaryGray.600">
                Don't forget to mark your attendance for today.
              </Text>
            </Box>
          </Flex>

          <Flex align="center" gap="10px" mb="12px" color="secondaryGray.600">
            <Icon as={MdMenuBook} color="brand.500" w="20px" h="20px" />
            <Text fontSize="sm" fontWeight="600" textTransform="uppercase" letterSpacing="wider">
              Today's Inspiration
            </Text>
          </Flex>
          {isLoading ? (
            <Flex justify="center" py="32px">
              <Spinner color="brand.500" size="lg" />
            </Flex>
          ) : (
            quote && (
              <Box borderLeft="4px solid" borderColor="brand.300" ps="20px" py="12px">
                <Text fontStyle="italic" fontWeight="500" color={textColor} lineHeight="tall">
                  "{quote.text}"
                </Text>
                <Text mt="10px" fontSize="sm" fontWeight="600" color="brand.500">
                  — {quote.verse}
                </Text>
              </Box>
            )
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="brand" w="100%" h="50px" onClick={handleStartDay}>
            Start My Day
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
