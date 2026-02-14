import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building2,
  Eye,
  DollarSign,
  FileText,
  UserPlus,
  CheckCircle,
  Clock,
  Edit,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';

export default function ReferralDetailPage() {
  const { referralId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('details');

  // Fetch referral details
  const { data: referral, isLoading } = useQuery({
    queryKey: ['referral', referralId],
    queryFn: async () => {
      const response = await api.get(`/technician/referrals/${referralId}`);
      return response.data;
    },
    enabled: !!referralId,
  });

  // Convert to patient mutation
  const convertToPatientMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/technician/referrals/${referralId}/convert-to-patient`);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `Client converted to patient. Patient #: ${data.patient_number}`,
      });
      queryClient.invalidateQueries({ queryKey: ['referral', referralId] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to convert client to patient',
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'completed':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading referral details...</div>
      </div>
    );
  }

  if (!referral) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-muted-foreground">Referral not found</div>
        <Button variant="outline" onClick={() => navigate('/technician/referrals')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Referrals
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/technician/referrals')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Referral {referral.referral_number}</h1>
            <p className="text-muted-foreground">{referral.client_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!referral.patient_id && (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm('Convert this client to a full patient record?')) {
                  convertToPatientMutation.mutate();
                }
              }}
              disabled={convertToPatientMutation.isPending}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Convert to Patient
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => navigate(`/technician/scans/new?referral=${referralId}`)}
          >
            <Eye className="mr-2 h-4 w-4" />
            Add Scan
          </Button>
        </div>
      </div>

      {/* Status and Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {getStatusBadge(referral.status)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Service Fee</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">GH₵{referral.service_fee?.toLocaleString() || '0'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referral.scans?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Payment</CardTitle>
          </CardHeader>
          <CardContent>
            {referral.payment ? (
              <Badge variant={referral.payment.is_paid ? 'default' : 'secondary'}>
                {referral.payment.is_paid ? 'Paid' : 'Pending'}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm">No payment</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Client Details</TabsTrigger>
          <TabsTrigger value="scans">Scans ({referral.scans?.length || 0})</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Client Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{referral.client_name}</span>
                  </div>
                  {referral.client_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{referral.client_phone}</span>
                    </div>
                  )}
                  {referral.client_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{referral.client_email}</span>
                    </div>
                  )}
                  {referral.client_address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{referral.client_address}</span>
                    </div>
                  )}
                  {referral.client_dob && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>DOB: {new Date(referral.client_dob).toLocaleDateString()}</span>
                    </div>
                  )}
                  {referral.client_sex && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Sex: {referral.client_sex}</span>
                    </div>
                  )}
                </div>
                {referral.patient_id && (
                  <div className="pt-2 border-t">
                    <Badge variant="outline" className="cursor-pointer" onClick={() => navigate(`/patients/${referral.patient_id}`)}>
                      Linked to Patient #{referral.patient_id}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Referring Doctor */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Referring Doctor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {referral.referral_doctor ? (
                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{referral.referral_doctor.name}</span>
                    </div>
                    {referral.referral_doctor.clinic_name && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{referral.referral_doctor.clinic_name}</span>
                      </div>
                    )}
                    {referral.referral_doctor.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{referral.referral_doctor.phone}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No referring doctor assigned</p>
                )}
              </CardContent>
            </Card>

            {/* Referral Details */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Referral Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Referral Date</p>
                    <p className="font-medium">
                      {referral.referral_date ? new Date(referral.referral_date).toLocaleDateString() : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Technician</p>
                    <p className="font-medium">{referral.technician?.name || '-'}</p>
                  </div>
                </div>
                {referral.reason && (
                  <div>
                    <p className="text-sm text-muted-foreground">Reason for Referral</p>
                    <p>{referral.reason}</p>
                  </div>
                )}
                {referral.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p>{referral.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Scans Tab */}
        <TabsContent value="scans" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Scans</CardTitle>
              <Button
                size="sm"
                onClick={() => navigate(`/technician/scans/new?referral=${referralId}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Add Scan
              </Button>
            </CardHeader>
            <CardContent>
              {referral.scans?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No scans recorded for this referral</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scan #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referral.scans?.map((scan: any) => (
                      <TableRow key={scan.id}>
                        <TableCell className="font-mono">{scan.scan_number}</TableCell>
                        <TableCell>{scan.scan_type}</TableCell>
                        <TableCell>
                          {scan.scan_date ? new Date(scan.scan_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={scan.status === 'completed' ? 'default' : 'secondary'}>
                            {scan.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/technician/scans/${scan.id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {referral.payment ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="text-2xl font-bold">GH₵{referral.payment.amount?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant={referral.payment.is_paid ? 'default' : 'secondary'} className="mt-1">
                        {referral.payment.is_paid ? 'Paid' : 'Pending'}
                      </Badge>
                    </div>
                    {referral.payment.payment_date && (
                      <div>
                        <p className="text-sm text-muted-foreground">Payment Date</p>
                        <p className="font-medium">
                          {new Date(referral.payment.payment_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No payment recorded for this referral</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
