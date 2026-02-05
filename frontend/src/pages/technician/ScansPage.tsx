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
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ScansPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch scans
  const { data: scans = [], isLoading } = useQuery({
    queryKey: ['scans', typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter && typeFilter !== 'all') {
        params.append('scan_type', typeFilter);
      }
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const response = await api.get(`/technician/scans?${params.toString()}`);
      return response.data;
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
          <h1 className="text-3xl font-bold">Technician Scans</h1>
          <p className="text-muted-foreground">
            OCT, Visual Field Test, Fundus Photography, and Pachymeter scans
          </p>
        </div>
        <Button onClick={() => navigate('/technician/scans/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Scan
        </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}
