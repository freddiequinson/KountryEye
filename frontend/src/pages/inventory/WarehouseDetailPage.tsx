import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Truck, Search } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function WarehouseDetailPage() {
  const { warehouseId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    to_branch_id: '',
    items: [] as { product_id: number; product_name: string; quantity: number; max_quantity: number }[],
  });

  const { data: warehouse, isLoading } = useQuery({
    queryKey: ['warehouse', warehouseId],
    queryFn: async () => {
      const response = await api.get(`/inventory/warehouses/${warehouseId}`);
      return response.data;
    },
    enabled: !!warehouseId,
  });

  const { data: stock = [] } = useQuery({
    queryKey: ['warehouse-stock', warehouseId],
    queryFn: async () => {
      const response = await api.get(`/inventory/warehouses/${warehouseId}/stock`);
      return response.data;
    },
    enabled: !!warehouseId,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await api.get('/branches');
      return response.data;
    },
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['warehouse-transfers', warehouseId],
    queryFn: async () => {
      const response = await api.get('/inventory/transfers', {
        params: { from_warehouse_id: warehouseId }
      });
      return response.data;
    },
    enabled: !!warehouseId,
  });

  const createTransferMutation = useMutation({
    mutationFn: async (data: any) => {
      // Create transfer
      const response = await api.post('/inventory/transfers', data);
      const transferId = response.data.id;
      // Auto-approve and complete the transfer
      await api.put(`/inventory/transfers/${transferId}/approve`);
      await api.put(`/inventory/transfers/${transferId}/complete`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-transfers', warehouseId] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseId] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      queryClient.invalidateQueries({ queryKey: ['all-branch-stock'] });
      setIsTransferDialogOpen(false);
      setTransferForm({ to_branch_id: '', items: [] });
      toast({ title: 'Stock transferred successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to transfer stock', variant: 'destructive' });
    },
  });

  const addItemToTransfer = (stockItem: any) => {
    if (transferForm.items.find(i => i.product_id === stockItem.product_id)) {
      toast({ title: 'Product already added', variant: 'destructive' });
      return;
    }
    setTransferForm({
      ...transferForm,
      items: [...transferForm.items, {
        product_id: stockItem.product_id,
        product_name: stockItem.product?.name || `Product #${stockItem.product_id}`,
        quantity: 1,
        max_quantity: stockItem.quantity,
      }],
    });
  };

  const updateTransferItemQuantity = (productId: number, quantity: number) => {
    setTransferForm({
      ...transferForm,
      items: transferForm.items.map(item =>
        item.product_id === productId
          ? { ...item, quantity: Math.min(quantity, item.max_quantity) }
          : item
      ),
    });
  };

  const removeTransferItem = (productId: number) => {
    setTransferForm({
      ...transferForm,
      items: transferForm.items.filter(item => item.product_id !== productId),
    });
  };

  const handleCreateTransfer = () => {
    if (!transferForm.to_branch_id) {
      toast({ title: 'Please select a destination branch', variant: 'destructive' });
      return;
    }
    if (transferForm.items.length === 0) {
      toast({ title: 'Please add items to transfer', variant: 'destructive' });
      return;
    }
    createTransferMutation.mutate({
      from_warehouse_id: parseInt(warehouseId!),
      to_branch_id: parseInt(transferForm.to_branch_id),
      items: transferForm.items.map(item => ({
        product_id: item.product_id,
        requested_quantity: item.quantity,
      })),
    });
  };

  const filteredStock = stock.filter((s: any) =>
    s.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.product?.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const totalItems = stock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);
  const lowStockItems = stock.filter((s: any) => s.quantity <= s.min_quantity).length;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{warehouse?.name || 'Warehouse'}</h1>
            <p className="text-muted-foreground">{warehouse?.location || 'No location set'}</p>
          </div>
        </div>
        <Button onClick={() => setIsTransferDialogOpen(true)}>
          <Truck className="mr-2 h-4 w-4" />
          Create Transfer
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stock.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{lowStockItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transfers.filter((t: any) => t.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Min Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No stock found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStock.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.product?.sku || '-'}</TableCell>
                      <TableCell className="font-medium">{item.product?.name || `Product #${item.product_id}`}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.min_quantity}</TableCell>
                      <TableCell>
                        <Badge variant={item.quantity <= item.min_quantity ? 'destructive' : 'success'}>
                          {item.quantity <= item.min_quantity ? 'Low Stock' : 'In Stock'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsTransferDialogOpen(true);
                            addItemToTransfer(item);
                          }}
                        >
                          <Truck className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="transfers" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>To Branch</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No transfers found
                    </TableCell>
                  </TableRow>
                ) : (
                  transfers.map((transfer: any) => (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-medium">#{transfer.id}</TableCell>
                      <TableCell>{transfer.to_branch?.name || `Branch #${transfer.to_branch_id}`}</TableCell>
                      <TableCell>{transfer.items?.length || 0} items</TableCell>
                      <TableCell>
                        {new Date(transfer.request_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transfer.status === 'completed' ? 'success' :
                            transfer.status === 'approved' ? 'warning' : 'secondary'
                          }
                        >
                          {transfer.status}
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

      {/* Create Transfer Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Stock Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destination Branch *</Label>
              <Select
                value={transferForm.to_branch_id}
                onValueChange={(value) => setTransferForm({ ...transferForm, to_branch_id: value })}
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
              <Label>Items to Transfer</Label>
              {transferForm.items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                  No items added. Select products from the stock list.
                </p>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transferForm.items.map((item) => (
                        <TableRow key={item.product_id}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              max={item.max_quantity}
                              value={item.quantity}
                              onChange={(e) => updateTransferItemQuantity(item.product_id, parseInt(e.target.value) || 1)}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>{item.max_quantity}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTransferItem(item.product_id)}
                            >
                              ×
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTransfer} disabled={createTransferMutation.isPending}>
              {createTransferMutation.isPending ? 'Creating...' : 'Create Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
