import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Flex, HStack, Icon, Select, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react'
import { MdAttachMoney, MdCheck, MdPerson, MdPlayArrow, MdSettings, MdVisibility } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { ConfirmDialog, EmptyState, SearchInput, TableBox } from '@/components/ui'
import { PaymentBadge, PricingCards, PricingModal, SCAN_TYPE_LABELS, ScanPaymentModal, ScanTypeBadge, StatusBadge } from './shared'

export default function ScanRequestsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedScan, setSelectedScan] = useState<any>(null)
  const [deficitScanId, setDeficitScanId] = useState<number | null>(null)
  const [showPricingDialog, setShowPricingDialog] = useState(false)

  const { data: scanRequests = [], isLoading } = useQuery({
    queryKey: ['scan-requests', statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (typeFilter && typeFilter !== 'all') params.append('scan_type', typeFilter)
      return (await api.get(`/technician/scan-requests?${params.toString()}`)).data
    },
  })

  const { data: pricing = [] } = useQuery({
    queryKey: ['scan-pricing'],
    queryFn: async () => (await api.get('/technician/scan-pricing')).data,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['scan-requests'] })

  const markPaidMutation = useMutation({
    mutationFn: async ({ scanId, method }: { scanId: number; method: string }) => (await api.post(`/technician/scans/${scanId}/mark-paid`, null, { params: { payment_method: method } })).data,
    onSuccess: (data) => {
      toast({ title: 'Success', description: `Payment of GH₵ ${data.amount} recorded` })
      refresh()
      setSelectedScan(null)
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to record payment', variant: 'destructive' })
    },
  })

  const addToDeficitMutation = useMutation({
    mutationFn: async (scanId: number) => (await api.post(`/technician/scans/${scanId}/add-to-deficit`)).data,
    onSuccess: (data) => {
      toast({ title: 'Success', description: data.message })
      refresh()
      setDeficitScanId(null)
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.response?.data?.detail || 'Failed to add to deficit', variant: 'destructive' })
    },
  })

  const startScanMutation = useMutation({
    mutationFn: async (scanId: number) => (await api.put(`/technician/scans/${scanId}`, { status: 'in_progress' })).data,
    onSuccess: () => {
      toast({ title: 'Success', description: 'Scan started' })
      refresh()
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to start scan', variant: 'destructive' })
    },
  })

  const completeScanMutation = useMutation({
    mutationFn: async (scanId: number) => (await api.post(`/technician/scans/${scanId}/complete`)).data,
    onSuccess: () => {
      toast({ title: 'Success', description: 'Scan marked as completed' })
      refresh()
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to complete scan', variant: 'destructive' })
    },
  })

  const term = search.toLowerCase()
  const filteredRequests = scanRequests.filter(
    (r: any) => r.patient?.name?.toLowerCase().includes(term) || r.scan_number?.toLowerCase().includes(term) || r.requested_by?.name?.toLowerCase().includes(term)
  )

  return (
    <>
      <PageHeader
        title="Scan Requests"
        description="Patients sent by doctors for scans"
        actions={
          <Button variant="light" leftIcon={<MdSettings />} onClick={() => setShowPricingDialog(true)}>
            Scan Pricing
          </Button>
        }
      />

      <PricingCards pricing={pricing} />

      <Card mb="20px">
        <Flex gap="12px" wrap="wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by patient name, scan number..." flex="1" minW="200px" maxW="100%" />
          <Select variant="main" w="180px" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            {Object.entries(SCAN_TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </Select>
          <Select variant="main" w="160px" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </Select>
        </Flex>
      </Card>

      <SectionCard title={`Scan Requests (${filteredRequests.length})`} description="Scans requested by doctors during consultations">
        {isLoading ? (
          <Flex justify="center" py="32px">
            <Spinner color="brand.500" />
          </Flex>
        ) : filteredRequests.length === 0 ? (
          <EmptyState icon={MdVisibility}>No scan requests found</EmptyState>
        ) : (
          <TableBox>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Scan #</Th>
                  <Th>Type</Th>
                  <Th>Patient</Th>
                  <Th>Requested By</Th>
                  <Th>Price</Th>
                  <Th>Payment</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredRequests.map((request: any) => {
                  const unpaid = !request.payment?.is_paid && !request.payment?.added_to_deficit
                  return (
                    <Tr key={request.id}>
                      <Td fontFamily="mono" fontSize="sm">
                        {request.scan_number}
                      </Td>
                      <Td>
                        <ScanTypeBadge type={request.scan_type} />
                      </Td>
                      <Td>
                        <Flex align="center" gap="8px">
                          <Icon as={MdPerson} color="secondaryGray.600" />
                          <Box>
                            <Text fontWeight="600">{request.patient?.name || 'N/A'}</Text>
                            <Text fontSize="xs" color="secondaryGray.600">
                              {request.patient?.patient_number}
                            </Text>
                          </Box>
                        </Flex>
                      </Td>
                      <Td>
                        <Text fontSize="sm">{request.requested_by?.name || 'N/A'}</Text>
                        <Text fontSize="xs" color="secondaryGray.600">
                          {request.requested_at ? new Date(request.requested_at).toLocaleDateString() : ''}
                        </Text>
                      </Td>
                      <Td fontWeight="600">GH₵ {request.price}</Td>
                      <Td>
                        <PaymentBadge payment={request.payment} />
                      </Td>
                      <Td>
                        <StatusBadge status={request.status} />
                      </Td>
                      <Td>
                        <HStack spacing="8px">
                          {request.status === 'pending' && (
                            <Button size="sm" variant="light" leftIcon={<MdPlayArrow />} onClick={() => startScanMutation.mutate(request.id)}>
                              Start
                            </Button>
                          )}
                          {request.status === 'in_progress' && (
                            <Button size="sm" variant="brand" leftIcon={<MdCheck />} onClick={() => completeScanMutation.mutate(request.id)}>
                              Complete
                            </Button>
                          )}
                          {unpaid && (
                            <Button size="sm" variant="light" leftIcon={<MdAttachMoney />} onClick={() => setSelectedScan(request)}>
                              Pay
                            </Button>
                          )}
                          {unpaid && request.visit_id && (
                            <Button size="sm" variant="ghost" color="orange.500" onClick={() => setDeficitScanId(request.id)}>
                              Deficit
                            </Button>
                          )}
                        </HStack>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </TableBox>
        )}
      </SectionCard>

      <ScanPaymentModal
        isOpen={!!selectedScan}
        onClose={() => setSelectedScan(null)}
        scanType={selectedScan?.scan_type}
        amount={selectedScan?.price}
        patientName={selectedScan?.patient?.name}
        onConfirm={(method) => markPaidMutation.mutate({ scanId: selectedScan.id, method })}
        isLoading={markPaidMutation.isPending}
      />

      <ConfirmDialog
        isOpen={deficitScanId !== null}
        onClose={() => setDeficitScanId(null)}
        onConfirm={() => deficitScanId !== null && addToDeficitMutation.mutate(deficitScanId)}
        isLoading={addToDeficitMutation.isPending}
        title="Add to patient deficit?"
        confirmLabel="Add to Deficit"
        colorScheme="orange"
      >
        The scan amount will be added to the patient's outstanding balance for this visit.
      </ConfirmDialog>

      <PricingModal isOpen={showPricingDialog} onClose={() => setShowPricingDialog(false)} pricing={pricing} />
    </>
  )
}
