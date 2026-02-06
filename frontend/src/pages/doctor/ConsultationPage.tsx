import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Plus, Trash2, Search, AlertTriangle, Eye, Clock, CheckCircle, FileText } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface PrescriptionItem {
  id?: number;
  product_id?: number;
  item_type: 'medication' | 'spectacle' | 'lens' | 'other';
  name: string;
  description: string;
  dosage?: string;
  duration?: string;
  quantity: number;
  unit_price: number;
  stock_quantity?: number;
  is_external?: boolean;  // For items not in our inventory
}

export default function ConsultationPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isPrescriptionDialogOpen, setIsPrescriptionDialogOpen] = useState(false);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductResults, setShowProductResults] = useState(false);
  const [newPrescriptionItem, setNewPrescriptionItem] = useState<PrescriptionItem>({
    item_type: 'medication',
    name: '',
    description: '',
    dosage: '',
    duration: '',
    quantity: 1,
    unit_price: 0,
  });
  const [showScanRequestDialog, setShowScanRequestDialog] = useState(false);
  const [selectedScanType, setSelectedScanType] = useState<string>('');
  const [scanNotes, setScanNotes] = useState('');

  // Search products for prescription (with stock info) - filter by category type based on item type
  const { data: productResults = [] } = useQuery({
    queryKey: ['products-search', productSearch, newPrescriptionItem.item_type],
    queryFn: async () => {
      if (productSearch.length < 2) return [];
      // Filter by category_type: medication items search medication categories, optical items search optical categories
      const categoryType = newPrescriptionItem.item_type === 'medication' ? 'medication' : 
                          ['spectacle', 'lens'].includes(newPrescriptionItem.item_type) ? 'optical' : '';
      const categoryParam = categoryType ? `&category_type=${categoryType}` : '';
      const response = await api.get(`/sales/products?search=${productSearch}&include_stock=true${categoryParam}`);
      return response.data;
    },
    enabled: productSearch.length >= 2,
  });

  useEffect(() => {
    setShowProductResults(productSearch.length >= 2 && productResults.length > 0);
  }, [productSearch, productResults]);

  // Initialize clinical record from session storage if available
  const getInitialClinicalRecord = () => {
    const saved = sessionStorage.getItem(`consultation-${visitId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  };

  const [clinicalRecord, setClinicalRecord] = useState(() => {
    const saved = getInitialClinicalRecord();
    return saved || {
      chief_complaint: '',
      history_of_present_illness: '',
      past_ocular_history: '',
      past_medical_history: '',
      family_history: '',
      visual_acuity_od: '',
      visual_acuity_os: '',
      iop_od: '',
      iop_os: '',
      anterior_segment_od: '',
      anterior_segment_os: '',
      posterior_segment_od: '',
      posterior_segment_os: '',
      diagnosis: '',
      management_plan: '',
      follow_up_date: '',
      notes: '',
    };
  });

  // Save to session storage whenever clinical record changes
  useEffect(() => {
    if (visitId) {
      sessionStorage.setItem(`consultation-${visitId}`, JSON.stringify(clinicalRecord));
    }
  }, [clinicalRecord, visitId]);

  const { data: visit, isLoading: visitLoading } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: async () => {
      const response = await api.get(`/clinical/visits/${visitId}`);
      return response.data;
    },
  });

  const { data: patient } = useQuery({
    queryKey: ['patient', visit?.patient_id],
    queryFn: async () => {
      const response = await api.get(`/patients/${visit.patient_id}`);
      return response.data;
    },
    enabled: !!visit?.patient_id,
  });

  const { data: patientHistory = [] } = useQuery({
    queryKey: ['patient-history', visit?.patient_id],
    queryFn: async () => {
      const response = await api.get(`/clinical/patients/${visit.patient_id}/records`);
      return response.data;
    },
    enabled: !!visit?.patient_id,
  });

  // Fetch existing prescriptions for this visit
  const { data: visitPrescriptions = [] } = useQuery({
    queryKey: ['visit-prescriptions', visitId],
    queryFn: async () => {
      const response = await api.get(`/clinical/visits/${visitId}/prescriptions`);
      return response.data;
    },
    enabled: !!visitId,
  });

  // Fetch scans for this visit/patient
  const { data: visitScans = [] } = useQuery({
    queryKey: ['visit-scans', visitId, visit?.patient_id],
    queryFn: async () => {
      const response = await api.get(`/technician/scans?visit_id=${visitId}`);
      return response.data;
    },
    enabled: !!visitId,
  });

  // Fetch patient's past scans (for history)
  const { data: patientScans = [] } = useQuery({
    queryKey: ['patient-scans', visit?.patient_id],
    queryFn: async () => {
      const response = await api.get(`/technician/scans?patient_id=${visit.patient_id}`);
      return response.data;
    },
    enabled: !!visit?.patient_id,
  });

  // Fetch insurance balance for this visit
  const { data: insuranceBalance } = useQuery({
    queryKey: ['insurance-balance', visitId],
    queryFn: async () => {
      const response = await api.get(`/patients/visits/${visitId}/insurance-balance`);
      return response.data;
    },
    enabled: !!visitId,
  });

  // AI Status and Analysis
  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: async () => {
      const response = await api.get('/ai/status');
      return response.data;
    },
  });

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const requestAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await api.post('/ai/analyze', {
        patient: {
          age: patient?.date_of_birth ? calculateAge(patient.date_of_birth) : 'Unknown',
          sex: patient?.sex || 'Unknown',
        },
        clinical_record: clinicalRecord,
        patient_history: patientHistory,  // Include patient history for AI analysis
      });
      setAiAnalysis(response.data.analysis);
    } catch (error: any) {
      toast({ 
        title: 'AI Analysis Failed', 
        description: error.response?.data?.detail || 'Could not complete analysis',
        variant: 'destructive' 
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const saveClinicalRecordMutation = useMutation({
    mutationFn: (data: typeof clinicalRecord) =>
      api.post(`/clinical/visits/${visitId}/record`, data),
    onSuccess: () => {
      toast({ title: 'Clinical record saved' });
      queryClient.invalidateQueries({ queryKey: ['visit', visitId] });
    },
    onError: () => {
      toast({ title: 'Failed to save clinical record', variant: 'destructive' });
    },
  });

  const createPrescriptionMutation = useMutation({
    mutationFn: (items: PrescriptionItem[]) =>
      api.post(`/clinical/visits/${visitId}/prescription`, { items }),
    onSuccess: () => {
      toast({ title: 'Prescription created and sent to front desk' });
      setPrescriptionItems([]);
      setIsPrescriptionDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['visit', visitId] });
    },
    onError: () => {
      toast({ title: 'Failed to create prescription', variant: 'destructive' });
    },
  });

  const completeConsultationMutation = useMutation({
    mutationFn: () => api.patch(`/clinical/visits/${visitId}/status`, { status: 'completed' }),
    onSuccess: () => {
      // Clear session storage for this consultation
      sessionStorage.removeItem(`consultation-${visitId}`);
      toast({ title: 'Consultation completed' });
      navigate('/doctor/queue');
    },
  });

  // Request scan mutation
  const requestScanMutation = useMutation({
    mutationFn: async (data: { scan_type: string; notes?: string }) => {
      const response = await api.post('/clinical/request-scan', {
        patient_id: visit?.patient_id,
        visit_id: parseInt(visitId || '0'),
        consultation_id: visit?.consultation_id,
        scan_type: data.scan_type,
        notes: data.notes,
      });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Scan requested', description: 'The technician will be notified' });
      setShowScanRequestDialog(false);
      setSelectedScanType('');
      setScanNotes('');
      queryClient.invalidateQueries({ queryKey: ['visit-scans'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to request scan', 
        description: error.response?.data?.detail || 'Please try again',
        variant: 'destructive' 
      });
    },
  });

  const handleRequestScan = () => {
    if (!selectedScanType) {
      toast({ title: 'Please select a scan type', variant: 'destructive' });
      return;
    }
    requestScanMutation.mutate({ scan_type: selectedScanType, notes: scanNotes });
  };

  const addPrescriptionItem = () => {
    if (!newPrescriptionItem.name) return;
    setPrescriptionItems([...prescriptionItems, { ...newPrescriptionItem }]);
    setNewPrescriptionItem({
      item_type: 'medication',
      name: '',
      description: '',
      dosage: '',
      duration: '',
      quantity: 1,
      unit_price: 0,
    });
  };

  const removePrescriptionItem = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };

  const handleSaveClinicalRecord = () => {
    saveClinicalRecordMutation.mutate(clinicalRecord);
  };

  const handleCreatePrescription = () => {
    if (prescriptionItems.length === 0) {
      toast({ title: 'Add at least one item to the prescription', variant: 'destructive' });
      return;
    }
    createPrescriptionMutation.mutate(prescriptionItems);
  };

  const handleCompleteConsultation = () => {
    completeConsultationMutation.mutate();
  };

  if (visitLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/doctor/queue')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Queue
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {patient?.first_name} {patient?.last_name}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Badge variant="outline">{patient?.patient_number}</Badge>
              <span>•</span>
              <span>{patient?.sex}</span>
              <span>•</span>
              <span>{patient?.date_of_birth}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleCompleteConsultation}>
            Complete Consultation
          </Button>
        </div>
      </div>

      {/* Payment Alert for Partial Payments */}
      {visit && visit.payment_status === 'partial' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-amber-800">Outstanding Balance</h3>
            <p className="text-amber-700 text-sm">
              This patient has a partial payment. Balance due: <strong>GH₵{((visit.consultation_fee || 0) - (visit.amount_paid || 0)).toLocaleString()}</strong>
            </p>
            <p className="text-amber-600 text-xs mt-1">
              Please remind the patient to complete payment at checkout.
            </p>
          </div>
        </div>
      )}

      {/* Insurance Balance Card */}
      {insuranceBalance?.is_insurance && (
        <div className={`rounded-lg p-4 flex items-start gap-3 ${
          insuranceBalance.insurance_remaining > 0 
            ? 'bg-blue-50 border border-blue-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className={`font-semibold ${insuranceBalance.insurance_remaining > 0 ? 'text-blue-800' : 'text-red-800'}`}>
                Insurance: {insuranceBalance.insurance_provider || 'Unknown Provider'}
              </h3>
              <Badge variant={insuranceBalance.insurance_remaining > 0 ? 'default' : 'destructive'}>
                {insuranceBalance.insurance_remaining > 0 ? 'Active' : 'Limit Exceeded'}
              </Badge>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Limit:</span>
                <p className="font-medium">GH₵{insuranceBalance.insurance_limit?.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Used:</span>
                <p className="font-medium">GH₵{insuranceBalance.insurance_used?.toLocaleString()}</p>
              </div>
              <div>
                <span className={insuranceBalance.insurance_remaining > 0 ? 'text-green-600' : 'text-red-600'}>Remaining:</span>
                <p className={`font-bold ${insuranceBalance.insurance_remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  GH₵{insuranceBalance.insurance_remaining?.toLocaleString()}
                </p>
              </div>
              {insuranceBalance.patient_topup > 0 && (
                <div>
                  <span className="text-red-600">Patient Top-up:</span>
                  <p className="font-bold text-red-600">GH₵{insuranceBalance.patient_topup?.toLocaleString()}</p>
                </div>
              )}
            </div>
            {insuranceBalance.insurance_remaining > 0 && (
              <p className="text-blue-600 text-xs mt-2">
                Medications up to GH₵{insuranceBalance.insurance_remaining?.toLocaleString()} will be covered by insurance.
              </p>
            )}
            {insuranceBalance.patient_topup > 0 && (
              <p className="text-red-600 text-xs mt-2">
                Patient must pay GH₵{insuranceBalance.patient_topup?.toLocaleString()} out of pocket.
              </p>
            )}
          </div>
        </div>
      )}

      <Tabs defaultValue="examination" className="space-y-4">
        <TabsList>
          <TabsTrigger value="examination">Examination</TabsTrigger>
          <TabsTrigger value="scans" className="relative">
            Scans
            {visitScans.filter((s: any) => s.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-yellow-500 text-white text-xs rounded-full flex items-center justify-center">
                {visitScans.filter((s: any) => s.status === 'pending').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Patient History</TabsTrigger>
          <TabsTrigger value="diagnosis">Diagnosis & Plan</TabsTrigger>
          {aiStatus?.enabled && <TabsTrigger value="ai-summary">AI Summary</TabsTrigger>}
        </TabsList>

        <TabsContent value="examination" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chief Complaint & History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Chief Complaint</Label>
                <Textarea
                  value={clinicalRecord.chief_complaint}
                  onChange={(e) =>
                    setClinicalRecord({ ...clinicalRecord, chief_complaint: e.target.value })
                  }
                  placeholder="Patient's main complaint..."
                />
              </div>
              <div className="space-y-2">
                <Label>History of Present Illness</Label>
                <Textarea
                  value={clinicalRecord.history_of_present_illness}
                  onChange={(e) =>
                    setClinicalRecord({ ...clinicalRecord, history_of_present_illness: e.target.value })
                  }
                  placeholder="Detailed history..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Past Ocular History</Label>
                  <Textarea
                    value={clinicalRecord.past_ocular_history}
                    onChange={(e) =>
                      setClinicalRecord({ ...clinicalRecord, past_ocular_history: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Past Medical History</Label>
                  <Textarea
                    value={clinicalRecord.past_medical_history}
                    onChange={(e) =>
                      setClinicalRecord({ ...clinicalRecord, past_medical_history: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Family History</Label>
                <Textarea
                  value={clinicalRecord.family_history}
                  onChange={(e) =>
                    setClinicalRecord({ ...clinicalRecord, family_history: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visual Acuity & IOP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Right Eye (OD)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Visual Acuity</Label>
                      <Input
                        value={clinicalRecord.visual_acuity_od}
                        onChange={(e) =>
                          setClinicalRecord({ ...clinicalRecord, visual_acuity_od: e.target.value })
                        }
                        placeholder="e.g., 6/6"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IOP (mmHg)</Label>
                      <Input
                        value={clinicalRecord.iop_od}
                        onChange={(e) =>
                          setClinicalRecord({ ...clinicalRecord, iop_od: e.target.value })
                        }
                        placeholder="e.g., 15"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">Left Eye (OS)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Visual Acuity</Label>
                      <Input
                        value={clinicalRecord.visual_acuity_os}
                        onChange={(e) =>
                          setClinicalRecord({ ...clinicalRecord, visual_acuity_os: e.target.value })
                        }
                        placeholder="e.g., 6/6"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IOP (mmHg)</Label>
                      <Input
                        value={clinicalRecord.iop_os}
                        onChange={(e) =>
                          setClinicalRecord({ ...clinicalRecord, iop_os: e.target.value })
                        }
                        placeholder="e.g., 15"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Segment Examination</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Right Eye (OD)</h4>
                  <div className="space-y-2">
                    <Label>Anterior Segment</Label>
                    <Textarea
                      value={clinicalRecord.anterior_segment_od}
                      onChange={(e) =>
                        setClinicalRecord({ ...clinicalRecord, anterior_segment_od: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Posterior Segment</Label>
                    <Textarea
                      value={clinicalRecord.posterior_segment_od}
                      onChange={(e) =>
                        setClinicalRecord({ ...clinicalRecord, posterior_segment_od: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">Left Eye (OS)</h4>
                  <div className="space-y-2">
                    <Label>Anterior Segment</Label>
                    <Textarea
                      value={clinicalRecord.anterior_segment_os}
                      onChange={(e) =>
                        setClinicalRecord({ ...clinicalRecord, anterior_segment_os: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Posterior Segment</Label>
                    <Textarea
                      value={clinicalRecord.posterior_segment_os}
                      onChange={(e) =>
                        setClinicalRecord({ ...clinicalRecord, posterior_segment_os: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveClinicalRecord} disabled={saveClinicalRecordMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveClinicalRecordMutation.isPending ? 'Saving...' : 'Save Examination'}
            </Button>
          </div>
        </TabsContent>

        {/* Scans Tab */}
        <TabsContent value="scans" className="space-y-4">
          {/* Request Scan Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Request Scan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Send the patient for a scan. The technician will be notified and results will appear here once completed.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => {
                    setSelectedScanType('oct');
                    setShowScanRequestDialog(true);
                  }}
                >
                  <Eye className="h-6 w-6 text-blue-600" />
                  <span>OCT Scan</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => {
                    setSelectedScanType('vft');
                    setShowScanRequestDialog(true);
                  }}
                >
                  <Eye className="h-6 w-6 text-purple-600" />
                  <span>Visual Field Test</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => {
                    setSelectedScanType('fundus');
                    setShowScanRequestDialog(true);
                  }}
                >
                  <Eye className="h-6 w-6 text-green-600" />
                  <span>Fundus Photography</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => {
                    setSelectedScanType('pachymeter');
                    setShowScanRequestDialog(true);
                  }}
                >
                  <Eye className="h-6 w-6 text-orange-600" />
                  <span>Pachymeter</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Visit Scans */}
          <Card>
            <CardHeader>
              <CardTitle>Scans for This Visit</CardTitle>
            </CardHeader>
            <CardContent>
              {visitScans.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No scans requested for this visit yet
                </p>
              ) : (
                <div className="space-y-3">
                  {visitScans.map((scan: any) => (
                    <div key={scan.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge className={
                            scan.scan_type === 'oct' ? 'bg-blue-100 text-blue-800' :
                            scan.scan_type === 'vft' ? 'bg-purple-100 text-purple-800' :
                            scan.scan_type === 'fundus' ? 'bg-green-100 text-green-800' :
                            'bg-orange-100 text-orange-800'
                          }>
                            {scan.scan_type?.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{scan.scan_number}</span>
                        </div>
                        <Badge variant={
                          scan.status === 'completed' || scan.status === 'reviewed' ? 'default' :
                          scan.status === 'pending' ? 'secondary' : 'outline'
                        }>
                          {scan.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                          {scan.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {scan.status}
                        </Badge>
                      </div>
                      
                      {scan.status === 'pending' && (
                        <p className="text-sm text-muted-foreground">
                          Waiting for technician to perform scan...
                        </p>
                      )}
                      
                      {(scan.status === 'completed' || scan.status === 'reviewed') && (
                        <div className="mt-3 space-y-2">
                          {scan.results_summary && (
                            <div className="bg-muted/50 rounded p-3">
                              <h5 className="text-sm font-medium mb-1">Results Summary</h5>
                              <p className="text-sm">{scan.results_summary}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {scan.od_results && Object.keys(scan.od_results).length > 0 && (
                              <div>
                                <h5 className="font-medium">OD (Right Eye)</h5>
                                <pre className="text-xs bg-muted/30 p-2 rounded mt-1 overflow-auto">
                                  {JSON.stringify(scan.od_results, null, 2)}
                                </pre>
                              </div>
                            )}
                            {scan.os_results && Object.keys(scan.os_results).length > 0 && (
                              <div>
                                <h5 className="font-medium">OS (Left Eye)</h5>
                                <pre className="text-xs bg-muted/30 p-2 rounded mt-1 overflow-auto">
                                  {JSON.stringify(scan.os_results, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                          {scan.has_pdf && (
                            <Button variant="outline" size="sm" className="mt-2">
                              <FileText className="h-4 w-4 mr-2" />
                              View PDF Report
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Patient's Past Scans */}
          {patientScans.filter((s: any) => !visitScans.some((vs: any) => vs.id === s.id)).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Previous Scans</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {patientScans
                    .filter((s: any) => !visitScans.some((vs: any) => vs.id === s.id))
                    .slice(0, 5)
                    .map((scan: any) => (
                      <div key={scan.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{scan.scan_type?.toUpperCase()}</Badge>
                          <span className="text-sm">{scan.scan_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {scan.scan_date ? new Date(scan.scan_date).toLocaleDateString() : ''}
                          </span>
                        </div>
                        <Badge variant={scan.status === 'completed' ? 'default' : 'secondary'}>
                          {scan.status}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Previous Visits & Records</CardTitle>
            </CardHeader>
            <CardContent>
              {patientHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No previous records found for this patient
                </p>
              ) : (
                <div className="space-y-4">
                  {patientHistory.map((record: any) => (
                    <div key={record.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-lg">
                          {new Date(record.visit_date || record.created_at).toLocaleDateString()}
                        </span>
                        <div className="flex gap-2">
                          <Badge variant="outline">{record.consultation_type || 'Consultation'}</Badge>
                          {record.diagnosis ? (
                            <Badge variant="success">Diagnosed</Badge>
                          ) : (
                            <Badge variant="warning">Pending Diagnosis</Badge>
                          )}
                        </div>
                      </div>
                      
                      {record.chief_complaint && (
                        <div className="text-sm">
                          <strong>Chief Complaint:</strong>
                          <p className="text-muted-foreground">{record.chief_complaint}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {record.visual_acuity_od && (
                          <div><strong>VA OD:</strong> {record.visual_acuity_od}</div>
                        )}
                        {record.visual_acuity_os && (
                          <div><strong>VA OS:</strong> {record.visual_acuity_os}</div>
                        )}
                        {record.iop_od && (
                          <div><strong>IOP OD:</strong> {record.iop_od}</div>
                        )}
                        {record.iop_os && (
                          <div><strong>IOP OS:</strong> {record.iop_os}</div>
                        )}
                      </div>
                      
                      {record.diagnosis && (
                        <div className="text-sm">
                          <strong>Diagnosis:</strong>
                          <p className="text-muted-foreground">{record.diagnosis}</p>
                        </div>
                      )}
                      
                      {record.management_plan && (
                        <div className="text-sm">
                          <strong>Management Plan:</strong>
                          <p className="text-muted-foreground">{record.management_plan}</p>
                        </div>
                      )}
                      
                      {record.follow_up_date && (
                        <div className="text-sm">
                          <strong>Follow-up:</strong> {new Date(record.follow_up_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnosis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Diagnosis</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={clinicalRecord.diagnosis}
                onChange={(e) =>
                  setClinicalRecord({ ...clinicalRecord, diagnosis: e.target.value })
                }
                placeholder="Enter diagnosis..."
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>

          {/* Medication Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between bg-blue-50">
              <CardTitle className="text-blue-800">Medications</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                setNewPrescriptionItem({ ...newPrescriptionItem, item_type: 'medication' });
                setIsPrescriptionDialogOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Medication
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Existing Medications */}
              {visitPrescriptions.some((p: any) => p.items.some((i: any) => i.item_type === 'medication')) ? (
                <div className="space-y-2">
                  {visitPrescriptions.map((prescription: any) => (
                    prescription.items
                      .filter((item: any) => item.item_type === 'medication')
                      .map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-blue-50/50 rounded border">
                          <div>
                            <span className="font-medium">{item.name}</span>
                            {item.dosage && <span className="text-muted-foreground ml-2">- {item.dosage}</span>}
                            {item.duration && <span className="text-muted-foreground ml-2">({item.duration})</span>}
                            {item.is_external && <Badge variant="outline" className="ml-2 text-xs">External</Badge>}
                            {item.was_out_of_stock && (
                              <Badge variant="warning" className="ml-2 text-xs">Was out of stock</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">Qty: {item.quantity}</span>
                            <Badge variant={prescription.status === 'paid' ? 'success' : 'secondary'} className="text-xs">
                              {prescription.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">No medications prescribed yet</p>
              )}
              
              {/* New Medication Items (not yet saved) */}
              {prescriptionItems.filter(item => item.item_type === 'medication').length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <h5 className="text-sm font-medium text-blue-700 mb-2">New Medications (unsaved)</h5>
                  {prescriptionItems.filter(item => item.item_type === 'medication').map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-blue-100/50 rounded mb-1">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        {item.dosage && <span className="text-muted-foreground ml-2">- {item.dosage}</span>}
                        {item.duration && <span className="text-muted-foreground ml-2">({item.duration})</span>}
                      </div>
                      <span className="text-sm">Qty: {item.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Optical Prescription Section (Glasses/Lens) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between bg-purple-50">
              <CardTitle className="text-purple-800">Optical Prescription (Glasses & Lens)</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                setNewPrescriptionItem({ ...newPrescriptionItem, item_type: 'spectacle' });
                setIsPrescriptionDialogOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Optical Rx
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Existing Optical Prescriptions */}
              {visitPrescriptions.some((p: any) => p.items.some((i: any) => ['spectacle', 'lens', 'other'].includes(i.item_type))) ? (
                <div className="space-y-2">
                  {visitPrescriptions.map((prescription: any) => (
                    prescription.items
                      .filter((item: any) => ['spectacle', 'lens', 'other'].includes(item.item_type))
                      .map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-purple-50/50 rounded border">
                          <div>
                            <Badge variant="outline" className="mr-2 text-xs">{item.item_type}</Badge>
                            <span className="font-medium">{item.name}</span>
                            {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
                            {item.is_external && <Badge variant="outline" className="ml-2 text-xs">External</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">Qty: {item.quantity}</span>
                            <Badge variant={prescription.status === 'paid' ? 'success' : 'secondary'} className="text-xs">
                              {prescription.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">No optical prescriptions yet</p>
              )}
              
              {/* New Optical Items (not yet saved) */}
              {prescriptionItems.filter(item => ['spectacle', 'lens', 'other'].includes(item.item_type)).length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <h5 className="text-sm font-medium text-purple-700 mb-2">New Optical Rx (unsaved)</h5>
                  {prescriptionItems.filter(item => ['spectacle', 'lens', 'other'].includes(item.item_type)).map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-purple-100/50 rounded mb-1">
                      <div>
                        <Badge variant="outline" className="mr-2 text-xs">{item.item_type}</Badge>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <span className="text-sm">Qty: {item.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Send All Prescriptions Button */}
          {prescriptionItems.length > 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-green-800">Ready to send {prescriptionItems.length} item(s) to Front Desk</h4>
                    <p className="text-sm text-green-600">Total: GH₵{prescriptionItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0).toLocaleString()}</p>
                  </div>
                  <Button 
                    onClick={handleCreatePrescription}
                    disabled={createPrescriptionMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {createPrescriptionMutation.isPending ? 'Sending...' : 'Send All to Front Desk'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Management Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Management Plan & Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={clinicalRecord.management_plan}
                onChange={(e) =>
                  setClinicalRecord({ ...clinicalRecord, management_plan: e.target.value })
                }
                placeholder="Enter management plan (treatment notes, referrals, patient education, etc.)..."
                className="min-h-[100px]"
              />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Follow-up Date</Label>
                  <Input
                    type="date"
                    value={clinicalRecord.follow_up_date}
                    onChange={(e) =>
                      setClinicalRecord({ ...clinicalRecord, follow_up_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Additional Notes</Label>
                <Textarea
                  value={clinicalRecord.notes}
                  onChange={(e) =>
                    setClinicalRecord({ ...clinicalRecord, notes: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button onClick={handleSaveClinicalRecord} disabled={saveClinicalRecordMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveClinicalRecordMutation.isPending ? 'Saving...' : 'Save Diagnosis & Plan'}
            </Button>
          </div>
        </TabsContent>

        {aiStatus?.enabled && (
          <TabsContent value="ai-summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>AI Clinical Analysis</span>
                  <Badge variant="outline">Powered by AI</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                  <strong>Disclaimer:</strong> This AI analysis is for reference only. All clinical decisions 
                  should be made by qualified healthcare professionals based on their clinical judgment.
                </div>
                
                {!aiAnalysis ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Click the button below to generate an AI-assisted analysis based on the clinical data entered.
                    </p>
                    <Button onClick={requestAiAnalysis} disabled={isAnalyzing}>
                      {isAnalyzing ? 'Analyzing...' : 'Generate AI Analysis'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={requestAiAnalysis} disabled={isAnalyzing}>
                        {isAnalyzing ? 'Refreshing...' : 'Refresh Analysis'}
                      </Button>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <div 
                        className="whitespace-pre-wrap bg-muted/50 rounded-md p-4"
                        dangerouslySetInnerHTML={{ 
                          __html: aiAnalysis
                            .replace(/^### (.*$)/gim, '<h3 class="font-semibold text-lg mt-4 mb-2">$1</h3>')
                            .replace(/^## (.*$)/gim, '<h2 class="font-bold text-xl mt-4 mb-2">$1</h2>')
                            .replace(/^# (.*$)/gim, '<h1 class="font-bold text-2xl mt-4 mb-2">$1</h1>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={isPrescriptionDialogOpen} onOpenChange={setIsPrescriptionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Prescription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newPrescriptionItem.item_type}
                  onValueChange={(value: 'medication' | 'spectacle' | 'lens' | 'other') =>
                    setNewPrescriptionItem({ ...newPrescriptionItem, item_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medication">Medication</SelectItem>
                    <SelectItem value="spectacle">Spectacle Rx</SelectItem>
                    <SelectItem value="lens">Contact Lens</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Name (search products or type custom)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={productSearch || newPrescriptionItem.name}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setNewPrescriptionItem({ 
                        ...newPrescriptionItem, 
                        name: e.target.value,
                        product_id: undefined,  // Clear product_id when typing custom
                        is_external: true,  // Mark as external when typing custom
                      });
                    }}
                    placeholder="Search products or type custom..."
                    className="pl-9"
                  />
                </div>
                {showProductResults && (
                  <div className="border rounded-md max-h-48 overflow-y-auto absolute z-10 bg-background w-full shadow-lg">
                    {productResults.map((product: any) => (
                      <div
                        key={product.id}
                        className={`p-2 hover:bg-muted cursor-pointer border-b last:border-b-0 ${product.stock_quantity === 0 ? 'bg-amber-50' : ''}`}
                        onClick={() => {
                          setNewPrescriptionItem({
                            ...newPrescriptionItem,
                            product_id: product.id,
                            name: product.name,
                            description: product.description || '',
                            unit_price: product.unit_price || 0,
                            stock_quantity: product.stock_quantity || 0,
                            is_external: false,
                          });
                          setProductSearch('');
                          setShowProductResults(false);
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium text-sm">{product.name}</span>
                            {product.stock_quantity === 0 && (
                              <div className="flex items-center gap-1 text-amber-600 text-xs mt-0.5">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Out of stock - Patient must get elsewhere</span>
                              </div>
                            )}
                            {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                              <div className="text-amber-600 text-xs mt-0.5">
                                Low stock: {product.stock_quantity} remaining
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground">GH₵{product.unit_price}</span>
                            {product.stock_quantity > 0 && (
                              <div className="text-xs text-green-600">In stock: {product.stock_quantity}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {newPrescriptionItem.is_external && newPrescriptionItem.name && !showProductResults && (
                  <div className="text-xs text-blue-600 mt-1">
                    This item is not in our inventory - will be marked as external prescription
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description / Instructions</Label>
              <Textarea
                value={newPrescriptionItem.description}
                onChange={(e) =>
                  setNewPrescriptionItem({ ...newPrescriptionItem, description: e.target.value })
                }
                placeholder="Dosage instructions, specifications, etc."
              />
            </div>
            {newPrescriptionItem.item_type === 'medication' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dosage</Label>
                  <Input
                    value={newPrescriptionItem.dosage}
                    onChange={(e) =>
                      setNewPrescriptionItem({ ...newPrescriptionItem, dosage: e.target.value })
                    }
                    placeholder="e.g., 1 drop twice daily"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input
                    value={newPrescriptionItem.duration}
                    onChange={(e) =>
                      setNewPrescriptionItem({ ...newPrescriptionItem, duration: e.target.value })
                    }
                    placeholder="e.g., 2 weeks"
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={newPrescriptionItem.quantity}
                  onChange={(e) =>
                    setNewPrescriptionItem({ ...newPrescriptionItem, quantity: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Price (GH₵)</Label>
                <Input
                  type="number"
                  min="0"
                  value={newPrescriptionItem.unit_price}
                  onChange={(e) =>
                    setNewPrescriptionItem({ ...newPrescriptionItem, unit_price: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={addPrescriptionItem} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>

            {prescriptionItems.length > 0 && (
              <div className="border rounded-lg p-4 space-y-2">
                <h4 className="font-medium">Prescription Items</h4>
                {prescriptionItems.map((item, index) => (
                  <div key={index} className={`py-2 border-b last:border-0 ${item.stock_quantity === 0 && !item.is_external ? 'bg-amber-50 -mx-2 px-2 rounded' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({item.item_type}) x{item.quantity}
                        </span>
                        {item.is_external && (
                          <Badge variant="outline" className="ml-2 text-xs">External</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>GH₵{(item.quantity * item.unit_price).toLocaleString()}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePrescriptionItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {item.stock_quantity === 0 && !item.is_external && (
                      <div className="flex items-center gap-1 text-amber-600 text-xs mt-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Out of stock - Patient must obtain elsewhere</span>
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex justify-between font-medium pt-2">
                  <span>Total</span>
                  <span>
                    GH₵{prescriptionItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0).toLocaleString()}
                  </span>
                </div>
                {prescriptionItems.some(item => item.stock_quantity === 0 && !item.is_external) && (
                  <div className="bg-amber-100 border border-amber-300 rounded p-2 text-sm text-amber-800 mt-2">
                    <strong>Note:</strong> Some items are out of stock. Patient will need to obtain these from another source.
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPrescriptionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreatePrescription}
              disabled={prescriptionItems.length === 0 || createPrescriptionMutation.isPending}
            >
              {createPrescriptionMutation.isPending ? 'Creating...' : 'Create & Send to Front Desk'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scan Request Dialog */}
      <Dialog open={showScanRequestDialog} onOpenChange={setShowScanRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Scan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <Eye className={`h-8 w-8 ${
                  selectedScanType === 'oct' ? 'text-blue-600' :
                  selectedScanType === 'vft' ? 'text-purple-600' :
                  selectedScanType === 'fundus' ? 'text-green-600' :
                  'text-orange-600'
                }`} />
                <div>
                  <h4 className="font-medium">
                    {selectedScanType === 'oct' && 'OCT Scan'}
                    {selectedScanType === 'vft' && 'Visual Field Test'}
                    {selectedScanType === 'fundus' && 'Fundus Photography'}
                    {selectedScanType === 'pachymeter' && 'Pachymeter'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedScanType === 'oct' && 'Optical Coherence Tomography - Retinal imaging'}
                    {selectedScanType === 'vft' && 'Visual Field Testing - Peripheral vision assessment'}
                    {selectedScanType === 'fundus' && 'Fundus Photography - Retinal photography'}
                    {selectedScanType === 'pachymeter' && 'Pachymeter - Corneal thickness measurement'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Notes for Technician (optional)</Label>
              <Textarea
                value={scanNotes}
                onChange={(e) => setScanNotes(e.target.value)}
                placeholder="Any specific instructions or areas of concern..."
              />
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
              <strong>Note:</strong> The patient will be sent to the technician for this scan. 
              Results will appear in the Scans tab once completed. You can continue with other 
              parts of the consultation while waiting.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowScanRequestDialog(false);
              setSelectedScanType('');
              setScanNotes('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleRequestScan} disabled={requestScanMutation.isPending}>
              {requestScanMutation.isPending ? 'Requesting...' : 'Request Scan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
