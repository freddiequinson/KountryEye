import type { ReactNode } from 'react'
import { Box, Flex, Heading, Image, Radio, RadioGroup, SimpleGrid, Text, useColorModeValue, type BoxProps, type FormControlProps, type SimpleGridProps } from '@chakra-ui/react'
import { Field } from '@/components/ui'

export const CLINIC_CONTACT = { phone: '+233 54 848 1866', email: 'kountryeyecare@gmail.com' }

// Corner decoration: a cyan field edged with a green ribbon. Drawn for the top-right corner; rotate it for the opposite one.
function Wave(props: BoxProps) {
  return (
    <Box as="svg" viewBox="0 0 300 110" preserveAspectRatio="none" position="absolute" pointerEvents="none" aria-hidden {...props}>
      <Box as="path" d="M60 0 C150 4 190 64 300 80 L300 62 C200 54 160 6 100 0 Z" fill="brand.600" />
      <Box as="path" d="M100 0 C160 6 200 54 300 62 L300 0 Z" fill="secondary.300" _dark={{ fill: 'secondary.700' }} />
    </Box>
  )
}

// The patient intake "paper": logo, title in brand green, wave corners and the clinic's contact line.
// Fill it with IntakeSection blocks. The heading carries data-tour="page-title" for the onboarding tours.
export function IntakeSheet({
  title,
  description,
  aside,
  children,
  ...rest
}: Omit<BoxProps, 'title'> & { title: ReactNode; description?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  const bg = useColorModeValue('white', 'navy.800')
  const border = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  return (
    <Box position="relative" overflow="hidden" bg={bg} border="1px solid" borderColor={border} borderRadius="20px" boxShadow="card" _dark={{ boxShadow: 'none' }} {...rest}>
      <Wave top="0" right="0" w={{ base: '62%', md: '56%' }} h={{ base: '64px', md: '110px' }} />
      <Wave bottom="0" left="0" w={{ base: '42%', md: '56%' }} h={{ base: '48px', md: '110px' }} transform="rotate(180deg)" />

      <Box position="relative" px={{ base: '20px', md: '44px' }} pt={{ base: '22px', md: '34px' }} pb={{ base: '68px', md: '104px' }}>
        <Box w="fit-content" borderRadius="10px" _dark={{ bg: 'white', px: '10px', py: '6px' }}>
          <Image src="/kountry-logo.png" alt="Kountry Eyecare" h={{ base: '34px', md: '42px' }} />
        </Box>
        <Flex justify="space-between" align="end" gap="12px" wrap="wrap" mt={{ base: '22px', md: '30px' }}>
          <Heading as="h1" fontSize={{ base: '26px', md: '34px' }} fontWeight="800" letterSpacing="-0.02em" lineHeight="1.15" color="brand.600" _dark={{ color: 'brand.300' }} data-tour="page-title">
            {title}
          </Heading>
          {aside}
        </Flex>
        {description && (
          <Text as="div" color="secondaryGray.600" fontSize="md" fontWeight="500" mt="6px">
            {description}
          </Text>
        )}
        <Box mt="26px">{children}</Box>
      </Box>

      <Text position="absolute" bottom={{ base: '16px', md: '26px' }} right={{ base: '20px', md: '44px' }} fontSize="12px" fontWeight="700">
        {CLINIC_CONTACT.phone}
        <Text as="span" display={{ base: 'none', md: 'inline' }}>
          {'  ·  '}
          {CLINIC_CONTACT.email}
        </Text>
      </Text>
    </Box>
  )
}

// A numbered block of an intake form: "1. Patient information" in brand green over a grid of fields.
// Also used on its own inside pop-ups, so the short forms read like the full sheet. Leave the title out for just the field grid.
export function IntakeSection({
  number,
  title,
  description,
  columns = { base: 1, md: 2 },
  children,
}: {
  number?: number
  title?: ReactNode
  description?: ReactNode
  columns?: SimpleGridProps['columns']
  children: ReactNode
}) {
  const labelColor = useColorModeValue('secondaryGray.900', 'white')
  return (
    <Box mt="30px" _first={{ mt: '0' }}>
      {title && (
        <Text as="h2" fontSize={{ base: '18px', md: '20px' }} fontWeight="800" lineHeight="1.25" color="brand.600" _dark={{ color: 'brand.300' }}>
          {number ? `${number}. ` : ''}
          {title}
        </Text>
      )}
      {description && (
        <Text fontSize="13px" fontWeight="500" color="secondaryGray.600" mt="3px">
          {description}
        </Text>
      )}
      <SimpleGrid columns={columns} spacingX="20px" spacingY="18px" mt={title || description ? '16px' : '0'} sx={{ '.chakra-form__label': { fontWeight: '700', color: labelColor } }}>
        {children}
      </SimpleGrid>
    </Box>
  )
}

// Dotted rule between groups of fields inside an IntakeSection.
export function IntakeDivider() {
  return <Box gridColumn="1 / -1" borderTop="2px dotted" borderColor="secondaryGray.500" _dark={{ borderColor: 'whiteAlpha.400' }} my="6px" />
}

// Radio choices on one line, as on the paper form (sex, yes/no).
export function ChoiceField({
  label,
  value,
  onChange,
  options,
  ...rest
}: Omit<FormControlProps, 'onChange' | 'label'> & { label: ReactNode; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Field label={label} {...rest}>
      <RadioGroup value={value} onChange={onChange}>
        <Flex gap="20px" wrap="wrap" align="center" minH="42px">
          {options.map((option) => (
            <Radio key={option.value} value={option.value} borderColor="secondaryGray.600">
              {option.label}
            </Radio>
          ))}
        </Flex>
      </RadioGroup>
    </Field>
  )
}
