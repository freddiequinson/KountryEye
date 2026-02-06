import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  Eye,
  Phone,
  ChevronRight,
  ChevronDown,
  Users,
  CreditCard,
  Banknote,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

export default function ReferralPaymentsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Filters
  const [search, setSearch] = useState('');
  const [paidFilter, setPaidFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  
  // Dialog states
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showDoctorDetail, setShowDoctorDetail] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [expandedDoctors, setExpandedDoctors] = useState<Set<number>>(new Set());

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
    queryKey: ['referral-payments', paidFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (paidFilter === 'paid') params.append('is_paid', 'true');
      if (paidFilter === 'unpaid') params.append('is_paid', 'false');
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const response = await api.get(`/technician/payments?${params.toString()}`);
      return response.data;
    },
  });

  // Fetch all referrals
  const { data: referrals = [] } = useQuery({
    queryKey: ['all-referrals', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      params.append('limit', '500');
      const response = await api.get(`/technician/referrals?${params.toString()}`);
      return response.data;
    },
  });

  // Fetch top referrers
  const { data: topReferrers = [] } = useQuery({
    queryKey: ['top-referrers'],
    queryFn: async () => {
      const response = await api.get('/technician/analytics/top-referrers?limit=10');
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

  // Group referrals by doctor with payment summary
  const doctorSummaries = useMemo(() => {
    const groups: Record<number, {
      doctor: any;
      referrals: any[];
      totalFees: number;
      paidAmount: number;
      unpaidAmount: number;
      referralCount: number;
    }> = {};

    referrals.forEach((r: any) => {
      const doctorId = r.referral_doctor?.id || 0;
      if (!groups[doctorId]) {
        groups[doctorId] = {
          doctor: r.referral_doctor || { id: 0, name: 'Unknown' },
          referrals: [],
          totalFees: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          referralCount: 0,
        };
      }
      groups[doctorId].referrals.push(r);
      groups[doctorId].totalFees += r.service_fee || 0;
      groups[doctorId].referralCount++;
    });

    // Calculate paid/unpaid from payments
    payments.forEach((p: any) => {
      const doctorId = p.referral_doctor?.id;
      if (doctorId && groups[doctorId]) {
        if (p.is_paid) {
          groups[doctorId].paidAmount += p.amount || 0;
        } else {
          groups[doctorId].unpaidAmount += p.amount || 0;
        }
      }
    });

    return Object.values(groups).sort((a, b) => b.referralCount - a.referralCount);
  }, [referrals, payments]);

  const toggleDoctorExpanded = (doctorId: number) => {
    setExpandedDoctors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(doctorId)) {
        newSet.delete(doctorId);
      } else {
        newSet.add(doctorId);
      }
      return newSet;
    });
  };

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

  // Filter payments by search
  const filteredPayments = useMemo(() => {
    if (!search.trim()) return payments;
    const searchLower = search.toLowerCase();
    return payments.filter((p: any) =>
      p.referral_doctor?.name?.toLowerCase().includes(searchLower) ||
      p.referral_doctor?.clinic_name?.toLowerCase().includes(searchLower) ||
      p.payment_number?.toLowerCase().includes(searchLower) ||
      p.external_referral?.client_name?.toLowerCase().includes(searchLower)
    );
  }, [payments, search]);

  // Filter referrals by search
  const filteredReferrals = useMemo(() => {
    if (!search.trim()) return referrals;
    const searchLower = search.toLowerCase();
    return referrals.filter((r: any) =>
      r.client_name?.toLowerCase().includes(searchLower) ||
      r.referral_number?.toLowerCase().includes(searchLower) ||
      r.referral_doctor?.name?.toLowerCase().includes(searchLower) ||
      r.referral_doctor?.clinic_name?.toLowerCase().includes(searchLower)
    );
  }, [referrals, search]);

  // Filter doctor summaries by search
  const filteredDoctorSummaries = useMemo(() => {
    if (!search.trim()) return doctorSummaries;
    const searchLower = search.toLowerCase();
    return doctorSummaries.filter((g) =>
      g.doctor.name?.toLowerCase().includes(searchLower) ||
      g.doctor.clinic_name?.toLowerCase().includes(searchLower)
    );
  }, [doctorSummaries, search]);

  // Calculate totals
  const totalUnpaid = payments.filter((p: any) => !p.is_paid).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const totalPaid = payments.filter((p: any) => p.is_paid).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Referral Management</h1>
          <p className="text-muted-foreground">
            Track referrals, manage payments to referring doctors
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Payment Settings
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referrals.length}</div>
            <p className="text-xs text-muted-foreground">From {doctorSummaries.length} doctors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              GH₵ {referrals.reduce((sum: number, r: any) => sum + (r.service_fee || 0), 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">From referral services</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              GH₵ {totalPaid.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {payments.filter((p: any) => p.is_paid).length} payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              GH₵ {totalUnpaid.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {payments.filter((p: any) => !p.is_paid).length} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Doctors</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{doctors.length}</div>
            <p className="text-xs text-muted-foreground">Referring doctors</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search doctor or payment number..."
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
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unpaid">Unpaid Only</SelectItem>
                <SelectItem value="paid">Paid Only</SelectItem>
              </SelectContent>
            </Select>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                Clear Dates
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="doctors">By Doctor</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Unpaid Payments - Priority */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-500" />
                    Outstanding Payments
                  </CardTitle>
                  <CardDescription>Payments due to referring doctors</CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredPayments.filter((p: any) => !p.is_paid).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Check className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      <p>All payments are up to date!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredPayments.filter((p: any) => !p.is_paid).slice(0, 10).map((payment: any) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-medium">{payment.referral_doctor?.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {payment.referral_doctor?.clinic_name || 'No clinic'} • {payment.payment_number}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-bold text-lg">GH₵ {(payment.amount || 0).toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground">
                                {payment.created_at ? new Date(payment.created_at).toLocaleDateString() : ''}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setShowPayDialog(true);
                              }}
                            >
                              <Banknote className="h-4 w-4 mr-1" />
                              Pay
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Referrers */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Top Referrers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topReferrers.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No referrals yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topReferrers.slice(0, 5).map((referrer: any, index: number) => (
                        <div
                          key={referrer.doctor_id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setActiveTab('doctors');
                            setTimeout(() => {
                              toggleDoctorExpanded(referrer.doctor_id);
                            }, 100);
                          }}
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm bg-muted text-muted-foreground">
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
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Settings */}
              <Card className="mt-4">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Payment Rates</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowSettingsDialog(true)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {paymentSettings.length === 0 ? (
                    <div className="text-center py-2 text-sm text-muted-foreground">
                      <p>No rates configured</p>
                      <Button variant="link" size="sm" onClick={() => setShowSettingsDialog(true)}>
                        Configure rates
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {paymentSettings.slice(0, 3).map((setting: any) => (
                        <div key={setting.id} className="flex items-center justify-between text-sm">
                          <span className="truncate">{setting.doctor_name || 'Default'}</span>
                          <Badge variant="outline">
                            {setting.payment_type === 'percentage' ? `${setting.rate}%` : `GH₵${setting.rate}`}
                          </Badge>
                        </div>
                      ))}
                      {paymentSettings.length > 3 && (
                        <Button variant="link" size="sm" className="w-full" onClick={() => setShowSettingsDialog(true)}>
                          View all {paymentSettings.length} settings
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>All Payment Records</CardTitle>
              <CardDescription>
                {filteredPayments.length} payments found
              </CardDescription>
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
                      <TableHead>Referral</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
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
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {payment.referral_doctor?.clinic_name || 'No clinic'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {payment.external_referral?.client_name || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold">GH₵ {(payment.amount || 0).toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {payment.payment_type === 'percentage'
                              ? `${payment.payment_rate}%`
                              : `Fixed`}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '-'}
                          </div>
                          {payment.paid_at && (
                            <div className="text-xs text-green-600">
                              Paid: {new Date(payment.paid_at).toLocaleDateString()}
                            </div>
                          )}
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
                              Pay Now
                            </Button>
                          )}
                          {payment.is_paid && payment.payment_method && (
                            <span className="text-xs text-muted-foreground capitalize">
                              {payment.payment_method.replace('_', ' ')}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Doctor Tab */}
        <TabsContent value="doctors">
          <div className="space-y-4">
            {filteredDoctorSummaries.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No referrals found</p>
                </CardContent>
              </Card>
            ) : (
              filteredDoctorSummaries.map((group) => (
                <Card key={group.doctor.id}>
                  <Collapsible
                    open={expandedDoctors.has(group.doctor.id)}
                    onOpenChange={() => toggleDoctorExpanded(group.doctor.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {expandedDoctors.has(group.doctor.id) ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{group.doctor.name}</CardTitle>
                              <CardDescription className="flex items-center gap-4">
                                {group.doctor.clinic_name && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {group.doctor.clinic_name}
                                  </span>
                                )}
                                {group.doctor.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {group.doctor.phone}
                                  </span>
                                )}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <div className="text-xl font-bold">{group.referralCount}</div>
                              <div className="text-xs text-muted-foreground">Referrals</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-semibold">
                                GH₵ {group.totalFees.toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">Total Fees</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-semibold text-green-600">
                                GH₵ {group.paidAmount.toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">Paid</div>
                            </div>
                            {group.unpaidAmount > 0 && (
                              <div className="text-center">
                                <div className="text-lg font-semibold text-yellow-600">
                                  GH₵ {group.unpaidAmount.toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground">Outstanding</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="border-t pt-4">
                          <h4 className="font-medium mb-3">Recent Referrals</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Referral #</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Service Fee</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.referrals.slice(0, 5).map((referral: any) => (
                                <TableRow key={referral.id}>
                                  <TableCell className="font-mono text-sm">
                                    {referral.referral_number}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium">{referral.client_name}</div>
                                    {referral.client_phone && (
                                      <div className="text-xs text-muted-foreground">{referral.client_phone}</div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {referral.referral_date
                                      ? new Date(referral.referral_date).toLocaleDateString()
                                      : '-'}
                                  </TableCell>
                                  <TableCell>
                                    GH₵ {(referral.service_fee || 0).toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={
                                      referral.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      referral.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-blue-100 text-blue-800'
                                    }>
                                      {referral.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {group.referrals.length > 5 && (
                            <div className="text-center mt-3">
                              <Button variant="link" size="sm">
                                View all {group.referrals.length} referrals
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

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
              <Select value={settingDoctorId || "default"} onValueChange={(val) => setSettingDoctorId(val === "default" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Default (All Doctors)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (All Doctors)</SelectItem>
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
