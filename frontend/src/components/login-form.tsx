"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuthStore } from "@/stores/auth"
import api from "@/lib/api"
import { activityLogger } from "@/lib/activityLogger"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const formData = new URLSearchParams()
      formData.append("username", credentials.username)
      formData.append("password", credentials.password)

      const response = await api.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
      return response.data
    },
    onSuccess: async (data) => {
      localStorage.setItem("token", data.access_token)
      const userResponse = await api.get("/users/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      console.log('Login user data:', userResponse.data)
      console.log('User permissions:', userResponse.data.permissions)
      setAuth(userResponse.data, data.access_token)
      
      // Log login activity
      activityLogger.login()
      
      // Redirect based on role's default page
      const defaultPage = userResponse.data.role?.default_page || "/dashboard"
      navigate(defaultPage)
    },
    onError: () => {
      setError("Invalid email/username or password")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    loginMutation.mutate({ username, password })
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your credentials to access your account
        </p>
      </div>
      <div className="grid gap-6">
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}
        <div className="grid gap-3">
          <Label htmlFor="username">Email or Username</Label>
          <Input
            id="username"
            type="text"
            placeholder="you@kountryeyecare.com"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline text-primary"
            >
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? "Signing in..." : "Sign in"}
        </Button>
      </div>
      <div className="text-muted-foreground text-center text-xs text-balance">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </div>
    </form>
  )
}
