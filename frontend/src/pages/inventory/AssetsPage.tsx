import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Wrench, AlertTriangle, Camera, Filter, ArrowLeft, X, Check, Edit, Trash2, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface AssetCategory {
  id: number;
  name: string;
  description?: string;
  default_checklist?: string[];
  default_maintenance_interval?: number;
}

interface Asset {
  id: number;
  asset_tag: string;
  name: string;
  description?: string;
  category_id?: number;
  branch_id?: number;
  serial_number?: string;
  model?: string;
  manufacturer?: string;
  purchase_date?: string;
  purchase_price?: number;
  warranty_expiry?: string;
  status: string;
  condition: string;
  location?: string;
  image_url?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  maintenance_interval_days?: number;
  maintenance_checklist?: string[];
  category?: AssetCategory;
  branch?: { id: number; name: string };
}

interface MaintenanceLog {
  id: number;
  asset_id: number;
  maintenance_type?: string;
  description?: string;
  performed_by?: string;
  performed_date: string;
  cost?: number;
  next_due_date?: string;
  status: string;
  checklist_completed?: { item: string; completed: boolean }[];
  notes?: string;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-500' },
  { value: 'faulty', label: 'Faulty', color: 'bg-red-500' },
  { value: 'destroyed', label: 'Destroyed', color: 'bg-gray-500' },
  { value: 'under_maintenance', label: 'Under Maintenance', color: 'bg-yellow-500' },
];

const CONDITION_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

export default function AssetsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState('assets');

  const [assetForm, setAssetForm] = useState({
    name: '',
    description: '',
    category_id: '',
    branch_id: '',
    serial_number: '',
    model: '',
    manufacturer: '',
    purchase_date: '',
    purchase_price: '',
    warranty_expiry: '',
    location: '',
    maintenance_interval_days: '',
  });
  
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenance_type: '',
    description: '',
    performed_by: '',
    technician_id: '',
    performed_date: new Date().toISOString().split('T')[0],
    cost: '',
    next_due_date: '',
    notes: '',
    checklist: [] as { item: string; completed: boolean }[],
    fund_request_id: '' as string,  // Link to fund request if paid via fund request
  });
  
  const [isAddTechnicianOpen, setIsAddTechnicianOpen] = useState(false);
  const [technicianForm, setTechnicianForm] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    specialization: '',
  });

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', search, statusFilter, branchFilter],
    queryFn: async () => {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (branchFilter && branchFilter !== 'all') params.branch_id = branchFilter;
      const response = await api.get('/assets', { params });
      return response.data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: async () => {
      const response = await api.get('/assets/categories');
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

  const { data: healthReport } = useQuery({
    queryKey: ['asset-health-report'],
    queryFn: async () => {
      const response = await api.get('/assets/reports/health');
      return response.data;
    },
  });

  const { data: maintenanceDue = [] } = useQuery({
    queryKey: ['maintenance-due'],
    queryFn: async () => {
      const response = await api.get('/assets/reports/maintenance-due', {
        params: { days_ahead: 30 },
      });
      return response.data;
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const response = await api.get('/assets/technicians');
      return response.data;
    },
  });

  // Fetch received fund requests that can be linked to maintenance
  const { data: receivedFundRequests = [] } = useQuery({
    queryKey: ['fund-requests-received'],
    queryFn: async () => {
      const response = await api.get('/fund-requests', { params: { status: 'received' } });
      return response.data;
    },
  });

  const { data: maintenanceLogs = [] } = useQuery({
    queryKey: ['maintenance-logs', selectedAsset?.id],
    queryFn: async () => {
      if (!selectedAsset) return [];
      const response = await api.get(`/assets/${selectedAsset.id}/maintenance`);
      return response.data;
    },
    enabled: !!selectedAsset,
  });

  const createAssetMutation = useMutation({
    mutationFn: (data: any) => api.post('/assets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-health-report'] });
      setIsAddDialogOpen(false);
      resetAssetForm();
      toast({ title: 'Asset created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create asset', variant: 'destructive' });
    },
  });

  const updateAssetMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/assets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-health-report'] });
      setIsDetailDialogOpen(false);
      toast({ title: 'Asset updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update asset', variant: 'destructive' });
    },
  });

  const createMaintenanceMutation = useMutation({
    mutationFn: (data: any) => api.post('/assets/maintenance', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-logs'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-due'] });
      queryClient.invalidateQueries({ queryKey: ['asset-health-report'] });
      setIsMaintenanceDialogOpen(false);
      resetMaintenanceForm();
      toast({ title: 'Maintenance recorded successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to record maintenance', variant: 'destructive' });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ assetId, file }: { assetId: number; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/assets/${assetId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: 'Image uploaded successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to upload image', variant: 'destructive' });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: number) => api.delete(`/assets/${assetId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-health-report'] });
      setIsDetailDialogOpen(false);
      setSelectedAsset(null);
      toast({ title: 'Asset deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete asset', variant: 'destructive' });
    },
  });

  const resetAssetForm = () => {
    setAssetForm({
      name: '',
      description: '',
      category_id: '',
      branch_id: '',
      serial_number: '',
      model: '',
      manufacturer: '',
      purchase_date: '',
      purchase_price: '',
      warranty_expiry: '',
      location: '',
      maintenance_interval_days: '',
    });
    setChecklistItems([]);
    setNewChecklistItem('');
  };
  
  // Load checklist from category when category changes
  useEffect(() => {
    if (assetForm.category_id) {
      const category = categories.find((c: AssetCategory) => c.id.toString() === assetForm.category_id);
      if (category?.default_checklist && category.default_checklist.length > 0) {
        setChecklistItems(category.default_checklist);
      }
      if (category?.default_maintenance_interval) {
        setAssetForm(prev => ({
          ...prev,
          maintenance_interval_days: category.default_maintenance_interval?.toString() || ''
        }));
      }
    }
  }, [assetForm.category_id, categories]);
  
  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setChecklistItems([...checklistItems, newChecklistItem.trim()]);
      setNewChecklistItem('');
    }
  };
  
  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const resetMaintenanceForm = () => {
    setMaintenanceForm({
      maintenance_type: '',
      description: '',
      performed_by: '',
      technician_id: '',
      performed_date: new Date().toISOString().split('T')[0],
      cost: '',
      next_due_date: '',
      notes: '',
      checklist: [],
      fund_request_id: '',
    });
  };

  const createTechnicianMutation = useMutation({
    mutationFn: (data: any) => api.post('/assets/technicians', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      setIsAddTechnicianOpen(false);
      setTechnicianForm({ name: '', phone: '', email: '', company: '', specialization: '' });
      toast({ title: 'Technician added successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to add technician', variant: 'destructive' });
    },
  });

  const handleDeleteAsset = () => {
    if (selectedAsset) {
      deleteAssetMutation.mutate(selectedAsset.id);
    }
    setIsDeleteConfirmOpen(false);
  };

  const openEditDialog = (asset: Asset) => {
    setSelectedAsset(asset);
    setAssetForm({
      name: asset.name,
      description: asset.description || '',
      category_id: asset.category_id?.toString() || '',
      branch_id: asset.branch_id?.toString() || '',
      serial_number: asset.serial_number || '',
      model: asset.model || '',
      manufacturer: asset.manufacturer || '',
      purchase_date: asset.purchase_date || '',
      purchase_price: asset.purchase_price?.toString() || '',
      warranty_expiry: asset.warranty_expiry || '',
      location: asset.location || '',
      maintenance_interval_days: asset.maintenance_interval_days?.toString() || '',
    });
    setChecklistItems(asset.maintenance_checklist || []);
    setIsEditDialogOpen(true);
  };

  const handleUpdateAsset = () => {
    if (!selectedAsset) return;
    updateAssetMutation.mutate({
      id: selectedAsset.id,
      data: {
        name: assetForm.name,
        description: assetForm.description || null,
        category_id: assetForm.category_id ? parseInt(assetForm.category_id) : null,
        branch_id: assetForm.branch_id ? parseInt(assetForm.branch_id) : null,
        serial_number: assetForm.serial_number || null,
        model: assetForm.model || null,
        manufacturer: assetForm.manufacturer || null,
        purchase_date: assetForm.purchase_date || null,
        purchase_price: assetForm.purchase_price ? parseFloat(assetForm.purchase_price) : null,
        warranty_expiry: assetForm.warranty_expiry || null,
        location: assetForm.location || null,
        maintenance_interval_days: assetForm.maintenance_interval_days ? parseInt(assetForm.maintenance_interval_days) : null,
        maintenance_checklist: checklistItems.length > 0 ? checklistItems : null,
      },
    });
    setIsEditDialogOpen(false);
  };

  const handleCreateAsset = () => {
    createAssetMutation.mutate({
      name: assetForm.name,
      description: assetForm.description || null,
      category_id: assetForm.category_id ? parseInt(assetForm.category_id) : null,
      branch_id: assetForm.branch_id ? parseInt(assetForm.branch_id) : null,
      serial_number: assetForm.serial_number || null,
      model: assetForm.model || null,
      manufacturer: assetForm.manufacturer || null,
      purchase_date: assetForm.purchase_date || null,
      purchase_price: assetForm.purchase_price ? parseFloat(assetForm.purchase_price) : null,
      warranty_expiry: assetForm.warranty_expiry || null,
      location: assetForm.location || null,
      maintenance_interval_days: assetForm.maintenance_interval_days ? parseInt(assetForm.maintenance_interval_days) : null,
      maintenance_checklist: checklistItems.length > 0 ? checklistItems : null,
    });
  };

  const handleUpdateStatus = (status: string) => {
    if (!selectedAsset) return;
    updateAssetMutation.mutate({
      id: selectedAsset.id,
      data: { status },
    });
  };

  const handleRecordMaintenance = () => {
    if (!selectedAsset) return;

    createMaintenanceMutation.mutate({
      asset_id: selectedAsset.id,
      maintenance_type: maintenanceForm.maintenance_type || null,
      description: maintenanceForm.description || null,
      performed_by: maintenanceForm.performed_by || null,
      performed_date: maintenanceForm.performed_date,
      cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : null,
      next_due_date: maintenanceForm.next_due_date || null,
      checklist_completed: maintenanceForm.checklist,
      notes: maintenanceForm.notes || null,
      fund_request_id: maintenanceForm.fund_request_id ? parseInt(maintenanceForm.fund_request_id) : null,
    });
  };

  const openMaintenanceDialog = (asset: Asset) => {
    setSelectedAsset(asset);
    const checklist = (asset.maintenance_checklist || []).map(item => ({
      item,
      completed: false,
    }));
    setMaintenanceForm({
      maintenance_type: '',
      description: '',
      performed_by: '',
      technician_id: '',
      performed_date: new Date().toISOString().split('T')[0],
      cost: '',
      next_due_date: '',
      notes: '',
      checklist,
      fund_request_id: '',
    });
    setIsMaintenanceDialogOpen(true);
  };

  const openDetailDialog = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsDetailDialogOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, assetId: number) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImageMutation.mutate({ assetId, file });
    }
  };

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return (
      <Badge className={option?.color || 'bg-gray-500'}>
        {option?.label || status}
      </Badge>
    );
  };

  const getConditionBadge = (condition: string) => {
    const colors: Record<string, string> = {
      excellent: 'bg-green-500',
      good: 'bg-blue-500',
      fair: 'bg-yellow-500',
      poor: 'bg-red-500',
    };
    return (
      <Badge className={colors[condition] || 'bg-gray-500'}>
        {condition.charAt(0).toUpperCase() + condition.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Assets Management</h1>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Asset
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthReport?.total_assets || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {healthReport?.by_status?.active || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Faulty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {healthReport?.by_status?.faulty || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Maintenance Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {healthReport?.maintenance_due || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Warranty Expiring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {healthReport?.warranty_expiring_soon || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="assets">All Assets</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance Due</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch: any) => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assets Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Asset Tag</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Last Maintenance</TableHead>
                  <TableHead>Next Maintenance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      No assets found
                    </TableCell>
                  </TableRow>
                ) : (
                  assets.map((asset: Asset) => (
                    <TableRow
                      key={asset.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetailDialog(asset)}
                    >
                      <TableCell>
                        <div className="relative w-12 h-12 bg-muted rounded overflow-hidden">
                          {asset.image_url ? (
                            <img
                              src={asset.image_url}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Camera className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{asset.asset_tag}</TableCell>
                      <TableCell className="font-medium">{asset.name}</TableCell>
                      <TableCell>{asset.category?.name || '-'}</TableCell>
                      <TableCell>{asset.branch?.name || '-'}</TableCell>
                      <TableCell>{getStatusBadge(asset.status)}</TableCell>
                      <TableCell>{getConditionBadge(asset.condition)}</TableCell>
                      <TableCell>
                        {asset.last_maintenance_date 
                          ? new Date(asset.last_maintenance_date).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {asset.next_maintenance_date ? (
                          <span className={
                            new Date(asset.next_maintenance_date) < new Date()
                              ? 'text-red-600 font-medium'
                              : ''
                          }>
                            {new Date(asset.next_maintenance_date).toLocaleDateString()}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openMaintenanceDialog(asset);
                          }}
                        >
                          <Wrench className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Tag</TableHead>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Last Maintenance</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenanceDue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No maintenance due
                    </TableCell>
                  </TableRow>
                ) : (
                  maintenanceDue.map((item: any) => (
                    <TableRow key={item.asset_id}>
                      <TableCell className="font-mono text-sm">{item.asset_tag}</TableCell>
                      <TableCell className="font-medium">{item.asset_name}</TableCell>
                      <TableCell>{item.branch_name || '-'}</TableCell>
                      <TableCell>
                        {item.last_maintenance
                          ? new Date(item.last_maintenance).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        {item.next_maintenance
                          ? new Date(item.next_maintenance).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {item.days_overdue ? (
                          <Badge variant="destructive">{item.days_overdue} days</Badge>
                        ) : (
                          <Badge variant="outline">Upcoming</Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            const asset = assets.find((a: Asset) => a.id === item.asset_id);
                            if (asset) openMaintenanceDialog(asset);
                          }}
                        >
                          <Wrench className="mr-2 h-4 w-4" />
                          Maintain
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="technicians" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Maintenance Technicians</h3>
            <Button onClick={() => setIsAddTechnicianOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Technician
            </Button>
          </div>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {technicians.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No technicians added yet
                    </TableCell>
                  </TableRow>
                ) : (
                  technicians.map((tech: any) => (
                    <TableRow key={tech.id}>
                      <TableCell className="font-medium">{tech.name}</TableCell>
                      <TableCell>{tech.phone || '-'}</TableCell>
                      <TableCell>{tech.email || '-'}</TableCell>
                      <TableCell>{tech.company || '-'}</TableCell>
                      <TableCell>{tech.specialization || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={tech.is_active ? 'default' : 'secondary'}>
                          {tech.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Asset Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset Name *</Label>
                <Input
                  value={assetForm.name}
                  onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  placeholder="e.g., Autorefractor"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={assetForm.category_id}
                  onValueChange={(value) => setAssetForm({ ...assetForm, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Branch *</Label>
                <Select
                  value={assetForm.branch_id}
                  onValueChange={(value) => setAssetForm({ ...assetForm, branch_id: value })}
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
                <Label>Location</Label>
                <Input
                  value={assetForm.location}
                  onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                  placeholder="e.g., Exam Room 1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input
                  value={assetForm.serial_number}
                  onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={assetForm.model}
                  onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Manufacturer</Label>
                <Input
                  value={assetForm.manufacturer}
                  onChange={(e) => setAssetForm({ ...assetForm, manufacturer: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Purchase Date</Label>
                <Input
                  type="date"
                  value={assetForm.purchase_date}
                  onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Purchase Price (GH₵)</Label>
                <Input
                  type="number"
                  value={assetForm.purchase_price}
                  onChange={(e) => setAssetForm({ ...assetForm, purchase_price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Warranty Expiry</Label>
                <Input
                  type="date"
                  value={assetForm.warranty_expiry}
                  onChange={(e) => setAssetForm({ ...assetForm, warranty_expiry: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={assetForm.description}
                onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Maintenance Interval (days)</Label>
                <Input
                  type="number"
                  value={assetForm.maintenance_interval_days}
                  onChange={(e) => setAssetForm({ ...assetForm, maintenance_interval_days: e.target.value })}
                  placeholder="e.g., 90"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Maintenance Checklist</Label>
              <p className="text-xs text-muted-foreground">
                {assetForm.category_id ? 'Loaded from category. Add or remove items as needed.' : 'Select a category to load default checklist, or add items manually.'}
              </p>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {checklistItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No checklist items</p>
                ) : (
                  checklistItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 bg-muted/50 rounded px-2 py-1">
                      <span className="text-sm">{item}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeChecklistItem(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Add checklist item..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addChecklistItem();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addChecklistItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAsset} disabled={!assetForm.name}>
              Create Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance Dialog */}
      <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Maintenance - {selectedAsset?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Maintenance Type</Label>
                <Select
                  value={maintenanceForm.maintenance_type}
                  onValueChange={(value) => setMaintenanceForm({ ...maintenanceForm, maintenance_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="calibration">Calibration</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Performed Date *</Label>
                <Input
                  type="date"
                  value={maintenanceForm.performed_date}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, performed_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Technician *</Label>
              <div className="flex gap-2">
                <Select
                  value={maintenanceForm.technician_id}
                  onValueChange={(value) => {
                    const tech = technicians.find((t: any) => t.id.toString() === value);
                    setMaintenanceForm({
                      ...maintenanceForm,
                      technician_id: value,
                      performed_by: tech?.name || ''
                    });
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech: any) => (
                      <SelectItem key={tech.id} value={tech.id.toString()}>
                        {tech.name} {tech.company ? `(${tech.company})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsAddTechnicianOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
              {technicians.length === 0 && (
                <p className="text-xs text-muted-foreground">No technicians yet. Click + to add one.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cost (GH₵)</Label>
                <Input
                  type="number"
                  value={maintenanceForm.cost}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                  placeholder="0.00"
                />
                {!maintenanceForm.fund_request_id && (
                  <p className="text-xs text-muted-foreground">Will be recorded as expense</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Next Due Date</Label>
                <Input
                  type="date"
                  value={maintenanceForm.next_due_date}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, next_due_date: e.target.value })}
                />
              </div>
            </div>

            {/* Fund Request Link - to prevent double expense logging */}
            <div className="space-y-2">
              <Label>Paid via Memo? (Optional)</Label>
              <Select
                value={maintenanceForm.fund_request_id || "none"}
                onValueChange={(value) => setMaintenanceForm({ ...maintenanceForm, fund_request_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select if paid via memo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None - Record as new expense</SelectItem>
                  {receivedFundRequests.map((fr: any) => (
                    <SelectItem key={fr.id} value={fr.id.toString()}>
                      {fr.title} - GH₵{fr.amount}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {maintenanceForm.fund_request_id && (
                <p className="text-xs text-green-600">
                  ✓ Linked to memo - expense already recorded, no duplicate will be created
                </p>
              )}
              {!maintenanceForm.fund_request_id && receivedFundRequests.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  If this maintenance was paid using a memo, select it to avoid double expense logging
                </p>
              )}
            </div>

            {maintenanceForm.checklist.length > 0 && (
              <div className="space-y-2">
                <Label>Maintenance Checklist</Label>
                <div className="border rounded-md p-3 space-y-2">
                  {maintenanceForm.checklist.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`checklist-${index}`}
                        checked={item.completed}
                        onChange={(e) => {
                          const newChecklist = [...maintenanceForm.checklist];
                          newChecklist[index].completed = e.target.checked;
                          setMaintenanceForm({ ...maintenanceForm, checklist: newChecklist });
                        }}
                        className="h-4 w-4"
                      />
                      <label htmlFor={`checklist-${index}`} className="text-sm">
                        {item.item}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={maintenanceForm.notes}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMaintenanceDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRecordMaintenance}
              disabled={!maintenanceForm.maintenance_type || !maintenanceForm.performed_date || !maintenanceForm.technician_id}
            >
              Record Maintenance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAsset?.name}
              <span className="text-sm font-mono text-muted-foreground">({selectedAsset?.asset_tag})</span>
            </DialogTitle>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                    {selectedAsset.image_url ? (
                      <img
                        src={selectedAsset.image_url}
                        alt={selectedAsset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Camera className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      id="asset-image-upload"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, selectedAsset.id)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => document.getElementById('asset-image-upload')?.click()}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Upload Image
                    </Button>
                  </div>
                </div>
                <div className="col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Branch</Label>
                      <p>{selectedAsset.branch?.name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Category</Label>
                      <p>{selectedAsset.category?.name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Location</Label>
                      <p>{selectedAsset.location || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Serial Number</Label>
                      <p>{selectedAsset.serial_number || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Model</Label>
                      <p>{selectedAsset.model || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Manufacturer</Label>
                      <p>{selectedAsset.manufacturer || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Last Maintenance</Label>
                      <p>{selectedAsset.last_maintenance_date ? new Date(selectedAsset.last_maintenance_date).toLocaleDateString() : 'Never'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Next Maintenance</Label>
                      <p className={selectedAsset.next_maintenance_date && new Date(selectedAsset.next_maintenance_date) < new Date() ? 'text-red-600 font-medium' : ''}>
                        {selectedAsset.next_maintenance_date ? new Date(selectedAsset.next_maintenance_date).toLocaleDateString() : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <div className="mt-1">{getStatusBadge(selectedAsset.status)}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Condition</Label>
                      <div className="mt-1">{getConditionBadge(selectedAsset.condition)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Change Status</Label>
                      <Select
                        value={selectedAsset.status}
                        onValueChange={(value) => handleUpdateStatus(value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Change Condition</Label>
                      <Select
                        value={selectedAsset.condition}
                        onValueChange={(value) => updateAssetMutation.mutate({ id: selectedAsset.id, data: { condition: value } })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Maintenance Checklist */}
              {selectedAsset.maintenance_checklist && selectedAsset.maintenance_checklist.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Maintenance Checklist ({selectedAsset.maintenance_checklist.length} items)
                  </h3>
                  <div className="border rounded-md p-3 bg-muted/30">
                    <div className="grid grid-cols-2 gap-2">
                      {selectedAsset.maintenance_checklist.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <div className="h-4 w-4 rounded border border-muted-foreground/30 flex-shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Maintenance History */}
              <div>
                <h3 className="font-semibold mb-2">Maintenance History</h3>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Performed By</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Checklist</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maintenanceLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4">
                            No maintenance records
                          </TableCell>
                        </TableRow>
                      ) : (
                        maintenanceLogs.map((log: MaintenanceLog) => {
                          const completedCount = log.checklist_completed?.filter(c => c.completed).length || 0;
                          const totalCount = log.checklist_completed?.length || 0;
                          return (
                            <TableRow key={log.id}>
                              <TableCell>
                                {new Date(log.performed_date).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="capitalize">{log.maintenance_type || '-'}</TableCell>
                              <TableCell>{log.performed_by || '-'}</TableCell>
                              <TableCell>
                                {log.cost ? `GH₵${log.cost.toLocaleString()}` : '-'}
                              </TableCell>
                              <TableCell>
                                {totalCount > 0 ? (
                                  <Badge variant={completedCount === totalCount ? 'default' : 'secondary'}>
                                    {completedCount}/{totalCount}
                                  </Badge>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={log.status === 'completed' ? 'default' : 'secondary'}>
                                  {log.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDetailDialogOpen(false);
                  if (selectedAsset) openEditDialog(selectedAsset);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button onClick={() => {
                setIsDetailDialogOpen(false);
                if (selectedAsset) openMaintenanceDialog(selectedAsset);
              }}>
                <Wrench className="mr-2 h-4 w-4" />
                Maintain
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete <strong>{selectedAsset?.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAsset}>
              Delete Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Asset - {selectedAsset?.asset_tag}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset Name *</Label>
                <Input
                  value={assetForm.name}
                  onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={assetForm.category_id}
                  onValueChange={(value) => setAssetForm({ ...assetForm, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select
                  value={assetForm.branch_id}
                  onValueChange={(value) => setAssetForm({ ...assetForm, branch_id: value })}
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
                <Label>Location</Label>
                <Input
                  value={assetForm.location}
                  onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input
                  value={assetForm.serial_number}
                  onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={assetForm.model}
                  onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Manufacturer</Label>
                <Input
                  value={assetForm.manufacturer}
                  onChange={(e) => setAssetForm({ ...assetForm, manufacturer: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Maintenance Interval (days)</Label>
                <Input
                  type="number"
                  value={assetForm.maintenance_interval_days}
                  onChange={(e) => setAssetForm({ ...assetForm, maintenance_interval_days: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Warranty Expiry</Label>
                <Input
                  type="date"
                  value={assetForm.warranty_expiry}
                  onChange={(e) => setAssetForm({ ...assetForm, warranty_expiry: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={assetForm.description}
                onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Maintenance Checklist</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {checklistItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No checklist items</p>
                ) : (
                  checklistItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 bg-muted/50 rounded px-2 py-1">
                      <span className="text-sm">{item}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeChecklistItem(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Add checklist item..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addChecklistItem();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addChecklistItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAsset} disabled={!assetForm.name}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Technician Dialog */}
      <Dialog open={isAddTechnicianOpen} onOpenChange={setIsAddTechnicianOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Technician</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={technicianForm.name}
                onChange={(e) => setTechnicianForm({ ...technicianForm, name: e.target.value })}
                placeholder="Technician name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={technicianForm.phone}
                  onChange={(e) => setTechnicianForm({ ...technicianForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={technicianForm.email}
                  onChange={(e) => setTechnicianForm({ ...technicianForm, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                value={technicianForm.company}
                onChange={(e) => setTechnicianForm({ ...technicianForm, company: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Specialization</Label>
              <Input
                value={technicianForm.specialization}
                onChange={(e) => setTechnicianForm({ ...technicianForm, specialization: e.target.value })}
                placeholder="e.g., Medical Equipment, HVAC"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTechnicianOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createTechnicianMutation.mutate(technicianForm)}
              disabled={!technicianForm.name}
            >
              Add Technician
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
