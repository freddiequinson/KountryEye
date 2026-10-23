import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { getUserRole } from '@/config/nav'
import { AdminDashboard } from '@/components/dashboard/AdminDashboard'
import { DoctorDashboard } from '@/components/dashboard/DoctorDashboard'
import { FrontDeskDashboard } from '@/components/dashboard/FrontDeskDashboard'
import { MarketingDashboard } from '@/components/dashboard/MarketingDashboard'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const userRole = getUserRole(user)

  const KNOWN = ['admin', 'doctor', 'optometrist', 'frontdesk', 'front_desk', 'receptionist', 'marketing']
  // Roles without a dashboard here go to their own home page (technician -> /technician, lab -> /lab)
  const home = (user?.role as { default_page?: string } | undefined)?.default_page
  const redirect = userRole === 'technician' ? '/technician'
    : !KNOWN.includes(userRole) && home && !['/', '/dashboard'].includes(home) ? home : null
  useEffect(() => {
    if (redirect) navigate(redirect, { replace: true })
  }, [redirect, navigate])

  // Render role-specific dashboard
  if (userRole === 'admin') return <AdminDashboard user={user} />
  if (['doctor', 'optometrist'].includes(userRole)) return <DoctorDashboard user={user} />
  if (['frontdesk', 'front_desk', 'receptionist'].includes(userRole)) return <FrontDeskDashboard user={user} />
  if (userRole === 'marketing') return <MarketingDashboard user={user} />
  if (redirect) return null // redirecting via useEffect

  // Default: show front desk dashboard for other roles
  return <FrontDeskDashboard user={user} />
}
