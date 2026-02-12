import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, CreditCard, Building2, Calendar, Download } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/components/ui/dialog';

interface Revenue {
  id: number;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  reference_type?: string;
  reference_id?: number;
  created_at: string;
}

export default function RevenuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize state from URL params
  const [dateFilter, setDateFilter] = useState(searchParams.get('period') || 'today');
  const [customStartDate, setCustomStartDate] = useState(searchParams.get('start') || '');
  const [customEndDate, setCustomEndDate] = useState(searchParams.get('end') || '');
  const [branchFilter, setBranchFilter] = useState(searchParams.get('branch') || 'all');

  const [showInsuranceDialog, setShowInsuranceDialog] = useState(false);
  const [showCashDialog, setShowCashDialog] = useState(false);
  const [showVCDialog, setShowVCDialog] = useState(false);
  const [showMomoDialog, setShowMomoDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await api.get('/branches');
      return response.data;
    },
  });

  const { data: revenues = [] } = useQuery({
    queryKey: ['revenues', dateFilter, customStartDate, customEndDate, branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFilter === 'custom' && customStartDate && customEndDate) {
        params.append('start_date', customStartDate);
        params.append('end_date', customEndDate);
      } else {
        params.append('period', dateFilter);
      }
      if (branchFilter && branchFilter !== 'all') {
        params.append('branch_id', branchFilter);
      }
      const response = await api.get(`/revenue?${params.toString()}`);
      return response.data;
    },
  });

  // Pagination
  const totalPages = Math.ceil(revenues.length / itemsPerPage);
  const paginatedRevenues = revenues.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filters change
  const handleDateFilterChange = (value: string) => {
    setDateFilter(value);
    setCurrentPage(1);
    // Update URL params
    const params = new URLSearchParams(searchParams.toString());
    if (value !== 'today') {
      params.set('period', value);
    } else {
      params.delete('period');
    }
    setSearchParams(params, { replace: true });
  };

  const handleBranchFilterChange = (value: string) => {
    setBranchFilter(value);
    setCurrentPage(1);
    // Update URL params
    const params = new URLSearchParams(searchParams.toString());
    if (value !== 'all') {
      params.set('branch', value);
    } else {
      params.delete('branch');
    }
    setSearchParams(params, { replace: true });
  };

  const handleCustomStartDateChange = (value: string) => {
    setCustomStartDate(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('start', value);
    } else {
      params.delete('start');
    }
    setSearchParams(params, { replace: true });
  };

  const handleCustomEndDateChange = (value: string) => {
    setCustomEndDate(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('end', value);
    } else {
      params.delete('end');
    }
    setSearchParams(params, { replace: true });
  };

  const { data: summary } = useQuery({
    queryKey: ['revenue-summary', dateFilter, customStartDate, customEndDate, branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFilter === 'custom' && customStartDate && customEndDate) {
        params.append('start_date', customStartDate);
        params.append('end_date', customEndDate);
      } else {
        params.append('period', dateFilter);
      }
      if (branchFilter && branchFilter !== 'all') {
        params.append('branch_id', branchFilter);
      }
      const response = await api.get(`/revenue/summary?${params.toString()}`);
      return response.data;
    },
  });

  const { data: insuranceBreakdown = [] } = useQuery({
    queryKey: ['insurance-breakdown', dateFilter, customStartDate, customEndDate, branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFilter === 'custom' && customStartDate && customEndDate) {
        params.append('start_date', customStartDate);
        params.append('end_date', customEndDate);
      } else {
        params.append('period', dateFilter);
      }
      if (branchFilter && branchFilter !== 'all') {
        params.append('branch_id', branchFilter);
      }
      const response = await api.get(`/revenue/insurance-breakdown?${params.toString()}`);
      return response.data;
    },
    enabled: showInsuranceDialog,
  });

  const exportInsuranceCSV = () => {
    const csvContent = [
      ['Patient Name', 'Insurance Provider', 'Insurance ID', 'Amount', 'Date'].join(','),
      ...insuranceBreakdown.map((item: any) => 
        [item.patient_name, item.insurance_provider, item.insurance_id, item.amount, item.date].join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insurance-claims-${dateFilter}.csv`;
    a.click();
  };

  const getCategoryBadge = (category: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
      consultation: 'default',
      product_sale: 'secondary',
      prescription: 'success',
      glasses_order: 'warning',
      other: 'destructive',
    };
    return variants[category] || 'default';
  };

  const getPaymentMethodBadge = (method: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
      cash: 'success',
      visioncare: 'default',
      insurance: 'warning',
      mobile_money: 'secondary',
    };
    return variants[method] || 'default';
  };

  const formatCurrency = (amount: number) => {
    return `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCategory = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Revenue</h1>
          <p className="text-muted-foreground">Track all revenue and payments</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={branchFilter} onValueChange={handleBranchFilterChange}>
            <SelectTrigger className="w-[180px]">
              <Building2 className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((branch: any) => (
                <SelectItem key={branch.id} value={branch.id.toString()}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={handleDateFilterChange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <div>
                <Label className="sr-only">Start Date</Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => handleCustomStartDateChange(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <span>to</span>
              <div>
                <Label className="sr-only">End Date</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => handleCustomEndDateChange(e.target.value)}
                  className="w-[150px]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.total || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consultations</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.by_category?.consultation || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Product Sales</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.by_category?.product_sale || 0)}
            </div>
          </CardContent>
        </Card>

        </div>

      {/* Payment Method Breakdown */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowCashDialog(true)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cash Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">
              {formatCurrency(summary?.by_payment_method?.cash || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowMomoDialog(true)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Mobile Money</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-yellow-600">
              {formatCurrency((summary?.by_payment_method?.momo || 0) + (summary?.by_payment_method?.mobile_money || 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowVCDialog(true)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">VisionCare Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-600">
              {formatCurrency(summary?.by_payment_method?.visioncare || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowInsuranceDialog(true)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Insurance Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-orange-600">
              {formatCurrency(summary?.by_payment_method?.insurance || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Click to view & export</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue List */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Revenue</TabsTrigger>
          <TabsTrigger value="consultation">Consultations</TabsTrigger>
          <TabsTrigger value="product_sale">Product Sales</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRevenues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No revenue records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRevenues.map((revenue: Revenue) => (
                      <TableRow key={revenue.id}>
                        <TableCell>
                          {new Date(revenue.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getCategoryBadge(revenue.category)}>
                            {formatCategory(revenue.category)}
                          </Badge>
                        </TableCell>
                        <TableCell>{revenue.description}</TableCell>
                        <TableCell>
                          <Badge variant={getPaymentMethodBadge(revenue.payment_method)}>
                            {formatCategory(revenue.payment_method)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(revenue.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, revenues.length)} of {revenues.length} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consultation">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenues.filter((r: Revenue) => r.category === 'consultation').length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No consultation revenue found
                      </TableCell>
                    </TableRow>
                  ) : (
                    revenues
                      .filter((r: Revenue) => r.category === 'consultation')
                      .map((revenue: Revenue) => (
                        <TableRow key={revenue.id}>
                          <TableCell>
                            {new Date(revenue.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{revenue.description}</TableCell>
                          <TableCell>
                            <Badge variant={getPaymentMethodBadge(revenue.payment_method)}>
                              {formatCategory(revenue.payment_method)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(revenue.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product_sale">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenues.filter((r: Revenue) => r.category === 'product_sale').length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No product sales found
                      </TableCell>
                    </TableRow>
                  ) : (
                    revenues
                      .filter((r: Revenue) => r.category === 'product_sale')
                      .map((revenue: Revenue) => (
                        <TableRow key={revenue.id}>
                          <TableCell>
                            {new Date(revenue.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{revenue.description}</TableCell>
                          <TableCell>
                            <Badge variant={getPaymentMethodBadge(revenue.payment_method)}>
                              {formatCategory(revenue.payment_method)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(revenue.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cash Payments Dialog */}
      <Dialog open={showCashDialog} onOpenChange={setShowCashDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cash Payments Details</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenues.filter((r: Revenue) => r.payment_method === 'cash').length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No cash payments found
                  </TableCell>
                </TableRow>
              ) : (
                revenues
                  .filter((r: Revenue) => r.payment_method === 'cash')
                  .map((revenue: Revenue) => (
                    <TableRow key={revenue.id}>
                      <TableCell>{new Date(revenue.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{revenue.description}</TableCell>
                      <TableCell>
                        <Badge variant={getCategoryBadge(revenue.category)}>
                          {formatCategory(revenue.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(revenue.amount)}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* VisionCare Payments Dialog */}
      <Dialog open={showVCDialog} onOpenChange={setShowVCDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>VisionCare Payments Details</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenues.filter((r: Revenue) => r.payment_method === 'visioncare').length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No VisionCare payments found
                  </TableCell>
                </TableRow>
              ) : (
                revenues
                  .filter((r: Revenue) => r.payment_method === 'visioncare')
                  .map((revenue: Revenue) => (
                    <TableRow key={revenue.id}>
                      <TableCell>{new Date(revenue.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{revenue.description}</TableCell>
                      <TableCell>
                        <Badge variant={getCategoryBadge(revenue.category)}>
                          {formatCategory(revenue.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(revenue.amount)}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Mobile Money Payments Dialog */}
      <Dialog open={showMomoDialog} onOpenChange={setShowMomoDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mobile Money Payments Details</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenues.filter((r: Revenue) => r.payment_method === 'momo' || r.payment_method === 'mobile_money').length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No mobile money payments found
                  </TableCell>
                </TableRow>
              ) : (
                revenues
                  .filter((r: Revenue) => r.payment_method === 'momo' || r.payment_method === 'mobile_money')
                  .map((revenue: Revenue) => (
                    <TableRow key={revenue.id}>
                      <TableCell>{new Date(revenue.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{revenue.description}</TableCell>
                      <TableCell>
                        <Badge variant={getCategoryBadge(revenue.category)}>
                          {formatCategory(revenue.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(revenue.amount)}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Insurance Payments Dialog */}
      <Dialog open={showInsuranceDialog} onOpenChange={setShowInsuranceDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Insurance Payments Details</span>
              <Button variant="outline" size="sm" onClick={exportInsuranceCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenues.filter((r: Revenue) => r.payment_method === 'insurance').length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No insurance payments found
                  </TableCell>
                </TableRow>
              ) : (
                revenues
                  .filter((r: Revenue) => r.payment_method === 'insurance')
                  .map((revenue: Revenue) => (
                    <TableRow key={revenue.id}>
                      <TableCell>{new Date(revenue.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{revenue.description}</TableCell>
                      <TableCell>
                        <Badge variant={getCategoryBadge(revenue.category)}>
                          {formatCategory(revenue.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(revenue.amount)}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
