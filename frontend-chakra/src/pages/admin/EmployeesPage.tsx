import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Icon,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Switch,
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
import { MdAccessTime, MdBusiness, MdDelete, MdPersonAdd, MdPersonOff, MdChecklist, MdHowToReg, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import api from '@/lib/api'
import { PersonCell } from '@/components/Person'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { AppModal, ConfirmDialog, Field, SearchInput, TableMessageRow } from '@/components/ui'
import { PriorityBadge, PRIORITY_OPTIONS, TaskStatusBadge, TASK_STATUS_OPTIONS } from './taskBadges'

interface Employee {
  id: number
  email: string
  first_name: string
  last_name: string
  phone?: string
  is_active: boolean
  role_id?: number
  branch_id?: number
  role?: { id: number; name: string }
  branch?: { id: number; name: string }
  created_at?: string
}

interface Task {
  id: number
  title: string
  description?: string
  assigned_to_id: number
  assigned_by_id: number
  status: string
  priority: string
  due_date?: string
  created_at?: string
}

interface Attendance {
  id: number
  user_id: number
  date: string
  clock_in?: string
  clock_out?: string
  status: string
}

const TABS = ['employees', 'attendance', 'tasks']
const today = () => new Date().toISOString().split('T')[0]

const emptyEmployee = { email: '', first_name: '', last_name: '', phone: '', role_id: '', branch_id: '' }
const emptyTask = { title: '', description: '', assigned_to_id: '', priority: 'medium', due_date: '' }
const emptyBranchAssign = () => ({ branch_id: '', effective_from: today(), notes: '' })

const optionList = (items: any[], label: (i: any) => string = (i) => i.name) =>
  items.map((i: any) => (
    <option key={i.id} value={i.id.toString()}>
      {label(i)}
    </option>
  ))

export default function EmployeesPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('employees')
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false)
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null)
  const [branchAssignEmployee, setBranchAssignEmployee] = useState<Employee | null>(null)
  const [branchAssignForm, setBranchAssignForm] = useState(emptyBranchAssign)
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee)
  const [taskForm, setTaskForm] = useState(emptyTask)

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => (await api.get('/employees')).data,
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get('/employees/roles/list')).data,
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches')).data,
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => (await api.get('/employees/tasks')).data,
  })

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: async () => (await api.get('/employees/attendance/today')).data,
  })

  const createEmployeeMutation = useMutation({
    mutationFn: (data: any) => api.post('/employees', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setIsAddEmployeeOpen(false)
      setEmployeeForm(emptyEmployee)
      toast({ title: 'Employee created', description: `Password: ${response.data.first_name.toLowerCase()}123` })
    },
    onError: () => {
      toast({ title: 'Failed to create employee', variant: 'destructive' })
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => api.post('/employees/tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setIsAddTaskOpen(false)
      setTaskForm(emptyTask)
      toast({ title: 'Task assigned successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to assign task', variant: 'destructive' })
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/employees/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast({ title: 'Task updated' })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => api.put(`/employees/${id}`, { is_active }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast({ title: variables.is_active ? 'Employee activated' : 'Employee deactivated' })
    },
    onError: () => {
      toast({ title: 'Failed to update employee status', variant: 'destructive' })
    },
  })

  const deleteEmployeeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/employees/${id}`),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setDeleteConfirm(null)
      if (response.data.deleted) {
        toast({ title: 'Employee deleted permanently' })
      } else {
        toast({ title: 'Employee deactivated', description: `Has ${response.data.record_count} related records - cannot be permanently deleted` })
      }
    },
    onError: () => {
      toast({ title: 'Failed to delete employee', variant: 'destructive' })
    },
  })

  const assignBranchMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: any }) => api.post(`/branch-assignments/users/${userId}/assign-branch`, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setBranchAssignEmployee(null)
      setBranchAssignForm(emptyBranchAssign())
      toast({ title: 'Branch assigned successfully', description: response.data.message })
    },
    onError: () => {
      toast({ title: 'Failed to assign branch', variant: 'destructive' })
    },
  })

  const filteredEmployees = employees.filter(
    (emp: Employee) => `${emp.first_name} ${emp.last_name} ${emp.email}`.toLowerCase().includes(searchQuery.toLowerCase()) && (showInactive || emp.is_active),
  )
  const absentEmployees = employees.filter((emp: Employee) => emp.is_active && !todayAttendance.some((a: Attendance) => a.user_id === emp.id))
  const rowLink = (onClick: () => void) => ({ cursor: 'pointer', _hover: { bg: hoverBg }, onClick })
  const ef = (key: keyof typeof emptyEmployee) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEmployeeForm({ ...employeeForm, [key]: e.target.value })
  const tf = (key: keyof typeof emptyTask) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setTaskForm({ ...taskForm, [key]: e.target.value })

  return (
    <>
      <PageHeader
        title="Employees"
        description="Manage staff, attendance, and tasks"
        actions={
          <>
            <Button variant="light" leftIcon={<MdChecklist />} onClick={() => setIsAddTaskOpen(true)}>
              Assign Task
            </Button>
            <Button variant="brand" leftIcon={<MdPersonAdd />} onClick={() => setIsAddEmployeeOpen(true)} data-tour="add-employee">
              Add Employee
            </Button>
          </>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px" mb="20px" data-tour="employee-stats">
        <StatCard name="Total Employees" value={employees.length} />
        <StatCard
          name="Clocked In Today"
          value={todayAttendance.filter((a: Attendance) => a.clock_in && !a.clock_out).length}
          icon={MdAccessTime}
          iconColor="secondaryGray.600"
          valueColor="green.500"
        />
        <StatCard name="Pending Tasks" value={tasks.filter((t: Task) => t.status === 'pending').length} icon={MdChecklist} iconColor="secondaryGray.600" valueColor="orange.500" />
        <StatCard name="Active Employees" value={employees.filter((e: Employee) => e.is_active).length} />
      </SimpleGrid>

      <Tabs variant="soft-rounded" index={TABS.indexOf(activeTab)} onChange={(i) => setActiveTab(TABS[i])}>
        <TabList gap="8px" mb="16px">
          <Tab>Employees</Tab>
          <Tab>Attendance</Tab>
          <Tab>Tasks</Tab>
        </TabList>

        <TabPanels>
          <TabPanel p="0">
            <Card data-tour="employee-list">
              <Flex justify="space-between" align="center" gap="16px" mb="16px" wrap="wrap">
                <SearchInput placeholder="Search employees..." value={searchQuery} onChange={setSearchQuery} />
                <FormControl display="flex" alignItems="center" w="auto">
                  <Switch id="show-inactive" colorScheme="brandScheme" isChecked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} me="8px" />
                  <FormLabel htmlFor="show-inactive" mb="0" display="flex" alignItems="center" gap="4px" cursor="pointer">
                    <Icon as={showInactive ? MdVisibility : MdVisibilityOff} />
                    {showInactive ? 'Showing inactive' : 'Hiding inactive'}
                  </FormLabel>
                </FormControl>
              </Flex>
              <Box overflowX="auto">
                <Table variant="lined">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Email</Th>
                      <Th>Role</Th>
                      <Th>Branch</Th>
                      <Th>Status</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {isLoading ? (
                      <TableMessageRow colSpan={6} loading />
                    ) : filteredEmployees.length === 0 ? (
                      <TableMessageRow colSpan={6}>No employees found</TableMessageRow>
                    ) : (
                      filteredEmployees.map((employee: Employee) => (
                        <Tr key={employee.id} {...rowLink(() => navigate(`/admin/employees/${employee.id}`))}>
                          <Td>
                            <PersonCell round name={`${employee.first_name} ${employee.last_name}`} />
                          </Td>
                          <Td color="secondaryGray.600">{employee.email}</Td>
                          <Td>{employee.role?.name || '-'}</Td>
                          <Td>{employee.branch?.name || '-'}</Td>
                          <Td>
                            <Badge colorScheme={employee.is_active ? 'brand' : 'gray'}>{employee.is_active ? 'Active' : 'Inactive'}</Badge>
                          </Td>
                          <Td onClick={(e) => e.stopPropagation()}>
                            <Flex gap="4px">
                              <IconButton
                                aria-label="View details"
                                title="View details"
                                variant="ghost"
                                size="sm"
                                icon={<MdVisibility />}
                                onClick={() => navigate(`/admin/employees/${employee.id}`)}
                              />
                              <IconButton
                                aria-label="Assign Branch"
                                title="Assign Branch"
                                variant="ghost"
                                size="sm"
                                icon={<MdBusiness />}
                                onClick={() => {
                                  setBranchAssignEmployee(employee)
                                  setBranchAssignForm({ branch_id: employee.branch_id?.toString() || '', effective_from: today(), notes: '' })
                                }}
                              />
                              <IconButton
                                aria-label={employee.is_active ? 'Deactivate' : 'Activate'}
                                title={employee.is_active ? 'Deactivate' : 'Activate'}
                                variant={employee.is_active ? 'ghost' : 'brand'}
                                size="sm"
                                icon={employee.is_active ? <MdPersonOff /> : <MdHowToReg />}
                                onClick={() => toggleActiveMutation.mutate({ id: employee.id, is_active: !employee.is_active })}
                              />
                              <IconButton aria-label="Delete" title="Delete" variant="ghost" color="red.500" size="sm" icon={<MdDelete />} onClick={() => setDeleteConfirm(employee)} />
                            </Flex>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>

          <TabPanel p="0">
            <SectionCard title="Today's Attendance">
              <Box overflowX="auto">
                <Table variant="lined">
                  <Thead>
                    <Tr>
                      <Th>Employee</Th>
                      <Th>Clock In</Th>
                      <Th>Clock Out</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {/* Employees who clocked in */}
                    {todayAttendance.map((record: any) => (
                      <Tr key={record.id} {...rowLink(() => navigate(`/admin/employees/${record.user_id}?tab=attendance`))}>
                        <Td>
                          <PersonCell round name={`${record.user?.first_name ?? ''} ${record.user?.last_name ?? ''}`} />
                        </Td>
                        <Td>{record.clock_in ? new Date(record.clock_in).toLocaleTimeString() : '-'}</Td>
                        <Td>{record.clock_out ? new Date(record.clock_out).toLocaleTimeString() : '-'}</Td>
                        <Td>
                          <Badge colorScheme={record.status === 'present' ? 'brand' : 'gray'}>{String(record.status ?? '').replace(/_/g, ' ')}</Badge>
                        </Td>
                      </Tr>
                    ))}
                    {/* Active employees who haven't clocked in */}
                    {absentEmployees.map((emp: Employee) => (
                      <Tr key={`absent-${emp.id}`} {...rowLink(() => navigate(`/admin/employees/${emp.id}?tab=attendance`))}>
                        <Td>
                          <PersonCell round name={`${emp.first_name} ${emp.last_name}`} />
                        </Td>
                        <Td>-</Td>
                        <Td>-</Td>
                        <Td>
                          <Badge colorScheme="red">absent</Badge>
                        </Td>
                      </Tr>
                    ))}
                    {todayAttendance.length === 0 && absentEmployees.length === 0 && <TableMessageRow colSpan={4}>No employees found</TableMessageRow>}
                  </Tbody>
                </Table>
              </Box>
            </SectionCard>
          </TabPanel>

          <TabPanel p="0">
            <Card>
              <Box overflowX="auto">
                <Table variant="lined">
                  <Thead>
                    <Tr>
                      <Th>Task</Th>
                      <Th>Assigned To</Th>
                      <Th>Priority</Th>
                      <Th>Due Date</Th>
                      <Th>Status</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {tasks.length === 0 ? (
                      <TableMessageRow colSpan={6}>No tasks found</TableMessageRow>
                    ) : (
                      tasks.map((task: Task) => {
                        const assignee = employees.find((e: Employee) => e.id === task.assigned_to_id)
                        return (
                          <Tr key={task.id}>
                            <Td>
                              <Text fontWeight="500">{task.title}</Text>
                              {task.description && (
                                <Text fontSize="sm" color="secondaryGray.600" noOfLines={1} maxW="320px">
                                  {task.description}
                                </Text>
                              )}
                            </Td>
                            <Td>{assignee ? `${assignee.first_name} ${assignee.last_name}` : '-'}</Td>
                            <Td><PriorityBadge priority={task.priority} /></Td>
                            <Td color="secondaryGray.600">
                              {task.due_date ? new Date(task.due_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                            </Td>
                            <Td><TaskStatusBadge status={task.status} /></Td>
                            <Td>
                              <Select variant="main" size="sm" w="144px" value={task.status} onChange={(e) => updateTaskMutation.mutate({ id: task.id, data: { status: e.target.value } })}>
                                {TASK_STATUS_OPTIONS}
                              </Select>
                            </Td>
                          </Tr>
                        )
                      })
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Add Employee Dialog */}
      <AppModal
        isOpen={isAddEmployeeOpen}
        onClose={() => setIsAddEmployeeOpen(false)}
        title="Add New Employee"
        footer={
          <>
            <Button variant="light" onClick={() => setIsAddEmployeeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              isDisabled={!employeeForm.first_name || !employeeForm.last_name || !employeeForm.email || !employeeForm.role_id || !employeeForm.branch_id}
              isLoading={createEmployeeMutation.isPending}
              onClick={() =>
                createEmployeeMutation.mutate({
                  email: employeeForm.email,
                  first_name: employeeForm.first_name,
                  last_name: employeeForm.last_name,
                  phone: employeeForm.phone || null,
                  role_id: parseInt(employeeForm.role_id),
                  branch_id: parseInt(employeeForm.branch_id),
                })
              }
            >
              Create Employee
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <SimpleGrid columns={2} spacing="16px">
            <Field label="First Name" isRequired>
              <Input variant="main" placeholder="John" value={employeeForm.first_name} onChange={ef('first_name')} />
            </Field>
            <Field label="Last Name" isRequired>
              <Input variant="main" placeholder="Doe" value={employeeForm.last_name} onChange={ef('last_name')} />
            </Field>
          </SimpleGrid>
          <Field label="Email" isRequired>
            <Input variant="main" type="email" placeholder="john@example.com" value={employeeForm.email} onChange={ef('email')} />
          </Field>
          <Field label="Phone">
            <Input variant="main" placeholder="+233..." value={employeeForm.phone} onChange={ef('phone')} />
          </Field>
          <SimpleGrid columns={2} spacing="16px">
            <Field label="Role" isRequired>
              <Select variant="main" placeholder="Select role" value={employeeForm.role_id} onChange={ef('role_id')}>
                {optionList(roles)}
              </Select>
            </Field>
            <Field label="Branch" isRequired>
              <Select variant="main" placeholder="Select branch" value={employeeForm.branch_id} onChange={ef('branch_id')}>
                {optionList(branches)}
              </Select>
            </Field>
          </SimpleGrid>
          <Text fontSize="sm" color="secondaryGray.600">
            Password will be set to: {employeeForm.first_name.toLowerCase() || 'firstname'}123
          </Text>
        </Stack>
      </AppModal>

      {/* Add Task Dialog */}
      <AppModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        title="Assign Task"
        footer={
          <>
            <Button variant="light" onClick={() => setIsAddTaskOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              isDisabled={!taskForm.title || !taskForm.assigned_to_id}
              isLoading={createTaskMutation.isPending}
              onClick={() =>
                createTaskMutation.mutate({
                  title: taskForm.title,
                  description: taskForm.description || null,
                  assigned_to_id: parseInt(taskForm.assigned_to_id),
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
            <Input variant="main" placeholder="Task title" value={taskForm.title} onChange={tf('title')} />
          </Field>
          <Field label="Description">
            <Textarea variant="main" placeholder="Task description..." value={taskForm.description} onChange={tf('description')} />
          </Field>
          <Field label="Assign To" isRequired>
            <Select variant="main" placeholder="Select employee" value={taskForm.assigned_to_id} onChange={tf('assigned_to_id')}>
              {optionList(employees, (e) => `${e.first_name} ${e.last_name}`)}
            </Select>
          </Field>
          <SimpleGrid columns={2} spacing="16px">
            <Field label="Priority">
              <Select variant="main" value={taskForm.priority} onChange={tf('priority')}>
                {PRIORITY_OPTIONS}
              </Select>
            </Field>
            <Field label="Due Date">
              <Input variant="main" type="date" value={taskForm.due_date} onChange={tf('due_date')} />
            </Field>
          </SimpleGrid>
        </Stack>
      </AppModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteEmployeeMutation.mutate(deleteConfirm.id)}
        isLoading={deleteEmployeeMutation.isPending}
        title="Delete Employee"
      >
        <Text mb="12px">
          Are you sure you want to delete {deleteConfirm?.first_name} {deleteConfirm?.last_name}?
        </Text>
        <Text fontSize="sm">
          If this employee has any related records (attendance, sales, tasks, etc.), they will be <strong>deactivated</strong> instead of permanently deleted to
          preserve data integrity.
        </Text>
      </ConfirmDialog>

      {/* Branch Assignment Dialog */}
      <AppModal
        isOpen={!!branchAssignEmployee}
        onClose={() => setBranchAssignEmployee(null)}
        title={
          <Flex align="center" gap="8px">
            <Icon as={MdBusiness} />
            Assign Branch
          </Flex>
        }
        description={
          <>
            Assign {branchAssignEmployee?.first_name} {branchAssignEmployee?.last_name} to a new branch.
            {branchAssignEmployee?.branch && (
              <Text as="span" display="block" mt="4px">
                Current branch: <Badge variant="outline">{branchAssignEmployee.branch.name}</Badge>
              </Text>
            )}
          </>
        }
        footer={
          <>
            <Button variant="light" onClick={() => setBranchAssignEmployee(null)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              isDisabled={!branchAssignForm.branch_id || !branchAssignForm.effective_from}
              isLoading={assignBranchMutation.isPending}
              loadingText="Assigning..."
              onClick={() =>
                branchAssignEmployee &&
                assignBranchMutation.mutate({
                  userId: branchAssignEmployee.id,
                  data: {
                    branch_id: parseInt(branchAssignForm.branch_id),
                    effective_from: new Date(branchAssignForm.effective_from).toISOString(),
                    notes: branchAssignForm.notes || null,
                  },
                })
              }
            >
              Assign Branch
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="New Branch" isRequired>
            <Select variant="main" placeholder="Select branch" value={branchAssignForm.branch_id} onChange={(e) => setBranchAssignForm({ ...branchAssignForm, branch_id: e.target.value })}>
              {optionList(branches)}
            </Select>
          </Field>
          <Field label="Effective From" isRequired helper="The date when this assignment takes effect">
            <Input variant="main" type="date" value={branchAssignForm.effective_from} onChange={(e) => setBranchAssignForm({ ...branchAssignForm, effective_from: e.target.value })} />
          </Field>
          <Field label="Notes (Reason for rotation)">
            <Textarea
              variant="main"
              placeholder="e.g., Monthly rotation, covering for leave, permanent transfer..."
              value={branchAssignForm.notes}
              onChange={(e) => setBranchAssignForm({ ...branchAssignForm, notes: e.target.value })}
            />
          </Field>
          <Alert status="warning" borderRadius="12px" fontSize="sm">
            <AlertIcon />
            <Text>
              <strong>Security Note:</strong> When this employee logs in next, they will be required to verify they are at the assigned branch before they can
              continue working.
            </Text>
          </Alert>
        </Stack>
      </AppModal>
    </>
  )
}
