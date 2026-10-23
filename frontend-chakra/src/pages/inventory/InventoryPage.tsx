import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Flex,
  Icon,
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
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react'
import { MdAdd, MdBuild, MdInventory2, MdLocalShipping, MdShoppingBag, MdWarningAmber } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { RowBox } from '@/components/dashboard/widgets'
import { AppModal, Field, TableBox, TableMessageRow } from '@/components/ui'

const TABS = ['warehouses', 'products', 'imports', 'vendors', 'transfers', 'alerts']

const emptyWarehouse = { name: '', location: '', contact_person: '', contact_phone: '' }
const emptyImport = { warehouse_id: '', vendor_id: '', supplier_name: '', reference_number: '', expected_date: '', notes: '' }
const emptyVendor = { name: '', contact_person: '', email: '', phone: '', address: '', notes: '' }

const activeBadge = (active: boolean) => <Badge colorScheme={active ? 'green' : 'gray'}>{active ? 'Active' : 'Inactive'}</Badge>

export default function InventoryPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const defaultIndex = Math.max(0, TABS.indexOf(searchParams.get('tab') || 'warehouses'))

  const [isWarehouseDialogOpen, setIsWarehouseDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false)
  const [warehouseForm, setWarehouseForm] = useState(emptyWarehouse)
  const [importForm, setImportForm] = useState(emptyImport)
  const [vendorForm, setVendorForm] = useState(emptyVendor)

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => (await api.get('/inventory/warehouses')).data,
  })

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers'],
    queryFn: async () => (await api.get('/inventory/transfers')).data,
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['stock-alerts'],
    queryFn: async () => (await api.get('/inventory/alerts')).data,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['inventory-products'],
    queryFn: async () => (await api.get('/sales/products')).data,
  })

  const { data: imports = [] } = useQuery({
    queryKey: ['imports'],
    queryFn: async () => (await api.get('/inventory/imports')).data,
  })

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => (await api.get('/inventory/vendors')).data,
  })

  const { data: pendingArrivals = [] } = useQuery({
    queryKey: ['pending-arrivals'],
    queryFn: async () => (await api.get('/inventory/imports/pending-arrival')).data,
  })

  const createWarehouseMutation = useMutation({
    mutationFn: (data: typeof warehouseForm) => api.post('/inventory/warehouses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      setIsWarehouseDialogOpen(false)
      setWarehouseForm(emptyWarehouse)
      toast({ title: 'Warehouse created successfully' })
    },
  })

  const createImportMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/imports', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imports'] })
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      setIsImportDialogOpen(false)
      setImportForm(emptyImport)
      toast({ title: 'Import scheduled successfully' })
    },
    onError: () => toast({ title: 'Failed to create import', variant: 'destructive' }),
  })

  const createVendorMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/vendors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      setIsVendorDialogOpen(false)
      setVendorForm(emptyVendor)
      toast({ title: 'Vendor created successfully' })
    },
    onError: () => toast({ title: 'Failed to create vendor', variant: 'destructive' }),
  })

  const transferAction = async (transferId: number, action: 'approve' | 'complete') => {
    try {
      await api.put(`/inventory/transfers/${transferId}/${action}`)
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      toast({ title: action === 'approve' ? 'Transfer approved' : 'Transfer completed' })
    } catch {
      toast({ title: action === 'approve' ? 'Failed to approve' : 'Failed to complete', variant: 'destructive' })
    }
  }

  const clickableRow = (onClick: () => void) => ({ cursor: 'pointer', _hover: { bg: hoverBg }, onClick })
  const toolbar = (children: React.ReactNode, justify = 'end') => (
    <Flex justify={justify} gap="8px" mb="16px" wrap="wrap">
      {children}
    </Flex>
  )

  return (
    <>
      <PageHeader title="Inventory Management" />

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="20px" mb="20px" data-tour="stock-levels">
        <StatCard name="Warehouses" value={warehouses.length} icon={MdInventory2} iconColor="secondaryGray.600" />
        <StatCard name="Pending Transfers" value={transfers.filter((t: any) => t.status === 'pending').length} icon={MdLocalShipping} iconColor="secondaryGray.600" />
        <Box data-tour="low-stock">
          <StatCard name="Stock Alerts" value={alerts.length} icon={MdWarningAmber} iconColor="red.500" valueColor="red.500" />
        </Box>
      </SimpleGrid>

      <Tabs variant="soft-rounded" defaultIndex={defaultIndex} data-tour="transfer">
        <TabList gap="8px" flexWrap="wrap" mb="16px">
          <Tab>Warehouses</Tab>
          <Tab>Products</Tab>
          <Tab>Imports</Tab>
          <Tab>Vendors</Tab>
          <Tab>Transfers</Tab>
          <Tab>Alerts</Tab>
        </TabList>

        <TabPanels>
          {/* Warehouses */}
          <TabPanel p="0">
            <Card>
              {toolbar(
                <Button variant="brand" leftIcon={<MdAdd />} onClick={() => setIsWarehouseDialogOpen(true)}>
                  Add Warehouse
                </Button>,
              )}
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Location</Th>
                      <Th>Contact Person</Th>
                      <Th>Phone</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {warehouses.length === 0 ? (
                      <TableMessageRow colSpan={5}>No warehouses found</TableMessageRow>
                    ) : (
                      warehouses.map((warehouse: any) => (
                        <Tr key={warehouse.id} {...clickableRow(() => navigate(`/inventory/warehouse/${warehouse.id}`))}>
                          <Td fontWeight="600">{warehouse.name}</Td>
                          <Td>{warehouse.location || '-'}</Td>
                          <Td>{warehouse.contact_person || '-'}</Td>
                          <Td>{warehouse.contact_phone || '-'}</Td>
                          <Td>{activeBadge(warehouse.is_active)}</Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>

          {/* Products */}
          <TabPanel p="0">
            <Card>
              {toolbar(
                <>
                  <Flex gap="8px" wrap="wrap">
                    <Button variant="light" leftIcon={<MdShoppingBag />} onClick={() => navigate('/inventory/products')}>
                      View All Products
                    </Button>
                    <Button variant="light" leftIcon={<MdBuild />} onClick={() => navigate('/inventory/assets')}>
                      Manage Assets
                    </Button>
                  </Flex>
                  <Button variant="brand" leftIcon={<MdAdd />} onClick={() => navigate('/inventory/products/new')}>
                    Add Product
                  </Button>
                </>,
                'space-between',
              )}
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>SKU</Th>
                      <Th>Name</Th>
                      <Th>Category</Th>
                      <Th>Cost Price</Th>
                      <Th>Sale Price</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {products.length === 0 ? (
                      <TableMessageRow colSpan={6}>No products found</TableMessageRow>
                    ) : (
                      products.slice(0, 10).map((product: any) => (
                        <Tr key={product.id} {...clickableRow(() => navigate(`/inventory/products/${product.id}`))}>
                          <Td fontFamily="mono">{product.sku}</Td>
                          <Td fontWeight="600">{product.name}</Td>
                          <Td>{product.category?.name || '-'}</Td>
                          <Td>GH₵{product.cost_price?.toLocaleString() || '0'}</Td>
                          <Td>GH₵{product.unit_price?.toLocaleString() || '0'}</Td>
                          <Td>{activeBadge(product.is_active)}</Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
              {products.length > 10 && (
                <Flex justify="center" mt="16px">
                  <Button variant="link" color="brand.500" onClick={() => navigate('/inventory/products')}>
                    View all {products.length} products →
                  </Button>
                </Flex>
              )}
            </Card>
          </TabPanel>

          {/* Imports */}
          <TabPanel p="0">
            <Stack spacing="16px">
              {pendingArrivals.length > 0 && (
                <SectionCard
                  title={
                    <Flex align="center" gap="8px" color="orange.500">
                      <Icon as={MdWarningAmber} />
                      Pending Arrivals ({pendingArrivals.length})
                    </Flex>
                  }
                  border="1px solid"
                  borderColor="orange.200"
                >
                  <Stack spacing="8px">
                    {pendingArrivals.slice(0, 3).map((imp: any) => (
                      <RowBox key={imp.id} p="8px 12px">
                        <Box>
                          <Text as="span" fontWeight="500">
                            {imp.reference_number || `Import #${imp.id}`}
                          </Text>
                          <Text as="span" fontSize="sm" color="secondaryGray.600" ms="8px">
                            from {imp.vendor?.name || imp.supplier_name || 'Unknown'}
                          </Text>
                        </Box>
                        <Badge colorScheme="yellow">{imp.days_overdue} days overdue</Badge>
                      </RowBox>
                    ))}
                  </Stack>
                </SectionCard>
              )}
              <Card>
                {toolbar(
                  <Button variant="brand" leftIcon={<MdAdd />} onClick={() => setIsImportDialogOpen(true)}>
                    Schedule Import
                  </Button>,
                )}
                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Reference</Th>
                        <Th>Vendor</Th>
                        <Th>Warehouse</Th>
                        <Th>Expected Date</Th>
                        <Th>Total Cost</Th>
                        <Th>Status</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {imports.length === 0 ? (
                        <TableMessageRow colSpan={6}>No imports found</TableMessageRow>
                      ) : (
                        imports.map((imp: any) => (
                          <Tr key={imp.id} {...clickableRow(() => navigate(`/inventory/imports/${imp.id}`))}>
                            <Td fontWeight="600">{imp.reference_number || `#${imp.id}`}</Td>
                            <Td>{imp.supplier_name || '-'}</Td>
                            <Td>Warehouse #{imp.warehouse_id}</Td>
                            <Td>{imp.expected_date ? new Date(imp.expected_date).toLocaleDateString() : '-'}</Td>
                            <Td>GH₵{imp.total_cost?.toLocaleString() || '0'}</Td>
                            <Td>
                              <Badge colorScheme={imp.status === 'received' ? 'green' : imp.status === 'pending' ? 'yellow' : 'gray'}>{String(imp.status ?? '').replace(/_/g, ' ')}</Badge>
                            </Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </Card>
            </Stack>
          </TabPanel>

          {/* Vendors */}
          <TabPanel p="0">
            <Card>
              {toolbar(
                <Button variant="brand" leftIcon={<MdAdd />} onClick={() => setIsVendorDialogOpen(true)}>
                  Add Vendor
                </Button>,
              )}
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Contact Person</Th>
                      <Th>Phone</Th>
                      <Th>Email</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {vendors.length === 0 ? (
                      <TableMessageRow colSpan={5}>No vendors found</TableMessageRow>
                    ) : (
                      vendors.map((vendor: any) => (
                        <Tr key={vendor.id}>
                          <Td fontWeight="600">{vendor.name}</Td>
                          <Td>{vendor.contact_person || '-'}</Td>
                          <Td>{vendor.phone || '-'}</Td>
                          <Td>{vendor.email || '-'}</Td>
                          <Td>{activeBadge(vendor.is_active)}</Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>

          {/* Transfers */}
          <TabPanel p="0">
            <Card>
              {toolbar(
                <Button variant="brand" leftIcon={<MdAdd />} onClick={() => navigate('/inventory/transfers/new')}>
                  Create Transfer
                </Button>,
              )}
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>ID</Th>
                      <Th>From Warehouse</Th>
                      <Th>To Branch</Th>
                      <Th>Request Date</Th>
                      <Th>Status</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {transfers.length === 0 ? (
                      <TableMessageRow colSpan={6}>No transfers found</TableMessageRow>
                    ) : (
                      transfers.map((transfer: any) => (
                        <Tr key={transfer.id}>
                          <Td fontWeight="600">#{transfer.id}</Td>
                          <Td>Warehouse #{transfer.from_warehouse_id}</Td>
                          <Td>Branch #{transfer.to_branch_id}</Td>
                          <Td>{new Date(transfer.request_date).toLocaleDateString()}</Td>
                          <Td>
                            <Badge colorScheme={transfer.status === 'completed' ? 'green' : transfer.status === 'approved' ? 'yellow' : 'gray'}>
                              {String(transfer.status ?? '').replace(/_/g, ' ')}
                            </Badge>
                          </Td>
                          <Td>
                            {transfer.status === 'pending' && (
                              <Button size="sm" variant="light" onClick={() => transferAction(transfer.id, 'approve')}>
                                Approve
                              </Button>
                            )}
                            {transfer.status === 'approved' && (
                              <Button size="sm" variant="brand" onClick={() => transferAction(transfer.id, 'complete')}>
                                Confirm Receipt
                              </Button>
                            )}
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Card>
          </TabPanel>

          {/* Alerts */}
          <TabPanel p="0">
            <Stack spacing="16px">
              {pendingArrivals.length > 0 && (
                <SectionCard
                  title={
                    <Flex align="center" gap="8px" color="blue.500">
                      <Icon as={MdLocalShipping} />
                      Expected Imports Today ({pendingArrivals.length})
                    </Flex>
                  }
                  border="1px solid"
                  borderColor="blue.200"
                >
                  <Stack spacing="8px">
                    {pendingArrivals.map((imp: any) => (
                      <RowBox key={imp.id} {...clickableRow(() => navigate(`/inventory/imports/${imp.id}`))}>
                        <Box>
                          <Text as="span" fontWeight="500">
                            {imp.reference_number || `Import #${imp.id}`}
                          </Text>
                          <Text as="span" fontSize="sm" color="secondaryGray.600" ms="8px">
                            from {imp.vendor?.name || imp.supplier_name || 'Unknown'}
                          </Text>
                        </Box>
                        <Flex align="center" gap="8px">
                          <Text fontSize="sm">GH₵{imp.total_cost?.toLocaleString() || '0'}</Text>
                          {imp.days_overdue > 0 ? (
                            <Badge colorScheme="red">{imp.days_overdue} days overdue</Badge>
                          ) : (
                            <Badge colorScheme="yellow">Due today</Badge>
                          )}
                        </Flex>
                      </RowBox>
                    ))}
                  </Stack>
                </SectionCard>
              )}

              <SectionCard
                title={
                  <Flex align="center" gap="8px">
                    <Icon as={MdWarningAmber} color="red.500" />
                    Low Stock Alerts ({alerts.length})
                  </Flex>
                }
              >
                <TableBox>
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Product</Th>
                        <Th>Location</Th>
                        <Th>Current Qty</Th>
                        <Th>Min Qty</Th>
                        <Th>Alert Type</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {alerts.length === 0 ? (
                        <TableMessageRow colSpan={5}>No low stock alerts</TableMessageRow>
                      ) : (
                        alerts.map((alert: any) => (
                          <Tr key={alert.id}>
                            <Td fontWeight="600">Product #{alert.product_id}</Td>
                            <Td>{alert.branch_id ? `Branch #${alert.branch_id}` : `Warehouse #${alert.warehouse_id}`}</Td>
                            <Td>{alert.current_quantity}</Td>
                            <Td>{alert.min_quantity}</Td>
                            <Td>
                              <Badge colorScheme="red">{alert.alert_type}</Badge>
                            </Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </TableBox>
              </SectionCard>
            </Stack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Warehouse Dialog */}
      <AppModal
        isOpen={isWarehouseDialogOpen}
        onClose={() => setIsWarehouseDialogOpen(false)}
        title="Add Warehouse"
        footer={
          <>
            <Button variant="light" onClick={() => setIsWarehouseDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="warehouse-form" variant="brand" isLoading={createWarehouseMutation.isPending} loadingText="Creating...">
              Create
            </Button>
          </>
        }
      >
        <form
          id="warehouse-form"
          onSubmit={(e) => {
            e.preventDefault()
            createWarehouseMutation.mutate(warehouseForm)
          }}
        >
          <Stack spacing="16px">
            <Field label="Name" isRequired>
              <Input variant="main" value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} />
            </Field>
            <Field label="Location">
              <Input variant="main" value={warehouseForm.location} onChange={(e) => setWarehouseForm({ ...warehouseForm, location: e.target.value })} />
            </Field>
            <Field label="Contact Person">
              <Input variant="main" value={warehouseForm.contact_person} onChange={(e) => setWarehouseForm({ ...warehouseForm, contact_person: e.target.value })} />
            </Field>
            <Field label="Contact Phone">
              <Input variant="main" value={warehouseForm.contact_phone} onChange={(e) => setWarehouseForm({ ...warehouseForm, contact_phone: e.target.value })} />
            </Field>
          </Stack>
        </form>
      </AppModal>

      {/* Import Dialog */}
      <AppModal
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        title="Schedule Import"
        footer={
          <>
            <Button variant="light" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              isDisabled={!importForm.warehouse_id}
              isLoading={createImportMutation.isPending}
              loadingText="Scheduling..."
              onClick={() =>
                createImportMutation.mutate({
                  warehouse_id: parseInt(importForm.warehouse_id),
                  vendor_id: importForm.vendor_id ? parseInt(importForm.vendor_id) : null,
                  supplier_name: importForm.supplier_name || null,
                  reference_number: importForm.reference_number || null,
                  expected_date: importForm.expected_date || null,
                  notes: importForm.notes || null,
                })
              }
            >
              Schedule Import
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Reference Number">
            <Input
              variant="main"
              placeholder="e.g., PO-2024-001"
              value={importForm.reference_number}
              onChange={(e) => setImportForm({ ...importForm, reference_number: e.target.value })}
            />
          </Field>
          <Field label="Vendor">
            <Select variant="main" placeholder="Select vendor..." value={importForm.vendor_id} onChange={(e) => setImportForm({ ...importForm, vendor_id: e.target.value })}>
              {vendors.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Or Supplier Name">
            <Input
              variant="main"
              placeholder="If not in vendor list"
              value={importForm.supplier_name}
              onChange={(e) => setImportForm({ ...importForm, supplier_name: e.target.value })}
            />
          </Field>
          <Field label="Warehouse" isRequired>
            <Select
              variant="main"
              placeholder="Select warehouse..."
              value={importForm.warehouse_id}
              onChange={(e) => setImportForm({ ...importForm, warehouse_id: e.target.value })}
            >
              {warehouses.map((w: any) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expected Arrival Date">
            <Input
              variant="main"
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={importForm.expected_date}
              onChange={(e) => setImportForm({ ...importForm, expected_date: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Input variant="main" placeholder="Optional notes" value={importForm.notes} onChange={(e) => setImportForm({ ...importForm, notes: e.target.value })} />
          </Field>
        </Stack>
      </AppModal>

      {/* Vendor Dialog */}
      <AppModal
        isOpen={isVendorDialogOpen}
        onClose={() => setIsVendorDialogOpen(false)}
        title="Add Vendor"
        footer={
          <>
            <Button variant="light" onClick={() => setIsVendorDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              isDisabled={!vendorForm.name}
              isLoading={createVendorMutation.isPending}
              loadingText="Creating..."
              onClick={() => createVendorMutation.mutate(vendorForm)}
            >
              Add Vendor
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Vendor Name" isRequired>
            <Input variant="main" placeholder="Company name" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} />
          </Field>
          <Field label="Contact Person">
            <Input
              variant="main"
              placeholder="Contact name"
              value={vendorForm.contact_person}
              onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
            />
          </Field>
          <SimpleGrid columns={2} spacing="16px">
            <Field label="Phone">
              <Input variant="main" placeholder="Phone number" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input variant="main" type="email" placeholder="Email address" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} />
            </Field>
          </SimpleGrid>
          <Field label="Address">
            <Input variant="main" placeholder="Business address" value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Input variant="main" placeholder="Additional notes" value={vendorForm.notes} onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })} />
          </Field>
        </Stack>
      </AppModal>
    </>
  )
}
