import { useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import {
  Alert,
  AlertIcon,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  Input,
  Select,
  Stack,
  Text,
  Textarea,
  useColorModeValue,
} from '@chakra-ui/react'
import { MdCheckCircle } from 'react-icons/md'
import AuthLayout, { AuthForm } from '@/layouts/auth/AuthLayout'
import Card from '@/components/card/Card'

const emptyForm = {
  first_name: '',
  last_name: '',
  other_names: '',
  date_of_birth: '',
  sex: '',
  marital_status: '',
  phone: '',
  email: '',
  address: '',
  nationality: 'Ghanaian',
  occupation: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  ghana_card: '',
}

const calculateAge = (dob: string) => {
  const today = new Date()
  const birthDate = new Date(dob)
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return `${age} years`
}

const digits10 = (value: string) => value.replace(/\D/g, '').slice(0, 10)

export default function PatientSelfRegisterPage() {
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState(emptyForm)
  const textColor = useColorModeValue('secondaryGray.900', 'white')

  const set = (key: keyof typeof emptyForm) => (value: string) => setFormData({ ...formData, [key]: value })

  const submitMutation = useMutation({
    mutationFn: (data: typeof formData) => axios.post('/api/v1/patients/self-register', data),
    onSuccess: () => setSubmitted(true),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitMutation.mutate(formData)
  }

  const field = (label: string, control: ReactNode, required = false) => (
    <FormControl isRequired={required}>
      <FormLabel fontSize="sm" fontWeight="500" color={textColor} ms="4px">
        {label}
      </FormLabel>
      {control}
    </FormControl>
  )

  const section = (title: string, children: ReactNode, subtitle?: string) => (
    <Card>
      <Heading size="md" color={textColor} mb={subtitle ? '4px' : '16px'}>
        {title}
      </Heading>
      {subtitle && (
        <Text fontSize="sm" color="secondaryGray.600" mb="16px">
          {subtitle}
        </Text>
      )}
      <Stack spacing="16px">{children}</Stack>
    </Card>
  )

  if (submitted) {
    return (
      <AuthLayout>
        <AuthForm title="Registration Submitted!" subtitle="Thank you for registering with Kountry Eyecare.">
          <Flex direction="column" align="start" gap="12px">
            <Icon as={MdCheckCircle} w="64px" h="64px" color="green.500" />
            <Text color={textColor}>Our front desk team will review your information shortly.</Text>
            <Text fontSize="sm" color="secondaryGray.600">
              Please proceed to the front desk when called.
            </Text>
          </Flex>
        </AuthForm>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthForm title="Patient Registration" subtitle="Fields marked with * are required">
        <form onSubmit={handleSubmit}>
          <Stack spacing="20px">
            {section(
              'Personal Information',
              <>
                {field('First Name', <Input variant="main" value={formData.first_name} onChange={(e) => set('first_name')(e.target.value)} />, true)}
                {field('Surname / Last Name', <Input variant="main" value={formData.last_name} onChange={(e) => set('last_name')(e.target.value)} />, true)}
                {field('Other Names (Middle Name)', <Input variant="main" value={formData.other_names} onChange={(e) => set('other_names')(e.target.value)} />)}
                {field(
                  'Date of Birth',
                  <>
                    <Input variant="main" type="date" value={formData.date_of_birth} onChange={(e) => set('date_of_birth')(e.target.value)} />
                    {formData.date_of_birth && (
                      <Text fontSize="sm" color="secondaryGray.600" mt="4px" ms="4px">
                        Age: {calculateAge(formData.date_of_birth)}
                      </Text>
                    )}
                  </>,
                )}
                {field(
                  'Sex',
                  <Select variant="main" placeholder="Select sex" value={formData.sex} onChange={(e) => set('sex')(e.target.value)}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </Select>,
                )}
                {field(
                  'Marital Status',
                  <Select variant="main" placeholder="Select marital status" value={formData.marital_status} onChange={(e) => set('marital_status')(e.target.value)}>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </Select>,
                )}
                {field('Nationality', <Input variant="main" value={formData.nationality} onChange={(e) => set('nationality')(e.target.value)} />)}
                {field('Occupation', <Input variant="main" value={formData.occupation} onChange={(e) => set('occupation')(e.target.value)} />)}
                {field('Ghana Card Number', <Input variant="main" placeholder="GHA-XXXXXXXXX-X" value={formData.ghana_card} onChange={(e) => set('ghana_card')(e.target.value)} />)}
              </>,
            )}

            {section(
              'Contact Information',
              <>
                {field(
                  'Phone Number',
                  <Input variant="main" maxLength={10} placeholder="0200000000" value={formData.phone} onChange={(e) => set('phone')(digits10(e.target.value))} />,
                  true,
                )}
                {field('Email', <Input variant="main" type="email" value={formData.email} onChange={(e) => set('email')(e.target.value)} />)}
                {field('Address', <Textarea variant="main" placeholder="Full address" value={formData.address} onChange={(e) => set('address')(e.target.value)} />)}
              </>,
            )}

            {section(
              'Emergency Contact / Next of Kin',
              <>
                {field('Name', <Input variant="main" value={formData.emergency_contact_name} onChange={(e) => set('emergency_contact_name')(e.target.value)} />)}
                {field(
                  'Phone Number',
                  <Input
                    variant="main"
                    maxLength={10}
                    placeholder="0200000000"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => set('emergency_contact_phone')(digits10(e.target.value))}
                  />,
                )}
              </>,
            )}

            {submitMutation.isError && (
              <Alert status="error" borderRadius="16px" fontSize="sm">
                <AlertIcon />
                Failed to submit. Please try again or inform the front desk.
              </Alert>
            )}

            <Button type="submit" variant="brand" w="100%" h="50" isLoading={submitMutation.isPending} loadingText="Submitting...">
              Submit Registration
            </Button>
          </Stack>
        </form>
      </AuthForm>
    </AuthLayout>
  )
}
