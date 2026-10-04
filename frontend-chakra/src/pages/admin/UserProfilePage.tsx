import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  Box,
  Flex,
  Heading,
  Icon,
  Progress,
  Select,
  SimpleGrid,
  Spinner,
  Tab,
  Table,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { MdBusiness, MdEmail, MdPhone, MdShield } from 'react-icons/md'
import api from '@/lib/api'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { TableMessageRow } from '@/components/ui'

const TABS = ['overview', 'attendance', 'activity', 'fund-requests']

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount)
const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const attendanceScheme: Record<string, string> = { present: 'green', late: 'yellow', absent: 'red', on_leave: 'blue' }
const memoScheme: Record<string, string> = { received: 'green', rejected: 'red', pending: 'yellow' }

function SummaryTile({ value, label, color, bg }: { value: React.ReactNode; label: string; color?: string; bg: string }) {
  return (
    <Box textAlign="center" p="12px" bg={bg} borderRadius="12px">
      <Text fontSize="2xl" fontWeight="bold" color={color}>
        {value}
      </Text>
      <Text fontSize="xs" color="secondaryGray.600">
        {label}
      </Text>
    </Box>
  )
}

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const [statsPeriod, setStatsPeriod] = useState('month')
  const [activeTab, setActiveTab] = useState('overview')

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => (await api.get(`/user-profile/${userId}`)).data,
    enabled: !!userId,
  })

  const { data: stats } = useQuery({
    queryKey: ['user-stats', userId, statsPeriod],
    queryFn: async () => (await api.get(`/user-profile/${userId}/stats?period=${statsPeriod}`)).data,
    enabled: !!userId,
  })

  const { data: attendance } = useQuery({
    queryKey: ['user-attendance', userId],
    queryFn: async () => (await api.get(`/user-profile/${userId}/attendance`)).data,
    enabled: !!userId && activeTab === 'attendance',
  })

  const { data: activities } = useQuery({
    queryKey: ['user-activity', userId],
    queryFn: async () => (await api.get(`/user-profile/${userId}/activity`)).data,
    enabled: !!userId,
    staleTime: 0, // Always refetch when tab is activated
  })

  const { data: fundRequests } = useQuery({
    queryKey: ['user-fund-requests', userId],
    queryFn: async () => (await api.get(`/user-profile/${userId}/fund-requests`)).data,
    enabled: !!userId && activeTab === 'fund-requests',
  })

  if (profileLoading) {
    return (
      <Flex justify="center" align="center" h="256px">
        <Spinner color="brand.500" />
      </Flex>
    )
  }

  if (!profile) {
    return (
      <Flex justify="center" align="center" h="256px" color="secondaryGray.600">
        User not found
      </Flex>
    )
  }

  const attendanceRate = stats?.attendance?.total_days ? Math.round((stats.attendance.present / stats.attendance.total_days) * 100) : 0

  return (
    <>
      {/* Profile Header */}
      <Card mb="20px">
        <Flex align="start" gap="24px" direction={{ base: 'column', md: 'row' }}>
          <Avatar size="xl" name={`${profile.first_name} ${profile.last_name}`} bg="brand.500" color="white" />
          <Box flex="1">
            <Flex align="center" gap="12px" wrap="wrap">
              <Heading size="lg" data-tour="page-title">
                {profile.first_name} {profile.last_name}
              </Heading>
              <Badge colorScheme={profile.is_active ? 'brand' : 'gray'}>{profile.is_active ? 'Active' : 'Inactive'}</Badge>
              {profile.is_superuser && <Badge colorScheme="red">Superuser</Badge>}
            </Flex>
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing="16px" mt="8px" fontSize="sm" color="secondaryGray.600">
              <Flex align="center" gap="8px">
                <Icon as={MdEmail} />
                {profile.email}
              </Flex>
              {profile.phone && (
                <Flex align="center" gap="8px">
                  <Icon as={MdPhone} />
                  {profile.phone}
                </Flex>
              )}
              <Flex align="center" gap="8px">
                <Icon as={MdShield} />
                {profile.role_name || 'No Role'}
              </Flex>
              <Flex align="center" gap="8px">
                <Icon as={MdBusiness} />
                {profile.branch_name || 'No Branch'}
              </Flex>
            </SimpleGrid>
            <Text fontSize="xs" color="secondaryGray.600" mt="12px">
              Joined: {profile.created_at ? formatDate(profile.created_at) : 'N/A'}
              {profile.last_login && <span style={{ marginLeft: 16 }}>Last login: {formatDateTime(profile.last_login)}</span>}
            </Text>
          </Box>
        </Flex>
      </Card>

      {/* Stats Cards */}
      <Flex justify="space-between" align="center" mb="16px">
        <Heading size="md">Performance Overview</Heading>
        <Select variant="main" w="144px" value={statsPeriod} onChange={(e) => setStatsPeriod(e.target.value)}>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </Select>
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing="16px" mb="20px">
        <StatCard name="Visits Recorded" value={stats?.visits_recorded || 0} />
        <StatCard name="Sales" value={stats?.sales?.count || 0} helpText={formatCurrency(stats?.sales?.amount || 0)} />
        <StatCard name="Consultations" value={stats?.consultations || 0} />
        <StatCard name="Prescriptions" value={stats?.prescriptions || 0} />
        <StatCard name="Memos" value={stats?.fund_requests?.count || 0} helpText={formatCurrency(stats?.fund_requests?.amount || 0)} />
        <StatCard
          name="Attendance"
          value={stats?.attendance?.present || 0}
          valueColor="green.500"
          helpText={`${stats?.attendance?.late || 0} late, ${stats?.attendance?.absent || 0} absent`}
        />
      </SimpleGrid>

      <Tabs variant="soft-rounded" index={TABS.indexOf(activeTab)} onChange={(i) => setActiveTab(TABS[i])}>
        <TabList gap="8px" mb="16px" flexWrap="wrap">
          <Tab>Overview</Tab>
          <Tab>Attendance</Tab>
          <Tab>Activity Log</Tab>
          <Tab>Memos</Tab>
        </TabList>
        <TabPanels>
          <TabPanel p="0">
            <SectionCard title="Quick Summary" description="Overview of user's recent activity and performance">
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing="24px">
                <Box>
                  <Text fontWeight="500" mb="8px">
                    Attendance Rate
                  </Text>
                  <Flex align="center" gap="8px">
                    <Progress flex="1" value={attendanceRate} colorScheme="green" size="sm" borderRadius="full" />
                    <Text fontSize="sm" fontWeight="500">
                      {attendanceRate}%
                    </Text>
                  </Flex>
                </Box>
                <Box>
                  <Text fontWeight="500" mb="8px">
                    Role & Access
                  </Text>
                  <Text fontSize="sm" color="secondaryGray.600">
                    {profile.role_name || 'No role assigned'} at {profile.branch_name || 'No branch'}
                  </Text>
                </Box>
              </SimpleGrid>
            </SectionCard>
          </TabPanel>

          <TabPanel p="0">
            <SectionCard
              title="Attendance History"
              description={
                attendance?.period?.start_date &&
                attendance?.period?.end_date && `${formatDate(attendance.period.start_date)} - ${formatDate(attendance.period.end_date)}`
              }
            >
              {attendance?.summary && (
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing="16px" mb="24px">
                  <SummaryTile value={attendance.summary.total_days} label="Total Days" bg="secondaryGray.300" />
                  <SummaryTile value={attendance.summary.present} label="Present" color="green.600" bg="green.50" />
                  <SummaryTile value={attendance.summary.late} label="Late" color="yellow.600" bg="yellow.50" />
                  <SummaryTile value={attendance.summary.absent} label="Absent" color="red.600" bg="red.50" />
                </SimpleGrid>
              )}
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Date</Th>
                      <Th>Status</Th>
                      <Th>Clock In</Th>
                      <Th>Clock Out</Th>
                      <Th>Notes</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {attendance?.records?.length === 0 ? (
                      <TableMessageRow colSpan={5}>No attendance records found</TableMessageRow>
                    ) : (
                      attendance?.records?.map((record: any) => (
                        <Tr key={record.id}>
                          <Td>{formatDate(record.date)}</Td>
                          <Td>
                            <Badge colorScheme={attendanceScheme[record.status] || 'gray'}>{String(record.status ?? '').replace(/_/g, ' ')}</Badge>
                          </Td>
                          <Td>{record.clock_in ? formatDateTime(record.clock_in) : '-'}</Td>
                          <Td>{record.clock_out ? formatDateTime(record.clock_out) : '-'}</Td>
                          <Td color="secondaryGray.600">{record.notes || '-'}</Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </SectionCard>
          </TabPanel>

          <TabPanel p="0">
            <SectionCard title="Activity Log" description="Recent actions performed by this user">
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Action</Th>
                      <Th>Module</Th>
                      <Th>Description</Th>
                      <Th>Time</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {activities?.length === 0 ? (
                      <TableMessageRow colSpan={4}>No activity logs found</TableMessageRow>
                    ) : (
                      activities?.map((activity: any) => (
                        <Tr key={activity.id}>
                          <Td fontWeight="500">{activity.action}</Td>
                          <Td>
                            <Badge variant="outline">{activity.module || 'General'}</Badge>
                          </Td>
                          <Td color="secondaryGray.600" maxW="320px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                            {activity.description || '-'}
                          </Td>
                          <Td color="secondaryGray.600">{formatDateTime(activity.created_at)}</Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </SectionCard>
          </TabPanel>

          <TabPanel p="0">
            <SectionCard title="Memos" description="History of memos made by this user">
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Title</Th>
                      <Th>Amount</Th>
                      <Th>Purpose</Th>
                      <Th>Status</Th>
                      <Th>Date</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {fundRequests?.length === 0 ? (
                      <TableMessageRow colSpan={5}>No memos found</TableMessageRow>
                    ) : (
                      fundRequests?.map((request: any) => (
                        <Tr key={request.id}>
                          <Td fontWeight="500">{request.title}</Td>
                          <Td>{formatCurrency(request.amount)}</Td>
                          <Td textTransform="capitalize">{request.purpose || 'Other'}</Td>
                          <Td>
                            <Badge colorScheme={memoScheme[request.status] || 'blue'}>{String(request.status ?? '').replace(/_/g, ' ')}</Badge>
                          </Td>
                          <Td color="secondaryGray.600">{formatDate(request.created_at)}</Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </SectionCard>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </>
  )
}
