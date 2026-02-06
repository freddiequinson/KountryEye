import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  Search,
  Filter,
  User,
  Calendar,
  DollarSign,
  Check,
  Clock,
  AlertCircle,
  Play,
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
import { useToast } from '@/hooks/use-toast';

export default function ScanRequestsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Payment dialog state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedScan, setSelectedScan] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  
  // Pricing dialog state
  const [showPricingDialog, setShowPricingDialog] = useState(false);

  // Fetch scan requests
  const { data: scanRequests = [], isLoading } = useQuery({
    queryKey: ['scan-requests', statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (typeFilter && typeFilter !== 'all') {
        params.append('scan_type', typeFilter);
      }
      const response = await api.get(`/technician/scan-requests?${params.toString()}`);
      return response.data;
    },
  });

  // Fetch scan pricing
  const { data: pricing = [] } = useQuery({
    queryKey: ['scan-pricing'],
    queryFn: async () => {
      const response = await api.get('/technician/scan-pricing');
      return response.data;
    },
  });

  // Mark scan as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async ({ scanId, method }: { scanId: number; method: string }) => {
      const response = await api.post(`/technician/scans/${scanId}/mark-paid`, null, {
        params: { payment_method: method },
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: `Payment of GH₵ ${data.amount} recorded` });
      queryClient.invalidateQueries({ queryKey: ['scan-requests'] });
      setShowPaymentDialog(false);
      setSelectedScan(null);
      setPaymentMethod('');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to record payment', variant: 'destructive' });
    },
  });

  // Add to deficit mutation
  const addToDeficitMutation = useMutation({
    mutationFn: async (scanId: number) => {
      const response = await api.post(`/technician/scans/${scanId}/add-to-deficit`);
      return response.data;
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: data.message });
      queryClient.invalidateQueries({ queryKey: ['scan-requests'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.response?.data?.detail || 'Failed to add to deficit', 
        variant: 'destructive' 
      });
    },
  });

  // Start scan mutation (change status to in_progress)
  const startScanMutation = useMutation({
    mutationFn: async (scanId: number) => {
      const response = await api.put(`/technician/scans/${scanId}`, { status: 'in_progress' });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Scan started' });
      queryClient.invalidateQueries({ queryKey: ['scan-requests'] });
    },
  });

  // Complete scan mutation
  const completeScanMutation = useMutation({
    mutationFn: async (scanId: number) => {
      const response = await api.post(`/technician/scans/${scanId}/complete`);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Scan marked as completed' });
      queryClient.invalidateQueries({ queryKey: ['scan-requests'] });
    },
  });

  // Update pricing mutation
  const updatePricingMutation = useMutation({
    mutationFn: async ({ scanType, price }: { scanType: string; price: number }) => {
      const response = await api.put(`/technician/scan-pricing/${scanType}`, null, {
        params: { price },
      });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Pricing updated' });
      queryClient.invalidateQueries({ queryKey: ['scan-pricing'] });
    },
  });

  const filteredRequests = scanRequests.filter((r: any) =>
    r.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.scan_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.requested_by?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const scanTypeLabels: Record<string, string> = {
    oct: 'OCT',
    vft: 'Visual Field Test',
    fundus: 'Fundus Photography',
    pachymeter: 'Pachymeter',
  };

  const scanTypeColors: Record<string, string> = {
    oct: 'bg-blue-100 text-blue-800',
    vft: 'bg-purple-100 text-purple-800',
    fundus: 'bg-green-100 text-green-800',
    pachymeter: 'bg-orange-100 text-orange-800',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    reviewed: 'bg-purple-100 text-purple-800',
  };

  const handleMarkPaid = () => {
    if (!paymentMethod) {
      toast({ title: 'Error', description: 'Please select a payment method', variant: 'destructive' });
      return;
    }
    markPaidMutation.mutate({ scanId: selectedScan.id, method: paymentMethod });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scan Requests</h1>
          <p className="text-muted-foreground">
            Patients sent by doctors for scans
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowPricingDialog(true)}>
          <Settings className="h-4 w-4 mr-2" />
          Scan Pricing
        </Button>
      </div>

      {/* Pricing Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {pricing.map((p: any) => (
          <Card key={p.scan_type}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">
                    {scanTypeLabels[p.scan_type] || p.scan_type}
                  </div>
                  <div className="text-2xl font-bold">GH₵ {p.price}</div>
                </div>
                <Badge className={scanTypeColors[p.scan_type] || ''}>
                  {p.scan_type.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient name, scan number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Scan Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="oct">OCT</SelectItem>
                <SelectItem value="vft">Visual Field Test</SelectItem>
                <SelectItem value="fundus">Fundus Photography</SelectItem>
                <SelectItem value="pachymeter">Pachymeter</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Scan Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Scan Requests ({filteredRequests.length})</CardTitle>
          <CardDescription>Scans requested by doctors during consultations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No scan requests found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scan #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request: any) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono text-sm">
                      {request.scan_number}
                    </TableCell>
                    <TableCell>
                      <Badge className={scanTypeColors[request.scan_type] || ''}>
                        {scanTypeLabels[request.scan_type] || request.scan_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{request.patient?.name || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">
                            {request.patient?.patient_number}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {request.requested_by?.name || 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {request.requested_at
                          ? new Date(request.requested_at).toLocaleDateString()
                          : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">GH₵ {request.price}</div>
                    </TableCell>
                    <TableCell>
                      {request.payment?.is_paid ? (
                        <Badge className="bg-green-100 text-green-800">
                          <Check className="h-3 w-3 mr-1" />
                          Paid
                        </Badge>
                      ) : request.payment?.added_to_deficit ? (
                        <Badge className="bg-orange-100 text-orange-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          In Deficit
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Unpaid
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[request.status] || ''}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {request.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startScanMutation.mutate(request.id)}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Start
                          </Button>
                        )}
                        {request.status === 'in_progress' && (
                          <Button
                            size="sm"
                            onClick={() => completeScanMutation.mutate(request.id)}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Complete
                          </Button>
                        )}
                        {!request.payment?.is_paid && !request.payment?.added_to_deficit && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedScan(request);
                                setShowPaymentDialog(true);
                              }}
                            >
                              <DollarSign className="h-3 w-3 mr-1" />
                              Pay
                            </Button>
                            {request.visit_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-orange-600"
                                onClick={() => {
                                  if (confirm('Add this amount to patient deficit?')) {
                                    addToDeficitMutation.mutate(request.id);
                                  }
                                }}
                              >
                                Deficit
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {selectedScan && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="font-medium">{selectedScan.patient?.name}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Scan Type:</span>
                  <Badge className={scanTypeColors[selectedScan.scan_type] || ''}>
                    {scanTypeLabels[selectedScan.scan_type]}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold text-lg">GH₵ {selectedScan.price}</span>
                </div>
              </div>

              <div>
                <Label>Payment Method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkPaid} disabled={markPaidMutation.isPending}>
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pricing Dialog */}
      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan Pricing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {pricing.map((p: any) => (
              <div key={p.scan_type} className="flex items-center gap-4">
                <div className="flex-1">
                  <Label>{scanTypeLabels[p.scan_type] || p.scan_type}</Label>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={p.price}
                    onBlur={(e) => {
                      const newPrice = parseFloat(e.target.value);
                      if (newPrice !== p.price) {
                        updatePricingMutation.mutate({
                          scanType: p.scan_type,
                          price: newPrice,
                        });
                      }
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPricingDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
