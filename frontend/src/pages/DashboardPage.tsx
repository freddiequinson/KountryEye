import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { AdminDashboard, FrontDeskDashboard, DoctorDashboard, MarketingDashboard } from '@/components/dashboard'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const getUserRole = (): string => {
    if (user?.is_superuser) return "admin"
    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name
    return roleName?.toLowerCase() || "staff"
  }

  const userRole = getUserRole()

  // Redirect technician to their dedicated dashboard
  useEffect(() => {
    if (userRole === "technician") {
      navigate('/technician', { replace: true })
    }
  }, [userRole, navigate])

  // Render role-specific dashboard
  if (userRole === "admin") {
    return <AdminDashboard user={user} />
  }

  if (["doctor", "optometrist"].includes(userRole)) {
    return <DoctorDashboard user={user} />
  }

  if (["frontdesk", "front_desk", "receptionist"].includes(userRole)) {
    return <FrontDeskDashboard user={user} />
  }

  if (userRole === "marketing") {
    return <MarketingDashboard user={user} />
  }

  if (userRole === "technician") {
    // Will redirect via useEffect, show nothing while redirecting
    return null
  }

  // Default: show front desk dashboard for other roles
  return <FrontDeskDashboard user={user} />
}
