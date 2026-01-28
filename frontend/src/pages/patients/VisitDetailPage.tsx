import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, CreditCard, Pill, Glasses, FileText } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function VisitDetailPage() {
  const { patientId, visitId } = useParams<{ patientId: string; visitId: string }>();
  const navigate = useNavigate();

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const response = await api.get(`/patients/${patientId}`);
      return response.data;
    },
    enabled: !!patientId,
  });

  const { data: visitDetail, isLoading } = useQuery({
    queryKey: ['visit-detail', visitId],
    queryFn: async () => {
      const response = await api.get(`/clinical/visits/${visitId}/detail`);
      return response.data;
    },
    enabled: !!visitId,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['visit-prescriptions', visitId],
    queryFn: async () => {
      const response = await api.get(`/clinical/visits/${visitId}/prescriptions`);
      return response.data;
    },
    enabled: !!visitId,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  // Separate medications from optical prescriptions
  const medications = prescriptions.flatMap((p: any) => 
    p.items.filter((i: any) => i.item_type === 'medication').map((item: any) => ({ ...item, prescription: p }))
  );
  
  const opticalItems = prescriptions.flatMap((p: any) => 
    p.items.filter((i: any) => ['spectacle', 'lens', 'other'].includes(i.item_type)).map((item: any) => ({ ...item, prescription: p }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${patientId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Patient
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            Visit Details
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{patient?.first_name} {patient?.last_name}</span>
            <Badge variant="outline">{patient?.patient_number}</Badge>
          </div>
        </div>
      </div>

      {/* Visit Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Visit Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {visitDetail?.visit_date ? new Date(visitDetail.visit_date).toLocaleDateString() : '-'}
            </p>
            <p className="text-sm text-muted-foreground">
              {visitDetail?.visit_date ? new Date(visitDetail.visit_date).toLocaleTimeString() : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Visit Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-base">
              {visitDetail?.visit_type?.replace('_', ' ') || '-'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={visitDetail?.status === 'completed' ? 'success' : 'secondary'}>
              {visitDetail?.status || '-'}
            </Badge>
          </CardContent>
        </Card>

        <Card className={visitDetail?.consultation_fee - visitDetail?.amount_paid > 0 ? 'border-red-200' : 'border-green-200'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              GHS {visitDetail?.amount_paid?.toFixed(2) || '0.00'} / {visitDetail?.consultation_fee?.toFixed(2) || '0.00'}
            </p>
            {visitDetail?.consultation_fee - visitDetail?.amount_paid > 0 && (
              <p className="text-sm text-red-600">
                Balance: GHS {(visitDetail.consultation_fee - visitDetail.amount_paid).toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clinical" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clinical">
            <FileText className="mr-2 h-4 w-4" />
            Clinical Record
          </TabsTrigger>
          <TabsTrigger value="medications">
            <Pill className="mr-2 h-4 w-4" />
            Medications ({medications.length})
          </TabsTrigger>
          <TabsTrigger value="optical">
            <Glasses className="mr-2 h-4 w-4" />
            Optical Rx ({opticalItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clinical">
          {visitDetail?.clinical_record ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Chief Complaint</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{visitDetail.clinical_record.chief_complaint || 'Not recorded'}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">History of Present Illness</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{visitDetail.clinical_record.history_of_present_illness || 'Not recorded'}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Visual Acuity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-muted-foreground">OD (Right):</Label>
                    <span className="font-medium">{visitDetail.clinical_record.visual_acuity_od || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <Label className="text-muted-foreground">OS (Left):</Label>
                    <span className="font-medium">{visitDetail.clinical_record.visual_acuity_os || '-'}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Diagnosis</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{visitDetail.clinical_record.diagnosis || 'Not recorded'}</p>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Management Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{visitDetail.clinical_record.management_plan || 'Not recorded'}</p>
                </CardContent>
              </Card>

              {visitDetail.clinical_record.follow_up_date && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Follow-up Date</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium">
                      {new Date(visitDetail.clinical_record.follow_up_date).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No clinical record found for this visit
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="medications">
          {medications.length > 0 ? (
            <div className="space-y-3">
              {medications.map((item: any, index: number) => (
                <Card key={index}>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-semibold text-lg">{item.name}</h4>
                        {item.dosage && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Dosage:</span> {item.dosage}
                          </p>
                        )}
                        {item.duration && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Duration:</span> {item.duration}
                          </p>
                        )}
                        {item.description && (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          {item.is_external && <Badge variant="outline">External</Badge>}
                          {item.was_out_of_stock && <Badge variant="warning">Was out of stock</Badge>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Qty: {item.quantity}</p>
                        <p className="text-sm text-muted-foreground">
                          GHS {(item.quantity * item.unit_price).toFixed(2)}
                        </p>
                        <Badge variant={item.prescription.status === 'paid' ? 'success' : 'secondary'} className="mt-2">
                          {item.prescription.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No medications prescribed for this visit
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="optical">
          {opticalItems.length > 0 ? (
            <div className="space-y-3">
              {opticalItems.map((item: any, index: number) => (
                <Card key={index}>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{item.item_type}</Badge>
                          <h4 className="font-semibold text-lg">{item.name}</h4>
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          {item.is_external && <Badge variant="outline">External</Badge>}
                          {item.was_out_of_stock && <Badge variant="warning">Was out of stock</Badge>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Qty: {item.quantity}</p>
                        <p className="text-sm text-muted-foreground">
                          GHS {(item.quantity * item.unit_price).toFixed(2)}
                        </p>
                        <Badge variant={item.prescription.status === 'paid' ? 'success' : 'secondary'} className="mt-2">
                          {item.prescription.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No optical prescriptions for this visit
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Prescription Summary */}
      {prescriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prescription Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {prescriptions.map((prescription: any) => (
                <div key={prescription.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={prescription.status === 'paid' ? 'success' : 'secondary'}>
                        {prescription.status}
                      </Badge>
                      {prescription.is_dispensed && <Badge variant="outline">Dispensed</Badge>}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(prescription.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {prescription.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground ml-2">({item.item_type})</span>
                          {item.dosage && <span className="text-muted-foreground ml-2">- {item.dosage}</span>}
                        </div>
                        <span>x{item.quantity} = GHS {(item.quantity * item.unit_price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-3 pt-2 border-t">
                    <span className="font-semibold">Total: GHS {prescription.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
