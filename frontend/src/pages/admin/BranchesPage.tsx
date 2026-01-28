import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2, Edit, Trash2, Settings, MapPin, Clock } from 'lucide-react';
import api from '@/lib/api';
import { Branch } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

export default function BranchesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    latitude: '',
    longitude: '',
    geofence_radius: '100',
    work_start_time: '08:00',
    work_end_time: '17:00',
    late_threshold_minutes: '15',
    require_geolocation: false,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsBranch, setSettingsBranch] = useState<Branch | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await api.get('/branches');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      closeDialog();
      toast({ title: 'Branch created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create branch', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.put(`/branches/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      closeDialog();
      toast({ title: 'Branch updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update branch', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast({ title: 'Branch deactivated' });
    },
  });

  const openCreateDialog = () => {
    setEditingBranch(null);
    setFormData({ 
      name: '', address: '', phone: '', email: '',
      latitude: '', longitude: '', geofence_radius: '100',
      work_start_time: '08:00', work_end_time: '17:00',
      late_threshold_minutes: '15', require_geolocation: false
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      latitude: branch.latitude?.toString() || '',
      longitude: branch.longitude?.toString() || '',
      geofence_radius: branch.geofence_radius?.toString() || '100',
      work_start_time: branch.work_start_time || '08:00',
      work_end_time: branch.work_end_time || '17:00',
      late_threshold_minutes: branch.late_threshold_minutes?.toString() || '15',
      require_geolocation: branch.require_geolocation || false,
    });
    setIsDialogOpen(true);
  };

  const openSettingsDialog = (branch: Branch) => {
    setSettingsBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      latitude: branch.latitude?.toString() || '',
      longitude: branch.longitude?.toString() || '',
      geofence_radius: branch.geofence_radius?.toString() || '100',
      work_start_time: branch.work_start_time || '08:00',
      work_end_time: branch.work_end_time || '17:00',
      late_threshold_minutes: branch.late_threshold_minutes?.toString() || '15',
      require_geolocation: branch.require_geolocation || false,
    });
    setIsSettingsOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setIsSettingsOpen(false);
    setEditingBranch(null);
    setSettingsBranch(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      geofence_radius: parseInt(formData.geofence_radius) || 100,
      late_threshold_minutes: parseInt(formData.late_threshold_minutes) || 15,
    };
    if (editingBranch) {
      updateMutation.mutate({ id: editingBranch.id, data: submitData });
    } else if (settingsBranch) {
      updateMutation.mutate({ id: settingsBranch.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Branch Management</h1>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Branch
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : branches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No branches found
                  </TableCell>
                </TableRow>
              ) : (
                branches.map((branch: Branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {branch.name}
                      </div>
                    </TableCell>
                    <TableCell>{branch.address || '-'}</TableCell>
                    <TableCell>{branch.phone || '-'}</TableCell>
                    <TableCell>{branch.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={branch.is_active ? 'success' : 'secondary'}>
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(branch)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openSettingsDialog(branch)}
                          title="Attendance Settings"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(branch.id)}
                          title="Deactivate"
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingBranch ? 'Edit Branch' : 'Add New Branch'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Branch Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingBranch
                    ? 'Update'
                    : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Attendance Settings Dialog */}
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Attendance Settings - {settingsBranch?.name}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Tabs defaultValue="location">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="location">
                    <MapPin className="mr-2 h-4 w-4" />
                    Location
                  </TabsTrigger>
                  <TabsTrigger value="hours">
                    <Clock className="mr-2 h-4 w-4" />
                    Work Hours
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="location" className="space-y-4 pt-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base">Require Geolocation</Label>
                      <p className="text-sm text-muted-foreground">
                        Employees must be within the geofence to clock in/out
                      </p>
                    </div>
                    <Switch
                      checked={formData.require_geolocation}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, require_geolocation: checked })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        placeholder="e.g., 5.6037"
                        value={formData.latitude}
                        onChange={(e) =>
                          setFormData({ ...formData, latitude: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="any"
                        placeholder="e.g., -0.1870"
                        value={formData.longitude}
                        onChange={(e) =>
                          setFormData({ ...formData, longitude: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="geofence_radius">Geofence Radius (meters)</Label>
                    <Input
                      id="geofence_radius"
                      type="number"
                      min="10"
                      max="1000"
                      value={formData.geofence_radius}
                      onChange={(e) =>
                        setFormData({ ...formData, geofence_radius: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Distance from branch location where clock-in is allowed
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="hours" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="work_start_time">Work Start Time</Label>
                      <Input
                        id="work_start_time"
                        type="time"
                        value={formData.work_start_time}
                        onChange={(e) =>
                          setFormData({ ...formData, work_start_time: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="work_end_time">Work End Time</Label>
                      <Input
                        id="work_end_time"
                        type="time"
                        value={formData.work_end_time}
                        onChange={(e) =>
                          setFormData({ ...formData, work_end_time: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="late_threshold_minutes">Late Threshold (minutes)</Label>
                    <Input
                      id="late_threshold_minutes"
                      type="number"
                      min="0"
                      max="120"
                      value={formData.late_threshold_minutes}
                      onChange={(e) =>
                        setFormData({ ...formData, late_threshold_minutes: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Minutes after start time before marking as late
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
    </div>
  );
}
