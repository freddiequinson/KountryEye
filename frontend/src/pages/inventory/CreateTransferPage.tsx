import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Search } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

export default function CreateTransferPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<{ product_id: number; product_name: string; sku: string; requested_quantity: number }[]>([]);

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await api.get('/inventory/warehouses');
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

  const { data: products = [] } = useQuery({
    queryKey: ['transfer-products'],
    queryFn: async () => {
      const response = await api.get('/sales/products');
      return response.data;
    },
  });

  const createTransferMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/transfers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      toast({ title: 'Transfer created successfully' });
      navigate('/inventory?tab=transfers');
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to create transfer', 
        description: error.response?.data?.detail || 'Unknown error',
        variant: 'destructive' 
      });
    },
  });

  const filteredProducts = products.filter((p: any) => 
    !items.find(i => i.product_id === p.id) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     p.sku?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addItem = (product: any) => {
    setItems([...items, {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku || '',
      requested_quantity: 1
    }]);
    setSearchTerm('');
  };

  const removeItem = (productId: number) => {
    setItems(items.filter(i => i.product_id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    setItems(items.map(i => 
      i.product_id === productId ? { ...i, requested_quantity: Math.max(1, quantity) } : i
    ));
  };

  const handleSubmit = () => {
    if (!fromWarehouseId || !toBranchId || items.length === 0) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    createTransferMutation.mutate({
      from_warehouse_id: parseInt(fromWarehouseId),
      to_branch_id: parseInt(toBranchId),
      notes: notes || null,
      items: items.map(i => ({
        product_id: i.product_id,
        requested_quantity: i.requested_quantity
      }))
    });
  };

  const totalItems = items.reduce((sum, i) => sum + i.requested_quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory?tab=transfers')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create Transfer</h1>
            <p className="text-muted-foreground">Move products between warehouse and branch</p>
          </div>
        </div>
        <Button 
          onClick={handleSubmit}
          disabled={!fromWarehouseId || !toBranchId || items.length === 0 || createTransferMutation.isPending}
        >
          {createTransferMutation.isPending ? 'Creating...' : 'Create Transfer'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transfer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>From Warehouse *</Label>
              <select
                className="w-full border rounded-md p-2"
                value={fromWarehouseId}
                onChange={(e) => setFromWarehouseId(e.target.value)}
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
                value={toBranchId}
                onChange={(e) => setToBranchId(e.target.value)}
              >
                <option value="">Select destination branch...</option>
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional transfer notes"
              />
            </div>
            <div className="pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span>Total Products:</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Total Items:</span>
                <span className="font-medium">{totalItems}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Products to Transfer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search products by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {searchTerm && filteredProducts.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-auto">
                  {filteredProducts.slice(0, 10).map((product: any) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                      onClick={() => addItem(product)}
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.sku}</p>
                      </div>
                      <Button size="sm" variant="ghost">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-md">
                  Search and add products to transfer
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="w-32">Quantity</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.requested_quantity}
                            onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1)}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.product_id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
