import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Box, Button, Flex, Heading, HStack, Icon, IconButton, Input, SimpleGrid, Spinner, Stack, Text, Textarea, useColorModeValue } from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import { MdArrowBack, MdAttachMoney, MdCheckCircle, MdDescription, MdDownload, MdEdit, MdPerson, MdUpload } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import SectionCard from '@/components/card/SectionCard'
import { EmptyState, Field } from '@/components/ui'
import { SummaryList } from '@/components/dashboard/widgets'
import { PaymentBadge, ScanPaymentModal, ScanTypeBadge, StatusBadge } from './shared'

const titled = (icon: IconType, text: string) => (
  <Flex align="center" gap="8px">
    <Icon as={icon} />
    {text}
  </Flex>
)

const label = (key: string) => key.replace(/_/g, ' ')
const fullName = (u?: { first_name?: string; last_name?: string }) => [u?.first_name, u?.last_name].filter(Boolean).join(' ') || '-'

export default function ScanDetailPage() {
  const { scanId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200')
  const mutedBg = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')

  const [isEditing, setIsEditing] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [editData, setEditData] = useState<any>({})

  const { data: scan, isLoading } = useQuery({
    queryKey: ['scan', scanId],
    queryFn: async () => (await api.get(`/technician/scans/${scanId}`)).data,
    enabled: !!scanId,
  })

  const { data: pricing = [] } = useQuery({
    queryKey: ['scan-pricing'],
    queryFn: async () => (await api.get('/technician/scan-pricing')).data,
  })

  const invalidateScan = () => queryClient.invalidateQueries({ queryKey: ['scan', scanId] })

  const updateScanMutation = useMutation({
    mutationFn: async (data: any) => (await api.put(`/technician/scans/${scanId}`, data)).data,
    onSuccess: () => {
      toast({ title: 'Success', description: 'Scan updated successfully' })
      invalidateScan()
      setIsEditing(false)
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update scan', variant: 'destructive' })
    },
  })

  const uploadPdfMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return (await api.post(`/technician/scans/${scanId}/upload-pdf`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'PDF uploaded successfully' })
      invalidateScan()
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to upload PDF', variant: 'destructive' })
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: async (method: string) => (await api.post(`/technician/scans/${scanId}/mark-paid`, null, { params: { payment_method: method } })).data,
    onSuccess: (data) => {
      toast({ title: 'Success', description: `Payment of GH₵ ${data.amount} recorded` })
      invalidateScan()
      setShowPaymentDialog(false)
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to record payment', variant: 'destructive' })
    },
  })

  const completeScanMutation = useMutation({
    mutationFn: async () => (await api.post(`/technician/scans/${scanId}/complete`)).data,
    onSuccess: () => {
      toast({ title: 'Success', description: 'Scan marked as completed' })
      invalidateScan()
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to complete scan', variant: 'destructive' })
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
    uploadPdfMutation.mutate(file)
  }

  const viewPdf = async () => {
    try {
      const response = await api.get(`/technician/scans/${scanId}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      toast({ title: 'Error', description: 'Failed to load PDF', variant: 'destructive' })
    }
  }

  const startEditing = () => {
    setEditData({
      results_summary: scan?.results_summary || '',
      notes: scan?.notes || '',
      od_results: scan?.od_results || {},
      os_results: scan?.os_results || {},
    })
    setIsEditing(true)
  }

  const scanPrice = pricing.find((pr: any) => pr.scan_type === scan?.scan_type)?.price || 0
  const uploading = uploadPdfMutation.isPending

  if (isLoading) {
    return (
      <Flex justify="center" py="48px">
        <Spinner color="brand.500" size="lg" />
      </Flex>
    )
  }

  if (!scan) {
    return (
      <EmptyState title="Scan not found">
        <Button variant="link" colorScheme="brand" onClick={() => navigate('/technician/scans')}>
          Back to Scans
        </Button>
      </EmptyState>
    )
  }

  const eyes = [
    { key: 'od_results', title: 'OD (Right Eye)' },
    { key: 'os_results', title: 'OS (Left Eye)' },
  ] as const

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate('/technician/scans')} mb="8px">
        Back
      </Button>
      <PageHeader
        title={
          <Flex align="center" gap="12px" wrap="wrap">
            {scan.scan_number}
            <ScanTypeBadge type={scan.scan_type} full />
            <StatusBadge status={scan.status} />
          </Flex>
        }
        description={scan.scan_date ? new Date(scan.scan_date).toLocaleDateString() : 'No date'}
        actions={
          <HStack spacing="8px">
            {scan.status === 'pending' && (
              <Button variant="light" onClick={() => updateScanMutation.mutate({ status: 'in_progress' })} isLoading={updateScanMutation.isPending && !isEditing}>
                Start Scan
              </Button>
            )}
            {scan.status === 'in_progress' && (
              <Button variant="brand" leftIcon={<MdCheckCircle />} onClick={() => completeScanMutation.mutate()} isLoading={completeScanMutation.isPending}>
                Complete
              </Button>
            )}
            {!isEditing && (
              <Button variant="light" leftIcon={<MdEdit />} onClick={startEditing}>
                Edit
              </Button>
            )}
          </HStack>
        }
      />

      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing="20px">
        <Stack spacing="20px">
          <SectionCard title={titled(MdPerson, 'Patient / Client')}>
            {scan.patient ? (
              <Stack spacing="4px">
                <Text fontWeight="700" fontSize="lg">
                  {scan.patient.first_name} {scan.patient.last_name}
                </Text>
                <Text fontSize="sm" color="secondaryGray.600">
                  Patient #: {scan.patient.patient_number}
                </Text>
                {scan.patient.phone && (
                  <Text fontSize="sm" color="secondaryGray.600">
                    Phone: {scan.patient.phone}
                  </Text>
                )}
              </Stack>
            ) : scan.external_referral ? (
              <Stack spacing="4px" align="start">
                <Text fontWeight="700" fontSize="lg">
                  {scan.external_referral.client_name}
                </Text>
                <Badge variant="outline">External Referral</Badge>
                {scan.external_referral.client_phone && (
                  <Text fontSize="sm" color="secondaryGray.600">
                    Phone: {scan.external_referral.client_phone}
                  </Text>
                )}
              </Stack>
            ) : (
              <Text color="secondaryGray.600">No patient linked</Text>
            )}
          </SectionCard>

          <SectionCard title={titled(MdAttachMoney, 'Payment')}>
            <Stack spacing="16px">
              <SummaryList
                rows={[
                  { label: 'Scan Price:', value: `GH₵ ${scanPrice}` },
                  { label: 'Status:', value: <PaymentBadge payment={scan.payment} /> },
                  ...(scan.payment?.is_paid
                    ? [
                        { label: 'Method:', value: scan.payment.payment_method },
                        { label: 'Date:', value: new Date(scan.payment.payment_date).toLocaleDateString() },
                      ]
                    : []),
                ]}
              />
              {!scan.payment?.is_paid && !scan.payment?.added_to_deficit && (
                <Button variant="brand" leftIcon={<MdAttachMoney />} onClick={() => setShowPaymentDialog(true)}>
                  Record Payment
                </Button>
              )}
            </Stack>
          </SectionCard>

          <SectionCard title={titled(MdDescription, 'Scan PDF')} description="Upload the scan result PDF">
            <input type="file" ref={fileInputRef} accept=".pdf" onChange={handleFileChange} hidden />
            {scan.pdf_file_path ? (
              <Stack spacing="12px">
                <Flex align="center" gap="8px" p="12px" bg="green.50" _dark={{ bg: 'rgba(72,187,120,0.12)' }} border="1px solid" borderColor="green.200" borderRadius="12px">
                  <Icon as={MdDescription} w="32px" h="32px" color="green.500" />
                  <Box minW="0">
                    <Text fontWeight="600">PDF Uploaded</Text>
                    <Text fontSize="xs" color="green.500" noOfLines={1}>
                      {scan.pdf_file_path.split('/').pop()}
                    </Text>
                  </Box>
                </Flex>
                <Flex gap="8px">
                  <Button variant="light" flex="1" leftIcon={<MdDownload />} onClick={viewPdf}>
                    View PDF
                  </Button>
                  <IconButton aria-label="Replace PDF" variant="light" icon={<MdUpload />} onClick={() => fileInputRef.current?.click()} isLoading={uploading} />
                </Flex>
              </Stack>
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
                disabled={uploading}
              >
                {uploading ? <Spinner color="brand.500" mb="8px" /> : <Icon as={MdUpload} w="32px" h="32px" color="secondaryGray.600" mb="8px" />}
                <Text fontSize="sm" color="secondaryGray.600">
                  {uploading ? 'Uploading...' : 'Click to upload PDF'}
                </Text>
                <Text fontSize="xs" color="secondaryGray.600" mt="4px">
                  Max 10MB
                </Text>
              </Box>
            )}
          </SectionCard>
        </Stack>

        <Stack spacing="20px" gridColumn={{ lg: 'span 2' }}>
          <SectionCard title="Scan Results">
            {isEditing ? (
              <Stack spacing="24px">
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing="24px">
                  {eyes.map((eye) => (
                    <Stack key={eye.key} spacing="16px">
                      <Heading size="sm" pb="8px" borderBottom="1px solid" borderColor={borderColor}>
                        {eye.title}
                      </Heading>
                      {Object.entries(editData[eye.key] || {}).map(([key, value]) => (
                        <Field key={key} label={<Text as="span" textTransform="capitalize">{label(key)}</Text>}>
                          <Input
                            variant="main"
                            value={value as string}
                            onChange={(e) => setEditData({ ...editData, [eye.key]: { ...editData[eye.key], [key]: e.target.value } })}
                          />
                        </Field>
                      ))}
                    </Stack>
                  ))}
                </SimpleGrid>
                <Field label="Results Summary">
                  <Textarea variant="main" rows={3} value={editData.results_summary} onChange={(e) => setEditData({ ...editData, results_summary: e.target.value })} />
                </Field>
                <Field label="Notes">
                  <Textarea variant="main" rows={2} value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
                </Field>
                <Flex gap="8px" justify="end">
                  <Button variant="light" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button variant="brand" onClick={() => updateScanMutation.mutate(editData)} isLoading={updateScanMutation.isPending}>
                    Save Changes
                  </Button>
                </Flex>
              </Stack>
            ) : (
              <Stack spacing="24px">
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing="24px">
                  {eyes.map((eye) => {
                    const results = scan[eye.key] || {}
                    return (
                      <Stack key={eye.key} spacing="12px">
                        <Heading size="sm" pb="8px" borderBottom="1px solid" borderColor={borderColor}>
                          {eye.title}
                        </Heading>
                        {Object.keys(results).length > 0 ? (
                          Object.entries(results).map(([key, value]) => (
                            <Flex key={key} justify="space-between" gap="12px">
                              <Text color="secondaryGray.600" textTransform="capitalize">
                                {label(key)}:
                              </Text>
                              <Text fontWeight="600" textAlign="right">
                                {(value as string) || '-'}
                              </Text>
                            </Flex>
                          ))
                        ) : (
                          <Text fontSize="sm" color="secondaryGray.600">
                            No results recorded
                          </Text>
                        )}
                      </Stack>
                    )
                  })}
                </SimpleGrid>

                {scan.results_summary && (
                  <Box>
                    <Text fontWeight="600" mb="8px">
                      Summary
                    </Text>
                    <Text color="secondaryGray.600" bg={mutedBg} p="12px" borderRadius="8px">
                      {scan.results_summary}
                    </Text>
                  </Box>
                )}
                {scan.notes && (
                  <Box>
                    <Text fontWeight="600" mb="8px">
                      Notes
                    </Text>
                    <Text color="secondaryGray.600" bg={mutedBg} p="12px" borderRadius="8px">
                      {scan.notes}
                    </Text>
                  </Box>
                )}
                {scan.doctor_notes && (
                  <Box>
                    <Text fontWeight="600" mb="8px">
                      Doctor's Notes
                    </Text>
                    <Text bg="blue.50" _dark={{ bg: 'rgba(66,153,225,0.12)' }} border="1px solid" borderColor="blue.200" p="12px" borderRadius="8px">
                      {scan.doctor_notes}
                    </Text>
                  </Box>
                )}
              </Stack>
            )}
          </SectionCard>

          <SectionCard title="Details">
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing="16px" fontSize="sm">
              {[
                ['Created', scan.created_at ? new Date(scan.created_at).toLocaleString() : '-'],
                ['Performed By', fullName(scan.performed_by)],
                ['Requested By', fullName(scan.requested_by)],
                ['Visit ID', scan.visit_id || '-'],
              ].map(([k, v]) => (
                <Box key={k}>
                  <Text color="secondaryGray.600">{k}</Text>
                  <Text>{v}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </SectionCard>
        </Stack>
      </SimpleGrid>

      <ScanPaymentModal
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        scanType={scan.scan_type}
        amount={scanPrice}
        onConfirm={(method) => markPaidMutation.mutate(method)}
        isLoading={markPaidMutation.isPending}
      />
    </>
  )
}
