import { useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Divider,
  Flex,
  Grid,
  Heading,
  Icon,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  Table,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react'
import {
  MdBarChart,
  MdBusiness,
  MdChecklist,
  MdChevronLeft,
  MdChevronRight,
  MdEmail,
  MdEvent,
  MdPhone,
  MdShield,
  MdTimeline,
  MdVpnKey,
} from 'react-icons/md'
import api from '@/lib/api'
import { EntityHeader } from '@/components/Person'
import { useToast } from '@/hooks/use-toast'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { TabbedSections } from '@/components/card/TabCard'
import { AppModal, EmptyState, Field, TableMessageRow } from '@/components/ui'
import { PriorityBadge, PRIORITY_OPTIONS, TaskStatusBadge, TASK_STATUS_OPTIONS } from './taskBadges'

interface Task {
  id: number
  title: string
  description?: string
  status: string
  priority: string
  due_date?: string
  created_at?: string
}

interface ActivityLog {
  id: number
  action: string
  module?: string
  description?: string
  page_path?: string
  created_at: string
}

interface Attendance {
  id: number
  date: string
  clock_in?: string
  clock_out?: string
  status: string
  notes?: string
}

const TABS = ['overview', 'attendance', 'activity', 'tasks', 'branch-history']
const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All Time' },
] as const
type Period = (typeof PERIODS)[number]['value']

const attendanceColor: Record<string, string> = { present: 'green.500', absent: 'red.500', late: 'yellow.500', half_day: 'orange.500', on_leave: 'blue.500' }
const emptyTask = { title: '', description: '', priority: 'medium', due_date: '' }
const isoDate = (d: Date) => d.toISOString().split('T')[0]

const getStatsDates = (period: Period) => {
  const today = new Date()
  const start = new Date(today)
  if (period === 'week') start.setDate(today.getDate() - 7)
  else if (period === 'month') start.setDate(today.getDate() - 30)
  else if (period === 'all') start.setFullYear(today.getFullYear() - 1)
  return { startDate: isoDate(start), endDate: isoDate(today) }
}

const timeOrDash = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString() : '-')

export default function EmployeeDetailPage() {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const mutedBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.50')
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview')
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [statsPeriod, setStatsPeriod] = useState<Period>('month')
  const [taskForm, setTaskForm] = useState(emptyTask)

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: async () => (await api.get(`/employees/${employeeId}`)).data,
  })

  const { data: stats } = useQuery({
    queryKey: ['employee-stats', employeeId, statsPeriod],
    queryFn: async () => {
      const { startDate, endDate } = getStatsDates(statsPeriod)
      return (await api.get(`/employees/${employeeId}/stats?start_date=${startDate}&end_date=${endDate}`)).data
    },
    enabled: !!employeeId,
  })

  const { data: attendance = [] } = useQuery<Attendance[]>({
    queryKey: ['employee-attendance', employeeId],
    queryFn: async () => (await api.get(`/employees/${employeeId}/attendance`)).data,
    enabled: !!employeeId,
  })

  const { data: activityData } = useQuery({
    queryKey: ['employee-activity', employeeId],
    queryFn: async () => (await api.get(`/employees/${employeeId}/activity?limit=100`)).data,
    enabled: !!employeeId,
    staleTime: 0, // Always refetch to get latest activities
  })
  const activity: ActivityLog[] = activityData?.items || activityData || []

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['employee-tasks', employeeId],
    queryFn: async () => (await api.get(`/employees/tasks?assigned_to_id=${employeeId}`)).data,
    enabled: !!employeeId,
  })

  const { data: branchHistory = [] } = useQuery({
    queryKey: ['employee-branch-history', employeeId],
    queryFn: async () => (await api.get(`/branch-assignments/users/${employeeId}/branch-history`)).data,
    enabled: !!employeeId,
  })

  const resetPasswordMutation = useMutation({
    mutationFn: () => api.post(`/employees/${employeeId}/reset-password`),
    onSuccess: (response) => {
      toast({ title: 'Password reset', description: response.data.message })
    },
    onError: () => {
      toast({ title: 'Failed to reset password', variant: 'destructive' })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: () => api.delete(`/employees/${employeeId}`),
    onSuccess: () => {
      toast({ title: 'Employee deactivated' })
      navigate('/admin/employees')
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => api.post('/employees/tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-tasks', employeeId] })
      setIsAddTaskOpen(false)
      setTaskForm(emptyTask)
      toast({ title: 'Task assigned' })
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/employees/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-tasks', employeeId] })
    },
  })

  // 6-week grid starting on the Sunday before the 1st of the month
  const calendarDays = useMemo(() => {
    const start = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1)
    start.setDate(start.getDate() - start.getDay())
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [calendarDate])

  const getAttendanceForDate = (date: Date) =>
    attendance.find((record) => {
      const d = new Date(record.date)
      return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear()
    })

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="256px">
        <Spinner color="brand.500" />
      </Flex>
    )
  }

  if (!employee) {
    return (
      <Flex justify="center" align="center" h="256px">
        Employee not found
      </Flex>
    )
  }

  const pendingTasks = tasks.filter((t) => t.status !== 'completed')
  const shiftMonth = (delta: number) => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + delta, 1))

  return (
    <>
      <EntityHeader
        name={`${employee.first_name} ${employee.last_name}`}
        subtitle={`${employee.role?.name || 'No role'} · ${employee.branch?.name || 'No branch'}`}
        avatarSrc={employee.avatar_url}
        badges={<Badge colorScheme={employee.is_active === false ? 'red' : 'green'}>{employee.is_active === false ? 'Inactive' : 'Active'}</Badge>}
        onBack={() => navigate('/admin/employees')}
        actions={
          <>
            <Button variant="light" leftIcon={<MdVpnKey />} onClick={() => resetPasswordMutation.mutate()} isLoading={resetPasswordMutation.isPending}>
              Reset Password
            </Button>
            <Button colorScheme="red" variant="outline" onClick={() => deactivateMutation.mutate()} isLoading={deactivateMutation.isPending}>
              Deactivate
            </Button>
          </>
        }
        facts={[
          { icon: MdEmail, label: 'Email', value: employee.email },
          { icon: MdPhone, label: 'Phone', value: employee.phone || '-' },
          { icon: MdShield, label: 'Role', value: employee.role?.name || '-' },
          { icon: MdBusiness, label: 'Branch', value: employee.branch?.name || '-' },
        ]}
      />

      {/* Stats Cards */}
      <Flex justify="space-between" align="center" mb="16px" wrap="wrap" gap="12px">
        <Heading size="md">Performance Stats</Heading>
        <ButtonGroup size="xs" isAttached variant="light">
          {PERIODS.map((p) => (
            <Button key={p.value} variant={statsPeriod === p.value ? 'brand' : 'light'} onClick={() => setStatsPeriod(p.value)}>
              {p.label}
            </Button>
          ))}
        </ButtonGroup>
      </Flex>
      {stats && (
        <SimpleGrid columns={{ base: 2, md: 5 }} spacing="16px" mb="20px">
          <StatCard name="Sales Made" value={stats.sales?.count || 0} helpText={`GH₵ ${(stats.sales?.amount || 0).toLocaleString()}`} />
          <StatCard name="Consultations" value={stats.consultations || 0} />
          <StatCard name="Visits Added" value={stats.visits_added || 0} />
          <StatCard name="Prescriptions" value={stats.prescriptions || 0} />
          <StatCard
            name="Days Present"
            value={stats.attendance?.present_days || 0}
            valueColor="green.500"
            helpText={`Late: ${stats.attendance?.late_days || 0} | Absent: ${stats.attendance?.absent_days || 0}`}
          />
        </SimpleGrid>
      )}

      {/* Tabs */}
      <Tabs variant="soft-rounded" index={Math.max(0, TABS.indexOf(activeTab))} onChange={(i) => setActiveTab(TABS[i])}>
        <TabList gap="8px" mb="16px" flexWrap="wrap">
          <Tab>
            <Icon as={MdBarChart} me="8px" />
            Overview
          </Tab>
          <Tab>
            <Icon as={MdEvent} me="8px" />
            Attendance
          </Tab>
          <Tab>
            <Icon as={MdTimeline} me="8px" />
            Activity
          </Tab>
          <Tab>
            <Icon as={MdChecklist} me="8px" />
            Tasks
          </Tab>
          <Tab>
            <Icon as={MdBusiness} me="8px" />
            Branch History
          </Tab>
        </TabList>

        <TabPanels>
          {/* Overview */}
          <TabPanel p="0">
            <Stack spacing="20px">
              <TabbedSections>
                <SectionCard title="Recent Activity">
                  {activity.length === 0 ? (
                    <Text color="secondaryGray.600" fontSize="sm">
                      No recent activity
                    </Text>
                  ) : (
                    <Stack spacing="12px" maxH="256px" overflowY="auto" divider={<Divider />}>
                      {activity.slice(0, 10).map((log) => (
                        <Flex key={log.id} justify="space-between" align="start">
                          <Box>
                            <Text fontSize="sm" fontWeight="500">
                              {log.action}
                            </Text>
                            <Text fontSize="xs" color="secondaryGray.600">
                              {log.module || 'system'}
                            </Text>
                          </Box>
                          <Text fontSize="xs" color="secondaryGray.600">
                            {new Date(log.created_at).toLocaleString()}
                          </Text>
                        </Flex>
                      ))}
                    </Stack>
                  )}
                </SectionCard>

                <SectionCard title="Recent Attendance">
                  {attendance.length === 0 ? (
                    <Text color="secondaryGray.600" fontSize="sm">
                      No attendance records
                    </Text>
                  ) : (
                    <Stack spacing="8px" maxH="256px" overflowY="auto" divider={<Divider />}>
                      {attendance.slice(0, 10).map((record) => (
                        <Flex key={record.id} align="center" justify="space-between">
                          <Flex align="center" gap="8px">
                            <Box h="8px" w="8px" borderRadius="full" bg={attendanceColor[record.status] || 'gray.500'} />
                            <Text fontSize="sm">{new Date(record.date).toLocaleDateString()}</Text>
                          </Flex>
                          <Text fontSize="xs" color="secondaryGray.600">
                            {timeOrDash(record.clock_in)} → {timeOrDash(record.clock_out)}
                          </Text>
                        </Flex>
                      ))}
                    </Stack>
                  )}
                </SectionCard>
              </TabbedSections>

              <SectionCard
                title="Assigned Tasks"
                actions={
                  <Button size="sm" variant="brand" onClick={() => setIsAddTaskOpen(true)}>
                    Assign Task
                  </Button>
                }
              >
                {pendingTasks.length === 0 ? (
                  <Text color="secondaryGray.600" fontSize="sm">
                    No pending tasks
                  </Text>
                ) : (
                  <Stack spacing="8px" divider={<Divider />}>
                    {pendingTasks.slice(0, 5).map((task) => (
                      <Flex key={task.id} align="center" justify="space-between">
                        <Box>
                          <Text fontWeight="500">{task.title}</Text>
                          {task.due_date && (
                            <Text fontSize="xs" color="secondaryGray.600">
                              Due: {new Date(task.due_date).toLocaleDateString()}
                            </Text>
                          )}
                        </Box>
                        <Flex gap="8px">
                          <PriorityBadge priority={task.priority} />
                          <TaskStatusBadge status={task.status} />
                        </Flex>
                      </Flex>
                    ))}
                  </Stack>
                )}
              </SectionCard>
            </Stack>
          </TabPanel>

          {/* Attendance */}
          <TabPanel p="0">
            <Stack spacing="20px">
              <SectionCard
                title="Attendance Calendar"
                actions={
                  <Flex align="center" gap="8px">
                    <IconButton aria-label="Previous month" variant="light" size="sm" icon={<MdChevronLeft />} onClick={() => shiftMonth(-1)} />
                    <Text fontWeight="500" minW="128px" textAlign="center">
                      {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </Text>
                    <IconButton aria-label="Next month" variant="light" size="sm" icon={<MdChevronRight />} onClick={() => shiftMonth(1)} />
                    <Button variant="light" size="sm" onClick={() => setCalendarDate(new Date())}>
                      Today
                    </Button>
                  </Flex>
                }
              >
                <Grid templateColumns="repeat(7, 1fr)" borderBottom="1px solid" borderColor={borderColor} mb="8px">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Text key={day} p="8px" textAlign="center" fontSize="sm" fontWeight="500" color="secondaryGray.600">
                      {day}
                    </Text>
                  ))}
                </Grid>
                <Grid templateColumns="repeat(7, 1fr)">
                  {calendarDays.map((day, index) => {
                    const record = getAttendanceForDate(day)
                    const isCurrentMonth = day.getMonth() === calendarDate.getMonth()
                    const isToday = day.toDateString() === new Date().toDateString()
                    const isPastWorkday = day < new Date() && day.getDay() !== 0 && day.getDay() !== 6
                    const showAbsent = isPastWorkday && !record && isCurrentMonth && !isToday
                    return (
                      <Box key={index} minH="64px" borderBottom="1px solid" borderRight="1px solid" borderColor={borderColor} p="8px" bg={isCurrentMonth ? undefined : mutedBg}>
                        <Flex
                          fontSize="sm"
                          mb="4px"
                          w="24px"
                          h="24px"
                          align="center"
                          justify="center"
                          borderRadius="full"
                          bg={isToday ? 'brand.500' : undefined}
                          color={isToday ? 'white' : undefined}
                        >
                          {day.getDate()}
                        </Flex>
                        {record && (
                          <Text fontSize="xs" px="6px" py="2px" borderRadius="4px" color="white" bg={attendanceColor[record.status] || 'gray.500'}>
                            {String(record.status ?? '').replace(/_/g, ' ')}
                          </Text>
                        )}
                        {showAbsent && (
                          <Text fontSize="xs" px="6px" py="2px" borderRadius="4px" color="white" bg="red.500">
                            absent
                          </Text>
                        )}
                      </Box>
                    )
                  })}
                </Grid>
                <Flex gap="16px" mt="16px" fontSize="sm" wrap="wrap">
                  {[
                    ['green.500', 'Present'],
                    ['yellow.500', 'Late'],
                    ['red.500', 'Absent'],
                    ['blue.500', 'On Leave'],
                  ].map(([color, label]) => (
                    <Flex key={label} align="center" gap="8px">
                      <Box h="12px" w="12px" borderRadius="3px" bg={color} />
                      <Text>{label}</Text>
                    </Flex>
                  ))}
                </Flex>
              </SectionCard>

              <SectionCard title="Attendance History">
                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Date</Th>
                        <Th>Clock In</Th>
                        <Th>Clock Out</Th>
                        <Th>Status</Th>
                        <Th>Notes</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {attendance.length === 0 ? (
                        <TableMessageRow colSpan={5}>No attendance records</TableMessageRow>
                      ) : (
                        attendance.map((record) => (
                          <Tr key={record.id}>
                            <Td>{new Date(record.date).toLocaleDateString()}</Td>
                            <Td>{timeOrDash(record.clock_in)}</Td>
                            <Td>{timeOrDash(record.clock_out)}</Td>
                            <Td>
                              <Badge colorScheme={record.status === 'present' ? 'green' : 'gray'} variant={record.status === 'present' ? 'solid' : 'subtle'}>
                                {String(record.status ?? '').replace(/_/g, ' ')}
                              </Badge>
                            </Td>
                            <Td color="secondaryGray.600">{record.notes || '-'}</Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </SectionCard>
            </Stack>
          </TabPanel>

          {/* Activity */}
          <TabPanel p="0">
            <SectionCard title="Activity Log">
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Action</Th>
                      <Th>Module</Th>
                      <Th>Page</Th>
                      <Th>Time</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {activity.length === 0 ? (
                      <TableMessageRow colSpan={4}>No activity recorded</TableMessageRow>
                    ) : (
                      activity.map((log) => (
                        <Tr key={log.id}>
                          <Td fontWeight="500">{log.action}</Td>
                          <Td>{log.module || '-'}</Td>
                          <Td color="secondaryGray.600">{log.page_path || '-'}</Td>
                          <Td>{new Date(log.created_at).toLocaleString()}</Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </SectionCard>
          </TabPanel>

          {/* Tasks */}
          <TabPanel p="0">
            <Card>
              <Flex justify="end" mb="16px">
                <Button variant="brand" leftIcon={<MdChecklist />} onClick={() => setIsAddTaskOpen(true)}>
                  Assign New Task
                </Button>
              </Flex>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Task</Th>
                      <Th>Priority</Th>
                      <Th>Due Date</Th>
                      <Th>Status</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {tasks.length === 0 ? (
                      <TableMessageRow colSpan={5}>No tasks assigned</TableMessageRow>
                    ) : (
                      tasks.map((task) => (
                        <Tr key={task.id}>
                          <Td>
                            <Text fontWeight="500">{task.title}</Text>
                            {task.description && (
                              <Text fontSize="sm" color="secondaryGray.600" noOfLines={1} maxW="320px">
                                {task.description}
                              </Text>
                            )}
                          </Td>
                          <Td>
                            <PriorityBadge priority={task.priority} />
                          </Td>
                          <Td>{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</Td>
                          <Td>
                            <TaskStatusBadge status={task.status} />
                          </Td>
                          <Td>
                            <Select variant="main" size="sm" w="144px" value={task.status} onChange={(e) => updateTaskMutation.mutate({ id: task.id, data: { status: e.target.value } })}>
                              {TASK_STATUS_OPTIONS}
                            </Select>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>

          {/* Branch History */}
          <TabPanel p="0">
            <SectionCard
              title={
                <Flex align="center" gap="8px">
                  <Icon as={MdBusiness} />
                  Branch Assignment History
                </Flex>
              }
            >
              {branchHistory.length === 0 ? (
                <EmptyState>No branch assignment history available</EmptyState>
              ) : (
                <Box position="relative">
                  {/* Timeline line */}
                  <Box position="absolute" left="16px" top="0" bottom="0" w="2px" bg={borderColor} />
                  <Stack spacing="24px">
                    {branchHistory.map((assignment: any) => (
                      <Box key={assignment.id} position="relative" ps="40px">
                        <Box
                          position="absolute"
                          left="11px"
                          top="18px"
                          w="12px"
                          h="12px"
                          borderRadius="full"
                          border="2px solid"
                          borderColor={assignment.is_current ? 'brand.500' : 'secondaryGray.500'}
                          bg={assignment.is_current ? 'brand.500' : 'white'}
                        />
                        <Box p="16px" borderRadius="12px" border="1px solid" borderColor={assignment.is_current ? 'brand.200' : borderColor} bg={assignment.is_current ? 'brand.50' : mutedBg}>
                          <Flex justify="space-between" align="start" mb="8px" gap="12px">
                            <Flex align="center" gap="8px">
                              <Icon as={MdBusiness} color="brand.500" />
                              <Text fontWeight="600">{assignment.branch_name}</Text>
                              {assignment.is_current && (
                                <Badge colorScheme="brand" fontSize="xs">
                                  Current
                                </Badge>
                              )}
                            </Flex>
                            {assignment.effective_from && (
                              <Text fontSize="sm" color="secondaryGray.600" textAlign="right">
                                {new Date(assignment.effective_from).toLocaleDateString()}
                                {assignment.effective_until && <> - {new Date(assignment.effective_until).toLocaleDateString()}</>}
                              </Text>
                            )}
                          </Flex>
                          <Stack spacing="4px" fontSize="sm" color="secondaryGray.600">
                            <Text>
                              <strong>Assigned by:</strong> {assignment.assigned_by_name}
                            </Text>
                            <Text>
                              <strong>Assigned on:</strong> {assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleString() : 'N/A'}
                            </Text>
                            {assignment.notes && (
                              <Text>
                                <strong>Notes:</strong> {assignment.notes}
                              </Text>
                            )}
                          </Stack>
                          <Divider my="12px" />
                          {assignment.verified ? (
                            <Flex align="center" gap="8px" fontSize="sm" color="green.500">
                              <Badge colorScheme="green" fontSize="xs">
                                Verified
                              </Badge>
                              <Text>on {assignment.verified_at ? new Date(assignment.verified_at).toLocaleString() : 'N/A'}</Text>
                            </Flex>
                          ) : assignment.verification_note?.startsWith('ISSUE REPORTED:') ? (
                            <Box fontSize="sm">
                              <Badge colorScheme="red" fontSize="xs">
                                Issue Reported
                              </Badge>
                              <Text mt="4px" color="red.500">
                                {assignment.verification_note.replace('ISSUE REPORTED: ', '')}
                              </Text>
                            </Box>
                          ) : assignment.is_current ? (
                            <Badge colorScheme="yellow" fontSize="xs">
                              Pending Verification
                            </Badge>
                          ) : (
                            <Badge fontSize="xs">Not Verified</Badge>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}
            </SectionCard>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Add Task Dialog */}
      <AppModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        title={`Assign Task to ${employee.first_name}`}
        footer={
          <>
            <Button variant="light" onClick={() => setIsAddTaskOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              isDisabled={!taskForm.title}
              isLoading={createTaskMutation.isPending}
              onClick={() =>
                createTaskMutation.mutate({
                  title: taskForm.title,
                  description: taskForm.description || null,
                  assigned_to_id: parseInt(employeeId!),
                  priority: taskForm.priority,
                  due_date: taskForm.due_date || null,
                })
              }
            >
              Assign Task
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Title" isRequired>
            <Input variant="main" placeholder="Task title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea variant="main" placeholder="Task description..." value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
          </Field>
          <SimpleGrid columns={2} spacing="16px">
            <Field label="Priority">
              <Select variant="main" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                {PRIORITY_OPTIONS}
              </Select>
            </Field>
            <Field label="Due Date">
              <Input variant="main" type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} />
            </Field>
          </SimpleGrid>
        </Stack>
      </AppModal>
    </>
  )
}
