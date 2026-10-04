import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Collapse,
  Flex,
  Grid,
  Heading,
  Icon,
  IconButton,
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
import {
  MdAccessTime,
  MdAttachMoney,
  MdBusiness,
  MdCheck,
  MdChevronRight,
  MdExpandMore,
  MdPayments,
  MdPeople,
  MdPerson,
  MdPhone,
  MdSettings,
  MdTrendingUp,
} from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { RowBox } from '@/components/dashboard/widgets'
import { AppModal, EmptyState, Field, SearchInput, TableBox } from '@/components/ui'

const TABS = ['overview', 'payments', 'doctors']
const ghs = (n: number) => `GH₵ ${(n || 0).toLocaleString()}`
const referralScheme: Record<string, string> = { completed: 'green', pending: 'yellow' }

function DoctorAvatar() {
  const bg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  return (
    <Flex w="40px" h="40px" minW="40px" borderRadius="full" bg={bg} align="center" justify="center">
      <Icon as={MdPerson} w="20px" h="20px" color="secondaryGray.600" />
    </Flex>
  )
}

export default function ReferralPaymentsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const mutedBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')

  // Filters
  const [search, setSearch] = useState('')
  const [paidFilter, setPaidFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  // Dialog states
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [showPayDialog, setShowPayDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [expandedDoctors, setExpandedDoctors] = useState<Set<number>>(new Set())
  const [showCreatePaymentDialog, setShowCreatePaymentDialog] = useState(false)
  const [createPaymentDoctorId, setCreatePaymentDoctorId] = useState<number | null>(null)
  const [createPaymentAmount, setCreatePaymentAmount] = useState('')
  const [createPaymentNotes, setCreatePaymentNotes] = useState('')

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')

  // Settings form state
  const [settingDoctorId, setSettingDoctorId] = useState<string>('')
  const [settingPaymentType, setSettingPaymentType] = useState('percentage')
  const [settingRate, setSettingRate] = useState('')

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['referral-payments', paidFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (paidFilter === 'paid') params.append('is_paid', 'true')
      if (paidFilter === 'unpaid') params.append('is_paid', 'false')
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      return (await api.get(`/technician/payments?${params.toString()}`)).data
    },
  })

  const { data: referrals = [] } = useQuery({
    queryKey: ['all-referrals', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      params.append('limit', '500')
      return (await api.get(`/technician/referrals?${params.toString()}`)).data
    },
  })

  const { data: topReferrers = [] } = useQuery({
    queryKey: ['top-referrers'],
    queryFn: async () => (await api.get('/technician/analytics/top-referrers?limit=10')).data,
  })

  const { data: paymentSettings = [] } = useQuery({
    queryKey: ['payment-settings'],
    queryFn: async () => (await api.get('/technician/payment-settings')).data,
  })

  const { data: doctors = [] } = useQuery({
    queryKey: ['referral-doctors'],
    queryFn: async () => (await api.get('/technician/doctors')).data,
  })

  // Group referrals by doctor with payment summary
  const doctorSummaries = useMemo(() => {
    const groups: Record<number, { doctor: any; referrals: any[]; totalFees: number; paidAmount: number; unpaidAmount: number; referralCount: number }> = {}
    referrals.forEach((r: any) => {
      const doctorId = r.referral_doctor?.id || 0
      groups[doctorId] ||= { doctor: r.referral_doctor || { id: 0, name: 'Unknown' }, referrals: [], totalFees: 0, paidAmount: 0, unpaidAmount: 0, referralCount: 0 }
      groups[doctorId].referrals.push(r)
      groups[doctorId].totalFees += r.service_fee || 0
      groups[doctorId].referralCount++
    })
    payments.forEach((p: any) => {
      const group = groups[p.referral_doctor?.id]
      if (!group) return
      if (p.is_paid) group.paidAmount += p.amount || 0
      else group.unpaidAmount += p.amount || 0
    })
    return Object.values(groups).sort((a, b) => b.referralCount - a.referralCount)
  }, [referrals, payments])

  const toggleDoctorExpanded = (doctorId: number) =>
    setExpandedDoctors((prev) => {
      const next = new Set(prev)
      if (next.has(doctorId)) next.delete(doctorId)
      else next.add(doctorId)
      return next
    })

  const invalidatePayments = () => {
    queryClient.invalidateQueries({ queryKey: ['referral-payments'] })
    queryClient.invalidateQueries({ queryKey: ['referral-summary'] })
  }

  const resetPaymentForm = () => {
    setPaymentMethod('')
    setReferenceNumber('')
    setPaymentNotes('')
    setSelectedPayment(null)
  }

  const markPaidMutation = useMutation({
    mutationFn: async (data: { paymentId: number; method: string; reference?: string; notes?: string }) =>
      (
        await api.post(`/technician/payments/${data.paymentId}/mark-paid`, null, {
          params: { payment_method: data.method, reference_number: data.reference || undefined, notes: data.notes || undefined },
        })
      ).data,
    onSuccess: () => {
      toast({ title: 'Success', description: 'Payment marked as paid' })
      invalidatePayments()
      setShowPayDialog(false)
      resetPaymentForm()
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark payment', variant: 'destructive' })
    },
  })

  const createSettingMutation = useMutation({
    mutationFn: async (data: any) => (await api.post('/technician/payment-settings', data)).data,
    onSuccess: () => {
      toast({ title: 'Success', description: 'Payment setting saved' })
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] })
      setShowSettingsDialog(false)
      setSettingDoctorId('')
      setSettingPaymentType('percentage')
      setSettingRate('')
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save setting', variant: 'destructive' })
    },
  })

  const closeCreatePayment = () => {
    setShowCreatePaymentDialog(false)
    setCreatePaymentDoctorId(null)
    setCreatePaymentAmount('')
    setCreatePaymentNotes('')
  }

  const createManualPaymentMutation = useMutation({
    mutationFn: async (data: { referral_doctor_id: number; amount: number; notes?: string }) => (await api.post('/technician/payments/create-manual', data)).data,
    onSuccess: () => {
      toast({ title: 'Success', description: 'Payment created successfully' })
      invalidatePayments()
      closeCreatePayment()
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create payment', variant: 'destructive' })
    },
  })

  const handleCreateManualPayment = () => {
    if (!createPaymentDoctorId || !createPaymentAmount) {
      toast({ title: 'Error', description: 'Please select a doctor and enter an amount', variant: 'destructive' })
      return
    }
    createManualPaymentMutation.mutate({ referral_doctor_id: createPaymentDoctorId, amount: parseFloat(createPaymentAmount), notes: createPaymentNotes || undefined })
  }

  const handleMarkPaid = () => {
    if (!paymentMethod) {
      toast({ title: 'Error', description: 'Please select a payment method', variant: 'destructive' })
      return
    }
    markPaidMutation.mutate({ paymentId: selectedPayment.id, method: paymentMethod, reference: referenceNumber, notes: paymentNotes })
  }

  const handleSaveSetting = () => {
    if (!settingRate) {
      toast({ title: 'Error', description: 'Please enter a rate', variant: 'destructive' })
      return
    }
    createSettingMutation.mutate({ referral_doctor_id: settingDoctorId ? parseInt(settingDoctorId) : null, payment_type: settingPaymentType, rate: parseFloat(settingRate) })
  }

  const openPay = (payment: any) => {
    setSelectedPayment(payment)
    setShowPayDialog(true)
  }

  const q = search.trim().toLowerCase()
  const has = (...values: (string | undefined)[]) => values.some((v) => v?.toLowerCase().includes(q))
  const filteredPayments = q
    ? payments.filter((p: any) => has(p.referral_doctor?.name, p.referral_doctor?.clinic_name, p.payment_number, p.external_referral?.client_name))
    : payments
  const filteredDoctorSummaries = q ? doctorSummaries.filter((g) => has(g.doctor.name, g.doctor.clinic_name)) : doctorSummaries

  const unpaid = payments.filter((p: any) => !p.is_paid)
  const paid = payments.filter((p: any) => p.is_paid)
  const sum = (list: any[]) => list.reduce((s: number, p: any) => s + (p.amount || 0), 0)
  const outstanding = filteredPayments.filter((p: any) => !p.is_paid)
  const doctorOptions = doctors.map((doc: any) => (
    <option key={doc.id} value={doc.id.toString()}>
      {doc.name} - {doc.clinic_name || 'No clinic'}
    </option>
  ))

  return (
    <>
      <PageHeader
        title="Referral Management"
        description="Track referrals, manage payments to referring doctors"
        actions={
          <>
            <Button variant="brand" leftIcon={<MdAttachMoney />} onClick={() => setShowCreatePaymentDialog(true)}>
              Create Payment
            </Button>
            <Button variant="light" leftIcon={<MdSettings />} onClick={() => setShowSettingsDialog(true)}>
              Payment Settings
            </Button>
          </>
        }
      />

      {/* Summary Cards */}
      <SimpleGrid columns={{ base: 1, md: 3, xl: 5 }} spacing="20px" mb="20px">
        <StatCard name="Total Referrals" value={referrals.length} icon={MdPeople} iconColor="secondaryGray.600" helpText={`From ${doctorSummaries.length} doctors`} />
        <StatCard
          name="Total Revenue"
          value={ghs(referrals.reduce((s: number, r: any) => s + (r.service_fee || 0), 0))}
          icon={MdAttachMoney}
          iconColor="secondaryGray.600"
          helpText="From referral services"
        />
        <StatCard name="Total Paid" value={ghs(sum(paid))} icon={MdCheck} iconColor="green.500" valueColor="green.500" helpText={`${paid.length} payments`} />
        <StatCard name="Outstanding" value={ghs(sum(unpaid))} icon={MdAccessTime} iconColor="yellow.600" valueColor="yellow.600" helpText={`${unpaid.length} pending`} />
        <StatCard name="Doctors" value={doctors.length} icon={MdPerson} iconColor="secondaryGray.600" helpText="Referring doctors" />
      </SimpleGrid>

      {/* Filters */}
      <Card mb="20px">
        <Flex wrap="wrap" gap="16px" align="end">
          <Field label={<Text fontSize="xs">From Date</Text>} w="auto">
            <Input variant="main" type="date" w="160px" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label={<Text fontSize="xs">To Date</Text>} w="auto">
            <Input variant="main" type="date" w="160px" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
          <SearchInput flex="1" minW="200px" maxW="100%" placeholder="Search doctor or payment number..." value={search} onChange={setSearch} />
          <Select variant="main" w="160px" value={paidFilter} onChange={(e) => setPaidFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="unpaid">Unpaid Only</option>
            <option value="paid">Paid Only</option>
          </Select>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
              }}
            >
              Clear Dates
            </Button>
          )}
        </Flex>
      </Card>

      <Tabs variant="soft-rounded" index={TABS.indexOf(activeTab)} onChange={(i) => setActiveTab(TABS[i])}>
        <TabList gap="8px" mb="16px">
          <Tab>Overview</Tab>
          <Tab>Payments</Tab>
          <Tab>By Doctor</Tab>
        </TabList>

        <TabPanels>
          {/* Overview */}
          <TabPanel p="0">
            <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap="20px">
              <SectionCard
                title={
                  <Flex align="center" gap="8px">
                    <Icon as={MdAccessTime} color="yellow.500" />
                    Outstanding Payments
                  </Flex>
                }
                description="Payments due to referring doctors"
              >
                {outstanding.length === 0 ? (
                  <Flex direction="column" align="center" py="32px" color="secondaryGray.600">
                    <Icon as={MdCheck} w="48px" h="48px" color="green.500" mb="8px" />
                    <Text>All payments are up to date!</Text>
                  </Flex>
                ) : (
                  <Stack spacing="12px">
                    {outstanding.slice(0, 10).map((payment: any) => (
                      <RowBox key={payment.id} p="16px" _hover={{ bg: hoverBg }}>
                        <Flex align="center" gap="16px">
                          <DoctorAvatar />
                          <Box>
                            <Text fontWeight="500">{payment.referral_doctor?.name}</Text>
                            <Text fontSize="sm" color="secondaryGray.600">
                              {payment.referral_doctor?.clinic_name || 'No clinic'} • {payment.payment_number}
                            </Text>
                          </Box>
                        </Flex>
                        <Flex align="center" gap="16px">
                          <Box textAlign="right">
                            <Text fontWeight="bold" fontSize="lg">
                              {ghs(payment.amount)}
                            </Text>
                            <Text fontSize="xs" color="secondaryGray.600">
                              {payment.created_at ? new Date(payment.created_at).toLocaleDateString() : ''}
                            </Text>
                          </Box>
                          <Button size="sm" variant="brand" leftIcon={<MdPayments />} onClick={() => openPay(payment)}>
                            Pay
                          </Button>
                        </Flex>
                      </RowBox>
                    ))}
                  </Stack>
                )}
              </SectionCard>

              <Stack spacing="20px">
                <SectionCard
                  title={
                    <Flex align="center" gap="8px">
                      <Icon as={MdTrendingUp} color="brand.500" />
                      Top Referrers
                    </Flex>
                  }
                >
                  {topReferrers.length === 0 ? (
                    <Text textAlign="center" py="16px" color="secondaryGray.600">
                      No referrals yet
                    </Text>
                  ) : (
                    <Stack spacing="12px">
                      {topReferrers.slice(0, 5).map((referrer: any, index: number) => (
                        <Flex
                          key={referrer.doctor_id}
                          align="center"
                          gap="12px"
                          p="8px"
                          borderRadius="12px"
                          cursor="pointer"
                          _hover={{ bg: hoverBg }}
                          onClick={() => {
                            setActiveTab('doctors')
                            toggleDoctorExpanded(referrer.doctor_id)
                          }}
                        >
                          <Flex w="32px" h="32px" borderRadius="full" bg={mutedBg} align="center" justify="center" fontWeight="bold" fontSize="sm" color="secondaryGray.600">
                            {index + 1}
                          </Flex>
                          <Box flex="1" minW="0">
                            <Text fontWeight="500" noOfLines={1}>
                              {referrer.doctor_name}
                            </Text>
                            <Text fontSize="xs" color="secondaryGray.600" noOfLines={1}>
                              {referrer.clinic_name || 'No clinic'}
                            </Text>
                          </Box>
                          <Box textAlign="right">
                            <Text fontWeight="bold">{referrer.referral_count}</Text>
                            <Text fontSize="xs" color="secondaryGray.600">
                              referrals
                            </Text>
                          </Box>
                          <Icon as={MdChevronRight} color="secondaryGray.600" />
                        </Flex>
                      ))}
                    </Stack>
                  )}
                </SectionCard>

                <SectionCard
                  title={<Text fontSize="md">Payment Rates</Text>}
                  actions={<IconButton aria-label="Payment settings" variant="ghost" size="sm" icon={<MdSettings />} onClick={() => setShowSettingsDialog(true)} />}
                >
                  {paymentSettings.length === 0 ? (
                    <Box textAlign="center" fontSize="sm" color="secondaryGray.600">
                      <Text>No rates configured</Text>
                      <Button variant="link" size="sm" color="brand.500" onClick={() => setShowSettingsDialog(true)}>
                        Configure rates
                      </Button>
                    </Box>
                  ) : (
                    <Stack spacing="8px">
                      {paymentSettings.slice(0, 3).map((setting: any) => (
                        <Flex key={setting.id} align="center" justify="space-between" fontSize="sm">
                          <Text noOfLines={1}>{setting.doctor_name || 'Default'}</Text>
                          <Badge variant="outline">{setting.payment_type === 'percentage' ? `${setting.rate}%` : `GH₵${setting.rate}`}</Badge>
                        </Flex>
                      ))}
                      {paymentSettings.length > 3 && (
                        <Button variant="link" size="sm" color="brand.500" onClick={() => setShowSettingsDialog(true)}>
                          View all {paymentSettings.length} settings
                        </Button>
                      )}
                    </Stack>
                  )}
                </SectionCard>
              </Stack>
            </Grid>
          </TabPanel>

          {/* Payments */}
          <TabPanel p="0">
            <SectionCard title="All Payment Records" description={`${filteredPayments.length} payments found`}>
              {isLoading ? (
                <EmptyState>Loading...</EmptyState>
              ) : filteredPayments.length === 0 ? (
                <EmptyState icon={MdAttachMoney}>No payments found</EmptyState>
              ) : (
                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Payment #</Th>
                        <Th>Doctor</Th>
                        <Th>Referral</Th>
                        <Th>Amount</Th>
                        <Th>Date</Th>
                        <Th>Status</Th>
                        <Th />
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filteredPayments.map((payment: any) => (
                        <Tr key={payment.id}>
                          <Td fontFamily="mono">{payment.payment_number}</Td>
                          <Td>
                            <Text fontWeight="500">{payment.referral_doctor?.name}</Text>
                            <Flex align="center" gap="4px" fontSize="xs" color="secondaryGray.600">
                              <Icon as={MdBusiness} />
                              {payment.referral_doctor?.clinic_name || 'No clinic'}
                            </Flex>
                          </Td>
                          <Td>{payment.external_referral?.client_name || '-'}</Td>
                          <Td>
                            <Text fontWeight="bold">{ghs(payment.amount)}</Text>
                            <Text fontSize="xs" color="secondaryGray.600">
                              {payment.payment_type === 'percentage' ? `${payment.payment_rate}%` : 'Fixed'}
                            </Text>
                          </Td>
                          <Td>
                            <Text>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '-'}</Text>
                            {payment.paid_at && (
                              <Text fontSize="xs" color="green.500">
                                Paid: {new Date(payment.paid_at).toLocaleDateString()}
                              </Text>
                            )}
                          </Td>
                          <Td>
                            <Badge colorScheme={payment.is_paid ? 'green' : 'yellow'} display="inline-flex" alignItems="center" gap="4px">
                              <Icon as={payment.is_paid ? MdCheck : MdAccessTime} />
                              {payment.is_paid ? 'Paid' : 'Pending'}
                            </Badge>
                          </Td>
                          <Td>
                            {!payment.is_paid && (
                              <Button size="sm" variant="brand" onClick={() => openPay(payment)}>
                                Pay Now
                              </Button>
                            )}
                            {payment.is_paid && payment.payment_method && (
                              <Text fontSize="xs" color="secondaryGray.600" textTransform="capitalize">
                                {payment.payment_method.replace('_', ' ')}
                              </Text>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}
            </SectionCard>
          </TabPanel>

          {/* By Doctor */}
          <TabPanel p="0">
            <Stack spacing="16px">
              {filteredDoctorSummaries.length === 0 ? (
                <Card>
                  <EmptyState icon={MdPeople}>No referrals found</EmptyState>
                </Card>
              ) : (
                filteredDoctorSummaries.map((group) => {
                  const expanded = expandedDoctors.has(group.doctor.id)
                  return (
                    <Card key={group.doctor.id} p="0" overflow="hidden">
                      <Flex
                        align="center"
                        justify="space-between"
                        gap="16px"
                        p="20px"
                        cursor="pointer"
                        _hover={{ bg: hoverBg }}
                        onClick={() => toggleDoctorExpanded(group.doctor.id)}
                        wrap="wrap"
                      >
                        <Flex align="center" gap="16px">
                          <Icon as={expanded ? MdExpandMore : MdChevronRight} w="20px" h="20px" color="secondaryGray.600" />
                          <DoctorAvatar />
                          <Box>
                            <Heading size="sm">{group.doctor.name}</Heading>
                            <Flex gap="16px" fontSize="sm" color="secondaryGray.600">
                              {group.doctor.clinic_name && (
                                <Flex align="center" gap="4px">
                                  <Icon as={MdBusiness} />
                                  {group.doctor.clinic_name}
                                </Flex>
                              )}
                              {group.doctor.phone && (
                                <Flex align="center" gap="4px">
                                  <Icon as={MdPhone} />
                                  {group.doctor.phone}
                                </Flex>
                              )}
                            </Flex>
                          </Box>
                        </Flex>
                        <Flex align="center" gap="24px" textAlign="center">
                          <Box>
                            <Text fontSize="xl" fontWeight="bold">
                              {group.referralCount}
                            </Text>
                            <Text fontSize="xs" color="secondaryGray.600">
                              Referrals
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize="lg" fontWeight="600">
                              {ghs(group.totalFees)}
                            </Text>
                            <Text fontSize="xs" color="secondaryGray.600">
                              Total Fees
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize="lg" fontWeight="600" color="green.500">
                              {ghs(group.paidAmount)}
                            </Text>
                            <Text fontSize="xs" color="secondaryGray.600">
                              Paid
                            </Text>
                          </Box>
                          {group.unpaidAmount > 0 && (
                            <Box>
                              <Text fontSize="lg" fontWeight="600" color="yellow.600">
                                {ghs(group.unpaidAmount)}
                              </Text>
                              <Text fontSize="xs" color="secondaryGray.600">
                                Outstanding
                              </Text>
                            </Box>
                          )}
                        </Flex>
                      </Flex>
                      <Collapse in={expanded} animateOpacity>
                        <Box px="20px" pb="20px">
                          <Box borderTop="1px solid" borderColor="secondaryGray.100" pt="16px">
                            <Text fontWeight="500" mb="12px">
                              Recent Referrals
                            </Text>
                            <TableBox>
                              <Table variant="simple" size="sm">
                                <Thead>
                                  <Tr>
                                    <Th>Referral #</Th>
                                    <Th>Client</Th>
                                    <Th>Date</Th>
                                    <Th>Service Fee</Th>
                                    <Th>Status</Th>
                                  </Tr>
                                </Thead>
                                <Tbody>
                                  {group.referrals.slice(0, 5).map((referral: any) => (
                                    <Tr key={referral.id}>
                                      <Td fontFamily="mono">{referral.referral_number}</Td>
                                      <Td>
                                        <Text fontWeight="500">{referral.client_name}</Text>
                                        {referral.client_phone && (
                                          <Text fontSize="xs" color="secondaryGray.600">
                                            {referral.client_phone}
                                          </Text>
                                        )}
                                      </Td>
                                      <Td>{referral.referral_date ? new Date(referral.referral_date).toLocaleDateString() : '-'}</Td>
                                      <Td>{ghs(referral.service_fee)}</Td>
                                      <Td>
                                        <Badge colorScheme={referralScheme[referral.status] || 'blue'}>{referral.status}</Badge>
                                      </Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </TableBox>
                            {group.referrals.length > 5 && (
                              <Text textAlign="center" mt="12px" fontSize="sm" color="secondaryGray.600">
                                {group.referrals.length} referrals in total
                              </Text>
                            )}
                          </Box>
                        </Box>
                      </Collapse>
                    </Card>
                  )
                })
              )}
            </Stack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Mark Paid Dialog */}
      <AppModal
        isOpen={showPayDialog}
        onClose={() => setShowPayDialog(false)}
        title="Mark Payment as Paid"
        footer={
          <>
            <Button variant="light" onClick={() => setShowPayDialog(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleMarkPaid} isLoading={markPaidMutation.isPending}>
              Confirm Payment
            </Button>
          </>
        }
      >
        {selectedPayment && (
          <Stack spacing="16px" py="8px">
            <Box p="16px" bg={mutedBg} borderRadius="12px">
              <Flex justify="space-between" mb="8px">
                <Text color="secondaryGray.600">Doctor:</Text>
                <Text fontWeight="500">{selectedPayment.referral_doctor?.name}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text color="secondaryGray.600">Amount:</Text>
                <Text fontWeight="bold" fontSize="lg">
                  {ghs(selectedPayment.amount)}
                </Text>
              </Flex>
            </Box>
            <Field label="Payment Method" isRequired>
              <Select variant="main" placeholder="Select method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="cheque">Cheque</option>
              </Select>
            </Field>
            <Field label="Reference Number">
              <Input variant="main" placeholder="Transaction reference..." value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
            </Field>
            <Field label="Notes">
              <Input variant="main" placeholder="Additional notes..." value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
            </Field>
          </Stack>
        )}
      </AppModal>

      {/* Payment Settings Dialog */}
      <AppModal
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        title="Payment Settings"
        footer={
          <>
            <Button variant="light" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleSaveSetting} isLoading={createSettingMutation.isPending}>
              Save Setting
            </Button>
          </>
        }
      >
        <Stack spacing="16px" py="8px">
          <Field label="Doctor (leave empty for default)">
            <Select variant="main" value={settingDoctorId} onChange={(e) => setSettingDoctorId(e.target.value)}>
              <option value="">Default (All Doctors)</option>
              {doctorOptions}
            </Select>
          </Field>
          <Field label="Payment Type">
            <Select variant="main" value={settingPaymentType} onChange={(e) => setSettingPaymentType(e.target.value)}>
              <option value="percentage">Percentage of Service Fee</option>
              <option value="fixed">Fixed Amount</option>
            </Select>
          </Field>
          <Field
            label={settingPaymentType === 'percentage' ? 'Percentage (%)' : 'Fixed Amount (GH₵)'}
            helper={settingPaymentType === 'percentage' ? 'e.g., 10 means 10% of the service fee' : undefined}
          >
            <Input
              variant="main"
              type="number"
              step={settingPaymentType === 'percentage' ? '0.1' : '0.01'}
              placeholder={settingPaymentType === 'percentage' ? 'e.g., 10' : 'e.g., 50.00'}
              value={settingRate}
              onChange={(e) => setSettingRate(e.target.value)}
            />
          </Field>
        </Stack>
      </AppModal>

      {/* Create Manual Payment Dialog */}
      <AppModal
        isOpen={showCreatePaymentDialog}
        onClose={closeCreatePayment}
        title="Create Payment for Doctor"
        description="Create a payment record for a referring doctor"
        footer={
          <>
            <Button variant="light" onClick={closeCreatePayment}>
              Cancel
            </Button>
            <Button variant="brand" leftIcon={<MdAttachMoney />} onClick={handleCreateManualPayment} isLoading={createManualPaymentMutation.isPending}>
              Create Payment
            </Button>
          </>
        }
      >
        <Stack spacing="16px" py="8px">
          <Field label="Select Doctor">
            <Select
              variant="main"
              placeholder="Select a doctor"
              value={createPaymentDoctorId?.toString() || ''}
              onChange={(e) => setCreatePaymentDoctorId(e.target.value ? parseInt(e.target.value) : null)}
            >
              {doctorOptions}
            </Select>
          </Field>
          <Field label="Amount (GH₵)">
            <Input variant="main" type="number" step="0.01" placeholder="Enter amount" value={createPaymentAmount} onChange={(e) => setCreatePaymentAmount(e.target.value)} />
          </Field>
          <Field label="Notes (Optional)">
            <Textarea variant="main" placeholder="Add any notes about this payment..." value={createPaymentNotes} onChange={(e) => setCreatePaymentNotes(e.target.value)} />
          </Field>
        </Stack>
      </AppModal>
    </>
  )
}
