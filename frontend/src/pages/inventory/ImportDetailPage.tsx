import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Package, Check } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';

export default function ImportDetailPage() {
  const { importId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState({
    product_id: '',
    expected_quantity: '',
    unit_cost: '',
  });
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    sku: '',
    unit_price: '',
    cost_price: '',
  });
  const [isNewProduct, setIsNewProduct] = useState(false);

  const { data: importData, isLoading } = useQuery({
    queryKey: ['import', importId],
    queryFn: async () => {
      const response = await api.get(`/inventory/imports/${importId}`);
      return response.data;
    },
    enabled: !!importId,
  });

  const { data: importItems = [] } = useQuery({
    queryKey: ['import-items', importId],
    queryFn: async () => {
      const response = await api.get(`/inventory/imports/${importId}/items`);
      return response.data;
    },
    enabled: !!importId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['all-products'],
    queryFn: async () => {
      const response = await api.get('/sales/products');
      return response.data;
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (data: any) => api.post(`/inventory/imports/${importId}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-items', importId] });
      setIsAddItemDialogOpen(false);
      setItemForm({ product_id: '', expected_quantity: '', unit_cost: '' });
      setNewProductForm({ name: '', sku: '', unit_price: '', cost_price: '' });
      setIsNewProduct(false);
      toast({ title: 'Item added successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to add item', variant: 'destructive' });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: number) => api.delete(`/inventory/imports/${importId}/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-items', importId] });
      toast({ title: 'Item removed' });
    },
  });

  const receiveImportMutation = useMutation({
    mutationFn: () => api.put(`/inventory/imports/${importId}/receive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import', importId] });
      queryClient.invalidateQueries({ queryKey: ['imports'] });
      toast({ title: 'Import received successfully! Stock has been updated.' });
    },
    onError: () => {
      toast({ title: 'Failed to receive import', variant: 'destructive' });
    },
  });

  const handleAddItem = () => {
    if (isNewProduct) {
      // Create new product and add to import
      addItemMutation.mutate({
        new_product: {
          name: newProductForm.name,
          sku: newProductForm.sku || null,
          unit_price: parseFloat(newProductForm.unit_price),
          cost_price: newProductForm.cost_price ? parseFloat(newProductForm.cost_price) : null,
        },
        expected_quantity: parseInt(itemForm.expected_quantity),
        unit_cost: itemForm.unit_cost ? parseFloat(itemForm.unit_cost) : null,
      });
    } else {
      addItemMutation.mutate({
        product_id: parseInt(itemForm.product_id),
        expected_quantity: parseInt(itemForm.expected_quantity),
        unit_cost: itemForm.unit_cost ? parseFloat(itemForm.unit_cost) : null,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'received':
        return <Badge variant="success">Received</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!importData) {
    return <div className="flex items-center justify-center h-64">Import not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory?tab=imports')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              Import #{importData.id}
              {importData.reference_number && ` - ${importData.reference_number}`}
            </h1>
            <p className="text-muted-foreground">
              {importData.supplier_name || importData.vendor?.name || 'Unknown Supplier'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {importData.status === 'pending' && (
            <>
              <Button variant="outline" onClick={() => setIsAddItemDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
              <Button 
                onClick={() => receiveImportMutation.mutate()}
                disabled={importItems.length === 0 || receiveImportMutation.isPending}
              >
                <Check className="mr-2 h-4 w-4" />
                {receiveImportMutation.isPending ? 'Receiving...' : 'Receive Import'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {getStatusBadge(importData.status)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expected Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {importData.expected_date 
                ? new Date(importData.expected_date).toLocaleDateString() 
                : 'Not set'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{importItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              GH₵{importData.total_cost?.toLocaleString() || '0'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Import Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Expected Qty</TableHead>
                <TableHead>Received Qty</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total</TableHead>
                {importData.status === 'pending' && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {importItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No items added yet. Click "Add Item" to add products to this import.
                  </TableCell>
                </TableRow>
              ) : (
                importItems.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product?.name || 'Unknown'}</TableCell>
                    <TableCell className="font-mono text-sm">{item.product?.sku || '-'}</TableCell>
                    <TableCell>{item.expected_quantity}</TableCell>
                    <TableCell>{item.received_quantity || '-'}</TableCell>
                    <TableCell>GH₵{item.unit_cost?.toLocaleString() || '0'}</TableCell>
                    <TableCell className="font-medium">
                      GH₵{((item.unit_cost || 0) * item.expected_quantity).toLocaleString()}
                    </TableCell>
                    {importData.status === 'pending' && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItemMutation.mutate(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Item to Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isNewProduct"
                checked={isNewProduct}
                onChange={(e) => setIsNewProduct(e.target.checked)}
              />
              <Label htmlFor="isNewProduct">Create new product</Label>
            </div>

            {isNewProduct ? (
              <>
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                    placeholder="Enter product name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input
                    value={newProductForm.sku}
                    onChange={(e) => setNewProductForm({ ...newProductForm, sku: e.target.value })}
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sale Price *</Label>
                    <Input
                      type="number"
                      value={newProductForm.unit_price}
                      onChange={(e) => setNewProductForm({ ...newProductForm, unit_price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cost Price</Label>
                    <Input
                      type="number"
                      value={newProductForm.cost_price}
                      onChange={(e) => setNewProductForm({ ...newProductForm, cost_price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Select Product *</Label>
                <select
                  className="w-full border rounded-md p-2"
                  value={itemForm.product_id}
                  onChange={(e) => setItemForm({ ...itemForm, product_id: e.target.value })}
                >
                  <option value="">Select a product...</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={itemForm.expected_quantity}
                  onChange={(e) => setItemForm({ ...itemForm, expected_quantity: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost</Label>
                <Input
                  type="number"
                  value={itemForm.unit_cost}
                  onChange={(e) => setItemForm({ ...itemForm, unit_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={
                (!isNewProduct && !itemForm.product_id) ||
                (isNewProduct && (!newProductForm.name || !newProductForm.unit_price)) ||
                !itemForm.expected_quantity ||
                addItemMutation.isPending
              }
            >
              {addItemMutation.isPending ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
