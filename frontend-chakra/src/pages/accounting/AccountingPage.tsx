import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Box, Button, Divider, Flex, Input, SimpleGrid, Stack, Tab, Table, TabList, TabPanel, TabPanels, Tabs, Tbody, Td, Text, Textarea, Th, Thead, Tr } from '@chakra-ui/react'
import { MdTrendingDown, MdTrendingUp } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { AppModal, Field, TableMessageRow } from '@/components/ui'

const today = () => new Date().toISOString().split('T')[0]
const emptyIncome = () => ({ amount: '', description: '', reference: '', income_date: today(), branch_id: 1 })
const emptyExpense = () => ({ amount: '', description: '', vendor: '', reference: '', expense_date: today(), branch_id: 1 })

const formatCurrency = (amount: number) => amount.toLocaleString('en-US', { style: 'currency', currency: 'GHS' })

function PeriodCard({ title, data }: { title: string; data?: { income: number; expenses: number; profit: number } }) {
  return (
    <SectionCard title={<Text fontSize="sm">{title}</Text>}>
      <Stack spacing="4px">
        <Flex justify="space-between" fontSize="sm">
          <Text color="green.500">Income</Text>
          <Text>{formatCurrency(data?.income || 0)}</Text>
        </Flex>
        <Flex justify="space-between" fontSize="sm">
          <Text color="red.500">Expenses</Text>
          <Text>{formatCurrency(data?.expenses || 0)}</Text>
        </Flex>
        <Divider />
        <Flex justify="space-between" fontWeight="500" pt="4px">
          <Text>Profit</Text>
          <Text color={(data?.profit ?? 0) >= 0 ? 'green.500' : 'red.500'}>{formatCurrency(data?.profit || 0)}</Text>
        </Flex>
      </Stack>
    </SectionCard>
  )
}

export default function AccountingPage() {
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false)
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [incomeForm, setIncomeForm] = useState(emptyIncome)
  const [expenseForm, setExpenseForm] = useState(emptyExpense)

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: dashboard } = useQuery({
    queryKey: ['accounting-dashboard'],
    queryFn: async () => (await api.get('/accounting/dashboard')).data,
  })

  const { data: incomes = [] } = useQuery({
    queryKey: ['incomes'],
    queryFn: async () => (await api.get('/accounting/incomes')).data,
  })

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => (await api.get('/accounting/expenses')).data,
  })

  const createIncomeMutation = useMutation({
    mutationFn: (data: any) => api.post('/accounting/incomes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] })
      setIsIncomeDialogOpen(false)
      setIncomeForm(emptyIncome())
      toast({ title: 'Income recorded successfully' })
    },
  })

  const createExpenseMutation = useMutation({
    mutationFn: (data: any) => api.post('/accounting/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] })
      setIsExpenseDialogOpen(false)
      setExpenseForm(emptyExpense())
      toast({ title: 'Expense recorded successfully' })
    },
  })

  return (
    <>
      <PageHeader
        title="Accounting"
        actions={
          <>
            <Button variant="light" leftIcon={<MdTrendingDown />} onClick={() => setIsExpenseDialogOpen(true)}>
              Record Expense
            </Button>
            <Button variant="brand" leftIcon={<MdTrendingUp />} onClick={() => setIsIncomeDialogOpen(true)}>
              Record Income
            </Button>
          </>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="20px" mb="20px" data-tour="summary">
        <PeriodCard title="Today" data={dashboard?.today} />
        <PeriodCard title="This Month" data={dashboard?.month} />
        <PeriodCard title="This Year" data={dashboard?.year} />
      </SimpleGrid>

      <Tabs variant="soft-rounded" data-tour="transactions">
        <TabList gap="8px" mb="16px">
          <Tab>Income</Tab>
          <Tab>Expenses</Tab>
        </TabList>
        <TabPanels>
          <TabPanel p="0">
            <Card>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Date</Th>
                      <Th>Description</Th>
                      <Th>Reference</Th>
                      <Th isNumeric>Amount</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {incomes.length === 0 ? (
                      <TableMessageRow colSpan={4}>No income records found</TableMessageRow>
                    ) : (
                      incomes.map((income: any) => (
                        <Tr key={income.id}>
                          <Td>{new Date(income.income_date).toLocaleDateString()}</Td>
                          <Td>{income.description || '-'}</Td>
                          <Td>{income.reference || '-'}</Td>
                          <Td isNumeric fontWeight="600" color="green.500">
                            {formatCurrency(income.amount)}
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>
          <TabPanel p="0">
            <Card>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Date</Th>
                      <Th>Description</Th>
                      <Th>Vendor</Th>
                      <Th>Status</Th>
                      <Th isNumeric>Amount</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {expenses.length === 0 ? (
                      <TableMessageRow colSpan={5}>No expense records found</TableMessageRow>
                    ) : (
                      expenses.map((expense: any) => (
                        <Tr key={expense.id}>
                          <Td>{new Date(expense.expense_date).toLocaleDateString()}</Td>
                          <Td>{expense.description || '-'}</Td>
                          <Td>{expense.vendor || '-'}</Td>
                          <Td>
                            <Badge colorScheme={expense.is_approved ? 'green' : 'yellow'}>{expense.is_approved ? 'Approved' : 'Pending'}</Badge>
                          </Td>
                          <Td isNumeric fontWeight="600" color="red.500">
                            {formatCurrency(expense.amount)}
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <AppModal
        isOpen={isIncomeDialogOpen}
        onClose={() => setIsIncomeDialogOpen(false)}
        title="Record Income"
        footer={
          <>
            <Button variant="light" onClick={() => setIsIncomeDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="income-form" variant="brand" isLoading={createIncomeMutation.isPending} loadingText="Saving...">
              Save
            </Button>
          </>
        }
      >
        <form
          id="income-form"
          onSubmit={(e) => {
            e.preventDefault()
            createIncomeMutation.mutate({ ...incomeForm, amount: parseFloat(incomeForm.amount) })
          }}
        >
          <Stack spacing="16px">
            <Field label="Amount" isRequired>
              <Input variant="main" type="number" step="0.01" value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} />
            </Field>
            <Field label="Date" isRequired>
              <Input variant="main" type="date" value={incomeForm.income_date} onChange={(e) => setIncomeForm({ ...incomeForm, income_date: e.target.value })} />
            </Field>
            <Field label="Reference">
              <Input variant="main" value={incomeForm.reference} onChange={(e) => setIncomeForm({ ...incomeForm, reference: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea variant="main" value={incomeForm.description} onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })} />
            </Field>
          </Stack>
        </form>
      </AppModal>

      <AppModal
        isOpen={isExpenseDialogOpen}
        onClose={() => setIsExpenseDialogOpen(false)}
        title="Record Expense"
        footer={
          <>
            <Button variant="light" onClick={() => setIsExpenseDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="expense-form" variant="brand" isLoading={createExpenseMutation.isPending} loadingText="Saving...">
              Save
            </Button>
          </>
        }
      >
        <form
          id="expense-form"
          onSubmit={(e) => {
            e.preventDefault()
            createExpenseMutation.mutate({ ...expenseForm, amount: parseFloat(expenseForm.amount) })
          }}
        >
          <Stack spacing="16px">
            <Field label="Amount" isRequired>
              <Input variant="main" type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
            </Field>
            <Field label="Date" isRequired>
              <Input variant="main" type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
            </Field>
            <Field label="Vendor">
              <Input variant="main" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })} />
            </Field>
            <Field label="Reference">
              <Input variant="main" value={expenseForm.reference} onChange={(e) => setExpenseForm({ ...expenseForm, reference: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea variant="main" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
            </Field>
          </Stack>
        </form>
      </AppModal>
    </>
  )
}
