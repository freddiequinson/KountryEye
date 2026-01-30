import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  DollarSign,
  AlertCircle,
  Filter,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface FundRequest {
  id: number;
  title: string;
  description: string | null;
  amount: number;
  purpose: string | null;
  status: string;
  requested_by_id: number;
  requested_by_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  reviewed_by_id: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  disbursed_at: string | null;
  disbursement_method: string | null;
  disbursement_reference: string | null;
  received_at: string | null;
  receipt_notes: string | null;
  expense_id: number | null;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  disbursed: 'bg-purple-100 text-purple-800',
  received: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  approved: <CheckCircle className="h-4 w-4" />,
  rejected: <XCircle className="h-4 w-4" />,
  disbursed: <Send className="h-4 w-4" />,
  received: <DollarSign className="h-4 w-4" />,
  cancelled: <AlertCircle className="h-4 w-4" />,
};

export default function FundRequestsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { requestId } = useParams<{ requestId: string }>();
  
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showDisburseDialog, setShowDisburseDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FundRequest | null>(null);
  
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    amount: '',
    purpose: 'other',
  });
  
  const [reviewData, setReviewData] = useState({
    approved: true,
    review_notes: '',
  });
  
  const [disburseData, setDisburseData] = useState({
    disbursement_method: 'cash',
    disbursement_reference: '',
  });
  
  const [receiptNotes, setReceiptNotes] = useState('');

  const isAdmin = user?.role === 'Admin' || user?.is_superuser;

  // Fetch fund requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['fund-requests', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const response = await api.get(`/fund-requests?${params.toString()}`);
      return response.data;
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['fund-requests-stats'],
    queryFn: async () => {
      const response = await api.get('/fund-requests/stats/summary');
      return response.data;
    },
  });

  // Open specific fund request from URL param
  useEffect(() => {
    if (requestId && requests.length > 0) {
      const request = requests.find((r: FundRequest) => r.id === parseInt(requestId));
      if (request) {
        setSelectedRequest(request);
        setShowDetailDialog(true);
      }
    }
  }, [requestId, requests]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newRequest) => {
      const response = await api.post('/fund-requests', {
        ...data,
        amount: parseFloat(data.amount),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['fund-requests-stats'] });
      setShowCreateDialog(false);
      setNewRequest({ title: '', description: '', amount: '', purpose: 'other' });
      toast({ title: 'Success', description: 'Memo submitted successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to submit request', variant: 'destructive' });
    },
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof reviewData }) => {
      const response = await api.post(`/fund-requests/${id}/review`, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['fund-requests-stats'] });
      setShowReviewDialog(false);
      
      // If approved, show disburse dialog immediately
      if (variables.data.approved && selectedRequest) {
        // Update the selected request status to approved
        setSelectedRequest({ ...selectedRequest, status: 'approved' });
        setShowDisburseDialog(true);
        toast({ title: 'Approved', description: 'Now select disbursement method' });
      } else {
        setSelectedRequest(null);
        toast({ title: 'Success', description: 'Request reviewed successfully' });
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to review request', variant: 'destructive' });
    },
  });

  // Disburse mutation
  const disburseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof disburseData }) => {
      const response = await api.post(`/fund-requests/${id}/disburse`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['fund-requests-stats'] });
      setShowDisburseDialog(false);
      setSelectedRequest(null);
      setDisburseData({ disbursement_method: 'cash', disbursement_reference: '' });
      toast({ title: 'Success', description: 'Funds marked as disbursed' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to disburse funds';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    },
  });

  // Receive mutation
  const receiveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const response = await api.post(`/fund-requests/${id}/receive`, { receipt_notes: notes });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['fund-requests-stats'] });
      setShowDetailDialog(false);
      setSelectedRequest(null);
      toast({ title: 'Success', description: 'Receipt confirmed and expense recorded' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to confirm receipt', variant: 'destructive' });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Memos</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Manage and approve memos from employees' : 'Submit memos for work-related expenses'}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Memo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isAdmin ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pending Memos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats?.pending?.count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats?.pending?.amount || 0)} total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Approved (Awaiting Disbursement)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats?.approved?.count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats?.approved?.amount || 0)} total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Disbursed (Awaiting Receipt)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats?.disbursed?.count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats?.disbursed?.amount || 0)} total
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">My Pending Memos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats?.my_pending || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Awaiting My Receipt Confirmation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats?.awaiting_receipt || 0}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Memos</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="disbursed">Disbursed</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Purpose</TableHead>
                {isAdmin && <TableHead>Requested By</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No memos found</p>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request: FundRequest) => (
                  <TableRow key={request.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.title}</p>
                        {request.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {request.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(request.amount)}
                    </TableCell>
                    <TableCell className="capitalize">{request.purpose || 'Other'}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div>
                          <p>{request.requested_by_name}</p>
                          {request.branch_name && (
                            <p className="text-xs text-muted-foreground">{request.branch_name}</p>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge className={statusColors[request.status] || 'bg-gray-100'}>
                        <span className="flex items-center gap-1">
                          {statusIcons[request.status]}
                          {request.status}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(request.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowDetailDialog(true);
                          }}
                        >
                          View
                        </Button>
                        {isAdmin && request.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowReviewDialog(true);
                            }}
                          >
                            Review
                          </Button>
                        )}
                        {isAdmin && request.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowDisburseDialog(true);
                            }}
                          >
                            Disburse
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Request Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Memo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={newRequest.title}
                onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                placeholder="e.g., Office Supplies"
              />
            </div>
            <div>
              <Label>Amount (GH₵)</Label>
              <Input
                type="number"
                value={newRequest.amount}
                onChange={(e) => setNewRequest({ ...newRequest, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Purpose</Label>
              <Select
                value={newRequest.purpose}
                onValueChange={(value) => setNewRequest({ ...newRequest, purpose: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplies">Supplies</SelectItem>
                  <SelectItem value="transport">Transport</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                value={newRequest.description}
                onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                placeholder="Provide details about what the funds are needed for..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newRequest)}
              disabled={!newRequest.title || !newRequest.amount || createMutation.isPending}
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fund Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Title</Label>
                  <p className="font-medium">{selectedRequest.title}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="font-medium text-lg">{formatCurrency(selectedRequest.amount)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Purpose</Label>
                  <p className="capitalize">{selectedRequest.purpose || 'Other'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={statusColors[selectedRequest.status]}>
                    {selectedRequest.status}
                  </Badge>
                </div>
              </div>
              
              {selectedRequest.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{selectedRequest.description}</p>
                </div>
              )}
              
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">Timeline</Label>
                <div className="mt-2 space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Requested:</span>{' '}
                    {formatDate(selectedRequest.created_at)} by {selectedRequest.requested_by_name}
                  </p>
                  {selectedRequest.reviewed_at && (
                    <p>
                      <span className="text-muted-foreground">Reviewed:</span>{' '}
                      {formatDate(selectedRequest.reviewed_at)} by {selectedRequest.reviewed_by_name}
                      {selectedRequest.review_notes && (
                        <span className="block text-muted-foreground ml-4">
                          Note: {selectedRequest.review_notes}
                        </span>
                      )}
                    </p>
                  )}
                  {selectedRequest.disbursed_at && (
                    <p>
                      <span className="text-muted-foreground">Disbursed:</span>{' '}
                      {formatDate(selectedRequest.disbursed_at)} via {selectedRequest.disbursement_method}
                      {selectedRequest.disbursement_reference && (
                        <span className="block text-muted-foreground ml-4">
                          Ref: {selectedRequest.disbursement_reference}
                        </span>
                      )}
                    </p>
                  )}
                  {selectedRequest.received_at && (
                    <p>
                      <span className="text-muted-foreground">Received:</span>{' '}
                      {formatDate(selectedRequest.received_at)}
                      {selectedRequest.receipt_notes && (
                        <span className="block text-muted-foreground ml-4">
                          Note: {selectedRequest.receipt_notes}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Confirm Receipt Section */}
              {selectedRequest.status === 'disbursed' && selectedRequest.requested_by_id === user?.id && (
                <div className="border-t pt-4">
                  <Label>Confirm Receipt</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Please confirm that you have received the funds.
                  </p>
                  <Textarea
                    value={receiptNotes}
                    onChange={(e) => setReceiptNotes(e.target.value)}
                    placeholder="Optional notes about the receipt..."
                    rows={2}
                  />
                  <Button
                    className="mt-2 w-full"
                    onClick={() => receiveMutation.mutate({ id: selectedRequest.id, notes: receiptNotes })}
                    disabled={receiveMutation.isPending}
                  >
                    {receiveMutation.isPending ? 'Confirming...' : 'Confirm Receipt'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Fund Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-medium">{selectedRequest.title}</p>
                <p className="text-2xl font-bold">{formatCurrency(selectedRequest.amount)}</p>
                <p className="text-sm text-muted-foreground">
                  By {selectedRequest.requested_by_name}
                </p>
              </div>
              
              <div>
                <Label>Decision</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={reviewData.approved ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setReviewData({ ...reviewData, approved: true })}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant={!reviewData.approved ? 'destructive' : 'outline'}
                    className="flex-1"
                    onClick={() => setReviewData({ ...reviewData, approved: false })}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
              
              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={reviewData.review_notes}
                  onChange={(e) => setReviewData({ ...reviewData, review_notes: e.target.value })}
                  placeholder="Add any notes about your decision..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedRequest && reviewMutation.mutate({ id: selectedRequest.id, data: reviewData })}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disburse Dialog */}
      <Dialog open={showDisburseDialog} onOpenChange={setShowDisburseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disburse Funds</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-medium">{selectedRequest.title}</p>
                <p className="text-2xl font-bold">{formatCurrency(selectedRequest.amount)}</p>
                <p className="text-sm text-muted-foreground">
                  To {selectedRequest.requested_by_name}
                </p>
              </div>
              
              <div>
                <Label>Disbursement Method</Label>
                <Select
                  value={disburseData.disbursement_method}
                  onValueChange={(value) => setDisburseData({ ...disburseData, disbursement_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                    <SelectItem value="momo">Mobile Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Reference (Optional)</Label>
                <Input
                  value={disburseData.disbursement_reference}
                  onChange={(e) => setDisburseData({ ...disburseData, disbursement_reference: e.target.value })}
                  placeholder="Transaction reference or receipt number"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisburseDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedRequest && disburseMutation.mutate({ id: selectedRequest.id, data: disburseData })}
              disabled={disburseMutation.isPending}
            >
              {disburseMutation.isPending ? 'Processing...' : 'Mark as Disbursed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
