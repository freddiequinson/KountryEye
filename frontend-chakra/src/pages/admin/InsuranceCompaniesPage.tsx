import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Switch,
  Tab,
  Table,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { MdAdd, MdAttachMoney, MdBusiness, MdDelete, MdDescription, MdDownload, MdEdit, MdExpandLess, MdExpandMore, MdPeople, MdTrendingUp } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { AppModal, ConfirmDialog, EmptyState, Field, TableMessageRow } from '@/components/ui'

interface InsuranceCompany {
  id: number
  name: string
  code: string
  contact_phone?: string
  contact_email?: string
  address?: string
  is_active: boolean
  created_at?: string
  fee_overrides_count?: number
  fee_overrides?: FeeOverride[]
}

interface FeeOverride {
  id: number
  consultation_type_id: number
  consultation_type_name?: string
  override_fee?: number
  initial_fee?: number
  review_fee?: number
  subsequent_fee?: number
}

interface ConsultationType {
  id: number
  name: string
  base_fee: number
}

interface AnalyticsSummary {
  summary: Array<{ provider: string; visit_count: number; total_owed: number }>
  totals: { total_owed: number; total_visits: number; provider_count: number }
}

const emptyCompany = { name: '', code: '', contact_phone: '', contact_email: '', address: '', is_active: true }
const emptyOverride = { consultation_type_id: '', override_fee: '', initial_fee: '', review_fee: '', subsequent_fee: '' }

const formatCurrency = (amount: number) => `GH₵ ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const optionalFee = (value?: number) => (value ? formatCurrency(value) : '-')
const parseOptional = (value: string) => (value ? parseFloat(value) : null)

export default function InsuranceCompaniesPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false)
  const [isFeeOverrideDialogOpen, setIsFeeOverrideDialogOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<InsuranceCompany | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [deletingCompany, setDeletingCompany] = useState<InsuranceCompany | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [companyForm, setCompanyForm] = useState(emptyCompany)
  const [feeOverrideForm, setFeeOverrideForm] = useState(emptyOverride)
  const [dateRange, setDateRange] = useState({ start_date: '', end_date: '' })

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['insurance-companies', showInactive],
    queryFn: async () => (await api.get(`/insurance?include_inactive=${showInactive}`)).data,
  })

  const { data: consultationTypes = [] } = useQuery<ConsultationType[]>({
    queryKey: ['consultation-types'],
    queryFn: async () => (await api.get('/clinical/types')).data,
  })

  const dateParams = () => {
    const params = new URLSearchParams()
    if (dateRange.start_date) params.append('start_date', dateRange.start_date)
    if (dateRange.end_date) params.append('end_date', dateRange.end_date)
    return params
  }

  const { data: analyticsSummary } = useQuery<AnalyticsSummary>({
    queryKey: ['insurance-analytics', dateRange],
    queryFn: async () => (await api.get(`/insurance/analytics/summary?${dateParams()}`)).data,
  })

  const { data: selectedCompanyDetails } = useQuery({
    queryKey: ['insurance-company', selectedCompanyId],
    queryFn: async () => (await api.get(`/insurance/${selectedCompanyId}`)).data,
    enabled: !!selectedCompanyId,
  })

  const closeCompanyDialog = () => {
    setIsCompanyDialogOpen(false)
    setEditingCompany(null)
    setCompanyForm(emptyCompany)
  }

  const createCompanyMutation = useMutation({
    mutationFn: (data: typeof companyForm) => api.post('/insurance', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-companies'] })
      closeCompanyDialog()
      toast({ title: 'Insurance company created successfully' })
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.detail || 'Failed to create company', variant: 'destructive' })
    },
  })

  const updateCompanyMutation = useMutation({
    mutationFn: (data: typeof companyForm) => api.put(`/insurance/${editingCompany?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-companies'] })
      closeCompanyDialog()
      toast({ title: 'Insurance company updated successfully' })
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.detail || 'Failed to update company', variant: 'destructive' })
    },
  })

  const deleteCompanyMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/insurance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-companies'] })
      setDeletingCompany(null)
      toast({ title: 'Insurance company deactivated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to deactivate company', variant: 'destructive' })
    },
  })

  const createFeeOverrideMutation = useMutation({
    mutationFn: (data: any) => api.post(`/insurance/${selectedCompanyId}/fee-overrides`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-company', selectedCompanyId] })
      setIsFeeOverrideDialogOpen(false)
      setFeeOverrideForm(emptyOverride)
      toast({ title: 'Fee override created successfully' })
    },
    onError: (error: any) => {
      toast({ title: error.response?.data?.detail || 'Failed to create fee override', variant: 'destructive' })
    },
  })

  const deleteFeeOverrideMutation = useMutation({
    mutationFn: ({ companyId, overrideId }: { companyId: number; overrideId: number }) => api.delete(`/insurance/${companyId}/fee-overrides/${overrideId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-company', selectedCompanyId] })
      toast({ title: 'Fee override deleted successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to delete fee override', variant: 'destructive' })
    },
  })

  const handleEditCompany = (company: InsuranceCompany) => {
    setEditingCompany(company)
    setCompanyForm({
      name: company.name,
      code: company.code,
      contact_phone: company.contact_phone || '',
      contact_email: company.contact_email || '',
      address: company.address || '',
      is_active: company.is_active,
    })
    setIsCompanyDialogOpen(true)
  }

  const handleExportCSV = async () => {
    try {
      const response = await api.get(`/insurance/analytics/export?${dateParams()}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `insurance_report_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast({ title: 'Report exported successfully' })
    } catch {
      toast({ title: 'Failed to export report', variant: 'destructive' })
    }
  }

  const totals = analyticsSummary?.totals

  return (
    <>
      <PageHeader
        title="Insurance Companies"
        description="Manage insurance providers and view analytics"
        actions={
          <Button
            variant="brand"
            leftIcon={<MdAdd />}
            onClick={() => {
              setCompanyForm(emptyCompany)
              setEditingCompany(null)
              setIsCompanyDialogOpen(true)
            }}
          >
            Add Insurance Company
          </Button>
        }
      />

      <Tabs variant="soft-rounded">
        <TabList gap="8px" mb="16px">
          <Tab>
            <Icon as={MdBusiness} me="8px" />
            Companies
          </Tab>
          <Tab>
            <Icon as={MdTrendingUp} me="8px" />
            Analytics
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel p="0">
            <FormControl display="flex" alignItems="center" mb="16px">
              <Switch id="show-inactive" colorScheme="brandScheme" isChecked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} me="8px" />
              <FormLabel htmlFor="show-inactive" mb="0">
                Show inactive companies
              </FormLabel>
            </FormControl>

            {companiesLoading ? (
              <Flex justify="center" py="32px">
                <Spinner color="brand.500" />
              </Flex>
            ) : (
              <Stack spacing="16px">
                {companies.map((company: InsuranceCompany) => {
                  const expanded = selectedCompanyId === company.id
                  return (
                    <Card key={company.id} opacity={company.is_active ? 1 : 0.6}>
                      <Flex justify="space-between" align="start" gap="12px" wrap="wrap">
                        <Flex align="center" gap="12px">
                          <Icon as={MdBusiness} w="32px" h="32px" color="brand.500" />
                          <Box>
                            <Flex align="center" gap="8px" wrap="wrap">
                              <Heading size="sm">{company.name}</Heading>
                              <Badge variant="outline">{company.code}</Badge>
                              {!company.is_active && <Badge>Inactive</Badge>}
                            </Flex>
                            <Text fontSize="sm" color="secondaryGray.600">
                              {company.contact_phone && <span style={{ marginRight: 16 }}>📞 {company.contact_phone}</span>}
                              {company.contact_email && <span>✉️ {company.contact_email}</span>}
                            </Text>
                          </Box>
                        </Flex>
                        <Flex gap="8px">
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Icon as={expanded ? MdExpandLess : MdExpandMore} />}
                            onClick={() => setSelectedCompanyId(expanded ? null : company.id)}
                          >
                            Fee Overrides
                          </Button>
                          <IconButton aria-label="Edit company" variant="ghost" size="sm" icon={<MdEdit />} onClick={() => handleEditCompany(company)} />
                          <IconButton aria-label="Deactivate company" variant="ghost" size="sm" icon={<MdDelete />} onClick={() => setDeletingCompany(company)} />
                        </Flex>
                      </Flex>

                      {expanded && selectedCompanyDetails && (
                        <Box mt="16px" pt="16px" borderTop="1px solid" borderColor="secondaryGray.100">
                          <Flex justify="space-between" align="center" mb="16px">
                            <Text fontWeight="600">Fee Overrides by Consultation Type</Text>
                            <Button
                              size="sm"
                              variant="brand"
                              leftIcon={<MdAdd />}
                              onClick={() => {
                                setFeeOverrideForm(emptyOverride)
                                setIsFeeOverrideDialogOpen(true)
                              }}
                            >
                              Add Override
                            </Button>
                          </Flex>
                          {selectedCompanyDetails.fee_overrides?.length > 0 ? (
                            <Box overflowX="auto">
                              <Table variant="simple" size="sm">
                                <Thead>
                                  <Tr>
                                    <Th>Consultation Type</Th>
                                    <Th>Override Fee</Th>
                                    <Th>Initial Fee</Th>
                                    <Th>Review Fee</Th>
                                    <Th>Subsequent Fee</Th>
                                    <Th />
                                  </Tr>
                                </Thead>
                                <Tbody>
                                  {selectedCompanyDetails.fee_overrides.map((override: FeeOverride) => (
                                    <Tr key={override.id}>
                                      <Td fontWeight="500">{override.consultation_type_name}</Td>
                                      <Td>{optionalFee(override.override_fee)}</Td>
                                      <Td>{optionalFee(override.initial_fee)}</Td>
                                      <Td>{optionalFee(override.review_fee)}</Td>
                                      <Td>{optionalFee(override.subsequent_fee)}</Td>
                                      <Td>
                                        <IconButton
                                          aria-label="Delete override"
                                          variant="ghost"
                                          size="sm"
                                          icon={<MdDelete />}
                                          onClick={() => deleteFeeOverrideMutation.mutate({ companyId: company.id, overrideId: override.id })}
                                        />
                                      </Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </Box>
                          ) : (
                            <Text color="secondaryGray.600" textAlign="center" py="16px">
                              No fee overrides configured. Standard consultation fees will apply.
                            </Text>
                          )}
                        </Box>
                      )}
                    </Card>
                  )
                })}

                {companies.length === 0 && (
                  <Card>
                    <EmptyState icon={MdBusiness}>No insurance companies found. Add one to get started.</EmptyState>
                  </Card>
                )}
              </Stack>
            )}
          </TabPanel>

          <TabPanel p="0">
            <Flex wrap="wrap" gap="16px" align="end" mb="20px">
              <Field label="Start Date" w="auto">
                <Input variant="main" type="date" value={dateRange.start_date} onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })} />
              </Field>
              <Field label="End Date" w="auto">
                <Input variant="main" type="date" value={dateRange.end_date} onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })} />
              </Field>
              <Button variant="light" leftIcon={<MdDownload />} onClick={handleExportCSV}>
                Export CSV
              </Button>
            </Flex>

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing="20px" mb="20px">
              <StatCard name="Total Insurance Owed" value={formatCurrency(totals?.total_owed || 0)} icon={MdAttachMoney} helpText={`From ${totals?.provider_count || 0} providers`} />
              <StatCard name="Total Insurance Visits" value={totals?.total_visits || 0} icon={MdPeople} helpText="Patients using insurance" />
              <StatCard
                name="Average Per Visit"
                value={formatCurrency(totals?.total_visits ? totals.total_owed / totals.total_visits : 0)}
                icon={MdDescription}
                helpText="Per insurance visit"
              />
            </SimpleGrid>

            <SectionCard title="Amount Owed by Insurance Provider" description="Breakdown of insurance claims by provider">
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Provider</Th>
                      <Th isNumeric>Visits</Th>
                      <Th isNumeric>Total Owed</Th>
                      <Th isNumeric>Avg per Visit</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {analyticsSummary?.summary?.map((item, index) => (
                      <Tr key={index}>
                        <Td>
                          <Badge variant="outline">{item.provider}</Badge>
                        </Td>
                        <Td isNumeric>{item.visit_count}</Td>
                        <Td isNumeric fontWeight="600">
                          {formatCurrency(item.total_owed)}
                        </Td>
                        <Td isNumeric>{formatCurrency(item.visit_count ? item.total_owed / item.visit_count : 0)}</Td>
                      </Tr>
                    ))}
                    {!analyticsSummary?.summary?.length && <TableMessageRow colSpan={4}>No insurance data found for the selected period</TableMessageRow>}
                  </Tbody>
                </Table>
              </Box>
            </SectionCard>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Company Dialog */}
      <AppModal
        isOpen={isCompanyDialogOpen}
        onClose={closeCompanyDialog}
        title={editingCompany ? 'Edit Insurance Company' : 'Add Insurance Company'}
        footer={
          <>
            <Button variant="light" onClick={closeCompanyDialog}>
              Cancel
            </Button>
            <Button
              variant="brand"
              isDisabled={!companyForm.name || !companyForm.code}
              isLoading={createCompanyMutation.isPending || updateCompanyMutation.isPending}
              onClick={() => (editingCompany ? updateCompanyMutation.mutate(companyForm) : createCompanyMutation.mutate(companyForm))}
            >
              {editingCompany ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Company Name" isRequired>
            <Input
              variant="main"
              placeholder="e.g., National Health Insurance Scheme"
              value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
            />
          </Field>
          <Field label="Short Code" isRequired>
            <Input
              variant="main"
              placeholder="e.g., NHIS"
              maxLength={20}
              value={companyForm.code}
              onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value.toUpperCase() })}
            />
          </Field>
          <SimpleGrid columns={2} spacing="16px">
            <Field label="Contact Phone">
              <Input variant="main" placeholder="Phone number" value={companyForm.contact_phone} onChange={(e) => setCompanyForm({ ...companyForm, contact_phone: e.target.value })} />
            </Field>
            <Field label="Contact Email">
              <Input
                variant="main"
                type="email"
                placeholder="Email address"
                value={companyForm.contact_email}
                onChange={(e) => setCompanyForm({ ...companyForm, contact_email: e.target.value })}
              />
            </Field>
          </SimpleGrid>
          <Field label="Address">
            <Textarea variant="main" rows={2} placeholder="Company address" value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} />
          </Field>
          <FormControl display="flex" alignItems="center">
            <Switch id="is-active" colorScheme="brandScheme" isChecked={companyForm.is_active} onChange={(e) => setCompanyForm({ ...companyForm, is_active: e.target.checked })} me="8px" />
            <FormLabel htmlFor="is-active" mb="0">
              Active
            </FormLabel>
          </FormControl>
        </Stack>
      </AppModal>

      {/* Fee Override Dialog */}
      <AppModal
        isOpen={isFeeOverrideDialogOpen}
        onClose={() => setIsFeeOverrideDialogOpen(false)}
        title="Add Fee Override"
        footer={
          <>
            <Button variant="light" onClick={() => setIsFeeOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              isDisabled={!feeOverrideForm.consultation_type_id}
              isLoading={createFeeOverrideMutation.isPending}
              onClick={() =>
                createFeeOverrideMutation.mutate({
                  consultation_type_id: parseInt(feeOverrideForm.consultation_type_id),
                  override_fee: parseOptional(feeOverrideForm.override_fee),
                  initial_fee: parseOptional(feeOverrideForm.initial_fee),
                  review_fee: parseOptional(feeOverrideForm.review_fee),
                  subsequent_fee: parseOptional(feeOverrideForm.subsequent_fee),
                })
              }
            >
              Create Override
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Consultation Type" isRequired>
            <Select
              variant="main"
              placeholder="Select consultation type"
              value={feeOverrideForm.consultation_type_id}
              onChange={(e) => setFeeOverrideForm({ ...feeOverrideForm, consultation_type_id: e.target.value })}
            >
              {consultationTypes.map((type) => (
                <option key={type.id} value={type.id.toString()}>
                  {type.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Single Override Fee (applies to all visit types)">
            <Input
              variant="main"
              type="number"
              placeholder="Leave empty to use per-type fees"
              value={feeOverrideForm.override_fee}
              onChange={(e) => setFeeOverrideForm({ ...feeOverrideForm, override_fee: e.target.value })}
            />
          </Field>
          <Divider />
          <Text fontSize="sm" color="secondaryGray.600">
            Or set fees per visit type:
          </Text>
          <SimpleGrid columns={3} spacing="12px">
            {(['initial_fee', 'review_fee', 'subsequent_fee'] as const).map((key) => (
              <Field key={key} label={<Text fontSize="xs">{key === 'initial_fee' ? 'Initial Fee' : key === 'review_fee' ? 'Review Fee' : 'Subsequent Fee'}</Text>}>
                <Input variant="main" type="number" placeholder="0.00" value={feeOverrideForm[key]} onChange={(e) => setFeeOverrideForm({ ...feeOverrideForm, [key]: e.target.value })} />
              </Field>
            ))}
          </SimpleGrid>
        </Stack>
      </AppModal>

      <ConfirmDialog
        isOpen={!!deletingCompany}
        onClose={() => setDeletingCompany(null)}
        onConfirm={() => deletingCompany && deleteCompanyMutation.mutate(deletingCompany.id)}
        isLoading={deleteCompanyMutation.isPending}
        title="Deactivate Insurance Company?"
        confirmLabel="Deactivate"
      >
        This will deactivate "{deletingCompany?.name}". It will no longer appear in dropdowns but existing records will be preserved.
      </ConfirmDialog>
    </>
  )
}
