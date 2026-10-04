import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button, SimpleGrid } from '@chakra-ui/react'
import { MdAccessTime, MdAssignment, MdPeople, MdPersonAdd, MdPointOfSale, MdReceiptLong } from 'react-icons/md'
import api from '@/lib/api'
import PageHero from '@/components/PageHero'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { QuickActions, SummaryList } from '@/components/dashboard/widgets'

export function FrontDeskDashboard({ user }: { user: any }) {
  const navigate = useNavigate()

  const { data: stats } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => (await api.get('/dashboard/overview')).data,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const { data: queueData } = useQuery({
    queryKey: ['doctor-queue-summary'],
    queryFn: async () => (await api.get('/clinical/queue?status=all')).data,
  })

  const waitingCount = queueData?.filter((v: any) => v.status === 'waiting').length || 0
  const inProgressCount = queueData?.filter((v: any) => v.status === 'in_progress').length || 0

  const formatCurrency = (amount: number) =>
    `GH₵${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <>
      <PageHero
        title="Front Desk"
        description={`Welcome, ${user?.first_name}! Manage patient visits and registrations.`}
        actions={
          <>
            <Button variant="light" leftIcon={<MdAssignment />} onClick={() => navigate('/frontdesk')}>
              Check-in Patient
            </Button>
            <Button variant="brand" leftIcon={<MdPersonAdd />} onClick={() => navigate('/frontdesk/register')}>
              New Patient
            </Button>
          </>
        }
      />

      {/* Key Metrics for Front Desk */}
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing="20px" mb="20px" data-tour="stats-cards">
        <StatCard name="Today's Check-ins" value={stats?.visits.today || 0} icon={MdAssignment} helpText="patients checked in today" />
        <StatCard
          name="Waiting for Doctor"
          value={waitingCount}
          icon={MdAccessTime}
          iconColor="orange.500"
          valueColor="orange.500"
          helpText={`${inProgressCount} in consultation`}
        />
        <StatCard
          name="Today's Sales"
          value={formatCurrency(stats?.sales.today || 0)}
          icon={MdReceiptLong}
          iconColor="green.500"
          valueColor="green.500"
          helpText="total revenue today"
        />
        <StatCard name="Total Patients" value={stats?.patients.total || 0} icon={MdPeople} helpText={`+${stats?.patients.month || 0} this month`} />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing="20px" data-tour="quick-actions">
        <SectionCard title="Quick Actions">
          <QuickActions
            actions={[
              { label: 'Register Patient', icon: MdPersonAdd, onClick: () => navigate('/frontdesk/register') },
              { label: 'Check-in Visit', icon: MdAssignment, onClick: () => navigate('/frontdesk') },
              { label: 'Point of Sale', icon: MdPointOfSale, onClick: () => navigate('/sales/pos') },
              { label: 'Find Patient', icon: MdPeople, onClick: () => navigate('/patients') },
            ]}
          />
        </SectionCard>

        <SectionCard title="Today's Summary">
          <SummaryList
            rows={[
              { label: 'Patients Checked In', value: stats?.visits.today || 0 },
              { label: 'Waiting for Doctor', value: waitingCount, color: 'orange.500' },
              { label: 'In Consultation', value: inProgressCount },
              { label: 'Sales Today', value: formatCurrency(stats?.sales.today || 0), color: 'green.500' },
            ]}
          />
        </SectionCard>
      </SimpleGrid>
    </>
  )
}
