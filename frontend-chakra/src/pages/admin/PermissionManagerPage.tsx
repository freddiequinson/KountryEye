import { useState, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  Grid,
  Heading,
  Icon,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { MdAdd, MdCheck, MdPeople, MdSave, MdShield } from 'react-icons/md'
import api from '@/lib/api'
import { PersonCell } from '@/components/Person'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import { EmptyState, SearchInput } from '@/components/ui'

interface Permission {
  id: number
  name: string
  code: string
  module: string
  description?: string
}

interface Role {
  id: number
  name: string
  description?: string
  default_page?: string
  is_system: boolean
  permissions: Permission[]
}

interface Employee {
  id: number
  email: string
  first_name: string
  last_name: string
  role?: { id: number; name: string }
  branch?: { id: number; name: string }
  is_active: boolean
}

interface Branch {
  id: number
  name: string
}

const toggleIn = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

function ModuleColumn({ module, children }: { module: string; children: ReactNode }) {
  return (
    <Stack spacing="8px">
      <Text fontSize="xs" fontWeight="600" color="secondaryGray.600" textTransform="uppercase" letterSpacing="wide" borderBottom="1px solid" borderColor="secondaryGray.100" pb="4px">
        {module}
      </Text>
      <Stack spacing="4px">{children}</Stack>
    </Stack>
  )
}

// Selectable list on the left of the master/detail panes.
function SelectList<T extends { id: number }>({
  items,
  selectedId,
  onSelect,
  render,
}: {
  items: T[]
  selectedId?: number
  onSelect: (item: T) => void
  render: (item: T, selected: boolean) => ReactNode
}) {
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  return (
    <Stack spacing="4px">
      {items.map((item) => {
        const selected = item.id === selectedId
        return (
          <Box
            key={item.id}
            p="8px"
            borderRadius="10px"
            cursor="pointer"
            bg={selected ? 'brand.500' : undefined}
            color={selected ? 'white' : undefined}
            _hover={selected ? undefined : { bg: hoverBg }}
            onClick={() => onSelect(item)}
          >
            {render(item, selected)}
          </Box>
        )
      })}
    </Stack>
  )
}

export default function PermissionManagerPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [employeePermissions, setEmployeePermissions] = useState<number[]>([])
  const [deniedPermissions, setDeniedPermissions] = useState<number[]>([]) // Permissions denied from role
  const [employeeBranches, setEmployeeBranches] = useState<number[]>([])
  const [rolePermissions, setRolePermissions] = useState<number[]>([])
  const [rolePermissionIds, setRolePermissionIds] = useState<number[]>([]) // Permissions from user's role

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => (await api.get('/employees')).data as Employee[],
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get('/permissions/roles')).data as Role[],
  })

  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => (await api.get('/permissions/permissions')).data as Permission[],
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches')).data as Branch[],
  })

  const updateUserPermissionsMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: any }) => api.put(`/permissions/users/${userId}/permissions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-list'] })
      toast({ title: 'User permissions updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update permissions', variant: 'destructive' })
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, data }: { roleId: number; data: any }) => api.put(`/permissions/roles/${roleId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast({ title: 'Role updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update role', variant: 'destructive' })
    },
  })

  // Group permissions by module
  const permissionsByModule = permissions.reduce(
    (acc, perm) => {
      const module = perm.module || 'Other'
      ;(acc[module] ||= []).push(perm)
      return acc
    },
    {} as Record<string, Permission[]>,
  )

  const handleSelectEmployee = async (employee: Employee) => {
    setSelectedEmployee(employee)
    try {
      const data = (await api.get(`/permissions/users/${employee.id}/effective-permissions`)).data
      setEmployeePermissions(data.extra_permission_ids || [])
      setDeniedPermissions(data.denied_permission_ids || [])
      setEmployeeBranches(data.additional_branch_ids || [])
      setRolePermissionIds(data.role_permission_ids || [])
    } catch {
      console.error('Failed to fetch user permissions')
      setEmployeePermissions([])
      setDeniedPermissions([])
      setEmployeeBranches([])
      setRolePermissionIds([])
    }
  }

  const filteredEmployees = employees.filter((emp) => `${emp.first_name} ${emp.last_name} ${emp.email}`.toLowerCase().includes(searchTerm.toLowerCase()))

  // Total permissions for user = role permissions minus denied plus extra
  const totalUserPermissions = rolePermissionIds.filter((id) => !deniedPermissions.includes(id)).length + employeePermissions.length

  const pane = (children: ReactNode) => (
    <Card p="0" h={{ lg: 'calc(100vh - 290px)' }} minH="400px" overflow="hidden">
      {children}
    </Card>
  )

  return (
    <>
      <PageHeader title="Permission Manager" description="Manage roles, permissions, and branch access for employees" />

      <Tabs variant="soft-rounded">
        <TabList gap="8px" mb="16px">
          <Tab>
            <Icon as={MdPeople} me="8px" />
            User Permissions
          </Tab>
          <Tab>
            <Icon as={MdShield} me="8px" />
            Role Management
          </Tab>
        </TabList>

        <TabPanels>
          {/* User Permissions Tab */}
          <TabPanel p="0">
            <Grid templateColumns={{ base: '1fr', lg: '3fr 9fr' }} gap="16px">
              {pane(
                <Flex direction="column" h="100%">
                  <Box p="12px" borderBottom="1px solid" borderColor={borderColor}>
                    <Text fontWeight="600" mb="8px">
                      Employees
                    </Text>
                    <SearchInput maxW="100%" size="sm" value={searchTerm} onChange={setSearchTerm} />
                  </Box>
                  <Box flex="1" overflowY="auto" p="8px" className="thin-scrollbar">
                    <SelectList
                      items={filteredEmployees}
                      selectedId={selectedEmployee?.id}
                      onSelect={handleSelectEmployee}
                      render={(emp) => (
                        <PersonCell name={`${emp.first_name} ${emp.last_name}`} sub={emp.role?.name || 'No role'} />
                      )}
                    />
                  </Box>
                </Flex>,
              )}

              {pane(
                selectedEmployee ? (
                  <Flex direction="column" h="100%">
                    <Flex justify="space-between" align="center" p="16px" borderBottom="1px solid" borderColor={borderColor} gap="12px" wrap="wrap">
                      <Box>
                        <Heading size="md">
                          {selectedEmployee.first_name} {selectedEmployee.last_name}
                        </Heading>
                        <Text fontSize="sm" color="secondaryGray.600">
                          Role: <Badge variant="outline">{selectedEmployee.role?.name || 'No role'}</Badge>
                          <Text as="span" ms="12px">
                            Total Permissions: <strong>{totalUserPermissions}</strong>
                          </Text>
                        </Text>
                      </Box>
                      <Button
                        variant="brand"
                        size="sm"
                        leftIcon={<MdSave />}
                        isLoading={updateUserPermissionsMutation.isPending}
                        onClick={() =>
                          updateUserPermissionsMutation.mutate({
                            userId: selectedEmployee.id,
                            data: { extra_permission_ids: employeePermissions, denied_permission_ids: deniedPermissions, additional_branch_ids: employeeBranches },
                          })
                        }
                      >
                        Save Changes
                      </Button>
                    </Flex>

                    <Tabs variant="line" colorScheme="brand" flex="1" display="flex" flexDirection="column" minH="0" isLazy>
                      <TabList px="16px">
                        <Tab fontSize="sm">
                          <Icon as={MdCheck} me="4px" />
                          All Permissions ({totalUserPermissions})
                        </Tab>
                        <Tab fontSize="sm">
                          <Icon as={MdAdd} me="4px" />
                          Extra Permissions ({employeePermissions.length})
                        </Tab>
                        <Tab fontSize="sm">Branch Access</Tab>
                      </TabList>
                      <TabPanels flex="1" overflowY="auto" className="thin-scrollbar">
                        <TabPanel p="16px">
                          <Text fontSize="sm" color="secondaryGray.600" mb="16px">
                            All permissions from role.{' '}
                            <Text as="span" color="green.500">
                              Green = active
                            </Text>
                            ,{' '}
                            <Text as="span" color="red.500">
                              Red/strikethrough = denied
                            </Text>
                            . Click to toggle.
                          </Text>
                          <SimpleGrid columns={{ base: 1, md: 3 }} spacing="16px">
                            {Object.entries(permissionsByModule).map(([module, perms]) => {
                              const modulePerms = perms.filter((p) => rolePermissionIds.includes(p.id) || employeePermissions.includes(p.id))
                              if (modulePerms.length === 0) return null
                              return (
                                <ModuleColumn key={module} module={module}>
                                  {modulePerms.map((perm) => {
                                    if (rolePermissionIds.includes(perm.id)) {
                                      // Role permission - can be denied
                                      const isDenied = deniedPermissions.includes(perm.id)
                                      return (
                                        <Flex
                                          key={perm.id}
                                          align="center"
                                          gap="8px"
                                          fontSize="sm"
                                          py="4px"
                                          px="8px"
                                          borderRadius="8px"
                                          cursor="pointer"
                                          bg={isDenied ? 'red.50' : 'green.50'}
                                          color={isDenied ? 'red.600' : 'green.700'}
                                          textDecoration={isDenied ? 'line-through' : undefined}
                                          onClick={() => setDeniedPermissions(toggleIn(deniedPermissions, perm.id))}
                                        >
                                          <Checkbox isChecked={!isDenied} pointerEvents="none" size="sm" />
                                          <Text flex="1">{perm.name}</Text>
                                          <Badge variant="outline" fontSize="10px">
                                            role
                                          </Badge>
                                        </Flex>
                                      )
                                    }
                                    return (
                                      <Flex key={perm.id} align="center" gap="8px" fontSize="sm" py="4px" px="8px" borderRadius="8px" bg="blue.50" color="blue.700">
                                        <Icon as={MdCheck} />
                                        <Text flex="1">{perm.name}</Text>
                                        <Badge variant="outline" fontSize="10px">
                                          extra
                                        </Badge>
                                      </Flex>
                                    )
                                  })}
                                </ModuleColumn>
                              )
                            })}
                          </SimpleGrid>
                          {totalUserPermissions === 0 && deniedPermissions.length === 0 && <EmptyState icon={MdShield}>No permissions assigned</EmptyState>}
                        </TabPanel>

                        <TabPanel p="16px">
                          <Text fontSize="sm" color="secondaryGray.600" mb="16px">
                            Add extra permissions on top of the role's default permissions. Green items are already granted by role.
                          </Text>
                          <SimpleGrid columns={{ base: 1, md: 3 }} spacing="16px">
                            {Object.entries(permissionsByModule).map(([module, perms]) => (
                              <ModuleColumn key={module} module={module}>
                                {perms.map((perm) => {
                                  const isFromRole = rolePermissionIds.includes(perm.id)
                                  return (
                                    <Checkbox
                                      key={perm.id}
                                      size="sm"
                                      isChecked={isFromRole || employeePermissions.includes(perm.id)}
                                      isDisabled={isFromRole}
                                      onChange={() => !isFromRole && setEmployeePermissions(toggleIn(employeePermissions, perm.id))}
                                    >
                                      <Text fontSize="sm" color={isFromRole ? 'green.500' : undefined}>
                                        {perm.name}
                                      </Text>
                                    </Checkbox>
                                  )
                                })}
                              </ModuleColumn>
                            ))}
                          </SimpleGrid>
                        </TabPanel>

                        <TabPanel p="16px">
                          <Box maxW="448px">
                            <Text fontSize="sm" color="secondaryGray.600" mb="8px">
                              Primary branch: <Badge colorScheme="brand">{selectedEmployee.branch?.name || 'Not assigned'}</Badge>
                            </Text>
                            <Text fontSize="sm" color="secondaryGray.600" mb="16px">
                              Select additional branches this employee can access:
                            </Text>
                            <Stack spacing="8px">
                              {branches
                                .filter((b) => b.id !== selectedEmployee.branch?.id)
                                .map((branch) => (
                                  <Checkbox
                                    key={branch.id}
                                    p="8px"
                                    isChecked={employeeBranches.includes(branch.id)}
                                    onChange={() => setEmployeeBranches(toggleIn(employeeBranches, branch.id))}
                                  >
                                    <Text fontSize="sm">{branch.name}</Text>
                                  </Checkbox>
                                ))}
                            </Stack>
                          </Box>
                        </TabPanel>
                      </TabPanels>
                    </Tabs>
                  </Flex>
                ) : (
                  <Flex h="100%" align="center" justify="center">
                    <EmptyState icon={MdPeople} title="Select an employee from the list">
                      to manage their permissions
                    </EmptyState>
                  </Flex>
                ),
              )}
            </Grid>
          </TabPanel>

          {/* Role Management Tab */}
          <TabPanel p="0">
            <Grid templateColumns={{ base: '1fr', lg: '3fr 9fr' }} gap="16px">
              {pane(
                <Flex direction="column" h="100%">
                  <Box p="12px" borderBottom="1px solid" borderColor={borderColor}>
                    <Text fontWeight="600">Roles</Text>
                  </Box>
                  <Box flex="1" overflowY="auto" p="8px" className="thin-scrollbar">
                    <SelectList
                      items={roles}
                      selectedId={selectedRole?.id}
                      onSelect={(role) => {
                        setSelectedRole(role)
                        setRolePermissions(role.permissions.map((p) => p.id))
                      }}
                      render={(role) => (
                        <>
                          <Flex justify="space-between" align="center">
                            <Text fontWeight="500" fontSize="sm">
                              {role.name}
                            </Text>
                            {role.is_system && <Badge fontSize="10px">System</Badge>}
                          </Flex>
                          <Text fontSize="xs" opacity={0.7}>
                            {role.permissions?.length || 0} permissions
                          </Text>
                        </>
                      )}
                    />
                  </Box>
                </Flex>,
              )}

              {pane(
                selectedRole ? (
                  <Flex direction="column" h="100%">
                    <Box p="16px" borderBottom="1px solid" borderColor={borderColor}>
                      <Flex justify="space-between" align="center" gap="12px" wrap="wrap">
                        <Box>
                          <Heading size="md">{selectedRole.name}</Heading>
                          <Text fontSize="sm" color="secondaryGray.600">
                            {selectedRole.description || 'Manage permissions for this role'}
                          </Text>
                        </Box>
                        <Button
                          variant="brand"
                          size="sm"
                          leftIcon={<MdSave />}
                          isLoading={updateRoleMutation.isPending}
                          onClick={() => updateRoleMutation.mutate({ roleId: selectedRole.id, data: { permission_ids: rolePermissions } })}
                        >
                          Save Role Permissions
                        </Button>
                      </Flex>
                      {selectedRole.is_system && (
                        <Alert status="warning" mt="8px" borderRadius="8px" fontSize="xs" py="8px">
                          <AlertIcon />
                          This is a system role. Changes will affect all users with this role.
                        </Alert>
                      )}
                    </Box>
                    <Box flex="1" overflowY="auto" p="16px" className="thin-scrollbar">
                      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="16px">
                        {Object.entries(permissionsByModule).map(([module, perms]) => (
                          <ModuleColumn key={module} module={module}>
                            {perms.map((perm) => (
                              <Checkbox key={perm.id} size="sm" isChecked={rolePermissions.includes(perm.id)} onChange={() => setRolePermissions(toggleIn(rolePermissions, perm.id))}>
                                <Text fontSize="sm">{perm.name}</Text>
                              </Checkbox>
                            ))}
                          </ModuleColumn>
                        ))}
                      </SimpleGrid>
                    </Box>
                  </Flex>
                ) : (
                  <Flex h="100%" align="center" justify="center">
                    <EmptyState icon={MdShield} title="Select a role from the list">
                      to manage its permissions
                    </EmptyState>
                  </Flex>
                ),
              )}
            </Grid>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </>
  )
}
