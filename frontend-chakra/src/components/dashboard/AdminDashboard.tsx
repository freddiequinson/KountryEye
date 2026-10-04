import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, SimpleGrid } from '@chakra-ui/react'
import { MdAccessTime, MdAttachMoney, MdBusiness, MdEvent, MdHowToReg, MdInventory2, MdPeople, MdTrendingUp } from 'react-icons/md'
import api from '@/lib/api'
import type { DashboardStats } from '@/types'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { QuickActions, SummaryList } from '@/components/dashboard/widgets'

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

  const formatCurrency = (amount: number) =>
    `GH₵${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description={`Welcome back, ${user?.first_name}! Here's your business overview.`}
        actions={
          <Button variant="brand" leftIcon={<MdTrendingUp />} onClick={() => navigate('/admin/revenue')}>
            View Reports
          </Button>
        }
      />

      {/* Key Metrics */}
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing="20px" mb="20px" data-tour="stats-cards">
        <StatCard name="Total Patients" value={stats?.patients.total || 0} icon={MdPeople} helpText={`+${stats?.patients.month || 0} this month`} />
        <StatCard
          name="Today's Revenue"
          value={formatCurrency(stats?.sales.today || 0)}
          icon={MdAttachMoney}
          iconColor="green.500"
          valueColor="green.500"
          helpText={`${formatCurrency(stats?.sales.month || 0)} this month`}
        />
        <StatCard name="Today's Visits" value={stats?.visits.today || 0} icon={MdEvent} helpText={`${stats?.visits.month || 0} this month`} />
        <StatCard name="Pending Consultations" value={stats?.pending_consultations || 0} icon={MdAccessTime} iconColor="orange.500" helpText="awaiting doctor" />
      </SimpleGrid>

      {/* Quick Actions & Overview */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing="20px" data-tour="quick-actions">
        <SectionCard title="Quick Actions">
          <QuickActions
            actions={[
              { label: 'Employees', icon: MdHowToReg, onClick: () => navigate('/admin/employees') },
              // Branches are managed from Settings (the standalone branches page was removed)
              { label: 'Branches', icon: MdBusiness, onClick: () => navigate('/admin/settings') },
              { label: 'Inventory', icon: MdInventory2, onClick: () => navigate('/inventory') },
              { label: 'Accounting', icon: MdTrendingUp, onClick: () => navigate('/accounting') },
            ]}
          />
        </SectionCard>

        <SectionCard title="Business Summary">
          <SummaryList
            rows={[
              { label: 'Total Patients', value: stats?.patients.total || 0 },
              { label: 'Monthly Revenue', value: formatCurrency(stats?.sales.month || 0), color: 'green.500' },
              { label: 'Monthly Visits', value: stats?.visits.month || 0 },
              { label: 'New Patients (Month)', value: stats?.patients.month || 0 },
            ]}
          />
        </SectionCard>

        <SectionCard title="System Status">
          <SummaryList
            rows={[
              { label: 'Backend API', value: <Badge colorScheme="green" borderRadius="full">Connected</Badge> },
              { label: 'Database', value: <Badge colorScheme="green" borderRadius="full">Online</Badge> },
              { label: 'Active Sessions', value: '1' },
            ]}
          />
        </SectionCard>
      </SimpleGrid>
    </>
  )
}
