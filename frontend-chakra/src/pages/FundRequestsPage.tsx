import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Box, Button, Divider, Flex, Icon, Input, Select, SimpleGrid, Stack, Table, Tbody, Td, Text, Textarea, Th, Thead, Tr, useColorModeValue } from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import { MdAdd, MdAccessTime, MdAttachMoney, MdCancel, MdCheckCircle, MdDescription, MdErrorOutline, MdFilterList, MdSend } from 'react-icons/md'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import { AppModal, Field, TableMessageRow } from '@/components/ui'

interface FundRequest {
  id: number
  title: string
  description: string | null
  amount: number
  purpose: string | null
  status: string
  requested_by_id: number
  requested_by_name: string | null
  branch_id: number | null
  branch_name: string | null
  reviewed_by_id: number | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  review_notes: string | null
  disbursed_at: string | null
  disbursement_method: string | null
  disbursement_reference: string | null
  received_at: string | null
  receipt_notes: string | null
  expense_id: number | null
  created_at: string
  updated_at: string
}

const STATUS: Record<string, { scheme: string; icon: IconType }> = {
  pending: { scheme: 'yellow', icon: MdAccessTime },
  approved: { scheme: 'blue', icon: MdCheckCircle },
  rejected: { scheme: 'red', icon: MdCancel },
  disbursed: { scheme: 'purple', icon: MdSend },
  received: { scheme: 'green', icon: MdAttachMoney },
  cancelled: { scheme: 'gray', icon: MdErrorOutline },
}

const emptyRequest = { title: '', description: '', amount: '', purpose: 'other' }

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount)
const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const statusBadge = (status: string) => {
  const cfg = STATUS[status]
  return (
    <Badge colorScheme={cfg?.scheme || 'gray'} display="inline-flex" alignItems="center" gap="4px">
      {cfg && <Icon as={cfg.icon} />}
      {status}
    </Badge>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text fontSize="sm" color="secondaryGray.600">
        {label}
      </Text>
      {children}
    </Box>
  )
}

export default function FundRequestsPage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { requestId } = useParams<{ requestId: string }>()
  const mutedBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [showDisburseDialog, setShowDisburseDialog] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<FundRequest | null>(null)
  const [newRequest, setNewRequest] = useState(emptyRequest)
  const [reviewData, setReviewData] = useState({ approved: true, review_notes: '' })
  const [disburseData, setDisburseData] = useState({ disbursement_method: 'cash', disbursement_reference: '' })
  const [receiptNotes, setReceiptNotes] = useState('')

  const isAdmin = user?.role === 'Admin' || user?.is_superuser

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['fund-requests', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      return (await api.get(`/fund-requests?${params.toString()}`)).data
    },
  })

  const { data: stats } = useQuery({
    queryKey: ['fund-requests-stats'],
    queryFn: async () => (await api.get('/fund-requests/stats/summary')).data,
  })

  // Open specific fund request from URL param
  useEffect(() => {
    if (!requestId || requests.length === 0) return
    const request = requests.find((r: FundRequest) => r.id === parseInt(requestId))
    if (request) {
      setSelectedRequest(request)
      setShowDetailDialog(true)
    }
  }, [requestId, requests])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['fund-requests'] })
    queryClient.invalidateQueries({ queryKey: ['fund-requests-stats'] })
  }

  const createMutation = useMutation({
    mutationFn: async (data: typeof newRequest) => (await api.post('/fund-requests', { ...data, amount: parseFloat(data.amount) })).data,
    onSuccess: () => {
      invalidate()
      setShowCreateDialog(false)
      setNewRequest(emptyRequest)
      toast({ title: 'Success', description: 'Memo submitted successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to submit request', variant: 'destructive' })
    },
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof reviewData }) => (await api.post(`/fund-requests/${id}/review`, data)).data,
    onSuccess: (_data, variables) => {
      invalidate()
      setShowReviewDialog(false)
      // If approved, show disburse dialog immediately
      if (variables.data.approved && selectedRequest) {
        setSelectedRequest({ ...selectedRequest, status: 'approved' })
        setShowDisburseDialog(true)
        toast({ title: 'Approved', description: 'Now select disbursement method' })
      } else {
        setSelectedRequest(null)
        toast({ title: 'Success', description: 'Request reviewed successfully' })
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to review request', variant: 'destructive' })
    },
  })

  const disburseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof disburseData }) => (await api.post(`/fund-requests/${id}/disburse`, data)).data,
    onSuccess: () => {
      invalidate()
      setShowDisburseDialog(false)
      setSelectedRequest(null)
      setDisburseData({ disbursement_method: 'cash', disbursement_reference: '' })
      toast({ title: 'Success', description: 'Funds marked as disbursed' })
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.detail || 'Failed to disburse funds', variant: 'destructive' })
    },
  })

  const receiveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => (await api.post(`/fund-requests/${id}/receive`, { receipt_notes: notes })).data,
    onSuccess: () => {
      invalidate()
      setShowDetailDialog(false)
      setSelectedRequest(null)
      toast({ title: 'Success', description: 'Receipt confirmed and expense recorded' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to confirm receipt', variant: 'destructive' })
    },
  })

  const requestSummary = (prefix: string) =>
    selectedRequest && (
      <Box bg={mutedBg} p="16px" borderRadius="12px">
        <Text fontWeight="500">{selectedRequest.title}</Text>
        <Text fontSize="2xl" fontWeight="bold">
          {formatCurrency(selectedRequest.amount)}
        </Text>
        <Text fontSize="sm" color="secondaryGray.600">
          {prefix} {selectedRequest.requested_by_name}
        </Text>
      </Box>
    )

  return (
    <>
      <PageHeader
        title="Memos"
        description={isAdmin ? 'Manage and approve memos from employees' : 'Submit memos for work-related expenses'}
        actions={
          <Button variant="brand" leftIcon={<MdAdd />} onClick={() => setShowCreateDialog(true)}>
            New Memo
          </Button>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="20px" mb="20px">
        {isAdmin ? (
          <>
            <StatCard name="Pending Memos" value={stats?.pending?.count || 0} valueColor="yellow.600" helpText={`${formatCurrency(stats?.pending?.amount || 0)} total`} />
            <StatCard
              name="Approved (Awaiting Disbursement)"
              value={stats?.approved?.count || 0}
              valueColor="blue.500"
              helpText={`${formatCurrency(stats?.approved?.amount || 0)} total`}
            />
            <StatCard
              name="Disbursed (Awaiting Receipt)"
              value={stats?.disbursed?.count || 0}
              valueColor="purple.500"
              helpText={`${formatCurrency(stats?.disbursed?.amount || 0)} total`}
            />
          </>
        ) : (
          <>
            <StatCard name="My Pending Memos" value={stats?.my_pending || 0} valueColor="yellow.600" />
            <StatCard name="Awaiting My Receipt Confirmation" value={stats?.awaiting_receipt || 0} valueColor="purple.500" />
          </>
        )}
      </SimpleGrid>

      <Card>
        <Flex align="center" gap="12px" mb="16px">
          <Icon as={MdFilterList} color="secondaryGray.600" />
          <Select variant="main" w="192px" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Memos</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="disbursed">Disbursed</option>
            <option value="received">Received</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </Flex>

        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Request</Th>
                <Th>Amount</Th>
                <Th>Purpose</Th>
                {isAdmin && <Th>Requested By</Th>}
                <Th>Status</Th>
                <Th>Date</Th>
                <Th textAlign="right">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <TableMessageRow colSpan={7} loading />
              ) : requests.length === 0 ? (
                <TableMessageRow colSpan={7}>
                  <Icon as={MdDescription} w="48px" h="48px" opacity={0.5} mb="16px" display="block" mx="auto" />
                  No memos found
                </TableMessageRow>
              ) : (
                requests.map((request: FundRequest) => (
                  <Tr key={request.id}>
                    <Td>
                      <Text fontWeight="500">{request.title}</Text>
                      {request.description && (
                        <Text fontSize="sm" color="secondaryGray.600" noOfLines={1} maxW="320px">
                          {request.description}
                        </Text>
                      )}
                    </Td>
                    <Td fontWeight="600">{formatCurrency(request.amount)}</Td>
                    <Td textTransform="capitalize">{request.purpose || 'Other'}</Td>
                    {isAdmin && (
                      <Td>
                        <Text>{request.requested_by_name}</Text>
                        {request.branch_name && (
                          <Text fontSize="xs" color="secondaryGray.600">
                            {request.branch_name}
                          </Text>
                        )}
                      </Td>
                    )}
                    <Td>{statusBadge(request.status)}</Td>
                    <Td color="secondaryGray.600">{formatDate(request.created_at)}</Td>
                    <Td>
                      <Flex justify="end" gap="8px">
                        <Button
                          variant="light"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request)
                            setShowDetailDialog(true)
                          }}
                        >
                          View
                        </Button>
                        {isAdmin && request.status === 'pending' && (
                          <Button
                            variant="brand"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request)
                              setShowReviewDialog(true)
                            }}
                          >
                            Review
                          </Button>
                        )}
                        {isAdmin && request.status === 'approved' && (
                          <Button
                            colorScheme="purple"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request)
                              setShowDisburseDialog(true)
                            }}
                          >
                            Disburse
                          </Button>
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

      {/* Create Request Dialog */}
      <AppModal
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        title="New Memo"
        footer={
          <>
            <Button variant="light" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={() => createMutation.mutate(newRequest)}
              isDisabled={!newRequest.title || !newRequest.amount}
              isLoading={createMutation.isPending}
              loadingText="Submitting..."
            >
              Submit Request
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Title">
            <Input variant="main" placeholder="e.g., Office Supplies" value={newRequest.title} onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })} />
          </Field>
          <Field label="Amount (GH₵)">
            <Input variant="main" type="number" placeholder="0.00" value={newRequest.amount} onChange={(e) => setNewRequest({ ...newRequest, amount: e.target.value })} />
          </Field>
          <Field label="Purpose">
            <Select variant="main" value={newRequest.purpose} onChange={(e) => setNewRequest({ ...newRequest, purpose: e.target.value })}>
              <option value="supplies">Supplies</option>
              <option value="transport">Transport</option>
              <option value="equipment">Equipment</option>
              <option value="maintenance">Maintenance</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Description (Optional)">
            <Textarea
              variant="main"
              rows={3}
              placeholder="Provide details about what the funds are needed for..."
              value={newRequest.description}
              onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
            />
          </Field>
        </Stack>
      </AppModal>

      {/* Detail Dialog */}
      <AppModal isOpen={showDetailDialog} onClose={() => setShowDetailDialog(false)} size="lg" title="Fund Request Details">
        {selectedRequest && (
          <Stack spacing="16px">
            <SimpleGrid columns={2} spacing="16px">
              <Detail label="Title">
                <Text fontWeight="500">{selectedRequest.title}</Text>
              </Detail>
              <Detail label="Amount">
                <Text fontWeight="500" fontSize="lg">
                  {formatCurrency(selectedRequest.amount)}
                </Text>
              </Detail>
              <Detail label="Purpose">
                <Text textTransform="capitalize">{selectedRequest.purpose || 'Other'}</Text>
              </Detail>
              <Detail label="Status">
                <Badge colorScheme={STATUS[selectedRequest.status]?.scheme || 'gray'}>{String(selectedRequest.status ?? '').replace(/_/g, ' ')}</Badge>
              </Detail>
            </SimpleGrid>

            {selectedRequest.description && (
              <Detail label="Description">
                <Text>{selectedRequest.description}</Text>
              </Detail>
            )}

            <Divider />
            <Detail label="Timeline">
              <Stack spacing="8px" mt="8px" fontSize="sm">
                <Text>
                  <Text as="span" color="secondaryGray.600">
                    Requested:
                  </Text>{' '}
                  {formatDate(selectedRequest.created_at)} by {selectedRequest.requested_by_name}
                </Text>
                {selectedRequest.reviewed_at && (
                  <Box>
                    <Text>
                      <Text as="span" color="secondaryGray.600">
                        Reviewed:
                      </Text>{' '}
                      {formatDate(selectedRequest.reviewed_at)} by {selectedRequest.reviewed_by_name}
                    </Text>
                    {selectedRequest.review_notes && (
                      <Text color="secondaryGray.600" ms="16px">
                        Note: {selectedRequest.review_notes}
                      </Text>
                    )}
                  </Box>
                )}
                {selectedRequest.disbursed_at && (
                  <Box>
                    <Text>
                      <Text as="span" color="secondaryGray.600">
                        Disbursed:
                      </Text>{' '}
                      {formatDate(selectedRequest.disbursed_at)} via {selectedRequest.disbursement_method}
                    </Text>
                    {selectedRequest.disbursement_reference && (
                      <Text color="secondaryGray.600" ms="16px">
                        Ref: {selectedRequest.disbursement_reference}
                      </Text>
                    )}
                  </Box>
                )}
                {selectedRequest.received_at && (
                  <Box>
                    <Text>
                      <Text as="span" color="secondaryGray.600">
                        Received:
                      </Text>{' '}
                      {formatDate(selectedRequest.received_at)}
                    </Text>
                    {selectedRequest.receipt_notes && (
                      <Text color="secondaryGray.600" ms="16px">
                        Note: {selectedRequest.receipt_notes}
                      </Text>
                    )}
                  </Box>
                )}
              </Stack>
            </Detail>

            {/* Confirm Receipt Section */}
            {selectedRequest.status === 'disbursed' && selectedRequest.requested_by_id === user?.id && (
              <>
                <Divider />
                <Field label="Confirm Receipt" helper="Please confirm that you have received the funds.">
                  <Textarea variant="main" rows={2} placeholder="Optional notes about the receipt..." value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)} />
                </Field>
                <Button
                  variant="brand"
                  w="100%"
                  isLoading={receiveMutation.isPending}
                  loadingText="Confirming..."
                  onClick={() => receiveMutation.mutate({ id: selectedRequest.id, notes: receiptNotes })}
                >
                  Confirm Receipt
                </Button>
              </>
            )}
          </Stack>
        )}
      </AppModal>

      {/* Review Dialog */}
      <AppModal
        isOpen={showReviewDialog}
        onClose={() => setShowReviewDialog(false)}
        title="Review Fund Request"
        footer={
          <>
            <Button variant="light" onClick={() => setShowReviewDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              isLoading={reviewMutation.isPending}
              loadingText="Submitting..."
              onClick={() => selectedRequest && reviewMutation.mutate({ id: selectedRequest.id, data: reviewData })}
            >
              Submit Review
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          {requestSummary('By')}
          <Field label="Decision">
            <Flex gap="8px">
              <Button flex="1" leftIcon={<MdCheckCircle />} variant={reviewData.approved ? 'brand' : 'light'} onClick={() => setReviewData({ ...reviewData, approved: true })}>
                Approve
              </Button>
              <Button
                flex="1"
                leftIcon={<MdCancel />}
                colorScheme={!reviewData.approved ? 'red' : undefined}
                variant={!reviewData.approved ? 'solid' : 'light'}
                onClick={() => setReviewData({ ...reviewData, approved: false })}
              >
                Reject
              </Button>
            </Flex>
          </Field>
          <Field label="Notes (Optional)">
            <Textarea
              variant="main"
              rows={3}
              placeholder="Add any notes about your decision..."
              value={reviewData.review_notes}
              onChange={(e) => setReviewData({ ...reviewData, review_notes: e.target.value })}
            />
          </Field>
        </Stack>
      </AppModal>

      {/* Disburse Dialog */}
      <AppModal
        isOpen={showDisburseDialog}
        onClose={() => setShowDisburseDialog(false)}
        title="Disburse Funds"
        footer={
          <>
            <Button variant="light" onClick={() => setShowDisburseDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              isLoading={disburseMutation.isPending}
              loadingText="Processing..."
              onClick={() => selectedRequest && disburseMutation.mutate({ id: selectedRequest.id, data: disburseData })}
            >
              Mark as Disbursed
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          {requestSummary('To')}
          <Field label="Disbursement Method">
            <Select variant="main" value={disburseData.disbursement_method} onChange={(e) => setDisburseData({ ...disburseData, disbursement_method: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="transfer">Bank Transfer</option>
              <option value="momo">Mobile Money</option>
            </Select>
          </Field>
          <Field label="Reference (Optional)">
            <Input
              variant="main"
              placeholder="Transaction reference or receipt number"
              value={disburseData.disbursement_reference}
              onChange={(e) => setDisburseData({ ...disburseData, disbursement_reference: e.target.value })}
            />
          </Field>
        </Stack>
      </AppModal>
    </>
  )
}
