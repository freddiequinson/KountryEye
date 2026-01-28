import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package, AlertTriangle, Truck, ShoppingBag, Trash2, Wrench } from 'lucide-react';
import api from '@/lib/api';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function InventoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'warehouses';
  const [isWarehouseDialogOpen, setIsWarehouseDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState({
    name: '',
    location: '',
    contact_person: '',
    contact_phone: '',
  });
  const [importForm, setImportForm] = useState({
    warehouse_id: '',
    vendor_id: '',
    supplier_name: '',
    reference_number: '',
    expected_date: '',
    notes: '',
  });
  const [vendorForm, setVendorForm] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [transferForm, setTransferForm] = useState({
    from_warehouse_id: '',
    to_branch_id: '',
    notes: '',
    items: [] as { product_id: string; product_name: string; requested_quantity: string }[],
  });
  const [transferProductSearch, setTransferProductSearch] = useState('');

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await api.get('/inventory/warehouses');
      return response.data;
    },
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers'],
    queryFn: async () => {
      const response = await api.get('/inventory/transfers');
      return response.data;
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['stock-alerts'],
    queryFn: async () => {
      const response = await api.get('/inventory/alerts');
      return response.data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['inventory-products'],
    queryFn: async () => {
      const response = await api.get('/sales/products');
      return response.data;
    },
  });

  const { data: imports = [] } = useQuery({
    queryKey: ['imports'],
    queryFn: async () => {
      const response = await api.get('/inventory/imports');
      return response.data;
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const response = await api.get('/inventory/vendors');
      return response.data;
    },
  });

  const { data: pendingArrivals = [] } = useQuery({
    queryKey: ['pending-arrivals'],
    queryFn: async () => {
      const response = await api.get('/inventory/imports/pending-arrival');
      return response.data;
    },
  });

  const createWarehouseMutation = useMutation({
    mutationFn: (data: typeof warehouseForm) =>
      api.post('/inventory/warehouses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setIsWarehouseDialogOpen(false);
      setWarehouseForm({ name: '', location: '', contact_person: '', contact_phone: '' });
      toast({ title: 'Warehouse created successfully' });
    },
  });

  const createImportMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/imports', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imports'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setIsImportDialogOpen(false);
      setImportForm({ warehouse_id: '', vendor_id: '', supplier_name: '', reference_number: '', expected_date: '', notes: '' });
      toast({ title: 'Import scheduled successfully' });
    },
    onError: () => toast({ title: 'Failed to create import', variant: 'destructive' }),
  });

  const createVendorMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/vendors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setIsVendorDialogOpen(false);
      setVendorForm({ name: '', contact_person: '', email: '', phone: '', address: '', notes: '' });
      toast({ title: 'Vendor created successfully' });
    },
    onError: () => toast({ title: 'Failed to create vendor', variant: 'destructive' }),
  });

  const createTransferMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/transfers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      setIsTransferDialogOpen(false);
      setTransferForm({ from_warehouse_id: '', to_branch_id: '', notes: '', items: [] });
      toast({ title: 'Transfer created successfully' });
    },
    onError: () => toast({ title: 'Failed to create transfer', variant: 'destructive' }),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await api.get('/branches');
      return response.data;
    },
  });

  const addTransferItem = (product: any) => {
    if (transferForm.items.find(i => i.product_id === product.id.toString())) {
      toast({ title: 'Product already added', variant: 'destructive' });
      return;
    }
    setTransferForm({
      ...transferForm,
      items: [...transferForm.items, {
        product_id: product.id.toString(),
        product_name: product.name,
        requested_quantity: '1'
      }]
    });
    setTransferProductSearch('');
  };

  const removeTransferItem = (productId: string) => {
    setTransferForm({
      ...transferForm,
      items: transferForm.items.filter(i => i.product_id !== productId)
    });
  };

  const updateTransferItemQty = (productId: string, qty: string) => {
    setTransferForm({
      ...transferForm,
      items: transferForm.items.map(i => 
        i.product_id === productId ? { ...i, requested_quantity: qty } : i
      )
    });
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" data-tour="page-title">Inventory Management</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3" data-tour="stock-levels">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Warehouses</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{warehouses.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Transfers</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {transfers.filter((t: any) => t.status === 'pending').length}
              </div>
            </CardContent>
          </Card>
          <Card data-tour="low-stock">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Stock Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {alerts.length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue={defaultTab} data-tour="transfer">
          <TabsList>
            <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="imports">Imports</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="warehouses" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setIsWarehouseDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Warehouse
              </Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        No warehouses found
                      </TableCell>
                    </TableRow>
                  ) : (
                    warehouses.map((warehouse: any) => (
                      <TableRow 
                        key={warehouse.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/inventory/warehouse/${warehouse.id}`)}
                      >
                        <TableCell className="font-medium">
                          {warehouse.name}
                        </TableCell>
                        <TableCell>{warehouse.location || '-'}</TableCell>
                        <TableCell>{warehouse.contact_person || '-'}</TableCell>
                        <TableCell>{warehouse.contact_phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={warehouse.is_active ? 'success' : 'secondary'}>
                            {warehouse.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <div className="flex justify-between mb-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/inventory/products')}>
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  View All Products
                </Button>
                <Button variant="outline" onClick={() => navigate('/inventory/assets')}>
                  <Wrench className="mr-2 h-4 w-4" />
                  Manage Assets
                </Button>
              </div>
              <Button onClick={() => navigate('/inventory/products/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Cost Price</TableHead>
                    <TableHead>Sale Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.slice(0, 10).map((product: any) => (
                      <TableRow 
                        key={product.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/inventory/products/${product.id}`)}
                      >
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.category?.name || '-'}</TableCell>
                        <TableCell>GH₵{product.cost_price?.toLocaleString() || '0'}</TableCell>
                        <TableCell>GH₵{product.unit_price?.toLocaleString() || '0'}</TableCell>
                        <TableCell>
                          <Badge variant={product.is_active ? 'success' : 'secondary'}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {products.length > 10 && (
              <div className="mt-4 text-center">
                <Button variant="link" onClick={() => navigate('/inventory/products')}>
                  View all {products.length} products →
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="imports" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setIsImportDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Import
              </Button>
            </div>
            {pendingArrivals.length > 0 && (
              <Card className="mb-4 border-amber-200 bg-amber-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Pending Arrivals ({pendingArrivals.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pendingArrivals.slice(0, 3).map((imp: any) => (
                      <div key={imp.id} className="flex justify-between items-center p-2 bg-white rounded border">
                        <div>
                          <span className="font-medium">{imp.reference_number || `Import #${imp.id}`}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            from {imp.vendor?.name || imp.supplier_name || 'Unknown'}
                          </span>
                        </div>
                        <Badge variant="warning">{imp.days_overdue} days overdue</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Expected Date</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No imports found
                      </TableCell>
                    </TableRow>
                  ) : (
                    imports.map((imp: any) => (
                      <TableRow 
                        key={imp.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/inventory/imports/${imp.id}`)}
                      >
                        <TableCell className="font-medium">{imp.reference_number || `#${imp.id}`}</TableCell>
                        <TableCell>{imp.supplier_name || '-'}</TableCell>
                        <TableCell>Warehouse #{imp.warehouse_id}</TableCell>
                        <TableCell>
                          {imp.expected_date ? new Date(imp.expected_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>GH₵{imp.total_cost?.toLocaleString() || '0'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              imp.status === 'received' ? 'success' :
                              imp.status === 'pending' ? 'warning' : 'secondary'
                            }
                          >
                            {imp.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="vendors" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setIsVendorDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Vendor
              </Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        No vendors found
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendors.map((vendor: any) => (
                      <TableRow key={vendor.id}>
                        <TableCell className="font-medium">{vendor.name}</TableCell>
                        <TableCell>{vendor.contact_person || '-'}</TableCell>
                        <TableCell>{vendor.phone || '-'}</TableCell>
                        <TableCell>{vendor.email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={vendor.is_active ? 'success' : 'secondary'}>
                            {vendor.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="transfers" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button onClick={() => navigate('/inventory/transfers/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Transfer
              </Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>From Warehouse</TableHead>
                    <TableHead>To Branch</TableHead>
                    <TableHead>Request Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No transfers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    transfers.map((transfer: any) => (
                      <TableRow key={transfer.id}>
                        <TableCell className="font-medium">#{transfer.id}</TableCell>
                        <TableCell>Warehouse #{transfer.from_warehouse_id}</TableCell>
                        <TableCell>Branch #{transfer.to_branch_id}</TableCell>
                        <TableCell>
                          {new Date(transfer.request_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transfer.status === 'completed'
                                ? 'success'
                                : transfer.status === 'approved'
                                ? 'warning'
                                : 'secondary'
                            }
                          >
                            {transfer.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {transfer.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await api.put(`/inventory/transfers/${transfer.id}/approve`);
                                  queryClient.invalidateQueries({ queryKey: ['transfers'] });
                                  toast({ title: 'Transfer approved' });
                                } catch {
                                  toast({ title: 'Failed to approve', variant: 'destructive' });
                                }
                              }}
                            >
                              Approve
                            </Button>
                          )}
                          {transfer.status === 'approved' && (
                            <Button
                              size="sm"
                              onClick={async () => {
                                try {
                                  await api.put(`/inventory/transfers/${transfer.id}/complete`);
                                  queryClient.invalidateQueries({ queryKey: ['transfers'] });
                                  toast({ title: 'Transfer completed' });
                                } catch {
                                  toast({ title: 'Failed to complete', variant: 'destructive' });
                                }
                              }}
                            >
                              Confirm Receipt
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="mt-4">
            <div className="space-y-4">
              {/* Today's Expected Imports */}
              {pendingArrivals.length > 0 && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-blue-800 flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Expected Imports Today ({pendingArrivals.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {pendingArrivals.map((imp: any) => (
                        <div 
                          key={imp.id} 
                          className="flex justify-between items-center p-3 bg-white rounded border cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/inventory/imports/${imp.id}`)}
                        >
                          <div>
                            <span className="font-medium">{imp.reference_number || `Import #${imp.id}`}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              from {imp.vendor?.name || imp.supplier_name || 'Unknown'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">GH₵{imp.total_cost?.toLocaleString() || '0'}</span>
                            {imp.days_overdue > 0 ? (
                              <Badge variant="destructive">{imp.days_overdue} days overdue</Badge>
                            ) : (
                              <Badge variant="warning">Due today</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Low Stock Alerts */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Low Stock Alerts ({alerts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Current Qty</TableHead>
                          <TableHead>Min Qty</TableHead>
                          <TableHead>Alert Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {alerts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8">
                              No low stock alerts
                            </TableCell>
                          </TableRow>
                        ) : (
                          alerts.map((alert: any) => (
                            <TableRow key={alert.id}>
                              <TableCell className="font-medium">
                                Product #{alert.product_id}
                              </TableCell>
                              <TableCell>
                                {alert.branch_id
                                  ? `Branch #${alert.branch_id}`
                                  : `Warehouse #${alert.warehouse_id}`}
                              </TableCell>
                              <TableCell>{alert.current_quantity}</TableCell>
                              <TableCell>{alert.min_quantity}</TableCell>
                              <TableCell>
                                <Badge variant="destructive">{alert.alert_type}</Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isWarehouseDialogOpen} onOpenChange={setIsWarehouseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Warehouse</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createWarehouseMutation.mutate(warehouseForm);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={warehouseForm.name}
                  onChange={(e) =>
                    setWarehouseForm({ ...warehouseForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={warehouseForm.location}
                  onChange={(e) =>
                    setWarehouseForm({ ...warehouseForm, location: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  value={warehouseForm.contact_person}
                  onChange={(e) =>
                    setWarehouseForm({
                      ...warehouseForm,
                      contact_person: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  value={warehouseForm.contact_phone}
                  onChange={(e) =>
                    setWarehouseForm({
                      ...warehouseForm,
                      contact_phone: e.target.value,
                    })
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsWarehouseDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createWarehouseMutation.isPending}>
                  {createWarehouseMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule Import</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input
                  value={importForm.reference_number}
                  onChange={(e) => setImportForm({ ...importForm, reference_number: e.target.value })}
                  placeholder="e.g., PO-2024-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <select
                  className="w-full border rounded-md p-2"
                  value={importForm.vendor_id}
                  onChange={(e) => setImportForm({ ...importForm, vendor_id: e.target.value })}
                >
                  <option value="">Select vendor...</option>
                  {vendors.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Or Supplier Name</Label>
                <Input
                  value={importForm.supplier_name}
                  onChange={(e) => setImportForm({ ...importForm, supplier_name: e.target.value })}
                  placeholder="If not in vendor list"
                />
              </div>
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <select
                  className="w-full border rounded-md p-2"
                  value={importForm.warehouse_id}
                  onChange={(e) => setImportForm({ ...importForm, warehouse_id: e.target.value })}
                  required
                >
                  <option value="">Select warehouse...</option>
                  {warehouses.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Expected Arrival Date</Label>
                <Input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={importForm.expected_date}
                  onChange={(e) => setImportForm({ ...importForm, expected_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={importForm.notes}
                  onChange={(e) => setImportForm({ ...importForm, notes: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createImportMutation.mutate({
                  warehouse_id: parseInt(importForm.warehouse_id),
                  vendor_id: importForm.vendor_id ? parseInt(importForm.vendor_id) : null,
                  supplier_name: importForm.supplier_name || null,
                  reference_number: importForm.reference_number || null,
                  expected_date: importForm.expected_date || null,
                  notes: importForm.notes || null,
                })}
                disabled={!importForm.warehouse_id || createImportMutation.isPending}
              >
                {createImportMutation.isPending ? 'Scheduling...' : 'Schedule Import'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Vendor Dialog */}
        <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Vendor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Vendor Name *</Label>
                <Input
                  value={vendorForm.name}
                  onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                  placeholder="Company name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input
                  value={vendorForm.contact_person}
                  onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                  placeholder="Contact name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={vendorForm.phone}
                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={vendorForm.email}
                    onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                    placeholder="Email address"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={vendorForm.address}
                  onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                  placeholder="Business address"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={vendorForm.notes}
                  onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })}
                  placeholder="Additional notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsVendorDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createVendorMutation.mutate(vendorForm)}
                disabled={!vendorForm.name || createVendorMutation.isPending}
              >
                {createVendorMutation.isPending ? 'Creating...' : 'Add Vendor'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Transfer Dialog */}
        <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Transfer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Warehouse *</Label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={transferForm.from_warehouse_id}
                    onChange={(e) => setTransferForm({ ...transferForm, from_warehouse_id: e.target.value })}
                    required
                  >
                    <option value="">Select source warehouse...</option>
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>To Branch *</Label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={transferForm.to_branch_id}
                    onChange={(e) => setTransferForm({ ...transferForm, to_branch_id: e.target.value })}
                    required
                  >
                    <option value="">Select destination branch...</option>
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Add Products to Transfer</Label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 border rounded-md p-2"
                    value={transferProductSearch}
                    onChange={(e) => {
                      const productId = e.target.value;
                      if (productId) {
                        const product = products.find((p: any) => p.id.toString() === productId);
                        if (product) addTransferItem(product);
                      }
                    }}
                  >
                    <option value="">Select product to add...</option>
                    {products
                      .filter((p: any) => !transferForm.items.find(i => i.product_id === p.id.toString()))
                      .map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                  </select>
                </div>
              </div>

              {transferForm.items.length > 0 && (
                <div className="space-y-2">
                  <Label>Products to Transfer ({transferForm.items.length})</Label>
                  <div className="border rounded-md max-h-48 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="w-24">Quantity</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transferForm.items.map((item) => (
                          <TableRow key={item.product_id}>
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.requested_quantity}
                                onChange={(e) => updateTransferItemQty(item.product_id, e.target.value)}
                                className="w-20 h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTransferItem(item.product_id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  placeholder="Transfer notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createTransferMutation.mutate({
                  from_warehouse_id: parseInt(transferForm.from_warehouse_id),
                  to_branch_id: parseInt(transferForm.to_branch_id),
                  notes: transferForm.notes || null,
                  items: transferForm.items.map(i => ({
                    product_id: parseInt(i.product_id),
                    requested_quantity: parseInt(i.requested_quantity)
                  }))
                })}
                disabled={!transferForm.from_warehouse_id || !transferForm.to_branch_id || transferForm.items.length === 0 || createTransferMutation.isPending}
              >
                {createTransferMutation.isPending ? 'Creating...' : 'Create Transfer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
