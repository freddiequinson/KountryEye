import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, KeyRound, BarChart3, ListTodo, Activity, 
  Calendar, Mail, Phone, Building2, Shield, ChevronLeft, ChevronRight
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface Task {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  created_at?: string;
}

interface ActivityLog {
  id: number;
  action: string;
  module?: string;
  description?: string;
  page_path?: string;
  created_at: string;
}

interface Attendance {
  id: number;
  date: string;
  clock_in?: string;
  clock_out?: string;
  status: string;
  notes?: string;
}

export default function EmployeeDetailPage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [statsPeriod, setStatsPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
  });

  // Queries
  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: async () => {
      const response = await api.get(`/employees/${employeeId}`);
      return response.data;
    },
  });

  const getStatsDates = () => {
    const today = new Date();
    let startDate: string;
    let endDate = today.toISOString().split('T')[0];
    
    switch (statsPeriod) {
      case 'today':
        startDate = endDate;
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setDate(today.getDate() - 30);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      case 'all':
      default:
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);
        startDate = yearAgo.toISOString().split('T')[0];
        break;
    }
    return { startDate, endDate };
  };

  const { data: stats } = useQuery({
    queryKey: ['employee-stats', employeeId, statsPeriod],
    queryFn: async () => {
      const { startDate, endDate } = getStatsDates();
      const response = await api.get(`/employees/${employeeId}/stats?start_date=${startDate}&end_date=${endDate}`);
      return response.data;
    },
    enabled: !!employeeId,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['employee-attendance', employeeId],
    queryFn: async () => {
      const response = await api.get(`/employees/${employeeId}/attendance`);
      return response.data;
    },
    enabled: !!employeeId,
  });

  const { data: activityData } = useQuery({
    queryKey: ['employee-activity', employeeId],
    queryFn: async () => {
      const response = await api.get(`/employees/${employeeId}/activity?limit=100`);
      return response.data;
    },
    enabled: !!employeeId,
    staleTime: 0, // Always refetch to get latest activities
  });
  
  const activity = activityData?.items || activityData || [];

  const { data: tasks = [] } = useQuery({
    queryKey: ['employee-tasks', employeeId],
    queryFn: async () => {
      const response = await api.get(`/employees/tasks?assigned_to_id=${employeeId}`);
      return response.data;
    },
    enabled: !!employeeId,
  });

  // Branch assignment history
  const { data: branchHistory = [] } = useQuery({
    queryKey: ['employee-branch-history', employeeId],
    queryFn: async () => {
      const response = await api.get(`/branch-assignments/users/${employeeId}/branch-history`);
      return response.data;
    },
    enabled: !!employeeId,
  });

  // Mutations
  const resetPasswordMutation = useMutation({
    mutationFn: () => api.post(`/employees/${employeeId}/reset-password`),
    onSuccess: (response) => {
      toast({ title: 'Password reset', description: response.data.message });
    },
    onError: () => {
      toast({ title: 'Failed to reset password', variant: 'destructive' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => api.delete(`/employees/${employeeId}`),
    onSuccess: () => {
      toast({ title: 'Employee deactivated' });
      navigate('/admin/employees');
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => api.post('/employees/tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-tasks', employeeId] });
      setIsAddTaskOpen(false);
      setTaskForm({ title: '', description: '', priority: 'medium', due_date: '' });
      toast({ title: 'Task assigned' });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/employees/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-tasks', employeeId] });
    },
  });

  const handleCreateTask = () => {
    createTaskMutation.mutate({
      title: taskForm.title,
      description: taskForm.description || null,
      assigned_to_id: parseInt(employeeId!),
      priority: taskForm.priority,
      due_date: taskForm.due_date || null,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      in_progress: 'default',
      completed: 'outline',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      low: 'outline',
      medium: 'secondary',
      high: 'default',
      urgent: 'destructive',
    };
    return <Badge variant={variants[priority] || 'secondary'}>{priority}</Badge>;
  };

  // Generate calendar days for attendance view
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const days = [];
    const currentDay = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }
    return days;
  }, [calendarDate]);

  const getAttendanceForDate = (date: Date) => {
    return attendance.find((record: Attendance) => {
      const recordDate = new Date(record.date);
      return (
        recordDate.getDate() === date.getDate() &&
        recordDate.getMonth() === date.getMonth() &&
        recordDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getAttendanceStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      present: 'bg-green-500',
      absent: 'bg-red-500',
      late: 'bg-yellow-500',
      half_day: 'bg-orange-500',
      on_leave: 'bg-blue-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!employee) {
    return <div className="flex items-center justify-center h-64">Employee not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/employees')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{employee.first_name} {employee.last_name}</h1>
          <p className="text-muted-foreground">{employee.role?.name || 'No role'} • {employee.branch?.name || 'No branch'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => resetPasswordMutation.mutate()}>
            <KeyRound className="mr-2 h-4 w-4" />
            Reset Password
          </Button>
          <Button variant="destructive" onClick={() => deactivateMutation.mutate()}>
            Deactivate
          </Button>
        </div>
      </div>

      {/* Employee Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{employee.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{employee.phone || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium">{employee.role?.name || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Branch</p>
                <p className="font-medium">{employee.branch?.name || '-'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Performance Stats</h3>
          <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
            <Button
              variant={statsPeriod === 'today' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatsPeriod('today')}
              className="h-7 text-xs"
            >
              Today
            </Button>
            <Button
              variant={statsPeriod === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatsPeriod('week')}
              className="h-7 text-xs"
            >
              Week
            </Button>
            <Button
              variant={statsPeriod === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatsPeriod('month')}
              className="h-7 text-xs"
            >
              Month
            </Button>
            <Button
              variant={statsPeriod === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatsPeriod('all')}
              className="h-7 text-xs"
            >
              All Time
            </Button>
          </div>
        </div>
        {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sales Made</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sales?.count || 0}</div>
              <p className="text-xs text-muted-foreground">
                GH₵ {(stats.sales?.amount || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Consultations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.consultations || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Visits Added</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.visits_added || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Prescriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.prescriptions || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Days Present</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.attendance?.present_days || 0}</div>
              <p className="text-xs text-muted-foreground">
                Late: {stats.attendance?.late_days || 0} | Absent: {stats.attendance?.absent_days || 0}
              </p>
            </CardContent>
          </Card>
        </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <Calendar className="mr-2 h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="mr-2 h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ListTodo className="mr-2 h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="branch-history">
            <Building2 className="mr-2 h-4 w-4" />
            Branch History
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {activity.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No recent activity</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {activity.slice(0, 10).map((log: ActivityLog) => (
                      <div key={log.id} className="flex justify-between items-start border-b pb-2">
                        <div>
                          <p className="text-sm font-medium">{log.action}</p>
                          <p className="text-xs text-muted-foreground">{log.module || 'system'}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Attendance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                {attendance.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No attendance records</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {attendance.slice(0, 10).map((record: Attendance) => (
                      <div key={record.id} className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${getAttendanceStatusColor(record.status)}`} />
                          <span className="text-sm">{new Date(record.date).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {record.clock_in ? new Date(record.clock_in).toLocaleTimeString() : '-'} 
                          {' → '}
                          {record.clock_out ? new Date(record.clock_out).toLocaleTimeString() : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pending Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Assigned Tasks</CardTitle>
              <Button size="sm" onClick={() => setIsAddTaskOpen(true)}>
                Assign Task
              </Button>
            </CardHeader>
            <CardContent>
              {tasks.filter((t: Task) => t.status !== 'completed').length === 0 ? (
                <p className="text-muted-foreground text-sm">No pending tasks</p>
              ) : (
                <div className="space-y-2">
                  {tasks.filter((t: Task) => t.status !== 'completed').slice(0, 5).map((task: Task) => (
                    <div key={task.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        {task.due_date && (
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {getPriorityBadge(task.priority)}
                        {getStatusBadge(task.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          {/* Attendance Calendar */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Attendance Calendar</CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium min-w-32 text-center">
                  {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCalendarDate(new Date())}
                >
                  Today
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 border-b mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  const attendanceRecord = getAttendanceForDate(day);
                  const isCurrentMonth = day.getMonth() === calendarDate.getMonth();
                  const isToday = day.toDateString() === new Date().toDateString();
                  const isPastWorkday = day < new Date() && day.getDay() !== 0 && day.getDay() !== 6; // Mon-Fri, before today
                  const showAbsent = isPastWorkday && !attendanceRecord && isCurrentMonth && !isToday;
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-16 border-b border-r p-2 ${!isCurrentMonth ? 'bg-muted/30' : ''}`}
                    >
                      <div className={`text-sm mb-1 ${isToday ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>
                        {day.getDate()}
                      </div>
                      {attendanceRecord && (
                        <div className={`text-xs px-1.5 py-0.5 rounded text-white ${getAttendanceStatusColor(attendanceRecord.status)}`}>
                          {attendanceRecord.status}
                        </div>
                      )}
                      {showAbsent && (
                        <div className="text-xs px-1.5 py-0.5 rounded text-white bg-red-500">
                          absent
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-green-500" />
                  <span>Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-yellow-500" />
                  <span>Late</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-red-500" />
                  <span>Absent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-blue-500" />
                  <span>On Leave</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        No attendance records
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendance.map((record: Attendance) => (
                      <TableRow key={record.id}>
                        <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {record.clock_in ? new Date(record.clock_in).toLocaleTimeString() : '-'}
                        </TableCell>
                        <TableCell>
                          {record.clock_out ? new Date(record.clock_out).toLocaleTimeString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={record.status === 'present' ? 'default' : 'secondary'}
                            className={record.status === 'present' ? 'bg-green-500' : ''}
                          >
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{record.notes || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        No activity recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    activity.map((log: ActivityLog) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.action}</TableCell>
                        <TableCell>{log.module || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{log.page_path || '-'}</TableCell>
                        <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsAddTaskOpen(true)}>
              <ListTodo className="mr-2 h-4 w-4" />
              Assign New Task
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        No tasks assigned
                      </TableCell>
                    </TableRow>
                  ) : (
                    tasks.map((task: Task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{task.title}</p>
                            {task.description && (
                              <p className="text-sm text-muted-foreground truncate max-w-xs">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                        <TableCell>
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell>
                          <Select
                            value={task.status}
                            onValueChange={(value) => updateTaskMutation.mutate({ id: task.id, data: { status: value } })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branch History Tab */}
        <TabsContent value="branch-history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Branch Assignment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {branchHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No branch assignment history available
                </p>
              ) : (
                <div className="relative">
                  {/* Timeline */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  
                  <div className="space-y-6">
                    {branchHistory.map((assignment: any, index: number) => (
                      <div key={assignment.id} className="relative pl-10">
                        {/* Timeline dot */}
                        <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                          assignment.is_current 
                            ? 'bg-primary border-primary' 
                            : 'bg-background border-muted-foreground'
                        }`} />
                        
                        <div className={`p-4 rounded-lg border ${
                          assignment.is_current ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                        }`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-primary" />
                              <span className="font-semibold">{assignment.branch_name}</span>
                              {assignment.is_current && (
                                <Badge variant="default" className="text-xs">Current</Badge>
                              )}
                            </div>
                            <div className="text-right text-sm text-muted-foreground">
                              {assignment.effective_from && (
                                <span>
                                  {new Date(assignment.effective_from).toLocaleDateString()}
                                  {assignment.effective_until && (
                                    <> - {new Date(assignment.effective_until).toLocaleDateString()}</>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>
                              <strong>Assigned by:</strong> {assignment.assigned_by_name}
                            </p>
                            <p>
                              <strong>Assigned on:</strong>{' '}
                              {assignment.assigned_at 
                                ? new Date(assignment.assigned_at).toLocaleString() 
                                : 'N/A'}
                            </p>
                            {assignment.notes && (
                              <p>
                                <strong>Notes:</strong> {assignment.notes}
                              </p>
                            )}
                          </div>
                          
                          {/* Verification status */}
                          <div className="mt-3 pt-3 border-t">
                            {assignment.verified ? (
                              <div className="flex items-center gap-2 text-sm text-green-600">
                                <Badge variant="success" className="text-xs">Verified</Badge>
                                <span>
                                  on {assignment.verified_at 
                                    ? new Date(assignment.verified_at).toLocaleString() 
                                    : 'N/A'}
                                </span>
                              </div>
                            ) : assignment.verification_note?.startsWith('ISSUE REPORTED:') ? (
                              <div className="text-sm">
                                <Badge variant="destructive" className="text-xs">Issue Reported</Badge>
                                <p className="mt-1 text-red-600">
                                  {assignment.verification_note.replace('ISSUE REPORTED: ', '')}
                                </p>
                              </div>
                            ) : assignment.is_current ? (
                              <Badge variant="warning" className="text-xs">Pending Verification</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Not Verified</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Task Dialog */}
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task to {employee.first_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Task title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Task description..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(value) => setTaskForm({ ...taskForm, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={taskForm.due_date}
                  onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTaskOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTask} disabled={!taskForm.title}>
              Assign Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
