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

  // Redirect technician to their dedicated dashboard
  useEffect(() => {
    if (userRole === 'technician') navigate('/technician', { replace: true })
  }, [userRole, navigate])

  // Render role-specific dashboard
  if (userRole === 'admin') return <AdminDashboard user={user} />
  if (['doctor', 'optometrist'].includes(userRole)) return <DoctorDashboard user={user} />
  if (['frontdesk', 'front_desk', 'receptionist'].includes(userRole)) return <FrontDeskDashboard user={user} />
  if (userRole === 'marketing') return <MarketingDashboard user={user} />
  if (userRole === 'technician') return null // redirecting via useEffect

  // Default: show front desk dashboard for other roles
  return <FrontDeskDashboard user={user} />
}
