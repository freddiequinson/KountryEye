import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Avatar, Badge, Box, Button, Flex, Grid, Icon, Stack, Text, useColorModeValue } from '@chakra-ui/react'
import { MdArrowBack, MdInfoOutline, MdWarningAmber } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import Card from '@/components/card/Card'
import { FormActions } from '@/components/FormSection'
import { IntakeSheet } from '@/components/IntakeSheet'
import { calculateAge, emptyPatientIntake, PatientIntakeFields } from '@/components/PatientIntakeFields'
import { AppModal } from '@/components/ui'

interface DuplicateCandidate {
  id: number
  patient_number: string
  first_name: string
  last_name: string
  phone: string
  date_of_birth: string
  match_score: number
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
    ...emptyPatientIntake,
    // Prefilled values from URL params
    first_name: searchParams.get('firstName') || '',
    last_name: searchParams.get('lastName') || '',
    branch_id: 1,
  })

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
  const previewName = `${formData.first_name} ${formData.last_name}`.trim()
  const previewRing = useColorModeValue('white', 'navy.800')

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate('/patients')} mb="8px">
        Back
      </Button>
      <Box as="form" onSubmit={handleSubmit}>
        <Grid templateColumns={{ base: '1fr', xl: '1fr 300px' }} gap="20px" alignItems="start">
          <IntakeSheet
            title="Patient Intake Form"
            description="Only the name is required; the rest can be filled in later."
            aside={
              <Text fontSize="sm" fontWeight="700">
                <Text as="span" color="secondaryGray.600" fontWeight="500">
                  Date{' '}
                </Text>
                {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            }
          >
            <PatientIntakeFields data={formData} onChange={(key, value) => setFormData({ ...formData, [key]: value })} />
          </IntakeSheet>

          {/* Live preview of the record being created */}
          <Card position={{ xl: 'sticky' }} top={{ xl: '96px' }} p="0" overflow="hidden" display={{ base: 'none', xl: 'flex' }}>
            <Box h="72px" bg="linear-gradient(120deg, #14472A 0%, #3E8141 100%)" />
            <Flex direction="column" align="center" px="20px" pb="20px" mt="-34px" textAlign="center">
              <Avatar size="lg" name={previewName || undefined} bg="brand.600" color="white" border="4px solid" borderColor={previewRing} />
              <Text fontWeight="700" fontSize="16px" mt="10px" noOfLines={2}>
                {previewName || 'New patient'}
              </Text>
              <Text fontSize="13px" fontWeight="500" color="secondaryGray.600">
                Patient number is assigned on save
              </Text>
              <Stack w="100%" spacing="0" mt="16px" textAlign="left">
                {[
                  ['Age', formData.date_of_birth ? calculateAge(formData.date_of_birth) : '-'],
                  ['Sex', formData.sex || '-'],
                  ['Phone', formData.phone || '-'],
                  ['Emergency', formData.emergency_contact_name || '-'],
                ].map(([label, value]) => (
                  <Flex key={label} justify="space-between" gap="12px" py="9px" borderTop="1px dashed" borderColor={borderColor} fontSize="13px">
                    <Text color="secondaryGray.600" fontWeight="500">
                      {label}
                    </Text>
                    <Text fontWeight="700" textTransform="capitalize" noOfLines={1}>
                      {value}
                    </Text>
                  </Flex>
                ))}
              </Stack>
              <Flex w="100%" gap="8px" mt="14px" p="10px" borderRadius="10px" bg="brand.50" _dark={{ bg: 'whiteAlpha.100' }} textAlign="left">
                <Icon as={MdInfoOutline} color="brand.600" mt="2px" flexShrink={0} />
                <Text fontSize="12px" fontWeight="500" color="secondaryGray.700" _dark={{ color: 'secondaryGray.400' }}>
                  We check for existing patients with the same details before saving.
                </Text>
              </Flex>
            </Flex>
          </Card>
        </Grid>

        <FormActions hint="After saving you go straight to recording the visit.">
          <Button variant="light" onClick={() => navigate('/frontdesk')}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" isLoading={isBusy} loadingText="Processing...">
            Register Patient
          </Button>
        </FormActions>
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
