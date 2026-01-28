import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Minus, Trash2, ShoppingCart, User, CreditCard, Banknote, Receipt } from 'lucide-react';
import { SalesReceiptModal } from '@/components/SalesReceiptModal';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface CartItem {
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
}

export default function POSPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['pos-products', search],
    queryFn: async () => {
      const response = await api.get('/sales/products', { params: { search } });
      return response.data;
    },
  });

  // Fetch stock for branch 1 (TODO: use user's current branch)
  const { data: branchStock = [] } = useQuery({
    queryKey: ['pos-branch-stock'],
    queryFn: async () => {
      const response = await api.get('/sales/stock/1');
      return response.data;
    },
  });

  const getProductStock = (productId: number) => {
    const stock = branchStock.find((s: any) => s.product_id === productId);
    return stock?.quantity || 0;
  };

  const { data: customers = [] } = useQuery({
    queryKey: ['pos-customers', customerSearch],
    queryFn: async () => {
      if (customerSearch.length < 2) return [];
      const response = await api.get(`/patients/search?q=${customerSearch}`);
      return response.data;
    },
    enabled: customerSearch.length >= 2,
  });

  const createSaleMutation = useMutation({
    mutationFn: (data: any) => api.post('/sales/create', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      queryClient.invalidateQueries({ queryKey: ['pos-branch-stock'] });
      
      // Store completed sale for receipt and show receipt modal
      const saleWithItems = {
        ...response.data,
        items: cart.map((item, idx) => ({
          id: idx,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.unit_price * item.quantity * (item.discount_percent / 100),
          total: item.quantity * item.unit_price * (1 - item.discount_percent / 100),
          product: { name: item.product_name, sku: item.sku }
        })),
        patient: selectedCustomer
      };
      setCompletedSale(saleWithItems);
      setIsReceiptOpen(true);
      
      setCart([]);
      setSelectedCustomer(null);
      setDiscountPercent(0);
      setIsPaymentDialogOpen(false);
      setAmountPaid('');
      toast({ 
        title: 'Sale completed successfully!',
        description: `Receipt: ${response.data.receipt_number}`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to complete sale', 
        description: error.response?.data?.detail || 'Unknown error',
        variant: 'destructive' 
      });
    },
  });

  const addToCart = (product: any) => {
    const stockQty = getProductStock(product.id);
    const existing = cart.find(item => item.product_id === product.id);
    const currentInCart = existing?.quantity || 0;
    
    if (currentInCart + 1 > stockQty) {
      toast({ title: `Only ${stockQty} in stock`, variant: 'destructive' });
      return;
    }
    
    if (existing) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        quantity: 1,
        unit_price: parseFloat(product.unit_price),
        discount_percent: 0,
      }]);
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    const stockQty = getProductStock(productId);
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        if (newQty > stockQty) {
          toast({ title: `Only ${stockQty} in stock`, variant: 'destructive' });
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unit_price;
    const itemDiscount = itemTotal * (item.discount_percent / 100);
    return sum + (itemTotal - itemDiscount);
  }, 0);

  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal - discountAmount;
  const change = parseFloat(amountPaid || '0') - total;

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      toast({ title: 'Cart is empty', variant: 'destructive' });
      return;
    }

    const paidAmount = parseFloat(amountPaid || '0');
    if (paidAmount < total && paymentMethod === 'cash') {
      toast({ title: 'Insufficient payment amount', variant: 'destructive' });
      return;
    }

    createSaleMutation.mutate({
      branch_id: 1, // TODO: Get from user's current branch
      patient_id: selectedCustomer?.id || null,
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.unit_price * item.quantity * (item.discount_percent / 100),
      })),
      discount_percent: discountPercent,
      discount_amount: 0,
      payment_method: paymentMethod,
    });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-4">
      {/* Left side - Products */}
      <div className="flex-1 flex flex-col">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((product: any) => {
              const stockQty = getProductStock(product.id);
              const isOutOfStock = stockQty <= 0;
              return (
                <Card
                  key={product.id}
                  className={`cursor-pointer hover:border-primary transition-colors ${isOutOfStock ? 'opacity-50' : ''}`}
                  onClick={() => !isOutOfStock && addToCart(product)}
                >
                  <CardContent className="p-4">
                    <div className="aspect-square bg-muted rounded-md mb-2 flex items-center justify-center relative overflow-hidden">
                      {product.image_url ? (
                        <img src={`http://localhost:8000${product.image_url}`} alt={product.name} className="w-full h-full object-cover rounded-md" />
                      ) : (
                        <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                      )}
                      <span className={`absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded ${
                        stockQty > 10 ? 'bg-green-100 text-green-800' : 
                        stockQty > 0 ? 'bg-amber-100 text-amber-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {stockQty} in stock
                      </span>
                    </div>
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                    <p className="font-bold text-primary mt-1">GH₵{product.unit_price?.toLocaleString()}</p>
                  </CardContent>
                </Card>
              );
            })}
            {products.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                {search ? 'No products found' : 'Start typing to search products'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right side - Cart */}
      <div className="w-96 flex flex-col bg-card border rounded-lg">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Cart ({cart.length})
            </h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCart([])}>
                Clear
              </Button>
            )}
          </div>
          
          {/* Customer Selection */}
          <div
            className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
            onClick={() => setIsCustomerDialogOpen(true)}
          >
            {selectedCustomer ? (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="font-medium">{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                <Badge variant="secondary" className="ml-auto">{selectedCustomer.patient_number}</Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Select Customer (Optional)</span>
              </div>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-auto p-4">
          {cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Cart is empty</p>
              <p className="text-sm">Click products to add them</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-center gap-2 p-2 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">GH₵{item.unit_price.toLocaleString()} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product_id, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product_id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="font-medium w-20 text-right">
                    GH₵{(item.quantity * item.unit_price).toLocaleString()}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeFromCart(item.product_id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Summary */}
        <div className="p-4 border-t space-y-3">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>GH₵{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Discount</span>
            <Input
              type="number"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
              className="w-16 h-8 text-center"
              min={0}
              max={100}
            />
            <span className="text-sm">%</span>
            <span className="ml-auto text-sm">-GH₵{discountAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>Total</span>
            <span className="text-primary">GH₵{total.toLocaleString()}</span>
          </div>
          <Button
            className="w-full h-12 text-lg"
            disabled={cart.length === 0}
            onClick={() => setIsPaymentDialogOpen(true)}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Checkout
          </Button>
        </div>
      </div>

      {/* Customer Selection Dialog */}
      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search by name or phone..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            <div className="max-h-64 overflow-auto space-y-2">
              {customers.map((customer: any) => (
                <div
                  key={customer.id}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setIsCustomerDialogOpen(false);
                    setCustomerSearch('');
                  }}
                >
                  <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                  <p className="text-sm text-muted-foreground">{customer.phone} • {customer.patient_number}</p>
                </div>
              ))}
              {customerSearch.length >= 2 && customers.length === 0 && (
                <p className="text-center py-4 text-muted-foreground">No customers found</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSelectedCustomer(null);
              setIsCustomerDialogOpen(false);
            }}>
              Continue without customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-4xl font-bold text-primary">GH₵{total.toLocaleString()}</p>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  className="h-16 flex-col"
                >
                  <Banknote className="h-5 w-5 mb-1" />
                  Cash
                </Button>
                <Button
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className="h-16 flex-col"
                >
                  <CreditCard className="h-5 w-5 mb-1" />
                  Card
                </Button>
                <Button
                  variant={paymentMethod === 'mobile_money' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('mobile_money')}
                  className="h-16 flex-col"
                >
                  <Receipt className="h-5 w-5 mb-1" />
                  MoMo
                </Button>
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <>
                <div className="space-y-2">
                  <Label>Amount Received</Label>
                  <Input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="Enter amount"
                    className="h-12 text-lg"
                  />
                </div>
                {parseFloat(amountPaid || '0') >= total && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-sm text-green-600">Change</p>
                    <p className="text-2xl font-bold text-green-700">GH₵{change.toLocaleString()}</p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCompleteSale}
              disabled={createSaleMutation.isPending}
              className="min-w-32"
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
        sale={completedSale}
      />
    </div>
  );
}
