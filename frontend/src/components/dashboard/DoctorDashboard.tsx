import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Stethoscope, Clock, Users, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface DoctorDashboardProps {
  user: any
}

export function DoctorDashboard({ user }: DoctorDashboardProps) {
  const navigate = useNavigate()
  
  const { data: queueData } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: async () => {
      const response = await api.get('/clinical/queue?status=all')
      return response.data
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const { data: stats } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => {
      const response = await api.get('/dashboard/overview')
      return response.data
    },
  })

  const waitingPatients = queueData?.filter((v: any) => v.status === 'waiting') || []
  const inProgressPatients = queueData?.filter((v: any) => v.status === 'in_progress') || []
  const completedToday = queueData?.filter((v: any) => v.status === 'completed') || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Doctor Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome, Dr. {user?.last_name}! {waitingPatients.length > 0 
              ? `You have ${waitingPatients.length} patient${waitingPatients.length > 1 ? 's' : ''} waiting.`
              : 'No patients waiting.'}
          </p>
        </div>
        <Button onClick={() => navigate('/doctor/queue')} size="lg">
          <Stethoscope className="mr-2 h-5 w-5" />
          Open Queue ({waitingPatients.length})
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white shadow-sm border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Waiting</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{waitingPatients.length}</div>
            <p className="text-xs text-muted-foreground">patients in queue</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            <Stethoscope className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">{inProgressPatients.length}</div>
            <p className="text-xs text-muted-foreground">current consultation</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{completedToday.length}</div>
            <p className="text-xs text-muted-foreground">consultations done</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.patients.total || 0}</div>
            <p className="text-xs text-muted-foreground">in system</p>
          </CardContent>
        </Card>
      </div>

      {/* Waiting Patients List */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Waiting Patients</CardTitle>
            {waitingPatients.length > 0 && (
              <Badge variant="secondary">{waitingPatients.length} waiting</Badge>
            )}
          </CardHeader>
          <CardContent>
            {waitingPatients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>No patients waiting</p>
              </div>
            ) : (
              <div className="space-y-3">
                {waitingPatients.slice(0, 5).map((visit: any, index: number) => (
                  <div 
                    key={visit.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate('/doctor/queue')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{visit.patient?.first_name} {visit.patient?.last_name}</p>
                        <p className="text-xs text-muted-foreground">{visit.visit_type || 'General'}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      Waiting
                    </Badge>
                  </div>
                ))}
                {waitingPatients.length > 5 && (
                  <Button variant="ghost" className="w-full" onClick={() => navigate('/doctor/queue')}>
                    View all {waitingPatients.length} patients
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div 
              onClick={() => navigate('/doctor/queue')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <Stethoscope className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Patient Queue</span>
            </div>
            <div 
              onClick={() => navigate('/patients')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Find Patient</span>
            </div>
            <div 
              onClick={() => navigate('/patients')}
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors"
            >
              <FileText className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Patient Records</span>
            </div>
            <div 
              className="p-4 border rounded-lg hover:bg-muted/50 text-center cursor-pointer transition-colors opacity-50"
            >
              <AlertCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Reports</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
