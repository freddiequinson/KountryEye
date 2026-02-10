import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Search,
  Filter,
  Calendar,
  User,
  Activity,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText,
  Monitor,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({
    user_id: 'all',
    role_id: 'all',
    action: 'all',
    module: 'all',
    search: '',
    start_date: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const response = await api.get('/users/');
      return response.data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles-list'],
    queryFn: async () => {
      const response = await api.get('/permissions/roles');
      return response.data;
    },
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['audit-actions'],
    queryFn: async () => {
      const response = await api.get('/audit/logs/actions');
      return response.data.actions || [];
    },
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['audit-modules'],
    queryFn: async () => {
      const response = await api.get('/audit/logs/modules');
      return response.data.modules || [];
    },
  });

  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: async () => {
      const params: any = {
        skip: page * limit,
        limit,
      };
      if (filters.user_id && filters.user_id !== 'all') params.user_id = filters.user_id;
      if (filters.role_id && filters.role_id !== 'all') params.role_id = filters.role_id;
      if (filters.action && filters.action !== 'all') params.action = filters.action;
      if (filters.module && filters.module !== 'all') params.module = filters.module;
      if (filters.search) params.search = filters.search;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const response = await api.get('/audit/logs', { params });
      return response.data;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['audit-summary', filters.start_date, filters.end_date],
    queryFn: async () => {
      const response = await api.get('/audit/logs/summary', {
        params: {
          start_date: filters.start_date,
          end_date: filters.end_date,
        },
      });
      return response.data;
    },
  });

  const logs = logsData?.items || [];
  const total = logsData?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const getActionColor = (action: string) => {
    if (action?.includes('login')) return 'bg-green-100 text-green-800';
    if (action?.includes('logout')) return 'bg-gray-100 text-gray-800';
    if (action?.includes('create') || action?.includes('add')) return 'bg-blue-100 text-blue-800';
    if (action?.includes('update') || action?.includes('edit')) return 'bg-yellow-100 text-yellow-800';
    if (action?.includes('delete') || action?.includes('remove')) return 'bg-red-100 text-red-800';
    if (action?.includes('view') || action?.includes('page')) return 'bg-purple-100 text-purple-800';
    if (action?.includes('payment') || action?.includes('sale')) return 'bg-emerald-100 text-emerald-800';
    return 'bg-gray-100 text-gray-800';
  };

  const clearFilters = () => {
    setFilters({
      user_id: 'all',
      role_id: 'all',
      action: 'all',
      module: 'all',
      search: '',
      start_date: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      end_date: format(new Date(), 'yyyy-MM-dd'),
    });
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground">
            View system activities, user actions, and access logs
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Activity className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Activities</p>
                  <p className="text-2xl font-bold">{summary.total_activities?.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold">{summary.most_active_users?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Monitor className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Top Action</p>
                  <p className="text-lg font-bold truncate">
                    {summary.by_action?.[0]?.action || '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date Range</p>
                  <p className="text-sm font-medium">
                    {filters.start_date} to {filters.end_date}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => {
                    setFilters({ ...filters, search: e.target.value });
                    setPage(0);
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>User</Label>
              <Select
                value={filters.user_id}
                onValueChange={(value) => {
                  setFilters({ ...filters, user_id: value });
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={filters.role_id}
                onValueChange={(value) => {
                  setFilters({ ...filters, role_id: value });
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles.map((role: any) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={filters.action}
                onValueChange={(value) => {
                  setFilters({ ...filters, action: value });
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actions.map((action: string) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Module</Label>
              <Select
                value={filters.module}
                onValueChange={(value) => {
                  setFilters({ ...filters, module: value });
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  {modules.map((module: string) => (
                    <SelectItem key={module} value={module}>
                      {module}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => {
                    setFilters({ ...filters, start_date: e.target.value });
                    setPage(0);
                  }}
                  className="text-xs"
                />
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => {
                    setFilters({ ...filters, end_date: e.target.value });
                    setPage(0);
                  }}
                  className="text-xs"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Activity Logs</CardTitle>
            <span className="text-sm text-muted-foreground">
              {total.toLocaleString()} total records
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activity logs found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Page</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {log.created_at
                          ? format(new Date(log.created_at), 'MMM d, HH:mm:ss')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{log.user_name}</p>
                          <p className="text-xs text-muted-foreground">{log.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionColor(log.action)} variant="secondary">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{log.module || '-'}</span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {log.description || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {log.page_path || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {page + 1} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
