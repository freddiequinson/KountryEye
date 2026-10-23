import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { keyframes } from '@emotion/react'
import { Alert, AlertIcon, Box, Button, Flex, Heading, Icon, Image, Stack, Text, useColorModeValue } from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import { MdArrowBack, MdArrowForward, MdBadge, MdCheck, MdContactEmergency, MdFactCheck, MdPerson, MdPhone } from 'react-icons/md'
import { formatDate } from '@/components/DateField'
import { CLINIC_CONTACT } from '@/components/IntakeSheet'
import { calculateAge, emptyPatientIntake, PatientIntakeFields, type IntakeGroup, type PatientIntake } from '@/components/PatientIntakeFields'

// One question group per screen; the last step reads everything back before it is sent.
const STEPS: { group?: IntakeGroup; icon: IconType; name: string; title: string; hint: string }[] = [
  { group: 'identity', icon: MdPerson, name: 'About you', title: 'Tell us who you are', hint: 'Your name as it appears on your ID.' },
  { group: 'background', icon: MdBadge, name: 'Background', title: 'A little more about you', hint: 'These help us complete your record. Skip any you prefer not to answer.' },
  { group: 'contact', icon: MdPhone, name: 'Contact', title: 'How can we reach you?', hint: 'We use this for appointment reminders and follow-ups.' },
  { group: 'emergency', icon: MdContactEmergency, name: 'Emergency contact', title: 'Who should we call in an emergency?', hint: 'A relative or friend. You can skip this.' },
  { icon: MdFactCheck, name: 'Review', title: 'Check your details', hint: 'Use Edit to change anything, then submit.' },
]

// What the review step reads back, and which step each block is edited on
const REVIEW: { title: string; step: number; rows: [string, keyof PatientIntake][] }[] = [
  {
    title: 'About you',
    step: 0,
    rows: [
      ['First name', 'first_name'],
      ['Surname', 'last_name'],
      ['Date of birth', 'date_of_birth'],
      ['Sex', 'sex'],
    ],
  },
  {
    title: 'Background',
    step: 1,
    rows: [
      ['Marital status', 'marital_status'],
      ['Nationality', 'nationality'],
      ['Occupation', 'occupation'],
      ['Ghana Card', 'ghana_card'],
    ],
  },
  {
    title: 'Contact',
    step: 2,
    rows: [
      ['Phone', 'phone'],
      ['Email', 'email'],
      ['Address', 'address'],
    ],
  },
  {
    title: 'Emergency contact',
    step: 3,
    rows: [
      ['Name', 'emergency_contact_name'],
      ['Phone', 'emergency_contact_phone'],
    ],
  },
]

const rise = keyframes`from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; }`
const GREEN = 'linear-gradient(160deg, #0B2415 0%, #14472A 50%, #2F7A3F 100%)'

// Public form patients fill in on their own phones, as a step-by-step wizard. Front desk reviews what they send.
export default function PatientSelfRegisterPage() {
  const [submitted, setSubmitted] = useState(false)
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState(emptyPatientIntake)
  const pageBg = useColorModeValue('secondaryGray.300', 'navy.900')
  const cardBg = useColorModeValue('white', 'navy.800')
  const barBg = useColorModeValue('rgba(255,255,255,0.94)', 'rgba(17,28,68,0.94)')
  const border = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const current = STEPS[step]
  const isLastStep = step === STEPS.length - 1

  const submitMutation = useMutation({
    mutationFn: (data: typeof formData) => axios.post('/api/v1/patients/self-register', data),
    onSuccess: () => setSubmitted(true),
  })

  const goTo = (next: number) => {
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  // Each step is its own submit, so the browser checks that step's required fields before moving on.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLastStep) submitMutation.mutate(formData)
    else goTo(step + 1)
  }

  return (
    <Flex minH="100vh" bg={pageBg} direction={{ base: 'column', lg: 'row' }}>
      {/* Green side panel: welcome and the list of steps. On phones it folds into a short band with a progress line. */}
      <Flex
        position={{ base: 'relative', lg: 'sticky' }}
        top="0"
        h={{ lg: '100vh' }}
        w={{ base: '100%', lg: '400px' }}
        flexShrink={0}
        direction="column"
        overflow="hidden"
        color="white"
        bg={GREEN}
        px={{ base: '20px', lg: '40px' }}
        pt={{ base: '18px', lg: '40px' }}
        pb={{ base: '18px', lg: '32px' }}
        borderBottomRadius={{ base: '24px', lg: '0' }}
        sx={{ '& > *:not([data-deco])': { position: 'relative' } }}
      >
        <Box data-deco position="absolute" top="-120px" right="-90px" w="340px" h="340px" borderRadius="full" border="1px solid rgba(255,255,255,0.08)" />
        <Box data-deco position="absolute" bottom="-70px" left="20%" w="240px" h="240px" borderRadius="full" bg="rgba(12, 192, 223, 0.2)" filter="blur(60px)" />

        <Flex align="center" justify="space-between" gap="12px">
          <Box bg="white" borderRadius="10px" px="10px" py="6px">
            <Image src="/kountry-logo.png" alt="Kountry Eyecare" h={{ base: '28px', lg: '36px' }} />
          </Box>
          {!submitted && (
            <Text display={{ lg: 'none' }} fontSize="13px" fontWeight="700" color="whiteAlpha.900">
              Step {step + 1} of {STEPS.length}
            </Text>
          )}
        </Flex>

        <Box display={{ base: 'none', lg: 'block' }} mt="44px">
          <Heading fontSize="30px" fontWeight="800" lineHeight="1.15" letterSpacing="-0.02em">
            Welcome to Kountry Eyecare
          </Heading>
          <Text mt="10px" fontWeight="500" color="whiteAlpha.800">
            Register in about two minutes. Our front desk will confirm your details when you arrive.
          </Text>
        </Box>

        {!submitted && (
          <>
            <Flex display={{ base: 'flex', lg: 'none' }} gap="6px" mt="14px">
              {STEPS.map((s, index) => (
                <Box key={s.name} flex="1" h="5px" borderRadius="full" bg={index <= step ? 'white' : 'whiteAlpha.300'} transition="background .25s ease" />
              ))}
            </Flex>

            <Stack display={{ base: 'none', lg: 'flex' }} spacing="0" mt="40px">
              {STEPS.map((s, index) => {
                const done = index < step
                const active = index === step
                return (
                  <Flex key={s.name} gap="14px" opacity={done || active ? 1 : 0.6}>
                    <Flex direction="column" align="center">
                      <Flex
                        w="34px"
                        h="34px"
                        borderRadius="full"
                        align="center"
                        justify="center"
                        fontSize="13px"
                        fontWeight="800"
                        bg={active ? 'white' : done ? 'whiteAlpha.300' : 'transparent'}
                        color={active ? 'brand.700' : 'white'}
                        border="1.5px solid"
                        borderColor={active ? 'white' : 'whiteAlpha.500'}
                        transition="all .2s ease"
                      >
                        {done ? <Icon as={MdCheck} w="18px" h="18px" /> : index + 1}
                      </Flex>
                      {index < STEPS.length - 1 && <Box w="1.5px" h="26px" bg={done ? 'whiteAlpha.700' : 'whiteAlpha.300'} />}
                    </Flex>
                    <Text fontWeight={active ? '800' : '600'} pt="6px">
                      {s.name}
                    </Text>
                  </Flex>
                )
              })}
            </Stack>
          </>
        )}

        <Text display={{ base: 'none', lg: 'block' }} mt="auto" fontSize="13px" fontWeight="500" color="whiteAlpha.800">
          Need help? Ask at the front desk or call {CLINIC_CONTACT.phone}
        </Text>
      </Flex>

      {submitted ? (
        <Flex flex="1" align="center" justify="center" px="20px" py="40px">
          <Flex direction="column" align="center" textAlign="center" w="100%" maxW="480px" bg={cardBg} borderRadius="24px" boxShadow="card" px="28px" py="44px" animation={`${rise} .35s ease`}>
            <Flex position="relative" w="96px" h="96px" align="center" justify="center" mb="20px">
              <Box position="absolute" inset="0" borderRadius="full" bg="brand.50" _dark={{ bg: 'whiteAlpha.100' }} />
              <Flex position="relative" w="64px" h="64px" borderRadius="full" bg="brand.600" color="white" align="center" justify="center" boxShadow="0 12px 24px -10px rgba(62,129,65,0.8)">
                <Icon as={MdCheck} w="36px" h="36px" />
              </Flex>
            </Flex>
            <Heading as="h1" fontSize="26px" fontWeight="800" mb="8px">
              You're registered{formData.first_name && `, ${formData.first_name}`}
            </Heading>
            <Text fontWeight="500" color="secondaryGray.600">
              Thank you for registering with Kountry Eyecare. Our front desk team will review your information shortly.
            </Text>
            <Box mt="22px" px="16px" py="12px" borderRadius="14px" bg="brand.50" color="brand.700" _dark={{ bg: 'whiteAlpha.100', color: 'white' }} fontWeight="700" fontSize="sm">
              Please proceed to the front desk when called.
            </Box>
          </Flex>
        </Flex>
      ) : (
        <Flex as="form" onSubmit={handleSubmit} flex="1" minW="0" direction="column" align="center" justify={{ lg: 'center' }} px={{ base: '14px', md: '32px' }} pt={{ base: '18px', lg: '40px' }} pb={{ lg: '40px' }}>
          <Box key={step} w="100%" maxW="640px" bg={cardBg} borderRadius="24px" boxShadow="card" _dark={{ boxShadow: 'none' }} px={{ base: '20px', md: '36px' }} py={{ base: '24px', md: '34px' }} animation={`${rise} .3s ease`}>
            <Flex align="center" gap="14px" mb="22px">
              <Flex w="48px" h="48px" minW="48px" borderRadius="14px" bg="brand.50" color="brand.600" _dark={{ bg: 'whiteAlpha.100', color: 'brand.300' }} align="center" justify="center">
                <Icon as={current.icon} w="24px" h="24px" />
              </Flex>
              <Box minW="0">
                <Heading as="h1" fontSize={{ base: '22px', md: '26px' }} fontWeight="800" letterSpacing="-0.02em" lineHeight="1.2" data-tour="page-title">
                  {current.title}
                </Heading>
                <Text color="secondaryGray.600" fontWeight="500" fontSize="sm" mt="3px">
                  {current.hint}
                </Text>
              </Box>
            </Flex>

            {current.group ? (
              // Larger controls than the staff forms: this one is filled in on a phone
              <Box sx={{ 'input, select': { h: '50px', fontSize: 'md', borderRadius: '12px' }, textarea: { fontSize: 'md', borderRadius: '12px' } }}>
                <PatientIntakeFields selfService group={current.group} data={formData} onChange={(key, value) => setFormData({ ...formData, [key]: value })} />
              </Box>
            ) : (
              <Stack spacing="12px">
                {REVIEW.map((section) => {
                  const filled = section.rows.filter(([, key]) => formData[key])
                  return (
                    <Box key={section.title} border="1px solid" borderColor={border} borderRadius="16px" px="16px" py="12px">
                      <Flex justify="space-between" align="center" mb="4px">
                        <Text fontSize="12px" fontWeight="800" letterSpacing="0.05em" textTransform="uppercase" color="brand.600" _dark={{ color: 'brand.300' }}>
                          {section.title}
                        </Text>
                        <Button variant="link" colorScheme="brandScheme" fontSize="13px" onClick={() => goTo(section.step)}>
                          Edit
                        </Button>
                      </Flex>
                      {filled.length === 0 ? (
                        <Text fontSize="sm" color="secondaryGray.600" py="4px">
                          Not provided
                        </Text>
                      ) : (
                        filled.map(([label, key]) => (
                          <Flex key={key} justify="space-between" gap="16px" py="5px" fontSize="sm">
                            <Text color="secondaryGray.600" fontWeight="500" flexShrink={0}>
                              {label}
                            </Text>
                            <Text fontWeight="700" textAlign="right" textTransform={key === 'sex' || key === 'marital_status' ? 'capitalize' : undefined} overflowWrap="anywhere">
                              {key === 'date_of_birth' ? `${formatDate(formData[key])} (${calculateAge(formData[key])})` : formData[key]}
                            </Text>
                          </Flex>
                        ))
                      )}
                    </Box>
                  )
                })}
              </Stack>
            )}

            {submitMutation.isError && (
              <Alert status="error" borderRadius="16px" fontSize="sm" mt="20px">
                <AlertIcon />
                Failed to submit. Please try again or inform the front desk.
              </Alert>
            )}

            {/* Desktop: Back / Next close the card */}
            <Flex display={{ base: 'none', lg: 'flex' }} gap="10px" mt="30px">
              {step > 0 && (
                <Button variant="light" size="lg" leftIcon={<MdArrowBack />} onClick={() => goTo(step - 1)}>
                  Back
                </Button>
              )}
              <Button type="submit" variant="brand" size="lg" ms="auto" minW="180px" rightIcon={isLastStep ? undefined : <MdArrowForward />} isLoading={submitMutation.isPending} loadingText="Submitting...">
                {isLastStep ? 'Submit registration' : 'Next'}
              </Button>
            </Flex>
          </Box>

          {/* Phone: Back / Next stay within thumb reach */}
          <Flex display={{ base: 'flex', lg: 'none' }} position="sticky" bottom="0" w="calc(100% + 28px)" mt="auto" gap="10px" px="14px" py="12px" bg={barBg} backdropFilter="blur(12px)" borderTop="1px solid" borderColor={border}>
            {step > 0 && (
              <Button variant="light" size="lg" leftIcon={<MdArrowBack />} onClick={() => goTo(step - 1)}>
                Back
              </Button>
            )}
            <Button type="submit" variant="brand" size="lg" flex="1" rightIcon={isLastStep ? undefined : <MdArrowForward />} isLoading={submitMutation.isPending} loadingText="Submitting...">
              {isLastStep ? 'Submit registration' : 'Next'}
            </Button>
          </Flex>
        </Flex>
      )}
    </Flex>
  )
}
