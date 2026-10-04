import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Flex, Icon, Input, InputGroup, InputLeftElement, Select, Stack, Text, Textarea } from '@chakra-ui/react'
import { MdAdd, MdApartment, MdArrowBack, MdCheck, MdDescription, MdLocalHospital, MdPerson, MdPhone, MdSearch } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import { FormActions, FormSection } from '@/components/FormSection'
import { AppModal, Field } from '@/components/ui'

interface ReferralDoctor {
  id: number
  name: string
  phone: string
  email?: string
  clinic_name?: string
  clinic_address?: string
  specialization?: string
}

const emptyDoctor = { name: '', email: '', clinic: '', address: '', specialization: '' }

export default function NewReferralPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [client, setClient] = useState({ name: '', phone: '', email: '', address: '', dob: '', sex: '' })
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [serviceFee, setServiceFee] = useState('')

  const [doctorPhone, setDoctorPhone] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState<ReferralDoctor | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [showNewDoctorDialog, setShowNewDoctorDialog] = useState(false)
  const [newDoctor, setNewDoctor] = useState(emptyDoctor)

  const lookupDoctor = async () => {
    if (!doctorPhone || doctorPhone.length < 9) {
      toast({ title: 'Invalid Phone', description: 'Please enter a valid phone number', variant: 'destructive' })
      return
    }
    setIsLookingUp(true)
    try {
      const response = await api.get(`/technician/doctors/lookup/${doctorPhone}`)
      if (response.data.found) {
        setSelectedDoctor(response.data.doctor)
        toast({ title: 'Doctor Found', description: `Found: ${response.data.doctor.name}` })
      } else {
        setSelectedDoctor(null)
        setShowNewDoctorDialog(true)
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to lookup doctor', variant: 'destructive' })
    } finally {
      setIsLookingUp(false)
    }
  }

  const createDoctorMutation = useMutation({
    mutationFn: async (data: any) => (await api.post('/technician/doctors', data)).data,
    onSuccess: (data) => {
      setSelectedDoctor({ id: data.id, name: data.name, phone: doctorPhone, clinic_name: newDoctor.clinic })
      setShowNewDoctorDialog(false)
      toast({ title: 'Success', description: 'Referring doctor added successfully' })
      setNewDoctor(emptyDoctor)
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create referring doctor', variant: 'destructive' })
    },
  })

  const createReferralMutation = useMutation({
    mutationFn: async (data: any) => (await api.post('/technician/referrals', data)).data,
    onSuccess: (data) => {
      toast({ title: 'Success', description: `Referral ${data.referral_number} created successfully` })
      queryClient.invalidateQueries({ queryKey: ['referrals'] })
      navigate(`/technician/referrals/${data.id}`)
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create referral', variant: 'destructive' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!client.name) {
      toast({ title: 'Validation Error', description: 'Client name is required', variant: 'destructive' })
      return
    }
    if (!selectedDoctor) {
      toast({ title: 'Validation Error', description: 'Please select or add a referring doctor', variant: 'destructive' })
      return
    }
    createReferralMutation.mutate({
      client_name: client.name,
      client_phone: client.phone || null,
      client_email: client.email || null,
      client_address: client.address || null,
      client_dob: client.dob || null,
      client_sex: client.sex || null,
      referral_doctor_id: selectedDoctor.id,
      reason: reason || null,
      notes: notes || null,
      service_fee: serviceFee ? parseFloat(serviceFee) : 0,
    })
  }

  const handleCreateDoctor = () => {
    if (!newDoctor.name) {
      toast({ title: 'Validation Error', description: 'Doctor name is required', variant: 'destructive' })
      return
    }
    createDoctorMutation.mutate({
      name: newDoctor.name,
      phone: doctorPhone,
      email: newDoctor.email || null,
      clinic_name: newDoctor.clinic || null,
      clinic_address: newDoctor.address || null,
      specialization: newDoctor.specialization || null,
    })
  }

  const setClientField = (key: keyof typeof client) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setClient({ ...client, [key]: e.target.value })
  const setDoctorField = (key: keyof typeof newDoctor) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNewDoctor({ ...newDoctor, [key]: e.target.value })

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate(-1)} mb="8px">
        Back
      </Button>
      <PageHeader title="New External Referral" description="Record a new referral from an external doctor" />

      <form onSubmit={handleSubmit}>
        <Card px={{ base: '18px', md: '26px' }} py="20px">
          <FormSection icon={MdLocalHospital} title="Referring doctor" description="Enter the doctor's phone number to look them up, or add a new one." columns={1}>
            <Stack spacing="16px" maxW="560px">
              <Flex gap="8px" align="end">
                <Field label="Doctor's Phone Number" flex="1">
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <Icon as={MdPhone} color="secondaryGray.600" />
                    </InputLeftElement>
                    <Input variant="main" placeholder="Enter phone number..." value={doctorPhone} onChange={(e) => setDoctorPhone(e.target.value)} />
                  </InputGroup>
                </Field>
                <Button variant="brand" leftIcon={<MdSearch />} onClick={lookupDoctor} isLoading={isLookingUp}>
                  Lookup
                </Button>
              </Flex>

              {selectedDoctor && (
                <Box p="16px" bg="green.50" _dark={{ bg: 'rgba(72,187,120,0.12)' }} border="1px solid" borderColor="green.200" borderRadius="12px">
                  <Flex align="center" gap="8px" color="green.600" fontWeight="600" mb="8px">
                    <Icon as={MdCheck} w="20px" h="20px" />
                    Doctor Selected
                  </Flex>
                  <Stack spacing="4px" fontSize="sm">
                    <Flex align="center" gap="8px">
                      <Icon as={MdPerson} color="secondaryGray.600" />
                      <Text fontWeight="600">{selectedDoctor.name}</Text>
                    </Flex>
                    <Flex align="center" gap="8px">
                      <Icon as={MdPhone} color="secondaryGray.600" />
                      <Text>{selectedDoctor.phone}</Text>
                    </Flex>
                    {selectedDoctor.clinic_name && (
                      <Flex align="center" gap="8px">
                        <Icon as={MdApartment} color="secondaryGray.600" />
                        <Text>{selectedDoctor.clinic_name}</Text>
                      </Flex>
                    )}
                  </Stack>
                  <Button variant="ghost" size="sm" mt="8px" onClick={() => setSelectedDoctor(null)}>
                    Change Doctor
                  </Button>
                </Box>
              )}

              {!selectedDoctor && doctorPhone && (
                <Button variant="light" leftIcon={<MdAdd />} onClick={() => setShowNewDoctorDialog(true)}>
                  Add New Referring Doctor
                </Button>
              )}
            </Stack>
          </FormSection>

          <FormSection icon={MdPerson} title="Client" description="Details of the person being referred.">
              <Field label="Full Name" isRequired gridColumn={{ md: 'span 2' }}>
                <Input variant="main" placeholder="Enter client's full name" value={client.name} onChange={setClientField('name')} />
              </Field>
              <>
                <Field label="Phone">
                  <Input variant="main" placeholder="Phone number" value={client.phone} onChange={setClientField('phone')} />
                </Field>
                <Field label="Email">
                  <Input variant="main" type="email" placeholder="Email address" value={client.email} onChange={setClientField('email')} />
                </Field>
                <Field label="Date of Birth">
                  <Input variant="main" type="date" value={client.dob} onChange={setClientField('dob')} />
                </Field>
                <Field label="Sex">
                  <Select variant="main" placeholder="Select sex" value={client.sex} onChange={setClientField('sex')}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </Select>
                </Field>
              </>
              <Field label="Address" gridColumn={{ md: 'span 2' }}>
                <Textarea variant="main" rows={2} placeholder="Client's address" value={client.address} onChange={setClientField('address')} />
              </Field>
          </FormSection>

          <FormSection icon={MdDescription} title="Referral details" description="Why they were referred and what the service costs.">
              <>
                <Field label="Reason for Referral">
                  <Textarea variant="main" rows={3} placeholder="Why was this client referred?" value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
                <Field label="Additional Notes">
                  <Textarea variant="main" rows={3} placeholder="Any additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </>
              <Field label="Service Fee (GH₵)">
                <Input variant="main" type="number" step="0.01" placeholder="0.00" value={serviceFee} onChange={(e) => setServiceFee(e.target.value)} />
              </Field>
          </FormSection>
        </Card>

        <FormActions hint="The referral opens once it is created, ready for scans.">
          <Button variant="light" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" isLoading={createReferralMutation.isPending}>
            Create Referral
          </Button>
        </FormActions>
      </form>

      <AppModal
        isOpen={showNewDoctorDialog}
        onClose={() => setShowNewDoctorDialog(false)}
        title="Add New Referring Doctor"
        footer={
          <>
            <Button variant="light" onClick={() => setShowNewDoctorDialog(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleCreateDoctor} isLoading={createDoctorMutation.isPending}>
              Add Doctor
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Doctor's Name" isRequired>
            <Input variant="main" placeholder="Dr. John Doe" value={newDoctor.name} onChange={setDoctorField('name')} />
          </Field>
          <Field label="Phone Number">
            <Input variant="main" value={doctorPhone} isDisabled />
          </Field>
          <Field label="Email">
            <Input variant="main" type="email" placeholder="doctor@hospital.com" value={newDoctor.email} onChange={setDoctorField('email')} />
          </Field>
          <Field label="Clinic/Hospital Name">
            <Input variant="main" placeholder="City Hospital" value={newDoctor.clinic} onChange={setDoctorField('clinic')} />
          </Field>
          <Field label="Clinic Address">
            <Textarea variant="main" rows={2} placeholder="Address..." value={newDoctor.address} onChange={setDoctorField('address')} />
          </Field>
          <Field label="Specialization">
            <Input variant="main" placeholder="Ophthalmologist" value={newDoctor.specialization} onChange={setDoctorField('specialization')} />
          </Field>
        </Stack>
      </AppModal>
    </>
  )
}
