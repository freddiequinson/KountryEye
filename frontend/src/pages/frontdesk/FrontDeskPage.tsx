import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserPlus, CreditCard, Search, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ReceiptModal } from '@/components/ReceiptModal';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Visit {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_number: string;
  visit_type: string;
  status: string;
  consultation_type?: string;
  payment_status?: string;
  visit_date: string;
}

interface PendingPrescription {
  id: number;
  patient_name: string;
  patient_number: string;
  items: { name: string; quantity: number; unit_price: number }[];
  total_amount: number;
  created_at: string;
  status: string;
}

export default function FrontDeskPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Date filter state
  const [dateFilter, setDateFilter] = useState(searchParams.get('period') || 'today');
  const [customStartDate, setCustomStartDate] = useState(searchParams.get('start') || '');
  const [customEndDate, setCustomEndDate] = useState(searchParams.get('end') || '');

  const [isVisitDialogOpen, setIsVisitDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isVisitPaymentDialogOpen, setIsVisitPaymentDialogOpen] = useState(false);
  const [isRegistrationDialogOpen, setIsRegistrationDialogOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<PendingPrescription | null>(null);
  const [selectedVisitForPayment, setSelectedVisitForPayment] = useState<any>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('visits');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState({
    url: '',
    receiptNumber: '',
    patientName: '',
    totalAmount: 0,
  });

  // Handle navigation state from patient registration
  useEffect(() => {
    const state = location.state as { openVisitDialog?: boolean; selectedPatient?: any } | null;
    if (state?.openVisitDialog && state?.selectedPatient) {
      setSelectedPatient(state.selectedPatient);
      setIsVisitDialogOpen(true);
      // Clear the state to prevent re-opening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Handle tab query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'registrations') {
      setActiveTab('registrations');
    }
  }, [searchParams]);

  const [visitForm, setVisitForm] = useState({
    visit_type: 'full_checkup',
    reason: '',
    consultation_type_id: '',
    payment_type: 'cash',
    insurance_provider: '',
    insurance_id: '',
    insurance_number: '',
    insurance_limit: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    payment_method: 'cash',
    amount_paid: 0,
    reference: '',
  });

  const { data: todayVisits = [] } = useQuery({
    queryKey: ['today-visits', dateFilter, customStartDate, customEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFilter === 'custom' && customStartDate && customEndDate) {
        params.append('start_date', customStartDate);
        params.append('end_date', customEndDate);
      } else {
        params.append('period', dateFilter);
      }
      const response = await api.get(`/patients/visits?${params.toString()}`);
      return response.data;
    },
  });

  // Handler for date filter changes
  const handleDateFilterChange = (value: string) => {
    setDateFilter(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value !== 'today') {
      params.set('period', value);
    } else {
      params.delete('period');
    }
    setSearchParams(params, { replace: true });
  };

  const handleCustomStartDateChange = (value: string) => {
    setCustomStartDate(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('start', value);
    } else {
      params.delete('start');
    }
    setSearchParams(params, { replace: true });
  };

  const handleCustomEndDateChange = (value: string) => {
    setCustomEndDate(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('end', value);
    } else {
      params.delete('end');
    }
    setSearchParams(params, { replace: true });
  };

  const { data: pendingPrescriptions = [] } = useQuery({
    queryKey: ['pending-prescriptions'],
    queryFn: async () => {
      const response = await api.get('/clinical/prescriptions/pending');
      return response.data;
    },
  });

  const { data: consultationTypes = [] } = useQuery({
    queryKey: ['consultation-types'],
    queryFn: async () => {
      const response = await api.get('/clinical/types');
      return response.data;
    },
  });

  const { data: pendingPaymentVisits = [] } = useQuery({
    queryKey: ['pending-payment-visits'],
    queryFn: async () => {
      const response = await api.get('/patients/visits/pending-payment');
      return response.data;
    },
  });

  const { data: pendingRegistrations = [] } = useQuery({
    queryKey: ['pending-registrations'],
    queryFn: async () => {
      const response = await api.get('/patients/pending-registrations');
      return response.data;
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['patient-search', patientSearch],
    queryFn: async () => {
      if (patientSearch.length < 2) return [];
      const response = await api.get(`/patients/search?q=${patientSearch}`);
      return response.data;
    },
    enabled: patientSearch.length >= 2,
  });

  const createVisitMutation = useMutation({
    mutationFn: (data: any) => api.post('/patients/visits', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['today-visits'] });
      queryClient.invalidateQueries({ queryKey: ['pending-payment-visits'] });
      setIsVisitDialogOpen(false);
      setSelectedPatient(null);
      const paymentType = visitForm.payment_type;
      setVisitForm({
        visit_type: 'full_checkup',
        reason: '',
        consultation_type_id: '',
        payment_type: 'cash',
        insurance_provider: '',
        insurance_id: '',
        insurance_number: '',
        insurance_limit: '',
      });
      toast({ title: 'Visit recorded successfully' });
      
      // If cash payment, switch to visit payments tab to collect payment
      if (paymentType === 'cash') {
        setActiveTab('visit-payments');
        // Auto-open payment dialog for the new visit
        setTimeout(() => {
          const newVisit = response.data;
          if (newVisit) {
            setSelectedVisitForPayment({
              id: newVisit.id,
              visit_number: newVisit.visit_number,
              patient_name: selectedPatient?.first_name + ' ' + selectedPatient?.last_name,
              consultation_fee: newVisit.consultation_fee || 0,
              amount_paid: 0,
              balance: newVisit.consultation_fee || 0,
            });
            setIsVisitPaymentDialogOpen(true);
          }
        }, 500);
      }
    },
    onError: () => {
      toast({ title: 'Failed to record visit', variant: 'destructive' });
    },
  });

  const processPaymentMutation = useMutation({
    mutationFn: (data: any) =>
      api.post(`/clinical/prescriptions/${selectedPrescription?.id}/payment`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-prescriptions'] });
      setIsPaymentDialogOpen(false);
      setSelectedPrescription(null);
      toast({ title: 'Payment processed successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to process payment', variant: 'destructive' });
    },
  });

  const processVisitPaymentMutation = useMutation({
    mutationFn: (data: { visitId: number; amount: number }) =>
      api.post(`/patients/visits/${data.visitId}/pay`, { amount: data.amount }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-payment-visits'] });
      queryClient.invalidateQueries({ queryKey: ['today-visits'] });
      const visitId = variables.visitId;
      setIsVisitPaymentDialogOpen(false);
      
      // Find the visit data for receipt
      const visit = selectedVisitForPayment;
      if (visit) {
        setReceiptData({
          url: `/api/v1/receipts/visit/${visitId}`,
          receiptNumber: `VIS-${String(visitId).padStart(6, '0')}`,
          patientName: visit.patient_name || 'Unknown',
          totalAmount: variables.amount,
        });
        setIsReceiptModalOpen(true);
      }
      
      setSelectedVisitForPayment(null);
      toast({ title: 'Visit payment recorded successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to record payment', variant: 'destructive' });
    },
  });

  const approveRegistrationMutation = useMutation({
    mutationFn: (registrationId: number) =>
      api.post(`/patients/pending-registrations/${registrationId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });
      toast({ title: 'Patient registered successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to approve registration', variant: 'destructive' });
    },
  });

  const rejectRegistrationMutation = useMutation({
    mutationFn: (registrationId: number) =>
      api.delete(`/patients/pending-registrations/${registrationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });
      toast({ title: 'Registration rejected' });
    },
    onError: () => {
      toast({ title: 'Failed to reject registration', variant: 'destructive' });
    },
  });

  const handleRejectRegistration = (registrationId: number) => {
    rejectRegistrationMutation.mutate(registrationId);
  };

  const openRegistrationDialog = (reg: any) => {
    setSelectedRegistration({ ...reg });
    setIsRegistrationDialogOpen(true);
  };

  const updateRegistrationMutation = useMutation({
    mutationFn: (data: any) =>
      api.put(`/patients/pending-registrations/${selectedRegistration?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });
      toast({ title: 'Registration updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update registration', variant: 'destructive' });
    },
  });

  const handleSaveAndApprove = () => {
    if (selectedRegistration) {
      updateRegistrationMutation.mutate(selectedRegistration, {
        onSuccess: () => {
          approveRegistrationMutation.mutate(selectedRegistration.id);
          setIsRegistrationDialogOpen(false);
          setSelectedRegistration(null);
        }
      });
    }
  };

  const handleRecordVisit = () => {
    if (!selectedPatient) {
      toast({ title: 'Please select a patient', variant: 'destructive' });
      return;
    }
    
    // Check VisionCare membership if selected
    if (visitForm.payment_type === 'visioncare') {
      // Check if patient is a VisionCare member
      api.get(`/settings/visioncare/members?search=${selectedPatient.first_name} ${selectedPatient.last_name}`)
        .then(response => {
          const members = response.data;
          const isMember = members.some((member: any) => 
            member.first_name.toLowerCase() === selectedPatient.first_name.toLowerCase() &&
            member.last_name.toLowerCase() === selectedPatient.last_name.toLowerCase()
          );
          
          if (!isMember) {
            toast({ 
              title: 'Patient is not a VisionCare member', 
              description: 'Please check if the patient is enrolled in VisionCare or select a different payment method.',
              variant: 'destructive' 
            });
            return;
          }
          
          // Proceed with visit creation if member
          createVisitMutation.mutate({
            patient_id: selectedPatient.id,
            ...visitForm,
            consultation_type_id: visitForm.consultation_type_id ? parseInt(visitForm.consultation_type_id) : null,
            insurance_limit: visitForm.insurance_limit ? parseFloat(visitForm.insurance_limit) : null,
          });
        })
        .catch(() => {
          toast({ title: 'Failed to verify VisionCare membership', variant: 'destructive' });
        });
    } else {
      // Proceed normally for other payment types
      createVisitMutation.mutate({
        patient_id: selectedPatient.id,
        ...visitForm,
        consultation_type_id: visitForm.consultation_type_id ? parseInt(visitForm.consultation_type_id) : null,
        insurance_limit: visitForm.insurance_limit ? parseFloat(visitForm.insurance_limit) : null,
      });
    }
  };

  const handleProcessPayment = () => {
    processPaymentMutation.mutate({
      ...paymentForm,
      prescription_id: selectedPrescription?.id,
    });
  };

  const openPaymentDialog = (prescription: PendingPrescription) => {
    setSelectedPrescription(prescription);
    setPaymentForm({
      payment_method: 'cash',
      amount_paid: prescription.total_amount,
      reference: '',
    });
    setIsPaymentDialogOpen(true);
  };

  const getConsultationFee = () => {
    if (!visitForm.consultation_type_id) return 0;
    const type = consultationTypes.find((t: any) => t.id === parseInt(visitForm.consultation_type_id));
    return type?.base_fee || 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-tour="page-title">Front Desk</h1>
          <p className="text-muted-foreground">Manage visits and process payments</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateFilter} onValueChange={handleDateFilterChange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => handleCustomStartDateChange(e.target.value)}
                className="w-[150px]"
              />
              <span>to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => handleCustomEndDateChange(e.target.value)}
                className="w-[150px]"
              />
            </div>
          )}
          <Button onClick={() => setIsVisitDialogOpen(true)} data-tour="register-btn">
            <Plus className="mr-2 h-4 w-4" />
            Record Visit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today's Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayVisits.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Waiting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayVisits.filter((v: Visit) => v.status === 'waiting').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Consultation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayVisits.filter((v: Visit) => v.status === 'in_consultation').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Visit Payments Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPaymentVisits.length}</div>
          </CardContent>
        </Card>
        <Card className={pendingRegistrations.length > 0 ? "border-blue-500" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{pendingRegistrations.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="visits">Today's Visits</TabsTrigger>
          <TabsTrigger value="visit-payments">
            Visit Payments
            {pendingPaymentVisits.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingPaymentVisits.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments">
            Prescription Payments
            {pendingPrescriptions.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingPrescriptions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="registrations">
            New Registrations
            {pendingRegistrations.length > 0 && (
              <Badge variant="default" className="ml-2 bg-blue-500">
                {pendingRegistrations.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visits">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Visit Type</TableHead>
                    <TableHead>Consultation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayVisits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No visits recorded today
                      </TableCell>
                    </TableRow>
                  ) : (
                    todayVisits.map((visit: Visit) => (
                      <TableRow key={visit.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{visit.patient_name}</span>
                            <br />
                            <span className="text-sm text-muted-foreground">
                              {visit.patient_number}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {visit.visit_type === 'full_checkup' ? 'Full Check-up' : 'Enquiry'}
                          </Badge>
                        </TableCell>
                        <TableCell>{visit.consultation_type || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              visit.status === 'completed'
                                ? 'success'
                                : visit.status === 'in_consultation'
                                ? 'default'
                                : 'warning'
                            }
                          >
                            {visit.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(visit.visit_date).toLocaleTimeString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visit-payments">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Visit #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Consultation Fee</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPaymentVisits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No pending visit payments
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingPaymentVisits.map((visit: any) => (
                      <TableRow key={visit.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{visit.patient_name}</span>
                            <br />
                            <span className="text-sm text-muted-foreground">
                              {visit.patient_number}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{visit.visit_number || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={visit.payment_status === 'partial' ? 'warning' : 'destructive'}>
                            {visit.payment_status === 'partial' ? 'Partial Payment' : 'Unpaid'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          GH₵{(visit.consultation_fee || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          GH₵{(visit.amount_paid || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium text-red-600">
                          GH₵{(visit.balance || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedVisitForPayment(visit);
                              setIsVisitPaymentDialogOpen(true);
                            }}
                          >
                            <CreditCard className="mr-2 h-4 w-4" />
                            {visit.payment_status === 'partial' ? 'Complete Payment' : 'Record Payment'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPrescriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No pending prescription payments
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingPrescriptions.map((prescription: PendingPrescription) => (
                      <TableRow key={prescription.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{prescription.patient_name}</span>
                            <br />
                            <span className="text-sm text-muted-foreground">
                              {prescription.patient_number}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {prescription.items.map((item, i) => (
                            <div key={i} className="text-sm">
                              {item.name} x{item.quantity}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="font-medium">
                          GH₵{prescription.total_amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {new Date(prescription.created_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => openPaymentDialog(prescription)}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Process Payment
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registrations">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Date of Birth</TableHead>
                    <TableHead>Sex</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRegistrations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No pending registrations
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingRegistrations.map((reg: any) => (
                      <TableRow key={reg.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{reg.first_name} {reg.last_name}</span>
                            {reg.other_names && (
                              <span className="text-muted-foreground"> ({reg.other_names})</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{reg.phone}</div>
                            {reg.email && <div className="text-muted-foreground">{reg.email}</div>}
                          </div>
                        </TableCell>
                        <TableCell>{reg.date_of_birth || '-'}</TableCell>
                        <TableCell className="capitalize">{reg.sex || '-'}</TableCell>
                        <TableCell>
                          {new Date(reg.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openRegistrationDialog(reg)}
                            >
                              View/Edit
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleRejectRegistration(reg.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isVisitDialogOpen} onOpenChange={setIsVisitDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record New Visit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Search Patient</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search by name or patient number..."
                  className="pl-9"
                />
              </div>
              {patientSearch.length >= 2 && !selectedPatient && (
                <div className="border rounded-md min-h-[120px] max-h-48 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    <>
                      {searchResults.map((patient: any) => (
                        <div
                          key={patient.id}
                          className="p-2 hover:bg-muted cursor-pointer border-b"
                          onClick={() => {
                            setSelectedPatient(patient);
                            setPatientSearch('');
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-medium">
                              {patient.first_name} {patient.last_name}
                            </span>
                            <span className="text-xs bg-muted px-2 py-0.5 rounded">
                              {patient.patient_number}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {patient.phone && <span>{patient.phone}</span>}
                            {patient.date_of_birth && (
                              <span className="ml-2">DOB: {new Date(patient.date_of_birth).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="p-2 border-t bg-muted/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setIsVisitDialogOpen(false);
                            // Parse search term into first/last name and pass to registration
                            const parts = patientSearch.trim().split(/\s+/);
                            const firstName = parts[0] || '';
                            const lastName = parts.slice(1).join(' ') || '';
                            window.location.href = `/frontdesk/register?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`;
                          }}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Not found? Register New Patient
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-muted-foreground mb-2">No patients found matching "{patientSearch}"</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsVisitDialogOpen(false);
                          // Parse search term into first/last name and pass to registration
                          const parts = patientSearch.trim().split(/\s+/);
                          const firstName = parts[0] || '';
                          const lastName = parts.slice(1).join(' ') || '';
                          window.location.href = `/frontdesk/register?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`;
                        }}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Register New Patient
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {selectedPatient && (
                <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <div>
                    <span className="font-medium">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {selectedPatient.patient_number}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPatient(null)}
                  >
                    Change
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Visit Type</Label>
              <Select
                value={visitForm.visit_type}
                onValueChange={(value) => setVisitForm({ ...visitForm, visit_type: value })}
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
                  onChange={(e) => setVisitForm({ ...visitForm, reason: e.target.value })}
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
                      <Input
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
                        <Input
                          value={visitForm.insurance_id}
                          onChange={(e) =>
                            setVisitForm({ ...visitForm, insurance_id: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Membership Number</Label>
                        <Input
                          value={visitForm.insurance_number}
                          onChange={(e) =>
                            setVisitForm({ ...visitForm, insurance_number: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Insurance Limit (GH₵)</Label>
                      <Input
                        type="number"
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVisitDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordVisit} disabled={createVisitMutation.isPending}>
              {createVisitMutation.isPending ? 'Recording...' : 'Record Visit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
          </DialogHeader>
          {selectedPrescription && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md">
                <div className="font-medium mb-2">
                  {selectedPrescription.patient_name}
                </div>
                <div className="space-y-1 text-sm">
                  {selectedPrescription.items.map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span>
                        {item.name} x{item.quantity}
                      </span>
                      <span>GH₵{(item.quantity * item.unit_price).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                  <span>Total</span>
                  <span>GH₵{selectedPrescription.total_amount.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={paymentForm.payment_method}
                  onValueChange={(value) =>
                    setPaymentForm({ ...paymentForm, payment_method: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount Paid (GH₵)</Label>
                <Input
                  type="number"
                  value={paymentForm.amount_paid}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amount_paid: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              {paymentForm.payment_method !== 'cash' && (
                <div className="space-y-2">
                  <Label>Reference / Transaction ID</Label>
                  <Input
                    value={paymentForm.reference}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, reference: e.target.value })
                    }
                    placeholder="Enter reference number"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleProcessPayment} disabled={processPaymentMutation.isPending}>
              {processPaymentMutation.isPending ? 'Processing...' : 'Complete Payment & Print Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visit Payment Dialog */}
      <Dialog open={isVisitPaymentDialogOpen} onOpenChange={setIsVisitPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Visit Payment</DialogTitle>
          </DialogHeader>
          {selectedVisitForPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md">
                <div className="font-medium mb-2">
                  {selectedVisitForPayment.patient_name}
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  Visit: {selectedVisitForPayment.visit_number || 'N/A'}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Consultation Fee</span>
                    <span>GH₵{(selectedVisitForPayment.consultation_fee || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Already Paid</span>
                    <span>GH₵{(selectedVisitForPayment.amount_paid || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold mt-2 pt-2 border-t text-red-600">
                  <span>Balance Due</span>
                  <span>GH₵{(selectedVisitForPayment.balance || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Amount (GH₵)</Label>
                <Input
                  type="number"
                  defaultValue={selectedVisitForPayment.balance || 0}
                  id="visit-payment-amount"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVisitPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                const amountInput = document.getElementById('visit-payment-amount') as HTMLInputElement;
                const amount = parseFloat(amountInput?.value || '0');
                if (amount > 0 && selectedVisitForPayment) {
                  processVisitPaymentMutation.mutate({
                    visitId: selectedVisitForPayment.id,
                    amount: amount
                  });
                }
              }}
              disabled={processVisitPaymentMutation.isPending}
            >
              {processVisitPaymentMutation.isPending ? 'Processing...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receiptUrl={receiptData.url}
        receiptNumber={receiptData.receiptNumber}
        patientName={receiptData.patientName}
        totalAmount={receiptData.totalAmount}
      />

      {/* Registration View/Edit Dialog */}
      <Dialog open={isRegistrationDialogOpen} onOpenChange={setIsRegistrationDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Patient Registration</DialogTitle>
          </DialogHeader>
          {selectedRegistration && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    value={selectedRegistration.first_name || ''}
                    onChange={(e) => setSelectedRegistration({ ...selectedRegistration, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    value={selectedRegistration.last_name || ''}
                    onChange={(e) => setSelectedRegistration({ ...selectedRegistration, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Other Names</Label>
                  <Input
                    value={selectedRegistration.other_names || ''}
                    onChange={(e) => setSelectedRegistration({ ...selectedRegistration, other_names: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={selectedRegistration.date_of_birth || ''}
                    onChange={(e) => setSelectedRegistration({ ...selectedRegistration, date_of_birth: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sex</Label>
                  <Select
                    value={selectedRegistration.sex || ''}
                    onValueChange={(value) => setSelectedRegistration({ ...selectedRegistration, sex: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Marital Status</Label>
                  <Select
                    value={selectedRegistration.marital_status || ''}
                    onValueChange={(value) => setSelectedRegistration({ ...selectedRegistration, marital_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    value={selectedRegistration.phone || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setSelectedRegistration({ ...selectedRegistration, phone: value });
                    }}
                    maxLength={10}
                    placeholder="0200000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={selectedRegistration.email || ''}
                    onChange={(e) => setSelectedRegistration({ ...selectedRegistration, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea
                  value={selectedRegistration.address || ''}
                  onChange={(e) => setSelectedRegistration({ ...selectedRegistration, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Occupation</Label>
                  <Input
                    value={selectedRegistration.occupation || ''}
                    onChange={(e) => setSelectedRegistration({ ...selectedRegistration, occupation: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ghana Card Number</Label>
                  <Input
                    value={selectedRegistration.ghana_card || ''}
                    onChange={(e) => setSelectedRegistration({ ...selectedRegistration, ghana_card: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Emergency Contact Name</Label>
                  <Input
                    value={selectedRegistration.emergency_contact_name || ''}
                    onChange={(e) => setSelectedRegistration({ ...selectedRegistration, emergency_contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Contact Phone</Label>
                  <Input
                    value={selectedRegistration.emergency_contact_phone || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setSelectedRegistration({ ...selectedRegistration, emergency_contact_phone: value });
                    }}
                    maxLength={10}
                    placeholder="0200000000"
                  />
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Submitted: {selectedRegistration.created_at ? new Date(selectedRegistration.created_at).toLocaleString() : '-'}
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setIsRegistrationDialogOpen(false);
              setSelectedRegistration(null);
            }}>
              Cancel
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                updateRegistrationMutation.mutate(selectedRegistration);
              }}
              disabled={updateRegistrationMutation.isPending}
            >
              Save Changes
            </Button>
            <Button 
              onClick={handleSaveAndApprove}
              disabled={updateRegistrationMutation.isPending || approveRegistrationMutation.isPending}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {approveRegistrationMutation.isPending ? 'Approving...' : 'Save & Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
