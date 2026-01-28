import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Calendar,
  Package,
  AlertTriangle,
  Activity,
  CreditCard,
  Building2,
  ShoppingCart,
  UserCheck,
  Clock,
  FileText,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');
  
  // Dialog states for card details
  const [showRevenueDialog, setShowRevenueDialog] = useState(false);
  const [showVisitsDialog, setShowVisitsDialog] = useState(false);
  const [showPatientsDialog, setShowPatientsDialog] = useState(false);
  const [showOutstandingDialog, setShowOutstandingDialog] = useState(false);

  // Fetch dashboard analytics
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['analytics-dashboard', period],
    queryFn: async () => {
      const response = await api.get(`/analytics/dashboard?period=${period}`);
      return response.data;
    },
  });

  // Fetch out-of-stock analytics
  const { data: outOfStock } = useQuery({
    queryKey: ['analytics-out-of-stock'],
    queryFn: async () => {
      const response = await api.get('/analytics/out-of-stock?days=30');
      return response.data;
    },
  });

  // Fetch inventory analytics
  const { data: inventory } = useQuery({
    queryKey: ['analytics-inventory'],
    queryFn: async () => {
      const response = await api.get('/analytics/inventory');
      return response.data;
    },
  });

  // Fetch consultation analytics
  const { data: consultations } = useQuery({
    queryKey: ['analytics-consultations', period],
    queryFn: async () => {
      const response = await api.get(`/analytics/consultations?period=${period}`);
      return response.data;
    },
  });

  // Fetch staff performance
  const { data: staffPerformance } = useQuery({
    queryKey: ['analytics-staff', period],
    queryFn: async () => {
      const response = await api.get(`/analytics/staff-performance?period=${period}`);
      return response.data;
    },
  });

  // Fetch financial analytics
  const { data: financial } = useQuery({
    queryKey: ['analytics-financial', period],
    queryFn: async () => {
      const response = await api.get(`/analytics/financial?period=${period}`);
      return response.data;
    },
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Prepare chart data
  const paymentTypeData = dashboard?.visits?.by_payment_type
    ? Object.entries(dashboard.visits.by_payment_type).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: value as number,
      }))
    : [];

  const revenueByPaymentData = dashboard?.revenue?.by_payment_type
    ? Object.entries(dashboard.revenue.by_payment_type).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: value as number,
      }))
    : [];

  const genderData = dashboard?.patients?.by_gender
    ? Object.entries(dashboard.patients.by_gender).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: value as number,
      }))
    : [];

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Comprehensive insights into your business performance</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowRevenueDialog(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboard?.summary?.total_revenue || 0)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {dashboard?.summary?.revenue_change_percent >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
              )}
              <span className={dashboard?.summary?.revenue_change_percent >= 0 ? 'text-green-500' : 'text-red-500'}>
                {dashboard?.summary?.revenue_change_percent?.toFixed(1)}%
              </span>
              <span className="ml-1">vs previous period</span>
            </div>
            <p className="text-xs text-blue-500 mt-2">Click for details →</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowVisitsDialog(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.summary?.total_visits || 0}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {dashboard?.summary?.visits_change_percent >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
              )}
              <span className={dashboard?.summary?.visits_change_percent >= 0 ? 'text-green-500' : 'text-red-500'}>
                {dashboard?.summary?.visits_change_percent?.toFixed(1)}%
              </span>
              <span className="ml-1">vs previous period</span>
            </div>
            <p className="text-xs text-blue-500 mt-2">Click for details →</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowPatientsDialog(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.summary?.new_patients || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total: {dashboard?.summary?.total_patients?.toLocaleString() || 0} patients
            </p>
            <p className="text-xs text-blue-500 mt-2">Click for details →</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowOutstandingDialog(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(dashboard?.summary?.outstanding_amount || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.summary?.outstanding_count || 0} unpaid visits
            </p>
            <p className="text-xs text-blue-500 mt-2">Click for details →</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different analytics sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="insurance">Insurance</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="out-of-stock">Out of Stock</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Trends Chart */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Daily Trends</CardTitle>
                <CardDescription>Visits and revenue over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboard?.trends?.daily || []}>
                      <defs>
                        <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number, name: string) =>
                          name === 'revenue' ? formatCurrency(value) : value
                        }
                      />
                      <Legend />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="visits"
                        stroke="#8884d8"
                        fillOpacity={1}
                        fill="url(#colorVisits)"
                        name="Visits"
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="revenue"
                        stroke="#82ca9d"
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        name="Revenue"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Payment Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Visits by Payment Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {paymentTypeData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Patient Gender Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Patients by Gender</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genderData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {genderData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Consultation Types */}
          {consultations?.by_type && consultations.by_type.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Consultations by Type</CardTitle>
                <CardDescription>Average fee: {formatCurrency(consultations?.average_fee || 0)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={consultations.by_type}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number, name: string) => 
                        name === 'revenue' ? formatCurrency(value) : value
                      } />
                      <Legend />
                      <Bar dataKey="count" fill="#8884d8" name="Count" />
                      <Bar dataKey="revenue" fill="#82ca9d" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Consultation Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboard?.summary?.consultation_revenue || 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Sales Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboard?.summary?.sales_revenue || 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${(financial?.summary?.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(financial?.summary?.net_profit || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {financial?.summary?.profit_margin || 0}% margin
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue by Payment Type */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Payment Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByPaymentData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `GH₵${v.toLocaleString()}`} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="value" fill="#8884d8" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Income vs Expenses */}
            <Card>
              <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Income', value: financial?.summary?.total_income || 0 },
                        { name: 'Expenses', value: financial?.summary?.total_expenses || 0 },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `GH₵${v.toLocaleString()}`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="value" fill="#8884d8">
                        <Cell fill="#22c55e" />
                        <Cell fill="#ef4444" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Expense Categories */}
          {financial?.expense_by_category && financial.expense_by_category.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={financial.expense_by_category}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="amount"
                        nameKey="category"
                      >
                        {financial.expense_by_category.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Insurance Tab */}
        <TabsContent value="insurance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Insurance Visits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.insurance?.total_visits || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Limit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboard?.insurance?.total_limit || 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Insurance Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(dashboard?.insurance?.total_used || 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Patient Top-ups</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(dashboard?.insurance?.total_patient_topup || 0)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Insurance by Provider */}
          {dashboard?.insurance?.by_provider && dashboard.insurance.by_provider.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Insurance by Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Visits</TableHead>
                      <TableHead className="text-right">Amount Used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.insurance.by_provider.map((provider: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{provider.provider}</TableCell>
                        <TableCell className="text-right">{provider.visits}</TableCell>
                        <TableCell className="text-right">{formatCurrency(provider.amount_used)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inventory?.summary?.total_products || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{inventory?.summary?.out_of_stock_count || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{inventory?.summary?.low_stock_count || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(inventory?.summary?.total_inventory_value || 0)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Products by Category */}
            {inventory?.products_by_category && inventory.products_by_category.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Products by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={inventory.products_by_category}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                          nameKey="category"
                        >
                          {inventory.products_by_category.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Selling Products */}
            {inventory?.top_selling_products && inventory.top_selling_products.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Selling Products (30 days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={inventory.top_selling_products} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="product_name" type="category" tick={{ fontSize: 10 }} width={100} />
                        <Tooltip />
                        <Bar dataKey="total_sold" fill="#82ca9d" name="Units Sold" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Low Stock Items Table */}
          {inventory?.low_stock_items && inventory.low_stock_items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Low Stock Items
                </CardTitle>
                <CardDescription>Products that need to be reordered</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                      <TableHead className="text-right">Reorder Level</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.low_stock_items.map((item: any) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell>{item.sku || '-'}</TableCell>
                        <TableCell className="text-right">{item.current_stock}</TableCell>
                        <TableCell className="text-right">{item.reorder_level}</TableCell>
                        <TableCell>
                          {item.current_stock === 0 ? (
                            <Badge variant="destructive">Out of Stock</Badge>
                          ) : (
                            <Badge variant="warning">Low Stock</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Present</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{staffPerformance?.attendance?.present || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Late</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{staffPerformance?.attendance?.late || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Absent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{staffPerformance?.attendance?.absent || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{staffPerformance?.attendance?.total_records || 0}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Visits by Staff */}
            {staffPerformance?.visits_by_staff && staffPerformance.visits_by_staff.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Visits Recorded by Staff</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={staffPerformance.visits_by_staff} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="staff_name" type="category" tick={{ fontSize: 10 }} width={100} />
                        <Tooltip />
                        <Bar dataKey="visits_recorded" fill="#8884d8" name="Visits" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Consultations by Doctor */}
            {staffPerformance?.consultations_by_doctor && staffPerformance.consultations_by_doctor.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Consultations by Doctor</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={staffPerformance.consultations_by_doctor} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="doctor_name" type="category" tick={{ fontSize: 10 }} width={100} />
                        <Tooltip />
                        <Bar dataKey="consultations" fill="#82ca9d" name="Consultations" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Out of Stock Tab */}
        <TabsContent value="out-of-stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-red-500" />
                Out of Stock Prescription Requests
              </CardTitle>
              <CardDescription>
                Products requested in prescriptions but not available in stock (last 30 days).
                Use this data to identify products to reorder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4">
                    <div className="text-sm text-red-600">Total Requests</div>
                    <div className="text-3xl font-bold text-red-700">{outOfStock?.total_requests || 0}</div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="pt-4">
                    <div className="text-sm text-orange-600">Unique Products</div>
                    <div className="text-3xl font-bold text-orange-700">{outOfStock?.unique_products || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {outOfStock?.items && outOfStock.items.length > 0 ? (
                <>
                  <div className="h-64 mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={outOfStock.items.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="product_name" type="category" tick={{ fontSize: 10 }} width={120} />
                        <Tooltip />
                        <Bar dataKey="request_count" fill="#ef4444" name="Times Requested" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Times Requested</TableHead>
                        <TableHead className="text-right">Total Quantity</TableHead>
                        <TableHead>Last Requested</TableHead>
                        <TableHead>Priority</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outOfStock.items.map((item: any, index: number) => (
                        <TableRow key={item.product_id || index}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-right">{item.request_count}</TableCell>
                          <TableCell className="text-right">{item.total_quantity_requested}</TableCell>
                          <TableCell>
                            {item.last_requested
                              ? new Date(item.last_requested).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {item.request_count >= 5 ? (
                              <Badge variant="destructive">High</Badge>
                            ) : item.request_count >= 3 ? (
                              <Badge variant="warning">Medium</Badge>
                            ) : (
                              <Badge variant="secondary">Low</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No out-of-stock requests in the last 30 days</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Revenue Details Dialog */}
      <Dialog open={showRevenueDialog} onOpenChange={setShowRevenueDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Revenue Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(dashboard?.summary?.total_revenue || 0)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Change vs Previous</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(dashboard?.summary?.revenue_change_percent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(dashboard?.summary?.revenue_change_percent || 0) >= 0 ? '+' : ''}{dashboard?.summary?.revenue_change_percent?.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Consultation Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{formatCurrency(dashboard?.summary?.consultation_revenue || 0)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Sales Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{formatCurrency(dashboard?.summary?.sales_revenue || 0)}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Revenue by Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.revenue?.by_payment_type && Object.entries(dashboard.revenue.by_payment_type).map(([method, amount]) => (
                      <TableRow key={method}>
                        <TableCell className="font-medium capitalize">{method}</TableCell>
                        <TableCell className="text-right">{formatCurrency(amount as number)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {dashboard?.revenue?.by_category && Object.keys(dashboard.revenue.by_category).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Revenue by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(dashboard.revenue.by_category).map(([category, amount]) => (
                        <TableRow key={category}>
                          <TableCell className="font-medium capitalize">{category}</TableCell>
                          <TableCell className="text-right">{formatCurrency(amount as number)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Visits Details Dialog */}
      <Dialog open={showVisitsDialog} onOpenChange={setShowVisitsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Visits Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Visits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboard?.summary?.total_visits || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Change vs Previous</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(dashboard?.summary?.visits_change_percent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(dashboard?.summary?.visits_change_percent || 0) >= 0 ? '+' : ''}{dashboard?.summary?.visits_change_percent?.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Visits by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.visits?.by_status && Object.entries(dashboard.visits.by_status).map(([status, count]) => (
                      <TableRow key={status}>
                        <TableCell>
                          <Badge variant={status === 'completed' ? 'default' : status === 'waiting' ? 'secondary' : 'outline'}>
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{count as number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Visits by Payment Type</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Type</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.visits?.by_payment_type && Object.entries(dashboard.visits.by_payment_type).map(([type, count]) => (
                      <TableRow key={type}>
                        <TableCell className="font-medium capitalize">{type}</TableCell>
                        <TableCell className="text-right">{count as number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Patients Details Dialog */}
      <Dialog open={showPatientsDialog} onOpenChange={setShowPatientsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Patients Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">New Patients (This Period)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboard?.summary?.new_patients || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Patients</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboard?.summary?.total_patients?.toLocaleString() || 0}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Patients by Gender</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genderData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {genderData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gender</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.patients?.by_gender && Object.entries(dashboard.patients.by_gender).map(([gender, count]) => (
                      <TableRow key={gender}>
                        <TableCell className="font-medium capitalize">{gender}</TableCell>
                        <TableCell className="text-right">{count as number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Outstanding Details Dialog */}
      <Dialog open={showOutstandingDialog} onOpenChange={setShowOutstandingDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-red-500" />
              Outstanding Payments
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-700">Total Outstanding</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(dashboard?.summary?.outstanding_amount || 0)}</div>
                </CardContent>
              </Card>
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-orange-700">Unpaid Visits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{dashboard?.summary?.outstanding_count || 0}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">What This Means</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Outstanding Amount:</strong> Total unpaid consultation fees from visits marked as "unpaid" or "partial".
                </p>
                <p>
                  <strong>Unpaid Visits:</strong> Number of visits where the patient has not fully paid the consultation fee.
                </p>
                <p className="pt-2 text-blue-600">
                  💡 Tip: Go to Front Desk → Visit Payments to collect outstanding payments.
                </p>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
