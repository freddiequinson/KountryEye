import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, DollarSign, ShoppingCart, Search } from 'lucide-react';
import { SalesReceiptModal } from '@/components/SalesReceiptModal';
import api from '@/lib/api';
import { Sale, Product } from '@/types';
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
import { useToast } from '@/hooks/use-toast';

interface CartItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

export default function SalesPage() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const response = await api.get('/sales');
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

  // Create branch lookup map
  const branchMap = branches.reduce((acc: Record<number, string>, branch: any) => {
    acc[branch.id] = branch.name;
    return acc;
  }, {});

  // Pagination
  const totalPages = Math.ceil(sales.length / itemsPerPage);
  const paginatedSales = sales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const { data: products = [] } = useQuery({
    queryKey: ['products', productSearch],
    queryFn: async () => {
      const response = await api.get('/sales/products', {
        params: { search: productSearch },
      });
      return response.data;
    },
  });

  const createSaleMutation = useMutation({
    mutationFn: (data: any) => api.post('/sales/create', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      setIsDialogOpen(false);
      setCart([]);
      setDiscountPercent(0);
      toast({ title: 'Sale completed successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to complete sale', variant: 'destructive' });
    },
  });

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product_id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.unit_price,
          discount: 0,
        },
      ]);
    }
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return;
    setCart(
      cart.map((item) =>
        item.product_id === productId ? { ...item, quantity } : item
      )
    );
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.unit_price * item.quantity - item.discount,
    0
  );
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal - discountAmount;

  const handleCompleteSale = () => {
    createSaleMutation.mutate({
      branch_id: 1,
      items: cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
      })),
      discount_percent: discountPercent,
      discount_amount: 0,
      payment_method: 'cash',
    });
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Sales</h1>
          <Button onClick={() => navigate('/sales/pos')}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Open POS
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sales
                  .filter(
                    (s: Sale) =>
                      new Date(s.created_at).toDateString() ===
                      new Date().toDateString()
                  )
                  .reduce((sum: number, s: Sale) => sum + s.total_amount, 0)
                  .toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'GHS',
                  })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  sales.filter(
                    (s: Sale) =>
                      new Date(s.created_at).toDateString() ===
                      new Date().toDateString()
                  ).length
                }
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : paginatedSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    No sales found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSales.map((sale: Sale) => (
                  <TableRow 
                    key={sale.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedSale(sale);
                      setIsReceiptOpen(true);
                    }}
                  >
                    <TableCell className="font-medium">
                      {sale.receipt_number}
                    </TableCell>
                    <TableCell>
                      {new Date(sale.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {branchMap[sale.branch_id] || `Branch ${sale.branch_id}`}
                    </TableCell>
                    <TableCell>
                      {sale.subtotal?.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'GHS',
                      }) || 'GH₵0'}
                    </TableCell>
                    <TableCell>
                      {sale.discount_amount?.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'GHS',
                      }) || 'GH₵0'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {sale.total_amount?.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'GHS',
                      }) || 'GH₵0'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {(sale as any).payment_method || 'cash'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">
                        Completed
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sales.length)} of {sales.length} entries
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>New Sale</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label>Search Products</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="border rounded-md max-h-64 overflow-auto">
                  {products.map((product: Product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                      onClick={() => addToCart(product)}
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.sku}
                        </p>
                      </div>
                      <p className="font-medium">
                        {product.unit_price.toLocaleString('en-US', {
                          style: 'currency',
                          currency: 'GHS',
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Label>Cart</Label>
                <div className="border rounded-md">
                  {cart.length === 0 ? (
                    <p className="p-4 text-center text-muted-foreground">
                      No items in cart
                    </p>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.product_id}
                        className="flex items-center justify-between p-3 border-b last:border-0"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.unit_price.toLocaleString('en-US', {
                              style: 'currency',
                              currency: 'GHS',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateQuantity(item.product_id, item.quantity - 1)
                            }
                          >
                            -
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateQuantity(item.product_id, item.quantity + 1)
                            }
                          >
                            +
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.product_id)}
                          >
                            X
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>
                      {subtotal.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'GHS',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Discount %</Label>
                    <Input
                      type="number"
                      value={discountPercent}
                      onChange={(e) =>
                        setDiscountPercent(Number(e.target.value))
                      }
                      className="w-20"
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>
                      {total.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'GHS',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCompleteSale}
                disabled={cart.length === 0 || createSaleMutation.isPending}
              >
                {createSaleMutation.isPending ? 'Processing...' : 'Complete Sale'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sales Receipt Modal */}
        <SalesReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          sale={selectedSale}
        />
    </div>
  );
}
