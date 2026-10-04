import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  Table,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { MdArrowBack, MdClose, MdLocalShipping } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import { AppModal, Field, SearchInput, TableBox, TableMessageRow } from '@/components/ui'

type TransferItem = { product_id: number; product_name: string; quantity: number; max_quantity: number }

export default function WarehouseDetailPage() {
  const { warehouseId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
  const [transferForm, setTransferForm] = useState({ to_branch_id: '', items: [] as TransferItem[] })

  const { data: warehouse, isLoading } = useQuery({
    queryKey: ['warehouse', warehouseId],
    queryFn: async () => (await api.get(`/inventory/warehouses/${warehouseId}`)).data,
    enabled: !!warehouseId,
  })

  const { data: stock = [] } = useQuery({
    queryKey: ['warehouse-stock', warehouseId],
    queryFn: async () => (await api.get(`/inventory/warehouses/${warehouseId}/stock`)).data,
    enabled: !!warehouseId,
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches')).data,
  })

  const { data: transfers = [] } = useQuery({
    queryKey: ['warehouse-transfers', warehouseId],
    queryFn: async () => (await api.get('/inventory/transfers', { params: { from_warehouse_id: warehouseId } })).data,
    enabled: !!warehouseId,
  })

  const createTransferMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/inventory/transfers', data)
      // Auto-approve and complete the transfer
      await api.put(`/inventory/transfers/${response.data.id}/approve`)
      await api.put(`/inventory/transfers/${response.data.id}/complete`)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-transfers', warehouseId] })
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseId] })
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] })
      queryClient.invalidateQueries({ queryKey: ['all-branch-stock'] })
      setIsTransferDialogOpen(false)
      setTransferForm({ to_branch_id: '', items: [] })
      toast({ title: 'Stock transferred successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to transfer stock', variant: 'destructive' })
    },
  })

  const addItemToTransfer = (stockItem: any) => {
    if (transferForm.items.find((i) => i.product_id === stockItem.product_id)) {
      toast({ title: 'Product already added', variant: 'destructive' })
      return
    }
    setTransferForm({
      ...transferForm,
      items: [
        ...transferForm.items,
        {
          product_id: stockItem.product_id,
          product_name: stockItem.product?.name || `Product #${stockItem.product_id}`,
          quantity: 1,
          max_quantity: stockItem.quantity,
        },
      ],
    })
  }

  const updateTransferItemQuantity = (productId: number, quantity: number) =>
    setTransferForm({
      ...transferForm,
      items: transferForm.items.map((item) => (item.product_id === productId ? { ...item, quantity: Math.min(quantity, item.max_quantity) } : item)),
    })

  const handleCreateTransfer = () => {
    if (!transferForm.to_branch_id) {
      toast({ title: 'Please select a destination branch', variant: 'destructive' })
      return
    }
    if (transferForm.items.length === 0) {
      toast({ title: 'Please add items to transfer', variant: 'destructive' })
      return
    }
    createTransferMutation.mutate({
      from_warehouse_id: parseInt(warehouseId!),
      to_branch_id: parseInt(transferForm.to_branch_id),
      items: transferForm.items.map((item) => ({ product_id: item.product_id, requested_quantity: item.quantity })),
    })
  }

  const filteredStock = stock.filter(
    (s: any) => s.product?.name?.toLowerCase().includes(search.toLowerCase()) || s.product?.sku?.toLowerCase().includes(search.toLowerCase()),
  )
  const totalItems = stock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0)
  const lowStockItems = stock.filter((s: any) => s.quantity <= s.min_quantity).length

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="256px">
        <Spinner color="brand.500" />
      </Flex>
    )
  }

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate('/inventory')} mb="8px">
        Back
      </Button>
      <PageHeader
        title={warehouse?.name || 'Warehouse'}
        description={warehouse?.location || 'No location set'}
        actions={
          <Button variant="brand" leftIcon={<MdLocalShipping />} onClick={() => setIsTransferDialogOpen(true)}>
            Create Transfer
          </Button>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px" mb="20px">
        <StatCard name="Total Products" value={stock.length} />
        <StatCard name="Total Items" value={totalItems} />
        <StatCard name="Low Stock" value={lowStockItems} valueColor="red.500" />
        <StatCard name="Pending Transfers" value={transfers.filter((t: any) => t.status === 'pending').length} />
      </SimpleGrid>

      <Tabs variant="soft-rounded">
        <TabList gap="8px" mb="16px">
          <Tab>Stock</Tab>
          <Tab>Transfers</Tab>
        </TabList>
        <TabPanels>
          <TabPanel p="0">
            <Card>
              <Box mb="16px">
                <SearchInput maxW="100%" placeholder="Search products..." value={search} onChange={setSearch} />
              </Box>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>SKU</Th>
                      <Th>Product</Th>
                      <Th>Quantity</Th>
                      <Th>Min Qty</Th>
                      <Th>Status</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredStock.length === 0 ? (
                      <TableMessageRow colSpan={6}>No stock found</TableMessageRow>
                    ) : (
                      filteredStock.map((item: any) => {
                        const low = item.quantity <= item.min_quantity
                        return (
                          <Tr key={item.id}>
                            <Td fontFamily="mono">{item.product?.sku || '-'}</Td>
                            <Td fontWeight="500">{item.product?.name || `Product #${item.product_id}`}</Td>
                            <Td>{item.quantity}</Td>
                            <Td>{item.min_quantity}</Td>
                            <Td>
                              <Badge colorScheme={low ? 'red' : 'green'}>{low ? 'Low Stock' : 'In Stock'}</Badge>
                            </Td>
                            <Td>
                              <IconButton
                                aria-label="Transfer this product"
                                variant="light"
                                size="sm"
                                icon={<MdLocalShipping />}
                                onClick={() => {
                                  setIsTransferDialogOpen(true)
                                  addItemToTransfer(item)
                                }}
                              />
                            </Td>
                          </Tr>
                        )
                      })
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
                      <Th>ID</Th>
                      <Th>To Branch</Th>
                      <Th>Items</Th>
                      <Th>Request Date</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {transfers.length === 0 ? (
                      <TableMessageRow colSpan={5}>No transfers found</TableMessageRow>
                    ) : (
                      transfers.map((transfer: any) => (
                        <Tr key={transfer.id}>
                          <Td fontWeight="600">#{transfer.id}</Td>
                          <Td>{transfer.to_branch?.name || `Branch #${transfer.to_branch_id}`}</Td>
                          <Td>{transfer.items?.length || 0} items</Td>
                          <Td>{new Date(transfer.request_date).toLocaleDateString()}</Td>
                          <Td>
                            <Badge colorScheme={transfer.status === 'completed' ? 'green' : transfer.status === 'approved' ? 'yellow' : 'gray'}>
                              {transfer.status}
                            </Badge>
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

      {/* Create Transfer Dialog */}
      <AppModal
        isOpen={isTransferDialogOpen}
        onClose={() => setIsTransferDialogOpen(false)}
        size="2xl"
        title="Create Stock Transfer"
        footer={
          <>
            <Button variant="light" onClick={() => setIsTransferDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleCreateTransfer} isLoading={createTransferMutation.isPending} loadingText="Creating...">
              Create Transfer
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Destination Branch" isRequired>
            <Select
              variant="main"
              placeholder="Select branch"
              value={transferForm.to_branch_id}
              onChange={(e) => setTransferForm({ ...transferForm, to_branch_id: e.target.value })}
            >
              {branches.map((branch: any) => (
                <option key={branch.id} value={branch.id.toString()}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Items to Transfer">
            {transferForm.items.length === 0 ? (
              <TableBox textAlign="center" py="16px" fontSize="sm" color="secondaryGray.600">
                No items added. Select products from the stock list.
              </TableBox>
            ) : (
              <TableBox>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Product</Th>
                      <Th>Quantity</Th>
                      <Th>Available</Th>
                      <Th />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {transferForm.items.map((item) => (
                      <Tr key={item.product_id}>
                        <Td>{item.product_name}</Td>
                        <Td>
                          <Input
                            variant="main"
                            type="number"
                            w="80px"
                            min={1}
                            max={item.max_quantity}
                            value={item.quantity}
                            onChange={(e) => updateTransferItemQuantity(item.product_id, parseInt(e.target.value) || 1)}
                          />
                        </Td>
                        <Td>{item.max_quantity}</Td>
                        <Td>
                          <IconButton
                            aria-label="Remove"
                            variant="ghost"
                            size="sm"
                            icon={<MdClose />}
                            onClick={() => setTransferForm({ ...transferForm, items: transferForm.items.filter((i) => i.product_id !== item.product_id) })}
                          />
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableBox>
            )}
          </Field>
        </Stack>
      </AppModal>
    </>
  )
}
