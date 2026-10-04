import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Box, Button, HStack, SimpleGrid, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react'
import { MdAccessTime, MdAdd, MdArrowForward, MdAttachMoney, MdDescription, MdPeople, MdShowChart, MdVisibility } from 'react-icons/md'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import PageHero from '@/components/PageHero'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { EmptyState } from '@/components/ui'
import { QuickActions } from '@/components/dashboard/widgets'
import { SCAN_TYPE_LABELS, StatusBadge } from './shared'

export default function TechnicianDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data: summary } = useQuery({
    queryKey: ['technician-summary'],
    queryFn: async () => (await api.get('/technician/analytics/summary')).data,
  })

  const { data: recentReferrals = [] } = useQuery({
    queryKey: ['recent-referrals'],
    queryFn: async () => (await api.get('/technician/referrals?limit=5')).data,
  })

  const { data: pendingScans = [] } = useQuery({
    queryKey: ['pending-scans'],
    queryFn: async () => (await api.get('/technician/scans?status=pending&limit=5')).data,
  })

  const viewAll = (path: string) => (
    <Button variant="ghost" size="sm" rightIcon={<MdArrowForward />} onClick={() => navigate(path)}>
      View All
    </Button>
  )

  return (
    <>
      <PageHero
        title="Technician Dashboard"
        description={`Welcome back, ${user?.first_name}! Manage referrals and scans.`}
        actions={
          <HStack spacing="8px" data-tour="quick-actions">
            <Button variant="brand" leftIcon={<MdAdd />} onClick={() => navigate('/technician/referrals/new')}>
              New Referral
            </Button>
            <Button variant="light" leftIcon={<MdVisibility />} onClick={() => navigate('/technician/scans/new')}>
              New Scan
            </Button>
          </HStack>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing="20px" mb="20px" data-tour="stats-cards">
        <StatCard name="Total Referrals" value={summary?.total_referrals || 0} icon={MdPeople} helpText="External referrals received" />
        <StatCard name="Total Scans" value={summary?.total_scans || 0} icon={MdVisibility} helpText="Scans performed" />
        <StatCard name="Revenue" value={`GH₵ ${(summary?.total_revenue || 0).toLocaleString()}`} icon={MdAttachMoney} helpText="From referral services" />
        <StatCard
          name="Pending Payments"
          value={summary?.pending_payments?.count || 0}
          icon={MdAccessTime}
          helpText={`GH₵ ${(summary?.pending_payments?.amount || 0).toLocaleString()} due`}
        />
      </SimpleGrid>

      {summary?.scans_by_type && Object.keys(summary.scans_by_type).length > 0 && (
        <SectionCard title="Scans by Type" mb="20px">
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing="16px">
            {Object.entries(summary.scans_by_type).map(([type, count]) => (
              <Box key={type} textAlign="center" p="16px" bg="secondaryGray.100" _dark={{ bg: 'whiteAlpha.100' }} borderRadius="12px">
                <Text fontSize="2xl" fontWeight="700">
                  {count as number}
                </Text>
                <Text fontSize="sm" color="secondaryGray.600">
                  {SCAN_TYPE_LABELS[type] || type.toUpperCase()}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </SectionCard>
      )}

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing="20px" mb="20px">
        <SectionCard title="Recent Referrals" description="Latest external referrals" actions={viewAll('/technician/referrals')}>
          {recentReferrals.length === 0 ? (
            <EmptyState icon={MdPeople} title="No referrals yet">
              <Button variant="link" colorScheme="brand" mt="8px" onClick={() => navigate('/technician/referrals/new')}>
                Add your first referral
              </Button>
            </EmptyState>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Client</Th>
                    <Th>Referring Doctor</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {recentReferrals.map((referral: any) => (
                    <Tr key={referral.id} cursor="pointer" _hover={{ bg: 'secondaryGray.100', _dark: { bg: 'whiteAlpha.50' } }} onClick={() => navigate(`/technician/referrals/${referral.id}`)}>
                      <Td>
                        <Text fontWeight="600">{referral.client_name}</Text>
                        <Text fontSize="xs" color="secondaryGray.600">
                          {referral.referral_number}
                        </Text>
                      </Td>
                      <Td>
                        <Text>{referral.referral_doctor?.name}</Text>
                        <Text fontSize="xs" color="secondaryGray.600">
                          {referral.referral_doctor?.clinic_name}
                        </Text>
                      </Td>
                      <Td>
                        <StatusBadge status={referral.status} />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </SectionCard>

        <SectionCard title="Pending Scans" description="Scans awaiting completion" actions={viewAll('/technician/scans')}>
          {pendingScans.length === 0 ? (
            <EmptyState icon={MdVisibility}>No pending scans</EmptyState>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Scan Type</Th>
                    <Th>Patient/Client</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {pendingScans.map((scan: any) => (
                    <Tr key={scan.id} cursor="pointer" _hover={{ bg: 'secondaryGray.100', _dark: { bg: 'whiteAlpha.50' } }} onClick={() => navigate(`/technician/scans/${scan.id}`)}>
                      <Td>
                        <Text fontWeight="600">{SCAN_TYPE_LABELS[scan.scan_type] || scan.scan_type}</Text>
                        <Text fontSize="xs" color="secondaryGray.600">
                          {scan.scan_number}
                        </Text>
                      </Td>
                      <Td>{scan.patient?.name || scan.client_name || 'N/A'}</Td>
                      <Td>
                        <StatusBadge status={scan.status} />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </SectionCard>
      </SimpleGrid>

      <SectionCard title="Quick Actions">
        <QuickActions
          columns={{ base: 2, md: 4 }}
          actions={[
            { label: 'New Referral', icon: MdPeople, onClick: () => navigate('/technician/referrals/new') },
            { label: 'OCT Scan', icon: MdVisibility, onClick: () => navigate('/technician/scans/new?type=oct') },
            { label: 'Visual Field Test', icon: MdShowChart, onClick: () => navigate('/technician/scans/new?type=vft') },
            { label: 'Referring Doctors', icon: MdDescription, onClick: () => navigate('/technician/doctors') },
          ]}
        />
      </SectionCard>
    </>
  )
}
