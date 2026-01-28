import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Calendar, DollarSign, Clock, TrendingUp, Package, Building2, UserCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { DashboardStats } from '@/types'
import { Button } from '@/components/ui/button'

interface AdminDashboardProps {
  user: any
}

export function AdminDashboard({ user }: AdminDashboardProps) {
  const navigate = useNavigate()
  
  const { data: stats } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => {
      const response = await api.get('/dashboard/overview')
      return response.data as DashboardStats
    },
  })

  const formatCurrency = (amount: number) =>
    `GH₵${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-tour="page-title">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.first_name}! Here's your business overview.
          </p>
        </div>
        <Button onClick={() => navigate('/admin/revenue')}>
          <TrendingUp className="mr-2 h-4 w-4" />
          View Reports
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" data-tour="stats-cards">
        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.patients.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{stats?.patients.month || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats?.sales.today || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats?.sales.month || 0)} this month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Visits</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.visits.today || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.visits.month || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Consultations</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending_consultations || 0}</div>
            <p className="text-xs text-muted-foreground">awaiting doctor</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-tour="quick-actions">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div 
              onClick={() => navigate('/admin/employees')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <UserCheck className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm">Employees</span>
            </div>
            <div 
              onClick={() => navigate('/admin/branches')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <Building2 className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm">Branches</span>
            </div>
            <div 
              onClick={() => navigate('/inventory')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <Package className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm">Inventory</span>
            </div>
            <div 
              onClick={() => navigate('/accounting')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm">Accounting</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Business Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Patients</span>
              <span className="font-semibold">{stats?.patients.total || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Monthly Revenue</span>
              <span className="font-semibold text-green-600">{formatCurrency(stats?.sales.month || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Monthly Visits</span>
              <span className="font-semibold">{stats?.visits.month || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">New Patients (Month)</span>
              <span className="font-semibold">{stats?.patients.month || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Backend API</span>
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Connected</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Database</span>
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Online</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Active Sessions</span>
              <span className="font-medium">1</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
