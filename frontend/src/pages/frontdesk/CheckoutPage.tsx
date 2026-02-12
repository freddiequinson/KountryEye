import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Receipt,
  CreditCard,
  Banknote,
  CheckCircle,
  AlertCircle,
  Printer,
  Eye,
  Stethoscope,
  Package,
  LogOut,
  Clock,
  User,
  Download,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

export default function CheckoutPage() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [isDebtConfirmDialogOpen, setIsDebtConfirmDialogOpen] = useState(false);
  const [debtInfo, setDebtInfo] = useState<{ total_debt: number; message: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['checkout-summary', visitId],
    queryFn: async () => {
      const response = await api.get(`/checkout/visits/${visitId}/checkout-summary`);
      return response.data;
    },
    enabled: !!visitId,
  });

  // Fetch prescriptions for this visit
  const { data: prescriptions = [] } = useQuery({
    queryKey: ['visit-prescriptions', visitId],
    queryFn: async () => {
      const response = await api.get(`/clinical/visits/${visitId}/prescriptions`);
      return response.data;
    },
    enabled: !!visitId,
  });

  const paymentMutation = useMutation({
    mutationFn: (data: { amount: number; payment_method: string }) =>
      api.post(`/checkout/visits/${visitId}/checkout`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkout-summary', visitId] });
      setIsPaymentDialogOpen(false);
      setPaymentAmount('');
      toast({ title: 'Payment recorded successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to record payment', variant: 'destructive' });
    },
  });

  const handlePayment = () => {
    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    paymentMutation.mutate({ amount, payment_method: paymentMethod });
  };

  const handlePrintReceipt = async () => {
    try {
      const response = await api.get(`/checkout/visits/${visitId}/checkout-receipt`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      toast({ title: 'Failed to generate receipt', variant: 'destructive' });
    }
  };

  const checkoutMutation = useMutation({
    mutationFn: (confirmWithDebt: boolean = false) => 
      api.post(`/checkout/visits/${visitId}/complete-checkout`, { confirm_with_debt: confirmWithDebt }),
    onSuccess: (response) => {
      const data = response.data;
      
      // Check if backend is asking for debt confirmation
      if (data.requires_confirmation && data.has_outstanding_debt) {
        setDebtInfo({
          total_debt: data.total_debt,
          message: data.message
        });
        setIsCheckoutDialogOpen(false);
        setIsDebtConfirmDialogOpen(true);
        return;
      }
      
      // Checkout was successful
      queryClient.invalidateQueries({ queryKey: ['checkout-summary', visitId] });
      setIsCheckoutDialogOpen(false);
      setIsDebtConfirmDialogOpen(false);
      
      if (data.debt_notice) {
        toast({ 
          title: 'Patient checked out successfully', 
          description: data.debt_notice,
          variant: 'default'
        });
      } else {
        toast({ title: 'Patient checked out successfully', description: 'Visit has been marked as completed.' });
      }
    },
    onError: () => {
      toast({ title: 'Failed to complete checkout', variant: 'destructive' });
    },
  });

  const handleCompleteCheckout = (confirmWithDebt: boolean = false) => {
    checkoutMutation.mutate(confirmWithDebt);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Visit not found</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const { patient, charges, summary: totals } = summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              Patient Checkout
            </h1>
            <p className="text-muted-foreground">
              Visit #{summary.visit_number} • {summary.visit_date?.split('T')[0]}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintReceipt}>
            <Printer className="h-4 w-4 mr-2" />
            Print Receipt
          </Button>
          {totals.balance_due > 0 && (
            <Button onClick={() => setIsPaymentDialogOpen(true)}>
              <CreditCard className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          )}
          {summary.status !== 'checked_out' ? (
            <Button 
              variant="default" 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setIsCheckoutDialogOpen(true)}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Complete Checkout
            </Button>
          ) : (
            <Badge variant="success" className="text-lg px-4 py-2">
              <CheckCircle className="h-4 w-4 mr-2" />
              Checked Out
            </Badge>
          )}
        </div>
      </div>

      {/* Patient Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{patient.name}</h2>
              <p className="text-muted-foreground">
                {patient.patient_number} • {patient.phone}
              </p>
            </div>
            <Badge
              variant={totals.is_fully_paid ? 'success' : 'destructive'}
              className="text-lg px-4 py-2"
            >
              {totals.is_fully_paid ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Fully Paid
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Balance Due: GH₵{totals.balance_due.toLocaleString()}
                </>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Charges Breakdown */}
      <div className="space-y-4">
        {/* Consultation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Consultation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {charges.consultation.type && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{charges.consultation.type}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span className="font-medium">GH₵{charges.consultation.fee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="text-green-600">GH₵{charges.consultation.paid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Balance</span>
                <span className={charges.consultation.balance > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                  GH₵{charges.consultation.balance.toLocaleString()}
                </span>
              </div>
              <Badge variant={charges.consultation.payment_status === 'paid' ? 'success' : 'secondary'}>
                {charges.consultation.payment_status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Scans */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Scans ({charges.scans.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {charges.scans.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">No scans for this visit</p>
            ) : (
              <div className="space-y-3">
                {charges.scans.items.map((scan: any) => (
                  <div key={scan.id} className="flex justify-between items-center text-sm">
                    <span>{scan.scan_type.toUpperCase()}</span>
                    <div className="text-right">
                      <span className="font-medium">GH₵{scan.amount.toLocaleString()}</span>
                      <Badge variant={scan.status === 'paid' ? 'success' : 'secondary'} className="ml-2">
                        {scan.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Total</span>
                  <span className="font-bold">GH₵{charges.scans.total.toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Products ({charges.products.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {charges.products.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">No products purchased</p>
            ) : (
              <div className="space-y-3">
                {charges.products.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium">{item.product_name}</span>
                      <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">GH₵{item.total.toLocaleString()}</span>
                      <Badge variant={item.status === 'completed' ? 'success' : 'secondary'} className="ml-2">
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Total</span>
                  <span className="font-bold">GH₵{charges.products.total.toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Optical Prescriptions - for download */}
        {prescriptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Optical Prescriptions ({prescriptions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {prescriptions.map((prescription: any) => (
                  <div key={prescription.id} className="flex justify-between items-center p-3 bg-purple-50/50 rounded border">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {prescription.prescription_type || 'Optical'}
                        </Badge>
                        <span className="font-medium">
                          {prescription.items?.map((i: any) => i.name).join(', ') || 'Spectacles Prescription'}
                        </span>
                      </div>
                      {(prescription.sphere_od || prescription.sphere_os) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          OD: {prescription.sphere_od || '-'} / {prescription.cylinder_od || '-'} | 
                          OS: {prescription.sphere_os || '-'} / {prescription.cylinder_os || '-'} | 
                          Add: {prescription.add_power || '-'}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await api.get(`/clinical/prescriptions/${prescription.id}/download-pdf`, {
                            responseType: 'blob',
                          });
                          const blob = new Blob([response.data], { type: 'application/pdf' });
                          const url = window.URL.createObjectURL(blob);
                          window.open(url, '_blank');
                        } catch {
                          toast({ title: 'Failed to download prescription', variant: 'destructive' });
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download PDF
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Grand Total</p>
              <p className="text-3xl font-bold">GH₵{totals.grand_total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-3xl font-bold text-green-600">GH₵{totals.total_paid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Balance Due</p>
              <p className={`text-3xl font-bold ${totals.balance_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                GH₵{totals.balance_due.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Balance Due</p>
              <p className="text-3xl font-bold text-red-600">
                GH₵{totals.balance_due.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Payment Amount</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
                className="text-lg"
              />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePayment} disabled={paymentMutation.isPending}>
              {paymentMutation.isPending ? 'Processing...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Confirmation Dialog */}
      <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-emerald-600" />
              Complete Patient Checkout
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <User className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-bold text-lg">{patient.name}</p>
                <p className="text-muted-foreground">{patient.patient_number}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Charges</p>
                <p className="text-xl font-bold">GH₵{totals.grand_total.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className={`text-xl font-bold ${totals.balance_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  GH₵{totals.balance_due.toLocaleString()}
                </p>
              </div>
            </div>

            {totals.balance_due > 0 && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">Patient has an outstanding balance. You can still complete checkout.</p>
              </div>
            )}

            <p className="text-sm text-muted-foreground text-center">
              This will mark the visit as completed and the patient as checked out.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleCompleteCheckout(false)} 
              disabled={checkoutMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {checkoutMutation.isPending ? 'Processing...' : 'Confirm Checkout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debt Confirmation Dialog */}
      <Dialog open={isDebtConfirmDialogOpen} onOpenChange={setIsDebtConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Outstanding Debt Warning
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 font-medium text-center text-lg">
                GH₵{debtInfo?.total_debt?.toLocaleString() || 0}
              </p>
              <p className="text-amber-700 text-sm text-center mt-2">
                Outstanding Debt
              </p>
            </div>
            
            <p className="text-sm text-center">
              {debtInfo?.message || 'This patient has an outstanding debt. Are you sure you want to check them out?'}
            </p>
            
            <p className="text-xs text-muted-foreground text-center">
              The debt will remain on their account for future payment.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDebtConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleCompleteCheckout(true)} 
              disabled={checkoutMutation.isPending}
              variant="destructive"
            >
              {checkoutMutation.isPending ? 'Processing...' : 'Checkout with Debt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
