import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign,
  Search,
  Filter,
  Check,
  Clock,
  Building2,
  User,
  Calendar,
  TrendingUp,
  Settings,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function ReferralPaymentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [paidFilter, setPaidFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Settings form state
  const [settingDoctorId, setSettingDoctorId] = useState<string>('');
  const [settingPaymentType, setSettingPaymentType] = useState('percentage');
  const [settingRate, setSettingRate] = useState('');

  // Fetch summary
  const { data: summary } = useQuery({
    queryKey: ['referral-summary'],
    queryFn: async () => {
      const response = await api.get('/technician/analytics/summary');
      return response.data;
    },
  });

  // Fetch payments
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['referral-payments', paidFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (paidFilter === 'paid') params.append('is_paid', 'true');
      if (paidFilter === 'unpaid') params.append('is_paid', 'false');
      const response = await api.get(`/technician/payments?${params.toString()}`);
      return response.data;
    },
  });

  // Fetch top referrers
  const { data: topReferrers = [] } = useQuery({
    queryKey: ['top-referrers'],
    queryFn: async () => {
      const response = await api.get('/technician/analytics/top-referrers?limit=5');
      return response.data;
    },
  });

  // Fetch payment settings
  const { data: paymentSettings = [] } = useQuery({
    queryKey: ['payment-settings'],
    queryFn: async () => {
      const response = await api.get('/technician/payment-settings');
      return response.data;
    },
  });

  // Fetch doctors for settings
  const { data: doctors = [] } = useQuery({
    queryKey: ['referral-doctors'],
    queryFn: async () => {
      const response = await api.get('/technician/doctors');
      return response.data;
    },
  });

  // Mark payment as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (data: { paymentId: number; method: string; reference?: string; notes?: string }) => {
      const response = await api.post(`/technician/payments/${data.paymentId}/mark-paid`, null, {
        params: {
          payment_method: data.method,
          reference_number: data.reference || undefined,
          notes: data.notes || undefined,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Payment marked as paid' });
      queryClient.invalidateQueries({ queryKey: ['referral-payments'] });
      queryClient.invalidateQueries({ queryKey: ['referral-summary'] });
      setShowPayDialog(false);
      resetPaymentForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark payment', variant: 'destructive' });
    },
  });

  // Create payment setting mutation
  const createSettingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/technician/payment-settings', data);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Payment setting saved' });
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
      setShowSettingsDialog(false);
      resetSettingsForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save setting', variant: 'destructive' });
    },
  });

  const resetPaymentForm = () => {
    setPaymentMethod('');
    setReferenceNumber('');
    setPaymentNotes('');
    setSelectedPayment(null);
  };

  const resetSettingsForm = () => {
    setSettingDoctorId('');
    setSettingPaymentType('percentage');
    setSettingRate('');
  };

  const handleMarkPaid = () => {
    if (!paymentMethod) {
      toast({ title: 'Error', description: 'Please select a payment method', variant: 'destructive' });
      return;
    }
    markPaidMutation.mutate({
      paymentId: selectedPayment.id,
      method: paymentMethod,
      reference: referenceNumber,
      notes: paymentNotes,
    });
  };

  const handleSaveSetting = () => {
    if (!settingRate) {
      toast({ title: 'Error', description: 'Please enter a rate', variant: 'destructive' });
      return;
    }
    createSettingMutation.mutate({
      referral_doctor_id: settingDoctorId ? parseInt(settingDoctorId) : null,
      payment_type: settingPaymentType,
      rate: parseFloat(settingRate),
    });
  };

  const filteredPayments = payments.filter((p: any) =>
    p.referral_doctor?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.payment_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Referral Payments</h1>
          <p className="text-muted-foreground">
            Manage payments to referring doctors
          </p>
        </div>
        <Button onClick={() => setShowSettingsDialog(true)}>
          <Settings className="h-4 w-4 mr-2" />
          Payment Settings
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              GH₵ {(summary?.total_revenue || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">From referral services</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {summary?.pending_payments?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              GH₵ {(summary?.pending_payments?.amount || 0).toLocaleString()} due
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              GH₵ {(summary?.total_paid || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Payments completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_referrals || 0}</div>
            <p className="text-xs text-muted-foreground">External referrals</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payments Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Payment Records</CardTitle>
              <div className="flex gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by doctor or payment number..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={paidFilter} onValueChange={setPaidFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No payments found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment #</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment: any) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-sm">
                          {payment.payment_number}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{payment.referral_doctor?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {payment.referral_doctor?.clinic_name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">GH₵ {payment.amount.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">
                              {payment.payment_type === 'percentage'
                                ? `${payment.payment_rate}% of GH₵${payment.service_amount}`
                                : `Fixed: GH₵${payment.payment_rate}`}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {payment.is_paid ? (
                            <Badge className="bg-green-100 text-green-800">
                              <Check className="h-3 w-3 mr-1" />
                              Paid
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!payment.is_paid && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setShowPayDialog(true);
                              }}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Referrers */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Top Referring Doctors</CardTitle>
              <CardDescription>By number of referrals</CardDescription>
            </CardHeader>
            <CardContent>
              {topReferrers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No referrals yet
                </div>
              ) : (
                <div className="space-y-4">
                  {topReferrers.map((referrer: any, index: number) => (
                    <div key={referrer.doctor_id} className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{referrer.doctor_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {referrer.clinic_name || 'No clinic'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{referrer.referral_count}</div>
                        <div className="text-xs text-muted-foreground">referrals</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Settings Summary */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Payment Rates</CardTitle>
              <CardDescription>Current payment settings</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentSettings.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No payment settings configured</p>
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => setShowSettingsDialog(true)}
                  >
                    Add setting
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentSettings.map((setting: any) => (
                    <div key={setting.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="text-sm">
                        {setting.doctor_name}
                      </div>
                      <Badge variant="outline">
                        {setting.payment_type === 'percentage'
                          ? `${setting.rate}%`
                          : `GH₵${setting.rate}`}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mark Paid Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Payment as Paid</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Doctor:</span>
                  <span className="font-medium">{selectedPayment.referral_doctor?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold text-lg">GH₵ {selectedPayment.amount.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="referenceNumber">Reference Number</Label>
                <Input
                  id="referenceNumber"
                  placeholder="Transaction reference..."
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="paymentNotes">Notes</Label>
                <Input
                  id="paymentNotes"
                  placeholder="Additional notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkPaid} disabled={markPaidMutation.isPending}>
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="settingDoctor">Doctor (leave empty for default)</Label>
              <Select value={settingDoctorId} onValueChange={setSettingDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Default (All Doctors)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Default (All Doctors)</SelectItem>
                  {doctors.map((doc: any) => (
                    <SelectItem key={doc.id} value={doc.id.toString()}>
                      {doc.name} - {doc.clinic_name || 'No clinic'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Payment Type</Label>
              <Select value={settingPaymentType} onValueChange={setSettingPaymentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage of Service Fee</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="settingRate">
                {settingPaymentType === 'percentage' ? 'Percentage (%)' : 'Fixed Amount (GH₵)'}
              </Label>
              <Input
                id="settingRate"
                type="number"
                step={settingPaymentType === 'percentage' ? '0.1' : '0.01'}
                placeholder={settingPaymentType === 'percentage' ? 'e.g., 10' : 'e.g., 50.00'}
                value={settingRate}
                onChange={(e) => setSettingRate(e.target.value)}
              />
              {settingPaymentType === 'percentage' && (
                <p className="text-xs text-muted-foreground mt-1">
                  e.g., 10 means 10% of the service fee
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSetting} disabled={createSettingMutation.isPending}>
              Save Setting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
