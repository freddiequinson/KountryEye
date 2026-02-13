import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Download,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface InsuranceCompany {
  id: number;
  name: string;
  code: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
  is_active: boolean;
  created_at?: string;
  fee_overrides_count?: number;
  fee_overrides?: FeeOverride[];
}

interface FeeOverride {
  id: number;
  consultation_type_id: number;
  consultation_type_name?: string;
  override_fee?: number;
  initial_fee?: number;
  review_fee?: number;
  subsequent_fee?: number;
}

interface ConsultationType {
  id: number;
  name: string;
  base_fee: number;
  initial_fee?: number;
  review_fee?: number;
  subsequent_fee?: number;
}

interface AnalyticsSummary {
  summary: Array<{
    provider: string;
    visit_count: number;
    total_owed: number;
  }>;
  totals: {
    total_owed: number;
    total_visits: number;
    provider_count: number;
  };
}

export default function InsuranceCompaniesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [isFeeOverrideDialogOpen, setIsFeeOverrideDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<InsuranceCompany | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<InsuranceCompany | null>(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [companyForm, setCompanyForm] = useState({
    name: '',
    code: '',
    contact_phone: '',
    contact_email: '',
    address: '',
    is_active: true,
  });

  const [feeOverrideForm, setFeeOverrideForm] = useState({
    consultation_type_id: '',
    override_fee: '',
    initial_fee: '',
    review_fee: '',
    subsequent_fee: '',
  });

  const [dateRange, setDateRange] = useState({
    start_date: '',
    end_date: '',
  });

  // Queries
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['insurance-companies', showInactive],
    queryFn: async () => {
      const response = await api.get(`/insurance?include_inactive=${showInactive}`);
      return response.data;
    },
  });

  const { data: consultationTypes = [] } = useQuery<ConsultationType[]>({
    queryKey: ['consultation-types'],
    queryFn: async () => {
      const response = await api.get('/clinical/types');
      return response.data;
    },
  });

  const { data: analyticsSummary } = useQuery<AnalyticsSummary>({
    queryKey: ['insurance-analytics', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.start_date) params.append('start_date', dateRange.start_date);
      if (dateRange.end_date) params.append('end_date', dateRange.end_date);
      const response = await api.get(`/insurance/analytics/summary?${params}`);
      return response.data;
    },
  });

  const { data: selectedCompanyDetails } = useQuery({
    queryKey: ['insurance-company', selectedCompanyId],
    queryFn: async () => {
      const response = await api.get(`/insurance/${selectedCompanyId}`);
      return response.data;
    },
    enabled: !!selectedCompanyId,
  });

  // Mutations
  const createCompanyMutation = useMutation({
    mutationFn: (data: typeof companyForm) => api.post('/insurance', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-companies'] });
      setIsCompanyDialogOpen(false);
      resetCompanyForm();
      toast({ title: 'Insurance company created successfully' });
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.detail || 'Failed to create company', variant: 'destructive' });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: (data: typeof companyForm) => api.put(`/insurance/${editingCompany?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-companies'] });
      setIsCompanyDialogOpen(false);
      setEditingCompany(null);
      resetCompanyForm();
      toast({ title: 'Insurance company updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.detail || 'Failed to update company', variant: 'destructive' });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/insurance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-companies'] });
      setIsDeleteDialogOpen(false);
      setDeletingCompany(null);
      toast({ title: 'Insurance company deactivated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to deactivate company', variant: 'destructive' });
    },
  });

  const createFeeOverrideMutation = useMutation({
    mutationFn: (data: any) => api.post(`/insurance/${selectedCompanyId}/fee-overrides`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-company', selectedCompanyId] });
      setIsFeeOverrideDialogOpen(false);
      resetFeeOverrideForm();
      toast({ title: 'Fee override created successfully' });
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.detail || 'Failed to create fee override', variant: 'destructive' });
    },
  });

  const deleteFeeOverrideMutation = useMutation({
    mutationFn: ({ companyId, overrideId }: { companyId: number; overrideId: number }) =>
      api.delete(`/insurance/${companyId}/fee-overrides/${overrideId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-company', selectedCompanyId] });
      toast({ title: 'Fee override deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete fee override', variant: 'destructive' });
    },
  });

  const resetCompanyForm = () => {
    setCompanyForm({
      name: '',
      code: '',
      contact_phone: '',
      contact_email: '',
      address: '',
      is_active: true,
    });
  };

  const resetFeeOverrideForm = () => {
    setFeeOverrideForm({
      consultation_type_id: '',
      override_fee: '',
      initial_fee: '',
      review_fee: '',
      subsequent_fee: '',
    });
  };

  const handleEditCompany = (company: InsuranceCompany) => {
    setEditingCompany(company);
    setCompanyForm({
      name: company.name,
      code: company.code,
      contact_phone: company.contact_phone || '',
      contact_email: company.contact_email || '',
      address: company.address || '',
      is_active: company.is_active,
    });
    setIsCompanyDialogOpen(true);
  };

  const handleSubmitCompany = () => {
    if (editingCompany) {
      updateCompanyMutation.mutate(companyForm);
    } else {
      createCompanyMutation.mutate(companyForm);
    }
  };

  const handleSubmitFeeOverride = () => {
    const data = {
      consultation_type_id: parseInt(feeOverrideForm.consultation_type_id),
      override_fee: feeOverrideForm.override_fee ? parseFloat(feeOverrideForm.override_fee) : null,
      initial_fee: feeOverrideForm.initial_fee ? parseFloat(feeOverrideForm.initial_fee) : null,
      review_fee: feeOverrideForm.review_fee ? parseFloat(feeOverrideForm.review_fee) : null,
      subsequent_fee: feeOverrideForm.subsequent_fee ? parseFloat(feeOverrideForm.subsequent_fee) : null,
    };
    createFeeOverrideMutation.mutate(data);
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (dateRange.start_date) params.append('start_date', dateRange.start_date);
      if (dateRange.end_date) params.append('end_date', dateRange.end_date);
      
      const response = await api.get(`/insurance/analytics/export?${params}`, {
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `insurance_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({ title: 'Report exported successfully' });
    } catch {
      toast({ title: 'Failed to export report', variant: 'destructive' });
    }
  };

  const formatCurrency = (amount: number) => {
    return `GH₵ ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Insurance Companies</h1>
          <p className="text-muted-foreground">Manage insurance providers and view analytics</p>
        </div>
        <Button onClick={() => { resetCompanyForm(); setEditingCompany(null); setIsCompanyDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Insurance Company
        </Button>
      </div>

      <Tabs defaultValue="companies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="companies">
            <Building2 className="h-4 w-4 mr-2" />
            Companies
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive">Show inactive companies</Label>
            </div>
          </div>

          {companiesLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="space-y-4">
              {companies.map((company: InsuranceCompany) => (
                <Card key={company.id} className={!company.is_active ? 'opacity-60' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-8 w-8 text-primary" />
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {company.name}
                            <Badge variant="outline">{company.code}</Badge>
                            {!company.is_active && <Badge variant="secondary">Inactive</Badge>}
                          </CardTitle>
                          <CardDescription>
                            {company.contact_phone && <span className="mr-4">📞 {company.contact_phone}</span>}
                            {company.contact_email && <span>✉️ {company.contact_email}</span>}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (expandedCompanyId === company.id) {
                              setExpandedCompanyId(null);
                              setSelectedCompanyId(null);
                            } else {
                              setExpandedCompanyId(company.id);
                              setSelectedCompanyId(company.id);
                            }
                          }}
                        >
                          {expandedCompanyId === company.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          Fee Overrides
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEditCompany(company)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setDeletingCompany(company); setIsDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {expandedCompanyId === company.id && selectedCompanyDetails && (
                    <CardContent className="pt-4 border-t">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold">Fee Overrides by Consultation Type</h4>
                        <Button
                          size="sm"
                          onClick={() => {
                            resetFeeOverrideForm();
                            setIsFeeOverrideDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Override
                        </Button>
                      </div>
                      
                      {selectedCompanyDetails.fee_overrides?.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Consultation Type</TableHead>
                              <TableHead>Override Fee</TableHead>
                              <TableHead>Initial Fee</TableHead>
                              <TableHead>Review Fee</TableHead>
                              <TableHead>Subsequent Fee</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedCompanyDetails.fee_overrides.map((override: FeeOverride) => (
                              <TableRow key={override.id}>
                                <TableCell className="font-medium">{override.consultation_type_name}</TableCell>
                                <TableCell>{override.override_fee ? formatCurrency(override.override_fee) : '-'}</TableCell>
                                <TableCell>{override.initial_fee ? formatCurrency(override.initial_fee) : '-'}</TableCell>
                                <TableCell>{override.review_fee ? formatCurrency(override.review_fee) : '-'}</TableCell>
                                <TableCell>{override.subsequent_fee ? formatCurrency(override.subsequent_fee) : '-'}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteFeeOverrideMutation.mutate({
                                      companyId: company.id,
                                      overrideId: override.id
                                    })}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          No fee overrides configured. Standard consultation fees will apply.
                        </p>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
              
              {companies.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No insurance companies found. Add one to get started.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={dateRange.start_date}
                onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={dateRange.end_date}
                onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
              />
            </div>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Insurance Owed</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(analyticsSummary?.totals?.total_owed || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {analyticsSummary?.totals?.provider_count || 0} providers
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Insurance Visits</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsSummary?.totals?.total_visits || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Patients using insurance
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Per Visit</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    analyticsSummary?.totals?.total_visits
                      ? (analyticsSummary.totals.total_owed / analyticsSummary.totals.total_visits)
                      : 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Per insurance visit
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Amount Owed by Insurance Provider</CardTitle>
              <CardDescription>Breakdown of insurance claims by provider</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Total Owed</TableHead>
                    <TableHead className="text-right">Avg per Visit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analyticsSummary?.summary?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        <Badge variant="outline">{item.provider}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.visit_count}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.total_owed)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.visit_count ? item.total_owed / item.visit_count : 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!analyticsSummary?.summary || analyticsSummary.summary.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No insurance data found for the selected period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Company Dialog */}
      <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCompany ? 'Edit Insurance Company' : 'Add Insurance Company'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                placeholder="e.g., National Health Insurance Scheme"
              />
            </div>
            <div className="space-y-2">
              <Label>Short Code *</Label>
              <Input
                value={companyForm.code}
                onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g., NHIS"
                maxLength={20}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input
                  value={companyForm.contact_phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, contact_phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={companyForm.contact_email}
                  onChange={(e) => setCompanyForm({ ...companyForm, contact_email: e.target.value })}
                  placeholder="Email address"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={companyForm.address}
                onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                placeholder="Company address"
                rows={2}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is-active"
                checked={companyForm.is_active}
                onCheckedChange={(checked) => setCompanyForm({ ...companyForm, is_active: checked })}
              />
              <Label htmlFor="is-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompanyDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitCompany}
              disabled={!companyForm.name || !companyForm.code}
            >
              {editingCompany ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Override Dialog */}
      <Dialog open={isFeeOverrideDialogOpen} onOpenChange={setIsFeeOverrideDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Fee Override</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Consultation Type *</Label>
              <Select
                value={feeOverrideForm.consultation_type_id}
                onValueChange={(value) => setFeeOverrideForm({ ...feeOverrideForm, consultation_type_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select consultation type" />
                </SelectTrigger>
                <SelectContent>
                  {consultationTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Single Override Fee (applies to all visit types)</Label>
              <Input
                type="number"
                value={feeOverrideForm.override_fee}
                onChange={(e) => setFeeOverrideForm({ ...feeOverrideForm, override_fee: e.target.value })}
                placeholder="Leave empty to use per-type fees"
              />
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-3">Or set fees per visit type:</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Initial Fee</Label>
                  <Input
                    type="number"
                    value={feeOverrideForm.initial_fee}
                    onChange={(e) => setFeeOverrideForm({ ...feeOverrideForm, initial_fee: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Review Fee</Label>
                  <Input
                    type="number"
                    value={feeOverrideForm.review_fee}
                    onChange={(e) => setFeeOverrideForm({ ...feeOverrideForm, review_fee: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Subsequent Fee</Label>
                  <Input
                    type="number"
                    value={feeOverrideForm.subsequent_fee}
                    onChange={(e) => setFeeOverrideForm({ ...feeOverrideForm, subsequent_fee: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFeeOverrideDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitFeeOverride}
              disabled={!feeOverrideForm.consultation_type_id}
            >
              Create Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Insurance Company?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate "{deletingCompany?.name}". It will no longer appear in dropdowns but existing records will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCompany && deleteCompanyMutation.mutate(deletingCompany.id)}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
