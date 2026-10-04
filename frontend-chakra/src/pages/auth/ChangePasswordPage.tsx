import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Alert, AlertIcon, Button, FormLabel, useColorModeValue } from '@chakra-ui/react'
import AuthLayout, { AuthForm } from '@/layouts/auth/AuthLayout'
import PasswordInput from '@/components/fields/PasswordInput'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, token, setAuth } = useAuthStore()
  const textColor = useColorModeValue('navy.700', 'white')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { current_password: string; new_password: string }) => {
      const response = await api.post('/auth/change-password', data)
      return response.data
    },
    onSuccess: async () => {
      toast({ title: 'Password changed successfully' })

      // Refresh user data to update must_change_password flag
      try {
        const userResponse = await api.get('/users/me')
        if (token) setAuth(userResponse.data, token)
      } catch {
        // Ignore error, user will be redirected anyway
      }

      const role = user?.role as { default_page?: string } | undefined
      navigate(role?.default_page || '/dashboard')
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to change password')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) return setError('New password must be at least 6 characters')
    if (newPassword !== confirmPassword) return setError('New passwords do not match')
    if (currentPassword === newPassword) return setError('New password must be different from current password')
    changePasswordMutation.mutate({ current_password: currentPassword, new_password: newPassword })
  }

  const label = (htmlFor: string, text: string) => (
    <FormLabel htmlFor={htmlFor} ms="4px" fontSize="sm" fontWeight="500" color={textColor}>
      {text}
    </FormLabel>
  )

  return (
    <AuthLayout>
      <AuthForm title="Change Your Password" subtitle="For security reasons, you must change your password before continuing.">
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert status="error" borderRadius="16px" mb="24px" fontSize="sm">
              <AlertIcon />
              {error}
            </Alert>
          )}
          {label('currentPassword', 'Current Password')}
          <PasswordInput
            id="currentPassword"
            isRequired
            mb="24px"
            placeholder="Enter current password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          {label('newPassword', 'New Password')}
          <PasswordInput
            id="newPassword"
            isRequired
            mb="24px"
            placeholder="Enter new password (min 6 characters)"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          {label('confirmPassword', 'Confirm New Password')}
          <PasswordInput
            id="confirmPassword"
            isRequired
            mb="24px"
            placeholder="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button
            type="submit"
            variant="brand"
            fontSize="sm"
            fontWeight="500"
            w="100%"
            h="50"
            isLoading={changePasswordMutation.isPending}
            loadingText="Changing Password..."
          >
            Change Password
          </Button>
        </form>
      </AuthForm>
    </AuthLayout>
  )
}
