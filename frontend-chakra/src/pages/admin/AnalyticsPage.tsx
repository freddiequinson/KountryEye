import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Box, Flex, Icon, Select, SimpleGrid, Spinner, Stack, Tab, Table, TabList, TabPanel, TabPanels, Tabs, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react'
import { MdAttachMoney, MdCreditCard, MdInventory2, MdPeople, MdTimeline, MdTrendingDown, MdTrendingUp, MdWarningAmber } from 'react-icons/md'
import api from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { TabbedSections } from '@/components/card/TabCard'
import { AppModal, EmptyState } from '@/components/ui'
import { BarChart, DualAreaChart, PieChart } from '@/components/charts'

const formatCurrency = (amount: number) => `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const shortCurrency = (v: number) => `GH₵${v.toLocaleString()}`
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const entries = (obj?: Record<string, number>) => Object.entries(obj || {}) as [string, number][]

function ChangeLine({ value }: { value?: number }) {
  const up = (value ?? 0) >= 0
  return (
    <Flex as="span" align="center" gap="4px" color={up ? 'green.500' : 'red.500'}>
      <Icon as={up ? MdTrendingUp : MdTrendingDown} />
      {value?.toFixed(1)}%
      <Text as="span" color="secondaryGray.600">
        vs previous period
      </Text>
    </Flex>
  )
}

function KeyValueTable({ head, rows, valueFormat = (v) => String(v), capitalizeKeys = true }: { head: [string, string]; rows: [string, number][]; valueFormat?: (v: number) => string; capitalizeKeys?: boolean }) {
  return (
    <Table variant="simple" size="sm">
      <Thead>
        <Tr>
          <Th>{head[0]}</Th>
          <Th isNumeric>{head[1]}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {rows.map(([key, value]) => (
          <Tr key={key}>
            <Td fontWeight="500" textTransform={capitalizeKeys ? 'capitalize' : undefined}>
              {key}
            </Td>
            <Td isNumeric>{valueFormat(value)}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  )
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month')
  const [detail, setDetail] = useState<'revenue' | 'visits' | 'patients' | 'outstanding' | null>(null)

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['analytics-dashboard', period],
    queryFn: async () => (await api.get(`/analytics/dashboard?period=${period}`)).data,
  })

  const { data: outOfStock } = useQuery({
    queryKey: ['analytics-out-of-stock'],
    queryFn: async () => (await api.get('/analytics/out-of-stock?days=30')).data,
  })

  const { data: inventory } = useQuery({
    queryKey: ['analytics-inventory'],
    queryFn: async () => (await api.get('/analytics/inventory')).data,
  })

  const { data: consultations } = useQuery({
    queryKey: ['analytics-consultations', period],
    queryFn: async () => (await api.get(`/analytics/consultations?period=${period}`)).data,
  })

  const { data: staffPerformance } = useQuery({
    queryKey: ['analytics-staff', period],
    queryFn: async () => (await api.get(`/analytics/staff-performance?period=${period}`)).data,
  })

  const { data: financial } = useQuery({
    queryKey: ['analytics-financial', period],
    queryFn: async () => (await api.get(`/analytics/financial?period=${period}`)).data,
  })

  if (dashboardLoading) {
    return (
      <Flex justify="center" align="center" h="256px">
        <Spinner color="brand.500" size="lg" />
      </Flex>
    )
  }

  const summary = dashboard?.summary || {}
  const paymentType = entries(dashboard?.visits?.by_payment_type)
  const revenueByPayment = entries(dashboard?.revenue?.by_payment_type)
  const gender = entries(dashboard?.patients?.by_gender)
  const daily: any[] = dashboard?.trends?.daily || []
  const outItems: any[] = outOfStock?.items || []
  const clickHint = (
    <Text as="span" color="blue.500" display="block" mt="4px">
      Click for details →
    </Text>
  )

  return (
    <>
      <PageHeader
        title="Analytics Dashboard"
        description="Comprehensive insights into your business performance"
        actions={
          <Select variant="main" w="160px" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </Select>
        }
      />

      {/* Summary Cards */}
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px" mb="20px">
        <StatCard
          name="Total Revenue"
          value={formatCurrency(summary.total_revenue || 0)}
          icon={MdAttachMoney}
          helpText={
            <>
              <ChangeLine value={summary.revenue_change_percent} />
              {clickHint}
            </>
          }
          onClick={() => setDetail('revenue')}
        />
        <StatCard
          name="Total Visits"
          value={summary.total_visits || 0}
          icon={MdTimeline}
          helpText={
            <>
              <ChangeLine value={summary.visits_change_percent} />
              {clickHint}
            </>
          }
          onClick={() => setDetail('visits')}
        />
        <StatCard
          name="New Patients"
          value={summary.new_patients || 0}
          icon={MdPeople}
          helpText={
            <>
              Total: {summary.total_patients?.toLocaleString() || 0} patients
              {clickHint}
            </>
          }
          onClick={() => setDetail('patients')}
        />
        <StatCard
          name="Outstanding"
          value={formatCurrency(summary.outstanding_amount || 0)}
          valueColor="red.500"
          icon={MdCreditCard}
          iconColor="red.500"
          helpText={
            <>
              {summary.outstanding_count || 0} unpaid visits
              {clickHint}
            </>
          }
          onClick={() => setDetail('outstanding')}
        />
      </SimpleGrid>

      <Tabs variant="soft-rounded" isLazy>
        <TabList gap="8px" mb="16px" flexWrap="wrap">
          <Tab>Overview</Tab>
          <Tab>Revenue</Tab>
          <Tab>Insurance</Tab>
          <Tab>Inventory</Tab>
          <Tab>Staff</Tab>
          <Tab>Out of Stock</Tab>
        </TabList>

        <TabPanels>
          {/* Overview */}
          <TabPanel p="0">
            <Stack spacing="20px">
              <SectionCard title="Daily Trends" description="Visits and revenue over time">
                <DualAreaChart
                  categories={daily.map((d) => d.date)}
                  left={{ name: 'Visits', data: daily.map((d) => d.visits) }}
                  right={{ name: 'Revenue', data: daily.map((d) => d.revenue), formatter: shortCurrency }}
                />
              </SectionCard>
              <TabbedSections>
                <SectionCard title="Visits by Payment Type">
                  <PieChart labels={paymentType.map(([k]) => capitalize(k))} values={paymentType.map(([, v]) => v)} />
                </SectionCard>
                <SectionCard title="Patients by Gender">
                  <PieChart labels={gender.map(([k]) => capitalize(k))} values={gender.map(([, v]) => v)} />
                </SectionCard>
              </TabbedSections>
              {consultations?.by_type?.length > 0 && (
                <SectionCard title="Consultations by Type" description={`Average fee: ${formatCurrency(consultations?.average_fee || 0)}`}>
                  <BarChart
                    categories={consultations.by_type.map((c: any) => c.type)}
                    series={[
                      { name: 'Count', data: consultations.by_type.map((c: any) => c.count) },
                      { name: 'Revenue', data: consultations.by_type.map((c: any) => c.revenue) },
                    ]}
                  />
                </SectionCard>
              )}
            </Stack>
          </TabPanel>

          {/* Revenue */}
          <TabPanel p="0">
            <Stack spacing="20px">
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing="20px">
                <StatCard name="Consultation Revenue" value={formatCurrency(summary.consultation_revenue || 0)} />
                <StatCard name="Sales Revenue" value={formatCurrency(summary.sales_revenue || 0)} />
                <StatCard
                  name="Net Profit"
                  value={formatCurrency(financial?.summary?.net_profit || 0)}
                  valueColor={(financial?.summary?.net_profit || 0) >= 0 ? 'green.500' : 'red.500'}
                  helpText={`${financial?.summary?.profit_margin || 0}% margin`}
                />
              </SimpleGrid>
              <TabbedSections>
                <SectionCard title="Revenue by Payment Type">
                  <BarChart
                    horizontal
                    categories={revenueByPayment.map(([k]) => capitalize(k))}
                    series={[{ name: 'Revenue', data: revenueByPayment.map(([, v]) => v) }]}
                    formatter={formatCurrency}
                  />
                </SectionCard>
                <SectionCard title="Income vs Expenses">
                  <BarChart
                    distributed
                    colors={['#22c55e', '#ef4444']}
                    categories={['Income', 'Expenses']}
                    series={[{ name: 'Amount', data: [financial?.summary?.total_income || 0, financial?.summary?.total_expenses || 0] }]}
                    formatter={formatCurrency}
                  />
                </SectionCard>
              </TabbedSections>
              {financial?.expense_by_category?.length > 0 && (
                <SectionCard title="Expenses by Category">
                  <PieChart
                    labels={financial.expense_by_category.map((e: any) => e.category)}
                    values={financial.expense_by_category.map((e: any) => e.amount)}
                    formatter={formatCurrency}
                  />
                </SectionCard>
              )}
            </Stack>
          </TabPanel>

          {/* Insurance */}
          <TabPanel p="0">
            <Stack spacing="20px">
              <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px">
                <StatCard name="Insurance Visits" value={dashboard?.insurance?.total_visits || 0} />
                <StatCard name="Total Limit" value={formatCurrency(dashboard?.insurance?.total_limit || 0)} />
                <StatCard name="Insurance Used" value={formatCurrency(dashboard?.insurance?.total_used || 0)} valueColor="blue.500" />
                <StatCard name="Patient Top-ups" value={formatCurrency(dashboard?.insurance?.total_patient_topup || 0)} valueColor="orange.500" />
              </SimpleGrid>
              {dashboard?.insurance?.by_provider?.length > 0 && (
                <SectionCard title="Insurance by Provider">
                  <Box overflowX="auto">
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Provider</Th>
                          <Th isNumeric>Visits</Th>
                          <Th isNumeric>Amount Used</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {dashboard.insurance.by_provider.map((provider: any, index: number) => (
                          <Tr key={index}>
                            <Td fontWeight="500">{provider.provider}</Td>
                            <Td isNumeric>{provider.visits}</Td>
                            <Td isNumeric>{formatCurrency(provider.amount_used)}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </SectionCard>
              )}
            </Stack>
          </TabPanel>

          {/* Inventory */}
          <TabPanel p="0">
            <Stack spacing="20px">
              <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px">
                <StatCard name="Total Products" value={inventory?.summary?.total_products || 0} />
                <StatCard name="Out of Stock" value={inventory?.summary?.out_of_stock_count || 0} valueColor="red.500" />
                <StatCard name="Low Stock" value={inventory?.summary?.low_stock_count || 0} valueColor="orange.500" />
                <StatCard name="Inventory Value" value={formatCurrency(inventory?.summary?.total_inventory_value || 0)} />
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing="20px">
                {inventory?.products_by_category?.length > 0 && (
                  <SectionCard title="Products by Category">
                    <PieChart labels={inventory.products_by_category.map((c: any) => c.category)} values={inventory.products_by_category.map((c: any) => c.count)} />
                  </SectionCard>
                )}
                {inventory?.top_selling_products?.length > 0 && (
                  <SectionCard title="Top Selling Products (30 days)">
                    <BarChart
                      horizontal
                      categories={inventory.top_selling_products.map((p: any) => p.product_name)}
                      series={[{ name: 'Units Sold', data: inventory.top_selling_products.map((p: any) => p.total_sold) }]}
                      colors={['#01B574']}
                    />
                  </SectionCard>
                )}
              </SimpleGrid>
              {inventory?.low_stock_items?.length > 0 && (
                <SectionCard
                  title={
                    <Flex align="center" gap="8px">
                      <Icon as={MdWarningAmber} color="orange.500" />
                      Low Stock Items
                    </Flex>
                  }
                  description="Products that need to be reordered"
                >
                  <Box overflowX="auto">
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Product</Th>
                          <Th>SKU</Th>
                          <Th isNumeric>Current Stock</Th>
                          <Th isNumeric>Reorder Level</Th>
                          <Th>Status</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {inventory.low_stock_items.map((item: any) => (
                          <Tr key={item.product_id}>
                            <Td fontWeight="500">{item.product_name}</Td>
                            <Td>{item.sku || '-'}</Td>
                            <Td isNumeric>{item.current_stock}</Td>
                            <Td isNumeric>{item.reorder_level}</Td>
                            <Td>{item.current_stock === 0 ? <Badge colorScheme="red">Out of Stock</Badge> : <Badge colorScheme="yellow">Low Stock</Badge>}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </SectionCard>
              )}
            </Stack>
          </TabPanel>

          {/* Staff */}
          <TabPanel p="0">
            <Stack spacing="20px">
              <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px">
                <StatCard name="Present" value={staffPerformance?.attendance?.present || 0} valueColor="green.500" />
                <StatCard name="Late" value={staffPerformance?.attendance?.late || 0} valueColor="orange.500" />
                <StatCard name="Absent" value={staffPerformance?.attendance?.absent || 0} valueColor="red.500" />
                <StatCard name="Total Records" value={staffPerformance?.attendance?.total_records || 0} />
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing="20px">
                {staffPerformance?.visits_by_staff?.length > 0 && (
                  <SectionCard title="Visits Recorded by Staff">
                    <BarChart
                      horizontal
                      categories={staffPerformance.visits_by_staff.map((s: any) => s.staff_name)}
                      series={[{ name: 'Visits', data: staffPerformance.visits_by_staff.map((s: any) => s.visits_recorded) }]}
                    />
                  </SectionCard>
                )}
                {staffPerformance?.consultations_by_doctor?.length > 0 && (
                  <SectionCard title="Consultations by Doctor">
                    <BarChart
                      horizontal
                      categories={staffPerformance.consultations_by_doctor.map((d: any) => d.doctor_name)}
                      series={[{ name: 'Consultations', data: staffPerformance.consultations_by_doctor.map((d: any) => d.consultations) }]}
                      colors={['#01B574']}
                    />
                  </SectionCard>
                )}
              </SimpleGrid>
            </Stack>
          </TabPanel>

          {/* Out of Stock */}
          <TabPanel p="0">
            <SectionCard
              title={
                <Flex align="center" gap="8px">
                  <Icon as={MdInventory2} color="red.500" />
                  Out of Stock Prescription Requests
                </Flex>
              }
              description="Products requested in prescriptions but not available in stock (last 30 days). Use this data to identify products to reorder."
            >
              <SimpleGrid columns={2} spacing="16px" mb="24px">
                <Box p="16px" bg="red.50" border="1px solid" borderColor="red.200" borderRadius="16px">
                  <Text fontSize="sm" color="red.600">
                    Total Requests
                  </Text>
                  <Text fontSize="3xl" fontWeight="bold" color="red.700">
                    {outOfStock?.total_requests || 0}
                  </Text>
                </Box>
                <Box p="16px" bg="orange.50" border="1px solid" borderColor="orange.200" borderRadius="16px">
                  <Text fontSize="sm" color="orange.600">
                    Unique Products
                  </Text>
                  <Text fontSize="3xl" fontWeight="bold" color="orange.700">
                    {outOfStock?.unique_products || 0}
                  </Text>
                </Box>
              </SimpleGrid>

              {outItems.length > 0 ? (
                <>
                  <Box mb="24px">
                    <BarChart
                      horizontal
                      categories={outItems.slice(0, 10).map((i) => i.product_name)}
                      series={[{ name: 'Times Requested', data: outItems.slice(0, 10).map((i) => i.request_count) }]}
                      colors={['#ef4444']}
                    />
                  </Box>
                  <Box overflowX="auto">
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Product</Th>
                          <Th isNumeric>Times Requested</Th>
                          <Th isNumeric>Total Quantity</Th>
                          <Th>Last Requested</Th>
                          <Th>Priority</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {outItems.map((item, index) => (
                          <Tr key={item.product_id || index}>
                            <Td fontWeight="500">{item.product_name}</Td>
                            <Td isNumeric>{item.request_count}</Td>
                            <Td isNumeric>{item.total_quantity_requested}</Td>
                            <Td>{item.last_requested ? new Date(item.last_requested).toLocaleDateString() : '-'}</Td>
                            <Td>
                              {item.request_count >= 5 ? (
                                <Badge colorScheme="red">High</Badge>
                              ) : item.request_count >= 3 ? (
                                <Badge colorScheme="yellow">Medium</Badge>
                              ) : (
                                <Badge>Low</Badge>
                              )}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </>
              ) : (
                <EmptyState icon={MdInventory2}>No out-of-stock requests in the last 30 days</EmptyState>
              )}
            </SectionCard>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Revenue Details */}
      <AppModal
        isOpen={detail === 'revenue'}
        onClose={() => setDetail(null)}
        size="2xl"
        title={
          <Flex align="center" gap="8px">
            <Icon as={MdAttachMoney} />
            Revenue Details
          </Flex>
        }
      >
        <Stack spacing="16px">
          <SimpleGrid columns={2} spacing="16px">
            <StatCard name="Total Revenue" value={formatCurrency(summary.total_revenue || 0)} />
            <StatCard
              name="Change vs Previous"
              value={`${(summary.revenue_change_percent || 0) >= 0 ? '+' : ''}${summary.revenue_change_percent?.toFixed(1)}%`}
              valueColor={(summary.revenue_change_percent || 0) >= 0 ? 'green.500' : 'red.500'}
            />
            <StatCard name="Consultation Revenue" value={formatCurrency(summary.consultation_revenue || 0)} />
            <StatCard name="Sales Revenue" value={formatCurrency(summary.sales_revenue || 0)} />
          </SimpleGrid>
          <SectionCard title={<Text fontSize="sm">Revenue by Payment Method</Text>}>
            <KeyValueTable head={['Payment Method', 'Amount']} rows={revenueByPayment} valueFormat={formatCurrency} />
          </SectionCard>
          {entries(dashboard?.revenue?.by_category).length > 0 && (
            <SectionCard title={<Text fontSize="sm">Revenue by Category</Text>}>
              <KeyValueTable head={['Category', 'Amount']} rows={entries(dashboard.revenue.by_category)} valueFormat={formatCurrency} />
            </SectionCard>
          )}
        </Stack>
      </AppModal>

      {/* Visits Details */}
      <AppModal
        isOpen={detail === 'visits'}
        onClose={() => setDetail(null)}
        size="2xl"
        title={
          <Flex align="center" gap="8px">
            <Icon as={MdTimeline} />
            Visits Details
          </Flex>
        }
      >
        <Stack spacing="16px">
          <SimpleGrid columns={2} spacing="16px">
            <StatCard name="Total Visits" value={summary.total_visits || 0} />
            <StatCard
              name="Change vs Previous"
              value={`${(summary.visits_change_percent || 0) >= 0 ? '+' : ''}${summary.visits_change_percent?.toFixed(1)}%`}
              valueColor={(summary.visits_change_percent || 0) >= 0 ? 'green.500' : 'red.500'}
            />
          </SimpleGrid>
          <SectionCard title={<Text fontSize="sm">Visits by Status</Text>}>
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Status</Th>
                  <Th isNumeric>Count</Th>
                </Tr>
              </Thead>
              <Tbody>
                {entries(dashboard?.visits?.by_status).map(([status, count]) => (
                  <Tr key={status}>
                    <Td>
                      <Badge colorScheme={status === 'completed' ? 'brand' : 'gray'} variant={status === 'completed' || status === 'waiting' ? 'subtle' : 'outline'}>
                        {status}
                      </Badge>
                    </Td>
                    <Td isNumeric>{count}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </SectionCard>
          <SectionCard title={<Text fontSize="sm">Visits by Payment Type</Text>}>
            <KeyValueTable head={['Payment Type', 'Count']} rows={paymentType} />
          </SectionCard>
        </Stack>
      </AppModal>

      {/* Patients Details */}
      <AppModal
        isOpen={detail === 'patients'}
        onClose={() => setDetail(null)}
        size="2xl"
        title={
          <Flex align="center" gap="8px">
            <Icon as={MdPeople} />
            Patients Details
          </Flex>
        }
      >
        <Stack spacing="16px">
          <SimpleGrid columns={2} spacing="16px">
            <StatCard name="New Patients (This Period)" value={summary.new_patients || 0} />
            <StatCard name="Total Patients" value={summary.total_patients?.toLocaleString() || 0} />
          </SimpleGrid>
          <SectionCard title={<Text fontSize="sm">Patients by Gender</Text>}>
            <PieChart labels={gender.map(([k]) => capitalize(k))} values={gender.map(([, v]) => v)} height={200} />
            <KeyValueTable head={['Gender', 'Count']} rows={gender} />
          </SectionCard>
        </Stack>
      </AppModal>

      {/* Outstanding Details */}
      <AppModal
        isOpen={detail === 'outstanding'}
        onClose={() => setDetail(null)}
        size="2xl"
        title={
          <Flex align="center" gap="8px">
            <Icon as={MdCreditCard} color="red.500" />
            Outstanding Payments
          </Flex>
        }
      >
        <Stack spacing="16px">
          <SimpleGrid columns={2} spacing="16px">
            <Card border="1px solid" borderColor="red.200">
              <Text fontSize="sm" color="red.600">
                Total Outstanding
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="red.500">
                {formatCurrency(summary.outstanding_amount || 0)}
              </Text>
            </Card>
            <Card border="1px solid" borderColor="orange.200">
              <Text fontSize="sm" color="orange.600">
                Unpaid Visits
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="orange.500">
                {summary.outstanding_count || 0}
              </Text>
            </Card>
          </SimpleGrid>
          <SectionCard title={<Text fontSize="sm">What This Means</Text>}>
            <Stack spacing="8px" fontSize="sm" color="secondaryGray.600">
              <Text>
                <strong>Outstanding Amount:</strong> Total unpaid consultation fees from visits marked as "unpaid" or "partial".
              </Text>
              <Text>
                <strong>Unpaid Visits:</strong> Number of visits where the patient has not fully paid the consultation fee.
              </Text>
              <Text pt="8px" color="blue.500">
                💡 Tip: Go to Front Desk → Visit Payments to collect outstanding payments.
              </Text>
            </Stack>
          </SectionCard>
        </Stack>
      </AppModal>
    </>
  )
}
