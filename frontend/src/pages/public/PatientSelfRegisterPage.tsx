import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PatientSelfRegisterPage() {
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
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
  });

  const submitMutation = useMutation({
    mutationFn: (data: typeof formData) => 
      axios.post('/api/v1/patients/self-register', data),
    onSuccess: () => {
      setSubmitted(true);
    },
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.phone) {
      alert('Please fill in required fields: First Name, Last Name, and Phone Number');
      return;
    }
    submitMutation.mutate(formData);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-secondary/10 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Registration Submitted!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for registering with Kountry Eyecare. Our front desk team will review your information shortly.
            </p>
            <p className="text-sm text-muted-foreground">
              Please proceed to the front desk when called.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-secondary/10 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-2">
            <img src="/kountry-logo.png" alt="Kountry Eyecare" className="h-12" />
          </div>
          <p className="text-muted-foreground">Patient Registration Form</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Personal Information</CardTitle>
                <CardDescription>Fields marked with * are required</CardDescription>
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
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, phone: value });
                    }}
                    maxLength={10}
                    placeholder="0200000000"
                    required
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
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Emergency Contact / Next of Kin</CardTitle>
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
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, emergency_contact_phone: value });
                    }}
                    maxLength={10}
                    placeholder="0200000000"
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Registration'}
            </Button>

            {submitMutation.isError && (
              <p className="text-destructive text-center text-sm">
                Failed to submit. Please try again or inform the front desk.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
