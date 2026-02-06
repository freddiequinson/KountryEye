import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Calendar, FileText, Eye, AlertCircle, CheckCircle, History, Edit, CreditCard } from 'lucide-react';
import api from '@/lib/api';
import { Patient, Visit } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isVisitDialogOpen, setIsVisitDialogOpen] = useState(false);
  const [isVisitDetailDialogOpen, setIsVisitDetailDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isEditRecordDialogOpen, setIsEditRecordDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [paymentVisit, setPaymentVisit] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'cash',
    notes: '',
  });
  const [visitForm, setVisitForm] = useState({
    visit_type: 'full_checkup',
    reason: '',
    notes: '',
    consultation_type_id: '',
    payment_type: 'cash',
    insurance_provider: '',
    insurance_id: '',
    insurance_number: '',
    insurance_limit: '',
  });

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}`);
      return response.data as Patient;
    },
  });

  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['patient-visits', id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}/visits`);
      return response.data as Visit[];
    },
  });

  const { data: clinicalRecords = [] } = useQuery({
    queryKey: ['patient-clinical-records', id],
    queryFn: async () => {
      const response = await api.get(`/clinical/patients/${id}/records`);
      return response.data;
    },
  });

  const { data: patientBalance } = useQuery({
    queryKey: ['patient-balance', id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}/balance`);
      return response.data;
    },
  });

  const { data: visitDetail } = useQuery({
    queryKey: ['visit-detail', selectedVisit?.id],
    queryFn: async () => {
      const response = await api.get(`/clinical/visits/${selectedVisit.id}/detail`);
      return response.data;
    },
    enabled: !!selectedVisit?.id,
  });

  const { data: recordHistory = [] } = useQuery({
    queryKey: ['record-history', selectedRecordId],
    queryFn: async () => {
      const response = await api.get(`/clinical/records/${selectedRecordId}/history`);
      return response.data;
    },
    enabled: !!selectedRecordId && isHistoryDialogOpen,
  });

  const { data: consultationTypes = [] } = useQuery({
    queryKey: ['consultation-types'],
    queryFn: async () => {
      const response = await api.get('/clinical/consultation-types');
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  // Fetch patient scans
  const { data: patientScans = [] } = useQuery({
    queryKey: ['patient-scans', id],
    queryFn: async () => {
      const response = await api.get(`/technician/patient/${id}/scans`);
      return response.data;
    },
    enabled: !!id,
  });

  const getConsultationFee = () => {
    if (!visitForm.consultation_type_id) return 0;
    const type = consultationTypes.find((t: any) => t.id.toString() === visitForm.consultation_type_id);
    return type?.base_fee || 0;
  };

  const openVisitDetail = (visit: any) => {
    setSelectedVisit(visit);
    setIsVisitDetailDialogOpen(true);
  };

  const openRecordHistory = (recordId: number) => {
    setSelectedRecordId(recordId);
    setIsHistoryDialogOpen(true);
  };

  const openEditRecord = (record: any) => {
    setEditingRecord({ ...record });
    setIsEditRecordDialogOpen(true);
  };

  const updateRecordMutation = useMutation({
    mutationFn: (data: any) =>
      api.post(`/clinical/visits/${data.visit_id}/record`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-records', id] });
      setIsEditRecordDialogOpen(false);
      setEditingRecord(null);
      toast({ title: 'Clinical record updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update record', variant: 'destructive' });
    },
  });

  const createVisitMutation = useMutation({
    mutationFn: (data: any) =>
      api.post('/patients/visits', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-visits', id] });
      setIsVisitDialogOpen(false);
      setVisitForm({ visit_type: 'full_checkup', reason: '', notes: '', consultation_type_id: '', payment_type: 'cash', insurance_provider: '', insurance_id: '', insurance_number: '', insurance_limit: '' });
      toast({ title: 'Visit recorded successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to record visit', variant: 'destructive' });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (data: { visit_id: number; amount: number; payment_method: string; notes?: string }) =>
      api.post(`/patients/visits/${data.visit_id}/payment`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-visits', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-balance', id] });
      setIsPaymentDialogOpen(false);
      setPaymentVisit(null);
      setPaymentForm({ amount: '', payment_method: 'cash', notes: '' });
      toast({ title: 'Payment recorded successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to record payment', variant: 'destructive' });
    },
  });

  const openPaymentDialog = (visit: any) => {
    const balance = (visit.consultation_fee || 0) - (visit.amount_paid || 0);
    setPaymentVisit(visit);
    setPaymentForm({ amount: balance.toFixed(2), payment_method: 'cash', notes: '' });
    setIsPaymentDialogOpen(true);
  };

  const handleRecordPayment = () => {
    if (!paymentVisit || !paymentForm.amount) return;
    recordPaymentMutation.mutate({
      visit_id: paymentVisit.id,
      amount: parseFloat(paymentForm.amount),
      payment_method: paymentForm.payment_method,
      notes: paymentForm.notes,
    });
  };

  const handleCreateVisit = (e: React.FormEvent) => {
    e.preventDefault();
    const consultationFee = getConsultationFee();
    createVisitMutation.mutate({
      ...visitForm,
      patient_id: Number(id),
      consultation_type_id: visitForm.consultation_type_id ? parseInt(visitForm.consultation_type_id) : null,
      consultation_fee: consultationFee,
      insurance_limit: visitForm.insurance_limit ? parseFloat(visitForm.insurance_limit) : null,
    });
  };

  if (patientLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-64">
        Patient not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/patients')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">
            {patient.first_name} {patient.last_name}
          </h1>
          <Badge variant="outline">{patient.patient_number}</Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Phone:</span> {patient.phone || '-'}</p>
              <p><span className="text-muted-foreground">Email:</span> {patient.email || '-'}</p>
              <p><span className="text-muted-foreground">Address:</span> {patient.address || '-'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Demographics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Sex:</span> {patient.sex || '-'}</p>
              <p><span className="text-muted-foreground">DOB:</span> {patient.date_of_birth || '-'}</p>
              <p><span className="text-muted-foreground">Occupation:</span> {patient.occupation || '-'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Emergency Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Name:</span> {patient.emergency_contact_name || '-'}</p>
              <p><span className="text-muted-foreground">Phone:</span> {patient.emergency_contact_phone || '-'}</p>
            </CardContent>
          </Card>

          <Card className={patientBalance?.balance > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Status</CardTitle>
              {patientBalance?.balance > 0 ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {patientBalance?.balance > 0 ? (
                  <span className="text-red-600">GHS {patientBalance?.balance?.toFixed(2) || '0.00'}</span>
                ) : (
                  <span className="text-green-600">Paid Up</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <p>Total Billed: GHS {patientBalance?.total_billed?.toFixed(2) || '0.00'}</p>
                <p>Total Paid: GHS {patientBalance?.total_paid?.toFixed(2) || '0.00'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="visits">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="visits">
                <Calendar className="mr-2 h-4 w-4" />
                Visits
              </TabsTrigger>
              <TabsTrigger value="records">
                <FileText className="mr-2 h-4 w-4" />
                Clinical Records
              </TabsTrigger>
              <TabsTrigger value="scans">
                <Eye className="mr-2 h-4 w-4" />
                Scans ({patientScans.length})
              </TabsTrigger>
            </TabsList>
            <Button onClick={() => setIsVisitDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Visit
            </Button>
          </div>

          <TabsContent value="visits" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : visits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No visits recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    visits.map((visit: any) => (
                      <TableRow key={visit.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          {new Date(visit.visit_date).toLocaleString()}
                        </TableCell>
                        <TableCell className="capitalize">
                          {visit.visit_type?.replace('_', ' ') || '-'}
                        </TableCell>
                        <TableCell>{visit.reason || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              visit.status === 'completed'
                                ? 'success'
                                : visit.status === 'in_consultation'
                                ? 'warning'
                                : 'secondary'
                            }
                          >
                            {visit.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {visit.consultation_fee ? (
                            <div className="text-sm">
                              <span className={visit.amount_paid >= visit.consultation_fee ? 'text-green-600' : 'text-red-600'}>
                                GHS {visit.amount_paid?.toFixed(2) || '0.00'} / {visit.consultation_fee?.toFixed(2)}
                              </span>
                              {visit.amount_paid < visit.consultation_fee && (
                                <div className="text-xs text-red-500">
                                  Owes: GHS {(visit.consultation_fee - (visit.amount_paid || 0)).toFixed(2)}
                                </div>
                              )}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${id}/visits/${visit.id}`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {visit.consultation_fee && visit.amount_paid < visit.consultation_fee && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-green-600 hover:text-green-700"
                                onClick={(e) => { e.stopPropagation(); openPaymentDialog(visit); }}
                              >
                                <CreditCard className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="records" className="mt-4">
            {clinicalRecords.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No clinical records found
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {clinicalRecords.map((record: any) => (
                  <Card key={record.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                          {new Date(record.created_at).toLocaleDateString()} - Visit #{record.visit_id}
                        </CardTitle>
                        <div className="flex gap-2">
                          {record.diagnosis ? (
                            <Badge variant="success">Diagnosis Complete</Badge>
                          ) : (
                            <Badge variant="warning">Pending Diagnosis</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRecordHistory(record.id)}
                            title="View change history"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditRecord(record)}
                            title="Edit record"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {record.chief_complaint && (
                        <div>
                          <span className="font-medium">Chief Complaint:</span>
                          <p className="text-muted-foreground">{record.chief_complaint}</p>
                        </div>
                      )}
                      {record.history_of_present_illness && (
                        <div>
                          <span className="font-medium">History of Present Illness:</span>
                          <p className="text-muted-foreground">{record.history_of_present_illness}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        {record.visual_acuity_od && (
                          <div>
                            <span className="font-medium">VA OD:</span> {record.visual_acuity_od}
                          </div>
                        )}
                        {record.visual_acuity_os && (
                          <div>
                            <span className="font-medium">VA OS:</span> {record.visual_acuity_os}
                          </div>
                        )}
                        {record.iop_od && (
                          <div>
                            <span className="font-medium">IOP OD:</span> {record.iop_od}
                          </div>
                        )}
                        {record.iop_os && (
                          <div>
                            <span className="font-medium">IOP OS:</span> {record.iop_os}
                          </div>
                        )}
                      </div>
                      {record.diagnosis && (
                        <div>
                          <span className="font-medium">Diagnosis:</span>
                          <p className="text-muted-foreground">{record.diagnosis}</p>
                        </div>
                      )}
                      {record.management_plan && (
                        <div>
                          <span className="font-medium">Management Plan:</span>
                          <p className="text-muted-foreground">{record.management_plan}</p>
                        </div>
                      )}
                      {record.follow_up_date && (
                        <div>
                          <span className="font-medium">Follow-up:</span> {new Date(record.follow_up_date).toLocaleDateString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="scans" className="mt-4">
            {patientScans.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No scans recorded for this patient
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Scan #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Results</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patientScans.map((scan: any) => (
                      <TableRow key={scan.id}>
                        <TableCell>
                          {scan.scan_date ? new Date(scan.scan_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{scan.scan_number}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            scan.scan_type === 'oct' ? 'bg-blue-50 text-blue-700' :
                            scan.scan_type === 'vft' ? 'bg-purple-50 text-purple-700' :
                            scan.scan_type === 'fundus' ? 'bg-green-50 text-green-700' :
                            'bg-orange-50 text-orange-700'
                          }>
                            {scan.scan_type?.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            scan.status === 'completed' || scan.status === 'reviewed' ? 'success' :
                            scan.status === 'pending' ? 'secondary' : 'outline'
                          }>
                            {scan.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {scan.results_summary || '-'}
                        </TableCell>
                        <TableCell>
                          {scan.payment?.is_paid ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Paid
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">Unpaid</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/technician/scans/${scan.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {scan.has_pdf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const response = await api.get(`/technician/scans/${scan.id}/pdf`, {
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
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={isVisitDialogOpen} onOpenChange={setIsVisitDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Record New Visit for {patient?.first_name} {patient?.last_name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateVisit} className="space-y-4">
              <div className="space-y-2">
                <Label>Visit Type</Label>
                <Select
                  value={visitForm.visit_type}
                  onValueChange={(value) =>
                    setVisitForm({ ...visitForm, visit_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enquiry">Enquiry Only</SelectItem>
                    <SelectItem value="full_checkup">Full Check-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {visitForm.visit_type === 'enquiry' && (
                <div className="space-y-2">
                  <Label>Purpose of Visit</Label>
                  <Textarea
                    value={visitForm.reason}
                    onChange={(e) =>
                      setVisitForm({ ...visitForm, reason: e.target.value })
                    }
                    placeholder="What is the enquiry about?"
                  />
                </div>
              )}

              {visitForm.visit_type === 'full_checkup' && (
                <>
                  <div className="space-y-2">
                    <Label>Consultation Type</Label>
                    <Select
                      value={visitForm.consultation_type_id}
                      onValueChange={(value) =>
                        setVisitForm({ ...visitForm, consultation_type_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select consultation type" />
                      </SelectTrigger>
                      <SelectContent>
                        {consultationTypes.map((type: any) => (
                          <SelectItem key={type.id} value={type.id.toString()}>
                            {type.name} - GH₵{type.base_fee?.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Payment Type</Label>
                    <Select
                      value={visitForm.payment_type}
                      onValueChange={(value) => setVisitForm({ ...visitForm, payment_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="visioncare">VisionCare Membership</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {visitForm.payment_type === 'insurance' && (
                    <div className="space-y-4 p-4 border rounded-md">
                      <div className="space-y-2">
                        <Label>Insurance Provider</Label>
                        <input
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={visitForm.insurance_provider}
                          onChange={(e) =>
                            setVisitForm({ ...visitForm, insurance_provider: e.target.value })
                          }
                          placeholder="e.g., NHIS, Acacia Health"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Insurance ID</Label>
                          <input
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={visitForm.insurance_id}
                            onChange={(e) =>
                              setVisitForm({ ...visitForm, insurance_id: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Membership Number</Label>
                          <input
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={visitForm.insurance_number}
                            onChange={(e) =>
                              setVisitForm({ ...visitForm, insurance_number: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Insurance Limit (GH₵)</Label>
                        <input
                          type="number"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={visitForm.insurance_limit}
                          onChange={(e) =>
                            setVisitForm({ ...visitForm, insurance_limit: e.target.value })
                          }
                          placeholder="Enter insurance coverage limit"
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum amount insurance will cover. Costs exceeding this will be paid by patient.
                        </p>
                      </div>
                      {visitForm.insurance_limit && visitForm.consultation_type_id && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span>Insurance Limit:</span>
                              <span className="font-medium">GH₵{parseFloat(visitForm.insurance_limit).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Consultation Fee:</span>
                              <span className="font-medium">GH₵{getConsultationFee().toLocaleString()}</span>
                            </div>
                            {parseFloat(visitForm.insurance_limit) < getConsultationFee() && (
                              <div className="flex justify-between text-red-600 font-medium pt-1 border-t">
                                <span>Patient Top-up Required:</span>
                                <span>GH₵{(getConsultationFee() - parseFloat(visitForm.insurance_limit)).toLocaleString()}</span>
                              </div>
                            )}
                            {parseFloat(visitForm.insurance_limit) >= getConsultationFee() && (
                              <div className="flex justify-between text-green-600 font-medium pt-1 border-t">
                                <span>Remaining for Medications:</span>
                                <span>GH₵{(parseFloat(visitForm.insurance_limit) - getConsultationFee()).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {visitForm.consultation_type_id && (
                    <div className="p-4 bg-muted rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Consultation Fee</span>
                        <span className="text-lg font-bold">
                          GH₵{getConsultationFee().toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsVisitDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createVisitMutation.isPending}>
                  {createVisitMutation.isPending ? 'Recording...' : 'Record Visit'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isVisitDetailDialogOpen} onOpenChange={setIsVisitDetailDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Visit Details</DialogTitle>
            </DialogHeader>
            {visitDetail ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Date</Label>
                    <p className="font-medium">{new Date(visitDetail.visit_date).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge variant={visitDetail.status === 'completed' ? 'success' : 'secondary'}>
                      {visitDetail.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Visit Type</Label>
                    <p className="font-medium capitalize">{visitDetail.visit_type?.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Reason</Label>
                    <p className="font-medium">{visitDetail.reason || '-'}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Payment Information</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Consultation Fee</Label>
                      <p className="font-medium">GHS {visitDetail.consultation_fee?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Amount Paid</Label>
                      <p className="font-medium text-green-600">GHS {visitDetail.amount_paid?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Balance</Label>
                      <p className={`font-medium ${(visitDetail.consultation_fee - visitDetail.amount_paid) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        GHS {((visitDetail.consultation_fee || 0) - (visitDetail.amount_paid || 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {visitDetail.payment_type === 'insurance' && visitDetail.insurance_limit > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <h5 className="font-medium text-blue-800 mb-2">Insurance Coverage</h5>
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Provider:</span>
                          <p className="font-medium">{visitDetail.insurance_provider || '-'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Limit:</span>
                          <p className="font-medium">GHS {visitDetail.insurance_limit?.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Used:</span>
                          <p className="font-medium">GHS {visitDetail.insurance_used?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div>
                          <span className={visitDetail.insurance_limit - (visitDetail.insurance_used || 0) > 0 ? 'text-green-600' : 'text-red-600'}>
                            Remaining:
                          </span>
                          <p className={`font-bold ${visitDetail.insurance_limit - (visitDetail.insurance_used || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            GHS {(visitDetail.insurance_limit - (visitDetail.insurance_used || 0)).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      {visitDetail.patient_topup > 0 && (
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <span className="text-red-600 font-medium">Patient Top-up Required: GHS {visitDetail.patient_topup?.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {visitDetail.clinical_record && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Clinical Record</h4>
                    <div className="space-y-2 text-sm">
                      {visitDetail.clinical_record.chief_complaint && (
                        <div>
                          <Label className="text-muted-foreground">Chief Complaint</Label>
                          <p>{visitDetail.clinical_record.chief_complaint}</p>
                        </div>
                      )}
                      {visitDetail.clinical_record.diagnosis && (
                        <div>
                          <Label className="text-muted-foreground">Diagnosis</Label>
                          <p>{visitDetail.clinical_record.diagnosis}</p>
                        </div>
                      )}
                      {visitDetail.clinical_record.management_plan && (
                        <div>
                          <Label className="text-muted-foreground">Management Plan</Label>
                          <p>{visitDetail.clinical_record.management_plan}</p>
                        </div>
                      )}
                      {!visitDetail.clinical_record.diagnosis && (
                        <Badge variant="warning">Diagnosis Pending</Badge>
                      )}
                    </div>
                  </div>
                )}

                {visitDetail.prescriptions && visitDetail.prescriptions.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Prescriptions</h4>
                    {visitDetail.prescriptions.map((rx: any) => (
                      <div key={rx.id} className="text-sm border rounded p-2 mb-2">
                        <p className="font-medium">Prescription #{rx.id}</p>
                        <p className="text-muted-foreground">Status: {rx.status}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsVisitDetailDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Record History Dialog */}
        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Clinical Record Change History</DialogTitle>
            </DialogHeader>
            {recordHistory.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No change history available</p>
            ) : (
              <div className="space-y-3">
                {recordHistory.map((entry: any) => (
                  <div key={entry.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <Badge variant={entry.action === 'create' ? 'success' : 'secondary'}>
                          {entry.action.toUpperCase()}
                        </Badge>
                        <span className="ml-2 font-medium">{entry.change_summary}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                    {entry.modified_by && (
                      <p className="text-sm text-muted-foreground">
                        By: {entry.modified_by.full_name}
                      </p>
                    )}
                    {entry.field_name && entry.action === 'update' && (
                      <div className="mt-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-red-50 p-2 rounded">
                            <span className="font-medium text-red-700">Before:</span>
                            <p className="text-red-600">{entry.old_value || '(empty)'}</p>
                          </div>
                          <div className="bg-green-50 p-2 rounded">
                            <span className="font-medium text-green-700">After:</span>
                            <p className="text-green-600">{entry.new_value || '(empty)'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Record Dialog */}
        <Dialog open={isEditRecordDialogOpen} onOpenChange={setIsEditRecordDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Clinical Record</DialogTitle>
            </DialogHeader>
            {editingRecord && (
              <div className="space-y-4">
                <div>
                  <Label>Chief Complaint</Label>
                  <Textarea
                    value={editingRecord.chief_complaint || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, chief_complaint: e.target.value })}
                    placeholder="Chief complaint..."
                  />
                </div>
                <div>
                  <Label>History of Present Illness</Label>
                  <Textarea
                    value={editingRecord.history_of_present_illness || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, history_of_present_illness: e.target.value })}
                    placeholder="History of present illness..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Visual Acuity OD</Label>
                    <Textarea
                      value={editingRecord.visual_acuity_od || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, visual_acuity_od: e.target.value })}
                      className="min-h-[60px]"
                    />
                  </div>
                  <div>
                    <Label>Visual Acuity OS</Label>
                    <Textarea
                      value={editingRecord.visual_acuity_os || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, visual_acuity_os: e.target.value })}
                      className="min-h-[60px]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>IOP OD</Label>
                    <Textarea
                      value={editingRecord.iop_od || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, iop_od: e.target.value })}
                      className="min-h-[60px]"
                    />
                  </div>
                  <div>
                    <Label>IOP OS</Label>
                    <Textarea
                      value={editingRecord.iop_os || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, iop_os: e.target.value })}
                      className="min-h-[60px]"
                    />
                  </div>
                </div>
                <div>
                  <Label>Diagnosis</Label>
                  <Textarea
                    value={editingRecord.diagnosis || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, diagnosis: e.target.value })}
                    placeholder="Diagnosis..."
                  />
                </div>
                <div>
                  <Label>Management Plan</Label>
                  <Textarea
                    value={editingRecord.management_plan || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, management_plan: e.target.value })}
                    placeholder="Management plan..."
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditRecordDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => updateRecordMutation.mutate(editingRecord)}
                disabled={updateRecordMutation.isPending}
              >
                {updateRecordMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            {paymentVisit && (
              <div className="space-y-4">
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Visit Date:</span>
                    <span>{new Date(paymentVisit.visit_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Consultation Fee:</span>
                    <span>GHS {paymentVisit.consultation_fee?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Already Paid:</span>
                    <span>GHS {paymentVisit.amount_paid?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between font-medium text-red-600 border-t mt-2 pt-2">
                    <span>Balance Due:</span>
                    <span>GHS {((paymentVisit.consultation_fee || 0) - (paymentVisit.amount_paid || 0)).toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payment Amount (GHS)</Label>
                  <input
                    type="number"
                    step="0.01"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={paymentForm.payment_method}
                    onValueChange={(value) => setPaymentForm({ ...paymentForm, payment_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    placeholder="Payment notes..."
                    rows={2}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRecordPayment}
                disabled={recordPaymentMutation.isPending || !paymentForm.amount}
                className="bg-green-600 hover:bg-green-700"
              >
                {recordPaymentMutation.isPending ? 'Processing...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
