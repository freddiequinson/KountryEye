import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge, Box, Button, Flex, Icon, SimpleGrid, Stack, Text, useColorModeValue } from '@chakra-ui/react'
import { MdAccessTime, MdCheckCircle, MdDescription, MdErrorOutline, MdPeople } from 'react-icons/md'
import { FaStethoscope } from 'react-icons/fa'
import api from '@/lib/api'
import PageHero from '@/components/PageHero'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { TabbedSections } from '@/components/card/TabCard'
import { QuickActions } from '@/components/dashboard/widgets'

export function DoctorDashboard({ user }: { user: any }) {
  const navigate = useNavigate()
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const textColor = useColorModeValue('secondaryGray.900', 'white')

  const { data: queueData } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: async () => (await api.get('/clinical/queue?status=all')).data,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const { data: stats } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => (await api.get('/dashboard/overview')).data,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const waitingPatients = queueData?.filter((v: any) => v.status === 'waiting') || []
  const inProgressPatients = queueData?.filter((v: any) => v.status === 'in_progress') || []
  const completedToday = queueData?.filter((v: any) => v.status === 'completed') || []

  return (
    <>
      <PageHero
        title="Doctor Dashboard"
        description={`Welcome, Dr. ${user?.last_name}! ${
          waitingPatients.length > 0
            ? `You have ${waitingPatients.length} patient${waitingPatients.length > 1 ? 's' : ''} waiting.`
            : 'No patients waiting.'
        }`}
        actions={
          <Button variant="brand" size="lg" leftIcon={<FaStethoscope />} onClick={() => navigate('/doctor/queue')}>
            Open Queue ({waitingPatients.length})
          </Button>
        }
      />

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing="20px" mb="20px" data-tour="stats-cards">
        <StatCard
          name="Waiting"
          value={waitingPatients.length}
          icon={MdAccessTime}
          iconColor="orange.500"
          valueColor="orange.500"
          helpText="patients in queue"
        />
        <StatCard
          name="In Progress"
          value={inProgressPatients.length}
          icon={FaStethoscope}
          iconColor="blue.500"
          valueColor="blue.500"
          helpText="current consultation"
        />
        <StatCard
          name="Completed Today"
          value={completedToday.length}
          icon={MdCheckCircle}
          iconColor="green.500"
          valueColor="green.500"
          helpText="consultations done"
        />
        <StatCard name="Total Patients" value={stats?.patients.total || 0} icon={MdPeople} helpText="in system" />
      </SimpleGrid>

      <TabbedSections data-tour="quick-actions">
        <SectionCard
          title="Waiting Patients"
          actions={waitingPatients.length > 0 && <Badge borderRadius="full">{waitingPatients.length} waiting</Badge>}
        >
          {waitingPatients.length === 0 ? (
            <Flex direction="column" align="center" py="32px" color="secondaryGray.600">
              <Icon as={MdCheckCircle} w="48px" h="48px" color="green.500" mb="8px" />
              <Text>No patients waiting</Text>
            </Flex>
          ) : (
            <Stack spacing="12px">
              {waitingPatients.slice(0, 5).map((visit: any, index: number) => (
                <Flex
                  key={visit.id}
                  align="center"
                  justify="space-between"
                  p="12px"
                  border="1px solid"
                  borderColor={borderColor}
                  borderRadius="12px"
                  cursor="pointer"
                  _hover={{ bg: hoverBg }}
                  onClick={() => navigate('/doctor/queue')}
                >
                  <Flex align="center" gap="12px">
                    <Flex w="32px" h="32px" borderRadius="full" bg="brand.50" color="brand.600" align="center" justify="center" fontSize="sm" fontWeight="600">
                      {index + 1}
                    </Flex>
                    <Box>
                      <Text fontWeight="500" color={textColor}>
                        {visit.patient?.first_name} {visit.patient?.last_name}
                      </Text>
                      <Text fontSize="xs" color="secondaryGray.600">
                        {visit.visit_type || 'General'}
                      </Text>
                    </Box>
                  </Flex>
                  <Badge colorScheme="orange" variant="outline" borderRadius="full">
                    Waiting
                  </Badge>
                </Flex>
              ))}
              {waitingPatients.length > 5 && (
                <Button variant="ghost" w="100%" onClick={() => navigate('/doctor/queue')}>
                  View all {waitingPatients.length} patients
                </Button>
              )}
            </Stack>
          )}
        </SectionCard>

        <SectionCard title="Quick Actions">
          <QuickActions
            actions={[
              { label: 'Patient Queue', icon: FaStethoscope, onClick: () => navigate('/doctor/queue') },
              { label: 'Find Patient', icon: MdPeople, onClick: () => navigate('/patients') },
              { label: 'Patient Records', icon: MdDescription, onClick: () => navigate('/patients') },
              { label: 'Reports', icon: MdErrorOutline, disabled: true },
            ]}
          />
        </SectionCard>
      </TabbedSections>
    </>
  )
}
