import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Building2,
  Stethoscope,
  Settings,
  Plus,
  Pencil,
  Trash2,
  Key,
  UserPlus,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  is_active: boolean;
  is_superuser: boolean;
  role_id?: number;
  branch_id?: number;
  created_at: string;
}

interface Branch {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  is_active: boolean;
}

interface ConsultationType {
  id: number;
  name: string;
  description?: string;
  base_fee: number;
  is_active: boolean;
}

interface Role {
  id: number;
  name: string;
  description?: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Dialog states
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [isConsultationTypeDialogOpen, setIsConsultationTypeDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [_isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isVisionCareMemberDialogOpen, setIsVisionCareMemberDialogOpen] = useState(false);
  
  // Edit states
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editingConsultationType, setEditingConsultationType] = useState<ConsultationType | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: string; id: number; name: string } | null>(null);
  const [passwordUserId, setPasswordUserId] = useState<number | null>(null);

  // Form states
  const [userForm, setUserForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    password: '',
    role_id: '',
    branch_id: '',
    is_active: true,
  });

  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
  });

  const [consultationTypeForm, setConsultationTypeForm] = useState({
    name: '',
    description: '',
    base_fee: 0,
  });

  const [visionCareMemberForm, setVisionCareMemberForm] = useState({
    member_id: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    company: '',
    plan_type: 'individual',
  });

  const [newPassword, setNewPassword] = useState('');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetReseed, setResetReseed] = useState(true);

  // Queries
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['admin-branches'],
    queryFn: async () => {
      const response = await api.get('/branches');
      return response.data;
    },
  });

  const { data: consultationTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ['admin-consultation-types'],
    queryFn: async () => {
      const response = await api.get('/clinical/types?include_inactive=true');
      return response.data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.get('/users/roles/list');
      return response.data;
    },
  });

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: async () => {
      const response = await api.get('/ai/status');
      return response.data;
    },
  });

  const { data: visionCareMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['visioncare-members'],
    queryFn: async () => {
      const response = await api.get('/settings/visioncare/members');
      return response.data;
    },
  });

  // AI toggle mutation
  const toggleAiMutation = useMutation({
    mutationFn: (enabled: boolean) => api.put('/settings/ai_enabled', { value: enabled ? 'true' : 'false' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-status'] });
      toast({ title: 'AI settings updated' });
    },
  });

  // VisionCare member mutation
  const createVisionCareMemberMutation = useMutation({
    mutationFn: (data: typeof visionCareMemberForm) => api.post('/settings/visioncare/members', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visioncare-members'] });
      setIsVisionCareMemberDialogOpen(false);
      setVisionCareMemberForm({
        member_id: '',
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        company: '',
        plan_type: 'individual',
      });
      toast({ title: 'VisionCare member added successfully' });
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.detail || 'Failed to add member', variant: 'destructive' });
    },
  });

  // User mutations
  const createUserMutation = useMutation({
    mutationFn: (data: any) => api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsUserDialogOpen(false);
      resetUserForm();
      toast({ title: 'User created successfully' });
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      let message = 'Failed to create user';
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        message = detail.map((e: any) => e.msg || e.message || String(e)).join(', ');
      }
      toast({ title: message, variant: 'destructive' });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsUserDialogOpen(false);
      setEditingUser(null);
      resetUserForm();
      toast({ title: 'User updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update user', variant: 'destructive' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsDeleteDialogOpen(false);
      setDeletingItem(null);
      toast({ title: 'User deactivated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to deactivate user', variant: 'destructive' });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api.post(`/users/${id}/reset-password`, { password }),
    onSuccess: () => {
      setIsPasswordDialogOpen(false);
      setPasswordUserId(null);
      setNewPassword('');
      toast({ title: 'Password reset successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to reset password', variant: 'destructive' });
    },
  });

  // Branch mutations
  const createBranchMutation = useMutation({
    mutationFn: (data: any) => api.post('/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-branches'] });
      setIsBranchDialogOpen(false);
      resetBranchForm();
      toast({ title: 'Branch created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create branch', variant: 'destructive' });
    },
  });

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/branches/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-branches'] });
      setIsBranchDialogOpen(false);
      setEditingBranch(null);
      resetBranchForm();
      toast({ title: 'Branch updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update branch', variant: 'destructive' });
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-branches'] });
      setIsDeleteDialogOpen(false);
      setDeletingItem(null);
      toast({ title: 'Branch deactivated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to deactivate branch', variant: 'destructive' });
    },
  });

  // Consultation Type mutations
  const createConsultationTypeMutation = useMutation({
    mutationFn: (data: any) => api.post('/clinical/types', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-consultation-types'] });
      setIsConsultationTypeDialogOpen(false);
      resetConsultationTypeForm();
      toast({ title: 'Consultation type created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create consultation type', variant: 'destructive' });
    },
  });

  const updateConsultationTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/clinical/types/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-consultation-types'] });
      setIsConsultationTypeDialogOpen(false);
      setEditingConsultationType(null);
      resetConsultationTypeForm();
      toast({ title: 'Consultation type updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update consultation type', variant: 'destructive' });
    },
  });

  const deactivateConsultationTypeMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/clinical/types/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-consultation-types'] });
      setDeletingItem(null);
      toast({ title: 'Consultation type deactivated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to deactivate consultation type', variant: 'destructive' });
    },
  });

  const activateConsultationTypeMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/clinical/types/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-consultation-types'] });
      toast({ title: 'Consultation type activated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to activate consultation type', variant: 'destructive' });
    },
  });

  // Database reset mutation
  const resetDatabaseMutation = useMutation({
    mutationFn: (data: { password: string; reseed: boolean }) => 
      api.post('/system/hard-reset', data),
    onSuccess: (response) => {
      setIsResetDialogOpen(false);
      setResetPassword('');
      queryClient.invalidateQueries();
      toast({ 
        title: 'Database Reset Complete',
        description: response.data.reseeded 
          ? `Login with: ${response.data.admin_credentials.email} / ${response.data.admin_credentials.password}`
          : 'Database has been cleared. No seed data was added.',
      });
      // Force logout after reset
      setTimeout(() => {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }, 3000);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Reset Failed', 
        description: error.response?.data?.detail || 'Invalid password or server error',
        variant: 'destructive' 
      });
    },
  });

  const deleteConsultationTypeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/clinical/types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-consultation-types'] });
      setDeletingItem(null);
      toast({ title: 'Consultation type permanently deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete consultation type', variant: 'destructive' });
    },
  });

  // Form reset functions
  const resetUserForm = () => {
    setUserForm({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      password: '',
      role_id: '',
      branch_id: '',
      is_active: true,
    });
  };

  const resetBranchForm = () => {
    setBranchForm({ name: '', address: '', phone: '', email: '' });
  };

  const resetConsultationTypeForm = () => {
    setConsultationTypeForm({ name: '', description: '', base_fee: 0 });
  };

  // Open edit dialogs
  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || '',
      password: '',
      role_id: user.role_id?.toString() || '',
      branch_id: user.branch_id?.toString() || '',
      is_active: user.is_active,
    });
    setIsUserDialogOpen(true);
  };

  const openEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
      email: '',
    });
    setIsBranchDialogOpen(true);
  };

  const openEditConsultationType = (type: ConsultationType) => {
    setEditingConsultationType(type);
    setConsultationTypeForm({
      name: type.name,
      description: type.description || '',
      base_fee: type.base_fee,
    });
    setIsConsultationTypeDialogOpen(true);
  };

  // Submit handlers
  const handleUserSubmit = () => {
    const data: any = {
      email: userForm.email,
      first_name: userForm.first_name,
      last_name: userForm.last_name,
      phone: userForm.phone || null,
      role_id: userForm.role_id ? parseInt(userForm.role_id) : null,
      branch_id: userForm.branch_id ? parseInt(userForm.branch_id) : null,
      is_active: userForm.is_active,
    };

    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data });
    } else {
      data.password = userForm.password;
      createUserMutation.mutate(data);
    }
  };

  const handleBranchSubmit = () => {
    if (editingBranch) {
      updateBranchMutation.mutate({ id: editingBranch.id, data: branchForm });
    } else {
      createBranchMutation.mutate(branchForm);
    }
  };

  const handleConsultationTypeSubmit = () => {
    if (editingConsultationType) {
      updateConsultationTypeMutation.mutate({ id: editingConsultationType.id, data: consultationTypeForm });
    } else {
      createConsultationTypeMutation.mutate(consultationTypeForm);
    }
  };

  const handleDelete = () => {
    if (!deletingItem) return;
    
    switch (deletingItem.type) {
      case 'user':
        deleteUserMutation.mutate(deletingItem.id);
        break;
      case 'branch':
        deleteBranchMutation.mutate(deletingItem.id);
        break;
      case 'consultationType':
        deleteConsultationTypeMutation.mutate(deletingItem.id);
        break;
    }
  };

  const getRoleName = (roleId?: number) => {
    if (!roleId) return 'No Role';
    const role = roles.find((r: Role) => r.id === roleId);
    return role?.name || 'Unknown';
  };

  const getBranchName = (branchId?: number) => {
    if (!branchId) return 'No Branch';
    const branch = branches.find((b: Branch) => b.id === branchId);
    return branch?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Settings</h1>
        <p className="text-muted-foreground">Manage users, branches, consultation types, and system settings</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="branches" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Branches</span>
          </TabsTrigger>
          <TabsTrigger value="consultation-types" className="gap-2">
            <Stethoscope className="h-4 w-4" />
            <span className="hidden sm:inline">Consultation Types</span>
          </TabsTrigger>
          <TabsTrigger value="visioncare" className="gap-2">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">VisionCare</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">System</span>
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Create and manage employee accounts</CardDescription>
              </div>
              <Button onClick={() => { resetUserForm(); setEditingUser(null); setIsUserDialogOpen(true); }}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell>
                    </TableRow>
                  ) : (
                    users.map((user: User) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.first_name} {user.last_name}
                          {user.is_superuser && <Badge className="ml-2" variant="secondary">Admin</Badge>}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{getRoleName(user.role_id)}</TableCell>
                        <TableCell>{getBranchName(user.branch_id)}</TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'success' : 'destructive'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditUser(user)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setPasswordUserId(user.id); setIsPasswordDialogOpen(true); }}
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            {!user.is_superuser && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingItem({ type: 'user', id: user.id, name: `${user.first_name} ${user.last_name}` })}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branches Tab */}
        <TabsContent value="branches">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Branch Management</CardTitle>
                <CardDescription>Manage clinic branches and locations</CardDescription>
              </div>
              <Button onClick={() => { resetBranchForm(); setEditingBranch(null); setIsBranchDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Branch
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchesLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                    </TableRow>
                  ) : branches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No branches found</TableCell>
                    </TableRow>
                  ) : (
                    branches.map((branch: Branch) => (
                      <TableRow key={branch.id}>
                        <TableCell className="font-medium">{branch.name}</TableCell>
                        <TableCell>{branch.address || '-'}</TableCell>
                        <TableCell>{branch.phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={branch.is_active ? 'success' : 'destructive'}>
                            {branch.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditBranch(branch)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingItem({ type: 'branch', id: branch.id, name: branch.name })}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consultation Types Tab */}
        <TabsContent value="consultation-types">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Consultation Types</CardTitle>
                <CardDescription>Manage consultation types and fees</CardDescription>
              </div>
              <Button onClick={() => { resetConsultationTypeForm(); setEditingConsultationType(null); setIsConsultationTypeDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Type
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Base Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typesLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                    </TableRow>
                  ) : consultationTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No consultation types found</TableCell>
                    </TableRow>
                  ) : (
                    consultationTypes.map((type: ConsultationType) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-medium">{type.name}</TableCell>
                        <TableCell>{type.description || '-'}</TableCell>
                        <TableCell>GH₵{type.base_fee?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={type.is_active ? 'success' : 'destructive'}>
                            {type.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditConsultationType(type)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {type.is_active ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deactivateConsultationTypeMutation.mutate(type.id)}
                                title="Deactivate"
                              >
                                <span className="h-4 w-4 text-orange-500">⏸</span>
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => activateConsultationTypeMutation.mutate(type.id)}
                                title="Activate"
                              >
                                <span className="h-4 w-4 text-green-500">▶</span>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingItem({ type: 'consultationType', id: type.id, name: type.name })}
                              title="Delete permanently"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VisionCare Members Tab */}
        <TabsContent value="visioncare">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>VisionCare Membership</CardTitle>
                <CardDescription>Manage VisionCare plan members</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsVisionCareMemberDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Member
                </Button>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const formData = new FormData();
                        formData.append('file', file);
                        try {
                          await api.post('/settings/visioncare/upload', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          });
                          queryClient.invalidateQueries({ queryKey: ['visioncare-members'] });
                          toast({ title: 'Members uploaded successfully' });
                        } catch (error) {
                          toast({ title: 'Failed to upload members', variant: 'destructive' });
                        }
                      }
                    }}
                  />
                  <Button variant="outline" asChild>
                    <span>Upload CSV</span>
                  </Button>
                </label>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                    </TableRow>
                  ) : visionCareMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No VisionCare members. Upload a CSV to add members.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visionCareMembers.map((member: any) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.member_id}</TableCell>
                        <TableCell>{member.first_name} {member.last_name}</TableCell>
                        <TableCell>{member.company || '-'}</TableCell>
                        <TableCell>{member.plan_type || 'Individual'}</TableCell>
                        <TableCell>
                          <Badge variant={member.is_active ? 'success' : 'secondary'}>
                            {member.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings Tab */}
        <TabsContent value="system">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>AI Features</CardTitle>
                <CardDescription>Configure AI-powered clinical analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">AI Clinical Analysis</span>
                    <p className="text-sm text-muted-foreground">
                      Enable AI-powered diagnosis recommendations
                    </p>
                  </div>
                  <Button
                    variant={aiStatus?.enabled ? 'default' : 'outline'}
                    onClick={() => toggleAiMutation.mutate(!aiStatus?.enabled)}
                    disabled={toggleAiMutation.isPending}
                  >
                    {aiStatus?.enabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">API Configured</span>
                  <Badge variant={aiStatus?.configured ? 'success' : 'destructive'}>
                    {aiStatus?.configured ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Users</span>
                  <span className="font-medium">{users.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Branches</span>
                  <span className="font-medium">{branches.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Consultation Types</span>
                  <span className="font-medium">{consultationTypes.filter((t: ConsultationType) => t.is_active).length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Users</span>
                  <span className="font-medium">{users.filter((u: User) => u.is_active).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Branches</span>
                  <span className="font-medium">{branches.filter((b: Branch) => b.is_active).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VisionCare Members</span>
                  <span className="font-medium">{visionCareMembers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Database Status</span>
                  <Badge variant="success">Online</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible actions that affect the entire system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border border-destructive/50 rounded-lg bg-destructive/5">
                  <div>
                    <h4 className="font-semibold">Hard Reset Database</h4>
                    <p className="text-sm text-muted-foreground">
                      Delete ALL data and reset to initial state. This cannot be undone.
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={() => setIsResetDialogOpen(true)}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset Database
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* User Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user information' : 'Add a new employee account'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={userForm.first_name}
                  onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={userForm.last_name}
                  onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={userForm.role_id}
                onValueChange={(value) => setUserForm({ ...userForm, role_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role: Role) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select
                value={userForm.branch_id}
                onValueChange={(value) => setUserForm({ ...userForm, branch_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch: Branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleUserSubmit}
              disabled={createUserMutation.isPending || updateUserMutation.isPending}
            >
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch Dialog */}
      <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'Edit Branch' : 'Create New Branch'}</DialogTitle>
            <DialogDescription>
              {editingBranch ? 'Update branch information' : 'Add a new clinic branch'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Branch Name</Label>
              <Input
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={branchForm.phone}
                onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBranchDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleBranchSubmit}
              disabled={createBranchMutation.isPending || updateBranchMutation.isPending}
            >
              {editingBranch ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consultation Type Dialog */}
      <Dialog open={isConsultationTypeDialogOpen} onOpenChange={setIsConsultationTypeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingConsultationType ? 'Edit Consultation Type' : 'Create Consultation Type'}</DialogTitle>
            <DialogDescription>
              {editingConsultationType ? 'Update consultation type details' : 'Add a new consultation type'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={consultationTypeForm.name}
                onChange={(e) => setConsultationTypeForm({ ...consultationTypeForm, name: e.target.value })}
                placeholder="e.g., Ophthalmologist, Optometrist"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={consultationTypeForm.description}
                onChange={(e) => setConsultationTypeForm({ ...consultationTypeForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Base Fee (GH₵)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={consultationTypeForm.base_fee === 0 ? '' : consultationTypeForm.base_fee}
                onChange={(e) => setConsultationTypeForm({ ...consultationTypeForm, base_fee: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConsultationTypeDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConsultationTypeSubmit}
              disabled={createConsultationTypeMutation.isPending || updateConsultationTypeMutation.isPending}
            >
              {editingConsultationType ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Enter a new password for this user</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => passwordUserId && resetPasswordMutation.mutate({ id: passwordUserId, password: newPassword })}
              disabled={resetPasswordMutation.isPending || newPassword.length < 6}
            >
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate "{deletingItem?.name}". This action can be reversed by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* VisionCare Member Dialog */}
      <Dialog open={isVisionCareMemberDialogOpen} onOpenChange={setIsVisionCareMemberDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add VisionCare Member</DialogTitle>
            <DialogDescription>Add a new member to the VisionCare plan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Member ID *</Label>
              <Input
                value={visionCareMemberForm.member_id}
                onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, member_id: e.target.value })}
                placeholder="e.g., VC-001"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={visionCareMemberForm.first_name}
                  onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={visionCareMemberForm.last_name}
                  onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={visionCareMemberForm.phone}
                  onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={visionCareMemberForm.email}
                  onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company/Organization</Label>
              <Input
                value={visionCareMemberForm.company}
                onChange={(e) => setVisionCareMemberForm({ ...visionCareMemberForm, company: e.target.value })}
                placeholder="e.g., ABC Corporation"
              />
            </div>
            <div className="space-y-2">
              <Label>Plan Type</Label>
              <Select
                value={visionCareMemberForm.plan_type}
                onValueChange={(value) => setVisionCareMemberForm({ ...visionCareMemberForm, plan_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="family">Family</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVisionCareMemberDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createVisionCareMemberMutation.mutate(visionCareMemberForm)}
              disabled={createVisionCareMemberMutation.isPending || !visionCareMemberForm.member_id || !visionCareMemberForm.first_name || !visionCareMemberForm.last_name}
            >
              {createVisionCareMemberMutation.isPending ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Database Reset Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Hard Reset Database
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p className="font-semibold text-destructive">
                ⚠️ WARNING: This will permanently delete ALL data including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All users and accounts</li>
                <li>All patients and clinical records</li>
                <li>All sales and financial data</li>
                <li>All inventory and stock data</li>
                <li>All messages and notifications</li>
              </ul>
              <p className="text-sm">
                This action <strong>CANNOT</strong> be undone. Enter the system password to confirm.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>System Reset Password</Label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Enter reset password"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reseed"
                checked={resetReseed}
                onChange={(e) => setResetReseed(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="reseed" className="text-sm font-normal">
                Re-seed with initial data (admin user, roles, categories)
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setResetPassword(''); setIsResetDialogOpen(false); }}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => resetDatabaseMutation.mutate({ password: resetPassword, reseed: resetReseed })}
              disabled={resetDatabaseMutation.isPending || !resetPassword}
            >
              {resetDatabaseMutation.isPending ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Confirm Reset'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
