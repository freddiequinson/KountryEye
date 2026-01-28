import { useQuery } from '@tanstack/react-query';
import { Users, Clock, Stethoscope, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function DoctorDashboard() {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['doctor-stats'],
    queryFn: async () => {
      const queueRes = await api.get('/clinical/queue?status=all');
      const queue = queueRes.data;
      return {
        waiting: queue.filter((v: any) => v.status === 'waiting').length,
        inConsultation: queue.filter((v: any) => v.status === 'in_consultation').length,
        completed: queue.filter((v: any) => v.status === 'completed').length,
        total: queue.length,
        queue: queue.filter((v: any) => v.status === 'waiting').slice(0, 5),
      };
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Doctor Dashboard</h1>
          <p className="text-muted-foreground">Patient queue overview</p>
        </div>
        <Button onClick={() => navigate('/doctor/queue')}>View Full Queue</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Waiting</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.waiting || 0}</div>
            <p className="text-xs text-muted-foreground">patients in queue</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Consultation</CardTitle>
            <Stethoscope className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.inConsultation || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <FileText className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.completed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Patients Waiting</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.queue?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No patients waiting</p>
          ) : (
            <div className="space-y-3">
              {stats?.queue?.map((patient: any) => (
                <div key={patient.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium">{patient.patient_name}</span>
                      <div className="text-sm text-muted-foreground">
                        {patient.patient_number} • Waiting {patient.wait_time_minutes} min
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => navigate(`/doctor/consultation/${patient.id}`)}>
                    Start Consultation
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
