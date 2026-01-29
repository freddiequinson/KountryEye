import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Users, Search, Save } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Permission Manager</h1>
        <p className="text-muted-foreground">Manage roles, permissions, and branch access for employees</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
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
        <TabsContent value="users" className="space-y-4">
          <div className="grid lg:grid-cols-4 md:grid-cols-3 gap-6">
            {/* Employee List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Employees</CardTitle>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {filteredEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedEmployee?.id === emp.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleSelectEmployee(emp)}
                    >
                      <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs opacity-70">{emp.role?.name || 'No role'}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Permissions & Branches */}
            <Card className="lg:col-span-3 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedEmployee
                    ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}`
                    : 'Select an Employee'}
                </CardTitle>
                <CardDescription>
                  {selectedEmployee
                    ? 'Assign additional permissions and branch access'
                    : 'Click on an employee to manage their permissions'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedEmployee ? (
                  <Tabs defaultValue="extra-permissions">
                    <TabsList className="mb-4">
                      <TabsTrigger value="extra-permissions">Extra Permissions</TabsTrigger>
                      <TabsTrigger value="branches">Branch Access</TabsTrigger>
                    </TabsList>

                    <TabsContent value="extra-permissions" className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Checked permissions from role are shown in green. Add extra permissions by checking unchecked items.
                      </p>
                      <div className="grid gap-4 max-h-[50vh] overflow-y-auto">
                        {Object.entries(permissionsByModule).map(([module, perms]) => (
                          <div key={module} className="space-y-2">
                            <h4 className="font-medium text-sm text-muted-foreground uppercase">{module}</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {perms.map((perm) => {
                                const isFromRole = rolePermissionIds.includes(perm.id);
                                const isExtra = employeePermissions.includes(perm.id);
                                return (
                                  <div key={perm.id} className={`flex items-center space-x-2 p-1 rounded ${isFromRole ? 'bg-green-50 dark:bg-green-950/30' : ''}`}>
                                    <Checkbox
                                      id={`perm-${perm.id}`}
                                      checked={isFromRole || isExtra}
                                      disabled={isFromRole}
                                      onCheckedChange={() => !isFromRole && togglePermission(perm.id, false)}
                                    />
                                    <Label htmlFor={`perm-${perm.id}`} className={`text-sm ${isFromRole ? 'text-green-700 dark:text-green-400' : ''}`}>
                                      {perm.name}
                                      {isFromRole && <span className="text-xs ml-1">(role)</span>}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="branches" className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Primary branch: <strong>{selectedEmployee.branch?.name || 'Not assigned'}</strong>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Select additional branches this employee can access:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {branches
                          .filter(b => b.id !== selectedEmployee.branch?.id)
                          .map((branch) => (
                            <div key={branch.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`branch-${branch.id}`}
                                checked={employeeBranches.includes(branch.id)}
                                onCheckedChange={() => toggleBranch(branch.id)}
                              />
                              <Label htmlFor={`branch-${branch.id}`} className="text-sm">
                                {branch.name}
                              </Label>
                            </div>
                          ))}
                      </div>
                    </TabsContent>

                    <div className="mt-4 pt-4 border-t">
                      <Button
                        onClick={handleSaveUserPermissions}
                        disabled={updateUserPermissionsMutation.isPending}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </Button>
                    </div>
                  </Tabs>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select an employee from the list to manage their permissions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Role Management Tab */}
        <TabsContent value="roles" className="space-y-4">
          <div className="grid lg:grid-cols-4 md:grid-cols-3 gap-6">
            {/* Role List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedRole?.id === role.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleSelectRole(role)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{role.name}</p>
                        {role.is_system && (
                          <Badge variant="secondary" className="text-xs">System</Badge>
                        )}
                      </div>
                      <p className="text-xs opacity-70">{role.permissions?.length || 0} permissions</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Role Permissions */}
            <Card className="lg:col-span-3 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedRole ? selectedRole.name : 'Select a Role'}
                </CardTitle>
                <CardDescription>
                  {selectedRole
                    ? selectedRole.description || 'Manage permissions for this role'
                    : 'Click on a role to manage its permissions'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedRole ? (
                  <div className="space-y-4">
                    {selectedRole.is_system && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                        This is a system role. Changes will affect all users with this role.
                      </div>
                    )}
                    <div className="grid gap-4 max-h-[50vh] overflow-y-auto">
                      {Object.entries(permissionsByModule).map(([module, perms]) => (
                        <div key={module} className="space-y-2">
                          <h4 className="font-medium text-sm text-muted-foreground uppercase">{module}</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {perms.map((perm) => (
                              <div key={perm.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`role-perm-${perm.id}`}
                                  checked={rolePermissions.includes(perm.id)}
                                  onCheckedChange={() => togglePermission(perm.id, true)}
                                />
                                <Label htmlFor={`role-perm-${perm.id}`} className="text-sm">
                                  {perm.name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        onClick={handleSaveRolePermissions}
                        disabled={updateRoleMutation.isPending}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Role Permissions
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a role from the list to manage its permissions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
