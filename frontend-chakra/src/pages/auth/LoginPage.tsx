import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  Alert,
  AlertIcon,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import AuthLayout, { AuthForm } from '@/layouts/auth/AuthLayout'
import PasswordInput from '@/components/fields/PasswordInput'
import { setRememberMe, useAuthStore } from '@/stores/auth'
import api from '@/lib/api'
import { activityLogger } from '@/lib/activityLogger'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')

  const textColor = useColorModeValue('navy.700', 'white')
  const textColorBrand = useColorModeValue('brand.500', 'white')
  const brandStars = useColorModeValue('brand.500', 'brand.400')

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const formData = new URLSearchParams()
      formData.append('username', credentials.username)
      formData.append('password', credentials.password)

      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      return response.data
    },
    onSuccess: async (data) => {
      const userResponse = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      setRememberMe(remember)
      setAuth(userResponse.data, data.access_token)

      activityLogger.login()

      // Check if user must change password (strictly enforced)
      if (data.must_change_password || userResponse.data.must_change_password) {
        navigate('/change-password')
        return
      }

      // Redirect based on role's default page
      navigate(userResponse.data.role?.default_page || '/dashboard')
    },
    onError: () => {
      setError('Invalid email/username or password')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    loginMutation.mutate({ username, password })
  }

  return (
    <AuthLayout>
      <AuthForm title="Sign In" subtitle="Enter your credentials to access your account">
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert status="error" borderRadius="16px" mb="24px" fontSize="sm">
              <AlertIcon />
              {error}
            </Alert>
          )}
          <FormLabel htmlFor="username" display="flex" ms="4px" fontSize="sm" fontWeight="500" color={textColor} mb="8px">
            Email or Username<Text color={brandStars}>*</Text>
          </FormLabel>
          <Input
            id="username"
            isRequired
            variant="auth"
            fontSize="sm"
            placeholder="you@kountryeyecare.com"
            mb="24px"
            fontWeight="500"
            size="lg"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <FormLabel htmlFor="password" ms="4px" fontSize="sm" fontWeight="500" color={textColor} display="flex">
            Password<Text color={brandStars}>*</Text>
          </FormLabel>
          <PasswordInput
            id="password"
            isRequired
            placeholder="••••••••"
            mb="24px"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Flex justifyContent="space-between" align="center" mb="24px">
            <FormControl display="flex" alignItems="center">
              <Checkbox
                id="remember-login"
                colorScheme="brandScheme"
                me="10px"
                isChecked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <FormLabel htmlFor="remember-login" mb="0" fontWeight="normal" color={textColor} fontSize="sm">
                Keep me logged in
              </FormLabel>
            </FormControl>
            <NavLink to="/forgot-password">
              <Text color={textColorBrand} fontSize="sm" w="124px" fontWeight="500">
                Forgot password?
              </Text>
            </NavLink>
          </Flex>
          <Button
            type="submit"
            fontSize="sm"
            variant="brand"
            size="lg"
            w="100%"
            mb="24px"
            isLoading={loginMutation.isPending}
            loadingText="Signing in..."
          >
            Sign In
          </Button>
        </form>
        <Text color="secondaryGray.500" fontSize="xs" fontWeight="500" textAlign="center">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </AuthForm>
    </AuthLayout>
  )
}
