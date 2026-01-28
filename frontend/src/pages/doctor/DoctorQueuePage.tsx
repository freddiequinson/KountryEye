import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Clock, User, Eye, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface QueueItem {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_number: string;
  visit_type: string;
  reason: string;
  status: string;
  consultation_type: string;
  wait_time_minutes: number;
  visit_date: string;
}

export default function DoctorQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('active');

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['doctor-queue', statusFilter],
    queryFn: async () => {
      const response = await api.get(`/clinical/queue?status=${statusFilter}`);
      return response.data;
    },
    refetchInterval: 5000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ visitId, status }: { visitId: number; status: string }) =>
      api.patch(`/clinical/visits/${visitId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
    },
  });

  const startConsultation = (item: QueueItem) => {
    updateStatusMutation.mutate({ visitId: item.id, status: 'in_consultation' });
    navigate(`/doctor/consultation/${item.id}`);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
      waiting: 'warning',
      in_consultation: 'default',
      completed: 'success',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status.replace('_', ' ')}</Badge>;
  };

  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-tour="page-title">Patient Queue</h1>
          <p className="text-muted-foreground">Patients waiting for consultation</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active (All)</SelectItem>
            <SelectItem value="waiting">Waiting Only</SelectItem>
            <SelectItem value="in_consultation">In Consultation</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3" data-tour="queue-stats">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Waiting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queue.filter((q: QueueItem) => q.status === 'waiting').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Consultation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queue.filter((q: QueueItem) => q.status === 'in_consultation').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queue.filter((q: QueueItem) => q.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3" data-tour="queue-list">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center">Loading queue...</CardContent>
          </Card>
        ) : queue.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No patients in queue
            </CardContent>
          </Card>
        ) : (
          queue.map((item: QueueItem) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.patient_name}</span>
                        <Badge variant="outline">{item.patient_number}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {item.consultation_type || 'General'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatWaitTime(item.wait_time_minutes)}
                        </span>
                      </div>
                      {item.reason && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Reason: {item.reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(item.status)}
                    {item.status === 'waiting' && (
                      <Button onClick={() => startConsultation(item)}>
                        Start Consultation
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                    {item.status === 'in_consultation' && (
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/doctor/consultation/${item.id}`)}
                      >
                        Continue
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
