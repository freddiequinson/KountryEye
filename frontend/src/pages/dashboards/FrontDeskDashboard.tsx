import { useQuery } from '@tanstack/react-query';
import { Users, Clock, CreditCard, CheckCircle, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function FrontDeskDashboard() {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['frontdesk-stats'],
    queryFn: async () => {
      const [visitsRes, prescriptionsRes, registrationsRes] = await Promise.all([
        api.get('/patients/visits/today'),
        api.get('/clinical/prescriptions/pending'),
        api.get('/patients/pending-registrations'),
      ]);
      return {
        todayVisits: visitsRes.data.length,
        waiting: visitsRes.data.filter((v: any) => v.status === 'waiting').length,
        inConsultation: visitsRes.data.filter((v: any) => v.status === 'in_consultation').length,
        completed: visitsRes.data.filter((v: any) => v.status === 'completed').length,
        pendingPayments: prescriptionsRes.data.length,
        pendingRegistrations: registrationsRes.data.length,
        recentVisits: visitsRes.data.slice(0, 5),
        pendingPrescriptions: prescriptionsRes.data.slice(0, 5),
      };
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Front Desk Dashboard</h1>
          <p className="text-muted-foreground">Today's overview</p>
        </div>
        <Button onClick={() => navigate('/frontdesk')}>Go to Front Desk</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Visits</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayVisits || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Waiting</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.waiting || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completed || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.pendingPayments || 0}</div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover:shadow-md transition-shadow ${stats?.pendingRegistrations > 0 ? "border-blue-500" : ""}`}
          onClick={() => navigate('/frontdesk?tab=registrations')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New Registrations</CardTitle>
            <UserPlus className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.pendingRegistrations || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Click to review</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Visits</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentVisits?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No visits today</p>
            ) : (
              <div className="space-y-3">
                {stats?.recentVisits?.map((visit: any) => (
                  <div key={visit.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <span className="font-medium">{visit.patient_name}</span>
                      <span className="text-sm text-muted-foreground ml-2">{visit.patient_number}</span>
                    </div>
                    <Badge variant={visit.status === 'completed' ? 'success' : visit.status === 'waiting' ? 'warning' : 'default'}>
                      {visit.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.pendingPrescriptions?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No pending payments</p>
            ) : (
              <div className="space-y-3">
                {stats?.pendingPrescriptions?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <span className="font-medium">{p.patient_name}</span>
                      <span className="text-sm text-muted-foreground ml-2">GH₵{p.total_amount?.toLocaleString()}</span>
                    </div>
                    <Button size="sm" onClick={() => navigate('/frontdesk')}>Process</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
