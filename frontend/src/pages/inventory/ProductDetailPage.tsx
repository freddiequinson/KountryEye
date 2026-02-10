import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Pencil, TrendingUp, Package, DollarSign, History, Building2, Image, Trophy } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isNewProduct = !productId || productId === 'new';

  const [isEditing, setIsEditing] = useState(isNewProduct);
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [isStockAdjustDialogOpen, setIsStockAdjustDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(isNewProduct ? {
    name: '',
    sku: '',
    category_id: '',
    description: '',
    unit_price: '',
    cost_price: '',
    reorder_level: '10',
    initial_stock: '0',
    branch_id: '1',
  } : {});
  const [priceForm, setPriceForm] = useState({ new_price: '', reason: '' });
  const [discountForm, setDiscountForm] = useState({ 
    discount_percent: '', 
    discount_amount: '',
    start_date: '',
    end_date: '',
  });
  const [stockAdjustForm, setStockAdjustForm] = useState({
    branch_id: '1',
    quantity_change: '',
    reason: '',
    adjustment_type: 'add',
  });

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const response = await api.get(`/sales/products/${productId}`);
      return response.data;
    },
    enabled: !isNewProduct && !!productId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const response = await api.get('/sales/categories');
      return response.data;
    },
  });

  const { data: branchStock = [] } = useQuery({
    queryKey: ['product-branch-stock', productId],
    queryFn: async () => {
      const response = await api.get(`/inventory/products/${productId}/stock`);
      return response.data;
    },
    enabled: !isNewProduct && !!productId,
  });

  const { data: priceHistory = [] } = useQuery({
    queryKey: ['product-price-history', productId],
    queryFn: async () => {
      const response = await api.get(`/inventory/products/${productId}/price-history`);
      return response.data;
    },
    enabled: !isNewProduct && !!productId,
  });

  const { data: salesData } = useQuery({
    queryKey: ['product-sales', productId],
    queryFn: async () => {
      const response = await api.get(`/inventory/products/${productId}/sales`);
      return response.data;
    },
    enabled: !isNewProduct && !!productId,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await api.get('/branches');
      return response.data;
    },
  });

  const { data: productRank } = useQuery({
    queryKey: ['product-rank', productId],
    queryFn: async () => {
      const response = await api.get(`/sales/products/${productId}/rank`);
      return response.data;
    },
    enabled: !isNewProduct && !!productId,
  });

  const updateProductMutation = useMutation({
    mutationFn: (data: any) => api.put(`/sales/products/${productId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      setIsEditing(false);
      toast({ title: 'Product updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update product', variant: 'destructive' });
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: (data: any) => api.post(`/inventory/products/${productId}/price`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['product-price-history', productId] });
      setIsPriceDialogOpen(false);
      setPriceForm({ new_price: '', reason: '' });
      toast({ title: 'Price updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update price', variant: 'destructive' });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: (data: any) => api.post('/sales/products', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product created successfully' });
      navigate(`/inventory/products/${response.data.id}`);
    },
    onError: () => {
      toast({ title: 'Failed to create product', variant: 'destructive' });
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: (data: any) => api.post(`/inventory/products/${productId}/adjust-stock`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-branch-stock', productId] });
      setIsStockAdjustDialogOpen(false);
      setStockAdjustForm({ branch_id: '1', quantity_change: '', reason: '', adjustment_type: 'add' });
      toast({ title: 'Stock adjusted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to adjust stock', variant: 'destructive' });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      // Use axios with transformRequest to handle FormData properly
      return api.post(`/sales/products/${productId}/image`, formData, {
        transformRequest: [(data) => data],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Image uploaded successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to upload image', variant: 'destructive' });
    },
  });

  const handleStartEdit = () => {
    setEditForm({
      name: product?.name || '',
      sku: product?.sku || '',
      description: product?.description || '',
      category_id: product?.category_id?.toString() || '',
      cost_price: product?.cost_price?.toString() || '',
      unit_price: product?.unit_price?.toString() || '',
      requires_prescription: product?.requires_prescription || false,
      is_active: product?.is_active ?? true,
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (isNewProduct) {
      createProductMutation.mutate({
        name: editForm.name,
        sku: editForm.sku || null,
        description: editForm.description || null,
        category_id: editForm.category_id ? parseInt(editForm.category_id) : null,
        cost_price: editForm.cost_price ? parseFloat(editForm.cost_price) : null,
        unit_price: parseFloat(editForm.unit_price),
        reorder_level: editForm.reorder_level ? parseInt(editForm.reorder_level) : 10,
        initial_stock: editForm.initial_stock ? parseInt(editForm.initial_stock) : 0,
        branch_id: editForm.branch_id ? parseInt(editForm.branch_id) : 1,
      });
    } else {
      updateProductMutation.mutate({
        ...editForm,
        category_id: editForm.category_id ? parseInt(editForm.category_id) : null,
        cost_price: editForm.cost_price ? parseFloat(editForm.cost_price) : null,
        unit_price: parseFloat(editForm.unit_price),
      });
    }
  };

  const handlePriceChange = () => {
    if (!priceForm.new_price) {
      toast({ title: 'Please enter a new price', variant: 'destructive' });
      return;
    }
    updatePriceMutation.mutate({
      new_price: parseFloat(priceForm.new_price),
      reason: priceForm.reason,
    });
  };

  const handleStockAdjust = () => {
    if (!stockAdjustForm.quantity_change || !stockAdjustForm.reason) {
      toast({ title: 'Please enter quantity and reason', variant: 'destructive' });
      return;
    }
    const qty = parseInt(stockAdjustForm.quantity_change);
    adjustStockMutation.mutate({
      branch_id: parseInt(stockAdjustForm.branch_id),
      quantity_change: stockAdjustForm.adjustment_type === 'add' ? qty : -qty,
      reason: stockAdjustForm.reason,
    });
  };

  const totalStock = branchStock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);

  if (!isNewProduct && isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!isNewProduct && !product) {
    return <div className="flex items-center justify-center h-64">Product not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/products')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{isNewProduct ? 'New Product' : product?.name}</h1>
            {!isNewProduct && <p className="text-muted-foreground font-mono">{product?.sku}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              {!isNewProduct && <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>}
              <Button onClick={handleSave} disabled={createProductMutation.isPending || updateProductMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {isNewProduct ? 'Create Product' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsStockAdjustDialogOpen(true)}>
                <Package className="mr-2 h-4 w-4" />
                Adjust Stock
              </Button>
              <Button variant="outline" onClick={() => setIsPriceDialogOpen(true)}>
                <DollarSign className="mr-2 h-4 w-4" />
                Change Price
              </Button>
              <Button onClick={handleStartEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Product
              </Button>
            </>
          )}
        </div>
      </div>

      {!isNewProduct && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Total Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStock}</div>
              <p className="text-xs text-muted-foreground">Across all branches</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Sale Price
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">GH₵{product?.unit_price?.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Cost: GH₵{product?.cost_price?.toLocaleString() || '0'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salesData?.total_quantity || 0}</div>
              <p className="text-xs text-muted-foreground">Units sold</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">GH₵{salesData?.total_revenue?.toLocaleString() || '0'}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sales Rank Card */}
      {!isNewProduct && productRank && (
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Sales Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">
                  #{productRank.rank}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {productRank.total_products} products
                </p>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Percentile</span>
                  <span className="font-medium">{productRank.percentile}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${productRank.percentile}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {productRank.total_sold} units sold total
                </p>
              </div>
              {productRank.top_3?.length > 0 && (
                <div className="border-l pl-4">
                  <p className="text-xs font-medium mb-2">Top Sellers</p>
                  {productRank.top_3.slice(0, 3).map((item: any, idx: number) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs">
                      <span className={`font-bold ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : 'text-amber-600'}`}>
                        #{idx + 1}
                      </span>
                      <span className="truncate max-w-[100px]">{item.name}</span>
                      <span className="text-muted-foreground">({item.total_sold})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="stock">Stock by Branch</TabsTrigger>
          <TabsTrigger value="price-history">Price History</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {isEditing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Product Name</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input
                      value={editForm.sku}
                      onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={editForm.category_id}
                      onValueChange={(value) => setEditForm({ ...editForm, category_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat: any) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            <span className="flex items-center gap-2">
                              {cat.name}
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                cat.category_type === 'medication' ? 'bg-blue-100 text-blue-700' :
                                cat.category_type === 'optical' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {cat.category_type || 'general'}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Medication categories show when prescribing medications. Optical categories for glasses/lens.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Cost Price</Label>
                    <Input
                      type="number"
                      value={editForm.cost_price}
                      onChange={(e) => setEditForm({ ...editForm, cost_price: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sale Price</Label>
                    <Input
                      type="number"
                      value={editForm.unit_price}
                      onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  {isNewProduct && (
                    <>
                      <div className="space-y-2">
                        <Label>Initial Stock Quantity</Label>
                        <Input
                          type="number"
                          min="0"
                          value={editForm.initial_stock}
                          onChange={(e) => setEditForm({ ...editForm, initial_stock: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Branch for Initial Stock</Label>
                        <Select
                          value={editForm.branch_id}
                          onValueChange={(v) => setEditForm({ ...editForm, branch_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((b: any) => (
                              <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Reorder Level</Label>
                        <Input
                          type="number"
                          min="0"
                          value={editForm.reorder_level}
                          onChange={(e) => setEditForm({ ...editForm, reorder_level: e.target.value })}
                          placeholder="10"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="requires_prescription"
                        checked={editForm.requires_prescription}
                        onChange={(e) => setEditForm({ ...editForm, requires_prescription: e.target.checked })}
                      />
                      <Label htmlFor="requires_prescription">Requires Prescription</Label>
                    </div>
                    {!isNewProduct && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_active"
                          checked={editForm.is_active}
                          onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                        />
                        <Label htmlFor="is_active">Active</Label>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium">{product.category?.name || 'Uncategorized'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={product.is_active ? 'success' : 'destructive'}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Requires Prescription</p>
                    <Badge variant={product.requires_prescription ? 'warning' : 'secondary'}>
                      {product.requires_prescription ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {product.created_at ? new Date(product.created_at).toLocaleDateString() : '-'}
                    </p>
                  </div>
                  {product.description && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p>{product.description}</p>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-2">Product Image</p>
                    <div className="flex items-start gap-4">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-32 h-32 object-cover rounded-lg border"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-32 h-32 bg-muted rounded-lg border flex items-center justify-center">
                          <Image className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <input
                          type="file"
                          id="product-image"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              uploadImageMutation.mutate(file);
                            }
                          }}
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => document.getElementById('product-image')?.click()}
                          disabled={uploadImageMutation.isPending}
                        >
                          <Image className="mr-2 h-4 w-4" />
                          {uploadImageMutation.isPending ? 'Uploading...' : product.image_url ? 'Change Image' : 'Upload Image'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">
                          JPEG, PNG, GIF or WEBP. Max 5MB.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Stock by Branch
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Min Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Restocked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchStock.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        No stock records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    branchStock.map((stock: any) => (
                      <TableRow key={stock.id}>
                        <TableCell className="font-medium">{stock.branch?.name || `Branch #${stock.branch_id}`}</TableCell>
                        <TableCell>{stock.quantity}</TableCell>
                        <TableCell>{stock.min_quantity}</TableCell>
                        <TableCell>
                          <Badge variant={stock.quantity <= stock.min_quantity ? 'destructive' : 'success'}>
                            {stock.quantity <= stock.min_quantity ? 'Low Stock' : 'In Stock'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {stock.last_restocked ? new Date(stock.last_restocked).toLocaleDateString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="price-history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Price History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Old Price</TableHead>
                    <TableHead>New Price</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        No price changes recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    priceHistory.map((history: any) => (
                      <TableRow key={history.id}>
                        <TableCell>
                          {new Date(history.changed_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>GH₵{history.old_price?.toLocaleString() || '0'}</TableCell>
                        <TableCell>GH₵{history.new_price?.toLocaleString()}</TableCell>
                        <TableCell>{history.changed_by?.first_name || '-'}</TableCell>
                        <TableCell>{history.reason || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Sales Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Units Sold</p>
                  <p className="text-2xl font-bold">{salesData?.total_quantity || 0}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">GH₵{salesData?.total_revenue?.toLocaleString() || '0'}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Avg. Sale Price</p>
                  <p className="text-2xl font-bold">
                    GH₵{salesData?.total_quantity ? (salesData.total_revenue / salesData.total_quantity).toFixed(2) : '0'}
                  </p>
                </div>
              </div>
              
              <h4 className="font-medium mb-4">Recent Sales</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!salesData?.history || salesData.history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No sales recorded for this product
                      </TableCell>
                    </TableRow>
                  ) : (
                    salesData.history.map((sale: any) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {sale.date ? new Date(sale.date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{sale.receipt_number}</TableCell>
                        <TableCell>{sale.quantity}</TableCell>
                        <TableCell>GH₵{sale.unit_price?.toLocaleString()}</TableCell>
                        <TableCell className="font-medium">GH₵{sale.total?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Change Price Dialog */}
      <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Product Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Price</p>
              <p className="text-xl font-bold">GH₵{product?.unit_price?.toLocaleString() || '0'}</p>
            </div>
            <div className="space-y-2">
              <Label>New Price *</Label>
              <Input
                type="number"
                value={priceForm.new_price}
                onChange={(e) => setPriceForm({ ...priceForm, new_price: e.target.value })}
                placeholder="Enter new price"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason for Change</Label>
              <Textarea
                value={priceForm.reason}
                onChange={(e) => setPriceForm({ ...priceForm, reason: e.target.value })}
                placeholder="Optional: explain the price change"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPriceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePriceChange} disabled={updatePriceMutation.isPending}>
              {updatePriceMutation.isPending ? 'Updating...' : 'Update Price'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={isStockAdjustDialogOpen} onOpenChange={setIsStockAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock Quantity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Branch *</Label>
              <Select
                value={stockAdjustForm.branch_id}
                onValueChange={(v) => setStockAdjustForm({ ...stockAdjustForm, branch_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b: any) => (
                    <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <Select
                value={stockAdjustForm.adjustment_type}
                onValueChange={(v) => setStockAdjustForm({ ...stockAdjustForm, adjustment_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Stock</SelectItem>
                  <SelectItem value="remove">Remove Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                min="1"
                value={stockAdjustForm.quantity_change}
                onChange={(e) => setStockAdjustForm({ ...stockAdjustForm, quantity_change: e.target.value })}
                placeholder="Enter quantity"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select
                value={stockAdjustForm.reason}
                onValueChange={(v) => setStockAdjustForm({ ...stockAdjustForm, reason: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inventory_count">Inventory Count Correction</SelectItem>
                  <SelectItem value="damaged">Damaged/Expired</SelectItem>
                  <SelectItem value="returned">Customer Return</SelectItem>
                  <SelectItem value="transfer_in">Transfer In</SelectItem>
                  <SelectItem value="transfer_out">Transfer Out</SelectItem>
                  <SelectItem value="new_stock">New Stock Received</SelectItem>
                  <SelectItem value="theft_loss">Theft/Loss</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStockAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStockAdjust} disabled={adjustStockMutation.isPending}>
              {adjustStockMutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
