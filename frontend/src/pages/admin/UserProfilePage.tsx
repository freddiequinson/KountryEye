import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  Mail,
  Phone,
  Building2,
  Shield,
  Calendar,
  Clock,
  Activity,
  DollarSign,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [statsPeriod, setStatsPeriod] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch user profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const response = await api.get(`/user-profile/${userId}`);
      return response.data;
    },
    enabled: !!userId,
  });

  // Fetch user stats
  const { data: stats } = useQuery({
    queryKey: ['user-stats', userId, statsPeriod],
    queryFn: async () => {
      const response = await api.get(`/user-profile/${userId}/stats?period=${statsPeriod}`);
      return response.data;
    },
    enabled: !!userId,
  });

  // Fetch attendance
  const { data: attendance } = useQuery({
    queryKey: ['user-attendance', userId],
    queryFn: async () => {
      const response = await api.get(`/user-profile/${userId}/attendance`);
      return response.data;
    },
    enabled: !!userId && activeTab === 'attendance',
  });

  // Fetch activity logs
  const { data: activities } = useQuery({
    queryKey: ['user-activity', userId],
    queryFn: async () => {
      const response = await api.get(`/user-profile/${userId}/activity`);
      return response.data;
    },
    enabled: !!userId && activeTab === 'activity',
  });

  // Fetch fund requests
  const { data: fundRequests } = useQuery({
    queryKey: ['user-fund-requests', userId],
    queryFn: async () => {
      const response = await api.get(`/user-profile/${userId}/fund-requests`);
      return response.data;
    },
    enabled: !!userId && activeTab === 'fund-requests',
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'late': return 'bg-yellow-100 text-yellow-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'on_leave': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">User not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-2xl">
                {getInitials(profile.first_name, profile.last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">
                  {profile.first_name} {profile.last_name}
                </h1>
                <Badge variant={profile.is_active ? 'default' : 'secondary'}>
                  {profile.is_active ? 'Active' : 'Inactive'}
                </Badge>
                {profile.is_superuser && (
                  <Badge variant="destructive">Superuser</Badge>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {profile.email}
                </div>
                {profile.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {profile.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  {profile.role_name || 'No Role'}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  {profile.branch_name || 'No Branch'}
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                <span>Joined: {profile.created_at ? formatDate(profile.created_at) : 'N/A'}</span>
                {profile.last_login && (
                  <span className="ml-4">Last login: {formatDateTime(profile.last_login)}</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Performance Overview</h2>
        <Select value={statsPeriod} onValueChange={setStatsPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Visits Recorded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.visits_recorded || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.sales?.count || 0}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats?.sales?.amount || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Consultations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.consultations || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prescriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.prescriptions || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Memos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.fund_requests?.count || 0}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats?.fund_requests?.amount || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.attendance?.present || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.attendance?.late || 0} late, {stats?.attendance?.absent || 0} absent
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed info */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="fund-requests">Memos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Summary</CardTitle>
              <CardDescription>Overview of user's recent activity and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Attendance Rate</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width: `${stats?.attendance?.total_days ? (stats.attendance.present / stats.attendance.total_days) * 100 : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {stats?.attendance?.total_days ? Math.round((stats.attendance.present / stats.attendance.total_days) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Role & Access</h4>
                  <p className="text-sm text-muted-foreground">
                    {profile.role_name || 'No role assigned'} at {profile.branch_name || 'No branch'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>
                {attendance?.period?.start_date && attendance?.period?.end_date && (
                  <span>
                    {formatDate(attendance.period.start_date)} - {formatDate(attendance.period.end_date)}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attendance?.summary && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{attendance.summary.total_days}</div>
                    <div className="text-xs text-muted-foreground">Total Days</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{attendance.summary.present}</div>
                    <div className="text-xs text-muted-foreground">Present</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{attendance.summary.late}</div>
                    <div className="text-xs text-muted-foreground">Late</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{attendance.summary.absent}</div>
                    <div className="text-xs text-muted-foreground">Absent</div>
                  </div>
                </div>
              )}
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance?.records?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No attendance records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendance?.records?.map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell>{formatDate(record.date)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(record.status)}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.clock_in ? formatDateTime(record.clock_in) : '-'}
                        </TableCell>
                        <TableCell>
                          {record.clock_out ? formatDateTime(record.clock_out) : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Recent actions performed by this user</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No activity logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    activities?.map((activity: any) => (
                      <TableRow key={activity.id}>
                        <TableCell className="font-medium">{activity.action}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{activity.module || 'General'}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {activity.description || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(activity.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fund-requests">
          <Card>
            <CardHeader>
              <CardTitle>Memos</CardTitle>
              <CardDescription>History of memos made by this user</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fundRequests?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No memos found
                      </TableCell>
                    </TableRow>
                  ) : (
                    fundRequests?.map((request: any) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.title}</TableCell>
                        <TableCell>{formatCurrency(request.amount)}</TableCell>
                        <TableCell className="capitalize">{request.purpose || 'Other'}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              request.status === 'received' ? 'bg-green-100 text-green-800' :
                              request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }
                          >
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(request.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
