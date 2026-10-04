import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Box, Button, Flex, Input, Select, SimpleGrid, Tab, Table, TabList, TabPanel, TabPanels, Tabs, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react'
import { MdAttachMoney, MdCreditCard, MdDownload, MdTrendingUp } from 'react-icons/md'
import api from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import { AppModal, Pagination, TableMessageRow } from '@/components/ui'

interface Revenue {
  id: number
  category: string
  description: string
  amount: number
  payment_method: string
  reference_type?: string
  reference_id?: number
  created_at: string
}

const ITEMS_PER_PAGE = 20

const categoryScheme: Record<string, string> = { consultation: 'brand', product_sale: 'gray', prescription: 'green', glasses_order: 'yellow', other: 'red' }
const methodScheme: Record<string, string> = { cash: 'green', visioncare: 'brand', insurance: 'yellow', mobile_money: 'gray' }

// Payment-method detail dialogs (insurance has its own, richer dialog)
const METHOD_DIALOGS: Record<string, { title: string; empty: string; match: (m: string) => boolean }> = {
  cash: { title: 'Cash Payments Details', empty: 'No cash payments found', match: (m) => m === 'cash' },
  visioncare: { title: 'VisionCare Payments Details', empty: 'No VisionCare payments found', match: (m) => m === 'visioncare' },
  momo: { title: 'Mobile Money Payments Details', empty: 'No mobile money payments found', match: (m) => m === 'momo' || m === 'mobile_money' },
}

const formatCurrency = (amount: number) => `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const formatCategory = (category: string) => category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

const categoryBadge = (category: string) => <Badge colorScheme={categoryScheme[category] || 'brand'}>{formatCategory(category)}</Badge>
const methodBadge = (method: string) => <Badge colorScheme={methodScheme[method] || 'brand'}>{formatCategory(method)}</Badge>

function RevenueTable({ rows, show, emptyText }: { rows: Revenue[]; show: 'category' | 'method' | 'both'; emptyText: string }) {
  const cols = show === 'both' ? 5 : 4
  return (
    <Box overflowX="auto">
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Date</Th>
            {show === 'both' && <Th>Category</Th>}
            <Th>Description</Th>
            {show === 'category' ? <Th>Category</Th> : <Th>Payment Method</Th>}
            <Th isNumeric>Amount</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.length === 0 ? (
            <TableMessageRow colSpan={cols}>{emptyText}</TableMessageRow>
          ) : (
            rows.map((revenue) => (
              <Tr key={revenue.id}>
                <Td>{new Date(revenue.created_at).toLocaleDateString()}</Td>
                {show === 'both' && <Td>{categoryBadge(revenue.category)}</Td>}
                <Td>{revenue.description}</Td>
                <Td>{show === 'category' ? categoryBadge(revenue.category) : methodBadge(revenue.payment_method)}</Td>
                <Td isNumeric fontWeight="600">
                  {formatCurrency(revenue.amount)}
                </Td>
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
    </Box>
  )
}

export default function RevenuePage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize state from URL params
  const [dateFilter, setDateFilter] = useState(searchParams.get('period') || 'today')
  const [customStartDate, setCustomStartDate] = useState(searchParams.get('start') || '')
  const [customEndDate, setCustomEndDate] = useState(searchParams.get('end') || '')
  const [branchFilter, setBranchFilter] = useState(searchParams.get('branch') || 'all')
  const [methodDialog, setMethodDialog] = useState<string | null>(null)
  const [showInsuranceDialog, setShowInsuranceDialog] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const setParam = (key: string, value: string, keep: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (keep) params.set(key, value)
    else params.delete(key)
    setSearchParams(params, { replace: true })
  }

  const filterParams = () => {
    const params = new URLSearchParams()
    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      params.append('start_date', customStartDate)
      params.append('end_date', customEndDate)
    } else {
      params.append('period', dateFilter)
    }
    if (branchFilter && branchFilter !== 'all') params.append('branch_id', branchFilter)
    return params.toString()
  }

  const liveQuery = { refetchInterval: 15000, refetchOnWindowFocus: true, refetchOnMount: 'always' as const, staleTime: 0 }
  const filterKey = [dateFilter, customStartDate, customEndDate, branchFilter]

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches')).data,
  })

  const { data: revenues = [] } = useQuery<Revenue[]>({
    queryKey: ['revenues', ...filterKey],
    queryFn: async () => (await api.get(`/revenue?${filterParams()}`)).data,
    ...liveQuery,
  })

  const { data: summary } = useQuery({
    queryKey: ['revenue-summary', ...filterKey],
    queryFn: async () => (await api.get(`/revenue/summary?${filterParams()}`)).data,
    ...liveQuery,
  })

  const { data: insuranceBreakdown = [] } = useQuery({
    queryKey: ['insurance-breakdown', ...filterKey],
    queryFn: async () => (await api.get(`/revenue/insurance-breakdown?${filterParams()}`)).data,
    enabled: showInsuranceDialog,
  })

  const totalPages = Math.ceil(revenues.length / ITEMS_PER_PAGE)
  const paginatedRevenues = revenues.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const exportInsuranceCSV = () => {
    const csvContent = [
      ['Date', 'Patient Name', 'Phone', 'Insurance Provider', 'Insurance ID', 'Insurance Number', 'Insurance Limit', 'Amount Claimed', 'Visit Number', 'Category'].join(','),
      ...insuranceBreakdown.map((item: any) =>
        [
          item.date,
          `"${item.patient_name}"`,
          item.patient_phone || '',
          `"${item.insurance_provider}"`,
          item.insurance_id || '',
          item.insurance_number || '',
          item.insurance_limit || 0,
          item.amount,
          item.visit_number || '',
          item.category || '',
        ].join(','),
      ),
    ].join('\n')
    const url = window.URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `insurance-claims-${dateFilter}.csv`
    a.click()
  }

  const byMethod = summary?.by_payment_method || {}
  const methodCards = [
    { key: 'cash', name: 'Cash Payments', value: byMethod.cash || 0, color: 'green.500', help: 'Click to view details' },
    { key: 'momo', name: 'Mobile Money', value: (byMethod.momo || 0) + (byMethod.mobile_money || 0), color: 'yellow.600', help: 'Click to view details' },
    { key: 'visioncare', name: 'VisionCare Payments', value: byMethod.visioncare || 0, color: 'blue.500', help: 'Click to view details' },
    { key: 'insurance', name: 'Insurance Payments', value: byMethod.insurance || 0, color: 'orange.500', help: 'Click to view & export' },
  ]
  const dialog = methodDialog ? METHOD_DIALOGS[methodDialog] : null

  return (
    <>
      <PageHeader
        title="Revenue"
        description="Track all revenue and payments"
        actions={
          <>
            <Select
              variant="main"
              w="180px"
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value)
                setCurrentPage(1)
                setParam('branch', e.target.value, e.target.value !== 'all')
              }}
            >
              <option value="all">All Branches</option>
              {branches.map((branch: any) => (
                <option key={branch.id} value={branch.id.toString()}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Select
              variant="main"
              w="180px"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value)
                setCurrentPage(1)
                setParam('period', e.target.value, e.target.value !== 'today')
              }}
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </Select>
            {dateFilter === 'custom' && (
              <Flex align="center" gap="8px">
                <Input
                  variant="main"
                  type="date"
                  w="150px"
                  aria-label="Start Date"
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
                  aria-label="End Date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value)
                    setParam('end', e.target.value, !!e.target.value)
                  }}
                />
              </Flex>
            )}
          </>
        }
      />

      {/* Summary Cards */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="20px" mb="20px">
        <StatCard name="Total Revenue" value={formatCurrency(summary?.total || 0)} icon={MdAttachMoney} valueColor="green.500" />
        <StatCard name="Consultations" value={formatCurrency(summary?.by_category?.consultation || 0)} icon={MdTrendingUp} />
        <StatCard name="Product Sales" value={formatCurrency(summary?.by_category?.product_sale || 0)} icon={MdCreditCard} />
      </SimpleGrid>

      {/* Payment Method Breakdown */}
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px" mb="20px">
        {methodCards.map((card) => (
          <StatCard
            key={card.key}
            name={card.name}
            value={formatCurrency(card.value)}
            valueColor={card.color}
            helpText={card.help}
            onClick={() => (card.key === 'insurance' ? setShowInsuranceDialog(true) : setMethodDialog(card.key))}
          />
        ))}
      </SimpleGrid>

      {/* Revenue List */}
      <Tabs variant="soft-rounded">
        <TabList gap="8px" mb="16px">
          <Tab>All Revenue</Tab>
          <Tab>Consultations</Tab>
          <Tab>Product Sales</Tab>
        </TabList>
        <TabPanels>
          <TabPanel p="0">
            <Card>
              <RevenueTable rows={paginatedRevenues} show="both" emptyText="No revenue records found" />
              <Pagination page={currentPage} totalPages={totalPages} total={revenues.length} perPage={ITEMS_PER_PAGE} onChange={setCurrentPage} />
            </Card>
          </TabPanel>
          <TabPanel p="0">
            <Card>
              <RevenueTable rows={revenues.filter((r) => r.category === 'consultation')} show="method" emptyText="No consultation revenue found" />
            </Card>
          </TabPanel>
          <TabPanel p="0">
            <Card>
              <RevenueTable rows={revenues.filter((r) => r.category === 'product_sale')} show="method" emptyText="No product sales found" />
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Cash / Mobile Money / VisionCare details */}
      <AppModal isOpen={!!dialog} onClose={() => setMethodDialog(null)} size="3xl" title={dialog?.title}>
        {dialog && <RevenueTable rows={revenues.filter((r) => dialog.match(r.payment_method))} show="category" emptyText={dialog.empty} />}
      </AppModal>

      {/* Insurance Payments Dialog */}
      <AppModal
        isOpen={showInsuranceDialog}
        onClose={() => setShowInsuranceDialog(false)}
        size="6xl"
        title={
          <Flex align="center" justify="space-between" gap="12px">
            Insurance Claims for Billing
            <Button variant="light" size="sm" leftIcon={<MdDownload />} onClick={exportInsuranceCSV}>
              Export CSV
            </Button>
          </Flex>
        }
      >
        <Text fontSize="sm" color="secondaryGray.600" mb="16px">
          Total Claims: {insuranceBreakdown.length} | Total Amount: {formatCurrency(insuranceBreakdown.reduce((sum: number, item: any) => sum + (item.amount || 0), 0))}
        </Text>
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Date</Th>
                <Th>Patient</Th>
                <Th>Insurance Provider</Th>
                <Th>Insurance ID/Number</Th>
                <Th isNumeric>Limit</Th>
                <Th isNumeric>Claimed</Th>
              </Tr>
            </Thead>
            <Tbody>
              {insuranceBreakdown.length === 0 ? (
                <TableMessageRow colSpan={6}>No insurance claims found</TableMessageRow>
              ) : (
                insuranceBreakdown.map((item: any) => (
                  <Tr key={item.id}>
                    <Td>{item.date}</Td>
                    <Td>
                      <Text fontWeight="500">{item.patient_name}</Text>
                      {item.patient_phone && (
                        <Text fontSize="xs" color="secondaryGray.600">
                          {item.patient_phone}
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Badge colorScheme="yellow">{item.insurance_provider}</Badge>
                    </Td>
                    <Td fontSize="sm">
                      {item.insurance_id && <Text>ID: {item.insurance_id}</Text>}
                      {item.insurance_number && <Text>No: {item.insurance_number}</Text>}
                    </Td>
                    <Td isNumeric>{formatCurrency(item.insurance_limit)}</Td>
                    <Td isNumeric fontWeight="600" color="green.500">
                      {formatCurrency(item.amount)}
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
      </AppModal>
    </>
  )
}
