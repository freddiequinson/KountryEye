import { useState, useEffect } from 'react'
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Tab,
  Table,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react'
import { MdAdd, MdCreditCard, MdPersonAdd } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { ReceiptModal } from '@/components/ReceiptModal'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import { RowBox } from '@/components/dashboard/widgets'
import { AppModal, Field, SearchInput, TableMessageRow } from '@/components/ui'
import { IntakeSection } from '@/components/IntakeSheet'
import { PaymentModal } from './PaymentModal'

interface Visit {
  id: number
  patient_id: number
  patient_name: string
  patient_number: string
  visit_type: string
  status: string
  consultation_type?: string
  payment_status?: string
  visit_date: string
}

interface PendingPrescription {
  id: number
  patient_name: string
  patient_number: string
  items: { name: string; quantity: number; unit_price: number }[]
  total_amount: number
  created_at: string
  status: string
}

const TABS = ['visits', 'visit-payments', 'payments', 'registrations']

const PRESCRIPTION_PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'transfer', label: 'Bank Transfer' },
  { value: 'insurance', label: 'Insurance' },
]

const emptyVisitForm = {
  visit_type: 'full_checkup',
  reason: '',
  consultation_type_id: '',
  payment_type: 'cash',
  insurance_provider: '',
  insurance_id: '',
  insurance_number: '',
  insurance_limit: '',
}

function PatientCell({ name, number }: { name: React.ReactNode; number: React.ReactNode }) {
  return (
    <Box>
      <Text fontWeight="500">{name}</Text>
      <Text fontSize="sm" color="secondaryGray.600">
        {number}
      </Text>
    </Box>
  )
}

export default function FrontDeskPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const mutedBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const infoBg = useColorModeValue('blue.50', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')

  // Date filter state
  const [dateFilter, setDateFilter] = useState(searchParams.get('period') || 'today')
  const [customStartDate, setCustomStartDate] = useState(searchParams.get('start') || '')
  const [customEndDate, setCustomEndDate] = useState(searchParams.get('end') || '')

  const [isVisitDialogOpen, setIsVisitDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isVisitPaymentDialogOpen, setIsVisitPaymentDialogOpen] = useState(false)
  const [isRegistrationDialogOpen, setIsRegistrationDialogOpen] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<PendingPrescription | null>(null)
  const [selectedVisitForPayment, setSelectedVisitForPayment] = useState<any>(null)
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null)
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('visits')
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [receiptData, setReceiptData] = useState({ url: '', receiptNumber: '', patientName: '', totalAmount: 0, amountDue: 0, paymentMethod: '' })

  // Handle navigation state from patient registration
  useEffect(() => {
    const state = location.state as { openVisitDialog?: boolean; selectedPatient?: any } | null
    if (state?.openVisitDialog && state?.selectedPatient) {
      setSelectedPatient(state.selectedPatient)
      setIsVisitDialogOpen(true)
      // Clear the state to prevent re-opening on refresh
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // Handle tab query parameter
  useEffect(() => {
    if (searchParams.get('tab') === 'registrations') setActiveTab('registrations')
  }, [searchParams])

  const [visitForm, setVisitForm] = useState({ ...emptyVisitForm, visit_type: 'initial' })
  const [visitTypeInfo, setVisitTypeInfo] = useState<{ visit_type: string; reason: string; previous_visits_count: number } | null>(null)

  // Auto-detect visit type when patient is selected
  useEffect(() => {
    if (!selectedPatient?.id) return
    api
      .get(`/patients/${selectedPatient.id}/detect-visit-type`)
      .then((response) => {
        setVisitTypeInfo(response.data)
        setVisitForm((prev) => ({ ...prev, visit_type: response.data.visit_type }))
      })
      .catch((error) => console.error('Failed to detect visit type:', error))
  }, [selectedPatient?.id])


  const { data: todayVisits = [] } = useQuery({
    queryKey: ['today-visits', dateFilter, customStartDate, customEndDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (dateFilter === 'custom' && customStartDate && customEndDate) {
        params.append('start_date', customStartDate)
        params.append('end_date', customEndDate)
      } else {
        params.append('period', dateFilter)
      }
      return (await api.get(`/patients/visits?${params.toString()}`)).data
    },
  })

  // Keep the date filter in the URL so it survives reloads
  const setParam = (key: string, value: string, keepIf: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (keepIf) params.set(key, value)
    else params.delete(key)
    setSearchParams(params, { replace: true })
  }

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value)
    setParam('period', value, value !== 'today')
  }

  const { data: pendingPrescriptions = [] } = useQuery({
    queryKey: ['pending-prescriptions'],
    queryFn: async () => (await api.get('/clinical/prescriptions/pending')).data,
  })

  const { data: consultationTypes = [] } = useQuery({
    queryKey: ['consultation-types'],
    queryFn: async () => (await api.get('/clinical/types')).data,
  })

  const { data: insuranceCompanies = [] } = useQuery({
    queryKey: ['insurance-companies-list'],
    queryFn: async () => (await api.get('/insurance/list')).data,
  })

  // Get selected insurance company ID for fee override lookup
  const selectedInsuranceCompany = insuranceCompanies.find((c: { name: string }) => c.name === visitForm.insurance_provider)

  const { data: insuranceFeeOverrides = [] } = useQuery({
    queryKey: ['insurance-fee-overrides', selectedInsuranceCompany?.id],
    queryFn: async () => {
      if (!selectedInsuranceCompany?.id) return []
      return (await api.get(`/insurance/${selectedInsuranceCompany.id}/fee-overrides`)).data
    },
    enabled: !!selectedInsuranceCompany?.id && visitForm.payment_type === 'insurance',
  })

  const { data: pendingPaymentVisits = [] } = useQuery({
    queryKey: ['pending-payment-visits'],
    queryFn: async () => (await api.get('/patients/visits/pending-payment')).data,
  })

  const { data: pendingRegistrations = [] } = useQuery({
    queryKey: ['pending-registrations'],
    queryFn: async () => (await api.get('/patients/pending-registrations')).data,
  })

  const { data: searchResults = [] } = useQuery({
    queryKey: ['patient-search', patientSearch],
    queryFn: async () => {
      if (patientSearch.length < 2) return []
      return (await api.get(`/patients/search?q=${patientSearch}`)).data
    },
    enabled: patientSearch.length >= 2,
  })

  const createVisitMutation = useMutation({
    mutationFn: (data: any) => api.post('/patients/visits', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['today-visits'] })
      queryClient.invalidateQueries({ queryKey: ['pending-payment-visits'] })
      setIsVisitDialogOpen(false)
      setSelectedPatient(null)
      const paymentType = visitForm.payment_type
      setVisitForm(emptyVisitForm)
      toast({ title: 'Visit recorded successfully' })

      // If cash or mobile money payment, switch to visit payments tab to collect payment
      if (paymentType === 'cash' || paymentType === 'momo') {
        setActiveTab('visit-payments')
        // Auto-open payment dialog for the new visit
        setTimeout(() => {
          const newVisit = response.data
          if (newVisit) {
            setSelectedVisitForPayment({
              id: newVisit.id,
              visit_number: newVisit.visit_number,
              patient_name: selectedPatient?.first_name + ' ' + selectedPatient?.last_name,
              consultation_fee: newVisit.consultation_fee || 0,
              amount_paid: 0,
              balance: newVisit.consultation_fee || 0,
            })
            setIsVisitPaymentDialogOpen(true)
          }
        }, 500)
      }
    },
    onError: () => {
      toast({ title: 'Failed to record visit', variant: 'destructive' })
    },
  })

  const processPaymentMutation = useMutation({
    mutationFn: (data: any) => api.post(`/clinical/prescriptions/${selectedPrescription?.id}/payment`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-prescriptions'] })
      setIsPaymentDialogOpen(false)
      if (selectedPrescription) {
        setReceiptData({
          url: `/receipts/prescription/${selectedPrescription.id}`,
          receiptNumber: `RX-${String(selectedPrescription.id).padStart(6, '0')}`,
          patientName: selectedPrescription.patient_name,
          totalAmount: variables.amount_paid,
          amountDue: selectedPrescription.total_amount,
          paymentMethod: variables.payment_method,
        })
        setIsReceiptModalOpen(true)
      }
      setSelectedPrescription(null)
      toast({ title: 'Payment processed successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to process payment', variant: 'destructive' })
    },
  })

  const processVisitPaymentMutation = useMutation({
    mutationFn: (data: { visitId: number; amount: number; payment_method: string }) =>
      api.post(`/patients/visits/${data.visitId}/pay`, { amount: data.amount, payment_method: data.payment_method }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-payment-visits'] })
      queryClient.invalidateQueries({ queryKey: ['today-visits'] })
      const visitId = variables.visitId
      setIsVisitPaymentDialogOpen(false)

      const visit = selectedVisitForPayment
      if (visit) {
        setReceiptData({
          url: `/receipts/visit/${visitId}`,
          receiptNumber: `VIS-${String(visitId).padStart(6, '0')}`,
          patientName: visit.patient_name || 'Unknown',
          totalAmount: variables.amount,
          amountDue: visit.balance || 0,
          paymentMethod: variables.payment_method,
        })
        setIsReceiptModalOpen(true)
      }

      setSelectedVisitForPayment(null)
      toast({ title: 'Visit payment recorded successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to record payment', variant: 'destructive' })
    },
  })

  const approveRegistrationMutation = useMutation({
    mutationFn: (registrationId: number) => api.post(`/patients/pending-registrations/${registrationId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] })
      toast({ title: 'Patient registered successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to approve registration', variant: 'destructive' })
    },
  })

  const rejectRegistrationMutation = useMutation({
    mutationFn: (registrationId: number) => api.delete(`/patients/pending-registrations/${registrationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] })
      toast({ title: 'Registration rejected' })
    },
    onError: () => {
      toast({ title: 'Failed to reject registration', variant: 'destructive' })
    },
  })

  const updateRegistrationMutation = useMutation({
    mutationFn: (data: any) => api.put(`/patients/pending-registrations/${selectedRegistration?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] })
      toast({ title: 'Registration updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update registration', variant: 'destructive' })
    },
  })

  const handleSaveAndApprove = () => {
    if (!selectedRegistration) return
    updateRegistrationMutation.mutate(selectedRegistration, {
      onSuccess: () => {
        approveRegistrationMutation.mutate(selectedRegistration.id)
        setIsRegistrationDialogOpen(false)
        setSelectedRegistration(null)
      },
    })
  }

  const submitVisit = () =>
    createVisitMutation.mutate({
      patient_id: selectedPatient.id,
      ...visitForm,
      visit_type: visitTypeInfo?.visit_type || visitForm.visit_type,
      consultation_type_id: visitForm.consultation_type_id ? parseInt(visitForm.consultation_type_id) : null,
      insurance_limit: visitForm.insurance_limit ? parseFloat(visitForm.insurance_limit) : null,
    })

  const handleRecordVisit = () => {
    if (!selectedPatient) {
      toast({ title: 'Please select a patient', variant: 'destructive' })
      return
    }

    if (visitForm.payment_type !== 'visioncare') {
      submitVisit()
      return
    }

    // Check if patient is a VisionCare member
    api
      .get(`/settings/visioncare/members?search=${selectedPatient.first_name} ${selectedPatient.last_name}`)
      .then((response) => {
        const isMember = response.data.some(
          (member: any) =>
            member.first_name.toLowerCase() === selectedPatient.first_name.toLowerCase() &&
            member.last_name.toLowerCase() === selectedPatient.last_name.toLowerCase(),
        )
        if (!isMember) {
          toast({
            title: 'Patient is not a VisionCare member',
            description: 'Please check if the patient is enrolled in VisionCare or select a different payment method.',
            variant: 'destructive',
          })
          return
        }
        submitVisit()
      })
      .catch(() => {
        toast({ title: 'Failed to verify VisionCare membership', variant: 'destructive' })
      })
  }

  const openPaymentDialog = (prescription: PendingPrescription) => {
    setSelectedPrescription(prescription)
    setIsPaymentDialogOpen(true)
  }

  const getConsultationFee = () => {
    if (!visitForm.consultation_type_id) return 0
    const type = consultationTypes.find((t: any) => t.id === parseInt(visitForm.consultation_type_id))
    const baseFee = type?.base_fee || 0

    // Check for insurance fee override
    if (visitForm.payment_type === 'insurance' && insuranceFeeOverrides.length > 0) {
      const override = insuranceFeeOverrides.find((o: any) => o.consultation_type_id === parseInt(visitForm.consultation_type_id))
      if (override) {
        if (visitForm.visit_type === 'initial' && override.initial_fee != null) return override.initial_fee
        if (visitForm.visit_type === 'review' && override.review_fee != null) return override.review_fee
        if (visitForm.visit_type === 'subsequent' && override.subsequent_fee != null) return override.subsequent_fee
        if (override.override_fee != null) return override.override_fee
      }
    }
    return baseFee
  }

  // Parse search term into first/last name and pass to registration
  const goRegister = () => {
    setIsVisitDialogOpen(false)
    const parts = patientSearch.trim().split(/\s+/)
    const firstName = parts[0] || ''
    const lastName = parts.slice(1).join(' ') || ''
    navigate(`/frontdesk/register?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`)
  }

  const reg = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setSelectedRegistration({ ...selectedRegistration, [key]: e.target.value })
  const regPhone = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSelectedRegistration({ ...selectedRegistration, [key]: e.target.value.replace(/\D/g, '').slice(0, 10) })

  const fee = getConsultationFee()
  const insuranceLimit = parseFloat(visitForm.insurance_limit)

  return (
    <>
      <PageHeader
        title="Front Desk"
        description="Manage visits and process payments"
        actions={
          <>
            <Select variant="main" w="180px" value={dateFilter} onChange={(e) => handleDateFilterChange(e.target.value)}>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </Select>
            {dateFilter === 'custom' && (
              <Flex align="center" gap="8px">
                <Input
                  variant="main"
                  type="date"
                  w="150px"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value)
                    setParam('start', e.target.value, !!e.target.value)
                  }}
                />
                <Text>to</Text>
                <Input
                  variant="main"
                  type="date"
                  w="150px"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value)
                    setParam('end', e.target.value, !!e.target.value)
                  }}
                />
              </Flex>
            )}
            <Button variant="brand" leftIcon={<MdAdd />} onClick={() => setIsVisitDialogOpen(true)} data-tour="register-btn">
              Record Visit
            </Button>
          </>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 3, xl: 5 }} spacing="20px" mb="20px">
        <StatCard name="Today's Visits" value={todayVisits.length} />
        <StatCard name="Waiting" value={todayVisits.filter((v: Visit) => v.status === 'waiting').length} />
        <StatCard name="In Consultation" value={todayVisits.filter((v: Visit) => v.status === 'in_consultation').length} />
        <StatCard name="Visit Payments Due" value={pendingPaymentVisits.length} />
        <StatCard name="New Registrations" value={pendingRegistrations.length} valueColor="blue.500" />
      </SimpleGrid>

      <Tabs variant="soft-rounded" index={TABS.indexOf(activeTab)} onChange={(i) => setActiveTab(TABS[i])}>
        <TabList gap="8px" flexWrap="wrap" mb="16px">
          <Tab>Today's Visits</Tab>
          <Tab>
            Visit Payments
            {pendingPaymentVisits.length > 0 && (
              <Badge colorScheme="red" ms="8px" borderRadius="full">
                {pendingPaymentVisits.length}
              </Badge>
            )}
          </Tab>
          <Tab>
            Prescription Payments
            {pendingPrescriptions.length > 0 && (
              <Badge ms="8px" borderRadius="full">
                {pendingPrescriptions.length}
              </Badge>
            )}
          </Tab>
          <Tab>
            New Registrations
            {pendingRegistrations.length > 0 && (
              <Badge colorScheme="blue" variant="solid" ms="8px" borderRadius="full">
                {pendingRegistrations.length}
              </Badge>
            )}
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel p="0">
            <Card data-tour="patient-queue">
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Patient</Th>
                      <Th>Visit Type</Th>
                      <Th>Consultation</Th>
                      <Th>Status</Th>
                      <Th>Time</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {todayVisits.length === 0 ? (
                      <TableMessageRow colSpan={6}>No visits recorded today</TableMessageRow>
                    ) : (
                      todayVisits.map((visit: Visit) => (
                        <Tr key={visit.id}>
                          <Td>
                            <PatientCell name={visit.patient_name} number={visit.patient_number} />
                          </Td>
                          <Td>
                            <Badge variant="outline">
                              {visit.visit_type === 'initial'
                                ? 'Initial'
                                : visit.visit_type === 'review'
                                  ? 'Review'
                                  : visit.visit_type === 'subsequent'
                                    ? 'Subsequent'
                                    : 'Check-up'}
                            </Badge>
                          </Td>
                          <Td>{visit.consultation_type || '-'}</Td>
                          <Td>
                            <Badge
                              colorScheme={visit.status === 'completed' ? 'green' : visit.status === 'in_consultation' ? 'brand' : 'yellow'}
                            >
                              {visit.status.replace('_', ' ')}
                            </Badge>
                          </Td>
                          <Td>{new Date(visit.visit_date).toLocaleTimeString()}</Td>
                          <Td>
                            {visit.status === 'checked_out' ? (
                              <Badge colorScheme="green">Checked Out</Badge>
                            ) : (
                              <Button size="sm" variant="light" leftIcon={<MdCreditCard />} onClick={() => navigate(`/frontdesk/checkout/${visit.id}`)}>
                                Checkout
                              </Button>
                            )}
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>

          <TabPanel p="0">
            <Card>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Patient</Th>
                      <Th>Visit #</Th>
                      <Th>Status</Th>
                      <Th>Consultation Fee</Th>
                      <Th>Paid</Th>
                      <Th>Balance</Th>
                      <Th>Action</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {pendingPaymentVisits.length === 0 ? (
                      <TableMessageRow colSpan={7}>No pending visit payments</TableMessageRow>
                    ) : (
                      pendingPaymentVisits.map((visit: any) => (
                        <Tr key={visit.id}>
                          <Td>
                            <PatientCell name={visit.patient_name} number={visit.patient_number} />
                          </Td>
                          <Td>{visit.visit_number || '-'}</Td>
                          <Td>
                            <Badge colorScheme={visit.payment_status === 'partial' ? 'yellow' : 'red'}>
                              {visit.payment_status === 'partial' ? 'Partial Payment' : 'Unpaid'}
                            </Badge>
                          </Td>
                          <Td fontWeight="500">GH₵{(visit.consultation_fee || 0).toLocaleString()}</Td>
                          <Td>GH₵{(visit.amount_paid || 0).toLocaleString()}</Td>
                          <Td fontWeight="500" color="red.500">
                            GH₵{(visit.balance || 0).toLocaleString()}
                          </Td>
                          <Td>
                            <Button
                              size="sm"
                              variant="brand"
                              leftIcon={<MdCreditCard />}
                              onClick={() => {
                                setSelectedVisitForPayment(visit)
                                setIsVisitPaymentDialogOpen(true)
                              }}
                            >
                              {visit.payment_status === 'partial' ? 'Complete Payment' : 'Record Payment'}
                            </Button>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>

          <TabPanel p="0">
            <Card>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Patient</Th>
                      <Th>Items</Th>
                      <Th>Total</Th>
                      <Th>Created</Th>
                      <Th>Action</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {pendingPrescriptions.length === 0 ? (
                      <TableMessageRow colSpan={5}>No pending prescription payments</TableMessageRow>
                    ) : (
                      pendingPrescriptions.map((prescription: PendingPrescription) => (
                        <Tr key={prescription.id}>
                          <Td>
                            <PatientCell name={prescription.patient_name} number={prescription.patient_number} />
                          </Td>
                          <Td>
                            {prescription.items.map((item, i) => (
                              <Text key={i} fontSize="sm">
                                {item.name} x{item.quantity}
                              </Text>
                            ))}
                          </Td>
                          <Td fontWeight="500">GH₵{prescription.total_amount.toLocaleString()}</Td>
                          <Td>{new Date(prescription.created_at).toLocaleTimeString()}</Td>
                          <Td>
                            <Button size="sm" variant="brand" leftIcon={<MdCreditCard />} onClick={() => openPaymentDialog(prescription)}>
                              Process Payment
                            </Button>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>

          <TabPanel p="0">
            <Card>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Contact</Th>
                      <Th>Date of Birth</Th>
                      <Th>Sex</Th>
                      <Th>Submitted</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {pendingRegistrations.length === 0 ? (
                      <TableMessageRow colSpan={6}>No pending registrations</TableMessageRow>
                    ) : (
                      pendingRegistrations.map((r: any) => (
                        <Tr key={r.id}>
                          <Td>
                            <Text as="span" fontWeight="500">
                              {r.first_name} {r.last_name}
                            </Text>
                            {r.other_names && (
                              <Text as="span" color="secondaryGray.600">
                                {' '}
                                ({r.other_names})
                              </Text>
                            )}
                          </Td>
                          <Td fontSize="sm">
                            <Text>{r.phone}</Text>
                            {r.email && <Text color="secondaryGray.600">{r.email}</Text>}
                          </Td>
                          <Td>{r.date_of_birth || '-'}</Td>
                          <Td textTransform="capitalize">{r.sex || '-'}</Td>
                          <Td>{new Date(r.created_at).toLocaleString()}</Td>
                          <Td>
                            <Flex gap="8px">
                              <Button
                                size="sm"
                                variant="light"
                                onClick={() => {
                                  setSelectedRegistration({ ...r })
                                  setIsRegistrationDialogOpen(true)
                                }}
                              >
                                View/Edit
                              </Button>
                              <Button size="sm" variant="light" onClick={() => rejectRegistrationMutation.mutate(r.id)}>
                                Reject
                              </Button>
                            </Flex>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Record Visit Dialog */}
      <AppModal
        isOpen={isVisitDialogOpen}
        onClose={() => setIsVisitDialogOpen(false)}
        size="lg"
        title="Record New Visit"
        footer={
          <>
            <Button variant="light" onClick={() => setIsVisitDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleRecordVisit} isLoading={createVisitMutation.isPending} loadingText="Recording...">
              Record Visit
            </Button>
          </>
        }
      >
        <Box>
          <IntakeSection number={1} title="Patient" columns={1}>
            <Field label="Search Patient">
              <Box data-tour="patient-search">
                <SearchInput maxW="100%" placeholder="Search by name or patient number..." value={patientSearch} onChange={setPatientSearch} />
              </Box>
              {patientSearch.length >= 2 && !selectedPatient && (
                <Box border="1px solid" borderColor={borderColor} borderRadius="12px" minH="120px" maxH="192px" overflowY="auto" mt="8px">
                  {searchResults.length > 0 ? (
                    <>
                      {searchResults.map((patient: any) => (
                        <Box
                          key={patient.id}
                          p="8px"
                          borderBottom="1px solid"
                          borderColor={borderColor}
                          cursor="pointer"
                          _hover={{ bg: hoverBg }}
                          onClick={() => {
                            setSelectedPatient(patient)
                            setPatientSearch('')
                          }}
                        >
                          <Flex justify="space-between" align="start">
                            <Text fontWeight="500">
                              {patient.first_name} {patient.last_name}
                            </Text>
                            <Badge>{patient.patient_number}</Badge>
                          </Flex>
                          <Text fontSize="xs" color="secondaryGray.600" mt="2px">
                            {patient.phone}
                            {patient.date_of_birth && <span style={{ marginLeft: 8 }}>DOB: {new Date(patient.date_of_birth).toLocaleDateString()}</span>}
                          </Text>
                        </Box>
                      ))}
                      <Box p="8px" bg={mutedBg}>
                        <Button variant="ghost" size="sm" w="100%" leftIcon={<MdPersonAdd />} onClick={goRegister}>
                          Not found? Register New Patient
                        </Button>
                      </Box>
                    </>
                  ) : (
                    <Box p="16px" textAlign="center">
                      <Text color="secondaryGray.600" mb="8px">
                        No patients found matching "{patientSearch}"
                      </Text>
                      <Button variant="light" size="sm" leftIcon={<MdPersonAdd />} onClick={goRegister}>
                        Register New Patient
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
              {selectedPatient && (
                <Flex align="center" justify="space-between" p="8px 12px" bg={mutedBg} borderRadius="12px" mt="8px">
                  <Box>
                    <Text as="span" fontWeight="500">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </Text>
                    <Text as="span" fontSize="sm" color="secondaryGray.600" ms="8px">
                      {selectedPatient.patient_number}
                    </Text>
                  </Box>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>
                    Change
                  </Button>
                </Flex>
              )}
            </Field>
          </IntakeSection>

          <IntakeSection number={2} title="Visit" columns={1}>
            <Field label="Visit Type (Auto-detected)">
              <Box p="12px" bg={mutedBg} borderRadius="12px">
                {visitTypeInfo ? (
                  <>
                    <Text fontWeight="600" color="brand.500">
                      {visitTypeInfo.visit_type === 'initial'
                        ? 'Initial Visit'
                        : visitTypeInfo.visit_type === 'review'
                          ? 'Review Visit'
                          : visitTypeInfo.visit_type === 'subsequent'
                            ? 'Subsequent Visit'
                            : visitTypeInfo.visit_type.toUpperCase()}
                    </Text>
                    <Text fontSize="xs" color="secondaryGray.600" mt="4px">
                      {visitTypeInfo.reason}
                    </Text>
                  </>
                ) : (
                  <Text color="secondaryGray.600">Select a patient to detect visit type</Text>
                )}
              </Box>
            </Field>

            <Field label="Consultation Type">
              <Select
                variant="main"
                placeholder="Select consultation type"
                value={visitForm.consultation_type_id}
                onChange={(e) => setVisitForm({ ...visitForm, consultation_type_id: e.target.value })}
              >
                {consultationTypes.map((type: any) => (
                  <option key={type.id} value={type.id.toString()}>
                    {type.name} - GH₵{type.base_fee?.toLocaleString()}
                  </option>
                ))}
              </Select>
            </Field>
          </IntakeSection>

          <IntakeSection number={3} title="Payment" columns={1}>
            <Field label="Payment Type">
              <Select variant="main" value={visitForm.payment_type} onChange={(e) => setVisitForm({ ...visitForm, payment_type: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="momo">Mobile Money</option>
                <option value="insurance">Insurance</option>
                <option value="visioncare">VisionCare Membership</option>
              </Select>
            </Field>

            {visitForm.payment_type === 'insurance' && (
              <RowBox display="block" p="16px">
                <Stack spacing="16px">
                  <Field label="Insurance Provider">
                    <Select
                      variant="main"
                      placeholder="Select insurance provider"
                      value={visitForm.insurance_provider}
                      onChange={(e) => setVisitForm({ ...visitForm, insurance_provider: e.target.value })}
                    >
                      {insuranceCompanies.map((company: { id: number; name: string; code: string }) => (
                        <option key={company.id} value={company.name}>
                          {company.name} ({company.code})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <SimpleGrid columns={2} spacing="16px">
                    <Field label="Insurance ID">
                      <Input variant="main" value={visitForm.insurance_id} onChange={(e) => setVisitForm({ ...visitForm, insurance_id: e.target.value })} />
                    </Field>
                    <Field label="Membership Number">
                      <Input variant="main" value={visitForm.insurance_number} onChange={(e) => setVisitForm({ ...visitForm, insurance_number: e.target.value })} />
                    </Field>
                  </SimpleGrid>
                  <Field label="Insurance Limit (GH₵)" helper="Maximum amount insurance will cover. Costs exceeding this will be paid by patient.">
                    <Input
                      variant="main"
                      type="number"
                      placeholder="Enter insurance coverage limit"
                      value={visitForm.insurance_limit}
                      onChange={(e) => setVisitForm({ ...visitForm, insurance_limit: e.target.value })}
                    />
                  </Field>
                  {visitForm.insurance_limit && visitForm.consultation_type_id && (
                    <Box p="12px" bg={infoBg} border="1px solid" borderColor="blue.200" borderRadius="12px" fontSize="sm">
                      <Flex justify="space-between">
                        <Text>Insurance Limit:</Text>
                        <Text fontWeight="500">GH₵{insuranceLimit.toLocaleString()}</Text>
                      </Flex>
                      <Flex justify="space-between">
                        <Text>Consultation Fee:</Text>
                        <Text fontWeight="500">GH₵{fee.toLocaleString()}</Text>
                      </Flex>
                      <Divider my="4px" />
                      {insuranceLimit < fee ? (
                        <Flex justify="space-between" color="red.500" fontWeight="500">
                          <Text>Patient Top-up Required:</Text>
                          <Text>GH₵{(fee - insuranceLimit).toLocaleString()}</Text>
                        </Flex>
                      ) : (
                        <Flex justify="space-between" color="green.500" fontWeight="500">
                          <Text>Remaining for Medications:</Text>
                          <Text>GH₵{(insuranceLimit - fee).toLocaleString()}</Text>
                        </Flex>
                      )}
                    </Box>
                  )}
                </Stack>
              </RowBox>
            )}

            {visitForm.consultation_type_id && (
              <Flex justify="space-between" align="center" p="16px" bg={mutedBg} borderRadius="12px">
                <Text fontWeight="500">Consultation Fee</Text>
                <Text fontSize="lg" fontWeight="bold">
                  GH₵{fee.toLocaleString()}
                </Text>
              </Flex>
            )}
          </IntakeSection>
        </Box>
      </AppModal>

      <PaymentModal
        title="Process Payment"
        bill={
          selectedPrescription && {
            patientName: selectedPrescription.patient_name,
            subtitle: `Prescription · ${selectedPrescription.patient_number}`,
            lines: selectedPrescription.items.map((item) => ({ label: `${item.name} x${item.quantity}`, amount: item.quantity * item.unit_price })),
            due: selectedPrescription.total_amount,
          }
        }
        methods={PRESCRIPTION_PAYMENT_METHODS}
        withReference
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        isLoading={processPaymentMutation.isPending}
        onSubmit={(payment) =>
          processPaymentMutation.mutate({ payment_method: payment.payment_method, amount_paid: payment.amount, reference: payment.reference, prescription_id: selectedPrescription?.id })
        }
      />

      <PaymentModal
        title="Record Visit Payment"
        bill={
          selectedVisitForPayment && {
            patientName: selectedVisitForPayment.patient_name || 'Unknown',
            subtitle: `Visit ${selectedVisitForPayment.visit_number || 'N/A'}`,
            lines: [{ label: 'Consultation fee', amount: selectedVisitForPayment.consultation_fee || 0 }],
            alreadyPaid: selectedVisitForPayment.amount_paid || 0,
            due: selectedVisitForPayment.balance || 0,
          }
        }
        isOpen={isVisitPaymentDialogOpen}
        onClose={() => setIsVisitPaymentDialogOpen(false)}
        isLoading={processVisitPaymentMutation.isPending}
        onSubmit={(payment) => selectedVisitForPayment && processVisitPaymentMutation.mutate({ visitId: selectedVisitForPayment.id, amount: payment.amount, payment_method: payment.payment_method })}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receiptUrl={receiptData.url}
        receiptNumber={receiptData.receiptNumber}
        patientName={receiptData.patientName}
        totalAmount={receiptData.totalAmount}
        amountDue={receiptData.amountDue}
        paymentMethod={receiptData.paymentMethod}
      />

      {/* Registration View/Edit Dialog */}
      <AppModal
        isOpen={isRegistrationDialogOpen}
        onClose={() => {
          setIsRegistrationDialogOpen(false)
          setSelectedRegistration(null)
        }}
        size="2xl"
        title="Review Patient Registration"
        footer={
          <>
            <Button
              variant="light"
              onClick={() => {
                setIsRegistrationDialogOpen(false)
                setSelectedRegistration(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="light" isLoading={updateRegistrationMutation.isPending} onClick={() => updateRegistrationMutation.mutate(selectedRegistration)}>
              Save Changes
            </Button>
            <Button
              variant="brand"
              leftIcon={<MdPersonAdd />}
              isDisabled={updateRegistrationMutation.isPending}
              isLoading={approveRegistrationMutation.isPending}
              loadingText="Approving..."
              onClick={handleSaveAndApprove}
            >
              Save & Approve
            </Button>
          </>
        }
      >
        {selectedRegistration && (
          <Stack spacing="16px">
            <SimpleGrid columns={2} spacing="16px">
              <Field label="First Name" isRequired>
                <Input variant="main" value={selectedRegistration.first_name || ''} onChange={reg('first_name')} />
              </Field>
              <Field label="Last Name" isRequired>
                <Input variant="main" value={selectedRegistration.last_name || ''} onChange={reg('last_name')} />
              </Field>
              <Field label="Other Names">
                <Input variant="main" value={selectedRegistration.other_names || ''} onChange={reg('other_names')} />
              </Field>
              <Field label="Date of Birth">
                <Input variant="main" type="date" value={selectedRegistration.date_of_birth || ''} onChange={reg('date_of_birth')} />
              </Field>
              <Field label="Sex">
                <Select variant="main" placeholder="Select sex" value={selectedRegistration.sex || ''} onChange={reg('sex')}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </Select>
              </Field>
              <Field label="Marital Status">
                <Select variant="main" placeholder="Select status" value={selectedRegistration.marital_status || ''} onChange={reg('marital_status')}>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </Select>
              </Field>
              <Field label="Phone" isRequired>
                <Input variant="main" maxLength={10} placeholder="0200000000" value={selectedRegistration.phone || ''} onChange={regPhone('phone')} />
              </Field>
              <Field label="Email">
                <Input variant="main" type="email" value={selectedRegistration.email || ''} onChange={reg('email')} />
              </Field>
            </SimpleGrid>
            <Field label="Address">
              <Textarea variant="main" value={selectedRegistration.address || ''} onChange={reg('address')} />
            </Field>
            <SimpleGrid columns={2} spacing="16px">
              <Field label="Occupation">
                <Input variant="main" value={selectedRegistration.occupation || ''} onChange={reg('occupation')} />
              </Field>
              <Field label="Ghana Card Number">
                <Input variant="main" value={selectedRegistration.ghana_card || ''} onChange={reg('ghana_card')} />
              </Field>
              <Field label="Emergency Contact Name">
                <Input variant="main" value={selectedRegistration.emergency_contact_name || ''} onChange={reg('emergency_contact_name')} />
              </Field>
              <Field label="Emergency Contact Phone">
                <Input
                  variant="main"
                  maxLength={10}
                  placeholder="0200000000"
                  value={selectedRegistration.emergency_contact_phone || ''}
                  onChange={regPhone('emergency_contact_phone')}
                />
              </Field>
            </SimpleGrid>
            <Text fontSize="sm" color="secondaryGray.600">
              Submitted: {selectedRegistration.created_at ? new Date(selectedRegistration.created_at).toLocaleString() : '-'}
            </Text>
          </Stack>
        )}
      </AppModal>
    </>
  )
}
