import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Flex, Icon, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { MdAccessTime, MdDescription, MdPeople } from 'react-icons/md'
import { FaStethoscope } from 'react-icons/fa'
import api from '@/lib/api'
import PageHero from '@/components/PageHero'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { RowBox } from '@/components/dashboard/widgets'

export default function DoctorDashboard() {
  const navigate = useNavigate()

  const { data: stats } = useQuery({
    queryKey: ['doctor-stats'],
    queryFn: async () => {
      const queue = (await api.get('/clinical/queue?status=all')).data
      return {
        waiting: queue.filter((v: any) => v.status === 'waiting').length,
        inConsultation: queue.filter((v: any) => v.status === 'in_consultation').length,
        completed: queue.filter((v: any) => v.status === 'completed').length,
        total: queue.length,
        queue: queue.filter((v: any) => v.status === 'waiting').slice(0, 5),
      }
    },
    refetchInterval: 30000,
  })

  return (
    <>
      <PageHero
        title="Doctor Dashboard"
        description="Patient queue overview"
        actions={
          <Button variant="brand" onClick={() => navigate('/doctor/queue')}>
            View Full Queue
          </Button>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px" mb="20px" data-tour="stats-cards">
        <StatCard name="Waiting" value={stats?.waiting || 0} icon={MdAccessTime} iconColor="yellow.500" valueColor="yellow.600" helpText="patients in queue" />
        <StatCard name="In Consultation" value={stats?.inConsultation || 0} icon={FaStethoscope} iconColor="blue.500" valueColor="blue.500" />
        <StatCard name="Completed Today" value={stats?.completed || 0} icon={MdDescription} iconColor="green.500" valueColor="green.500" />
        <StatCard name="Total Visits" value={stats?.total || 0} icon={MdPeople} iconColor="secondaryGray.600" />
      </SimpleGrid>

      <SectionCard title="Patients Waiting">
        {stats?.queue?.length === 0 ? (
          <Text color="secondaryGray.600" textAlign="center" py="32px">
            No patients waiting
          </Text>
        ) : (
          <Stack spacing="12px">
            {stats?.queue?.map((patient: any) => (
              <RowBox key={patient.id}>
                <Flex align="center" gap="12px">
                  <Flex h="40px" w="40px" borderRadius="full" bg="brand.50" align="center" justify="center">
                    <Icon as={MdPeople} color="brand.500" w="20px" h="20px" />
                  </Flex>
                  <Box>
                    <Text fontWeight="500">{patient.patient_name}</Text>
                    <Text fontSize="sm" color="secondaryGray.600">
                      {patient.patient_number} • Waiting {patient.wait_time_minutes} min
                    </Text>
                  </Box>
                </Flex>
                <Button variant="brand" size="sm" onClick={() => navigate(`/doctor/consultation/${patient.id}`)}>
                  Start Consultation
                </Button>
              </RowBox>
            ))}
          </Stack>
        )}
      </SectionCard>
    </>
  )
}
