import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  ListItem,
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
  Th,
  Thead,
  Tooltip,
  Tr,
  UnorderedList,
} from '@chakra-ui/react'
import {
  MdAdd,
  MdApartment,
  MdDelete,
  MdEdit,
  MdKey,
  MdLocalHospital,
  MdPause,
  MdPeople,
  MdPersonAdd,
  MdPersonOff,
  MdPlayArrow,
  MdHowToReg,
  MdRestartAlt,
  MdSettings,
  MdUpload,
  MdVisibility,
  MdVisibilityOff,
  MdWarning,
} from 'react-icons/md'
import api from '@/lib/api'
import { PersonCell } from '@/components/Person'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { TabbedSections } from '@/components/card/TabCard'
import { AppModal, ConfirmDialog, Field, TableBox, TableMessageRow } from '@/components/ui'

interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  phone?: string
  is_active: boolean
  is_superuser: boolean
  role_id?: number
  branch_id?: number
  created_at: string
}

interface Branch {
  id: number
  name: string
  address?: string
  phone?: string
  is_active: boolean
  latitude?: number
  longitude?: number
  geofence_radius?: number
  require_geolocation?: boolean
  work_start_time?: string
  work_end_time?: string
  late_threshold_minutes?: number
}

interface ConsultationType {
  id: number
  name: string
  description?: string
  initial_fee?: number
  review_fee?: number
  subsequent_fee?: number
  base_fee: number
  is_active: boolean
}

interface Role {
  id: number
  name: string
  description?: string
}

const emptyUser = { email: '', first_name: '', last_name: '', phone: '', password: '', role_id: '', branch_id: '', is_active: true }
const emptyBranch = {
  name: '',
  address: '',
  phone: '',
  email: '',
  latitude: '',
  longitude: '',
  geofence_radius: '100',
  require_geolocation: false,
  work_start_time: '08:00',
  work_end_time: '17:00',
  late_threshold_minutes: '15',
}
const emptyConsultationType = { name: '', description: '', base_fee: 0, initial_fee: 0, review_fee: 0, subsequent_fee: 0 }
const emptyMember = { member_id: '', first_name: '', last_name: '', phone: '', email: '', company: '', plan_type: 'individual' }

const DELETE_COPY: Record<string, { title: string; body: string; label: string }> = {
  user: { title: 'Delete user?', body: 'will be deleted. Users with related records are deactivated instead.', label: 'Delete' },
  branch: { title: 'Deactivate branch?', body: 'will be deactivated. An administrator can reactivate it.', label: 'Deactivate' },
  consultationType: { title: 'Delete consultation type?', body: 'will be permanently deleted. Use deactivate to keep its history.', label: 'Delete' },
}

function StatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Flex justify="space-between" align="center">
      <Text color="secondaryGray.600">{label}</Text>
      <Box fontWeight="600">{children}</Box>
    </Flex>
  )
}

const statusBadge = (active: boolean, inactiveScheme = 'red') => <Badge colorScheme={active ? 'green' : inactiveScheme}>{active ? 'Active' : 'Inactive'}</Badge>

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const csvInputRef = useRef<HTMLInputElement>(null)

  // Dialog states
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false)
  const [isConsultationTypeDialogOpen, setIsConsultationTypeDialogOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [isVisionCareMemberDialogOpen, setIsVisionCareMemberDialogOpen] = useState(false)
  const [showInactiveUsers, setShowInactiveUsers] = useState(true)

  // Edit states
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [editingConsultationType, setEditingConsultationType] = useState<ConsultationType | null>(null)
  const [deletingItem, setDeletingItem] = useState<{ type: string; id: number; name: string } | null>(null)
  const [passwordUserId, setPasswordUserId] = useState<number | null>(null)

  // Form states
  const [userForm, setUserForm] = useState(emptyUser)
  const [branchForm, setBranchForm] = useState(emptyBranch)
  const [consultationTypeForm, setConsultationTypeForm] = useState(emptyConsultationType)
  const [visionCareMemberForm, setVisionCareMemberForm] = useState(emptyMember)

  const [newPassword, setNewPassword] = useState('')
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [resetReseed, setResetReseed] = useState(true)

  // Queries
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get('/users')).data,
  })

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['admin-branches'],
    queryFn: async () => (await api.get('/branches')).data,
  })

  const { data: consultationTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ['admin-consultation-types'],
    queryFn: async () => (await api.get('/clinical/types?include_inactive=true')).data,
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get('/users/roles/list')).data,
  })

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: async () => (await api.get('/ai/status')).data,
  })

  const { data: visionCareMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['visioncare-members'],
    queryFn: async () => (await api.get('/settings/visioncare/members')).data,
  })

  const toggleAiMutation = useMutation({
    mutationFn: (enabled: boolean) => api.put('/settings/ai_enabled', { value: enabled ? 'true' : 'false' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-status'] })
      toast({ title: 'AI settings updated' })
    },
  })

  const createVisionCareMemberMutation = useMutation({
    mutationFn: (data: typeof visionCareMemberForm) => api.post('/settings/visioncare/members', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visioncare-members'] })
      setIsVisionCareMemberDialogOpen(false)
      setVisionCareMemberForm(emptyMember)
      toast({ title: 'VisionCare member added successfully' })
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.detail || 'Failed to add member', variant: 'destructive' })
    },
  })

  // User mutations
  const createUserMutation = useMutation({
    mutationFn: (data: any) => api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setIsUserDialogOpen(false)
      setUserForm(emptyUser)
      toast({ title: 'User created successfully' })
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      let message = 'Failed to create user'
      if (typeof detail === 'string') {
        message = detail
      } else if (Array.isArray(detail) && detail.length > 0) {
        message = detail.map((e: any) => e.msg || e.message || String(e)).join(', ')
      }
      toast({ title: message, variant: 'destructive' })
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setIsUserDialogOpen(false)
      setEditingUser(null)
      setUserForm(emptyUser)
      toast({ title: 'User updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update user', variant: 'destructive' })
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setDeletingItem(null)
      const data = response.data
      if (data.deleted) {
        toast({ title: 'User deleted permanently' })
      } else {
        toast({ title: 'User deactivated', description: `Has ${data.record_count} related records - cannot be permanently deleted` })
      }
    },
    onError: () => {
      toast({ title: 'Failed to delete user', variant: 'destructive' })
    },
  })

  const toggleUserActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => api.put(`/users/${id}`, { is_active }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast({ title: variables.is_active ? 'User activated' : 'User deactivated' })
    },
    onError: () => {
      toast({ title: 'Failed to update user status', variant: 'destructive' })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => api.post(`/users/${id}/reset-password`, { password }),
    onSuccess: () => {
      setIsPasswordDialogOpen(false)
      setPasswordUserId(null)
      setNewPassword('')
      toast({ title: 'Password reset successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to reset password', variant: 'destructive' })
    },
  })

  // Branch mutations
  const createBranchMutation = useMutation({
    mutationFn: (data: any) => api.post('/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-branches'] })
      setIsBranchDialogOpen(false)
      setBranchForm(emptyBranch)
      toast({ title: 'Branch created successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to create branch', variant: 'destructive' })
    },
  })

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/branches/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-branches'] })
      setIsBranchDialogOpen(false)
      setEditingBranch(null)
      setBranchForm(emptyBranch)
      toast({ title: 'Branch updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update branch', variant: 'destructive' })
    },
  })

  const deleteBranchMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-branches'] })
      setDeletingItem(null)
      toast({ title: 'Branch deactivated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to deactivate branch', variant: 'destructive' })
    },
  })

  // Consultation Type mutations
  const createConsultationTypeMutation = useMutation({
    mutationFn: (data: any) => api.post('/clinical/types', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-consultation-types'] })
      setIsConsultationTypeDialogOpen(false)
      setConsultationTypeForm(emptyConsultationType)
      toast({ title: 'Consultation type created successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to create consultation type', variant: 'destructive' })
    },
  })

  const updateConsultationTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/clinical/types/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-consultation-types'] })
      setIsConsultationTypeDialogOpen(false)
      setEditingConsultationType(null)
      setConsultationTypeForm(emptyConsultationType)
      toast({ title: 'Consultation type updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update consultation type', variant: 'destructive' })
    },
  })

  const deactivateConsultationTypeMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/clinical/types/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-consultation-types'] })
      toast({ title: 'Consultation type deactivated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to deactivate consultation type', variant: 'destructive' })
    },
  })

  const activateConsultationTypeMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/clinical/types/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-consultation-types'] })
      toast({ title: 'Consultation type activated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to activate consultation type', variant: 'destructive' })
    },
  })

  const deleteConsultationTypeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/clinical/types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-consultation-types'] })
      setDeletingItem(null)
      toast({ title: 'Consultation type permanently deleted' })
    },
    onError: () => {
      toast({ title: 'Failed to delete consultation type', variant: 'destructive' })
    },
  })

  const resetDatabaseMutation = useMutation({
    mutationFn: (data: { password: string; reseed: boolean }) => api.post('/system/hard-reset', data),
    onSuccess: (response) => {
      setIsResetDialogOpen(false)
      setResetPassword('')
      queryClient.invalidateQueries()
      toast({
        title: 'Database Reset Complete',
        description: response.data.reseeded
          ? `Login with: ${response.data.admin_credentials.email} / ${response.data.admin_credentials.password}`
          : 'Database has been cleared. No seed data was added.',
      })
      // Force logout after reset
      setTimeout(() => {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }, 3000)
    },
    onError: (error: any) => {
      toast({ title: 'Reset Failed', description: error.response?.data?.detail || 'Invalid password or server error', variant: 'destructive' })
    },
  })

  const openEditUser = (user: User) => {
    setEditingUser(user)
    setUserForm({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || '',
      password: '',
      role_id: user.role_id?.toString() || '',
      branch_id: user.branch_id?.toString() || '',
      is_active: user.is_active,
    })
    setIsUserDialogOpen(true)
  }

  const openEditBranch = (branch: Branch) => {
    setEditingBranch(branch)
    setBranchForm({
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
      email: '',
      latitude: branch.latitude?.toString() || '',
      longitude: branch.longitude?.toString() || '',
      geofence_radius: branch.geofence_radius?.toString() || '100',
      require_geolocation: branch.require_geolocation || false,
      work_start_time: branch.work_start_time || '08:00',
      work_end_time: branch.work_end_time || '17:00',
      late_threshold_minutes: branch.late_threshold_minutes?.toString() || '15',
    })
    setIsBranchDialogOpen(true)
  }

  const openEditConsultationType = (type: ConsultationType) => {
    setEditingConsultationType(type)
    setConsultationTypeForm({
      name: type.name,
      description: type.description || '',
      base_fee: type.base_fee,
      initial_fee: type.initial_fee || 0,
      review_fee: type.review_fee || 0,
      subsequent_fee: type.subsequent_fee || 0,
    })
    setIsConsultationTypeDialogOpen(true)
  }

  const handleUserSubmit = () => {
    const data: any = {
      email: userForm.email,
      first_name: userForm.first_name,
      last_name: userForm.last_name,
      phone: userForm.phone || null,
      role_id: userForm.role_id ? parseInt(userForm.role_id) : null,
      branch_id: userForm.branch_id ? parseInt(userForm.branch_id) : null,
      is_active: userForm.is_active,
    }
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data })
    } else {
      data.password = userForm.password
      createUserMutation.mutate(data)
    }
  }

  const handleBranchSubmit = () => {
    const submitData = {
      name: branchForm.name,
      address: branchForm.address,
      phone: branchForm.phone,
      email: branchForm.email,
      latitude: branchForm.latitude ? parseFloat(branchForm.latitude) : null,
      longitude: branchForm.longitude ? parseFloat(branchForm.longitude) : null,
      geofence_radius: parseInt(branchForm.geofence_radius) || 100,
      require_geolocation: branchForm.require_geolocation,
      work_start_time: branchForm.work_start_time,
      work_end_time: branchForm.work_end_time,
      late_threshold_minutes: parseInt(branchForm.late_threshold_minutes) || 15,
    }
    if (editingBranch) {
      updateBranchMutation.mutate({ id: editingBranch.id, data: submitData })
    } else {
      createBranchMutation.mutate(submitData)
    }
  }

  const handleConsultationTypeSubmit = () => {
    if (editingConsultationType) {
      updateConsultationTypeMutation.mutate({ id: editingConsultationType.id, data: consultationTypeForm })
    } else {
      createConsultationTypeMutation.mutate(consultationTypeForm)
    }
  }

  const handleDelete = () => {
    if (!deletingItem) return
    if (deletingItem.type === 'user') deleteUserMutation.mutate(deletingItem.id)
    else if (deletingItem.type === 'branch') deleteBranchMutation.mutate(deletingItem.id)
    else if (deletingItem.type === 'consultationType') deleteConsultationTypeMutation.mutate(deletingItem.id)
  }

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api.post('/settings/visioncare/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      queryClient.invalidateQueries({ queryKey: ['visioncare-members'] })
      toast({ title: 'Members uploaded successfully' })
    } catch {
      toast({ title: 'Failed to upload members', variant: 'destructive' })
    }
  }

  const getRoleName = (roleId?: number) => {
    if (!roleId) return 'No Role'
    return roles.find((r: Role) => r.id === roleId)?.name || 'Unknown'
  }

  const getBranchName = (branchId?: number) => {
    if (!branchId) return 'No Branch'
    return branches.find((b: Branch) => b.id === branchId)?.name || 'Unknown'
  }

  const visibleUsers = users.filter((u: User) => showInactiveUsers || u.is_active)
  const deleteCopy = deletingItem ? DELETE_COPY[deletingItem.type] : null

  // Number inputs that show empty instead of 0
  const feeInput = (key: 'initial_fee' | 'review_fee' | 'subsequent_fee' | 'base_fee', label: string, placeholder: string) => (
    <Field label={label}>
      <Input
        variant="main"
        type="number"
        min="0"
        step="0.01"
        placeholder={placeholder}
        value={consultationTypeForm[key] === 0 ? '' : consultationTypeForm[key]}
        onChange={(e) => setConsultationTypeForm({ ...consultationTypeForm, [key]: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
      />
    </Field>
  )

  return (
    <>
      <PageHeader title="Admin Settings" description="Manage users, branches, consultation types, and system settings" />

      <Tabs variant="soft-rounded" isLazy>
        <TabList gap="8px" mb="16px" flexWrap="wrap">
          {[
            { icon: MdPeople, label: 'Users' },
            { icon: MdApartment, label: 'Branches' },
            { icon: MdLocalHospital, label: 'Consultation Types' },
            { icon: MdPersonAdd, label: 'VisionCare' },
            { icon: MdSettings, label: 'System' },
          ].map((t) => (
            <Tab key={t.label}>
              <Icon as={t.icon} me="8px" />
              {t.label}
            </Tab>
          ))}
        </TabList>

        <TabPanels>
          {/* Users */}
          <TabPanel p="0">
            <SectionCard
              title="User Management"
              description="Create and manage employee accounts"
              actions={
                <HStack spacing="16px">
                  <FormControl display="flex" alignItems="center" w="auto">
                    <Switch id="show-inactive-users" colorScheme="brandScheme" isChecked={showInactiveUsers} onChange={(e) => setShowInactiveUsers(e.target.checked)} me="8px" />
                    <FormLabel htmlFor="show-inactive-users" mb="0" display="flex" alignItems="center" gap="4px" fontSize="sm">
                      <Icon as={showInactiveUsers ? MdVisibility : MdVisibilityOff} />
                      {showInactiveUsers ? 'Showing inactive' : 'Hiding inactive'}
                    </FormLabel>
                  </FormControl>
                  <Button
                    variant="brand"
                    leftIcon={<MdPersonAdd />}
                    onClick={() => {
                      setUserForm(emptyUser)
                      setEditingUser(null)
                      setIsUserDialogOpen(true)
                    }}
                  >
                    Add User
                  </Button>
                </HStack>
              }
            >
              <TableBox>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Email</Th>
                      <Th>Role</Th>
                      <Th>Branch</Th>
                      <Th>Status</Th>
                      <Th textAlign="right">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {usersLoading ? (
                      <TableMessageRow colSpan={6} loading />
                    ) : visibleUsers.length === 0 ? (
                      <TableMessageRow colSpan={6}>No users found</TableMessageRow>
                    ) : (
                      visibleUsers.map((user: User) => (
                        <Tr key={user.id}>
                          <Td>
                            <PersonCell name={`${user.first_name} ${user.last_name}`} sub={user.is_superuser ? 'Administrator' : undefined} />
                          </Td>
                          <Td>{user.email}</Td>
                          <Td>{getRoleName(user.role_id)}</Td>
                          <Td>{getBranchName(user.branch_id)}</Td>
                          <Td>{statusBadge(user.is_active)}</Td>
                          <Td>
                            <HStack justify="end" spacing="4px">
                              <Tooltip label="Edit">
                                <IconButton aria-label="Edit" variant="ghost" size="sm" icon={<MdEdit />} onClick={() => openEditUser(user)} />
                              </Tooltip>
                              <Tooltip label="Reset Password">
                                <IconButton
                                  aria-label="Reset Password"
                                  variant="ghost"
                                  size="sm"
                                  icon={<MdKey />}
                                  onClick={() => {
                                    setPasswordUserId(user.id)
                                    setIsPasswordDialogOpen(true)
                                  }}
                                />
                              </Tooltip>
                              {!user.is_superuser && (
                                <>
                                  <Tooltip label={user.is_active ? 'Deactivate' : 'Activate'}>
                                    <IconButton
                                      aria-label={user.is_active ? 'Deactivate' : 'Activate'}
                                      variant={user.is_active ? 'ghost' : 'brand'}
                                      size="sm"
                                      icon={user.is_active ? <MdPersonOff /> : <MdHowToReg />}
                                      onClick={() => toggleUserActiveMutation.mutate({ id: user.id, is_active: !user.is_active })}
                                    />
                                  </Tooltip>
                                  <Tooltip label="Delete">
                                    <IconButton
                                      aria-label="Delete"
                                      variant="ghost"
                                      size="sm"
                                      color="red.500"
                                      icon={<MdDelete />}
                                      onClick={() => setDeletingItem({ type: 'user', id: user.id, name: `${user.first_name} ${user.last_name}` })}
                                    />
                                  </Tooltip>
                                </>
                              )}
                            </HStack>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </TableBox>
            </SectionCard>
          </TabPanel>

          {/* Branches */}
          <TabPanel p="0">
            <SectionCard
              title="Branch Management"
              description="Manage clinic branches and locations"
              actions={
                <Button
                  variant="brand"
                  leftIcon={<MdAdd />}
                  onClick={() => {
                    setBranchForm(emptyBranch)
                    setEditingBranch(null)
                    setIsBranchDialogOpen(true)
                  }}
                >
                  Add Branch
                </Button>
              }
            >
              <TableBox>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Address</Th>
                      <Th>Phone</Th>
                      <Th>Status</Th>
                      <Th textAlign="right">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {branchesLoading ? (
                      <TableMessageRow colSpan={5} loading />
                    ) : branches.length === 0 ? (
                      <TableMessageRow colSpan={5}>No branches found</TableMessageRow>
                    ) : (
                      branches.map((branch: Branch) => (
                        <Tr key={branch.id}>
                          <Td fontWeight="600">{branch.name}</Td>
                          <Td>{branch.address || '-'}</Td>
                          <Td>{branch.phone || '-'}</Td>
                          <Td>{statusBadge(branch.is_active)}</Td>
                          <Td>
                            <HStack justify="end" spacing="4px">
                              <IconButton aria-label="Edit branch" variant="ghost" size="sm" icon={<MdEdit />} onClick={() => openEditBranch(branch)} />
                              <IconButton
                                aria-label="Deactivate branch"
                                variant="ghost"
                                size="sm"
                                color="red.500"
                                icon={<MdDelete />}
                                onClick={() => setDeletingItem({ type: 'branch', id: branch.id, name: branch.name })}
                              />
                            </HStack>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </TableBox>
            </SectionCard>
          </TabPanel>

          {/* Consultation Types */}
          <TabPanel p="0">
            <SectionCard
              title="Consultation Types"
              description="Manage consultation types and fees"
              actions={
                <Button
                  variant="brand"
                  leftIcon={<MdAdd />}
                  onClick={() => {
                    setConsultationTypeForm(emptyConsultationType)
                    setEditingConsultationType(null)
                    setIsConsultationTypeDialogOpen(true)
                  }}
                >
                  Add Type
                </Button>
              }
            >
              <TableBox>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Description</Th>
                      <Th>Base Fee</Th>
                      <Th>Status</Th>
                      <Th textAlign="right">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {typesLoading ? (
                      <TableMessageRow colSpan={5} loading />
                    ) : consultationTypes.length === 0 ? (
                      <TableMessageRow colSpan={5}>No consultation types found</TableMessageRow>
                    ) : (
                      consultationTypes.map((type: ConsultationType) => (
                        <Tr key={type.id}>
                          <Td fontWeight="600">{type.name}</Td>
                          <Td>{type.description || '-'}</Td>
                          <Td>GH₵{type.base_fee?.toLocaleString()}</Td>
                          <Td>{statusBadge(type.is_active)}</Td>
                          <Td>
                            <HStack justify="end" spacing="4px">
                              <Tooltip label="Edit">
                                <IconButton aria-label="Edit" variant="ghost" size="sm" icon={<MdEdit />} onClick={() => openEditConsultationType(type)} />
                              </Tooltip>
                              {type.is_active ? (
                                <Tooltip label="Deactivate">
                                  <IconButton
                                    aria-label="Deactivate"
                                    variant="ghost"
                                    size="sm"
                                    color="orange.400"
                                    icon={<MdPause />}
                                    onClick={() => deactivateConsultationTypeMutation.mutate(type.id)}
                                  />
                                </Tooltip>
                              ) : (
                                <Tooltip label="Activate">
                                  <IconButton
                                    aria-label="Activate"
                                    variant="ghost"
                                    size="sm"
                                    color="green.500"
                                    icon={<MdPlayArrow />}
                                    onClick={() => activateConsultationTypeMutation.mutate(type.id)}
                                  />
                                </Tooltip>
                              )}
                              <Tooltip label="Delete permanently">
                                <IconButton
                                  aria-label="Delete permanently"
                                  variant="ghost"
                                  size="sm"
                                  color="red.500"
                                  icon={<MdDelete />}
                                  onClick={() => setDeletingItem({ type: 'consultationType', id: type.id, name: type.name })}
                                />
                              </Tooltip>
                            </HStack>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </TableBox>
            </SectionCard>
          </TabPanel>

          {/* VisionCare */}
          <TabPanel p="0">
            <SectionCard
              title="VisionCare Membership"
              description="Manage VisionCare plan members"
              actions={
                <HStack spacing="8px">
                  <Button variant="brand" leftIcon={<MdAdd />} onClick={() => setIsVisionCareMemberDialogOpen(true)}>
                    Add Member
                  </Button>
                  <input ref={csvInputRef} type="file" accept=".csv" hidden onChange={handleCsvUpload} />
                  <Button variant="light" leftIcon={<MdUpload />} onClick={() => csvInputRef.current?.click()}>
                    Upload CSV
                  </Button>
                </HStack>
              }
            >
              <TableBox>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Member ID</Th>
                      <Th>Name</Th>
                      <Th>Company</Th>
                      <Th>Plan</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {membersLoading ? (
                      <TableMessageRow colSpan={5} loading />
                    ) : visionCareMembers.length === 0 ? (
                      <TableMessageRow colSpan={5}>No VisionCare members. Upload a CSV to add members.</TableMessageRow>
                    ) : (
                      visionCareMembers.map((member: any) => (
                        <Tr key={member.id}>
                          <Td fontWeight="600">{member.member_id}</Td>
                          <Td>
                            {member.first_name} {member.last_name}
                          </Td>
                          <Td>{member.company || '-'}</Td>
                          <Td>{member.plan_type || 'Individual'}</Td>
                          <Td>{statusBadge(member.is_active, 'gray')}</Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </TableBox>
            </SectionCard>
          </TabPanel>

          {/* System */}
          <TabPanel p="0">
            <TabbedSections mb="20px">
              <SectionCard title="AI Features" description="Configure AI-powered clinical analysis">
                <Stack spacing="16px">
                  <Flex justify="space-between" align="center" gap="12px">
                    <Box>
                      <Text fontWeight="600">AI Clinical Analysis</Text>
                      <Text fontSize="sm" color="secondaryGray.600">
                        Enable AI-powered diagnosis recommendations
                      </Text>
                    </Box>
                    <Button
                      variant={aiStatus?.enabled ? 'brand' : 'light'}
                      onClick={() => toggleAiMutation.mutate(!aiStatus?.enabled)}
                      isLoading={toggleAiMutation.isPending}
                    >
                      {aiStatus?.enabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </Flex>
                  <StatRow label="API Configured">
                    <Badge colorScheme={aiStatus?.configured ? 'green' : 'red'}>{aiStatus?.configured ? 'Yes' : 'No'}</Badge>
                  </StatRow>
                </Stack>
              </SectionCard>

              <SectionCard title="System Information">
                <Stack spacing="16px">
                  <StatRow label="Version">1.0.0</StatRow>
                  <StatRow label="Total Users">{users.length}</StatRow>
                  <StatRow label="Total Branches">{branches.length}</StatRow>
                  <StatRow label="Consultation Types">{consultationTypes.filter((t: ConsultationType) => t.is_active).length}</StatRow>
                </Stack>
              </SectionCard>

              <SectionCard title="Quick Stats">
                <Stack spacing="16px">
                  <StatRow label="Active Users">{users.filter((u: User) => u.is_active).length}</StatRow>
                  <StatRow label="Active Branches">{branches.filter((b: Branch) => b.is_active).length}</StatRow>
                  <StatRow label="VisionCare Members">{visionCareMembers.length}</StatRow>
                  <StatRow label="Database Status">
                    <Badge colorScheme="green">Online</Badge>
                  </StatRow>
                </Stack>
              </SectionCard>
            </TabbedSections>

              <Card border="1px solid" borderColor="red.300">
                <Flex align="center" gap="8px" color="red.500" mb="4px">
                  <Icon as={MdWarning} w="20px" h="20px" />
                  <Heading size="md">Danger Zone</Heading>
                </Flex>
                <Text fontSize="sm" color="secondaryGray.600" mb="16px">
                  Irreversible actions that affect the entire system
                </Text>
                <Flex justify="space-between" align="center" gap="12px" wrap="wrap" p="16px" border="1px solid" borderColor="red.200" borderRadius="12px" bg="rgba(229,62,62,0.05)">
                  <Box>
                    <Text fontWeight="600">Hard Reset Database</Text>
                    <Text fontSize="sm" color="secondaryGray.600">
                      Delete ALL data and reset to initial state. This cannot be undone.
                    </Text>
                  </Box>
                  <Button colorScheme="red" leftIcon={<MdRestartAlt />} onClick={() => setIsResetDialogOpen(true)}>
                    Reset Database
                  </Button>
                </Flex>
              </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* User Dialog */}
      <AppModal
        isOpen={isUserDialogOpen}
        onClose={() => setIsUserDialogOpen(false)}
        title={editingUser ? 'Edit User' : 'Create New User'}
        description={editingUser ? 'Update user information' : 'Add a new employee account'}
        footer={
          <>
            <Button variant="light" onClick={() => setIsUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleUserSubmit} isLoading={createUserMutation.isPending || updateUserMutation.isPending}>
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <SimpleGrid columns={2} spacing="16px">
            <Field label="First Name">
              <Input variant="main" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} />
            </Field>
            <Field label="Last Name">
              <Input variant="main" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} />
            </Field>
          </SimpleGrid>
          <Field label="Email">
            <Input variant="main" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input variant="main" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
          </Field>
          {!editingUser && (
            <Field label="Password">
              <Input variant="main" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            </Field>
          )}
          <Field label="Role">
            <Select variant="main" placeholder="Select role" value={userForm.role_id} onChange={(e) => setUserForm({ ...userForm, role_id: e.target.value })}>
              {roles.map((role: Role) => (
                <option key={role.id} value={role.id.toString()}>
                  {role.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Branch">
            <Select variant="main" placeholder="Select branch" value={userForm.branch_id} onChange={(e) => setUserForm({ ...userForm, branch_id: e.target.value })}>
              {branches.map((branch: Branch) => (
                <option key={branch.id} value={branch.id.toString()}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </Field>
        </Stack>
      </AppModal>

      {/* Branch Dialog */}
      <AppModal
        isOpen={isBranchDialogOpen}
        onClose={() => setIsBranchDialogOpen(false)}
        size="2xl"
        title={editingBranch ? 'Edit Branch' : 'Create New Branch'}
        description={editingBranch ? 'Update branch information and geolocation settings' : 'Add a new clinic branch'}
        footer={
          <>
            <Button variant="light" onClick={() => setIsBranchDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleBranchSubmit} isLoading={createBranchMutation.isPending || updateBranchMutation.isPending}>
              {editingBranch ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <Stack spacing="24px">
          <Stack spacing="16px">
            <Text fontSize="sm" fontWeight="600" color="secondaryGray.600">
              Basic Information
            </Text>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing="16px">
              <Field label="Branch Name">
                <Input variant="main" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input variant="main" value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} />
              </Field>
            </SimpleGrid>
            <Field label="Address">
              <Input variant="main" value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} />
            </Field>
          </Stack>

          <Stack spacing="16px" borderTop="1px solid" borderColor="secondaryGray.100" pt="16px">
            <Text fontSize="sm" fontWeight="600" color="secondaryGray.600">
              Work Hours
            </Text>
            <SimpleGrid columns={{ base: 1, sm: 3 }} spacing="16px">
              <Field label="Start Time">
                <Input variant="main" type="time" value={branchForm.work_start_time} onChange={(e) => setBranchForm({ ...branchForm, work_start_time: e.target.value })} />
              </Field>
              <Field label="End Time">
                <Input variant="main" type="time" value={branchForm.work_end_time} onChange={(e) => setBranchForm({ ...branchForm, work_end_time: e.target.value })} />
              </Field>
              <Field label="Late Threshold (min)">
                <Input
                  variant="main"
                  type="number"
                  min="0"
                  max="120"
                  value={branchForm.late_threshold_minutes}
                  onChange={(e) => setBranchForm({ ...branchForm, late_threshold_minutes: e.target.value })}
                />
              </Field>
            </SimpleGrid>
          </Stack>

          <Stack spacing="16px" borderTop="1px solid" borderColor="secondaryGray.100" pt="16px">
            <Text fontSize="sm" fontWeight="600" color="secondaryGray.600">
              Geolocation Settings (Clock In/Out)
            </Text>
            <Flex justify="space-between" align="center" gap="12px" p="12px" border="1px solid" borderColor="secondaryGray.100" borderRadius="12px">
              <Box>
                <Text fontWeight="600">Require Geolocation</Text>
                <Text fontSize="sm" color="secondaryGray.600">
                  Employees must be within the geofence to clock in/out
                </Text>
              </Box>
              <Switch
                colorScheme="brandScheme"
                isChecked={branchForm.require_geolocation}
                onChange={(e) => setBranchForm({ ...branchForm, require_geolocation: e.target.checked })}
              />
            </Flex>

            {branchForm.require_geolocation && (
              <>
                <Field label="Geofence Radius (meters)" helper="Distance in meters employees must be within to clock in/out (10-1000m)">
                  <Input
                    variant="main"
                    type="number"
                    min="10"
                    max="1000"
                    value={branchForm.geofence_radius}
                    onChange={(e) => setBranchForm({ ...branchForm, geofence_radius: e.target.value })}
                  />
                </Field>
                <SimpleGrid columns={2} spacing="16px">
                  <Field label="Latitude">
                    <Input
                      variant="main"
                      type="number"
                      step="any"
                      placeholder="e.g., 5.6037"
                      value={branchForm.latitude}
                      onChange={(e) => setBranchForm({ ...branchForm, latitude: e.target.value })}
                    />
                  </Field>
                  <Field label="Longitude">
                    <Input
                      variant="main"
                      type="number"
                      step="any"
                      placeholder="e.g., -0.1870"
                      value={branchForm.longitude}
                      onChange={(e) => setBranchForm({ ...branchForm, longitude: e.target.value })}
                    />
                  </Field>
                </SimpleGrid>
                <Text fontSize="xs" color="secondaryGray.600">
                  Tip: You can get coordinates from Google Maps by right-clicking on a location
                </Text>
              </>
            )}
          </Stack>
        </Stack>
      </AppModal>

      {/* Consultation Type Dialog */}
      <AppModal
        isOpen={isConsultationTypeDialogOpen}
        onClose={() => setIsConsultationTypeDialogOpen(false)}
        title={editingConsultationType ? 'Edit Consultation Type' : 'Create Consultation Type'}
        description={editingConsultationType ? 'Update consultation type details' : 'Add a new consultation type'}
        footer={
          <>
            <Button variant="light" onClick={() => setIsConsultationTypeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={handleConsultationTypeSubmit}
              isLoading={createConsultationTypeMutation.isPending || updateConsultationTypeMutation.isPending}
            >
              {editingConsultationType ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Name">
            <Input
              variant="main"
              placeholder="e.g., Ophthalmologist, Optometrist"
              value={consultationTypeForm.name}
              onChange={(e) => setConsultationTypeForm({ ...consultationTypeForm, name: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <Input variant="main" value={consultationTypeForm.description} onChange={(e) => setConsultationTypeForm({ ...consultationTypeForm, description: e.target.value })} />
          </Field>
          <SimpleGrid columns={2} spacing="16px">
            {feeInput('initial_fee', 'Initial Visit Fee (GH₵)', 'First time patients')}
            {feeInput('review_fee', 'Review Fee (GH₵)', 'Within 7 days')}
            {feeInput('subsequent_fee', 'Subsequent Fee (GH₵)', 'After 7 days')}
            {feeInput('base_fee', 'Base Fee (GH₵)', 'Default fallback')}
          </SimpleGrid>
        </Stack>
      </AppModal>

      {/* Password Reset Dialog */}
      <AppModal
        isOpen={isPasswordDialogOpen}
        onClose={() => setIsPasswordDialogOpen(false)}
        size="sm"
        title="Reset Password"
        description="Enter a new password for this user"
        footer={
          <>
            <Button variant="light" onClick={() => setIsPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={() => passwordUserId && resetPasswordMutation.mutate({ id: passwordUserId, password: newPassword })}
              isLoading={resetPasswordMutation.isPending}
              isDisabled={newPassword.length < 6}
            >
              Reset Password
            </Button>
          </>
        }
      >
        <Field label="New Password">
          <Input variant="main" type="password" placeholder="Minimum 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
      </AppModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDelete}
        isLoading={deleteUserMutation.isPending || deleteBranchMutation.isPending || deleteConsultationTypeMutation.isPending}
        title={deleteCopy?.title}
        confirmLabel={deleteCopy?.label}
      >
        "{deletingItem?.name}" {deleteCopy?.body}
      </ConfirmDialog>

      {/* VisionCare Member Dialog */}
      <AppModal
        isOpen={isVisionCareMemberDialogOpen}
        onClose={() => setIsVisionCareMemberDialogOpen(false)}
        title="Add VisionCare Member"
        description="Add a new member to the VisionCare plan"
        footer={
          <>
            <Button variant="light" onClick={() => setIsVisionCareMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={() => createVisionCareMemberMutation.mutate(visionCareMemberForm)}
              isLoading={createVisionCareMemberMutation.isPending}
              isDisabled={!visionCareMemberForm.member_id || !visionCareMemberForm.first_name || !visionCareMemberForm.last_name}
            >
              Add Member
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Member ID" isRequired>
            <Input
              variant="main"
              placeholder="e.g., VC-001"
              value={visionCareMemberForm.member_id}
              onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, member_id: e.target.value })}
            />
          </Field>
          <SimpleGrid columns={2} spacing="16px">
            <Field label="First Name" isRequired>
              <Input variant="main" value={visionCareMemberForm.first_name} onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, first_name: e.target.value })} />
            </Field>
            <Field label="Last Name" isRequired>
              <Input variant="main" value={visionCareMemberForm.last_name} onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, last_name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input variant="main" value={visionCareMemberForm.phone} onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input variant="main" type="email" value={visionCareMemberForm.email} onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, email: e.target.value })} />
            </Field>
          </SimpleGrid>
          <Field label="Company/Organization">
            <Input
              variant="main"
              placeholder="e.g., ABC Corporation"
              value={visionCareMemberForm.company}
              onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, company: e.target.value })}
            />
          </Field>
          <Field label="Plan Type">
            <Select variant="main" value={visionCareMemberForm.plan_type} onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, plan_type: e.target.value })}>
              <option value="individual">Individual</option>
              <option value="family">Family</option>
              <option value="corporate">Corporate</option>
            </Select>
          </Field>
        </Stack>
      </AppModal>

      {/* Database Reset Dialog */}
      <AppModal
        isOpen={isResetDialogOpen}
        onClose={() => {
          setResetPassword('')
          setIsResetDialogOpen(false)
        }}
        title={
          <Flex align="center" gap="8px" color="red.500">
            <Icon as={MdWarning} />
            Hard Reset Database
          </Flex>
        }
        footer={
          <>
            <Button
              variant="light"
              onClick={() => {
                setResetPassword('')
                setIsResetDialogOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={() => resetDatabaseMutation.mutate({ password: resetPassword, reseed: resetReseed })}
              isLoading={resetDatabaseMutation.isPending}
              loadingText="Resetting..."
              isDisabled={!resetPassword}
            >
              Confirm Reset
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Text fontWeight="600" color="red.500">
            ⚠️ WARNING: This will permanently delete ALL data including:
          </Text>
          <UnorderedList fontSize="sm" spacing="4px">
            <ListItem>All users and accounts</ListItem>
            <ListItem>All patients and clinical records</ListItem>
            <ListItem>All sales and financial data</ListItem>
            <ListItem>All inventory and stock data</ListItem>
            <ListItem>All messages and notifications</ListItem>
          </UnorderedList>
          <Text fontSize="sm">
            This action <strong>CANNOT</strong> be undone. Enter the system password to confirm.
          </Text>
          <Field label="System Reset Password">
            <Input variant="main" type="password" placeholder="Enter reset password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
          </Field>
          <Checkbox colorScheme="brandScheme" isChecked={resetReseed} onChange={(e) => setResetReseed(e.target.checked)}>
            <Text fontSize="sm">Re-seed with initial data (admin user, roles, categories)</Text>
          </Checkbox>
        </Stack>
      </AppModal>
    </>
  )
}
