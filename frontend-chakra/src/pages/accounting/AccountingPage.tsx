import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Box, Button, Flex, Icon, Input, SimpleGrid, Stack, Tab, Table, TabList, TabPanel, TabPanels, Tabs, Tbody, Td, Text, Textarea, Th, Thead, Tr } from '@chakra-ui/react'
import { MdTrendingDown, MdTrendingUp } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import { AppModal, Field, TableMessageRow } from '@/components/ui'

const today = () => new Date().toISOString().split('T')[0]
const emptyIncome = () => ({ amount: '', description: '', reference: '', income_date: today(), branch_id: 1 })
const emptyExpense = () => ({ amount: '', description: '', vendor: '', reference: '', expense_date: today(), branch_id: 1 })

const formatCurrency = (amount: number) => amount.toLocaleString('en-US', { style: 'currency', currency: 'GHS' })

// Profit for a period up top, then income vs expenses with a bar showing how much of income was spent.
function PeriodCard({ title, data }: { title: string; data?: { income: number; expenses: number; profit: number } }) {
  const income = data?.income || 0
  const expenses = data?.expenses || 0
  const profit = data?.profit ?? 0
  const spent = income > 0 ? Math.min(100, (expenses / income) * 100) : expenses > 0 ? 100 : 0
  return (
    <Card>
      <Flex justify="space-between" align="center" mb="10px">
        <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="secondaryGray.500">
          {title}
        </Text>
        <Badge colorScheme={profit >= 0 ? 'green' : 'red'}>{profit >= 0 ? 'Profit' : 'Loss'}</Badge>
      </Flex>
      <Text fontSize="28px" fontWeight="800" lineHeight="1.1" color={profit >= 0 ? 'secondaryGray.900' : 'red.500'} _dark={{ color: profit >= 0 ? 'white' : 'red.300' }}>
        {formatCurrency(profit)}
      </Text>
      <Box h="6px" borderRadius="full" bg="green.100" _dark={{ bg: 'whiteAlpha.200' }} mt="14px" mb="12px" overflow="hidden">
        <Box h="100%" w={`${spent}%`} bg="red.500" borderRadius="full" transition="width .4s ease" />
      </Box>
      <Flex justify="space-between" fontSize="13px" fontWeight="600" wrap="wrap" gap="6px 16px">
        <Flex align="center" gap="6px">
          <Icon as={MdTrendingUp} color="green.500" />
          <Text color="secondaryGray.600">Income</Text>
          <Text>{formatCurrency(income)}</Text>
        </Flex>
        <Flex align="center" gap="6px">
          <Icon as={MdTrendingDown} color="red.500" />
          <Text color="secondaryGray.600">Expenses</Text>
          <Text>{formatCurrency(expenses)}</Text>
        </Flex>
      </Flex>
    </Card>
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
