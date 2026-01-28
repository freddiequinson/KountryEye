import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, TrendingUp, Megaphone, Target, UserPlus, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'

interface MarketingDashboardProps {
  user: any
}

export function MarketingDashboard({ user }: MarketingDashboardProps) {
  const navigate = useNavigate()
  
  const { data: stats } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => {
      const response = await api.get('/dashboard/overview')
      return response.data
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marketing Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome, {user?.first_name}! Track campaigns and patient growth.
          </p>
        </div>
        <Button onClick={() => navigate('/marketing')}>
          <Megaphone className="mr-2 h-4 w-4" />
          Campaigns
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.patients.total || 0}</div>
            <p className="text-xs text-muted-foreground">registered patients</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New This Month</CardTitle>
            <UserPlus className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.patients.month || 0}</div>
            <p className="text-xs text-muted-foreground">new registrations</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Visits</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.visits.month || 0}</div>
            <p className="text-xs text-muted-foreground">patient visits</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Campaigns</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">running campaigns</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div 
              onClick={() => navigate('/marketing')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <Megaphone className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Campaigns</span>
            </div>
            <div 
              onClick={() => navigate('/patients')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Patient List</span>
            </div>
            <div 
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors opacity-50"
            >
              <BarChart3 className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Analytics</span>
            </div>
            <div 
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors opacity-50"
            >
              <Target className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Leads</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Growth Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Patients</span>
              <span className="font-semibold">{stats?.patients.total || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">New This Month</span>
              <span className="font-semibold text-green-600">+{stats?.patients.month || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Monthly Visits</span>
              <span className="font-semibold">{stats?.visits.month || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Today's Visits</span>
              <span className="font-semibold">{stats?.visits.today || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
