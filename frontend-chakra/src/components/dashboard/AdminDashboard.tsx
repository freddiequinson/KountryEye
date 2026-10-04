import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Flex, Icon, SimpleGrid, Text } from '@chakra-ui/react'
import { MdAccessTime, MdArrowForward, MdAttachMoney, MdBarChart, MdBusiness, MdEvent, MdHowToReg, MdInventory2, MdPeople, MdReceiptLong, MdTrendingUp } from 'react-icons/md'
import api from '@/lib/api'
import type { DashboardStats } from '@/types'
import PageHero from '@/components/PageHero'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { TabbedSections } from '@/components/card/TabCard'
import { DualAreaChart, PieChart } from '@/components/charts'
import { EmptyState } from '@/components/ui'
import { QuickActions, SummaryList } from '@/components/dashboard/widgets'

const formatCurrency = (amount: number) => `GH₵${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const shortCurrency = (v: number) => (v >= 1000 ? `GH₵${(v / 1000).toFixed(1)}k` : `GH₵${Math.round(v)}`)
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')

export function AdminDashboard({ user }: { user: any }) {
  const navigate = useNavigate()

  const { data: stats } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => (await api.get('/dashboard/overview')).data as DashboardStats,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  // 30-day trend and breakdowns (same data the Analytics page uses)
  const { data: analytics } = useQuery({
    queryKey: ['analytics-dashboard', 'month'],
    queryFn: async () => (await api.get('/analytics/dashboard?period=month')).data,
  })

  const daily: any[] = analytics?.trends?.daily || []
  const gender = Object.entries((analytics?.patients?.by_gender || {}) as Record<string, number>)
  const summary = analytics?.summary

  return (
    <>
      <PageHero
        title={`Welcome back, ${user?.first_name}`}
        description="Here is how the clinic is doing today."
        actions={
          <>
            <Button variant="light" leftIcon={<MdBarChart />} onClick={() => navigate('/admin/analytics')}>
              Analytics
            </Button>
            <Button variant="brand" rightIcon={<MdArrowForward />} onClick={() => navigate('/admin/revenue')}>
              View Reports
            </Button>
          </>
        }
      />

      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing="20px" mb="20px" data-tour="stats-cards">
        <StatCard name="Total Patients" value={stats?.patients.total || 0} icon={MdPeople} helpText={`+${stats?.patients.month || 0} this month`} />
        <StatCard
          name="Today's Revenue"
          value={formatCurrency(stats?.sales.today || 0)}
          icon={MdAttachMoney}
          iconColor="green.500"
          helpText={`${formatCurrency(stats?.sales.month || 0)} this month`}
        />
        <StatCard name="Today's Visits" value={stats?.visits.today || 0} icon={MdEvent} iconColor="secondary.500" helpText={`${stats?.visits.month || 0} this month`} />
        <StatCard name="Pending Consultations" value={stats?.pending_consultations || 0} icon={MdAccessTime} iconColor="orange.500" helpText="awaiting doctor" />
      </SimpleGrid>

      <SectionCard
          mb="20px"
          title="Visits and revenue"
          description="Last 30 days"
          actions={
            <Button variant="ghost" size="sm" rightIcon={<MdArrowForward />} onClick={() => navigate('/admin/analytics')}>
              Details
            </Button>
          }
        >
          {daily.length ? (
            <DualAreaChart
              height={300}
              categories={daily.map((d) => shortDate(d.date))}
              left={{ name: 'Visits', data: daily.map((d) => d.visits) }}
              right={{ name: 'Revenue', data: daily.map((d) => d.revenue), formatter: shortCurrency }}
            />
          ) : (
            <EmptyState icon={MdTrendingUp}>No activity recorded yet</EmptyState>
          )}
        </SectionCard>


      <TabbedSections title="Overview">
        <SectionCard title="Quick actions" description="Jump straight to common tasks" data-tour="quick-actions">
          <QuickActions
            columns={{ base: 1, md: 2, xl: 4 }}
            actions={[
              { label: 'Employees', hint: 'Staff, roles and attendance', icon: MdHowToReg, onClick: () => navigate('/admin/employees') },
              // Branches are managed from Settings (the standalone branches page was removed)
              { label: 'Branches', hint: 'Locations and work hours', icon: MdBusiness, color: 'secondary.500', onClick: () => navigate('/admin/settings') },
              { label: 'Inventory', hint: 'Stock, imports and transfers', icon: MdInventory2, color: 'orange.500', onClick: () => navigate('/inventory') },
              { label: 'Accounting', hint: 'Income and expenses', icon: MdReceiptLong, color: 'blue.500', onClick: () => navigate('/accounting') },
            ]}
          />
        </SectionCard>
        <SectionCard title="This month" description="Business summary">
          <SummaryList
            rows={[
              { label: 'Revenue', value: formatCurrency(stats?.sales.month || 0), color: 'green.500' },
              { label: 'Visits', value: stats?.visits.month || 0 },
              { label: 'New patients', value: stats?.patients.month || 0 },
              { label: 'In consultation now', value: stats?.in_consultation || 0 },
            ]}
          />
        </SectionCard>

        <SectionCard title="Patients by gender" description={`${summary?.total_patients ?? stats?.patients.total ?? 0} registered`}>
          {gender.length ? <PieChart height={220} labels={gender.map(([k]) => capitalize(k))} values={gender.map(([, v]) => v)} /> : <EmptyState icon={MdPeople}>No patients yet</EmptyState>}
        </SectionCard>

        <SectionCard title="Outstanding balances" description="Unpaid visit amounts">
          <Flex direction="column" h="100%" justify="space-between" gap="16px">
            <Box>
              <Text fontSize="32px" fontWeight="800" letterSpacing="-0.02em" color="orange.500" lineHeight="1.1">
                {formatCurrency(summary?.outstanding_amount || 0)}
              </Text>
              <Text fontSize="sm" fontWeight="500" color="secondaryGray.600" mt="6px">
                across {summary?.outstanding_count || 0} visit{summary?.outstanding_count === 1 ? '' : 's'}
              </Text>
            </Box>
            <Flex align="center" gap="10px" p="12px" borderRadius="12px" bg="orange.100" _dark={{ bg: 'whiteAlpha.100' }} color="orange.500">
              <Icon as={MdReceiptLong} w="20px" h="20px" />
              <Text fontSize="13px" fontWeight="600" flex="1">
                Review who still owes
              </Text>
              <Button size="xs" variant="light" onClick={() => navigate('/admin/revenue')}>
                Open
              </Button>
            </Flex>
          </Flex>
        </SectionCard>
      </TabbedSections>
    </>
  )
}
