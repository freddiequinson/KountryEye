import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Button,
  Flex,
  Icon,
  IconButton,
  Input,
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
import { MdApartment, MdCameraAlt, MdEmail, MdKey, MdPerson, MdSave, MdShield } from 'react-icons/md'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { AppModal, Field } from '@/components/ui'

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const { toast } = useToast()

  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
  })
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => api.put('/users/me', data),
    onSuccess: (response) => {
      if (user) setUser({ ...user, ...response.data })
      toast({ title: 'Profile updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update profile', variant: 'destructive' })
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: (data: any) => api.post('/users/me/change-password', data),
    onSuccess: () => {
      toast({ title: 'Password changed successfully' })
      setIsPasswordDialogOpen(false)
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
    },
    onError: () => {
      toast({ title: 'Failed to change password', variant: 'destructive' })
    },
  })

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.post('/uploads/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (response) => {
      if (user) setUser({ ...user, avatar_url: response.data.url })
      toast({ title: 'Avatar updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to upload avatar', variant: 'destructive' })
    },
  })

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadAvatarMutation.mutate(file)
  }

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate(profileForm)
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast({ title: 'Passwords do not match', variant: 'destructive' })
      return
    }
    if (passwordForm.new_password.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' })
      return
    }
    changePasswordMutation.mutate({ current_password: passwordForm.current_password, new_password: passwordForm.new_password })
  }

  const ringColor = useColorModeValue('white', 'navy.800')
  const dividerColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const roleName = (typeof user?.role === 'object' ? user?.role?.name : user?.role) || 'Staff'

  const accountInfo = [
    { icon: MdEmail, label: 'Email', value: user?.email },
    { icon: MdShield, label: 'Role', value: roleName },
    { icon: MdApartment, label: 'Branch', value: user?.branch?.name || 'Not assigned' },
    { icon: MdPerson, label: 'Account Status', value: user?.is_active ? 'Active' : 'Inactive', color: user?.is_active ? 'green.500' : 'red.500' },
  ]

  return (
    <>
      <PageHeader title="My Profile" description="Manage your account settings and preferences" />

      <Tabs variant="soft-rounded">
        <TabList gap="8px" mb="16px">
          <Tab>Profile</Tab>
          <Tab>Security</Tab>
        </TabList>

        <TabPanels>
          <TabPanel p="0">
            <Stack spacing="20px">
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing="20px">
                {/* Cover banner with the avatar overlapping it */}
                <Card p="0" overflow="hidden">
                  <Box h="110px" bg="linear-gradient(120deg, #0B2415 0%, #14472A 50%, #3E8141 100%)" position="relative" overflow="hidden">
                    <Box position="absolute" inset="0" bgImage="url(/login.jpg)" bgSize="cover" bgPosition="center 25%" opacity={0.35} />
                  </Box>
                  <Flex direction="column" align="center" px="20px" pb="22px" mt="-48px">
                    <Box position="relative">
                      <Avatar w="96px" h="96px" size="xl" src={user?.avatar_url} name={`${user?.first_name || ''} ${user?.last_name || ''}`} bg="brand.600" color="white" border="4px solid" borderColor={ringColor} />
                      <IconButton
                        as="label"
                        htmlFor="avatar-upload"
                        aria-label="Upload avatar"
                        icon={<MdCameraAlt />}
                        variant="brand"
                        size="sm"
                        borderRadius="full"
                        position="absolute"
                        bottom="0"
                        right="-4px"
                        cursor="pointer"
                        isLoading={uploadAvatarMutation.isPending}
                      />
                      <input id="avatar-upload" type="file" accept="image/*" hidden onChange={handleAvatarChange} />
                    </Box>
                    <Text fontWeight="800" fontSize="xl" mt="10px" textAlign="center">
                      {user?.first_name} {user?.last_name}
                    </Text>
                    <Text fontSize="sm" fontWeight="500" color="secondaryGray.600" textTransform="capitalize">
                      {roleName}
                    </Text>
                    <SimpleGrid columns={2} w="100%" mt="18px" pt="16px" borderTop="1px solid" borderColor={dividerColor} textAlign="center">
                      <Box>
                        <Text fontWeight="700" noOfLines={1}>
                          {user?.branch?.name || 'Unassigned'}
                        </Text>
                        <Text fontSize="xs" fontWeight="500" color="secondaryGray.600">
                          Branch
                        </Text>
                      </Box>
                      <Box>
                        <Text fontWeight="700">{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '-'}</Text>
                        <Text fontSize="xs" fontWeight="500" color="secondaryGray.600">
                          Member since
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </Flex>
                </Card>

                <SectionCard title="Personal Information" description="Update your personal details" gridColumn={{ md: 'span 2' }}>
                  <form onSubmit={handleProfileSubmit}>
                    <Stack spacing="16px">
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing="16px">
                        <Field label="First Name">
                          <Input variant="main" value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} />
                        </Field>
                        <Field label="Last Name">
                          <Input variant="main" value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} />
                        </Field>
                      </SimpleGrid>
                      <Field label="Email" helper="Email cannot be changed">
                        <Input variant="main" value={user?.email || ''} isDisabled />
                      </Field>
                      <Field label="Phone Number">
                        <Input variant="main" placeholder="+233 XX XXX XXXX" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                      </Field>
                      <Box>
                        <Button type="submit" variant="brand" leftIcon={<MdSave />} isLoading={updateProfileMutation.isPending}>
                          Save Changes
                        </Button>
                      </Box>
                    </Stack>
                  </form>
                </SectionCard>
              </SimpleGrid>

              <SectionCard title="Account Information">
                <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing="24px">
                  {accountInfo.map((item) => (
                    <Flex key={item.label} align="center" gap="12px">
                      <Icon as={item.icon} w="20px" h="20px" color="secondaryGray.600" />
                      <Box minW="0">
                        <Text fontSize="sm" color="secondaryGray.600">
                          {item.label}
                        </Text>
                        <Text fontWeight="600" color={item.color} noOfLines={1}>
                          {item.value}
                        </Text>
                      </Box>
                    </Flex>
                  ))}
                </SimpleGrid>
              </SectionCard>
            </Stack>
          </TabPanel>

          <TabPanel p="0">
            <Stack spacing="20px">
              <SectionCard title="Password" description="Change your password to keep your account secure">
                <Button variant="brand" leftIcon={<MdKey />} onClick={() => setIsPasswordDialogOpen(true)}>
                  Change Password
                </Button>
              </SectionCard>
              <SectionCard title="Login Activity" description="Recent login information">
                <Text fontWeight="600">Account Created</Text>
                <Text fontSize="sm" color="secondaryGray.600">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </Text>
              </SectionCard>
            </Stack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <AppModal isOpen={isPasswordDialogOpen} onClose={() => setIsPasswordDialogOpen(false)} title="Change Password">
        <form onSubmit={handlePasswordSubmit}>
          <Stack spacing="16px">
            <Field label="Current Password" isRequired>
              <Input variant="main" type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} />
            </Field>
            <Field label="New Password" isRequired>
              <Input variant="main" type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} />
            </Field>
            <Field label="Confirm New Password" isRequired>
              <Input variant="main" type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} />
            </Field>
            <Flex justify="end" gap="8px" pt="8px">
              <Button variant="light" onClick={() => setIsPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="brand" isLoading={changePasswordMutation.isPending}>
                Change Password
              </Button>
            </Flex>
          </Stack>
        </form>
      </AppModal>
    </>
  )
}
