import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Filter,
  Eye,
  Phone,
  Building2,
  Calendar,
  MoreVertical,
  UserPlus,
  List,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

export default function ReferralsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  const [expandedDoctors, setExpandedDoctors] = useState<Set<number>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch referrals
  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['referrals', statusFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const response = await api.get(`/technician/referrals?${params.toString()}`);
      return response.data;
    },
  });

  // Convert to patient mutation
  const convertToPatientMutation = useMutation({
    mutationFn: async (referralId: number) => {
      const response = await api.post(`/technician/referrals/${referralId}/convert-to-patient`);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `Client converted to patient. Patient #: ${data.patient_number}`,
      });
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to convert client to patient',
        variant: 'destructive',
      });
    },
  });

  const filteredReferrals = referrals.filter((r: any) =>
    r.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.referral_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.referral_doctor?.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Group referrals by doctor
  const groupedByDoctor = useMemo(() => {
    const groups: Record<number, { doctor: any; referrals: any[]; totalFees: number }> = {};
    
    filteredReferrals.forEach((r: any) => {
      const doctorId = r.referral_doctor?.id || 0;
      if (!groups[doctorId]) {
        groups[doctorId] = {
          doctor: r.referral_doctor || { id: 0, name: 'Unknown Doctor' },
          referrals: [],
          totalFees: 0,
        };
      }
      groups[doctorId].referrals.push(r);
      groups[doctorId].totalFees += r.service_fee || 0;
    });
    
    return Object.values(groups).sort((a, b) => b.referrals.length - a.referrals.length);
  }, [filteredReferrals]);

  const toggleDoctorExpanded = (doctorId: number) => {
    setExpandedDoctors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(doctorId)) {
        newSet.delete(doctorId);
      } else {
        newSet.add(doctorId);
      }
      return newSet;
    });
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">External Referrals</h1>
          <p className="text-muted-foreground">
            Manage referrals from external doctors and hospitals
          </p>
        </div>
        <Button onClick={() => navigate('/technician/referrals/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Referral
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by client name, referral number, or doctor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px]"
              placeholder="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px]"
              placeholder="To date"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4 mr-1" />
                List
              </Button>
              <Button
                variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode('grouped')}
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                By Doctor
              </Button>
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                Clear Dates
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Referrals - List View */}
      {viewMode === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle>Referrals ({filteredReferrals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredReferrals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No referrals found</p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => navigate('/technician/referrals/new')}
                >
                  Add your first referral
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referral #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Referring Doctor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Service Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReferrals.map((referral: any) => (
                    <TableRow
                      key={referral.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/technician/referrals/${referral.id}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        {referral.referral_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{referral.client_name}</div>
                          {referral.client_phone && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {referral.client_phone}
                            </div>
                          )}
                          {referral.patient_id && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Patient #{referral.patient_id}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{referral.referral_doctor?.name}</div>
                          {referral.referral_doctor?.clinic_name && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {referral.referral_doctor.clinic_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {referral.referral_date
                            ? new Date(referral.referral_date).toLocaleDateString()
                            : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        GH₵ {(referral.service_fee || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[referral.status] || ''}>
                          {referral.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/technician/referrals/${referral.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/technician/scans/new?referral=${referral.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Add Scan
                            </DropdownMenuItem>
                            {!referral.patient_id && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Convert this client to a full patient record?')) {
                                    convertToPatientMutation.mutate(referral.id);
                                  }
                                }}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Convert to Patient
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Referrals - Grouped by Doctor View */}
      {viewMode === 'grouped' && (
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          ) : groupedByDoctor.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No referrals found</p>
              </CardContent>
            </Card>
          ) : (
            groupedByDoctor.map((group) => (
              <Card key={group.doctor.id}>
                <Collapsible
                  open={expandedDoctors.has(group.doctor.id)}
                  onOpenChange={() => toggleDoctorExpanded(group.doctor.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {expandedDoctors.has(group.doctor.id) ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <CardTitle className="text-lg">{group.doctor.name}</CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              {group.doctor.clinic_name && (
                                <>
                                  <Building2 className="h-3 w-3" />
                                  {group.doctor.clinic_name}
                                </>
                              )}
                              {group.doctor.phone && (
                                <>
                                  <Phone className="h-3 w-3 ml-2" />
                                  {group.doctor.phone}
                                </>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold">{group.referrals.length}</div>
                            <div className="text-xs text-muted-foreground">referrals</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-green-600">
                              GH₵ {group.totalFees.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">total fees</div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Referral #</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Service Fee</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.referrals.map((referral: any) => (
                            <TableRow
                              key={referral.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => navigate(`/technician/referrals/${referral.id}`)}
                            >
                              <TableCell className="font-mono text-sm">
                                {referral.referral_number}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{referral.client_name}</div>
                                  {referral.client_phone && (
                                    <div className="text-xs text-muted-foreground">
                                      {referral.client_phone}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {referral.referral_date
                                  ? new Date(referral.referral_date).toLocaleDateString()
                                  : 'N/A'}
                              </TableCell>
                              <TableCell>
                                GH₵ {(referral.service_fee || 0).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge className={statusColors[referral.status] || ''}>
                                  {referral.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/technician/scans/new?referral=${referral.id}`);
                                      }}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      Add Scan
                                    </DropdownMenuItem>
                                    {!referral.patient_id && (
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm('Convert to patient?')) {
                                            convertToPatientMutation.mutate(referral.id);
                                          }
                                        }}
                                      >
                                        <UserPlus className="h-4 w-4 mr-2" />
                                        Convert to Patient
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
