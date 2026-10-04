import { useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Icon,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  useColorModeValue,
} from '@chakra-ui/react'
import { MdArrowBack, MdClose, MdDescription, MdPerson, MdUpload, MdVisibility } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { FormActions } from '@/components/FormSection'
import { EmptyState, Field, SearchInput } from '@/components/ui'
import { SCAN_TYPE_FULL_LABELS } from './shared'

// Per-eye result fields for each scan type
const SCAN_FIELDS: Record<string, { key: string; label: string }[]> = {
  oct: [
    { key: 'rnfl_thickness', label: 'RNFL Thickness (μm)' },
    { key: 'ganglion_cell', label: 'Ganglion Cell Analysis' },
    { key: 'macula_thickness', label: 'Macula Thickness (μm)' },
    { key: 'optic_disc', label: 'Optic Disc Analysis' },
    { key: 'findings', label: 'Key Findings' },
  ],
  vft: [
    { key: 'mean_deviation', label: 'Mean Deviation (MD)' },
    { key: 'pattern_sd', label: 'Pattern Standard Deviation (PSD)' },
    { key: 'vfi', label: 'Visual Field Index (VFI)' },
    { key: 'reliability', label: 'Reliability Indices' },
    { key: 'findings', label: 'Key Findings' },
  ],
  fundus: [
    { key: 'optic_disc', label: 'Optic Disc' },
    { key: 'macula', label: 'Macula' },
    { key: 'vessels', label: 'Blood Vessels' },
    { key: 'periphery', label: 'Periphery' },
    { key: 'findings', label: 'Key Findings' },
  ],
  pachymeter: [
    { key: 'central_thickness', label: 'Central Corneal Thickness (μm)' },
    { key: 'thinnest_point', label: 'Thinnest Point (μm)' },
    { key: 'thinnest_location', label: 'Thinnest Location' },
    { key: 'findings', label: 'Key Findings' },
  ],
}

export default function NewScanPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const hoverBg = useColorModeValue('secondaryGray.100', 'whiteAlpha.50')
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200')

  // Pre-selected values from URL
  const [scanType, setScanType] = useState(searchParams.get('type') || '')
  const [patientId, setPatientId] = useState(searchParams.get('patient') || '')
  const [externalReferralId, setExternalReferralId] = useState(searchParams.get('referral') || '')
  const visitId = searchParams.get('visit') || ''
  const [resultsSummary, setResultsSummary] = useState('')
  const [notes, setNotes] = useState('')
  const [odResults, setOdResults] = useState<Record<string, string>>({})
  const [osResults, setOsResults] = useState<Record<string, string>>({})

  const [patientSearch, setPatientSearch] = useState('')
  const [showPatientSearch, setShowPatientSearch] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  const { data: pricing = [] } = useQuery({
    queryKey: ['scan-pricing'],
    queryFn: async () => (await api.get('/technician/scan-pricing')).data,
  })

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: async () => {
      if (!patientSearch || patientSearch.length < 2) return []
      const response = await api.get(`/patients?search=${encodeURIComponent(patientSearch)}&limit=10`)
      return response.data.patients || response.data || []
    },
    enabled: patientSearch.length >= 2,
  })

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals-for-scan'],
    queryFn: async () => (await api.get('/technician/referrals?status=pending&limit=50')).data,
  })

  const createScanMutation = useMutation({
    mutationFn: async (data: any) => (await api.post('/technician/scans', data)).data,
    onSuccess: async (data) => {
      // Upload the PDF (if any) before navigating
      if (pdfFile) {
        setIsUploading(true)
        setUploadStatus('Uploading PDF...')
        try {
          const formData = new FormData()
          formData.append('file', pdfFile)
          await api.post(`/technician/scans/${data.id}/upload-pdf`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
          toast({ title: 'Success', description: `Scan ${data.scan_number} created with PDF` })
        } catch (err: any) {
          const errorMsg = err?.response?.data?.detail || 'PDF upload failed'
          toast({ title: 'Warning', description: `Scan created but ${errorMsg}`, variant: 'destructive' })
        } finally {
          setIsUploading(false)
          setUploadStatus('')
        }
      } else {
        toast({ title: 'Success', description: `Scan ${data.scan_number} created successfully` })
      }
      queryClient.invalidateQueries({ queryKey: ['scans'] })
      navigate(`/technician/scans/${data.id}`)
    },
    onError: () => {
      setIsUploading(false)
      setUploadStatus('')
      toast({ title: 'Error', description: 'Failed to create scan', variant: 'destructive' })
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast({ title: 'Error', description: 'Please select a PDF file', variant: 'destructive' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be less than 10MB', variant: 'destructive' })
      return
    }
    setPdfFile(file)
  }

  const priceFor = (type: string) => pricing.find((p: any) => p.scan_type === type)?.price || 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!scanType) {
      toast({ title: 'Validation Error', description: 'Please select a scan type', variant: 'destructive' })
      return
    }
    if (!patientId && !externalReferralId) {
      toast({ title: 'Validation Error', description: 'Please select a patient or external referral', variant: 'destructive' })
      return
    }
    createScanMutation.mutate({
      scan_type: scanType,
      patient_id: patientId ? parseInt(patientId) : null,
      external_referral_id: externalReferralId ? parseInt(externalReferralId) : null,
      visit_id: visitId ? parseInt(visitId) : null,
      od_results: odResults,
      os_results: osResults,
      results_summary: resultsSummary || null,
      notes: notes || null,
    })
  }

  const scanFields = SCAN_FIELDS[scanType] || []
  const eyes = [
    { prefix: 'od', title: 'OD (Right Eye)', values: odResults, set: setOdResults },
    { prefix: 'os', title: 'OS (Left Eye)', values: osResults, set: setOsResults },
  ]

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate(-1)} mb="8px">
        Back
      </Button>
      <PageHeader title="New Scan" description="Record OCT, Visual Field, Fundus, or Pachymeter scan results" />

      <form onSubmit={handleSubmit}>
        <Stack spacing="20px">
          <>
            <SectionCard title="1. Scan type">
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing="12px">
                {Object.entries(SCAN_TYPE_FULL_LABELS).map(([key, label]) => (
                  <Button key={key} variant={scanType === key ? 'brand' : 'light'} h="auto" py="12px" flexDirection="column" gap="4px" whiteSpace="normal" onClick={() => setScanType(key)}>
                    <Icon as={MdVisibility} w="20px" h="20px" />
                    <Text fontSize="xs" fontWeight="600">
                      {label.split('(')[0].trim()}
                    </Text>
                    <Text fontSize="xs" opacity={0.7}>
                      GH₵ {priceFor(key)}
                    </Text>
                  </Button>
                ))}
              </SimpleGrid>
              {scanType && (
                <Flex mt="16px" p="12px" bg="brand.50" _dark={{ bg: 'whiteAlpha.100' }} borderRadius="12px" justify="space-between" align="center">
                  <Text fontSize="sm" fontWeight="600">
                    Price:
                  </Text>
                  <Badge bg="brand.500" color="white" fontSize="md" px="12px" py="4px">
                    GH₵ {priceFor(scanType)}
                  </Badge>
                </Flex>
              )}
            </SectionCard>

            <SectionCard title="2. Patient / client" description="Select an existing patient or external referral">
              <Tabs variant="soft-rounded" size="sm" defaultIndex={externalReferralId ? 1 : 0}>
                <TabList mb="16px">
                  <Tab>Patient</Tab>
                  <Tab>External Referral</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel p="0">
                    <Stack spacing="12px">
                      <Box onFocus={() => setShowPatientSearch(true)}>
                        <SearchInput
                          maxW="100%"
                          placeholder="Search patient by name or number..."
                          value={patientSearch}
                          onChange={(v) => {
                            setPatientSearch(v)
                            setShowPatientSearch(true)
                          }}
                        />
                      </Box>
                      {showPatientSearch && patients.length > 0 && (
                        <Box border="1px solid" borderColor={borderColor} borderRadius="12px" maxH="192px" overflowY="auto">
                          {patients.map((patient: any) => (
                            <Flex
                              key={patient.id}
                              p="8px 12px"
                              gap="8px"
                              align="center"
                              cursor="pointer"
                              _hover={{ bg: hoverBg }}
                              onClick={() => {
                                setPatientId(patient.id.toString())
                                setPatientSearch(`${patient.first_name} ${patient.last_name}`)
                                setShowPatientSearch(false)
                                setExternalReferralId('')
                              }}
                            >
                              <Icon as={MdPerson} color="secondaryGray.600" />
                              <Box>
                                <Text fontWeight="600">
                                  {patient.first_name} {patient.last_name}
                                </Text>
                                <Text fontSize="xs" color="secondaryGray.600">
                                  {patient.patient_number}
                                </Text>
                              </Box>
                            </Flex>
                          ))}
                        </Box>
                      )}
                      {patientId && (
                        <Box p="8px 12px" bg="green.50" _dark={{ bg: 'rgba(72,187,120,0.12)' }} border="1px solid" borderColor="green.200" borderRadius="8px" fontSize="sm">
                          Patient selected: {patientSearch || `#${patientId}`}
                        </Box>
                      )}
                    </Stack>
                  </TabPanel>
                  <TabPanel p="0">
                    <Select
                      variant="main"
                      placeholder="Select external referral"
                      value={externalReferralId}
                      onChange={(e) => {
                        setExternalReferralId(e.target.value)
                        setPatientId('')
                        setPatientSearch('')
                      }}
                    >
                      {referrals.map((ref: any) => (
                        <option key={ref.id} value={ref.id.toString()}>
                          {ref.client_name} - {ref.referral_number}
                        </option>
                      ))}
                    </Select>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </SectionCard>
          </>

          <Stack spacing="20px">
            {scanType ? (
              <>
                <SectionCard title={`${SCAN_TYPE_FULL_LABELS[scanType] || scanType} Results`}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing="24px">
                    {eyes.map((eye) => (
                      <Stack key={eye.prefix} spacing="16px">
                        <Heading size="sm" pb="8px" borderBottom="1px solid" borderColor={borderColor}>
                          {eye.title}
                        </Heading>
                        {scanFields.map((field) => (
                          <Field key={field.key} label={field.label}>
                            {field.key === 'findings' ? (
                              <Textarea variant="main" rows={2} value={eye.values[field.key] || ''} onChange={(e) => eye.set({ ...eye.values, [field.key]: e.target.value })} />
                            ) : (
                              <Input variant="main" value={eye.values[field.key] || ''} onChange={(e) => eye.set({ ...eye.values, [field.key]: e.target.value })} />
                            )}
                          </Field>
                        ))}
                      </Stack>
                    ))}
                  </SimpleGrid>
                </SectionCard>

                <SectionCard title="Summary & Notes">
                  <Stack spacing="16px">
                    <Field label="Results Summary">
                      <Textarea variant="main" rows={3} placeholder="Overall interpretation and summary of findings..." value={resultsSummary} onChange={(e) => setResultsSummary(e.target.value)} />
                    </Field>
                    <Field label="Additional Notes">
                      <Textarea variant="main" rows={2} placeholder="Any additional notes or observations..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </Field>
                  </Stack>
                </SectionCard>

                <SectionCard
                  title={
                    <Flex align="center" gap="8px">
                      <Icon as={MdDescription} />
                      Scan PDF
                    </Flex>
                  }
                  description="Upload the scan result PDF (optional)"
                >
                  <input type="file" ref={fileInputRef} accept=".pdf" onChange={handleFileChange} hidden />
                  {pdfFile ? (
                    <Flex align="center" gap="12px" p="12px" bg="green.50" _dark={{ bg: 'rgba(72,187,120,0.12)' }} border="1px solid" borderColor="green.200" borderRadius="12px">
                      <Icon as={MdDescription} w="32px" h="32px" color="green.500" />
                      <Box flex="1" minW="0">
                        <Text fontWeight="600" noOfLines={1}>
                          {pdfFile.name}
                        </Text>
                        <Text fontSize="xs" color="green.500">
                          {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                        </Text>
                      </Box>
                      <IconButton aria-label="Remove PDF" variant="ghost" size="sm" icon={<MdClose />} onClick={() => setPdfFile(null)} />
                    </Flex>
                  ) : (
                    <Box
                      as="button"
                      type="button"
                      w="100%"
                      border="2px dashed"
                      borderColor={borderColor}
                      borderRadius="12px"
                      p="24px"
                      textAlign="center"
                      _hover={{ borderColor: 'brand.500' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Icon as={MdUpload} w="32px" h="32px" color="secondaryGray.600" mb="8px" />
                      <Text fontSize="sm" color="secondaryGray.600">
                        Click to upload PDF
                      </Text>
                      <Text fontSize="xs" color="secondaryGray.600" mt="4px">
                        Max 10MB
                      </Text>
                    </Box>
                  )}
                </SectionCard>
              </>
            ) : (
              <Card>
                <EmptyState icon={MdVisibility}>Select a scan type to enter results</EmptyState>
              </Card>
            )}
          </Stack>
        </Stack>

        <FormActions hint={scanType ? `${SCAN_TYPE_FULL_LABELS[scanType]} · GH₵ ${priceFor(scanType)}` : 'Pick a scan type to begin'}>
          <Button variant="light" onClick={() => navigate(-1)} isDisabled={isUploading}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" isLoading={createScanMutation.isPending || isUploading} loadingText={isUploading ? uploadStatus || 'Uploading...' : 'Saving...'}>
            Save Scan
          </Button>
        </FormActions>
      </form>
    </>
  )
}
