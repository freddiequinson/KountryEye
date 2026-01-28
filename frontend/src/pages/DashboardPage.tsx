import { useAuthStore } from '@/stores/auth'
import { AdminDashboard, FrontDeskDashboard, DoctorDashboard, MarketingDashboard } from '@/components/dashboard'

export default function DashboardPage() {
  const { user } = useAuthStore()

  const getUserRole = (): string => {
    if (user?.is_superuser) return "admin"
    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name
    return roleName?.toLowerCase() || "staff"
  }

  const userRole = getUserRole()

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

  // Default: show front desk dashboard for other roles
  return <FrontDeskDashboard user={user} />
}
