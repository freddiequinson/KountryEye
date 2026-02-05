import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Search,
  Phone,
  User,
  Building2,
  Plus,
  Check,
  Loader2,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface ReferralDoctor {
  id: number;
  name: string;
  phone: string;
  email?: string;
  clinic_name?: string;
  clinic_address?: string;
  specialization?: string;
}

export default function NewReferralPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientDob, setClientDob] = useState('');
  const [clientSex, setClientSex] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [serviceFee, setServiceFee] = useState('');

  // Doctor lookup state
  const [doctorPhone, setDoctorPhone] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<ReferralDoctor | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [showNewDoctorDialog, setShowNewDoctorDialog] = useState(false);

  // New doctor form
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDoctorEmail, setNewDoctorEmail] = useState('');
  const [newDoctorClinic, setNewDoctorClinic] = useState('');
  const [newDoctorAddress, setNewDoctorAddress] = useState('');
  const [newDoctorSpecialization, setNewDoctorSpecialization] = useState('');

  // Lookup doctor by phone
  const lookupDoctor = async () => {
    if (!doctorPhone || doctorPhone.length < 9) {
      toast({
        title: 'Invalid Phone',
        description: 'Please enter a valid phone number',
        variant: 'destructive',
      });
      return;
    }

    setIsLookingUp(true);
    try {
      const response = await api.get(`/technician/doctors/lookup/${doctorPhone}`);
      if (response.data.found) {
        setSelectedDoctor(response.data.doctor);
        toast({
          title: 'Doctor Found',
          description: `Found: ${response.data.doctor.name}`,
        });
      } else {
        setSelectedDoctor(null);
        setShowNewDoctorDialog(true);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to lookup doctor',
        variant: 'destructive',
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  // Create new doctor mutation
  const createDoctorMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/technician/doctors', data);
      return response.data;
    },
    onSuccess: (data) => {
      setSelectedDoctor({
        id: data.id,
        name: data.name,
        phone: doctorPhone,
        clinic_name: newDoctorClinic,
      });
      setShowNewDoctorDialog(false);
      toast({
        title: 'Success',
        description: 'Referring doctor added successfully',
      });
      // Reset new doctor form
      setNewDoctorName('');
      setNewDoctorEmail('');
      setNewDoctorClinic('');
      setNewDoctorAddress('');
      setNewDoctorSpecialization('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create referring doctor',
        variant: 'destructive',
      });
    },
  });

  // Create referral mutation
  const createReferralMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/technician/referrals', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `Referral ${data.referral_number} created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      navigate(`/technician/referrals/${data.id}`);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create referral',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName) {
      toast({
        title: 'Validation Error',
        description: 'Client name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedDoctor) {
      toast({
        title: 'Validation Error',
        description: 'Please select or add a referring doctor',
        variant: 'destructive',
      });
      return;
    }

    createReferralMutation.mutate({
      client_name: clientName,
      client_phone: clientPhone || null,
      client_email: clientEmail || null,
      client_address: clientAddress || null,
      client_dob: clientDob || null,
      client_sex: clientSex || null,
      referral_doctor_id: selectedDoctor.id,
      reason: reason || null,
      notes: notes || null,
      service_fee: serviceFee ? parseFloat(serviceFee) : 0,
    });
  };

  const handleCreateDoctor = () => {
    if (!newDoctorName) {
      toast({
        title: 'Validation Error',
        description: 'Doctor name is required',
        variant: 'destructive',
      });
      return;
    }

    createDoctorMutation.mutate({
      name: newDoctorName,
      phone: doctorPhone,
      email: newDoctorEmail || null,
      clinic_name: newDoctorClinic || null,
      clinic_address: newDoctorAddress || null,
      specialization: newDoctorSpecialization || null,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New External Referral</h1>
          <p className="text-muted-foreground">
            Record a new referral from an external doctor
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Referring Doctor Section */}
          <Card>
            <CardHeader>
              <CardTitle>Referring Doctor</CardTitle>
              <CardDescription>
                Enter the doctor's phone number to look them up or add a new one
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="doctorPhone">Doctor's Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="doctorPhone"
                      placeholder="Enter phone number..."
                      value={doctorPhone}
                      onChange={(e) => setDoctorPhone(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={lookupDoctor}
                    disabled={isLookingUp}
                  >
                    {isLookingUp ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-2">Lookup</span>
                  </Button>
                </div>
              </div>

              {selectedDoctor && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Doctor Selected</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{selectedDoctor.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedDoctor.phone}</span>
                    </div>
                    {selectedDoctor.clinic_name && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedDoctor.clinic_name}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setSelectedDoctor(null)}
                  >
                    Change Doctor
                  </Button>
                </div>
              )}

              {!selectedDoctor && doctorPhone && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewDoctorDialog(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Referring Doctor
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
              <CardDescription>
                Details of the referred client
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clientName">Full Name *</Label>
                <Input
                  id="clientName"
                  placeholder="Enter client's full name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientPhone">Phone</Label>
                  <Input
                    id="clientPhone"
                    placeholder="Phone number"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="clientEmail">Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    placeholder="Email address"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientDob">Date of Birth</Label>
                  <Input
                    id="clientDob"
                    type="date"
                    value={clientDob}
                    onChange={(e) => setClientDob(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="clientSex">Sex</Label>
                  <Select value={clientSex} onValueChange={setClientSex}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="clientAddress">Address</Label>
                <Textarea
                  id="clientAddress"
                  placeholder="Client's address"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Referral Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Referral Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reason">Reason for Referral</Label>
                  <Textarea
                    id="reason"
                    placeholder="Why was this client referred?"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="max-w-xs">
                <Label htmlFor="serviceFee">Service Fee (GH₵)</Label>
                <Input
                  id="serviceFee"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={serviceFee}
                  onChange={(e) => setServiceFee(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={createReferralMutation.isPending}>
            {createReferralMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Create Referral
          </Button>
        </div>
      </form>

      {/* New Doctor Dialog */}
      <Dialog open={showNewDoctorDialog} onOpenChange={setShowNewDoctorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Referring Doctor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="newDoctorName">Doctor's Name *</Label>
              <Input
                id="newDoctorName"
                placeholder="Dr. John Doe"
                value={newDoctorName}
                onChange={(e) => setNewDoctorName(e.target.value)}
              />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input value={doctorPhone} disabled />
            </div>
            <div>
              <Label htmlFor="newDoctorEmail">Email</Label>
              <Input
                id="newDoctorEmail"
                type="email"
                placeholder="doctor@hospital.com"
                value={newDoctorEmail}
                onChange={(e) => setNewDoctorEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="newDoctorClinic">Clinic/Hospital Name</Label>
              <Input
                id="newDoctorClinic"
                placeholder="City Hospital"
                value={newDoctorClinic}
                onChange={(e) => setNewDoctorClinic(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="newDoctorAddress">Clinic Address</Label>
              <Textarea
                id="newDoctorAddress"
                placeholder="Address..."
                value={newDoctorAddress}
                onChange={(e) => setNewDoctorAddress(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="newDoctorSpecialization">Specialization</Label>
              <Input
                id="newDoctorSpecialization"
                placeholder="Ophthalmologist"
                value={newDoctorSpecialization}
                onChange={(e) => setNewDoctorSpecialization(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDoctorDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateDoctor}
              disabled={createDoctorMutation.isPending}
            >
              {createDoctorMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Add Doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
