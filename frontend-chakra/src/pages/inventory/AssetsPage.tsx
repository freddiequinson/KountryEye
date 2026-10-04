import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  GridItem,
  Heading,
  Icon,
  IconButton,
  Image,
  Input,
  Select,
  SimpleGrid,
  Stack,
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
  useColorModeValue,
} from '@chakra-ui/react'
import { MdAdd, MdArrowBack, MdBuild, MdCameraAlt, MdCheck, MdClose, MdDelete, MdEdit, MdPersonAdd, MdWarningAmber } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import { AppModal, ConfirmDialog, Field, SearchInput, TableBox, TableMessageRow } from '@/components/ui'

interface AssetCategory {
  id: number
  name: string
  description?: string
  default_checklist?: string[]
  default_maintenance_interval?: number
}

interface Asset {
  id: number
  asset_tag: string
  name: string
  description?: string
  category_id?: number
  branch_id?: number
  serial_number?: string
  model?: string
  manufacturer?: string
  purchase_date?: string
  purchase_price?: number
  warranty_expiry?: string
  status: string
  condition: string
  location?: string
  image_url?: string
  last_maintenance_date?: string
  next_maintenance_date?: string
  maintenance_interval_days?: number
  maintenance_checklist?: string[]
  category?: AssetCategory
  branch?: { id: number; name: string }
}

interface MaintenanceLog {
  id: number
  asset_id: number
  maintenance_type?: string
  description?: string
  performed_by?: string
  performed_date: string
  cost?: number
  next_due_date?: string
  status: string
  checklist_completed?: { item: string; completed: boolean }[]
  notes?: string
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', scheme: 'green' },
  { value: 'faulty', label: 'Faulty', scheme: 'red' },
  { value: 'destroyed', label: 'Destroyed', scheme: 'gray' },
  { value: 'under_maintenance', label: 'Under Maintenance', scheme: 'yellow' },
]

const CONDITION_OPTIONS = [
  { value: 'excellent', label: 'Excellent', scheme: 'green' },
  { value: 'good', label: 'Good', scheme: 'blue' },
  { value: 'fair', label: 'Fair', scheme: 'yellow' },
  { value: 'poor', label: 'Poor', scheme: 'red' },
]

const TABS = ['assets', 'maintenance', 'technicians']

const emptyAssetForm = {
  name: '',
  description: '',
  category_id: '',
  branch_id: '',
  serial_number: '',
  model: '',
  manufacturer: '',
  purchase_date: '',
  purchase_price: '',
  warranty_expiry: '',
  location: '',
  maintenance_interval_days: '',
}

const today = () => new Date().toISOString().split('T')[0]

const emptyMaintenanceForm = (checklist: { item: string; completed: boolean }[] = []) => ({
  maintenance_type: '',
  description: '',
  performed_by: '',
  technician_id: '',
  performed_date: today(),
  cost: '',
  next_due_date: '',
  notes: '',
  checklist,
  fund_request_id: '' as string, // Link to fund request if paid via fund request
})

const emptyTechnician = { name: '', phone: '', email: '', company: '', specialization: '' }

const statusBadge = (status: string) => {
  const option = STATUS_OPTIONS.find((o) => o.value === status)
  return (
    <Badge colorScheme={option?.scheme || 'gray'} variant="solid">
      {option?.label || status}
    </Badge>
  )
}

const conditionBadge = (condition: string) => {
  const option = CONDITION_OPTIONS.find((o) => o.value === condition)
  return (
    <Badge colorScheme={option?.scheme || 'gray'} variant="solid">
      {condition.charAt(0).toUpperCase() + condition.slice(1)}
    </Badge>
  )
}

const isOverdue = (date?: string) => !!date && new Date(date) < new Date()

export default function AssetsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const thumbBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [activeTab, setActiveTab] = useState('assets')
  const [assetForm, setAssetForm] = useState(emptyAssetForm)
  const [checklistItems, setChecklistItems] = useState<string[]>([])
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [maintenanceForm, setMaintenanceForm] = useState(emptyMaintenanceForm())
  const [isAddTechnicianOpen, setIsAddTechnicianOpen] = useState(false)
  const [technicianForm, setTechnicianForm] = useState(emptyTechnician)

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', search, statusFilter, branchFilter],
    queryFn: async () => {
      const params: any = {}
      if (search) params.search = search
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter
      if (branchFilter && branchFilter !== 'all') params.branch_id = branchFilter
      return (await api.get('/assets', { params })).data
    },
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: async () => (await api.get('/assets/categories')).data,
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches')).data,
  })

  const { data: healthReport } = useQuery({
    queryKey: ['asset-health-report'],
    queryFn: async () => (await api.get('/assets/reports/health')).data,
  })

  const { data: maintenanceDue = [] } = useQuery({
    queryKey: ['maintenance-due'],
    queryFn: async () => (await api.get('/assets/reports/maintenance-due', { params: { days_ahead: 30 } })).data,
  })

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => (await api.get('/assets/technicians')).data,
  })

  // Fetch received fund requests that can be linked to maintenance
  const { data: receivedFundRequests = [] } = useQuery({
    queryKey: ['fund-requests-received'],
    queryFn: async () => (await api.get('/fund-requests', { params: { status: 'received' } })).data,
  })

  const { data: maintenanceLogs = [] } = useQuery({
    queryKey: ['maintenance-logs', selectedAsset?.id],
    queryFn: async () => (selectedAsset ? (await api.get(`/assets/${selectedAsset.id}/maintenance`)).data : []),
    enabled: !!selectedAsset,
  })

  const resetAssetForm = () => {
    setAssetForm(emptyAssetForm)
    setChecklistItems([])
    setNewChecklistItem('')
  }

  const invalidateAssets = () => {
    queryClient.invalidateQueries({ queryKey: ['assets'] })
    queryClient.invalidateQueries({ queryKey: ['asset-health-report'] })
  }

  const createAssetMutation = useMutation({
    mutationFn: (data: any) => api.post('/assets', data),
    onSuccess: () => {
      invalidateAssets()
      setIsAddDialogOpen(false)
      resetAssetForm()
      toast({ title: 'Asset created successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to create asset', variant: 'destructive' })
    },
  })

  const updateAssetMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/assets/${id}`, data),
    onSuccess: () => {
      invalidateAssets()
      setIsDetailDialogOpen(false)
      toast({ title: 'Asset updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update asset', variant: 'destructive' })
    },
  })

  const createMaintenanceMutation = useMutation({
    mutationFn: (data: any) => api.post('/assets/maintenance', data),
    onSuccess: () => {
      invalidateAssets()
      queryClient.invalidateQueries({ queryKey: ['maintenance-logs'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-due'] })
      setIsMaintenanceDialogOpen(false)
      setMaintenanceForm(emptyMaintenanceForm())
      toast({ title: 'Maintenance recorded successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to record maintenance', variant: 'destructive' })
    },
  })

  const uploadImageMutation = useMutation({
    mutationFn: async ({ assetId, file }: { assetId: number; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.post(`/assets/${assetId}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast({ title: 'Image uploaded successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to upload image', variant: 'destructive' })
    },
  })

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: number) => api.delete(`/assets/${assetId}`),
    onSuccess: () => {
      invalidateAssets()
      setIsDetailDialogOpen(false)
      setSelectedAsset(null)
      toast({ title: 'Asset deleted successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to delete asset', variant: 'destructive' })
    },
  })

  const createTechnicianMutation = useMutation({
    mutationFn: (data: any) => api.post('/assets/technicians', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicians'] })
      setIsAddTechnicianOpen(false)
      setTechnicianForm(emptyTechnician)
      toast({ title: 'Technician added successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to add technician', variant: 'destructive' })
    },
  })

  // Load checklist from category when category changes
  useEffect(() => {
    if (!assetForm.category_id) return
    const category = categories.find((c: AssetCategory) => c.id.toString() === assetForm.category_id)
    if (category?.default_checklist?.length) setChecklistItems(category.default_checklist)
    if (category?.default_maintenance_interval) {
      setAssetForm((prev) => ({ ...prev, maintenance_interval_days: category.default_maintenance_interval?.toString() || '' }))
    }
  }, [assetForm.category_id, categories])

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return
    setChecklistItems([...checklistItems, newChecklistItem.trim()])
    setNewChecklistItem('')
  }

  const assetPayload = () => ({
    name: assetForm.name,
    description: assetForm.description || null,
    category_id: assetForm.category_id ? parseInt(assetForm.category_id) : null,
    branch_id: assetForm.branch_id ? parseInt(assetForm.branch_id) : null,
    serial_number: assetForm.serial_number || null,
    model: assetForm.model || null,
    manufacturer: assetForm.manufacturer || null,
    purchase_date: assetForm.purchase_date || null,
    purchase_price: assetForm.purchase_price ? parseFloat(assetForm.purchase_price) : null,
    warranty_expiry: assetForm.warranty_expiry || null,
    location: assetForm.location || null,
    maintenance_interval_days: assetForm.maintenance_interval_days ? parseInt(assetForm.maintenance_interval_days) : null,
    maintenance_checklist: checklistItems.length > 0 ? checklistItems : null,
  })

  const openEditDialog = (asset: Asset) => {
    setSelectedAsset(asset)
    setAssetForm({
      name: asset.name,
      description: asset.description || '',
      category_id: asset.category_id?.toString() || '',
      branch_id: asset.branch_id?.toString() || '',
      serial_number: asset.serial_number || '',
      model: asset.model || '',
      manufacturer: asset.manufacturer || '',
      purchase_date: asset.purchase_date || '',
      purchase_price: asset.purchase_price?.toString() || '',
      warranty_expiry: asset.warranty_expiry || '',
      location: asset.location || '',
      maintenance_interval_days: asset.maintenance_interval_days?.toString() || '',
    })
    setChecklistItems(asset.maintenance_checklist || [])
    setIsEditDialogOpen(true)
  }

  const handleUpdateAsset = () => {
    if (!selectedAsset) return
    updateAssetMutation.mutate({ id: selectedAsset.id, data: assetPayload() })
    setIsEditDialogOpen(false)
  }

  const handleRecordMaintenance = () => {
    if (!selectedAsset) return
    createMaintenanceMutation.mutate({
      asset_id: selectedAsset.id,
      maintenance_type: maintenanceForm.maintenance_type || null,
      description: maintenanceForm.description || null,
      performed_by: maintenanceForm.performed_by || null,
      performed_date: maintenanceForm.performed_date,
      cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : null,
      next_due_date: maintenanceForm.next_due_date || null,
      checklist_completed: maintenanceForm.checklist,
      notes: maintenanceForm.notes || null,
      fund_request_id: maintenanceForm.fund_request_id ? parseInt(maintenanceForm.fund_request_id) : null,
    })
  }

  const openMaintenanceDialog = (asset: Asset) => {
    setSelectedAsset(asset)
    setMaintenanceForm(emptyMaintenanceForm((asset.maintenance_checklist || []).map((item) => ({ item, completed: false }))))
    setIsMaintenanceDialogOpen(true)
  }

  const af = (key: keyof typeof emptyAssetForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setAssetForm({ ...assetForm, [key]: e.target.value })
  const mf = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setMaintenanceForm({ ...maintenanceForm, [key]: e.target.value })

  const optionList = (items: any[], label = (i: any) => i.name) =>
    items.map((i: any) => (
      <option key={i.id} value={i.id.toString()}>
        {label(i)}
      </option>
    ))

  // Shared body for the Add and Edit asset dialogs (edit omits purchase fields, as before)
  const assetFormFields = (isEdit: boolean) => (
    <Stack spacing="16px">
      <SimpleGrid columns={2} spacing="16px">
        <Field label="Asset Name" isRequired>
          <Input variant="main" placeholder={isEdit ? undefined : 'e.g., Autorefractor'} value={assetForm.name} onChange={af('name')} />
        </Field>
        <Field label="Category">
          <Select variant="main" placeholder="Select category" value={assetForm.category_id} onChange={af('category_id')}>
            {optionList(categories)}
          </Select>
        </Field>
        <Field label="Branch" isRequired={!isEdit}>
          <Select variant="main" placeholder="Select branch" value={assetForm.branch_id} onChange={af('branch_id')}>
            {optionList(branches)}
          </Select>
        </Field>
        <Field label="Location">
          <Input variant="main" placeholder={isEdit ? undefined : 'e.g., Exam Room 1'} value={assetForm.location} onChange={af('location')} />
        </Field>
      </SimpleGrid>
      <SimpleGrid columns={3} spacing="16px">
        <Field label="Serial Number">
          <Input variant="main" value={assetForm.serial_number} onChange={af('serial_number')} />
        </Field>
        <Field label="Model">
          <Input variant="main" value={assetForm.model} onChange={af('model')} />
        </Field>
        <Field label="Manufacturer">
          <Input variant="main" value={assetForm.manufacturer} onChange={af('manufacturer')} />
        </Field>
        {!isEdit && (
          <>
            <Field label="Purchase Date">
              <Input variant="main" type="date" value={assetForm.purchase_date} onChange={af('purchase_date')} />
            </Field>
            <Field label="Purchase Price (GH₵)">
              <Input variant="main" type="number" value={assetForm.purchase_price} onChange={af('purchase_price')} />
            </Field>
            <Field label="Warranty Expiry">
              <Input variant="main" type="date" value={assetForm.warranty_expiry} onChange={af('warranty_expiry')} />
            </Field>
          </>
        )}
      </SimpleGrid>
      {!isEdit && (
        <Field label="Description">
          <Textarea variant="main" rows={2} value={assetForm.description} onChange={af('description')} />
        </Field>
      )}
      <SimpleGrid columns={2} spacing="16px">
        <Field label="Maintenance Interval (days)">
          <Input variant="main" type="number" placeholder={isEdit ? undefined : 'e.g., 90'} value={assetForm.maintenance_interval_days} onChange={af('maintenance_interval_days')} />
        </Field>
        {isEdit && (
          <Field label="Warranty Expiry">
            <Input variant="main" type="date" value={assetForm.warranty_expiry} onChange={af('warranty_expiry')} />
          </Field>
        )}
      </SimpleGrid>
      {isEdit && (
        <Field label="Description">
          <Textarea variant="main" rows={2} value={assetForm.description} onChange={af('description')} />
        </Field>
      )}
      <Field
        label="Maintenance Checklist"
        helper={
          isEdit
            ? undefined
            : assetForm.category_id
              ? 'Loaded from category. Add or remove items as needed.'
              : 'Select a category to load default checklist, or add items manually.'
        }
      >
        <Stack spacing="8px" border="1px solid" borderColor={borderColor} borderRadius="12px" p="12px" maxH="192px" overflowY="auto" mb="8px">
          {checklistItems.length === 0 ? (
            <Text fontSize="sm" color="secondaryGray.600" textAlign="center" py="8px">
              No checklist items
            </Text>
          ) : (
            checklistItems.map((item, index) => (
              <Flex key={index} align="center" justify="space-between" gap="8px" bg={thumbBg} borderRadius="8px" px="8px" py="4px">
                <Text fontSize="sm">{item}</Text>
                <IconButton
                  aria-label="Remove item"
                  variant="ghost"
                  size="xs"
                  icon={<MdClose />}
                  onClick={() => setChecklistItems(checklistItems.filter((_, i) => i !== index))}
                />
              </Flex>
            ))
          )}
        </Stack>
        <Flex gap="8px">
          <Input
            variant="main"
            placeholder="Add checklist item..."
            value={newChecklistItem}
            onChange={(e) => setNewChecklistItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addChecklistItem()
              }
            }}
          />
          <IconButton aria-label="Add checklist item" variant="light" icon={<MdAdd />} onClick={addChecklistItem} />
        </Flex>
      </Field>
    </Stack>
  )

  const detail = (label: string, value: React.ReactNode) => (
    <Box>
      <Text fontSize="sm" color="secondaryGray.600">
        {label}
      </Text>
      <Box>{value}</Box>
    </Box>
  )

  const thumbnail = (asset: Asset, size: string, iconSize: string) => (
    <Flex w={size} h={size} bg={thumbBg} borderRadius="8px" overflow="hidden" align="center" justify="center">
      {asset.image_url ? (
        <Image src={asset.image_url} alt={asset.name} w="100%" h="100%" objectFit="cover" />
      ) : (
        <Icon as={MdCameraAlt} w={iconSize} h={iconSize} color="secondaryGray.600" />
      )}
    </Flex>
  )

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate('/inventory')} mb="8px">
        Back
      </Button>
      <PageHeader
        title="Assets Management"
        actions={
          <Button variant="brand" leftIcon={<MdAdd />} onClick={() => setIsAddDialogOpen(true)}>
            Add Asset
          </Button>
        }
      />

      {/* Summary Cards */}
      <SimpleGrid columns={{ base: 1, md: 3, xl: 5 }} spacing="20px" mb="20px">
        <StatCard name="Total Assets" value={healthReport?.total_assets || 0} />
        <StatCard name="Active" value={healthReport?.by_status?.active || 0} valueColor="green.500" />
        <StatCard name="Faulty" value={healthReport?.by_status?.faulty || 0} valueColor="red.500" />
        <StatCard name="Maintenance Due" value={healthReport?.maintenance_due || 0} icon={MdWarningAmber} iconColor="yellow.500" valueColor="yellow.600" />
        <StatCard name="Warranty Expiring" value={healthReport?.warranty_expiring_soon || 0} valueColor="orange.500" />
      </SimpleGrid>

      <Tabs variant="soft-rounded" index={TABS.indexOf(activeTab)} onChange={(i) => setActiveTab(TABS[i])}>
        <TabList gap="8px" mb="16px" flexWrap="wrap">
          <Tab>All Assets</Tab>
          <Tab>Maintenance Due</Tab>
          <Tab>Technicians</Tab>
        </TabList>

        <TabPanels>
          <TabPanel p="0">
            <Card>
              {/* Filters */}
              <Flex gap="12px" mb="16px" wrap="wrap">
                <SearchInput placeholder="Search assets..." value={search} onChange={setSearch} />
                <Select variant="main" w="160px" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Status</option>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                <Select variant="main" w="160px" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                  <option value="all">All Branches</option>
                  {optionList(branches)}
                </Select>
              </Flex>

              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Image</Th>
                      <Th>Asset Tag</Th>
                      <Th>Name</Th>
                      <Th>Category</Th>
                      <Th>Branch</Th>
                      <Th>Status</Th>
                      <Th>Condition</Th>
                      <Th>Last Maintenance</Th>
                      <Th>Next Maintenance</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {isLoading ? (
                      <TableMessageRow colSpan={10} loading />
                    ) : assets.length === 0 ? (
                      <TableMessageRow colSpan={10}>No assets found</TableMessageRow>
                    ) : (
                      assets.map((asset: Asset) => (
                        <Tr
                          key={asset.id}
                          cursor="pointer"
                          _hover={{ bg: hoverBg }}
                          onClick={() => {
                            setSelectedAsset(asset)
                            setIsDetailDialogOpen(true)
                          }}
                        >
                          <Td>{thumbnail(asset, '48px', '20px')}</Td>
                          <Td fontFamily="mono">{asset.asset_tag}</Td>
                          <Td fontWeight="600">{asset.name}</Td>
                          <Td>{asset.category?.name || '-'}</Td>
                          <Td>{asset.branch?.name || '-'}</Td>
                          <Td>{statusBadge(asset.status)}</Td>
                          <Td>{conditionBadge(asset.condition)}</Td>
                          <Td>{asset.last_maintenance_date ? new Date(asset.last_maintenance_date).toLocaleDateString() : '-'}</Td>
                          <Td color={isOverdue(asset.next_maintenance_date) ? 'red.500' : undefined} fontWeight={isOverdue(asset.next_maintenance_date) ? '500' : undefined}>
                            {asset.next_maintenance_date ? new Date(asset.next_maintenance_date).toLocaleDateString() : '-'}
                          </Td>
                          <Td>
                            <IconButton
                              aria-label="Record maintenance"
                              variant="light"
                              size="sm"
                              icon={<MdBuild />}
                              onClick={(e) => {
                                e.stopPropagation()
                                openMaintenanceDialog(asset)
                              }}
                            />
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
                      <Th>Asset Tag</Th>
                      <Th>Asset Name</Th>
                      <Th>Branch</Th>
                      <Th>Last Maintenance</Th>
                      <Th>Due Date</Th>
                      <Th>Days Overdue</Th>
                      <Th>Status</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {maintenanceDue.length === 0 ? (
                      <TableMessageRow colSpan={8}>No maintenance due</TableMessageRow>
                    ) : (
                      maintenanceDue.map((item: any) => (
                        <Tr key={item.asset_id}>
                          <Td fontFamily="mono">{item.asset_tag}</Td>
                          <Td fontWeight="600">{item.asset_name}</Td>
                          <Td>{item.branch_name || '-'}</Td>
                          <Td>{item.last_maintenance ? new Date(item.last_maintenance).toLocaleDateString() : 'Never'}</Td>
                          <Td>{item.next_maintenance ? new Date(item.next_maintenance).toLocaleDateString() : '-'}</Td>
                          <Td>{item.days_overdue ? <Badge colorScheme="red">{item.days_overdue} days</Badge> : <Badge variant="outline">Upcoming</Badge>}</Td>
                          <Td>{statusBadge(item.status)}</Td>
                          <Td>
                            <Button
                              variant="brand"
                              size="sm"
                              leftIcon={<MdBuild />}
                              onClick={() => {
                                const asset = assets.find((a: Asset) => a.id === item.asset_id)
                                if (asset) openMaintenanceDialog(asset)
                              }}
                            >
                              Maintain
                            </Button>
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
              <Flex justify="space-between" align="center" mb="16px">
                <Heading size="md">Maintenance Technicians</Heading>
                <Button variant="brand" leftIcon={<MdPersonAdd />} onClick={() => setIsAddTechnicianOpen(true)}>
                  Add Technician
                </Button>
              </Flex>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Phone</Th>
                      <Th>Email</Th>
                      <Th>Company</Th>
                      <Th>Specialization</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {technicians.length === 0 ? (
                      <TableMessageRow colSpan={6}>No technicians added yet</TableMessageRow>
                    ) : (
                      technicians.map((tech: any) => (
                        <Tr key={tech.id}>
                          <Td fontWeight="600">{tech.name}</Td>
                          <Td>{tech.phone || '-'}</Td>
                          <Td>{tech.email || '-'}</Td>
                          <Td>{tech.company || '-'}</Td>
                          <Td>{tech.specialization || '-'}</Td>
                          <Td>
                            <Badge colorScheme={tech.is_active ? 'brand' : 'gray'}>{tech.is_active ? 'Active' : 'Inactive'}</Badge>
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

      {/* Add Asset Dialog */}
      <AppModal
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        size="2xl"
        title="Add New Asset"
        footer={
          <>
            <Button variant="light" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => createAssetMutation.mutate(assetPayload())} isDisabled={!assetForm.name} isLoading={createAssetMutation.isPending}>
              Create Asset
            </Button>
          </>
        }
      >
        {assetFormFields(false)}
      </AppModal>

      {/* Edit Asset Dialog */}
      <AppModal
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        size="2xl"
        title={`Edit Asset - ${selectedAsset?.asset_tag || ''}`}
        footer={
          <>
            <Button variant="light" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleUpdateAsset} isDisabled={!assetForm.name}>
              Save Changes
            </Button>
          </>
        }
      >
        {assetFormFields(true)}
      </AppModal>

      {/* Maintenance Dialog */}
      <AppModal
        isOpen={isMaintenanceDialogOpen}
        onClose={() => setIsMaintenanceDialogOpen(false)}
        size="lg"
        title={`Record Maintenance - ${selectedAsset?.name || ''}`}
        footer={
          <>
            <Button variant="light" onClick={() => setIsMaintenanceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={handleRecordMaintenance}
              isDisabled={!maintenanceForm.maintenance_type || !maintenanceForm.performed_date || !maintenanceForm.technician_id}
              isLoading={createMaintenanceMutation.isPending}
            >
              Record Maintenance
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <SimpleGrid columns={2} spacing="16px">
            <Field label="Maintenance Type">
              <Select variant="main" placeholder="Select type" value={maintenanceForm.maintenance_type} onChange={mf('maintenance_type')}>
                <option value="routine">Routine</option>
                <option value="repair">Repair</option>
                <option value="calibration">Calibration</option>
                <option value="inspection">Inspection</option>
                <option value="cleaning">Cleaning</option>
              </Select>
            </Field>
            <Field label="Performed Date" isRequired>
              <Input variant="main" type="date" value={maintenanceForm.performed_date} onChange={mf('performed_date')} />
            </Field>
          </SimpleGrid>

          <Field label="Technician" isRequired helper={technicians.length === 0 ? 'No technicians yet. Click + to add one.' : undefined}>
            <Flex gap="8px">
              <Select
                variant="main"
                flex="1"
                placeholder="Select technician"
                value={maintenanceForm.technician_id}
                onChange={(e) => {
                  const tech = technicians.find((t: any) => t.id.toString() === e.target.value)
                  setMaintenanceForm({ ...maintenanceForm, technician_id: e.target.value, performed_by: tech?.name || '' })
                }}
              >
                {optionList(technicians, (t) => `${t.name} ${t.company ? `(${t.company})` : ''}`)}
              </Select>
              <IconButton aria-label="Add technician" variant="light" icon={<MdPersonAdd />} onClick={() => setIsAddTechnicianOpen(true)} />
            </Flex>
          </Field>

          <SimpleGrid columns={2} spacing="16px">
            <Field label="Cost (GH₵)" helper={!maintenanceForm.fund_request_id ? 'Will be recorded as expense' : undefined}>
              <Input variant="main" type="number" placeholder="0.00" value={maintenanceForm.cost} onChange={mf('cost')} />
            </Field>
            <Field label="Next Due Date">
              <Input variant="main" type="date" value={maintenanceForm.next_due_date} onChange={mf('next_due_date')} />
            </Field>
          </SimpleGrid>

          {/* Fund Request Link - to prevent double expense logging */}
          <Field label="Paid via Memo? (Optional)">
            <Select variant="main" value={maintenanceForm.fund_request_id} onChange={mf('fund_request_id')}>
              <option value="">None - Record as new expense</option>
              {receivedFundRequests.map((fr: any) => (
                <option key={fr.id} value={fr.id.toString()}>
                  {fr.title} - GH₵{fr.amount}
                </option>
              ))}
            </Select>
            {maintenanceForm.fund_request_id && (
              <Text fontSize="xs" color="green.500" mt="4px">
                ✓ Linked to memo - expense already recorded, no duplicate will be created
              </Text>
            )}
            {!maintenanceForm.fund_request_id && receivedFundRequests.length > 0 && (
              <Text fontSize="xs" color="secondaryGray.600" mt="4px">
                If this maintenance was paid using a memo, select it to avoid double expense logging
              </Text>
            )}
          </Field>

          {maintenanceForm.checklist.length > 0 && (
            <Field label="Maintenance Checklist">
              <Stack spacing="8px" border="1px solid" borderColor={borderColor} borderRadius="12px" p="12px">
                {maintenanceForm.checklist.map((item, index) => (
                  <Checkbox
                    key={index}
                    isChecked={item.completed}
                    onChange={(e) =>
                      setMaintenanceForm({
                        ...maintenanceForm,
                        checklist: maintenanceForm.checklist.map((c, i) => (i === index ? { ...c, completed: e.target.checked } : c)),
                      })
                    }
                  >
                    <Text fontSize="sm">{item.item}</Text>
                  </Checkbox>
                ))}
              </Stack>
            </Field>
          )}

          <Field label="Description">
            <Textarea variant="main" rows={2} value={maintenanceForm.description} onChange={mf('description')} />
          </Field>
          <Field label="Notes">
            <Textarea variant="main" rows={2} value={maintenanceForm.notes} onChange={mf('notes')} />
          </Field>
        </Stack>
      </AppModal>

      {/* Asset Detail Dialog */}
      <AppModal
        isOpen={isDetailDialogOpen}
        onClose={() => setIsDetailDialogOpen(false)}
        size="4xl"
        title={
          <Flex align="center" gap="8px">
            {selectedAsset?.name}
            <Text as="span" fontSize="sm" fontFamily="mono" fontWeight="normal" color="secondaryGray.600">
              ({selectedAsset?.asset_tag})
            </Text>
          </Flex>
        }
        footer={
          <Flex justify="space-between" w="100%">
            <Button colorScheme="red" size="sm" leftIcon={<MdDelete />} onClick={() => setIsDeleteConfirmOpen(true)}>
              Delete
            </Button>
            <Flex gap="8px">
              <Button
                variant="light"
                size="sm"
                leftIcon={<MdEdit />}
                onClick={() => {
                  setIsDetailDialogOpen(false)
                  if (selectedAsset) openEditDialog(selectedAsset)
                }}
              >
                Edit
              </Button>
              <Button
                variant="brand"
                size="sm"
                leftIcon={<MdBuild />}
                onClick={() => {
                  setIsDetailDialogOpen(false)
                  if (selectedAsset) openMaintenanceDialog(selectedAsset)
                }}
              >
                Maintain
              </Button>
            </Flex>
          </Flex>
        }
      >
        {selectedAsset && (
          <Stack spacing="24px">
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing="16px">
              <Box>
                <Box sx={{ aspectRatio: '1 / 1' }}>{thumbnail(selectedAsset, '100%', '48px')}</Box>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadImageMutation.mutate({ assetId: selectedAsset.id, file })
                  }}
                />
                <Button variant="light" size="sm" w="100%" mt="8px" leftIcon={<MdCameraAlt />} onClick={() => imageInputRef.current?.click()} isLoading={uploadImageMutation.isPending}>
                  Upload Image
                </Button>
              </Box>
              <GridItem colSpan={{ base: 1, md: 2 }}>
                <Stack spacing="16px">
                  <SimpleGrid columns={2} spacing="16px">
                    {detail('Branch', selectedAsset.branch?.name || '-')}
                    {detail('Category', selectedAsset.category?.name || '-')}
                    {detail('Location', selectedAsset.location || '-')}
                    {detail('Serial Number', selectedAsset.serial_number || '-')}
                    {detail('Model', selectedAsset.model || '-')}
                    {detail('Manufacturer', selectedAsset.manufacturer || '-')}
                    {detail('Last Maintenance', selectedAsset.last_maintenance_date ? new Date(selectedAsset.last_maintenance_date).toLocaleDateString() : 'Never')}
                    {detail(
                      'Next Maintenance',
                      <Text color={isOverdue(selectedAsset.next_maintenance_date) ? 'red.500' : undefined} fontWeight={isOverdue(selectedAsset.next_maintenance_date) ? '500' : undefined}>
                        {selectedAsset.next_maintenance_date ? new Date(selectedAsset.next_maintenance_date).toLocaleDateString() : '-'}
                      </Text>,
                    )}
                  </SimpleGrid>
                  <Flex gap="16px">
                    {detail('Status', <Box mt="4px">{statusBadge(selectedAsset.status)}</Box>)}
                    {detail('Condition', <Box mt="4px">{conditionBadge(selectedAsset.condition)}</Box>)}
                  </Flex>
                  <SimpleGrid columns={2} spacing="16px">
                    <Field label="Change Status">
                      <Select variant="main" value={selectedAsset.status} onChange={(e) => updateAssetMutation.mutate({ id: selectedAsset.id, data: { status: e.target.value } })}>
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Change Condition">
                      <Select variant="main" value={selectedAsset.condition} onChange={(e) => updateAssetMutation.mutate({ id: selectedAsset.id, data: { condition: e.target.value } })}>
                        {CONDITION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </SimpleGrid>
                </Stack>
              </GridItem>
            </SimpleGrid>

            {/* Maintenance Checklist */}
            {selectedAsset.maintenance_checklist && selectedAsset.maintenance_checklist.length > 0 && (
              <Box>
                <Flex align="center" gap="8px" fontWeight="600" mb="8px">
                  <Icon as={MdCheck} />
                  Maintenance Checklist ({selectedAsset.maintenance_checklist.length} items)
                </Flex>
                <SimpleGrid columns={2} spacing="8px" border="1px solid" borderColor={borderColor} borderRadius="12px" p="12px">
                  {selectedAsset.maintenance_checklist.map((item, index) => (
                    <Flex key={index} align="center" gap="8px" fontSize="sm">
                      <Box h="16px" w="16px" borderRadius="4px" border="1px solid" borderColor="secondaryGray.500" flexShrink={0} />
                      <Text>{item}</Text>
                    </Flex>
                  ))}
                </SimpleGrid>
              </Box>
            )}

            {/* Maintenance History */}
            <Box>
              <Text fontWeight="600" mb="8px">
                Maintenance History
              </Text>
              <TableBox>
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th>Performed By</Th>
                      <Th>Cost</Th>
                      <Th>Checklist</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {maintenanceLogs.length === 0 ? (
                      <TableMessageRow colSpan={6}>No maintenance records</TableMessageRow>
                    ) : (
                      maintenanceLogs.map((log: MaintenanceLog) => {
                        const completedCount = log.checklist_completed?.filter((c) => c.completed).length || 0
                        const totalCount = log.checklist_completed?.length || 0
                        return (
                          <Tr key={log.id}>
                            <Td>{new Date(log.performed_date).toLocaleDateString()}</Td>
                            <Td textTransform="capitalize">{log.maintenance_type || '-'}</Td>
                            <Td>{log.performed_by || '-'}</Td>
                            <Td>{log.cost ? `GH₵${log.cost.toLocaleString()}` : '-'}</Td>
                            <Td>
                              {totalCount > 0 ? (
                                <Badge colorScheme={completedCount === totalCount ? 'brand' : 'gray'}>
                                  {completedCount}/{totalCount}
                                </Badge>
                              ) : (
                                '-'
                              )}
                            </Td>
                            <Td>
                              <Badge colorScheme={log.status === 'completed' ? 'brand' : 'gray'}>{log.status}</Badge>
                            </Td>
                          </Tr>
                        )
                      })
                    )}
                  </Tbody>
                </Table>
              </TableBox>
            </Box>
          </Stack>
        )}
      </AppModal>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => {
          if (selectedAsset) deleteAssetMutation.mutate(selectedAsset.id)
          setIsDeleteConfirmOpen(false)
        }}
        title="Delete Asset"
        confirmLabel="Delete Asset"
      >
        Are you sure you want to delete <strong>{selectedAsset?.name}</strong>? This action cannot be undone.
      </ConfirmDialog>

      {/* Add Technician Dialog */}
      <AppModal
        isOpen={isAddTechnicianOpen}
        onClose={() => setIsAddTechnicianOpen(false)}
        title="Add Technician"
        footer={
          <>
            <Button variant="light" onClick={() => setIsAddTechnicianOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => createTechnicianMutation.mutate(technicianForm)} isDisabled={!technicianForm.name} isLoading={createTechnicianMutation.isPending}>
              Add Technician
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Name" isRequired>
            <Input variant="main" placeholder="Technician name" value={technicianForm.name} onChange={(e) => setTechnicianForm({ ...technicianForm, name: e.target.value })} />
          </Field>
          <SimpleGrid columns={2} spacing="16px">
            <Field label="Phone">
              <Input variant="main" value={technicianForm.phone} onChange={(e) => setTechnicianForm({ ...technicianForm, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input variant="main" type="email" value={technicianForm.email} onChange={(e) => setTechnicianForm({ ...technicianForm, email: e.target.value })} />
            </Field>
          </SimpleGrid>
          <Field label="Company">
            <Input variant="main" value={technicianForm.company} onChange={(e) => setTechnicianForm({ ...technicianForm, company: e.target.value })} />
          </Field>
          <Field label="Specialization">
            <Input
              variant="main"
              placeholder="e.g., Medical Equipment, HVAC"
              value={technicianForm.specialization}
              onChange={(e) => setTechnicianForm({ ...technicianForm, specialization: e.target.value })}
            />
          </Field>
        </Stack>
      </AppModal>
    </>
  )
}
