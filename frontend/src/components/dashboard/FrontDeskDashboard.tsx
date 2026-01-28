import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, ClipboardList, Clock, UserPlus, ShoppingCart, Receipt } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'

interface FrontDeskDashboardProps {
  user: any
}

export function FrontDeskDashboard({ user }: FrontDeskDashboardProps) {
  const navigate = useNavigate()
  
  const { data: stats } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => {
      const response = await api.get('/dashboard/overview')
      return response.data
    },
  })

  const { data: queueData } = useQuery({
    queryKey: ['doctor-queue-summary'],
    queryFn: async () => {
      const response = await api.get('/clinical/queue?status=all')
      return response.data
    },
  })

  const waitingCount = queueData?.filter((v: any) => v.status === 'waiting').length || 0
  const inProgressCount = queueData?.filter((v: any) => v.status === 'in_progress').length || 0

  const formatCurrency = (amount: number) =>
    `GH₵${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Front Desk</h1>
          <p className="text-muted-foreground">
            Welcome, {user?.first_name}! Manage patient visits and registrations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/frontdesk')}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Check-in Patient
          </Button>
          <Button onClick={() => navigate('/frontdesk/register')}>
            <UserPlus className="mr-2 h-4 w-4" />
            New Patient
          </Button>
        </div>
      </div>

      {/* Key Metrics for Front Desk */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Check-ins</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.visits.today || 0}</div>
            <p className="text-xs text-muted-foreground">patients checked in today</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Waiting for Doctor</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{waitingCount}</div>
            <p className="text-xs text-muted-foreground">{inProgressCount} in consultation</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Sales</CardTitle>
            <Receipt className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats?.sales.today || 0)}
            </div>
            <p className="text-xs text-muted-foreground">total revenue today</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.patients.total || 0}</div>
            <p className="text-xs text-muted-foreground">+{stats?.patients.month || 0} this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div 
              onClick={() => navigate('/frontdesk/register')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <UserPlus className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Register Patient</span>
            </div>
            <div 
              onClick={() => navigate('/frontdesk')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <ClipboardList className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Check-in Visit</span>
            </div>
            <div 
              onClick={() => navigate('/sales/pos')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <ShoppingCart className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Point of Sale</span>
            </div>
            <div 
              onClick={() => navigate('/patients')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Find Patient</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today's Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Patients Checked In</span>
              <span className="font-semibold">{stats?.visits.today || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Waiting for Doctor</span>
              <span className="font-semibold text-orange-500">{waitingCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">In Consultation</span>
              <span className="font-semibold">{inProgressCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Sales Today</span>
              <span className="font-semibold text-green-600">{formatCurrency(stats?.sales.today || 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
