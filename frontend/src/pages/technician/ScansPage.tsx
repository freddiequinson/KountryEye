import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  Plus,
  Search,
  Filter,
  FileText,
  Calendar,
  User,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function ScansPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showPricingDialog, setShowPricingDialog] = useState(false);

  // Fetch scans with pagination
  const { data: scansData, isLoading } = useQuery({
    queryKey: ['scans', typeFilter, statusFilter, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter && typeFilter !== 'all') {
        params.append('scan_type', typeFilter);
      }
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      params.append('skip', ((page - 1) * pageSize).toString());
      params.append('limit', pageSize.toString());
      const response = await api.get(`/technician/scans?${params.toString()}`);
      return response.data;
    },
  });

  const scans = Array.isArray(scansData) ? scansData : scansData?.items || [];
  const totalCount = scansData?.total || scans.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Fetch pricing
  const { data: pricing = [] } = useQuery({
    queryKey: ['scan-pricing'],
    queryFn: async () => {
      const response = await api.get('/technician/scan-pricing');
      return response.data;
    },
  });

  // Update pricing mutation
  const updatePricingMutation = useMutation({
    mutationFn: async ({ scanType, price }: { scanType: string; price: number }) => {
      const response = await api.put(`/technician/scan-pricing/${scanType}`, null, {
        params: { price },
      });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Pricing updated' });
      queryClient.invalidateQueries({ queryKey: ['scan-pricing'] });
    },
  });

  const filteredScans = scans.filter((s: any) =>
    s.scan_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  const scanTypeLabels: Record<string, string> = {
    oct: 'OCT',
    vft: 'Visual Field Test',
    fundus: 'Fundus Photography',
    pachymeter: 'Pachymeter',
  };

  const scanTypeColors: Record<string, string> = {
    oct: 'bg-blue-100 text-blue-800',
    vft: 'bg-purple-100 text-purple-800',
    fundus: 'bg-green-100 text-green-800',
    pachymeter: 'bg-orange-100 text-orange-800',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    reviewed: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-tour="page-title">Technician Scans</h1>
          <p className="text-muted-foreground">
            OCT, Visual Field Test, Fundus Photography, and Pachymeter scans
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPricingDialog(true)} data-tour="pricing">
            <Settings className="h-4 w-4 mr-2" />
            Pricing
          </Button>
          <Button onClick={() => navigate('/technician/scans/new')} data-tour="new-scan">
            <Plus className="h-4 w-4 mr-2" />
            New Scan
          </Button>
        </div>
      </div>

      {/* Pricing Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {pricing.map((p: any) => (
          <Card key={p.scan_type} className="bg-gradient-to-br from-background to-muted/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">
                    {scanTypeLabels[p.scan_type] || p.scan_type}
                  </div>
                  <div className="text-2xl font-bold">GH₵ {p.price}</div>
                </div>
                <Badge className={scanTypeColors[p.scan_type] || ''}>
                  {p.scan_type.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Scan Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button
          variant="outline"
          className="h-20 flex-col gap-2"
          onClick={() => navigate('/technician/scans/new?type=oct')}
        >
          <Eye className="h-6 w-6 text-blue-600" />
          <span>OCT Scan</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex-col gap-2"
          onClick={() => navigate('/technician/scans/new?type=vft')}
        >
          <Eye className="h-6 w-6 text-purple-600" />
          <span>Visual Field Test</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex-col gap-2"
          onClick={() => navigate('/technician/scans/new?type=fundus')}
        >
          <Eye className="h-6 w-6 text-green-600" />
          <span>Fundus Photography</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex-col gap-2"
          onClick={() => navigate('/technician/scans/new?type=pachymeter')}
        >
          <Eye className="h-6 w-6 text-orange-600" />
          <span>Pachymeter</span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by scan number, patient name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Scan Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="oct">OCT</SelectItem>
                <SelectItem value="vft">Visual Field Test</SelectItem>
                <SelectItem value="fundus">Fundus Photography</SelectItem>
                <SelectItem value="pachymeter">Pachymeter</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Scans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Scans ({filteredScans.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredScans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No scans found</p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => navigate('/technician/scans/new')}
              >
                Record your first scan
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scan #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Patient/Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScans.map((scan: any) => (
                  <TableRow
                    key={scan.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/technician/scans/${scan.id}`)}
                  >
                    <TableCell className="font-mono text-sm">
                      {scan.scan_number}
                    </TableCell>
                    <TableCell>
                      <Badge className={scanTypeColors[scan.scan_type] || ''}>
                        {scanTypeLabels[scan.scan_type] || scan.scan_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {scan.patient?.name || scan.client_name || 'N/A'}
                        </span>
                      </div>
                      {scan.patient?.patient_number && (
                        <div className="text-xs text-muted-foreground ml-6">
                          {scan.patient.patient_number}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {scan.scan_date
                          ? new Date(scan.scan_date).toLocaleDateString()
                          : 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[scan.status] || ''}>
                        {scan.status === 'reviewed' && (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        )}
                        {scan.status === 'pending' && (
                          <Clock className="h-3 w-3 mr-1" />
                        )}
                        {scan.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {scan.has_pdf ? (
                        <Badge variant="outline" className="text-green-600">
                          <FileText className="h-3 w-3 mr-1" />
                          PDF
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show</span>
                <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setPage(1); }}>
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span>per page</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Dialog */}
      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan Pricing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Set the price for each scan type. Changes are saved automatically.
            </p>
            {['oct', 'vft', 'fundus', 'pachymeter'].map((scanType) => {
              const existingPrice = pricing.find((p: any) => p.scan_type === scanType);
              return (
                <div key={scanType} className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="font-medium">{scanTypeLabels[scanType]}</Label>
                    <p className="text-xs text-muted-foreground">
                      {scanType === 'oct' && 'Optical Coherence Tomography'}
                      {scanType === 'vft' && 'Visual Field Testing'}
                      {scanType === 'fundus' && 'Retinal Photography'}
                      {scanType === 'pachymeter' && 'Corneal Thickness Measurement'}
                    </p>
                  </div>
                  <div className="w-32">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">GH₵</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        defaultValue={existingPrice?.price || ''}
                        onBlur={(e) => {
                          const newPrice = parseFloat(e.target.value);
                          if (!isNaN(newPrice) && newPrice >= 0) {
                            updatePricingMutation.mutate({
                              scanType: scanType,
                              price: newPrice,
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPricingDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
