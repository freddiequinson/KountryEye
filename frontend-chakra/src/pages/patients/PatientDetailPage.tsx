import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Icon,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Spinner,
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
import { MdAdd, MdCake, MdCheckCircle, MdContactEmergency, MdCreditCard, MdDescription, MdEdit, MdEmail, MdErrorOutline, MdEvent, MdHistory, MdLocationOn, MdPhone, MdVisibility } from 'react-icons/md'
import api from '@/lib/api'
import type { Patient, Visit } from '@/types'
import { useToast } from '@/hooks/use-toast'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { EntityHeader } from '@/components/Person'
import { RowBox } from '@/components/dashboard/widgets'
import { AppModal, EmptyState, Field, TableBox, TableMessageRow } from '@/components/ui'

const scanTypeScheme: Record<string, string> = { oct: 'blue', vft: 'purple', fundus: 'green' }

function InfoLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Text fontSize="sm">
      <Text as="span" color="secondaryGray.600">
        {label}:
      </Text>{' '}
      {value}
    </Text>
  )
}

const ageOf = (dob: string) => `${Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)} yrs`

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const mutedBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const infoBg = useColorModeValue('blue.50', 'whiteAlpha.100')

  const [isVisitDialogOpen, setIsVisitDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isEditRecordDialogOpen, setIsEditRecordDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null)
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [paymentVisit, setPaymentVisit] = useState<any>(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'cash', notes: '' })
  const [visitForm, setVisitForm] = useState({
    visit_type: 'initial',
    reason: '',
    notes: '',
    consultation_type_id: '',
    payment_type: 'cash',
    insurance_provider: '',
    insurance_id: '',
    insurance_number: '',
    insurance_limit: '',
  })
  const [visitTypeInfo, setVisitTypeInfo] = useState<{ visit_type: string; reason: string; previous_visits_count: number } | null>(null)

  // Auto-detect visit type when dialog opens
  useEffect(() => {
    if (!id || !isVisitDialogOpen) return
    api
      .get(`/patients/${id}/detect-visit-type`)
      .then((response) => {
        setVisitTypeInfo(response.data)
        setVisitForm((prev) => ({ ...prev, visit_type: response.data.visit_type }))
      })
      .catch((error) => console.error('Failed to detect visit type:', error))
  }, [id, isVisitDialogOpen])

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => (await api.get(`/patients/${id}`)).data as Patient,
  })

  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['patient-visits', id],
    queryFn: async () => (await api.get(`/patients/${id}/visits`)).data as Visit[],
  })

  const { data: clinicalRecords = [] } = useQuery({
    queryKey: ['patient-clinical-records', id],
    queryFn: async () => (await api.get(`/clinical/patients/${id}/records`)).data,
  })

  const { data: patientBalance } = useQuery({
    queryKey: ['patient-balance', id],
    queryFn: async () => (await api.get(`/patients/${id}/balance`)).data,
  })

  const { data: recordHistory = [] } = useQuery({
    queryKey: ['record-history', selectedRecordId],
    queryFn: async () => (await api.get(`/clinical/records/${selectedRecordId}/history`)).data,
    enabled: !!selectedRecordId && isHistoryDialogOpen,
  })

  const { data: consultationTypes = [] } = useQuery({
    queryKey: ['consultation-types'],
    queryFn: async () => {
      const response = await api.get('/clinical/consultation-types')
      return Array.isArray(response.data) ? response.data : []
    },
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

  const { data: patientScans = [] } = useQuery({
    queryKey: ['patient-scans', id],
    queryFn: async () => (await api.get(`/technician/patient/${id}/scans`)).data,
    enabled: !!id,
  })

  const getConsultationFee = () => {
    if (!visitForm.consultation_type_id) return 0
    const type = consultationTypes.find((t: any) => t.id.toString() === visitForm.consultation_type_id)
    const baseFee = type?.base_fee || 0

    // Check for insurance fee override
    if (visitForm.payment_type === 'insurance' && insuranceFeeOverrides.length > 0) {
      const override = insuranceFeeOverrides.find((o: any) => o.consultation_type_id.toString() === visitForm.consultation_type_id)
      if (override) {
        // Check for visit-type specific fee first
        if (visitForm.visit_type === 'initial' && override.initial_fee != null) return override.initial_fee
        if (visitForm.visit_type === 'review' && override.review_fee != null) return override.review_fee
        if (visitForm.visit_type === 'subsequent' && override.subsequent_fee != null) return override.subsequent_fee
        // Fall back to single override fee
        if (override.override_fee != null) return override.override_fee
      }
    }
    return baseFee
  }

  const updateRecordMutation = useMutation({
    mutationFn: (data: any) => api.post(`/clinical/visits/${data.visit_id}/record`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-clinical-records', id] })
      setIsEditRecordDialogOpen(false)
      setEditingRecord(null)
      toast({ title: 'Clinical record updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update record', variant: 'destructive' })
    },
  })

  const createVisitMutation = useMutation({
    mutationFn: (data: any) => api.post('/patients/visits', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-visits', id] })
      setIsVisitDialogOpen(false)
      setVisitForm({
        visit_type: 'full_checkup',
        reason: '',
        notes: '',
        consultation_type_id: '',
        payment_type: 'cash',
        insurance_provider: '',
        insurance_id: '',
        insurance_number: '',
        insurance_limit: '',
      })
      toast({ title: 'Visit recorded successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to record visit', variant: 'destructive' })
    },
  })

  const recordPaymentMutation = useMutation({
    mutationFn: (data: { visit_id: number; amount: number; payment_method: string; notes?: string }) =>
      api.post(`/patients/visits/${data.visit_id}/payment`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-visits', id] })
      queryClient.invalidateQueries({ queryKey: ['patient-balance', id] })
      setIsPaymentDialogOpen(false)
      setPaymentVisit(null)
      setPaymentForm({ amount: '', payment_method: 'cash', notes: '' })
      toast({ title: 'Payment recorded successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to record payment', variant: 'destructive' })
    },
  })

  const openPaymentDialog = (visit: any) => {
    const balance = (visit.consultation_fee || 0) - (visit.amount_paid || 0)
    setPaymentVisit(visit)
    setPaymentForm({ amount: balance.toFixed(2), payment_method: 'cash', notes: '' })
    setIsPaymentDialogOpen(true)
  }

  const handleRecordPayment = () => {
    if (!paymentVisit || !paymentForm.amount) return
    recordPaymentMutation.mutate({
      visit_id: paymentVisit.id,
      amount: parseFloat(paymentForm.amount),
      payment_method: paymentForm.payment_method,
      notes: paymentForm.notes,
    })
  }

  const handleCreateVisit = (e: React.FormEvent) => {
    e.preventDefault()
    createVisitMutation.mutate({
      ...visitForm,
      visit_type: visitTypeInfo?.visit_type || visitForm.visit_type,
      patient_id: Number(id),
      consultation_type_id: visitForm.consultation_type_id ? parseInt(visitForm.consultation_type_id) : null,
      consultation_fee: getConsultationFee(),
      insurance_limit: visitForm.insurance_limit ? parseFloat(visitForm.insurance_limit) : null,
    })
  }

  const openScanPdf = async (scanId: number) => {
    try {
      const response = await api.get(`/technician/scans/${scanId}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      toast({ title: 'Error', description: 'Failed to load PDF', variant: 'destructive' })
    }
  }

  const editField = (key: string) => (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingRecord({ ...editingRecord, [key]: e.target.value })

  if (patientLoading) {
    return (
      <Flex justify="center" align="center" h="256px">
        <Spinner color="brand.500" />
      </Flex>
    )
  }

  if (!patient) {
    return (
      <Flex justify="center" align="center" h="256px">
        Patient not found
      </Flex>
    )
  }

  const hasBalance = patientBalance?.balance > 0
  const fee = getConsultationFee()
  const insuranceLimit = parseFloat(visitForm.insurance_limit)

  return (
    <>
      <EntityHeader
        name={`${patient.first_name} ${patient.last_name}`}
        subtitle={[patient.sex, patient.date_of_birth && ageOf(patient.date_of_birth), patient.occupation].filter(Boolean).join(' · ') || 'Patient'}
        badges={<Badge variant="outline">{patient.patient_number}</Badge>}
        onBack={() => navigate('/patients')}
        facts={[
          { icon: MdPhone, label: 'Phone', value: patient.phone || '-' },
          { icon: MdEmail, label: 'Email', value: patient.email || '-' },
          { icon: MdLocationOn, label: 'Address', value: patient.address || '-' },
          { icon: MdCake, label: 'Date of birth', value: patient.date_of_birth || '-' },
          { icon: MdContactEmergency, label: 'Emergency contact', value: patient.emergency_contact_name || '-' },
          { icon: MdPhone, label: 'Emergency phone', value: patient.emergency_contact_phone || '-' },
        ]}
        aside={
          <>
            <Flex align="center" justify="space-between" mb="6px">
              <Text fontSize="11px" fontWeight="700" letterSpacing="0.06em" textTransform="uppercase" color="secondaryGray.500">
                Payment status
              </Text>
              <Icon as={hasBalance ? MdErrorOutline : MdCheckCircle} color={hasBalance ? 'red.500' : 'green.500'} />
            </Flex>
            <Text fontSize="28px" fontWeight="800" lineHeight="1.1" color={hasBalance ? 'red.500' : 'green.500'}>
              {hasBalance ? `GHS ${patientBalance?.balance?.toFixed(2) || '0.00'}` : 'Paid Up'}
            </Text>
            <Text fontSize="xs" fontWeight="500" color="secondaryGray.600" mt="2px" mb="10px">
              {hasBalance ? 'outstanding' : 'no outstanding balance'}
            </Text>
            <Flex justify="space-between" fontSize="13px" py="6px" borderTop="1px dashed" borderColor="secondaryGray.100" _dark={{ borderColor: "whiteAlpha.200" }}>
              <Text color="secondaryGray.600">Total billed</Text>
              <Text fontWeight="700">GHS {patientBalance?.total_billed?.toFixed(2) || '0.00'}</Text>
            </Flex>
            <Flex justify="space-between" fontSize="13px" py="6px" borderTop="1px dashed" borderColor="secondaryGray.100" _dark={{ borderColor: "whiteAlpha.200" }}>
              <Text color="secondaryGray.600">Total paid</Text>
              <Text fontWeight="700">GHS {patientBalance?.total_paid?.toFixed(2) || '0.00'}</Text>
            </Flex>
          </>
        }
      />

      <Tabs variant="soft-rounded">
        <Flex justify="space-between" align="center" mb="16px" gap="12px" wrap="wrap">
          <TabList gap="8px" flexWrap="wrap">
            <Tab>
              <Icon as={MdEvent} me="8px" />
              Visits
            </Tab>
            <Tab>
              <Icon as={MdDescription} me="8px" />
              Clinical Records
            </Tab>
            <Tab>
              <Icon as={MdVisibility} me="8px" />
              Scans ({patientScans.length})
            </Tab>
          </TabList>
          <Button variant="brand" leftIcon={<MdAdd />} onClick={() => setIsVisitDialogOpen(true)}>
            New Visit
          </Button>
        </Flex>

        <TabPanels>
          <TabPanel p="0">
            <Card>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th>Reason</Th>
                      <Th>Status</Th>
                      <Th>Payment</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {visitsLoading ? (
                      <TableMessageRow colSpan={6} loading />
                    ) : visits.length === 0 ? (
                      <TableMessageRow colSpan={6}>No visits recorded</TableMessageRow>
                    ) : (
                      visits.map((visit: any) => (
                        <Tr key={visit.id}>
                          <Td>{new Date(visit.visit_date).toLocaleString()}</Td>
                          <Td textTransform="capitalize">{visit.visit_type?.replace('_', ' ') || '-'}</Td>
                          <Td>{visit.reason || '-'}</Td>
                          <Td>
                            <Badge
                              colorScheme={visit.status === 'completed' ? 'green' : visit.status === 'in_consultation' ? 'yellow' : 'gray'}
                            >
                              {String(visit.status ?? '').replace(/_/g, ' ')}
                            </Badge>
                          </Td>
                          <Td>
                            {visit.consultation_fee ? (
                              <Box fontSize="sm">
                                <Text color={visit.amount_paid >= visit.consultation_fee ? 'green.500' : 'red.500'}>
                                  GHS {visit.amount_paid?.toFixed(2) || '0.00'} / {visit.consultation_fee?.toFixed(2)}
                                </Text>
                                {visit.amount_paid < visit.consultation_fee && (
                                  <Text fontSize="xs" color="red.500">
                                    Owes: GHS {(visit.consultation_fee - (visit.amount_paid || 0)).toFixed(2)}
                                  </Text>
                                )}
                              </Box>
                            ) : (
                              '-'
                            )}
                          </Td>
                          <Td>
                            <Flex gap="4px">
                              <IconButton
                                aria-label="View visit"
                                variant="ghost"
                                size="sm"
                                icon={<MdVisibility />}
                                onClick={() => navigate(`/patients/${id}/visits/${visit.id}`)}
                              />
                              {visit.consultation_fee && visit.amount_paid < visit.consultation_fee && (
                                <IconButton
                                  aria-label="Record payment"
                                  variant="ghost"
                                  size="sm"
                                  color="green.500"
                                  icon={<MdCreditCard />}
                                  onClick={() => openPaymentDialog(visit)}
                                />
                              )}
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

          <TabPanel p="0">
            {clinicalRecords.length === 0 ? (
              <Card>
                <EmptyState>No clinical records found</EmptyState>
              </Card>
            ) : (
              <Stack spacing="16px">
                {clinicalRecords.map((record: any) => (
                  <SectionCard
                    key={record.id}
                    title={`${new Date(record.created_at).toLocaleDateString()} - Visit #${record.visit_id}`}
                    actions={
                      <>
                        {record.diagnosis ? <Badge colorScheme="green">Diagnosis Complete</Badge> : <Badge colorScheme="yellow">Pending Diagnosis</Badge>}
                        <IconButton
                          aria-label="View change history"
                          title="View change history"
                          variant="ghost"
                          size="sm"
                          icon={<MdHistory />}
                          onClick={() => {
                            setSelectedRecordId(record.id)
                            setIsHistoryDialogOpen(true)
                          }}
                        />
                        <IconButton
                          aria-label="Edit record"
                          title="Edit record"
                          variant="ghost"
                          size="sm"
                          icon={<MdEdit />}
                          onClick={() => {
                            setEditingRecord({ ...record })
                            setIsEditRecordDialogOpen(true)
                          }}
                        />
                      </>
                    }
                  >
                    <Stack spacing="12px" fontSize="sm">
                      {record.chief_complaint && (
                        <Box>
                          <Text fontWeight="500">Chief Complaint:</Text>
                          <Text color="secondaryGray.600">{record.chief_complaint}</Text>
                        </Box>
                      )}
                      {record.history_of_present_illness && (
                        <Box>
                          <Text fontWeight="500">History of Present Illness:</Text>
                          <Text color="secondaryGray.600">{record.history_of_present_illness}</Text>
                        </Box>
                      )}
                      <SimpleGrid columns={2} spacing="16px">
                        {record.visual_acuity_od && <InfoLine label="VA OD" value={record.visual_acuity_od} />}
                        {record.visual_acuity_os && <InfoLine label="VA OS" value={record.visual_acuity_os} />}
                        {record.iop_od && <InfoLine label="IOP OD" value={record.iop_od} />}
                        {record.iop_os && <InfoLine label="IOP OS" value={record.iop_os} />}
                      </SimpleGrid>
                      {record.diagnosis && (
                        <Box>
                          <Text fontWeight="500">Diagnosis:</Text>
                          <Text color="secondaryGray.600">{record.diagnosis}</Text>
                        </Box>
                      )}
                      {record.management_plan && (
                        <Box>
                          <Text fontWeight="500">Management Plan:</Text>
                          <Text color="secondaryGray.600">{record.management_plan}</Text>
                        </Box>
                      )}
                      {record.follow_up_date && <InfoLine label="Follow-up" value={new Date(record.follow_up_date).toLocaleDateString()} />}
                    </Stack>
                  </SectionCard>
                ))}
              </Stack>
            )}
          </TabPanel>

          <TabPanel p="0">
            {patientScans.length === 0 ? (
              <Card>
                <EmptyState>No scans recorded for this patient</EmptyState>
              </Card>
            ) : (
              <Card>
                <TableBox border="none">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Date</Th>
                        <Th>Scan #</Th>
                        <Th>Type</Th>
                        <Th>Status</Th>
                        <Th>Results</Th>
                        <Th>Payment</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {patientScans.map((scan: any) => (
                        <Tr key={scan.id}>
                          <Td>{scan.scan_date ? new Date(scan.scan_date).toLocaleDateString() : '-'}</Td>
                          <Td fontFamily="mono">{scan.scan_number}</Td>
                          <Td>
                            <Badge colorScheme={scanTypeScheme[scan.scan_type] || 'orange'}>{scan.scan_type?.toUpperCase()}</Badge>
                          </Td>
                          <Td>
                            <Badge
                              colorScheme={scan.status === 'completed' || scan.status === 'reviewed' ? 'green' : 'gray'}
                              variant={scan.status === 'pending' || scan.status === 'completed' || scan.status === 'reviewed' ? 'subtle' : 'outline'}
                            >
                              {String(scan.status ?? '').replace(/_/g, ' ')}
                            </Badge>
                          </Td>
                          <Td maxW="200px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                            {scan.results_summary || '-'}
                          </Td>
                          <Td>
                            {scan.payment?.is_paid ? (
                              <Badge colorScheme="green">
                                <Icon as={MdCheckCircle} me="4px" verticalAlign="middle" />
                                Paid
                              </Badge>
                            ) : (
                              <Badge colorScheme="red">Unpaid</Badge>
                            )}
                          </Td>
                          <Td>
                            <Flex gap="4px">
                              <IconButton
                                aria-label="View scan"
                                variant="ghost"
                                size="sm"
                                icon={<MdVisibility />}
                                onClick={() => navigate(`/technician/scans/${scan.id}`)}
                              />
                              {scan.has_pdf && (
                                <IconButton aria-label="Open PDF" variant="ghost" size="sm" icon={<MdDescription />} onClick={() => openScanPdf(scan.id)} />
                              )}
                            </Flex>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableBox>
              </Card>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* New Visit Dialog */}
      <AppModal
        isOpen={isVisitDialogOpen}
        onClose={() => setIsVisitDialogOpen(false)}
        size="lg"
        title={`Record New Visit for ${patient.first_name} ${patient.last_name}`}
        footer={
          <>
            <Button variant="light" onClick={() => setIsVisitDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-visit-form" variant="brand" isLoading={createVisitMutation.isPending} loadingText="Recording...">
              Record Visit
            </Button>
          </>
        }
      >
        <form id="new-visit-form" onSubmit={handleCreateVisit}>
          <Stack spacing="16px">
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
                  <Text color="secondaryGray.600">Detecting visit type...</Text>
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
                      <Input
                        variant="main"
                        value={visitForm.insurance_number}
                        onChange={(e) => setVisitForm({ ...visitForm, insurance_number: e.target.value })}
                      />
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
          </Stack>
        </form>
      </AppModal>

      {/* Record History Dialog */}
      <AppModal
        isOpen={isHistoryDialogOpen}
        onClose={() => setIsHistoryDialogOpen(false)}
        size="2xl"
        title="Clinical Record Change History"
        footer={
          <Button variant="light" onClick={() => setIsHistoryDialogOpen(false)}>
            Close
          </Button>
        }
      >
        {recordHistory.length === 0 ? (
          <EmptyState>No change history available</EmptyState>
        ) : (
          <Stack spacing="12px">
            {recordHistory.map((entry: any) => (
              <RowBox key={entry.id} display="block">
                <Flex justify="space-between" align="start" mb="8px">
                  <Box>
                    <Badge colorScheme={entry.action === 'create' ? 'green' : 'gray'}>{entry.action.toUpperCase()}</Badge>
                    <Text as="span" ms="8px" fontWeight="500">
                      {entry.change_summary}
                    </Text>
                  </Box>
                  <Text fontSize="xs" color="secondaryGray.600">
                    {new Date(entry.created_at).toLocaleString()}
                  </Text>
                </Flex>
                {entry.modified_by && (
                  <Text fontSize="sm" color="secondaryGray.600">
                    By: {entry.modified_by.full_name}
                  </Text>
                )}
                {entry.field_name && entry.action === 'update' && (
                  <SimpleGrid columns={2} spacing="8px" mt="8px" fontSize="sm">
                    <Box bg="red.50" p="8px" borderRadius="8px">
                      <Text fontWeight="500" color="red.700">
                        Before:
                      </Text>
                      <Text color="red.600">{entry.old_value || '(empty)'}</Text>
                    </Box>
                    <Box bg="green.50" p="8px" borderRadius="8px">
                      <Text fontWeight="500" color="green.700">
                        After:
                      </Text>
                      <Text color="green.600">{entry.new_value || '(empty)'}</Text>
                    </Box>
                  </SimpleGrid>
                )}
              </RowBox>
            ))}
          </Stack>
        )}
      </AppModal>

      {/* Edit Record Dialog */}
      <AppModal
        isOpen={isEditRecordDialogOpen}
        onClose={() => setIsEditRecordDialogOpen(false)}
        size="3xl"
        title="Edit Clinical Record"
        footer={
          <>
            <Button variant="light" onClick={() => setIsEditRecordDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" isLoading={updateRecordMutation.isPending} loadingText="Saving..." onClick={() => updateRecordMutation.mutate(editingRecord)}>
              Save Changes
            </Button>
          </>
        }
      >
        {editingRecord && (
          <Stack spacing="16px">
            <Field label="Chief Complaint">
              <Textarea variant="main" placeholder="Chief complaint..." value={editingRecord.chief_complaint || ''} onChange={editField('chief_complaint')} />
            </Field>
            <Field label="History of Present Illness">
              <Textarea
                variant="main"
                placeholder="History of present illness..."
                value={editingRecord.history_of_present_illness || ''}
                onChange={editField('history_of_present_illness')}
              />
            </Field>
            <SimpleGrid columns={2} spacing="16px">
              <Field label="Visual Acuity OD">
                <Textarea variant="main" minH="60px" value={editingRecord.visual_acuity_od || ''} onChange={editField('visual_acuity_od')} />
              </Field>
              <Field label="Visual Acuity OS">
                <Textarea variant="main" minH="60px" value={editingRecord.visual_acuity_os || ''} onChange={editField('visual_acuity_os')} />
              </Field>
              <Field label="IOP OD">
                <Textarea variant="main" minH="60px" value={editingRecord.iop_od || ''} onChange={editField('iop_od')} />
              </Field>
              <Field label="IOP OS">
                <Textarea variant="main" minH="60px" value={editingRecord.iop_os || ''} onChange={editField('iop_os')} />
              </Field>
            </SimpleGrid>
            <Field label="Diagnosis">
              <Textarea variant="main" placeholder="Diagnosis..." value={editingRecord.diagnosis || ''} onChange={editField('diagnosis')} />
            </Field>
            <Field label="Management Plan">
              <Textarea variant="main" placeholder="Management plan..." value={editingRecord.management_plan || ''} onChange={editField('management_plan')} />
            </Field>
          </Stack>
        )}
      </AppModal>

      {/* Payment Dialog */}
      <AppModal
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        title="Record Payment"
        footer={
          <>
            <Button variant="light" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              isDisabled={!paymentForm.amount}
              isLoading={recordPaymentMutation.isPending}
              loadingText="Processing..."
              onClick={handleRecordPayment}
            >
              Record Payment
            </Button>
          </>
        }
      >
        {paymentVisit && (
          <Stack spacing="16px">
            <Box bg={mutedBg} p="12px" borderRadius="12px" fontSize="sm">
              <Flex justify="space-between">
                <Text>Visit Date:</Text>
                <Text>{new Date(paymentVisit.visit_date).toLocaleDateString()}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text>Consultation Fee:</Text>
                <Text>GHS {paymentVisit.consultation_fee?.toFixed(2)}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text>Already Paid:</Text>
                <Text>GHS {paymentVisit.amount_paid?.toFixed(2) || '0.00'}</Text>
              </Flex>
              <Divider my="8px" />
              <Flex justify="space-between" fontWeight="500" color="red.500">
                <Text>Balance Due:</Text>
                <Text>GHS {((paymentVisit.consultation_fee || 0) - (paymentVisit.amount_paid || 0)).toFixed(2)}</Text>
              </Flex>
            </Box>
            <Field label="Payment Amount (GHS)">
              <Input variant="main" type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
            </Field>
            <Field label="Payment Method">
              <Select variant="main" value={paymentForm.payment_method} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="insurance">Insurance</option>
              </Select>
            </Field>
            <Field label="Notes (Optional)">
              <Textarea variant="main" rows={2} placeholder="Payment notes..." value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
            </Field>
          </Stack>
        )}
      </AppModal>
    </>
  )
}
