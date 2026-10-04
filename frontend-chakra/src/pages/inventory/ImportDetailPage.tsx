import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Box, Button, Checkbox, Flex, Icon, IconButton, Input, Select, SimpleGrid, Spinner, Stack, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react'
import { MdAdd, MdArrowBack, MdCheck, MdDelete, MdInventory2 } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { AppModal, Field, TableMessageRow } from '@/components/ui'

const statusBadge: Record<string, [string, string]> = {
  pending: ['yellow', 'Pending'],
  received: ['green', 'Received'],
  cancelled: ['red', 'Cancelled'],
}

const emptyItemForm = { product_id: '', expected_quantity: '', unit_cost: '' }
const emptyProductForm = { name: '', sku: '', unit_price: '', cost_price: '' }

function SmallStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card>
      <Text fontSize="sm" fontWeight="500" color="secondaryGray.600" mb="8px">
        {label}
      </Text>
      {children}
    </Card>
  )
}

export default function ImportDetailPage() {
  const { importId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [newProductForm, setNewProductForm] = useState(emptyProductForm)
  const [isNewProduct, setIsNewProduct] = useState(false)

  const { data: importData, isLoading } = useQuery({
    queryKey: ['import', importId],
    queryFn: async () => (await api.get(`/inventory/imports/${importId}`)).data,
    enabled: !!importId,
  })

  const { data: importItems = [] } = useQuery({
    queryKey: ['import-items', importId],
    queryFn: async () => (await api.get(`/inventory/imports/${importId}/items`)).data,
    enabled: !!importId,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['all-products'],
    queryFn: async () => (await api.get('/sales/products')).data,
  })

  const addItemMutation = useMutation({
    mutationFn: (data: any) => api.post(`/inventory/imports/${importId}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-items', importId] })
      setIsAddItemDialogOpen(false)
      setItemForm(emptyItemForm)
      setNewProductForm(emptyProductForm)
      setIsNewProduct(false)
      toast({ title: 'Item added successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to add item', variant: 'destructive' })
    },
  })

  const removeItemMutation = useMutation({
    mutationFn: (itemId: number) => api.delete(`/inventory/imports/${importId}/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-items', importId] })
      toast({ title: 'Item removed' })
    },
  })

  const receiveImportMutation = useMutation({
    mutationFn: () => api.put(`/inventory/imports/${importId}/receive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import', importId] })
      queryClient.invalidateQueries({ queryKey: ['imports'] })
      toast({ title: 'Import received successfully! Stock has been updated.' })
    },
    onError: () => {
      toast({ title: 'Failed to receive import', variant: 'destructive' })
    },
  })

  const handleAddItem = () => {
    const common = {
      expected_quantity: parseInt(itemForm.expected_quantity),
      unit_cost: itemForm.unit_cost ? parseFloat(itemForm.unit_cost) : null,
    }
    if (isNewProduct) {
      // Create new product and add to import
      addItemMutation.mutate({
        new_product: {
          name: newProductForm.name,
          sku: newProductForm.sku || null,
          unit_price: parseFloat(newProductForm.unit_price),
          cost_price: newProductForm.cost_price ? parseFloat(newProductForm.cost_price) : null,
        },
        ...common,
      })
    } else {
      addItemMutation.mutate({ product_id: parseInt(itemForm.product_id), ...common })
    }
  }

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="256px">
        <Spinner color="brand.500" />
      </Flex>
    )
  }

  if (!importData) {
    return (
      <Flex justify="center" align="center" h="256px">
        Import not found
      </Flex>
    )
  }

  const isPending = importData.status === 'pending'
  const [scheme, label] = statusBadge[importData.status] || ['gray', importData.status]

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate('/inventory?tab=imports')} mb="8px">
        Back
      </Button>
      <PageHeader
        title={`Import #${importData.id}${importData.reference_number ? ` - ${importData.reference_number}` : ''}`}
        description={importData.supplier_name || importData.vendor?.name || 'Unknown Supplier'}
        actions={
          isPending && (
            <>
              <Button variant="light" leftIcon={<MdAdd />} onClick={() => setIsAddItemDialogOpen(true)}>
                Add Item
              </Button>
              <Button
                variant="brand"
                leftIcon={<MdCheck />}
                isDisabled={importItems.length === 0}
                isLoading={receiveImportMutation.isPending}
                loadingText="Receiving..."
                onClick={() => receiveImportMutation.mutate()}
              >
                Receive Import
              </Button>
            </>
          )
        }
      />

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px" mb="20px">
        <SmallStat label="Status">
          <Badge colorScheme={scheme}>{label}</Badge>
        </SmallStat>
        <SmallStat label="Expected Date">
          <Text fontSize="lg" fontWeight="500">
            {importData.expected_date ? new Date(importData.expected_date).toLocaleDateString() : 'Not set'}
          </Text>
        </SmallStat>
        <SmallStat label="Items">
          <Text fontSize="2xl" fontWeight="bold">
            {importItems.length}
          </Text>
        </SmallStat>
        <SmallStat label="Total Cost">
          <Text fontSize="2xl" fontWeight="bold">
            GH₵{importData.total_cost?.toLocaleString() || '0'}
          </Text>
        </SmallStat>
      </SimpleGrid>

      <SectionCard
        title={
          <Flex align="center" gap="8px">
            <Icon as={MdInventory2} />
            Import Items
          </Flex>
        }
      >
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th>Expected Qty</Th>
                <Th>Received Qty</Th>
                <Th>Unit Cost</Th>
                <Th>Total</Th>
                {isPending && <Th />}
              </Tr>
            </Thead>
            <Tbody>
              {importItems.length === 0 ? (
                <TableMessageRow colSpan={7}>No items added yet. Click "Add Item" to add products to this import.</TableMessageRow>
              ) : (
                importItems.map((item: any) => (
                  <Tr key={item.id}>
                    <Td fontWeight="500">{item.product?.name || 'Unknown'}</Td>
                    <Td fontFamily="mono">{item.product?.sku || '-'}</Td>
                    <Td>{item.expected_quantity}</Td>
                    <Td>{item.received_quantity || '-'}</Td>
                    <Td>GH₵{item.unit_cost?.toLocaleString() || '0'}</Td>
                    <Td fontWeight="500">GH₵{((item.unit_cost || 0) * item.expected_quantity).toLocaleString()}</Td>
                    {isPending && (
                      <Td>
                        <IconButton
                          aria-label="Remove item"
                          variant="ghost"
                          size="sm"
                          color="red.500"
                          icon={<MdDelete />}
                          onClick={() => removeItemMutation.mutate(item.id)}
                        />
                      </Td>
                    )}
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
      </SectionCard>

      {/* Add Item Dialog */}
      <AppModal
        isOpen={isAddItemDialogOpen}
        onClose={() => setIsAddItemDialogOpen(false)}
        title="Add Item to Import"
        footer={
          <>
            <Button variant="light" onClick={() => setIsAddItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={handleAddItem}
              isDisabled={
                (!isNewProduct && !itemForm.product_id) || (isNewProduct && (!newProductForm.name || !newProductForm.unit_price)) || !itemForm.expected_quantity
              }
              isLoading={addItemMutation.isPending}
              loadingText="Adding..."
            >
              Add Item
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Checkbox isChecked={isNewProduct} onChange={(e) => setIsNewProduct(e.target.checked)}>
            Create new product
          </Checkbox>

          {isNewProduct ? (
            <>
              <Field label="Product Name" isRequired>
                <Input
                  variant="main"
                  placeholder="Enter product name"
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                />
              </Field>
              <Field label="SKU">
                <Input
                  variant="main"
                  placeholder="Auto-generated if empty"
                  value={newProductForm.sku}
                  onChange={(e) => setNewProductForm({ ...newProductForm, sku: e.target.value })}
                />
              </Field>
              <SimpleGrid columns={2} spacing="16px">
                <Field label="Sale Price" isRequired>
                  <Input
                    variant="main"
                    type="number"
                    placeholder="0.00"
                    value={newProductForm.unit_price}
                    onChange={(e) => setNewProductForm({ ...newProductForm, unit_price: e.target.value })}
                  />
                </Field>
                <Field label="Cost Price">
                  <Input
                    variant="main"
                    type="number"
                    placeholder="0.00"
                    value={newProductForm.cost_price}
                    onChange={(e) => setNewProductForm({ ...newProductForm, cost_price: e.target.value })}
                  />
                </Field>
              </SimpleGrid>
            </>
          ) : (
            <Field label="Select Product" isRequired>
              <Select variant="main" placeholder="Select a product..." value={itemForm.product_id} onChange={(e) => setItemForm({ ...itemForm, product_id: e.target.value })}>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <SimpleGrid columns={2} spacing="16px">
            <Field label="Quantity" isRequired>
              <Input
                variant="main"
                type="number"
                min="1"
                placeholder="0"
                value={itemForm.expected_quantity}
                onChange={(e) => setItemForm({ ...itemForm, expected_quantity: e.target.value })}
              />
            </Field>
            <Field label="Unit Cost">
              <Input variant="main" type="number" placeholder="0.00" value={itemForm.unit_cost} onChange={(e) => setItemForm({ ...itemForm, unit_cost: e.target.value })} />
            </Field>
          </SimpleGrid>
        </Stack>
      </AppModal>
    </>
  )
}
