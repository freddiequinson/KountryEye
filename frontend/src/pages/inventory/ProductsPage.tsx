import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Upload, ArrowLeft, Filter, Trash2, Settings2, Download } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function ProductsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    description: '',
    category_id: '',
    unit_price: '',
    cost_price: '',
    requires_prescription: false,
  });
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    name: '',
    sku: '',
    category: '',
    cost_price: '',
    unit_price: '',
    description: '',
    stock_quantity: '',
  });
  const [showMapping, setShowMapping] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    sku: true,
    name: true,
    category: true,
    costPrice: true,
    salePrice: true,
    totalStock: true,
    warehouseStock: true,
    branchStock: true,
    status: true,
  });
  const [showBranchStock, setShowBranchStock] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search, categoryFilter],
    queryFn: async () => {
      const params: any = {};
      if (search) params.search = search;
      if (categoryFilter && categoryFilter !== 'all') params.category_id = categoryFilter;
      const response = await api.get('/sales/products', { params });
      return response.data;
    },
  });

  // Pagination
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const paginatedProducts = products.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  };

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const response = await api.get('/sales/categories');
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

  const { data: allStock = [] } = useQuery({
    queryKey: ['all-branch-stock'],
    queryFn: async () => {
      const stockData: any[] = [];
      for (const branch of branches) {
        const response = await api.get(`/sales/stock/${branch.id}`);
        stockData.push(...response.data.map((s: any) => ({ ...s, branch_name: branch.name })));
      }
      return stockData;
    },
    enabled: branches.length > 0,
  });

  const { data: stockSummary = [] } = useQuery({
    queryKey: ['stock-summary'],
    queryFn: async () => {
      const response = await api.get('/inventory/stock-summary');
      return response.data;
    },
  });

  const getProductStock = (productId: number) => {
    const stocks = allStock.filter((s: any) => s.product_id === productId);
    const branchTotal = stocks.reduce((sum: number, s: any) => sum + s.quantity, 0);
    const summary = stockSummary.find((s: any) => s.product_id === productId);
    return { 
      branchTotal, 
      warehouseTotal: summary?.warehouse_stock || 0,
      total: (summary?.warehouse_stock || 0) + branchTotal,
      byBranch: stocks 
    };
  };

  const createProductMutation = useMutation({
    mutationFn: (data: any) => api.post('/sales/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsAddDialogOpen(false);
      setProductForm({
        name: '',
        sku: '',
        description: '',
        category_id: '',
        unit_price: '',
        cost_price: '',
        requires_prescription: false,
      });
      toast({ title: 'Product created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create product', variant: 'destructive' });
    },
  });

  const handleCreateProduct = () => {
    if (!productForm.name || !productForm.unit_price) {
      toast({ title: 'Name and price are required', variant: 'destructive' });
      return;
    }
    createProductMutation.mutate({
      ...productForm,
      category_id: productForm.category_id ? parseInt(productForm.category_id) : null,
      unit_price: parseFloat(productForm.unit_price),
      cost_price: productForm.cost_price ? parseFloat(productForm.cost_price) : null,
    });
  };

  const deleteProductMutation = useMutation({
    mutationFn: (productId: number) => api.delete(`/sales/products/${productId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete product', variant: 'destructive' });
    },
  });

  const handleDeleteProduct = (e: React.MouseEvent, productId: number) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this product?')) {
      deleteProductMutation.mutate(productId);
    }
  };

  const filteredProducts = paginatedProducts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Products</h1>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const response = await api.get('/sales/products/export?format=csv', { responseType: 'blob' });
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = 'products.csv';
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (e) {
                toast({ title: 'Export failed', variant: 'destructive' });
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const response = await api.get('/sales/products/export?format=xlsx', { responseType: 'blob' });
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = 'products.xlsx';
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (e) {
                toast({ title: 'Export failed', variant: 'destructive' });
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {products.filter((p: any) => p.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Branches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branches.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
          <SelectTrigger className="w-56">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
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
        <Button variant="outline" onClick={() => setIsColumnDialogOpen(true)}>
          <Settings2 className="mr-2 h-4 w-4" />
          Columns
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.sku && <TableHead>SKU</TableHead>}
              {visibleColumns.name && <TableHead>Name</TableHead>}
              {visibleColumns.category && <TableHead>Category</TableHead>}
              {visibleColumns.costPrice && <TableHead>Cost Price</TableHead>}
              {visibleColumns.salePrice && <TableHead>Sale Price</TableHead>}
              {visibleColumns.totalStock && <TableHead>Total</TableHead>}
              {visibleColumns.warehouseStock && <TableHead>Warehouse</TableHead>}
              {visibleColumns.branchStock && <TableHead>Branches</TableHead>}
              {showBranchStock.map(branchId => {
                const branch = branches.find((b: any) => b.id === branchId);
                return <TableHead key={branchId}>{branch?.name || `Branch ${branchId}`}</TableHead>;
              })}
              {visibleColumns.status && <TableHead>Status</TableHead>}
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10 + showBranchStock.length} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10 + showBranchStock.length} className="text-center py-8">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product: any) => {
                const stock = getProductStock(product.id);
                return (
                  <TableRow
                    key={product.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/inventory/products/${product.id}`)}
                  >
                    {visibleColumns.sku && <TableCell className="font-mono text-sm">{product.sku}</TableCell>}
                    {visibleColumns.name && <TableCell className="font-medium">{product.name}</TableCell>}
                    {visibleColumns.category && (
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{product.category?.name || '-'}</span>
                          {product.category?.category_type && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs w-fit ${
                                product.category.category_type === 'medication' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                product.category.category_type === 'optical' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                'bg-gray-50 text-gray-600'
                              }`}
                            >
                              {product.category.category_type}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.costPrice && <TableCell>GH₵{product.cost_price?.toLocaleString() || '0'}</TableCell>}
                    {visibleColumns.salePrice && <TableCell>GH₵{product.unit_price?.toLocaleString() || '0'}</TableCell>}
                    {visibleColumns.totalStock && (
                      <TableCell>
                        <Badge variant={stock.total > 10 ? 'success' : stock.total > 0 ? 'warning' : 'destructive'}>
                          {stock.total}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.warehouseStock && (
                      <TableCell>
                        <Badge variant={stock.warehouseTotal > 10 ? 'secondary' : stock.warehouseTotal > 0 ? 'warning' : 'outline'}>
                          {stock.warehouseTotal}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.branchStock && (
                      <TableCell>
                        <Badge variant={stock.branchTotal > 10 ? 'success' : stock.branchTotal > 0 ? 'warning' : 'destructive'}>
                          {stock.branchTotal}
                        </Badge>
                      </TableCell>
                    )}
                    {showBranchStock.map(branchId => {
                      const branchStock = stock.byBranch.find((s: any) => s.branch_id === branchId);
                      return (
                        <TableCell key={branchId}>
                          <Badge variant={branchStock?.quantity > 5 ? 'secondary' : branchStock?.quantity > 0 ? 'warning' : 'destructive'}>
                            {branchStock?.quantity || 0}
                          </Badge>
                        </TableCell>
                      );
                    })}
                    {visibleColumns.status && (
                      <TableCell>
                        <Badge variant={product.is_active ? 'success' : 'destructive'}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => handleDeleteProduct(e, product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, products.length)} of {products.length} entries
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Enter product name"
              />
            </div>
            <div className="space-y-2">
              <Label>SKU (Optional)</Label>
              <Input
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                placeholder="Auto-generated if empty"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={productForm.category_id}
                onValueChange={(value) => setProductForm({ ...productForm, category_id: value })}
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
                Medication categories show when prescribing medications. Optical for glasses/lens.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cost Price</Label>
                <Input
                  type="number"
                  value={productForm.cost_price}
                  onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Sale Price *</Label>
                <Input
                  type="number"
                  value={productForm.unit_price}
                  onChange={(e) => setProductForm({ ...productForm, unit_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requires_prescription"
                checked={productForm.requires_prescription}
                onChange={(e) => setProductForm({ ...productForm, requires_prescription: e.target.checked })}
              />
              <Label htmlFor="requires_prescription">Requires Prescription</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProduct} disabled={createProductMutation.isPending}>
              {createProductMutation.isPending ? 'Creating...' : 'Create Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
        setIsImportDialogOpen(open);
        if (!open) {
          setCsvFile(null);
          setImportResult(null);
          setCsvHeaders([]);
          setShowMapping(false);
          setColumnMapping({
            name: '',
            sku: '',
            category: '',
            cost_price: '',
            unit_price: '',
            description: '',
            stock_quantity: '',
            branch_id: '',
          });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Products from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!importResult ? (
              <>
                {!showMapping ? (
                  <>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground mb-2">
                        {csvFile ? csvFile.name : 'Select a CSV file to import'}
                      </p>
                      <Input
                        type="file"
                        accept=".csv"
                        className="max-w-xs mx-auto"
                        onChange={async (e) => {
                          const file = e.target.files?.[0] || null;
                          setCsvFile(file);
                          if (file) {
                            const text = await file.text();
                            const firstLine = text.split('\n')[0];
                            const headers = firstLine.split(',').map(h => h.trim().replace(/"/g, ''));
                            setCsvHeaders(headers);
                            // Auto-map columns if names match
                            const newMapping: Record<string, string> = { ...columnMapping };
                            headers.forEach(h => {
                              const lower = h.toLowerCase();
                              if (lower.includes('name') && !lower.includes('category')) newMapping.name = h;
                              if (lower === 'sku' || lower.includes('sku')) newMapping.sku = h;
                              if (lower.includes('category')) newMapping.category = h;
                              if (lower.includes('cost')) newMapping.cost_price = h;
                              if (lower.includes('price') && !lower.includes('cost')) newMapping.unit_price = h;
                              if (lower.includes('desc')) newMapping.description = h;
                              if (lower.includes('stock') || lower.includes('quantity') || lower.includes('qty')) newMapping.stock_quantity = h;
                            });
                            setColumnMapping(newMapping);
                          }
                        }}
                      />
                    </div>
                    {csvFile && csvHeaders.length > 0 && (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setShowMapping(true)}
                      >
                        <Settings2 className="mr-2 h-4 w-4" />
                        Configure Column Mapping
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Map CSV Columns</h3>
                      <Button variant="ghost" size="sm" onClick={() => setShowMapping(false)}>
                        Back
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Match your CSV columns to the product fields
                    </p>
                    <div className="grid gap-3">
                      {[
                        { key: 'name', label: 'Product Name *', required: true },
                        { key: 'sku', label: 'SKU', required: false },
                        { key: 'category', label: 'Category', required: false },
                        { key: 'cost_price', label: 'Cost Price', required: false },
                        { key: 'unit_price', label: 'Sale Price *', required: true },
                        { key: 'description', label: 'Description', required: false },
                        { key: 'stock_quantity', label: 'Stock Quantity', required: false },
                        { key: 'branch_id', label: 'Branch ID', required: false },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-4">
                          <Label className="w-32 text-sm">{label}</Label>
                          <Select
                            value={columnMapping[key] || '__none__'}
                            onValueChange={(v) => setColumnMapping({ ...columnMapping, [key]: v === '__none__' ? '' : v })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">-- None --</SelectItem>
                              {csvHeaders.map(h => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-600">Created</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{importResult.created}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-blue-600">Updated</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{importResult.updated}</p>
                    </CardContent>
                  </Card>
                </div>
                {importResult.total_errors > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-medium text-red-800 mb-2">
                      {importResult.total_errors} errors occurred
                    </p>
                    <ul className="text-sm text-red-600 space-y-1">
                      {importResult.errors.map((err: string, i: number) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsImportDialogOpen(false);
              setCsvFile(null);
              setImportResult(null);
              setCsvHeaders([]);
              setShowMapping(false);
            }}>
              {importResult ? 'Close' : 'Cancel'}
            </Button>
            {!importResult && csvFile && (
              <Button
                disabled={!columnMapping.name || !columnMapping.unit_price}
                onClick={async () => {
                  if (!csvFile) return;
                  const formData = new FormData();
                  formData.append('file', csvFile);
                  formData.append('column_mapping', JSON.stringify(columnMapping));
                  try {
                    const response = await api.post('/sales/products/import-csv', formData, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    setImportResult(response.data);
                    queryClient.invalidateQueries({ queryKey: ['products'] });
                    queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
                    queryClient.invalidateQueries({ queryKey: ['all-branch-stock'] });
                    toast({ title: `Imported ${response.data.created} products, ${response.data.stock_records || 0} stock records` });
                  } catch (error: any) {
                    toast({
                      title: 'Import failed',
                      description: error.response?.data?.detail || 'Unknown error',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                Import Products
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column Settings Dialog */}
      <Dialog open={isColumnDialogOpen} onOpenChange={setIsColumnDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Column Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-medium">Visible Columns</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries({
                  sku: 'SKU',
                  name: 'Name',
                  category: 'Category',
                  costPrice: 'Cost Price',
                  salePrice: 'Sale Price',
                  totalStock: 'Total Stock',
                  warehouseStock: 'Warehouse Stock',
                  branchStock: 'Branches Stock',
                  status: 'Status',
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`col-${key}`}
                      checked={visibleColumns[key as keyof typeof visibleColumns]}
                      onChange={(e) => setVisibleColumns({
                        ...visibleColumns,
                        [key]: e.target.checked,
                      })}
                    />
                    <Label htmlFor={`col-${key}`} className="text-sm">{label}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Show Stock by Branch</Label>
              <div className="grid grid-cols-2 gap-2">
                {branches.map((branch: any) => (
                  <div key={branch.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`branch-${branch.id}`}
                      checked={showBranchStock.includes(branch.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setShowBranchStock([...showBranchStock, branch.id]);
                        } else {
                          setShowBranchStock(showBranchStock.filter(id => id !== branch.id));
                        }
                      }}
                    />
                    <Label htmlFor={`branch-${branch.id}`} className="text-sm">{branch.name}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsColumnDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
