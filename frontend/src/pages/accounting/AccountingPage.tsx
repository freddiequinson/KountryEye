import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function AccountingPage() {
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    amount: '',
    description: '',
    reference: '',
    income_date: new Date().toISOString().split('T')[0],
    branch_id: 1,
  });
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    description: '',
    vendor: '',
    reference: '',
    expense_date: new Date().toISOString().split('T')[0],
    branch_id: 1,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: dashboard } = useQuery({
    queryKey: ['accounting-dashboard'],
    queryFn: async () => {
      const response = await api.get('/accounting/dashboard');
      return response.data;
    },
  });

  const { data: incomes = [] } = useQuery({
    queryKey: ['incomes'],
    queryFn: async () => {
      const response = await api.get('/accounting/incomes');
      return response.data;
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const response = await api.get('/accounting/expenses');
      return response.data;
    },
  });

  const createIncomeMutation = useMutation({
    mutationFn: (data: any) => api.post('/accounting/incomes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] });
      setIsIncomeDialogOpen(false);
      setIncomeForm({
        amount: '',
        description: '',
        reference: '',
        income_date: new Date().toISOString().split('T')[0],
        branch_id: 1,
      });
      toast({ title: 'Income recorded successfully' });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data: any) => api.post('/accounting/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] });
      setIsExpenseDialogOpen(false);
      setExpenseForm({
        amount: '',
        description: '',
        vendor: '',
        reference: '',
        expense_date: new Date().toISOString().split('T')[0],
        branch_id: 1,
      });
      toast({ title: 'Expense recorded successfully' });
    },
  });

  const formatCurrency = (amount: number) =>
    amount.toLocaleString('en-US', { style: 'currency', currency: 'GHS' });

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Accounting</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsExpenseDialogOpen(true)}>
              <TrendingDown className="mr-2 h-4 w-4" />
              Record Expense
            </Button>
            <Button onClick={() => setIsIncomeDialogOpen(true)}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Record Income
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Income</span>
                <span>{formatCurrency(dashboard?.today?.income || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-600">Expenses</span>
                <span>{formatCurrency(dashboard?.today?.expenses || 0)}</span>
              </div>
              <div className="flex justify-between font-medium pt-1 border-t">
                <span>Profit</span>
                <span className={dashboard?.today?.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(dashboard?.today?.profit || 0)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Income</span>
                <span>{formatCurrency(dashboard?.month?.income || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-600">Expenses</span>
                <span>{formatCurrency(dashboard?.month?.expenses || 0)}</span>
              </div>
              <div className="flex justify-between font-medium pt-1 border-t">
                <span>Profit</span>
                <span className={dashboard?.month?.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(dashboard?.month?.profit || 0)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">This Year</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Income</span>
                <span>{formatCurrency(dashboard?.year?.income || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-600">Expenses</span>
                <span>{formatCurrency(dashboard?.year?.expenses || 0)}</span>
              </div>
              <div className="flex justify-between font-medium pt-1 border-t">
                <span>Profit</span>
                <span className={dashboard?.year?.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(dashboard?.year?.profit || 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="incomes">
          <TabsList>
            <TabsTrigger value="incomes">Income</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>

          <TabsContent value="incomes" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        No income records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    incomes.map((income: any) => (
                      <TableRow key={income.id}>
                        <TableCell>
                          {new Date(income.income_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{income.description || '-'}</TableCell>
                        <TableCell>{income.reference || '-'}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(income.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="expenses" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        No expense records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenses.map((expense: any) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          {new Date(expense.expense_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{expense.description || '-'}</TableCell>
                        <TableCell>{expense.vendor || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={expense.is_approved ? 'success' : 'warning'}>
                            {expense.is_approved ? 'Approved' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Income</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createIncomeMutation.mutate({
                  ...incomeForm,
                  amount: parseFloat(incomeForm.amount),
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="income_amount">Amount</Label>
                <Input
                  id="income_amount"
                  type="number"
                  step="0.01"
                  value={incomeForm.amount}
                  onChange={(e) =>
                    setIncomeForm({ ...incomeForm, amount: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="income_date">Date</Label>
                <Input
                  id="income_date"
                  type="date"
                  value={incomeForm.income_date}
                  onChange={(e) =>
                    setIncomeForm({ ...incomeForm, income_date: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="income_reference">Reference</Label>
                <Input
                  id="income_reference"
                  value={incomeForm.reference}
                  onChange={(e) =>
                    setIncomeForm({ ...incomeForm, reference: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="income_description">Description</Label>
                <Textarea
                  id="income_description"
                  value={incomeForm.description}
                  onChange={(e) =>
                    setIncomeForm({ ...incomeForm, description: e.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsIncomeDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createIncomeMutation.isPending}>
                  {createIncomeMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Expense</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createExpenseMutation.mutate({
                  ...expenseForm,
                  amount: parseFloat(expenseForm.amount),
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="expense_amount">Amount</Label>
                <Input
                  id="expense_amount"
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, amount: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense_date">Date</Label>
                <Input
                  id="expense_date"
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, expense_date: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  value={expenseForm.vendor}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, vendor: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense_reference">Reference</Label>
                <Input
                  id="expense_reference"
                  value={expenseForm.reference}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, reference: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense_description">Description</Label>
                <Textarea
                  id="expense_description"
                  value={expenseForm.description}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, description: e.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsExpenseDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createExpenseMutation.isPending}>
                  {createExpenseMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
    </div>
  );
}
