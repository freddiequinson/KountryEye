import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Box, Button, Flex, Icon, Input, Select, Stack, Text, Textarea, useColorModeValue } from '@chakra-ui/react'
import { MdArrowBack, MdWarningAmber } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import SectionCard from '@/components/card/SectionCard'
import { AppModal, Field } from '@/components/ui'

interface DuplicateCandidate {
  id: number
  patient_number: string
  first_name: string
  last_name: string
  phone: string
  date_of_birth: string
  match_score: number
}

const calculateAge = (dob: string) => {
  const today = new Date()
  const birthDate = new Date(dob)
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return `${age} years`
}

export default function PatientRegistrationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')

  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([])

  const [formData, setFormData] = useState({
    // Prefilled values from URL params
    first_name: searchParams.get('firstName') || '',
    last_name: searchParams.get('lastName') || '',
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
    branch_id: 1,
  })

  const set = (key: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData({ ...formData, [key]: e.target.value })

  const registerPatientMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const cleanedData: Record<string, any> = { ...data }
      if (!cleanedData.sex) delete cleanedData.sex
      if (!cleanedData.marital_status) delete cleanedData.marital_status
      if (!cleanedData.date_of_birth) delete cleanedData.date_of_birth
      if (!cleanedData.email) delete cleanedData.email
      return api.post('/patients', cleanedData)
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast({ title: 'Patient registered successfully' })
      // Navigate to front desk with the new patient pre-selected for visit recording
      navigate('/frontdesk', {
        state: {
          openVisitDialog: true,
          selectedPatient: {
            id: response.data.id,
            patient_number: response.data.patient_number,
            first_name: response.data.first_name,
            last_name: response.data.last_name,
            phone: response.data.phone,
          },
        },
      })
    },
    onError: () => {
      toast({ title: 'Failed to register patient', variant: 'destructive' })
    },
  })

  const checkDuplicatesMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/patients/check-duplicates', data),
    onSuccess: (response) => {
      if (response.data.length > 0) {
        setDuplicateCandidates(response.data)
        setShowDuplicateDialog(true)
      } else {
        registerPatientMutation.mutate(formData)
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.first_name || !formData.last_name) {
      toast({ title: 'First name and last name are required', variant: 'destructive' })
      return
    }
    checkDuplicatesMutation.mutate(formData)
  }

  const isBusy = checkDuplicatesMutation.isPending || registerPatientMutation.isPending

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate('/patients')} mb="8px">
        Back
      </Button>
      <PageHeader title="Patient Registration" description="Register a new patient" />

      <Box as="form" onSubmit={handleSubmit} maxW="672px" mx="auto">
        <Stack spacing="20px">
          <SectionCard title="Personal Information">
            <Stack spacing="16px">
              <Field label="First Name" isRequired>
                <Input variant="main" value={formData.first_name} onChange={set('first_name')} />
              </Field>
              <Field label="Surname / Last Name" isRequired>
                <Input variant="main" value={formData.last_name} onChange={set('last_name')} />
              </Field>
              <Field label="Other Names (Middle Name)">
                <Input variant="main" value={formData.other_names} onChange={set('other_names')} />
              </Field>
              <Field label="Date of Birth" helper={formData.date_of_birth && `Age: ${calculateAge(formData.date_of_birth)}`}>
                <Input variant="main" type="date" value={formData.date_of_birth} onChange={set('date_of_birth')} />
              </Field>
              <Field label="Sex">
                <Select variant="main" placeholder="Select sex" value={formData.sex} onChange={set('sex')}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </Select>
              </Field>
              <Field label="Marital Status">
                <Select variant="main" placeholder="Select marital status" value={formData.marital_status} onChange={set('marital_status')}>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </Select>
              </Field>
              <Field label="Nationality">
                <Input variant="main" value={formData.nationality} onChange={set('nationality')} />
              </Field>
              <Field label="Occupation">
                <Input variant="main" value={formData.occupation} onChange={set('occupation')} />
              </Field>
              <Field label="Ghana Card Number">
                <Input variant="main" placeholder="GHA-XXXXXXXXX-X" value={formData.ghana_card} onChange={set('ghana_card')} />
              </Field>
            </Stack>
          </SectionCard>

          <SectionCard title="Contact Information">
            <Stack spacing="16px">
              <Field label="Phone Number">
                <Input variant="main" placeholder="+233 XX XXX XXXX" value={formData.phone} onChange={set('phone')} />
              </Field>
              <Field label="Email">
                <Input variant="main" type="email" value={formData.email} onChange={set('email')} />
              </Field>
              <Field label="Address">
                <Textarea variant="main" placeholder="Full address" value={formData.address} onChange={set('address')} />
              </Field>
            </Stack>
          </SectionCard>

          <SectionCard title="Emergency Contact / Next of Kin">
            <Stack spacing="16px">
              <Field label="Name">
                <Input variant="main" value={formData.emergency_contact_name} onChange={set('emergency_contact_name')} />
              </Field>
              <Field label="Phone Number">
                <Input variant="main" value={formData.emergency_contact_phone} onChange={set('emergency_contact_phone')} />
              </Field>
            </Stack>
          </SectionCard>

          <Flex justify="end" gap="12px">
            <Button variant="light" onClick={() => navigate('/frontdesk')}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" isLoading={isBusy} loadingText="Processing...">
              Register Patient
            </Button>
          </Flex>
        </Stack>
      </Box>

      <AppModal
        isOpen={showDuplicateDialog}
        onClose={() => setShowDuplicateDialog(false)}
        size="lg"
        title={
          <Flex align="center" gap="8px">
            <Icon as={MdWarningAmber} color="yellow.500" />
            Possible Duplicate Found
          </Flex>
        }
        footer={
          <>
            <Button
              variant="light"
              onClick={() => {
                setShowDuplicateDialog(false)
                registerPatientMutation.mutate(formData)
              }}
            >
              Register as New Patient
            </Button>
            <Button variant="brand" onClick={() => setShowDuplicateDialog(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <Text color="secondaryGray.600" mb="16px">
          We found existing patients that may match this registration. Please review:
        </Text>
        <Stack spacing="8px">
          {duplicateCandidates.map((candidate) => (
            <Box
              key={candidate.id}
              p="16px"
              border="1px solid"
              borderColor={borderColor}
              borderRadius="12px"
              cursor="pointer"
              _hover={{ bg: hoverBg }}
              onClick={() => {
                setShowDuplicateDialog(false)
                navigate(`/patients/${candidate.id}`)
              }}
            >
              <Flex justify="space-between" align="start">
                <Box>
                  <Text as="span" fontWeight="500">
                    {candidate.first_name} {candidate.last_name}
                  </Text>
                  <Badge variant="outline" ms="8px">
                    {candidate.patient_number}
                  </Badge>
                </Box>
                <Badge colorScheme={candidate.match_score > 80 ? 'red' : 'yellow'}>{candidate.match_score}% match</Badge>
              </Flex>
              <Text fontSize="sm" color="secondaryGray.600" mt="4px">
                {candidate.phone && <span>Phone: {candidate.phone}</span>}
                {candidate.date_of_birth && <span style={{ marginLeft: 16 }}>DOB: {candidate.date_of_birth}</span>}
              </Text>
            </Box>
          ))}
        </Stack>
      </AppModal>
    </>
  )
}
