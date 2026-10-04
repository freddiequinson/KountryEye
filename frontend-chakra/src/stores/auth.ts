import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// "Keep me logged in": checked persists auth in localStorage, unchecked in sessionStorage (cleared on close).
const REMEMBER_KEY = 'kountry-remember'
export const setRememberMe = (remember: boolean) => localStorage.setItem(REMEMBER_KEY, String(remember))
const remembered = () => localStorage.getItem(REMEMBER_KEY) !== 'false'

const authStorage = createJSONStorage(() => ({
  getItem: (name: string) => localStorage.getItem(name) ?? sessionStorage.getItem(name),
  setItem: (name: string, value: string) => {
    const [keep, drop] = remembered() ? [localStorage, sessionStorage] : [sessionStorage, localStorage]
    keep.setItem(name, value)
    drop.removeItem(name)
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name)
    sessionStorage.removeItem(name)
  },
}))

interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  phone?: string
  avatar_url?: string
  role_id: number | null
  role?: { id: number; name: string; default_page?: string } | string
  must_change_password?: boolean
  branch_id: number | null
  branch?: { id: number; name: string }
  is_superuser: boolean
  is_active?: boolean
  permissions?: string[]
  created_at?: string
  last_login?: string
  branch_verification_required?: boolean
  branch_confirmed_at?: string
}

export type { User }

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'kountry-auth',
      storage: authStorage,
    }
  )
)
