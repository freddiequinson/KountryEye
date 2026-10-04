import { useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Alert, AlertIcon, Button, FormLabel, Text, useColorModeValue } from '@chakra-ui/react'
import AuthLayout, { AuthForm } from '@/layouts/auth/AuthLayout'
import PasswordInput from '@/components/fields/PasswordInput'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const textColor = useColorModeValue('navy.700', 'white')
  const textColorBrand = useColorModeValue('brand.500', 'white')

  const mutation = useMutation({
    mutationFn: () => api.post('/auth/reset-password', { token, new_password: newPassword }),
    onSuccess: () => {
      toast({ title: 'Password reset. Please sign in.' })
      navigate('/login')
    },
    onError: (err: any) => setError(err.response?.data?.detail || 'Failed to reset password'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) return setError('New password must be at least 6 characters')
    if (newPassword !== confirmPassword) return setError('Passwords do not match')
    mutation.mutate()
  }

  return (
    <AuthLayout>
      <AuthForm title="Reset Password" subtitle="Choose a new password for your account">
        {!token ? (
          <Alert status="error" borderRadius="16px" mb="24px" fontSize="sm">
            <AlertIcon />
            This reset link is invalid. Request a new one.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <Alert status="error" borderRadius="16px" mb="24px" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}
            <FormLabel htmlFor="newPassword" ms="4px" fontSize="sm" fontWeight="500" color={textColor}>
              New Password
            </FormLabel>
            <PasswordInput
              id="newPassword"
              isRequired
              mb="24px"
              placeholder="Min. 6 characters"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <FormLabel htmlFor="confirmPassword" ms="4px" fontSize="sm" fontWeight="500" color={textColor}>
              Confirm New Password
            </FormLabel>
            <PasswordInput
              id="confirmPassword"
              isRequired
              mb="24px"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button type="submit" variant="brand" fontSize="sm" fontWeight="500" w="100%" h="50" mb="24px" isLoading={mutation.isPending}>
              Reset Password
            </Button>
          </form>
        )}
        <NavLink to={token ? '/login' : '/forgot-password'}>
          <Text color={textColorBrand} fontSize="sm" fontWeight="500">
            {token ? 'Back to sign in' : 'Request a new link'}
          </Text>
        </NavLink>
      </AuthForm>
    </AuthLayout>
  )
}
