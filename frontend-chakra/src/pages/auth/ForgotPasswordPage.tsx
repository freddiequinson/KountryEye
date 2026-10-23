import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Alert, AlertIcon, Button, FormLabel, Input, Text, useColorModeValue } from '@chakra-ui/react'
import AuthLayout, { AuthForm } from '@/layouts/auth/AuthLayout'
import api from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const textColor = useColorModeValue('navy.700', 'white')
  const textColorBrand = useColorModeValue('brand.500', 'white')

  const mutation = useMutation({
    mutationFn: (email: string) => api.post('/auth/forgot-password', { email }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(email)
  }

  return (
    <AuthLayout>
      <AuthForm title="Forgot Password" subtitle="Enter your account email and we will send you a reset link">
        {mutation.isSuccess ? (
          <Alert status="success" borderRadius="16px" mb="24px" fontSize="sm">
            <AlertIcon />
            If an account exists for {email}, a password reset link has been sent. The link expires in 30 minutes.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            {mutation.isError && (
              <Alert status="error" borderRadius="16px" mb="24px" fontSize="sm">
                <AlertIcon />
                {(mutation.error as any)?.response?.data?.detail ||
                  'Could not send the reset email. Please try again or contact your administrator.'}
              </Alert>
            )}
            <FormLabel htmlFor="email" ms="4px" fontSize="sm" fontWeight="500" color={textColor} mb="8px">
              Email
            </FormLabel>
            <Input
              id="email"
              type="email"
              isRequired
              variant="auth"
              fontSize="sm"
              size="lg"
              mb="24px"
              placeholder="you@kountryeyecare.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" variant="brand" fontSize="sm" fontWeight="500" w="100%" h="50" mb="24px" isLoading={mutation.isPending}>
              Send Reset Link
            </Button>
          </form>
        )}
        <NavLink to="/login">
          <Text color={textColorBrand} fontSize="sm" fontWeight="500">
            Back to sign in
          </Text>
        </NavLink>
      </AuthForm>
    </AuthLayout>
  )
}
