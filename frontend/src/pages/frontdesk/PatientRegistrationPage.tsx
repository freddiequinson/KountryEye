import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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

interface DuplicateCandidate {
  id: number;
  patient_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth: string;
  match_score: number;
}

export default function PatientRegistrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);

  // Get prefilled values from URL params
  const prefilledFirstName = searchParams.get('firstName') || '';
  const prefilledLastName = searchParams.get('lastName') || '';

  const [formData, setFormData] = useState({
    first_name: prefilledFirstName,
    last_name: prefilledLastName,
    other_names: '',
    date_of_birth: '',
    sex: '',
    marital_status: '',
    phone: '',
    email: '',
    address: '',
    nationality: 'Ghanaian',
    occupation: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    ghana_card: '',
    branch_id: 1,
  });

  const checkDuplicatesMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/patients/check-duplicates', data),
    onSuccess: (response) => {
      if (response.data.length > 0) {
        setDuplicateCandidates(response.data);
        setShowDuplicateDialog(true);
      } else {
        registerPatientMutation.mutate(formData);
      }
    },
  });

  const registerPatientMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const cleanedData: Record<string, any> = { ...data };
      if (!cleanedData.sex) delete cleanedData.sex;
      if (!cleanedData.marital_status) delete cleanedData.marital_status;
      if (!cleanedData.date_of_birth) delete cleanedData.date_of_birth;
      if (!cleanedData.email) delete cleanedData.email;
      return api.post('/patients', cleanedData);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast({ title: 'Patient registered successfully' });
      // Navigate to front desk with the new patient pre-selected for visit recording
      navigate('/frontdesk', { 
        state: { 
          openVisitDialog: true, 
          selectedPatient: {
            id: response.data.id,
            patient_number: response.data.patient_number,
            first_name: response.data.first_name,
            last_name: response.data.last_name,
            phone: response.data.phone,
          }
        } 
      });
    },
    onError: () => {
      toast({ title: 'Failed to register patient', variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) {
      toast({ title: 'First name and last name are required', variant: 'destructive' });
      return;
    }
    checkDuplicatesMutation.mutate(formData);
  };

  const handleUseExisting = (patientId: number) => {
    setShowDuplicateDialog(false);
    navigate(`/patients/${patientId}`);
  };

  const handleRegisterAnyway = () => {
    setShowDuplicateDialog(false);
    registerPatientMutation.mutate(formData);
  };

  const calculateAge = (dob: string) => {
    if (!dob) return '';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} years`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/patients')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Patient Registration</h1>
          <p className="text-muted-foreground">Register a new patient</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Surname / Last Name *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Other Names (Middle Name)</Label>
                <Input
                  value={formData.other_names}
                  onChange={(e) => setFormData({ ...formData, other_names: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
                {formData.date_of_birth && (
                  <p className="text-sm text-muted-foreground">Age: {calculateAge(formData.date_of_birth)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Sex</Label>
                <Select
                  value={formData.sex}
                  onValueChange={(value) => setFormData({ ...formData, sex: value })}
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
                  value={formData.marital_status}
                  onValueChange={(value) => setFormData({ ...formData, marital_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select marital status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                    <SelectItem value="divorced">Divorced</SelectItem>
                    <SelectItem value="widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nationality</Label>
                <Input
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Occupation</Label>
                <Input
                  value={formData.occupation}
                  onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ghana Card Number</Label>
                <Input
                  value={formData.ghana_card}
                  onChange={(e) => setFormData({ ...formData, ghana_card: e.target.value })}
                  placeholder="GHA-XXXXXXXXX-X"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+233 XX XXX XXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full address"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Emergency Contact / Next of Kin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.emergency_contact_name}
                  onChange={(e) =>
                    setFormData({ ...formData, emergency_contact_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={formData.emergency_contact_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, emergency_contact_phone: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/frontdesk')}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={checkDuplicatesMutation.isPending || registerPatientMutation.isPending}
            >
              {checkDuplicatesMutation.isPending || registerPatientMutation.isPending
                ? 'Processing...'
                : 'Register Patient'}
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Possible Duplicate Found
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              We found existing patients that may match this registration. Please review:
            </p>
            <div className="space-y-2">
              {duplicateCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleUseExisting(candidate.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">
                        {candidate.first_name} {candidate.last_name}
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {candidate.patient_number}
                      </Badge>
                    </div>
                    <Badge variant={candidate.match_score > 80 ? 'destructive' : 'warning'}>
                      {candidate.match_score}% match
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {candidate.phone && <span>Phone: {candidate.phone}</span>}
                    {candidate.date_of_birth && (
                      <span className="ml-4">DOB: {candidate.date_of_birth}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleRegisterAnyway}>
              Register as New Patient
            </Button>
            <Button onClick={() => setShowDuplicateDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
