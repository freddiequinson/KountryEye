import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Badge, Box, Button, Flex, Icon, Select, SimpleGrid, Spinner, Stack, Text } from '@chakra-ui/react'
import { MdAccessTime, MdChevronRight, MdPerson, MdVisibility } from 'react-icons/md'
import api from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import { EmptyState } from '@/components/ui'

interface QueueItem {
  id: number
  patient_id: number
  patient_name: string
  patient_number: string
  visit_type: string
  reason: string
  status: string
  consultation_type: string
  wait_time_minutes: number
  visit_date: string
}

const statusSchemes: Record<string, string> = {
  waiting: 'yellow',
  in_consultation: 'brand',
  completed: 'green',
  cancelled: 'red',
}

const formatWaitTime = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export default function DoctorQueuePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('active')

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['doctor-queue', statusFilter],
    queryFn: async () => (await api.get(`/clinical/queue?status=${statusFilter}`)).data,
    refetchInterval: 5000,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ visitId, status }: { visitId: number; status: string }) => api.patch(`/clinical/visits/${visitId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
    },
  })

  const startConsultation = (item: QueueItem) => {
    updateStatusMutation.mutate({ visitId: item.id, status: 'in_consultation' })
    navigate(`/doctor/consultation/${item.id}`)
  }

  const count = (status: string) => queue.filter((q: QueueItem) => q.status === status).length

  return (
    <>
      <PageHeader
        title="Patient Queue"
        description="Patients waiting for consultation"
        actions={
          <Select variant="main" w="180px" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="active">Active (All)</option>
            <option value="waiting">Waiting Only</option>
            <option value="in_consultation">In Consultation</option>
            <option value="completed">Completed</option>
          </Select>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="20px" mb="20px" data-tour="queue-stats">
        <StatCard name="Waiting" value={count('waiting')} />
        <StatCard name="In Consultation" value={count('in_consultation')} />
        <StatCard name="Completed Today" value={count('completed')} />
      </SimpleGrid>

      <Stack spacing="12px" data-tour="queue-list">
        {isLoading ? (
          <Card>
            <Flex justify="center" py="32px">
              <Spinner color="brand.500" />
            </Flex>
          </Card>
        ) : queue.length === 0 ? (
          <Card>
            <EmptyState>No patients in queue</EmptyState>
          </Card>
        ) : (
          queue.map((item: QueueItem, index: number) => (
            <Card key={item.id} p="16px" _hover={{ boxShadow: 'lg' }} transition="box-shadow 0.2s">
              <Flex justify="space-between" align={{ base: 'start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap="12px">
                <Flex align="center" gap="16px">
                  <Flex h="48px" w="48px" minW="48px" borderRadius="full" bg="brand.50" align="center" justify="center">
                    <Icon as={MdPerson} w="24px" h="24px" color="brand.500" />
                  </Flex>
                  <Box>
                    <Flex align="center" gap="8px">
                      <Text fontWeight="600">{item.patient_name}</Text>
                      <Badge variant="outline">{item.patient_number}</Badge>
                    </Flex>
                    <Flex align="center" gap="12px" fontSize="sm" color="secondaryGray.600" mt="4px">
                      <Flex align="center" gap="4px">
                        <Icon as={MdVisibility} w="12px" h="12px" />
                        {item.consultation_type || 'General'}
                      </Flex>
                      <Flex align="center" gap="4px">
                        <Icon as={MdAccessTime} w="12px" h="12px" />
                        {formatWaitTime(item.wait_time_minutes)}
                      </Flex>
                    </Flex>
                    {item.reason && (
                      <Text fontSize="sm" color="secondaryGray.600" mt="4px">
                        Reason: {item.reason}
                      </Text>
                    )}
                  </Box>
                </Flex>
                <Flex align="center" gap="12px">
                  <Badge colorScheme={statusSchemes[item.status] || 'gray'}>{item.status.replace('_', ' ')}</Badge>
                  {item.status === 'waiting' && (
                    <Button
                      variant="brand"
                      rightIcon={<MdChevronRight />}
                      onClick={() => startConsultation(item)}
                      data-tour={index === 0 ? 'start-consultation' : undefined}
                    >
                      Start Consultation
                    </Button>
                  )}
                  {item.status === 'in_consultation' && (
                    <Button variant="light" rightIcon={<MdChevronRight />} onClick={() => navigate(`/doctor/consultation/${item.id}`)}>
                      Continue
                    </Button>
                  )}
                </Flex>
              </Flex>
            </Card>
          ))
        )}
      </Stack>
    </>
  )
}
