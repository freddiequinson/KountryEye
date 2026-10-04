import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge, Box, Button, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { MdAccessTime, MdCheckCircle, MdCreditCard, MdPeople, MdPersonAdd } from 'react-icons/md'
import api from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { RowBox } from '@/components/dashboard/widgets'

const statusScheme = (status: string) => (status === 'completed' ? 'green' : status === 'waiting' ? 'yellow' : 'brand')

export default function FrontDeskDashboard() {
  const navigate = useNavigate()

  const { data: stats } = useQuery({
    queryKey: ['frontdesk-stats'],
    queryFn: async () => {
      const [visitsRes, prescriptionsRes, registrationsRes] = await Promise.all([
        api.get('/patients/visits/today'),
        api.get('/clinical/prescriptions/pending'),
        api.get('/patients/pending-registrations'),
      ])
      return {
        todayVisits: visitsRes.data.length,
        waiting: visitsRes.data.filter((v: any) => v.status === 'waiting').length,
        inConsultation: visitsRes.data.filter((v: any) => v.status === 'in_consultation').length,
        completed: visitsRes.data.filter((v: any) => v.status === 'completed').length,
        pendingPayments: prescriptionsRes.data.length,
        pendingRegistrations: registrationsRes.data.length,
        recentVisits: visitsRes.data.slice(0, 5),
        pendingPrescriptions: prescriptionsRes.data.slice(0, 5),
      }
    },
    refetchInterval: 30000,
  })

  return (
    <>
      <PageHeader
        title="Front Desk Dashboard"
        description="Today's overview"
        actions={
          <Button variant="brand" onClick={() => navigate('/frontdesk')}>
            Go to Front Desk
          </Button>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 3, xl: 5 }} spacing="20px" mb="20px" data-tour="stats-cards">
        <StatCard name="Today's Visits" value={stats?.todayVisits || 0} icon={MdPeople} iconColor="secondaryGray.600" />
        <StatCard name="Waiting" value={stats?.waiting || 0} icon={MdAccessTime} iconColor="yellow.500" />
        <StatCard name="Completed" value={stats?.completed || 0} icon={MdCheckCircle} iconColor="green.500" />
        <StatCard name="Pending Payments" value={stats?.pendingPayments || 0} icon={MdCreditCard} iconColor="red.500" valueColor="red.500" />
        <StatCard
          name="New Registrations"
          value={stats?.pendingRegistrations || 0}
          icon={MdPersonAdd}
          iconColor="blue.500"
          valueColor="blue.500"
          helpText="Click to review"
          onClick={() => navigate('/frontdesk?tab=registrations')}
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing="20px">
        <SectionCard title="Recent Visits">
          {stats?.recentVisits?.length === 0 ? (
            <Text color="secondaryGray.600" textAlign="center" py="16px">
              No visits today
            </Text>
          ) : (
            <Stack spacing="12px">
              {stats?.recentVisits?.map((visit: any) => (
                <RowBox key={visit.id} p="8px 12px">
                  <Box>
                    <Text as="span" fontWeight="500">
                      {visit.patient_name}
                    </Text>
                    <Text as="span" fontSize="sm" color="secondaryGray.600" ms="8px">
                      {visit.patient_number}
                    </Text>
                  </Box>
                  <Badge colorScheme={statusScheme(visit.status)} borderRadius="full">
                    {visit.status}
                  </Badge>
                </RowBox>
              ))}
            </Stack>
          )}
        </SectionCard>

        <SectionCard title="Pending Payments">
          {stats?.pendingPrescriptions?.length === 0 ? (
            <Text color="secondaryGray.600" textAlign="center" py="16px">
              No pending payments
            </Text>
          ) : (
            <Stack spacing="12px">
              {stats?.pendingPrescriptions?.map((p: any) => (
                <RowBox key={p.id} p="8px 12px">
                  <Box>
                    <Text as="span" fontWeight="500">
                      {p.patient_name}
                    </Text>
                    <Text as="span" fontSize="sm" color="secondaryGray.600" ms="8px">
                      GH₵{p.total_amount?.toLocaleString()}
                    </Text>
                  </Box>
                  <Button size="sm" variant="brand" onClick={() => navigate('/frontdesk')}>
                    Process
                  </Button>
                </RowBox>
              ))}
            </Stack>
          )}
        </SectionCard>
      </SimpleGrid>
    </>
  )
}
