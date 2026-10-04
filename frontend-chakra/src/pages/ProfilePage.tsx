import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Badge, Box, Button, Flex, Input, Stack, Text } from '@chakra-ui/react'
import { MdApartment, MdCameraAlt, MdEmail, MdKey, MdPerson, MdSave, MdShield } from 'react-icons/md'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import TabCard from '@/components/card/TabCard'
import { EntityHeader } from '@/components/Person'
import { FormSection } from '@/components/FormSection'
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

  const roleName = (typeof user?.role === 'object' ? user?.role?.name : user?.role) || 'Staff'

  return (
    <>
      <EntityHeader
        name={`${user?.first_name || ''} ${user?.last_name || ''}`}
        subtitle={<Text textTransform="capitalize">{roleName}</Text>}
        avatarSrc={user?.avatar_url}
        badges={<Badge colorScheme={user?.is_active ? 'green' : 'red'}>{user?.is_active ? 'Active' : 'Inactive'}</Badge>}
        actions={
          <>
            <input id="avatar-upload" type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            <Button as="label" htmlFor="avatar-upload" variant="light" cursor="pointer" leftIcon={<MdCameraAlt />} isLoading={uploadAvatarMutation.isPending}>
              Change photo
            </Button>
          </>
        }
        facts={[
          { icon: MdEmail, label: 'Email', value: user?.email },
          { icon: MdShield, label: 'Role', value: <Text textTransform="capitalize">{roleName}</Text> },
          { icon: MdApartment, label: 'Branch', value: user?.branch?.name || 'Not assigned' },
          { icon: MdPerson, label: 'Member since', value: user?.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-' },
        ]}
      />

      <TabCard
        title="My profile"
        tabs={[
          {
            label: 'Personal information',
            icon: MdPerson,
            content: (
              <form onSubmit={handleProfileSubmit}>
                <FormSection title="Your details" description="How your name appears across the system.">
                  <Field label="First Name">
                    <Input variant="main" value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} />
                  </Field>
                  <Field label="Last Name">
                    <Input variant="main" value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} />
                  </Field>
                </FormSection>
                <FormSection title="Contact" description="Email is your sign-in and cannot be changed here.">
                  <Field label="Email">
                    <Input variant="main" value={user?.email || ''} isDisabled />
                  </Field>
                  <Field label="Phone Number">
                    <Input variant="main" placeholder="+233 XX XXX XXXX" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                  </Field>
                </FormSection>
                <Flex justify="end" pt="8px">
                  <Button type="submit" variant="brand" leftIcon={<MdSave />} isLoading={updateProfileMutation.isPending}>
                    Save Changes
                  </Button>
                </Flex>
              </form>
            ),
          },
          {
            label: 'Security',
            icon: MdKey,
            content: (
              <>
                <FormSection title="Password" description="Change your password to keep your account secure." columns={1}>
                  <Box>
                    <Button variant="brand" leftIcon={<MdKey />} onClick={() => setIsPasswordDialogOpen(true)}>
                      Change Password
                    </Button>
                  </Box>
                </FormSection>
                <FormSection title="Login activity" description="Recent account information." columns={1}>
                  <Box>
                    <Text fontWeight="700">Account created</Text>
                    <Text fontSize="sm" color="secondaryGray.600">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </Text>
                  </Box>
                </FormSection>
              </>
            ),
          },
        ]}
      />

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
