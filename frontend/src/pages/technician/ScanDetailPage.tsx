import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Eye,
  Upload,
  FileText,
  User,
  Calendar,
  Clock,
  CheckCircle,
  Download,
  Trash2,
  Edit,
  Loader2,
  DollarSign,
  Settings,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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

export default function ScanDetailPage() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [uploading, setUploading] = useState(false);

  // Edit form state
  const [editData, setEditData] = useState<any>({});

  // Fetch scan details
  const { data: scan, isLoading } = useQuery({
    queryKey: ['scan', scanId],
    queryFn: async () => {
      const response = await api.get(`/technician/scans/${scanId}`);
      return response.data;
    },
    enabled: !!scanId,
  });

  // Fetch pricing
  const { data: pricing = [] } = useQuery({
    queryKey: ['scan-pricing'],
    queryFn: async () => {
      const response = await api.get('/technician/scan-pricing');
      return response.data;
    },
  });

  // Update scan mutation
  const updateScanMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/technician/scans/${scanId}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Scan updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['scan', scanId] });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update scan', variant: 'destructive' });
    },
  });

  // Upload PDF mutation
  const uploadPdfMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post(`/technician/scans/${scanId}/upload-pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'PDF uploaded successfully' });
      queryClient.invalidateQueries({ queryKey: ['scan', scanId] });
      setUploading(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to upload PDF', variant: 'destructive' });
      setUploading(false);
    },
  });

  // Mark paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (method: string) => {
      const response = await api.post(`/technician/scans/${scanId}/mark-paid`, null, {
        params: { payment_method: method },
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: `Payment of GH₵ ${data.amount} recorded` });
      queryClient.invalidateQueries({ queryKey: ['scan', scanId] });
      setShowPaymentDialog(false);
      setPaymentMethod('');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to record payment', variant: 'destructive' });
    },
  });

  // Complete scan mutation
  const completeScanMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/technician/scans/${scanId}/complete`);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Scan marked as completed' });
      queryClient.invalidateQueries({ queryKey: ['scan', scanId] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Error', description: 'Please select a PDF file', variant: 'destructive' });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'Error', description: 'File size must be less than 10MB', variant: 'destructive' });
        return;
      }
      setUploading(true);
      uploadPdfMutation.mutate(file);
    }
  };

  const handleMarkPaid = () => {
    if (!paymentMethod) {
      toast({ title: 'Error', description: 'Please select a payment method', variant: 'destructive' });
      return;
    }
    markPaidMutation.mutate(paymentMethod);
  };

  const startEditing = () => {
    setEditData({
      results_summary: scan?.results_summary || '',
      notes: scan?.notes || '',
      od_results: scan?.od_results || {},
      os_results: scan?.os_results || {},
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    updateScanMutation.mutate(editData);
  };

  const scanTypeLabels: Record<string, string> = {
    oct: 'Optical Coherence Tomography (OCT)',
    vft: 'Visual Field Test (VFT)',
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

  const getScanPrice = () => {
    const p = pricing.find((pr: any) => pr.scan_type === scan?.scan_type);
    return p?.price || 0;
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Scan not found</p>
        <Button variant="link" onClick={() => navigate('/technician/scans')}>
          Back to Scans
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/technician/scans')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{scan.scan_number}</h1>
              <Badge className={scanTypeColors[scan.scan_type] || ''}>
                {scanTypeLabels[scan.scan_type] || scan.scan_type}
              </Badge>
              <Badge className={statusColors[scan.status] || ''}>
                {scan.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {scan.scan_date ? new Date(scan.scan_date).toLocaleDateString() : 'No date'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {scan.status === 'pending' && (
            <Button variant="outline" onClick={() => updateScanMutation.mutate({ status: 'in_progress' })}>
              Start Scan
            </Button>
          )}
          {scan.status === 'in_progress' && (
            <Button onClick={() => completeScanMutation.mutate()}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete
            </Button>
          )}
          {!isEditing && (
            <Button variant="outline" onClick={startEditing}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Patient & Payment Info */}
        <div className="space-y-6">
          {/* Patient Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient / Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scan.patient ? (
                <div className="space-y-2">
                  <div className="font-medium text-lg">
                    {scan.patient.first_name} {scan.patient.last_name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Patient #: {scan.patient.patient_number}
                  </div>
                  {scan.patient.phone && (
                    <div className="text-sm text-muted-foreground">
                      Phone: {scan.patient.phone}
                    </div>
                  )}
                </div>
              ) : scan.external_referral ? (
                <div className="space-y-2">
                  <div className="font-medium text-lg">{scan.external_referral.client_name}</div>
                  <Badge variant="outline">External Referral</Badge>
                  {scan.external_referral.client_phone && (
                    <div className="text-sm text-muted-foreground">
                      Phone: {scan.external_referral.client_phone}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No patient linked</p>
              )}
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Scan Price:</span>
                <span className="font-bold text-lg">GH₵ {getScanPrice()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status:</span>
                {scan.payment?.is_paid ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Paid
                  </Badge>
                ) : scan.payment?.added_to_deficit ? (
                  <Badge className="bg-orange-100 text-orange-800">In Deficit</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">
                    <Clock className="h-3 w-3 mr-1" />
                    Unpaid
                  </Badge>
                )}
              </div>
              {scan.payment?.is_paid && (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Method:</span>
                    <span>{scan.payment.payment_method}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Date:</span>
                    <span>{new Date(scan.payment.payment_date).toLocaleDateString()}</span>
                  </div>
                </>
              )}
              {!scan.payment?.is_paid && !scan.payment?.added_to_deficit && (
                <Button className="w-full" onClick={() => setShowPaymentDialog(true)}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              )}
            </CardContent>
          </Card>

          {/* PDF Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Scan PDF
              </CardTitle>
              <CardDescription>Upload the scan result PDF</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              
              {scan.pdf_file_path ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div className="flex-1">
                      <div className="font-medium text-green-800">PDF Uploaded</div>
                      <div className="text-xs text-green-600">
                        {scan.pdf_file_path.split('/').pop()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={async () => {
                        try {
                          const response = await api.get(`/technician/scans/${scanId}/pdf`, {
                            responseType: 'blob'
                          });
                          const blob = new Blob([response.data], { type: 'application/pdf' });
                          const url = window.URL.createObjectURL(blob);
                          window.open(url, '_blank');
                        } catch (error) {
                          toast({ title: 'Error', description: 'Failed to load PDF', variant: 'destructive' });
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      View PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
                  ) : (
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {uploading ? 'Uploading...' : 'Click to upload PDF'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Max 10MB</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle>Scan Results</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* OD Results */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg border-b pb-2">OD (Right Eye)</h3>
                      {Object.entries(editData.od_results || {}).map(([key, value]) => (
                        <div key={key}>
                          <Label>{key.replace(/_/g, ' ')}</Label>
                          <Input
                            value={value as string}
                            onChange={(e) => setEditData({
                              ...editData,
                              od_results: { ...editData.od_results, [key]: e.target.value }
                            })}
                          />
                        </div>
                      ))}
                    </div>
                    {/* OS Results */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg border-b pb-2">OS (Left Eye)</h3>
                      {Object.entries(editData.os_results || {}).map(([key, value]) => (
                        <div key={key}>
                          <Label>{key.replace(/_/g, ' ')}</Label>
                          <Input
                            value={value as string}
                            onChange={(e) => setEditData({
                              ...editData,
                              os_results: { ...editData.os_results, [key]: e.target.value }
                            })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Results Summary</Label>
                    <Textarea
                      value={editData.results_summary}
                      onChange={(e) => setEditData({ ...editData, results_summary: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={editData.notes}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button onClick={handleSaveEdit} disabled={updateScanMutation.isPending}>
                      {updateScanMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* OD Results */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg border-b pb-2">OD (Right Eye)</h3>
                      {scan.od_results && Object.keys(scan.od_results).length > 0 ? (
                        Object.entries(scan.od_results).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="font-medium">{value as string || '-'}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm">No results recorded</p>
                      )}
                    </div>
                    {/* OS Results */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg border-b pb-2">OS (Left Eye)</h3>
                      {scan.os_results && Object.keys(scan.os_results).length > 0 ? (
                        Object.entries(scan.os_results).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="font-medium">{value as string || '-'}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm">No results recorded</p>
                      )}
                    </div>
                  </div>
                  
                  {scan.results_summary && (
                    <div>
                      <h3 className="font-semibold mb-2">Summary</h3>
                      <p className="text-muted-foreground bg-muted p-3 rounded">{scan.results_summary}</p>
                    </div>
                  )}
                  
                  {scan.notes && (
                    <div>
                      <h3 className="font-semibold mb-2">Notes</h3>
                      <p className="text-muted-foreground bg-muted p-3 rounded">{scan.notes}</p>
                    </div>
                  )}
                  
                  {scan.doctor_notes && (
                    <div>
                      <h3 className="font-semibold mb-2">Doctor's Notes</h3>
                      <p className="text-muted-foreground bg-blue-50 p-3 rounded border border-blue-200">
                        {scan.doctor_notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block">Created</span>
                  <span>{scan.created_at ? new Date(scan.created_at).toLocaleString() : '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Performed By</span>
                  <span>{scan.performed_by?.first_name} {scan.performed_by?.last_name || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Requested By</span>
                  <span>{scan.requested_by?.first_name} {scan.requested_by?.last_name || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Visit ID</span>
                  <span>{scan.visit_id || '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">Scan Type:</span>
                <Badge className={scanTypeColors[scan.scan_type] || ''}>
                  {scanTypeLabels[scan.scan_type]}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold text-lg">GH₵ {getScanPrice()}</span>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={markPaidMutation.isPending}>
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
