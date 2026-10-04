import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Divider,
  Flex,
  Heading,
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
  Wrap,
  useColorModeValue,
} from '@chakra-ui/react'
import { MdAccessTime, MdAdd, MdArrowBack, MdCheckCircle, MdDelete, MdDescription, MdDownload, MdSave, MdVisibility, MdWarningAmber } from 'react-icons/md'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import SectionCard from '@/components/card/SectionCard'
import { RowBox } from '@/components/dashboard/widgets'
import { AppModal, EmptyState, Field, SearchInput } from '@/components/ui'

const LENS_MATERIALS = ['CR-39', 'Polycarbonate', 'Hi-index', 'Glass', 'Trivex']
const LENS_COATINGS = ['ARC', 'Blue-cut', 'Photochromic', 'Scratch-resistant', 'UV Protection', 'Fashion', 'Sun']

const SCAN_TYPES: Record<string, { label: string; description: string; color: string; scheme: string }> = {
  oct: { label: 'OCT Scan', description: 'Optical Coherence Tomography - Retinal imaging', color: 'blue.500', scheme: 'blue' },
  vft: { label: 'Visual Field Test', description: 'Visual Field Testing - Peripheral vision assessment', color: 'purple.500', scheme: 'purple' },
  fundus: { label: 'Fundus Photography', description: 'Fundus Photography - Retinal photography', color: 'green.500', scheme: 'green' },
  pachymeter: { label: 'Pachymeter', description: 'Pachymeter - Corneal thickness measurement', color: 'orange.500', scheme: 'orange' },
}

const TABS = ['history', 'examination', 'diagnosis', 'scans', 'ai-summary']

interface PrescriptionItem {
  id?: number
  product_id?: number
  item_type: 'medication' | 'spectacle' | 'lens' | 'other'
  name: string
  description: string
  dosage?: string
  duration?: string
  quantity: number
  unit_price: number
  stock_quantity?: number
  is_external?: boolean // For items not in our inventory
}

const emptyItem: PrescriptionItem = { item_type: 'medication', name: '', description: '', dosage: '', duration: '', quantity: 1, unit_price: 0 }

const emptyClinicalRecord = {
  chief_complaint: '',
  history_of_present_illness: '',
  past_ocular_history: '',
  past_medical_history: '',
  family_history: '',
  visual_acuity_od: '',
  visual_acuity_os: '',
  iop_od: '',
  iop_os: '',
  refraction_od_sphere: '',
  refraction_od_cylinder: '',
  refraction_od_axis: '',
  refraction_os_sphere: '',
  refraction_os_cylinder: '',
  refraction_os_axis: '',
  refraction_add: '',
  refraction_pd: '',
  anterior_segment_od: '',
  anterior_segment_os: '',
  posterior_segment_od: '',
  posterior_segment_os: '',
  retina_od: '',
  retina_os: '',
  diagnosis: '',
  management_plan: '',
  follow_up_date: '',
  notes: '',
}

const calculateAge = (dob: string) => {
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}

// Escape model output before applying the light markdown formatting, so it can't inject HTML.
const formatAiAnalysis = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gim, '<h3 style="font-weight:600;font-size:1.125rem;margin:1rem 0 .5rem">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="font-weight:700;font-size:1.25rem;margin:1rem 0 .5rem">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="font-weight:700;font-size:1.5rem;margin:1rem 0 .5rem">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li style="margin-left:1rem">$1</li>')
    .replace(/\n/g, '<br/>')

export default function ConsultationPage() {
  const { visitId } = useParams<{ visitId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuthStore()
  const mutedBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const menuBg = useColorModeValue('white', 'navy.800')

  const [activeTab, setActiveTab] = useState('examination')
  const [isPrescriptionDialogOpen, setIsPrescriptionDialogOpen] = useState(false)
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductResults, setShowProductResults] = useState(false)
  const [newPrescriptionItem, setNewPrescriptionItem] = useState<PrescriptionItem>(emptyItem)
  const [showScanRequestDialog, setShowScanRequestDialog] = useState(false)
  const [selectedScanType, setSelectedScanType] = useState<string>('')
  const [scanNotes, setScanNotes] = useState('')

  // Search products for prescription (with stock info) - filter by category type based on item type
  const { data: productResults = [] } = useQuery({
    queryKey: ['products-search', productSearch, newPrescriptionItem.item_type],
    queryFn: async () => {
      if (productSearch.length < 2) return []
      const categoryType =
        newPrescriptionItem.item_type === 'medication' ? 'medication' : ['spectacle', 'lens'].includes(newPrescriptionItem.item_type) ? 'optical' : ''
      const categoryParam = categoryType ? `&category_type=${categoryType}` : ''
      return (await api.get(`/sales/products?search=${productSearch}&include_stock=true${categoryParam}`)).data
    },
    enabled: productSearch.length >= 2,
  })

  useEffect(() => {
    setShowProductResults(productSearch.length >= 2 && productResults.length > 0)
  }, [productSearch, productResults])

  // Initialize clinical record from session storage if available
  const [clinicalRecord, setClinicalRecord] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`consultation-${visitId}`) || '') || emptyClinicalRecord
    } catch {
      return emptyClinicalRecord
    }
  })

  const emptyOptical = () => ({
    sphere_od: '',
    cylinder_od: '',
    axis_od: '',
    va_od: '',
    sphere_os: '',
    cylinder_os: '',
    axis_os: '',
    va_os: '',
    add_power: '',
    pd: '',
    segment_height: '',
    lens_type: '',
    lens_material: [] as string[],
    lens_coating: [] as string[],
    frame_code: '',
    frame_size: '',
    dispensed_by_name: user ? `${user.first_name} ${user.last_name}`.trim() : '',
    delivery_date: '',
    remarks: '',
  })

  // Optical prescription form state (pre-filled from refraction data)
  const [opticalPrescription, setOpticalPrescription] = useState(emptyOptical)

  // Save to session storage whenever clinical record changes
  useEffect(() => {
    if (visitId) sessionStorage.setItem(`consultation-${visitId}`, JSON.stringify(clinicalRecord))
  }, [clinicalRecord, visitId])

  // Pre-fill optical prescription from refraction data
  useEffect(() => {
    setOpticalPrescription((prev) => ({
      ...prev,
      sphere_od: clinicalRecord.refraction_od_sphere || prev.sphere_od,
      cylinder_od: clinicalRecord.refraction_od_cylinder || prev.cylinder_od,
      axis_od: clinicalRecord.refraction_od_axis || prev.axis_od,
      va_od: clinicalRecord.visual_acuity_od || prev.va_od,
      sphere_os: clinicalRecord.refraction_os_sphere || prev.sphere_os,
      cylinder_os: clinicalRecord.refraction_os_cylinder || prev.cylinder_os,
      axis_os: clinicalRecord.refraction_os_axis || prev.axis_os,
      va_os: clinicalRecord.visual_acuity_os || prev.va_os,
      add_power: clinicalRecord.refraction_add || prev.add_power,
      pd: clinicalRecord.refraction_pd || prev.pd,
    }))
  }, [
    clinicalRecord.refraction_od_sphere,
    clinicalRecord.refraction_od_cylinder,
    clinicalRecord.refraction_od_axis,
    clinicalRecord.refraction_os_sphere,
    clinicalRecord.refraction_os_cylinder,
    clinicalRecord.refraction_os_axis,
    clinicalRecord.refraction_add,
    clinicalRecord.refraction_pd,
    clinicalRecord.visual_acuity_od,
    clinicalRecord.visual_acuity_os,
  ])

  const { data: visit, isLoading: visitLoading } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: async () => (await api.get(`/clinical/visits/${visitId}`)).data,
  })

  const { data: patient } = useQuery({
    queryKey: ['patient', visit?.patient_id],
    queryFn: async () => (await api.get(`/patients/${visit.patient_id}`)).data,
    enabled: !!visit?.patient_id,
  })

  const { data: patientHistory = [] } = useQuery({
    queryKey: ['patient-history', visit?.patient_id],
    queryFn: async () => (await api.get(`/clinical/patients/${visit.patient_id}/records`)).data,
    enabled: !!visit?.patient_id,
  })

  // Fetch existing prescriptions for this visit
  const { data: visitPrescriptions = [] } = useQuery({
    queryKey: ['visit-prescriptions', visitId],
    queryFn: async () => (await api.get(`/clinical/visits/${visitId}/prescriptions`)).data,
    enabled: !!visitId,
  })

  // Fetch scans for this visit/patient
  const { data: visitScans = [] } = useQuery({
    queryKey: ['visit-scans', visitId, visit?.patient_id],
    queryFn: async () => (await api.get(`/technician/scans?visit_id=${visitId}`)).data,
    enabled: !!visitId,
  })

  // Fetch patient's past scans (for history)
  const { data: patientScans = [] } = useQuery({
    queryKey: ['patient-scans', visit?.patient_id],
    queryFn: async () => (await api.get(`/technician/scans?patient_id=${visit.patient_id}`)).data,
    enabled: !!visit?.patient_id,
  })

  // Fetch insurance balance for this visit
  const { data: insuranceBalance } = useQuery({
    queryKey: ['insurance-balance', visitId],
    queryFn: async () => (await api.get(`/patients/visits/${visitId}/insurance-balance`)).data,
    enabled: !!visitId,
  })

  // AI Status and Analysis
  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: async () => (await api.get('/ai/status')).data,
  })

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const requestAiAnalysis = async () => {
    setIsAnalyzing(true)
    try {
      const response = await api.post('/ai/analyze', {
        patient: {
          age: patient?.date_of_birth ? calculateAge(patient.date_of_birth) : 'Unknown',
          sex: patient?.sex || 'Unknown',
        },
        clinical_record: clinicalRecord,
        patient_history: patientHistory, // Include patient history for AI analysis
      })
      setAiAnalysis(response.data.analysis)
    } catch (error: any) {
      toast({ title: 'AI Analysis Failed', description: error.response?.data?.detail || 'Could not complete analysis', variant: 'destructive' })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const saveClinicalRecordMutation = useMutation({
    mutationFn: (data: typeof clinicalRecord) => api.post(`/clinical/visits/${visitId}/record`, data),
    onSuccess: () => {
      toast({ title: 'Clinical record saved' })
      queryClient.invalidateQueries({ queryKey: ['visit', visitId] })
    },
    onError: () => {
      toast({ title: 'Failed to save clinical record', variant: 'destructive' })
    },
  })

  const createPrescriptionMutation = useMutation({
    mutationFn: (items: PrescriptionItem[]) => api.post(`/clinical/visits/${visitId}/prescription`, { items }),
    onSuccess: () => {
      toast({ title: 'Prescription created and sent to front desk' })
      setPrescriptionItems([])
      setIsPrescriptionDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['visit', visitId] })
    },
    onError: () => {
      toast({ title: 'Failed to create prescription', variant: 'destructive' })
    },
  })

  const saveOpticalPrescriptionMutation = useMutation({
    mutationFn: (data: typeof opticalPrescription) => api.post(`/clinical/visits/${visitId}/optical-prescription`, data),
    onSuccess: () => {
      toast({ title: 'Optical prescription saved successfully' })
      queryClient.invalidateQueries({ queryKey: ['visit-prescriptions', visitId] })
      setOpticalPrescription(emptyOptical())
    },
    onError: () => {
      toast({ title: 'Failed to save optical prescription', variant: 'destructive' })
    },
  })

  const handleSaveOpticalPrescription = () => {
    if (!opticalPrescription.sphere_od && !opticalPrescription.sphere_os) {
      toast({ title: 'Please enter at least one prescription value', variant: 'destructive' })
      return
    }
    saveOpticalPrescriptionMutation.mutate(opticalPrescription)
  }

  // Open PDFs with authentication
  const openPdf = async (url: string, errorTitle: string) => {
    try {
      const response = await api.get(url, { responseType: 'blob' })
      window.open(window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' })), '_blank')
    } catch {
      toast({ title: errorTitle, variant: 'destructive' })
    }
  }

  const completeConsultationMutation = useMutation({
    mutationFn: () => api.patch(`/clinical/visits/${visitId}/status`, { status: 'completed' }),
    onSuccess: () => {
      // Clear session storage for this consultation
      sessionStorage.removeItem(`consultation-${visitId}`)
      toast({ title: 'Consultation completed' })
      navigate('/doctor/queue')
    },
  })

  const requestScanMutation = useMutation({
    mutationFn: async (data: { scan_type: string; notes?: string }) =>
      (
        await api.post('/clinical/request-scan', {
          patient_id: visit?.patient_id,
          visit_id: parseInt(visitId || '0'),
          consultation_id: visit?.consultation_id,
          scan_type: data.scan_type,
          notes: data.notes,
        })
      ).data,
    onSuccess: () => {
      toast({ title: 'Scan requested', description: 'The technician will be notified' })
      closeScanDialog()
      queryClient.invalidateQueries({ queryKey: ['visit-scans'] })
    },
    onError: (error: any) => {
      toast({ title: 'Failed to request scan', description: error.response?.data?.detail || 'Please try again', variant: 'destructive' })
    },
  })

  const closeScanDialog = () => {
    setShowScanRequestDialog(false)
    setSelectedScanType('')
    setScanNotes('')
  }

  const handleRequestScan = () => {
    if (!selectedScanType) {
      toast({ title: 'Please select a scan type', variant: 'destructive' })
      return
    }
    requestScanMutation.mutate({ scan_type: selectedScanType, notes: scanNotes })
  }

  const addPrescriptionItem = () => {
    if (!newPrescriptionItem.name) return
    setPrescriptionItems([...prescriptionItems, { ...newPrescriptionItem }])
    setNewPrescriptionItem(emptyItem)
  }

  const handleCreatePrescription = () => {
    if (prescriptionItems.length === 0) {
      toast({ title: 'Add at least one item to the prescription', variant: 'destructive' })
      return
    }
    createPrescriptionMutation.mutate(prescriptionItems)
  }

  const rec = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setClinicalRecord({ ...clinicalRecord, [key]: e.target.value })
  const opt = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setOpticalPrescription({ ...opticalPrescription, [key]: e.target.value })
  const toggleList = (key: 'lens_material' | 'lens_coating', value: string, checked: boolean) =>
    setOpticalPrescription({
      ...opticalPrescription,
      [key]: checked ? [...opticalPrescription[key], value] : opticalPrescription[key].filter((v) => v !== value),
    })

  if (visitLoading) {
    return (
      <Flex justify="center" align="center" h="256px">
        <Spinner color="brand.500" />
      </Flex>
    )
  }

  const pendingScanCount = visitScans.filter((s: any) => s.status === 'pending').length
  const previousScans = patientScans.filter((s: any) => !visitScans.some((vs: any) => vs.id === s.id))
  const prescriptionTotal = prescriptionItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  const newMedications = prescriptionItems.filter((item) => item.item_type === 'medication')
  const savedOptical = visitPrescriptions.filter((p: any) => p.sphere_od || p.sphere_os)
  const insuranceOk = insuranceBalance?.insurance_remaining > 0
  const scanInfo = SCAN_TYPES[selectedScanType]

  // OD / OS two-column layout for examination fields
  const eyeColumns = (render: (eye: 'od' | 'os') => React.ReactNode) => (
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing="24px">
      {(['od', 'os'] as const).map((eye) => (
        <Stack key={eye} spacing="16px">
          <Text fontWeight="600">{eye === 'od' ? 'Right Eye (OD)' : 'Left Eye (OS)'}</Text>
          {render(eye)}
        </Stack>
      ))}
    </SimpleGrid>
  )

  return (
    <>
      <Flex justify="space-between" align={{ base: 'start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap="12px" mb="20px">
        <Flex align="center" gap="16px">
          <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate('/doctor/queue')}>
            Back to Queue
          </Button>
          <Box>
            <Heading size="lg" data-tour="page-title">
              {patient?.first_name} {patient?.last_name}
            </Heading>
            <Flex align="center" gap="8px" color="secondaryGray.600">
              <Badge variant="outline">{patient?.patient_number}</Badge>
              <span>•</span>
              <span>{patient?.sex}</span>
              <span>•</span>
              <span>{patient?.date_of_birth}</span>
            </Flex>
          </Box>
        </Flex>
        <Button variant="brand" onClick={() => completeConsultationMutation.mutate()}>
          Complete Consultation
        </Button>
      </Flex>

      {/* Payment Alert for Partial Payments */}
      {visit?.payment_status === 'partial' && (
        <Alert status="warning" borderRadius="16px" mb="16px" alignItems="start">
          <AlertIcon />
          <Box>
            <Text fontWeight="600">Outstanding Balance</Text>
            <Text fontSize="sm">
              This patient has a partial payment. Balance due:{' '}
              <strong>GH₵{((visit.consultation_fee || 0) - (visit.amount_paid || 0)).toLocaleString()}</strong>
            </Text>
            <Text fontSize="xs" mt="4px">
              Please remind the patient to complete payment at checkout.
            </Text>
          </Box>
        </Alert>
      )}

      {/* Insurance Balance Card */}
      {insuranceBalance?.is_insurance && (
        <Alert status={insuranceOk ? 'info' : 'error'} borderRadius="16px" mb="16px" display="block">
          <Flex justify="space-between" align="center" mb="8px">
            <Text fontWeight="600">Insurance: {insuranceBalance.insurance_provider || 'Unknown Provider'}</Text>
            <Badge colorScheme={insuranceOk ? 'brand' : 'red'}>{insuranceOk ? 'Active' : 'Limit Exceeded'}</Badge>
          </Flex>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing="16px" fontSize="sm">
            <Box>
              <Text color="secondaryGray.600">Limit:</Text>
              <Text fontWeight="500">GH₵{insuranceBalance.insurance_limit?.toLocaleString()}</Text>
            </Box>
            <Box>
              <Text color="secondaryGray.600">Used:</Text>
              <Text fontWeight="500">GH₵{insuranceBalance.insurance_used?.toLocaleString()}</Text>
            </Box>
            <Box color={insuranceOk ? 'green.500' : 'red.500'}>
              <Text>Remaining:</Text>
              <Text fontWeight="bold">GH₵{insuranceBalance.insurance_remaining?.toLocaleString()}</Text>
            </Box>
            {insuranceBalance.patient_topup > 0 && (
              <Box color="red.500">
                <Text>Patient Top-up:</Text>
                <Text fontWeight="bold">GH₵{insuranceBalance.patient_topup?.toLocaleString()}</Text>
              </Box>
            )}
          </SimpleGrid>
          {insuranceOk && (
            <Text fontSize="xs" color="blue.600" mt="8px">
              Medications up to GH₵{insuranceBalance.insurance_remaining?.toLocaleString()} will be covered by insurance.
            </Text>
          )}
          {insuranceBalance.patient_topup > 0 && (
            <Text fontSize="xs" color="red.500" mt="8px">
              Patient must pay GH₵{insuranceBalance.patient_topup?.toLocaleString()} out of pocket.
            </Text>
          )}
        </Alert>
      )}

      <Tabs variant="soft-rounded" index={TABS.indexOf(activeTab)} onChange={(i) => setActiveTab(TABS[i])} isLazy>
        <TabList gap="8px" flexWrap="wrap" mb="16px">
          <Tab>Patient History</Tab>
          <Tab>Examination</Tab>
          <Tab>Diagnosis & Plan</Tab>
          <Tab>
            Scans
            {pendingScanCount > 0 && (
              <Badge colorScheme="yellow" variant="solid" borderRadius="full" ms="8px">
                {pendingScanCount}
              </Badge>
            )}
          </Tab>
          {aiStatus?.enabled && <Tab>AI Summary</Tab>}
        </TabList>

        <TabPanels>
          {/* History */}
          <TabPanel p="0">
            <SectionCard title="Previous Visits & Records">
              {patientHistory.length === 0 ? (
                <EmptyState>No previous records found for this patient</EmptyState>
              ) : (
                <Stack spacing="16px">
                  {patientHistory.map((record: any) => (
                    <RowBox key={record.id} display="block" p="16px">
                      <Flex justify="space-between" align="start" mb="8px">
                        <Text fontWeight="500" fontSize="lg">
                          {new Date(record.visit_date || record.created_at).toLocaleDateString()}
                        </Text>
                        <Flex gap="8px">
                          <Badge variant="outline">{record.consultation_type || 'Consultation'}</Badge>
                          {record.diagnosis ? <Badge colorScheme="green">Diagnosed</Badge> : <Badge colorScheme="yellow">Pending Diagnosis</Badge>}
                        </Flex>
                      </Flex>
                      <Stack spacing="8px" fontSize="sm">
                        {record.chief_complaint && (
                          <Box>
                            <strong>Chief Complaint:</strong>
                            <Text color="secondaryGray.600">{record.chief_complaint}</Text>
                          </Box>
                        )}
                        <SimpleGrid columns={2} spacing="16px">
                          {record.visual_acuity_od && (
                            <Box>
                              <strong>VA OD:</strong> {record.visual_acuity_od}
                            </Box>
                          )}
                          {record.visual_acuity_os && (
                            <Box>
                              <strong>VA OS:</strong> {record.visual_acuity_os}
                            </Box>
                          )}
                          {record.iop_od && (
                            <Box>
                              <strong>IOP OD:</strong> {record.iop_od}
                            </Box>
                          )}
                          {record.iop_os && (
                            <Box>
                              <strong>IOP OS:</strong> {record.iop_os}
                            </Box>
                          )}
                        </SimpleGrid>
                        {record.diagnosis && (
                          <Box>
                            <strong>Diagnosis:</strong>
                            <Text color="secondaryGray.600">{record.diagnosis}</Text>
                          </Box>
                        )}
                        {record.management_plan && (
                          <Box>
                            <strong>Management Plan:</strong>
                            <Text color="secondaryGray.600">{record.management_plan}</Text>
                          </Box>
                        )}
                        {record.follow_up_date && (
                          <Box>
                            <strong>Follow-up:</strong> {new Date(record.follow_up_date).toLocaleDateString()}
                          </Box>
                        )}
                      </Stack>
                    </RowBox>
                  ))}
                </Stack>
              )}
            </SectionCard>
          </TabPanel>

          {/* Examination */}
          <TabPanel p="0">
            <Stack spacing="20px">
              <SectionCard title="Chief Complaint & History">
                <Stack spacing="16px">
                  <Field label="Chief Complaint">
                    <Textarea variant="main" placeholder="Patient's main complaint..." value={clinicalRecord.chief_complaint} onChange={rec('chief_complaint')} />
                  </Field>
                  <Field label="History of Present Illness">
                    <Textarea
                      variant="main"
                      placeholder="Detailed history..."
                      value={clinicalRecord.history_of_present_illness}
                      onChange={rec('history_of_present_illness')}
                    />
                  </Field>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing="16px">
                    <Field label="Past Ocular History">
                      <Textarea variant="main" value={clinicalRecord.past_ocular_history} onChange={rec('past_ocular_history')} />
                    </Field>
                    <Field label="Past Medical History">
                      <Textarea variant="main" value={clinicalRecord.past_medical_history} onChange={rec('past_medical_history')} />
                    </Field>
                  </SimpleGrid>
                  <Field label="Family History">
                    <Textarea variant="main" value={clinicalRecord.family_history} onChange={rec('family_history')} />
                  </Field>
                </Stack>
              </SectionCard>

              <SectionCard title="Visual Acuity & IOP">
                {eyeColumns((eye) => (
                  <SimpleGrid columns={2} spacing="16px">
                    <Field label="Visual Acuity">
                      <Input variant="main" placeholder="e.g., 6/6" value={clinicalRecord[`visual_acuity_${eye}`]} onChange={rec(`visual_acuity_${eye}`)} />
                    </Field>
                    <Field label="IOP (mmHg)">
                      <Input variant="main" placeholder="e.g., 15" value={clinicalRecord[`iop_${eye}`]} onChange={rec(`iop_${eye}`)} />
                    </Field>
                  </SimpleGrid>
                ))}
              </SectionCard>

              <SectionCard title="Refraction">
                {eyeColumns((eye) => (
                  <SimpleGrid columns={3} spacing="12px">
                    <Field label="Sphere (SPH)">
                      <Input variant="main" placeholder="e.g., -2.00" value={clinicalRecord[`refraction_${eye}_sphere`]} onChange={rec(`refraction_${eye}_sphere`)} />
                    </Field>
                    <Field label="Cylinder (CYL)">
                      <Input
                        variant="main"
                        placeholder="e.g., -0.50"
                        value={clinicalRecord[`refraction_${eye}_cylinder`]}
                        onChange={rec(`refraction_${eye}_cylinder`)}
                      />
                    </Field>
                    <Field label="Axis">
                      <Input variant="main" placeholder="e.g., 180" value={clinicalRecord[`refraction_${eye}_axis`]} onChange={rec(`refraction_${eye}_axis`)} />
                    </Field>
                  </SimpleGrid>
                ))}
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing="24px" mt="16px">
                  <Field label="Add (Near)">
                    <Input variant="main" placeholder="e.g., +2.00" value={clinicalRecord.refraction_add} onChange={rec('refraction_add')} />
                  </Field>
                  <Field label="PD (mm)">
                    <Input variant="main" placeholder="e.g., 64" value={clinicalRecord.refraction_pd} onChange={rec('refraction_pd')} />
                  </Field>
                </SimpleGrid>
              </SectionCard>

              <SectionCard title="Segment Examination">
                {eyeColumns((eye) => (
                  <>
                    <Field label="Anterior Segment">
                      <Textarea variant="main" value={clinicalRecord[`anterior_segment_${eye}`]} onChange={rec(`anterior_segment_${eye}`)} />
                    </Field>
                    <Field label="Posterior Segment">
                      <Textarea variant="main" value={clinicalRecord[`posterior_segment_${eye}`]} onChange={rec(`posterior_segment_${eye}`)} />
                    </Field>
                    <Field label="Retina">
                      <Textarea variant="main" placeholder="Retina examination findings..." value={clinicalRecord[`retina_${eye}`]} onChange={rec(`retina_${eye}`)} />
                    </Field>
                  </>
                ))}
              </SectionCard>

              <Flex justify="end">
                <Button
                  variant="brand"
                  leftIcon={<MdSave />}
                  isLoading={saveClinicalRecordMutation.isPending}
                  loadingText="Saving..."
                  onClick={() => saveClinicalRecordMutation.mutate(clinicalRecord)}
                >
                  Save Examination
                </Button>
              </Flex>
            </Stack>
          </TabPanel>

          {/* Diagnosis & Plan */}
          <TabPanel p="0">
            <Stack spacing="20px">
              <SectionCard title="Diagnosis">
                <Textarea variant="main" minH="100px" placeholder="Enter diagnosis..." value={clinicalRecord.diagnosis} onChange={rec('diagnosis')} />
              </SectionCard>

              <SectionCard
                title={<Text color="blue.500">Medications</Text>}
                actions={
                  <Button
                    variant="light"
                    size="sm"
                    leftIcon={<MdAdd />}
                    onClick={() => {
                      setNewPrescriptionItem({ ...newPrescriptionItem, item_type: 'medication' })
                      setIsPrescriptionDialogOpen(true)
                    }}
                  >
                    Add Medication
                  </Button>
                }
              >
                {visitPrescriptions.some((p: any) => p.items.some((i: any) => i.item_type === 'medication')) ? (
                  <Stack spacing="8px">
                    {visitPrescriptions.map((prescription: any) =>
                      prescription.items
                        .filter((item: any) => item.item_type === 'medication')
                        .map((item: any) => (
                          <RowBox key={item.id}>
                            <Box>
                              <Text as="span" fontWeight="500">
                                {item.name}
                              </Text>
                              {item.dosage && (
                                <Text as="span" color="secondaryGray.600" ms="8px">
                                  - {item.dosage}
                                </Text>
                              )}
                              {item.duration && (
                                <Text as="span" color="secondaryGray.600" ms="8px">
                                  ({item.duration})
                                </Text>
                              )}
                              {item.is_external && (
                                <Badge variant="outline" ms="8px" fontSize="xs">
                                  External
                                </Badge>
                              )}
                              {item.was_out_of_stock && (
                                <Badge colorScheme="yellow" ms="8px" fontSize="xs">
                                  Was out of stock
                                </Badge>
                              )}
                            </Box>
                            <Flex align="center" gap="8px">
                              <Text fontSize="sm">Qty: {item.quantity}</Text>
                              <Badge colorScheme={prescription.status === 'paid' ? 'green' : 'gray'} fontSize="xs">
                                {prescription.status}
                              </Badge>
                            </Flex>
                          </RowBox>
                        )),
                    )}
                  </Stack>
                ) : (
                  <Text color="secondaryGray.600" fontSize="sm" textAlign="center" py="16px">
                    No medications prescribed yet
                  </Text>
                )}

                {/* New Medication Items (not yet saved) */}
                {newMedications.length > 0 && (
                  <Box mt="12px" pt="12px" borderTop="1px solid" borderColor={borderColor}>
                    <Text fontSize="sm" fontWeight="500" color="blue.500" mb="8px">
                      New Medications (unsaved)
                    </Text>
                    {newMedications.map((item, index) => (
                      <Flex key={index} justify="space-between" align="center" p="8px" bg={mutedBg} borderRadius="8px" mb="4px">
                        <Box>
                          <Text as="span" fontWeight="500">
                            {item.name}
                          </Text>
                          {item.dosage && (
                            <Text as="span" color="secondaryGray.600" ms="8px">
                              - {item.dosage}
                            </Text>
                          )}
                          {item.duration && (
                            <Text as="span" color="secondaryGray.600" ms="8px">
                              ({item.duration})
                            </Text>
                          )}
                        </Box>
                        <Text fontSize="sm">Qty: {item.quantity}</Text>
                      </Flex>
                    ))}
                  </Box>
                )}
              </SectionCard>

              {/* Optical Prescription Form */}
              <SectionCard title={<Text color="purple.500">Spectacles Prescription Form</Text>}>
                <Stack spacing="24px">
                  {savedOptical.length > 0 && (
                    <Stack spacing="12px">
                      <Text fontWeight="500" fontSize="sm" color="purple.500">
                        Saved Prescriptions
                      </Text>
                      {savedOptical.map((prescription: any) => (
                        <RowBox key={prescription.id}>
                          <Text fontSize="sm">
                            <strong>OD:</strong> {prescription.sphere_od || '-'} / {prescription.cylinder_od || '-'} x {prescription.axis_od || '-'} |{' '}
                            <strong>OS:</strong> {prescription.sphere_os || '-'} / {prescription.cylinder_os || '-'} x {prescription.axis_os || '-'} |{' '}
                            <strong>Add:</strong> {prescription.add_power || '-'} | <strong>PD:</strong> {prescription.pd || '-'}
                          </Text>
                          <Button
                            variant="light"
                            size="sm"
                            leftIcon={<MdDownload />}
                            onClick={() => openPdf(`/clinical/prescriptions/${prescription.id}/download-pdf`, 'Failed to download prescription')}
                          >
                            Download PDF
                          </Button>
                        </RowBox>
                      ))}
                    </Stack>
                  )}

                  {/* Prescription Values Table */}
                  <Box border="1px solid" borderColor={borderColor} borderRadius="12px" overflowX="auto">
                    <Table size="sm">
                      <Thead bg="brand.500">
                        <Tr>
                          {['Eye', 'SPH', 'CYL', 'AXIS', 'VA'].map((h, i) => (
                            <Th key={h} color="white" textAlign={i === 0 ? 'left' : 'center'} py="10px">
                              {h}
                            </Th>
                          ))}
                        </Tr>
                      </Thead>
                      <Tbody>
                        {(['od', 'os'] as const).map((eye) => (
                          <Tr key={eye}>
                            <Td fontWeight="500">{eye === 'od' ? 'Right (OD)' : 'Left (OS)'}</Td>
                            {(['sphere', 'cylinder', 'axis', 'va'] as const).map((f) => (
                              <Td key={f} p="4px">
                                <Input variant="main" textAlign="center" value={opticalPrescription[`${f}_${eye}`]} onChange={opt(`${f}_${eye}`)} />
                              </Td>
                            ))}
                          </Tr>
                        ))}
                        <Tr>
                          <Td fontWeight="500">Add (Near)</Td>
                          <Td p="4px">
                            <Input variant="main" textAlign="center" value={opticalPrescription.add_power} onChange={opt('add_power')} />
                          </Td>
                          <Td colSpan={3} />
                        </Tr>
                      </Tbody>
                    </Table>
                  </Box>

                  <SimpleGrid columns={2} spacing="16px">
                    <Field label="PD (mm)">
                      <Input variant="main" placeholder="e.g., 64" value={opticalPrescription.pd} onChange={opt('pd')} />
                    </Field>
                    <Field label="Segment Height">
                      <Input variant="main" placeholder="e.g., 18" value={opticalPrescription.segment_height} onChange={opt('segment_height')} />
                    </Field>
                  </SimpleGrid>

                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing="16px">
                    <Field label="Lens Type">
                      <Select variant="main" placeholder="Select type" value={opticalPrescription.lens_type} onChange={opt('lens_type')}>
                        <option value="SV">SV (Single Vision)</option>
                        <option value="Bifocal">Bifocal</option>
                        <option value="Progressive">Progressive</option>
                      </Select>
                    </Field>
                    <Field label="Lens Material (select multiple)">
                      <Wrap spacing="12px" p="8px" border="1px solid" borderColor={borderColor} borderRadius="12px">
                        {LENS_MATERIALS.map((material) => (
                          <Checkbox
                            key={material}
                            size="sm"
                            isChecked={opticalPrescription.lens_material.includes(material)}
                            onChange={(e) => toggleList('lens_material', material, e.target.checked)}
                          >
                            {material}
                          </Checkbox>
                        ))}
                      </Wrap>
                    </Field>
                    <Field label="Coating (select multiple)">
                      <Wrap spacing="12px" p="8px" border="1px solid" borderColor={borderColor} borderRadius="12px">
                        {LENS_COATINGS.map((coating) => (
                          <Checkbox
                            key={coating}
                            size="sm"
                            isChecked={opticalPrescription.lens_coating.includes(coating)}
                            onChange={(e) => toggleList('lens_coating', coating, e.target.checked)}
                          >
                            {coating}
                          </Checkbox>
                        ))}
                      </Wrap>
                    </Field>
                  </SimpleGrid>

                  <SimpleGrid columns={2} spacing="16px">
                    <Field label="Frame Code">
                      <Input variant="main" placeholder="Frame code" value={opticalPrescription.frame_code} onChange={opt('frame_code')} />
                    </Field>
                    <Field label="Frame Size">
                      <Input variant="main" placeholder="e.g., 52-18-140" value={opticalPrescription.frame_size} onChange={opt('frame_size')} />
                    </Field>
                    <Field label="Dispensed By">
                      <Input variant="main" placeholder="Name of dispenser" value={opticalPrescription.dispensed_by_name} onChange={opt('dispensed_by_name')} />
                    </Field>
                    <Field label="Delivery Date">
                      <Input variant="main" type="date" value={opticalPrescription.delivery_date} onChange={opt('delivery_date')} />
                    </Field>
                  </SimpleGrid>

                  <Field label="Remarks">
                    <Textarea variant="main" placeholder="Additional notes or instructions..." value={opticalPrescription.remarks} onChange={opt('remarks')} />
                  </Field>

                  <Flex justify="end">
                    <Button
                      colorScheme="purple"
                      leftIcon={<MdSave />}
                      isDisabled={!opticalPrescription.sphere_od && !opticalPrescription.sphere_os}
                      isLoading={saveOpticalPrescriptionMutation.isPending}
                      loadingText="Saving..."
                      onClick={handleSaveOpticalPrescription}
                    >
                      Save Prescription
                    </Button>
                  </Flex>
                </Stack>
              </SectionCard>

              {/* Send All Prescriptions */}
              {prescriptionItems.length > 0 && (
                <Alert status="success" borderRadius="16px" justifyContent="space-between" flexWrap="wrap" gap="12px">
                  <Box>
                    <Text fontWeight="500">Ready to send {prescriptionItems.length} item(s) to Front Desk</Text>
                    <Text fontSize="sm">Total: GH₵{prescriptionTotal.toLocaleString()}</Text>
                  </Box>
                  <Button colorScheme="green" isLoading={createPrescriptionMutation.isPending} loadingText="Sending..." onClick={handleCreatePrescription}>
                    Send All to Front Desk
                  </Button>
                </Alert>
              )}

              <SectionCard title="Management Plan & Notes">
                <Stack spacing="16px">
                  <Textarea
                    variant="main"
                    minH="100px"
                    placeholder="Enter management plan (treatment notes, referrals, patient education, etc.)..."
                    value={clinicalRecord.management_plan}
                    onChange={rec('management_plan')}
                  />
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing="16px">
                    <Field label="Follow-up Date">
                      <Input variant="main" type="date" value={clinicalRecord.follow_up_date} onChange={rec('follow_up_date')} />
                    </Field>
                  </SimpleGrid>
                  <Field label="Additional Notes">
                    <Textarea variant="main" value={clinicalRecord.notes} onChange={rec('notes')} />
                  </Field>
                </Stack>
              </SectionCard>

              <Flex justify="end">
                <Button
                  variant="brand"
                  leftIcon={<MdSave />}
                  isLoading={saveClinicalRecordMutation.isPending}
                  loadingText="Saving..."
                  onClick={() => saveClinicalRecordMutation.mutate(clinicalRecord)}
                >
                  Save Diagnosis & Plan
                </Button>
              </Flex>
            </Stack>
          </TabPanel>

          {/* Scans */}
          <TabPanel p="0">
            <Stack spacing="20px">
              <SectionCard
                title={
                  <Flex align="center" gap="8px">
                    <Icon as={MdVisibility} />
                    Request Scan
                  </Flex>
                }
              >
                <Text fontSize="sm" color="secondaryGray.600" mb="16px">
                  Send the patient for a scan. The technician will be notified and results will appear here once completed.
                </Text>
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing="12px">
                  {Object.entries(SCAN_TYPES).map(([type, info]) => (
                    <Button
                      key={type}
                      variant="light"
                      h="80px"
                      flexDirection="column"
                      gap="8px"
                      whiteSpace="normal"
                      onClick={() => {
                        setSelectedScanType(type)
                        setShowScanRequestDialog(true)
                      }}
                    >
                      <Icon as={MdVisibility} w="24px" h="24px" color={info.color} />
                      <Text fontSize="sm">{type === 'pachymeter' ? 'Pachymeter' : info.label}</Text>
                    </Button>
                  ))}
                </SimpleGrid>
              </SectionCard>

              <SectionCard title="Scans for This Visit">
                {visitScans.length === 0 ? (
                  <EmptyState>No scans requested for this visit yet</EmptyState>
                ) : (
                  <Stack spacing="12px">
                    {visitScans.map((scan: any) => {
                      const done = scan.status === 'completed' || scan.status === 'reviewed'
                      return (
                        <RowBox key={scan.id} display="block" p="16px">
                          <Flex justify="space-between" align="center" mb="8px">
                            <Flex align="center" gap="12px">
                              <Badge colorScheme={SCAN_TYPES[scan.scan_type]?.scheme || 'orange'}>{scan.scan_type?.toUpperCase()}</Badge>
                              <Text fontWeight="500">{scan.scan_number}</Text>
                            </Flex>
                            <Badge colorScheme={done ? 'brand' : 'gray'} variant={done || scan.status === 'pending' ? 'subtle' : 'outline'}>
                              {scan.status === 'pending' && <Icon as={MdAccessTime} me="4px" verticalAlign="middle" />}
                              {scan.status === 'completed' && <Icon as={MdCheckCircle} me="4px" verticalAlign="middle" />}
                              {scan.status}
                            </Badge>
                          </Flex>

                          {scan.status === 'pending' && (
                            <Text fontSize="sm" color="secondaryGray.600">
                              Waiting for technician to perform scan...
                            </Text>
                          )}

                          {done && (
                            <Stack spacing="8px" mt="12px">
                              {scan.results_summary && (
                                <Box bg={mutedBg} borderRadius="8px" p="12px">
                                  <Text fontSize="sm" fontWeight="500" mb="4px">
                                    Results Summary
                                  </Text>
                                  <Text fontSize="sm">{scan.results_summary}</Text>
                                </Box>
                              )}
                              <SimpleGrid columns={2} spacing="16px" fontSize="sm">
                                {scan.od_results && Object.keys(scan.od_results).length > 0 && (
                                  <Box>
                                    <Text fontWeight="500">OD (Right Eye)</Text>
                                    <Code display="block" whiteSpace="pre" fontSize="xs" p="8px" mt="4px" borderRadius="8px" overflow="auto">
                                      {JSON.stringify(scan.od_results, null, 2)}
                                    </Code>
                                  </Box>
                                )}
                                {scan.os_results && Object.keys(scan.os_results).length > 0 && (
                                  <Box>
                                    <Text fontWeight="500">OS (Left Eye)</Text>
                                    <Code display="block" whiteSpace="pre" fontSize="xs" p="8px" mt="4px" borderRadius="8px" overflow="auto">
                                      {JSON.stringify(scan.os_results, null, 2)}
                                    </Code>
                                  </Box>
                                )}
                              </SimpleGrid>
                              {scan.has_pdf && (
                                <Box>
                                  <Button
                                    variant="light"
                                    size="sm"
                                    leftIcon={<MdDescription />}
                                    onClick={() => openPdf(`/technician/scans/${scan.id}/pdf`, 'Failed to load PDF')}
                                  >
                                    View PDF Report
                                  </Button>
                                </Box>
                              )}
                            </Stack>
                          )}
                        </RowBox>
                      )
                    })}
                  </Stack>
                )}
              </SectionCard>

              {previousScans.length > 0 && (
                <SectionCard title="Previous Scans">
                  <Stack spacing="8px">
                    {previousScans.slice(0, 5).map((scan: any) => (
                      <RowBox key={scan.id}>
                        <Flex align="center" gap="12px">
                          <Badge variant="outline">{scan.scan_type?.toUpperCase()}</Badge>
                          <Text fontSize="sm">{scan.scan_number}</Text>
                          <Text fontSize="xs" color="secondaryGray.600">
                            {scan.scan_date ? new Date(scan.scan_date).toLocaleDateString() : ''}
                          </Text>
                        </Flex>
                        <Badge colorScheme={scan.status === 'completed' ? 'brand' : 'gray'}>{scan.status}</Badge>
                      </RowBox>
                    ))}
                  </Stack>
                </SectionCard>
              )}
            </Stack>
          </TabPanel>

          {/* AI Summary */}
          {aiStatus?.enabled && (
            <TabPanel p="0">
              <SectionCard title="AI Clinical Analysis" actions={<Badge variant="outline">Powered by AI</Badge>}>
                <Stack spacing="16px">
                  <Alert status="warning" borderRadius="12px" fontSize="sm">
                    <AlertIcon />
                    <Text>
                      <strong>Disclaimer:</strong> This AI analysis is for reference only. All clinical decisions should be made by qualified healthcare
                      professionals based on their clinical judgment.
                    </Text>
                  </Alert>
                  {!aiAnalysis ? (
                    <Box textAlign="center" py="32px">
                      <Text color="secondaryGray.600" mb="16px">
                        Click the button below to generate an AI-assisted analysis based on the clinical data entered.
                      </Text>
                      <Button variant="brand" onClick={requestAiAnalysis} isLoading={isAnalyzing} loadingText="Analyzing...">
                        Generate AI Analysis
                      </Button>
                    </Box>
                  ) : (
                    <>
                      <Flex justify="end">
                        <Button variant="light" size="sm" onClick={requestAiAnalysis} isLoading={isAnalyzing} loadingText="Refreshing...">
                          Refresh Analysis
                        </Button>
                      </Flex>
                      <Box bg={mutedBg} borderRadius="12px" p="16px" fontSize="sm" dangerouslySetInnerHTML={{ __html: formatAiAnalysis(aiAnalysis) }} />
                    </>
                  )}
                </Stack>
              </SectionCard>
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>

      {/* Create Prescription Dialog */}
      <AppModal
        isOpen={isPrescriptionDialogOpen}
        onClose={() => setIsPrescriptionDialogOpen(false)}
        size="2xl"
        title="Create Prescription"
        footer={
          <>
            <Button variant="light" onClick={() => setIsPrescriptionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              isDisabled={prescriptionItems.length === 0}
              isLoading={createPrescriptionMutation.isPending}
              loadingText="Creating..."
              onClick={handleCreatePrescription}
            >
              Create & Send to Front Desk
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <SimpleGrid columns={2} spacing="16px">
            <Field label="Type">
              <Select
                variant="main"
                value={newPrescriptionItem.item_type}
                onChange={(e) => setNewPrescriptionItem({ ...newPrescriptionItem, item_type: e.target.value as PrescriptionItem['item_type'] })}
              >
                <option value="medication">Medication</option>
                <option value="spectacle">Spectacle Rx</option>
                <option value="lens">Contact Lens</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Name (search products or type custom)" position="relative">
              <SearchInput
                maxW="100%"
                placeholder="Search products or type custom..."
                value={productSearch || newPrescriptionItem.name}
                onChange={(value) => {
                  setProductSearch(value)
                  setNewPrescriptionItem({
                    ...newPrescriptionItem,
                    name: value,
                    product_id: undefined, // Clear product_id when typing custom
                    is_external: true, // Mark as external when typing custom
                  })
                }}
              />
              {showProductResults && (
                <Box
                  position="absolute"
                  zIndex="10"
                  w="100%"
                  mt="4px"
                  bg={menuBg}
                  border="1px solid"
                  borderColor={borderColor}
                  borderRadius="12px"
                  boxShadow="lg"
                  maxH="192px"
                  overflowY="auto"
                >
                  {productResults.map((product: any) => (
                    <Box
                      key={product.id}
                      p="8px"
                      cursor="pointer"
                      borderBottom="1px solid"
                      borderColor={borderColor}
                      bg={product.stock_quantity === 0 ? 'orange.50' : undefined}
                      _hover={{ bg: hoverBg }}
                      onClick={() => {
                        setNewPrescriptionItem({
                          ...newPrescriptionItem,
                          product_id: product.id,
                          name: product.name,
                          description: product.description || '',
                          unit_price: product.unit_price || 0,
                          stock_quantity: product.stock_quantity || 0,
                          is_external: false,
                        })
                        setProductSearch('')
                        setShowProductResults(false)
                      }}
                    >
                      <Flex justify="space-between" align="start">
                        <Box>
                          <Text fontWeight="500" fontSize="sm">
                            {product.name}
                          </Text>
                          {product.stock_quantity === 0 && (
                            <Flex align="center" gap="4px" color="orange.500" fontSize="xs" mt="2px">
                              <Icon as={MdWarningAmber} />
                              Out of stock - Patient must get elsewhere
                            </Flex>
                          )}
                          {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                            <Text color="orange.500" fontSize="xs" mt="2px">
                              Low stock: {product.stock_quantity} remaining
                            </Text>
                          )}
                        </Box>
                        <Box textAlign="right">
                          <Text fontSize="xs" color="secondaryGray.600">
                            GH₵{product.unit_price}
                          </Text>
                          {product.stock_quantity > 0 && (
                            <Text fontSize="xs" color="green.500">
                              In stock: {product.stock_quantity}
                            </Text>
                          )}
                        </Box>
                      </Flex>
                    </Box>
                  ))}
                </Box>
              )}
              {newPrescriptionItem.is_external && newPrescriptionItem.name && !showProductResults && (
                <Text fontSize="xs" color="blue.500" mt="4px">
                  This item is not in our inventory - will be marked as external prescription
                </Text>
              )}
            </Field>
          </SimpleGrid>
          <Field label="Description / Instructions">
            <Textarea
              variant="main"
              placeholder="Dosage instructions, specifications, etc."
              value={newPrescriptionItem.description}
              onChange={(e) => setNewPrescriptionItem({ ...newPrescriptionItem, description: e.target.value })}
            />
          </Field>
          {newPrescriptionItem.item_type === 'medication' && (
            <SimpleGrid columns={2} spacing="16px">
              <Field label="Dosage">
                <Input
                  variant="main"
                  placeholder="e.g., 1 drop twice daily"
                  value={newPrescriptionItem.dosage}
                  onChange={(e) => setNewPrescriptionItem({ ...newPrescriptionItem, dosage: e.target.value })}
                />
              </Field>
              <Field label="Duration">
                <Input
                  variant="main"
                  placeholder="e.g., 2 weeks"
                  value={newPrescriptionItem.duration}
                  onChange={(e) => setNewPrescriptionItem({ ...newPrescriptionItem, duration: e.target.value })}
                />
              </Field>
            </SimpleGrid>
          )}
          <SimpleGrid columns={2} spacing="16px">
            <Field label="Quantity">
              <Input
                variant="main"
                type="number"
                min="1"
                value={newPrescriptionItem.quantity}
                onChange={(e) => setNewPrescriptionItem({ ...newPrescriptionItem, quantity: parseInt(e.target.value) || 1 })}
              />
            </Field>
            <Field label="Unit Price (GH₵)">
              <Input
                variant="main"
                type="number"
                min="0"
                value={newPrescriptionItem.unit_price}
                onChange={(e) => setNewPrescriptionItem({ ...newPrescriptionItem, unit_price: parseFloat(e.target.value) || 0 })}
              />
            </Field>
          </SimpleGrid>
          <Button variant="light" w="100%" leftIcon={<MdAdd />} onClick={addPrescriptionItem}>
            Add Item
          </Button>

          {prescriptionItems.length > 0 && (
            <RowBox display="block" p="16px">
              <Text fontWeight="500" mb="8px">
                Prescription Items
              </Text>
              <Stack spacing="0" divider={<Divider />}>
                {prescriptionItems.map((item, index) => {
                  const outOfStock = item.stock_quantity === 0 && !item.is_external
                  return (
                    <Box key={index} py="8px" px={outOfStock ? '8px' : 0} bg={outOfStock ? 'orange.50' : undefined} borderRadius="8px">
                      <Flex align="center" justify="space-between">
                        <Box>
                          <Text as="span" fontWeight="500">
                            {item.name}
                          </Text>
                          <Text as="span" fontSize="sm" color="secondaryGray.600" ms="8px">
                            ({item.item_type}) x{item.quantity}
                          </Text>
                          {item.is_external && (
                            <Badge variant="outline" ms="8px" fontSize="xs">
                              External
                            </Badge>
                          )}
                        </Box>
                        <Flex align="center" gap="8px">
                          <Text>GH₵{(item.quantity * item.unit_price).toLocaleString()}</Text>
                          <IconButton
                            aria-label="Remove item"
                            variant="ghost"
                            size="sm"
                            icon={<MdDelete />}
                            onClick={() => setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index))}
                          />
                        </Flex>
                      </Flex>
                      {outOfStock && (
                        <Flex align="center" gap="4px" color="orange.500" fontSize="xs" mt="4px">
                          <Icon as={MdWarningAmber} />
                          Out of stock - Patient must obtain elsewhere
                        </Flex>
                      )}
                    </Box>
                  )
                })}
              </Stack>
              <Flex justify="space-between" fontWeight="500" pt="8px">
                <Text>Total</Text>
                <Text>GH₵{prescriptionTotal.toLocaleString()}</Text>
              </Flex>
              {prescriptionItems.some((item) => item.stock_quantity === 0 && !item.is_external) && (
                <Alert status="warning" borderRadius="8px" fontSize="sm" mt="8px">
                  <AlertIcon />
                  <Text>
                    <strong>Note:</strong> Some items are out of stock. Patient will need to obtain these from another source.
                  </Text>
                </Alert>
              )}
            </RowBox>
          )}
        </Stack>
      </AppModal>

      {/* Scan Request Dialog */}
      <AppModal
        isOpen={showScanRequestDialog}
        onClose={closeScanDialog}
        title="Request Scan"
        footer={
          <>
            <Button variant="light" onClick={closeScanDialog}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleRequestScan} isLoading={requestScanMutation.isPending} loadingText="Requesting...">
              Request Scan
            </Button>
          </>
        }
      >
        <Stack spacing="16px" py="8px">
          {scanInfo && (
            <Flex align="center" gap="12px" p="16px" bg={mutedBg} borderRadius="12px">
              <Icon as={MdVisibility} w="32px" h="32px" color={scanInfo.color} />
              <Box>
                <Text fontWeight="500">{scanInfo.label}</Text>
                <Text fontSize="sm" color="secondaryGray.600">
                  {scanInfo.description}
                </Text>
              </Box>
            </Flex>
          )}
          <Field label="Notes for Technician (optional)">
            <Textarea variant="main" placeholder="Any specific instructions or areas of concern..." value={scanNotes} onChange={(e) => setScanNotes(e.target.value)} />
          </Field>
          <Alert status="info" borderRadius="12px" fontSize="sm">
            <AlertIcon />
            <Text>
              <strong>Note:</strong> The patient will be sent to the technician for this scan. Results will appear in the Scans tab once completed. You can
              continue with other parts of the consultation while waiting.
            </Text>
          </Alert>
        </Stack>
      </AppModal>
    </>
  )
}
