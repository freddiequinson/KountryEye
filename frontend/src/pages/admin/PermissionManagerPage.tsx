import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Users, Search, Save, Check, Plus } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

interface Permission {
  id: number;
  name: string;
  code: string;
  module: string;
  description?: string;
}

interface Role {
  id: number;
  name: string;
  description?: string;
  default_page?: string;
  is_system: boolean;
  permissions: Permission[];
}

interface Employee {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role?: { id: number; name: string };
  branch?: { id: number; name: string };
  is_active: boolean;
}

interface Branch {
  id: number;
  name: string;
}

export default function PermissionManagerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeePermissions, setEmployeePermissions] = useState<number[]>([]);
  const [employeeBranches, setEmployeeBranches] = useState<number[]>([]);
  const [rolePermissions, setRolePermissions] = useState<number[]>([]);
  const [rolePermissionIds, setRolePermissionIds] = useState<number[]>([]); // Permissions from user's role

  // Queries
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const response = await api.get('/employees');
      return response.data as Employee[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.get('/permissions/roles');
      return response.data as Role[];
    },
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const response = await api.get('/permissions/permissions');
      return response.data as Permission[];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await api.get('/branches');
      return response.data as Branch[];
    },
  });

  // Mutations
  const updateUserPermissionsMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: any }) => {
      return api.put(`/permissions/users/${userId}/permissions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-list'] });
      toast({ title: 'User permissions updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update permissions', variant: 'destructive' });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ roleId, data }: { roleId: number; data: any }) => {
      return api.put(`/permissions/roles/${roleId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast({ title: 'Role updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update role', variant: 'destructive' });
    },
  });

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, perm) => {
    const module = perm.module || 'Other';
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const handleSelectEmployee = async (employee: Employee) => {
    setSelectedEmployee(employee);
    // Fetch user's effective permissions
    try {
      const response = await api.get(`/permissions/users/${employee.id}/effective-permissions`);
      const data = response.data;
      // Set the user's extra permissions and additional branches
      setEmployeePermissions(data.extra_permission_ids || []);
      setEmployeeBranches(data.additional_branch_ids || []);
      // Store role permissions for display
      setRolePermissionIds(data.role_permission_ids || []);
    } catch (error) {
      console.error('Failed to fetch user permissions');
      setEmployeePermissions([]);
      setEmployeeBranches([]);
      setRolePermissionIds([]);
    }
  };

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setRolePermissions(role.permissions.map(p => p.id));
  };

  const handleSaveUserPermissions = () => {
    if (!selectedEmployee) return;
    updateUserPermissionsMutation.mutate({
      userId: selectedEmployee.id,
      data: {
        extra_permission_ids: employeePermissions,
        additional_branch_ids: employeeBranches,
      },
    });
  };

  const handleSaveRolePermissions = () => {
    if (!selectedRole) return;
    updateRoleMutation.mutate({
      roleId: selectedRole.id,
      data: {
        permission_ids: rolePermissions,
      },
    });
  };

  const togglePermission = (permId: number, isRole: boolean) => {
    if (isRole) {
      setRolePermissions(prev =>
        prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
      );
    } else {
      setEmployeePermissions(prev =>
        prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
      );
    }
  };

  const toggleBranch = (branchId: number) => {
    setEmployeeBranches(prev =>
      prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]
    );
  };

  const filteredEmployees = employees.filter(emp =>
    `${emp.first_name} ${emp.last_name} ${emp.email}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get total permissions count for user
  const totalUserPermissions = rolePermissionIds.length + employeePermissions.length;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Permission Manager</h1>
        <p className="text-sm text-muted-foreground">Manage roles, permissions, and branch access for employees</p>
      </div>

      <Tabs defaultValue="users" className="flex-1 flex flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" />
            User Permissions
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Shield className="mr-2 h-4 w-4" />
            Role Management
          </TabsTrigger>
        </TabsList>

        {/* User Permissions Tab */}
        <TabsContent value="users" className="flex-1 mt-4">
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* Employee List - Left Sidebar */}
            <div className="col-span-3 flex flex-col bg-card rounded-lg border">
              <div className="p-3 border-b">
                <h3 className="font-semibold mb-2">Employees</h3>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="pl-8 h-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-1">
                  {filteredEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      className={`p-2 rounded-md cursor-pointer transition-colors ${
                        selectedEmployee?.id === emp.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleSelectEmployee(emp)}
                    >
                      <p className="font-medium text-sm">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs opacity-70">{emp.role?.name || 'No role'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Permissions Panel - Right Side */}
            <div className="col-span-9 flex flex-col bg-card rounded-lg border">
              {selectedEmployee ? (
                <>
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Role: <Badge variant="outline">{selectedEmployee.role?.name || 'No role'}</Badge>
                          <span className="ml-3">Total Permissions: <strong>{totalUserPermissions}</strong></span>
                        </p>
                      </div>
                      <Button
                        onClick={handleSaveUserPermissions}
                        disabled={updateUserPermissionsMutation.isPending}
                        size="sm"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </Button>
                    </div>
                  </div>
                  
                  <Tabs defaultValue="all-permissions" className="flex-1 flex flex-col">
                    <div className="px-4 pt-2 border-b">
                      <TabsList>
                        <TabsTrigger value="all-permissions">
                          <Check className="mr-1 h-3 w-3" />
                          All Permissions ({totalUserPermissions})
                        </TabsTrigger>
                        <TabsTrigger value="extra-permissions">
                          <Plus className="mr-1 h-3 w-3" />
                          Extra Permissions ({employeePermissions.length})
                        </TabsTrigger>
                        <TabsTrigger value="branches">Branch Access</TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="all-permissions" className="flex-1 overflow-y-auto p-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        All permissions this user has (from role + extra). Green items are from their role.
                      </p>
                      <div className="grid grid-cols-3 gap-4">
                        {Object.entries(permissionsByModule).map(([module, perms]) => {
                          const modulePerms = perms.filter(p => rolePermissionIds.includes(p.id) || employeePermissions.includes(p.id));
                          if (modulePerms.length === 0) return null;
                          return (
                            <div key={module} className="space-y-2">
                              <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wide border-b pb-1">{module}</h4>
                              <div className="space-y-1">
                                {modulePerms.map((perm) => {
                                  const isFromRole = rolePermissionIds.includes(perm.id);
                                  return (
                                    <div key={perm.id} className={`flex items-center gap-2 text-sm py-0.5 px-2 rounded ${isFromRole ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'}`}>
                                      <Check className="h-3 w-3" />
                                      <span>{perm.name}</span>
                                      {isFromRole ? <Badge variant="outline" className="text-[10px] px-1 py-0">role</Badge> : <Badge variant="outline" className="text-[10px] px-1 py-0">extra</Badge>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {totalUserPermissions === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No permissions assigned</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="extra-permissions" className="flex-1 overflow-y-auto p-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        Add extra permissions on top of the role's default permissions. Green items are already granted by role.
                      </p>
                      <div className="grid grid-cols-3 gap-4">
                        {Object.entries(permissionsByModule).map(([module, perms]) => (
                          <div key={module} className="space-y-2">
                            <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wide border-b pb-1">{module}</h4>
                            <div className="space-y-1">
                              {perms.map((perm) => {
                                const isFromRole = rolePermissionIds.includes(perm.id);
                                const isExtra = employeePermissions.includes(perm.id);
                                return (
                                  <div key={perm.id} className={`flex items-center space-x-2 py-0.5 ${isFromRole ? 'opacity-50' : ''}`}>
                                    <Checkbox
                                      id={`perm-${perm.id}`}
                                      checked={isFromRole || isExtra}
                                      disabled={isFromRole}
                                      onCheckedChange={() => !isFromRole && togglePermission(perm.id, false)}
                                      className="h-4 w-4"
                                    />
                                    <Label htmlFor={`perm-${perm.id}`} className={`text-sm cursor-pointer ${isFromRole ? 'text-green-600' : ''}`}>
                                      {perm.name}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="branches" className="flex-1 overflow-y-auto p-4">
                      <div className="max-w-md">
                        <p className="text-sm text-muted-foreground mb-2">
                          Primary branch: <Badge>{selectedEmployee.branch?.name || 'Not assigned'}</Badge>
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Select additional branches this employee can access:
                        </p>
                        <div className="space-y-2">
                          {branches
                            .filter(b => b.id !== selectedEmployee.branch?.id)
                            .map((branch) => (
                              <div key={branch.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted">
                                <Checkbox
                                  id={`branch-${branch.id}`}
                                  checked={employeeBranches.includes(branch.id)}
                                  onCheckedChange={() => toggleBranch(branch.id)}
                                />
                                <Label htmlFor={`branch-${branch.id}`} className="text-sm cursor-pointer flex-1">
                                  {branch.name}
                                </Label>
                              </div>
                            ))}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">Select an employee from the list</p>
                    <p className="text-sm">to manage their permissions</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Role Management Tab */}
        <TabsContent value="roles" className="flex-1 mt-4">
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* Role List - Left Sidebar */}
            <div className="col-span-3 flex flex-col bg-card rounded-lg border">
              <div className="p-3 border-b">
                <h3 className="font-semibold">Roles</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-1">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      className={`p-2 rounded-md cursor-pointer transition-colors ${
                        selectedRole?.id === role.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleSelectRole(role)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{role.name}</p>
                        {role.is_system && (
                          <Badge variant="secondary" className="text-[10px]">System</Badge>
                        )}
                      </div>
                      <p className="text-xs opacity-70">{role.permissions?.length || 0} permissions</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Role Permissions - Right Side */}
            <div className="col-span-9 flex flex-col bg-card rounded-lg border">
              {selectedRole ? (
                <>
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{selectedRole.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedRole.description || 'Manage permissions for this role'}
                        </p>
                      </div>
                      <Button
                        onClick={handleSaveRolePermissions}
                        disabled={updateRoleMutation.isPending}
                        size="sm"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Role Permissions
                      </Button>
                    </div>
                    {selectedRole.is_system && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                        This is a system role. Changes will affect all users with this role.
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(permissionsByModule).map(([module, perms]) => (
                        <div key={module} className="space-y-2">
                          <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wide border-b pb-1">{module}</h4>
                          <div className="space-y-1">
                            {perms.map((perm) => (
                              <div key={perm.id} className="flex items-center space-x-2 py-0.5">
                                <Checkbox
                                  id={`role-perm-${perm.id}`}
                                  checked={rolePermissions.includes(perm.id)}
                                  onCheckedChange={() => togglePermission(perm.id, true)}
                                  className="h-4 w-4"
                                />
                                <Label htmlFor={`role-perm-${perm.id}`} className="text-sm cursor-pointer">
                                  {perm.name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Shield className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">Select a role from the list</p>
                    <p className="text-sm">to manage its permissions</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
