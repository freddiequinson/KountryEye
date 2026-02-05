import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Eye,
  Upload,
  Loader2,
  Search,
  User,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function NewScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get pre-selected values from URL
  const preSelectedType = searchParams.get('type') || '';
  const preSelectedReferral = searchParams.get('referral') || '';
  const preSelectedPatient = searchParams.get('patient') || '';
  const preSelectedVisit = searchParams.get('visit') || '';

  // Form state
  const [scanType, setScanType] = useState(preSelectedType);
  const [patientId, setPatientId] = useState(preSelectedPatient);
  const [externalReferralId, setExternalReferralId] = useState(preSelectedReferral);
  const [visitId, setVisitId] = useState(preSelectedVisit);
  const [resultsSummary, setResultsSummary] = useState('');
  const [notes, setNotes] = useState('');

  // OD (Right Eye) Results
  const [odResults, setOdResults] = useState<Record<string, string>>({});
  // OS (Left Eye) Results
  const [osResults, setOsResults] = useState<Record<string, string>>({});

  // Patient search
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientSearch, setShowPatientSearch] = useState(false);

  // Fetch patients for search
  const { data: patients = [] } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: async () => {
      if (!patientSearch || patientSearch.length < 2) return [];
      const response = await api.get(`/patients?search=${patientSearch}&limit=10`);
      return response.data.patients || response.data || [];
    },
    enabled: patientSearch.length >= 2,
  });

  // Fetch external referrals
  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals-for-scan'],
    queryFn: async () => {
      const response = await api.get('/technician/referrals?status=pending&limit=50');
      return response.data;
    },
  });

  // Create scan mutation
  const createScanMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/technician/scans', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `Scan ${data.scan_number} created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      navigate(`/technician/scans/${data.id}`);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create scan',
        variant: 'destructive',
      });
    },
  });

  const scanTypeLabels: Record<string, string> = {
    oct: 'Optical Coherence Tomography (OCT)',
    vft: 'Visual Field Test (VFT)',
    fundus: 'Fundus Photography',
    pachymeter: 'Pachymeter',
  };

  // Scan-specific fields based on type
  const getScanFields = (type: string) => {
    switch (type) {
      case 'oct':
        return [
          { key: 'rnfl_thickness', label: 'RNFL Thickness (μm)' },
          { key: 'ganglion_cell', label: 'Ganglion Cell Analysis' },
          { key: 'macula_thickness', label: 'Macula Thickness (μm)' },
          { key: 'optic_disc', label: 'Optic Disc Analysis' },
          { key: 'findings', label: 'Key Findings' },
        ];
      case 'vft':
        return [
          { key: 'mean_deviation', label: 'Mean Deviation (MD)' },
          { key: 'pattern_sd', label: 'Pattern Standard Deviation (PSD)' },
          { key: 'vfi', label: 'Visual Field Index (VFI)' },
          { key: 'reliability', label: 'Reliability Indices' },
          { key: 'findings', label: 'Key Findings' },
        ];
      case 'fundus':
        return [
          { key: 'optic_disc', label: 'Optic Disc' },
          { key: 'macula', label: 'Macula' },
          { key: 'vessels', label: 'Blood Vessels' },
          { key: 'periphery', label: 'Periphery' },
          { key: 'findings', label: 'Key Findings' },
        ];
      case 'pachymeter':
        return [
          { key: 'central_thickness', label: 'Central Corneal Thickness (μm)' },
          { key: 'thinnest_point', label: 'Thinnest Point (μm)' },
          { key: 'thinnest_location', label: 'Thinnest Location' },
          { key: 'findings', label: 'Key Findings' },
        ];
      default:
        return [];
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!scanType) {
      toast({
        title: 'Validation Error',
        description: 'Please select a scan type',
        variant: 'destructive',
      });
      return;
    }

    if (!patientId && !externalReferralId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a patient or external referral',
        variant: 'destructive',
      });
      return;
    }

    createScanMutation.mutate({
      scan_type: scanType,
      patient_id: patientId ? parseInt(patientId) : null,
      external_referral_id: externalReferralId ? parseInt(externalReferralId) : null,
      visit_id: visitId ? parseInt(visitId) : null,
      od_results: odResults,
      os_results: osResults,
      results_summary: resultsSummary || null,
      notes: notes || null,
    });
  };

  const scanFields = getScanFields(scanType);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Scan</h1>
          <p className="text-muted-foreground">
            Record OCT, Visual Field, Fundus, or Pachymeter scan results
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Scan Type & Patient */}
          <div className="space-y-6">
            {/* Scan Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Scan Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(scanTypeLabels).map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      variant={scanType === key ? 'default' : 'outline'}
                      className="h-auto py-3 flex-col gap-1"
                      onClick={() => setScanType(key)}
                    >
                      <Eye className="h-5 w-5" />
                      <span className="text-xs">{label.split('(')[0].trim()}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Patient/Referral Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Patient / Client</CardTitle>
                <CardDescription>
                  Select an existing patient or external referral
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue={externalReferralId ? 'referral' : 'patient'}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="patient">Patient</TabsTrigger>
                    <TabsTrigger value="referral">External Referral</TabsTrigger>
                  </TabsList>
                  <TabsContent value="patient" className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search patient by name or number..."
                        value={patientSearch}
                        onChange={(e) => {
                          setPatientSearch(e.target.value);
                          setShowPatientSearch(true);
                        }}
                        onFocus={() => setShowPatientSearch(true)}
                        className="pl-9"
                      />
                    </div>
                    {showPatientSearch && patients.length > 0 && (
                      <div className="border rounded-md max-h-48 overflow-y-auto">
                        {patients.map((patient: any) => (
                          <div
                            key={patient.id}
                            className="p-2 hover:bg-muted cursor-pointer flex items-center gap-2"
                            onClick={() => {
                              setPatientId(patient.id.toString());
                              setPatientSearch(`${patient.first_name} ${patient.last_name}`);
                              setShowPatientSearch(false);
                              setExternalReferralId('');
                            }}
                          >
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">
                                {patient.first_name} {patient.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {patient.patient_number}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {patientId && (
                      <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                        Patient selected: {patientSearch}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="referral" className="space-y-4">
                    <Select
                      value={externalReferralId}
                      onValueChange={(val) => {
                        setExternalReferralId(val);
                        setPatientId('');
                        setPatientSearch('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select external referral" />
                      </SelectTrigger>
                      <SelectContent>
                        {referrals.map((ref: any) => (
                          <SelectItem key={ref.id} value={ref.id.toString()}>
                            {ref.client_name} - {ref.referral_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2 space-y-6">
            {scanType ? (
              <>
                {/* Eye Results */}
                <Card>
                  <CardHeader>
                    <CardTitle>{scanTypeLabels[scanType]} Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* OD (Right Eye) */}
                      <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">
                          OD (Right Eye)
                        </h3>
                        {scanFields.map((field) => (
                          <div key={`od-${field.key}`}>
                            <Label htmlFor={`od-${field.key}`}>{field.label}</Label>
                            {field.key === 'findings' ? (
                              <Textarea
                                id={`od-${field.key}`}
                                value={odResults[field.key] || ''}
                                onChange={(e) =>
                                  setOdResults({ ...odResults, [field.key]: e.target.value })
                                }
                                rows={2}
                              />
                            ) : (
                              <Input
                                id={`od-${field.key}`}
                                value={odResults[field.key] || ''}
                                onChange={(e) =>
                                  setOdResults({ ...odResults, [field.key]: e.target.value })
                                }
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* OS (Left Eye) */}
                      <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">
                          OS (Left Eye)
                        </h3>
                        {scanFields.map((field) => (
                          <div key={`os-${field.key}`}>
                            <Label htmlFor={`os-${field.key}`}>{field.label}</Label>
                            {field.key === 'findings' ? (
                              <Textarea
                                id={`os-${field.key}`}
                                value={osResults[field.key] || ''}
                                onChange={(e) =>
                                  setOsResults({ ...osResults, [field.key]: e.target.value })
                                }
                                rows={2}
                              />
                            ) : (
                              <Input
                                id={`os-${field.key}`}
                                value={osResults[field.key] || ''}
                                onChange={(e) =>
                                  setOsResults({ ...osResults, [field.key]: e.target.value })
                                }
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Summary & Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Summary & Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="resultsSummary">Results Summary</Label>
                      <Textarea
                        id="resultsSummary"
                        placeholder="Overall interpretation and summary of findings..."
                        value={resultsSummary}
                        onChange={(e) => setResultsSummary(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes">Additional Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Any additional notes or observations..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a scan type to enter results</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={createScanMutation.isPending}>
            {createScanMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Save Scan
          </Button>
        </div>
      </form>
    </div>
  );
}
