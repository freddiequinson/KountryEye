import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button, SimpleGrid } from '@chakra-ui/react'
import { MdBarChart, MdCampaign, MdPeople, MdPersonAdd, MdTrackChanges, MdTrendingUp } from 'react-icons/md'
import api from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { QuickActions, SummaryList } from '@/components/dashboard/widgets'

export function MarketingDashboard({ user }: { user: any }) {
  const navigate = useNavigate()

  const { data: stats } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => (await api.get('/dashboard/overview')).data,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  return (
    <>
      <PageHeader
        title="Marketing Dashboard"
        description={`Welcome, ${user?.first_name}! Track campaigns and patient growth.`}
        actions={
          <Button variant="brand" leftIcon={<MdCampaign />} onClick={() => navigate('/marketing')}>
            Campaigns
          </Button>
        }
      />

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing="20px" mb="20px" data-tour="stats-cards">
        <StatCard name="Total Patients" value={stats?.patients.total || 0} icon={MdPeople} helpText="registered patients" />
        <StatCard
          name="New This Month"
          value={stats?.patients.month || 0}
          icon={MdPersonAdd}
          iconColor="green.500"
          valueColor="green.500"
          helpText="new registrations"
        />
        <StatCard name="Monthly Visits" value={stats?.visits.month || 0} icon={MdTrendingUp} helpText="patient visits" />
        <StatCard name="Active Campaigns" value={0} icon={MdTrackChanges} iconColor="orange.500" helpText="running campaigns" />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing="20px" data-tour="quick-actions">
        <SectionCard title="Quick Actions">
          <QuickActions
            actions={[
              { label: 'Campaigns', icon: MdCampaign, onClick: () => navigate('/marketing') },
              { label: 'Patient List', icon: MdPeople, onClick: () => navigate('/patients') },
              { label: 'Analytics', icon: MdBarChart, disabled: true },
              { label: 'Leads', icon: MdTrackChanges, disabled: true },
            ]}
          />
        </SectionCard>

        <SectionCard title="Growth Summary">
          <SummaryList
            rows={[
              { label: 'Total Patients', value: stats?.patients.total || 0 },
              { label: 'New This Month', value: `+${stats?.patients.month || 0}`, color: 'green.500' },
              { label: 'Monthly Visits', value: stats?.visits.month || 0 },
              { label: "Today's Visits", value: stats?.visits.today || 0 },
            ]}
          />
        </SectionCard>
      </SimpleGrid>
    </>
  )
}
