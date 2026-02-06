import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  Users,
  FileText,
  Clock,
  Plus,
  ArrowRight,
  Activity,
  DollarSign,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function TechnicianDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Fetch summary stats
  const { data: summary } = useQuery({
    queryKey: ['technician-summary'],
    queryFn: async () => {
      const response = await api.get('/technician/analytics/summary');
      return response.data;
    },
  });

  // Fetch recent referrals
  const { data: recentReferrals = [] } = useQuery({
    queryKey: ['recent-referrals'],
    queryFn: async () => {
      const response = await api.get('/technician/referrals?limit=5');
      return response.data;
    },
  });

  // Fetch pending scans
  const { data: pendingScans = [] } = useQuery({
    queryKey: ['pending-scans'],
    queryFn: async () => {
      const response = await api.get('/technician/scans?status=pending&limit=5');
      return response.data;
    },
  });

  const scanTypeLabels: Record<string, string> = {
    oct: 'OCT',
    vft: 'Visual Field Test',
    fundus: 'Fundus Photography',
    pachymeter: 'Pachymeter',
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
          <h1 className="text-3xl font-bold" data-tour="page-title">Technician Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.first_name}! Manage referrals and scans.
          </p>
        </div>
        <div className="flex gap-2" data-tour="quick-actions">
          <Button onClick={() => navigate('/technician/referrals/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Referral
          </Button>
          <Button variant="outline" onClick={() => navigate('/technician/scans/new')}>
            <Eye className="h-4 w-4 mr-2" />
            New Scan
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="stats-cards">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_referrals || 0}</div>
            <p className="text-xs text-muted-foreground">External referrals received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_scans || 0}</div>
            <p className="text-xs text-muted-foreground">Scans performed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              GH₵ {(summary?.total_revenue || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">From referral services</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.pending_payments?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              GH₵ {(summary?.pending_payments?.amount || 0).toLocaleString()} due
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Scans by Type */}
      {summary?.scans_by_type && Object.keys(summary.scans_by_type).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scans by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(summary.scans_by_type).map(([type, count]) => (
                <div key={type} className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{count as number}</div>
                  <div className="text-sm text-muted-foreground">
                    {scanTypeLabels[type] || type.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Referrals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Referrals</CardTitle>
              <CardDescription>Latest external referrals</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/technician/referrals')}>
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentReferrals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No referrals yet</p>
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
                    <TableHead>Client</TableHead>
                    <TableHead>Referring Doctor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentReferrals.map((referral: any) => (
                    <TableRow
                      key={referral.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/technician/referrals/${referral.id}`)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{referral.client_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {referral.referral_number}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{referral.referral_doctor?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {referral.referral_doctor?.clinic_name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[referral.status] || ''}>
                          {referral.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pending Scans */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending Scans</CardTitle>
              <CardDescription>Scans awaiting completion</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/technician/scans')}>
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {pendingScans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No pending scans</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scan Type</TableHead>
                    <TableHead>Patient/Client</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingScans.map((scan: any) => (
                    <TableRow
                      key={scan.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/technician/scans/${scan.id}`)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {scanTypeLabels[scan.scan_type] || scan.scan_type}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {scan.scan_number}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {scan.patient?.name || scan.client_name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[scan.status] || ''}>
                          {scan.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/technician/referrals/new')}
            >
              <Users className="h-6 w-6" />
              <span>New Referral</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/technician/scans/new?type=oct')}
            >
              <Eye className="h-6 w-6" />
              <span>OCT Scan</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/technician/scans/new?type=vft')}
            >
              <Activity className="h-6 w-6" />
              <span>Visual Field Test</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/technician/doctors')}
            >
              <FileText className="h-6 w-6" />
              <span>Referring Doctors</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
