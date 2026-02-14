import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Clock, ListTodo, Eye, Trash2, UserCheck, UserX, EyeOff, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface Employee {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  is_active: boolean;
  role_id?: number;
  branch_id?: number;
  role?: { id: number; name: string };
  branch?: { id: number; name: string };
  created_at?: string;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  assigned_to_id: number;
  assigned_by_id: number;
  status: string;
  priority: string;
  due_date?: string;
  created_at?: string;
}

interface Attendance {
  id: number;
  user_id: number;
  date: string;
  clock_in?: string;
  clock_out?: string;
  status: string;
}

export default function EmployeesPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('employees');
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null);
  const [branchAssignEmployee, setBranchAssignEmployee] = useState<Employee | null>(null);
  const [branchAssignForm, setBranchAssignForm] = useState({
    branch_id: '',
    effective_from: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [employeeForm, setEmployeeForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role_id: '',
    branch_id: '',
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assigned_to_id: '',
    priority: 'medium',
    due_date: '',
  });

  // Queries
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const response = await api.get('/employees');
      return response.data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.get('/employees/roles/list');
      return response.data;
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await api.get('/branches');
      return response.data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await api.get('/employees/tasks');
      return response.data;
    },
  });

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: async () => {
      const response = await api.get('/employees/attendance/today');
      return response.data;
    },
  });

  // Mutations
  const createEmployeeMutation = useMutation({
    mutationFn: (data: any) => api.post('/employees', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsAddEmployeeOpen(false);
      resetEmployeeForm();
      toast({ 
        title: 'Employee created', 
        description: `Password: ${response.data.first_name.toLowerCase()}123` 
      });
    },
    onError: () => {
      toast({ title: 'Failed to create employee', variant: 'destructive' });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => api.post('/employees/tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsAddTaskOpen(false);
      resetTaskForm();
      toast({ title: 'Task assigned successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to assign task', variant: 'destructive' });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/employees/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Task updated' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => 
      api.put(`/employees/${id}`, { is_active }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: variables.is_active ? 'Employee activated' : 'Employee deactivated' });
    },
    onError: () => {
      toast({ title: 'Failed to update employee status', variant: 'destructive' });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/employees/${id}`),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDeleteConfirm(null);
      const data = response.data;
      if (data.deleted) {
        toast({ title: 'Employee deleted permanently' });
      } else {
        toast({ 
          title: 'Employee deactivated', 
          description: `Has ${data.record_count} related records - cannot be permanently deleted` 
        });
      }
    },
    onError: () => {
      toast({ title: 'Failed to delete employee', variant: 'destructive' });
    },
  });

  const resetEmployeeForm = () => {
    setEmployeeForm({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      role_id: '',
      branch_id: '',
    });
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      description: '',
      assigned_to_id: '',
      priority: 'medium',
      due_date: '',
    });
  };

  // Branch assignment mutation
  const assignBranchMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: any }) => 
      api.post(`/branch-assignments/users/${userId}/assign-branch`, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setBranchAssignEmployee(null);
      setBranchAssignForm({ branch_id: '', effective_from: new Date().toISOString().split('T')[0], notes: '' });
      toast({ 
        title: 'Branch assigned successfully',
        description: response.data.message
      });
    },
    onError: () => {
      toast({ title: 'Failed to assign branch', variant: 'destructive' });
    },
  });

  const handleAssignBranch = () => {
    if (!branchAssignEmployee || !branchAssignForm.branch_id) return;
    assignBranchMutation.mutate({
      userId: branchAssignEmployee.id,
      data: {
        branch_id: parseInt(branchAssignForm.branch_id),
        effective_from: new Date(branchAssignForm.effective_from).toISOString(),
        notes: branchAssignForm.notes || null,
      }
    });
  };

  const handleCreateEmployee = () => {
    createEmployeeMutation.mutate({
      email: employeeForm.email,
      first_name: employeeForm.first_name,
      last_name: employeeForm.last_name,
      phone: employeeForm.phone || null,
      role_id: parseInt(employeeForm.role_id),
      branch_id: parseInt(employeeForm.branch_id),
    });
  };

  const handleCreateTask = () => {
    createTaskMutation.mutate({
      title: taskForm.title,
      description: taskForm.description || null,
      assigned_to_id: parseInt(taskForm.assigned_to_id),
      priority: taskForm.priority,
      due_date: taskForm.due_date || null,
    });
  };

  const filteredEmployees = employees.filter((emp: Employee) => {
    const matchesSearch = `${emp.first_name} ${emp.last_name} ${emp.email}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesActiveFilter = showInactive || emp.is_active;
    return matchesSearch && matchesActiveFilter;
  });

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-tour="page-title">Employees</h1>
          <p className="text-muted-foreground">Manage staff, attendance, and tasks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAddTaskOpen(true)}>
            <ListTodo className="mr-2 h-4 w-4" />
            Assign Task
          </Button>
          <Button onClick={() => setIsAddEmployeeOpen(true)} data-tour="add-employee">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4" data-tour="employee-stats">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clocked In Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {todayAttendance.filter((a: Attendance) => a.clock_in && !a.clock_out).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {tasks.filter((t: Task) => t.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {employees.filter((e: Employee) => e.is_active).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm cursor-pointer flex items-center gap-1">
                {showInactive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {showInactive ? 'Showing inactive' : 'Hiding inactive'}
              </Label>
            </div>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">No employees found</TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee: Employee) => (
                    <TableRow 
                      key={employee.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/employees/${employee.id}`)}
                    >
                      <TableCell className="font-medium">
                        {employee.first_name} {employee.last_name}
                      </TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.role?.name || '-'}</TableCell>
                      <TableCell>{employee.branch?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                          {employee.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/employees/${employee.id}`);
                            }}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBranchAssignEmployee(employee);
                              setBranchAssignForm({
                                branch_id: employee.branch_id?.toString() || '',
                                effective_from: new Date().toISOString().split('T')[0],
                                notes: '',
                              });
                            }}
                            title="Assign Branch"
                          >
                            <Building2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={employee.is_active ? "outline" : "default"}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleActiveMutation.mutate({ 
                                id: employee.id, 
                                is_active: !employee.is_active 
                              });
                            }}
                            title={employee.is_active ? "Deactivate" : "Activate"}
                          >
                            {employee.is_active ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(employee);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Show employees who clocked in */}
                  {todayAttendance.map((record: any) => (
                    <TableRow 
                      key={record.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/employees/${record.user_id}?tab=attendance`)}
                    >
                      <TableCell className="font-medium">
                        {record.user?.first_name} {record.user?.last_name}
                      </TableCell>
                      <TableCell>
                        {record.clock_in ? new Date(record.clock_in).toLocaleTimeString() : '-'}
                      </TableCell>
                      <TableCell>
                        {record.clock_out ? new Date(record.clock_out).toLocaleTimeString() : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={record.status === 'present' ? 'default' : 'secondary'}>
                          {record.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Show absent employees (active employees who haven't clocked in) */}
                  {employees
                    .filter((emp: any) => emp.is_active && !todayAttendance.some((a: any) => a.user_id === emp.id))
                    .map((emp: any) => (
                      <TableRow 
                        key={`absent-${emp.id}`}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/admin/employees/${emp.id}?tab=attendance`)}
                      >
                        <TableCell className="font-medium">
                          {emp.first_name} {emp.last_name}
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>
                          <Badge variant="destructive">absent</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  {todayAttendance.length === 0 && employees.filter((e: any) => e.is_active).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        No employees found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">No tasks found</TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task: Task) => {
                    const assignee = employees.find((e: Employee) => e.id === task.assigned_to_id);
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{task.title}</div>
                            {task.description && (
                              <div className="text-sm text-muted-foreground truncate max-w-xs">
                                {task.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {assignee ? `${assignee.first_name} ${assignee.last_name}` : '-'}
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Employee Dialog */}
      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={employeeForm.first_name}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={employeeForm.last_name}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={employeeForm.phone}
                onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                placeholder="+233..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select
                  value={employeeForm.role_id}
                  onValueChange={(value) => setEmployeeForm({ ...employeeForm, role_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role: any) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Branch *</Label>
                <Select
                  value={employeeForm.branch_id}
                  onValueChange={(value) => setEmployeeForm({ ...employeeForm, branch_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch: any) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Password will be set to: {employeeForm.first_name.toLowerCase() || 'firstname'}123
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateEmployee}
              disabled={!employeeForm.first_name || !employeeForm.last_name || !employeeForm.email || !employeeForm.role_id || !employeeForm.branch_id}
            >
              Create Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
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
            <div className="space-y-2">
              <Label>Assign To *</Label>
              <Select
                value={taskForm.assigned_to_id}
                onValueChange={(value) => setTaskForm({ ...taskForm, assigned_to_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp: Employee) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button 
              onClick={handleCreateTask}
              disabled={!taskForm.title || !taskForm.assigned_to_id}
            >
              Assign Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteConfirm?.first_name} {deleteConfirm?.last_name}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              If this employee has any related records (attendance, sales, tasks, etc.), 
              they will be <strong>deactivated</strong> instead of permanently deleted to preserve data integrity.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => deleteConfirm && deleteEmployeeMutation.mutate(deleteConfirm.id)}
              disabled={deleteEmployeeMutation.isPending}
            >
              {deleteEmployeeMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch Assignment Dialog */}
      <Dialog open={!!branchAssignEmployee} onOpenChange={() => setBranchAssignEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Assign Branch
            </DialogTitle>
            <DialogDescription>
              Assign {branchAssignEmployee?.first_name} {branchAssignEmployee?.last_name} to a new branch.
              {branchAssignEmployee?.branch && (
                <span className="block mt-1">
                  Current branch: <Badge variant="outline">{branchAssignEmployee.branch.name}</Badge>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>New Branch *</Label>
              <Select
                value={branchAssignForm.branch_id}
                onValueChange={(value) => setBranchAssignForm({ ...branchAssignForm, branch_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch: any) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Effective From *</Label>
              <Input
                type="date"
                value={branchAssignForm.effective_from}
                onChange={(e) => setBranchAssignForm({ ...branchAssignForm, effective_from: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The date when this assignment takes effect
              </p>
            </div>
            <div className="space-y-2">
              <Label>Notes (Reason for rotation)</Label>
              <Textarea
                value={branchAssignForm.notes}
                onChange={(e) => setBranchAssignForm({ ...branchAssignForm, notes: e.target.value })}
                placeholder="e.g., Monthly rotation, covering for leave, permanent transfer..."
              />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
            <strong>Security Note:</strong> When this employee logs in next, they will be required to verify 
            they are at the assigned branch before they can continue working.
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBranchAssignEmployee(null)}>Cancel</Button>
            <Button 
              onClick={handleAssignBranch}
              disabled={!branchAssignForm.branch_id || !branchAssignForm.effective_from || assignBranchMutation.isPending}
            >
              {assignBranchMutation.isPending ? 'Assigning...' : 'Assign Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
