import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Divider, Flex, GridItem, Icon, IconButton, Input, Select, SimpleGrid, Stack, Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue } from '@chakra-ui/react'
import { MdAdd, MdArrowBack, MdDelete } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import SectionCard from '@/components/card/SectionCard'
import { Field, SearchInput, TableBox } from '@/components/ui'

export default function CreateTransferPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')

  const [fromWarehouseId, setFromWarehouseId] = useState('')
  const [toBranchId, setToBranchId] = useState('')
  const [notes, setNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [items, setItems] = useState<{ product_id: number; product_name: string; sku: string; requested_quantity: number }[]>([])

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => (await api.get('/inventory/warehouses')).data,
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches')).data,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['transfer-products'],
    queryFn: async () => (await api.get('/sales/products')).data,
  })

  const createTransferMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/transfers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      toast({ title: 'Transfer created successfully' })
      navigate('/inventory?tab=transfers')
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create transfer', description: error.response?.data?.detail || 'Unknown error', variant: 'destructive' })
    },
  })

  const filteredProducts = products.filter(
    (p: any) =>
      !items.find((i) => i.product_id === p.id) &&
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const addItem = (product: any) => {
    setItems([...items, { product_id: product.id, product_name: product.name, sku: product.sku || '', requested_quantity: 1 }])
    setSearchTerm('')
  }

  const updateQuantity = (productId: number, quantity: number) =>
    setItems(items.map((i) => (i.product_id === productId ? { ...i, requested_quantity: Math.max(1, quantity) } : i)))

  const handleSubmit = () => {
    if (!fromWarehouseId || !toBranchId || items.length === 0) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' })
      return
    }
    createTransferMutation.mutate({
      from_warehouse_id: parseInt(fromWarehouseId),
      to_branch_id: parseInt(toBranchId),
      notes: notes || null,
      items: items.map((i) => ({ product_id: i.product_id, requested_quantity: i.requested_quantity })),
    })
  }

  const totalItems = items.reduce((sum, i) => sum + i.requested_quantity, 0)

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate('/inventory?tab=transfers')} mb="8px">
        Back
      </Button>
      <PageHeader
        title="Create Transfer"
        description="Move products between warehouse and branch"
        actions={
          <Button
            variant="brand"
            onClick={handleSubmit}
            isDisabled={!fromWarehouseId || !toBranchId || items.length === 0}
            isLoading={createTransferMutation.isPending}
            loadingText="Creating..."
          >
            Create Transfer
          </Button>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="20px">
        <SectionCard title="Transfer Details">
          <Stack spacing="16px">
            <Field label="From Warehouse" isRequired>
              <Select variant="main" placeholder="Select source warehouse..." value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
                {warehouses.map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="To Branch" isRequired>
              <Select variant="main" placeholder="Select destination branch..." value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}>
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes">
              <Input variant="main" placeholder="Optional transfer notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Divider />
            <Flex justify="space-between" fontSize="sm">
              <Text>Total Products:</Text>
              <Text fontWeight="500">{items.length}</Text>
            </Flex>
            <Flex justify="space-between" fontSize="sm" mt="-8px">
              <Text>Total Items:</Text>
              <Text fontWeight="500">{totalItems}</Text>
            </Flex>
          </Stack>
        </SectionCard>

        <GridItem colSpan={{ base: 1, md: 2 }}>
          <SectionCard title="Products to Transfer">
            <Stack spacing="16px">
              <SearchInput maxW="100%" placeholder="Search products by name or SKU..." value={searchTerm} onChange={setSearchTerm} />

              {searchTerm && filteredProducts.length > 0 && (
                <Box border="1px solid" borderColor={borderColor} borderRadius="12px" maxH="192px" overflowY="auto">
                  {filteredProducts.slice(0, 10).map((product: any) => (
                    <Flex
                      key={product.id}
                      align="center"
                      justify="space-between"
                      p="12px"
                      cursor="pointer"
                      borderBottom="1px solid"
                      borderColor={borderColor}
                      _hover={{ bg: hoverBg }}
                      onClick={() => addItem(product)}
                    >
                      <Box>
                        <Text fontWeight="500">{product.name}</Text>
                        <Text fontSize="sm" color="secondaryGray.600">
                          {product.sku}
                        </Text>
                      </Box>
                      <Icon as={MdAdd} />
                    </Flex>
                  ))}
                </Box>
              )}

              {items.length === 0 ? (
                <Box textAlign="center" py="32px" color="secondaryGray.600" border="1px solid" borderColor={borderColor} borderRadius="12px">
                  Search and add products to transfer
                </Box>
              ) : (
                <TableBox>
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Product</Th>
                        <Th>SKU</Th>
                        <Th w="128px">Quantity</Th>
                        <Th w="64px" />
                      </Tr>
                    </Thead>
                    <Tbody>
                      {items.map((item) => (
                        <Tr key={item.product_id}>
                          <Td fontWeight="500">{item.product_name}</Td>
                          <Td fontFamily="mono">{item.sku}</Td>
                          <Td>
                            <Input
                              variant="main"
                              type="number"
                              min="1"
                              w="96px"
                              value={item.requested_quantity}
                              onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1)}
                            />
                          </Td>
                          <Td>
                            <IconButton
                              aria-label="Remove"
                              variant="ghost"
                              size="sm"
                              color="red.500"
                              icon={<MdDelete />}
                              onClick={() => setItems(items.filter((i) => i.product_id !== item.product_id))}
                            />
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableBox>
              )}
            </Stack>
          </SectionCard>
        </GridItem>
      </SimpleGrid>
    </>
  )
}
