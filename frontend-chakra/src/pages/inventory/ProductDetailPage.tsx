import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  Progress,
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
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react'
import {
  MdArrowBack,
  MdAttachMoney,
  MdBusiness,
  MdClose,
  MdEdit,
  MdEmojiEvents,
  MdHistory,
  MdImage,
  MdInventory2,
  MdSave,
  MdTrendingUp,
} from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { RowBox } from '@/components/dashboard/widgets'
import { AppModal, Field, TableMessageRow } from '@/components/ui'

const TABS = ['details', 'stock', 'price-history', 'sales']

function SmallStat({ icon, label, value, help }: { icon: React.ElementType; label: string; value: React.ReactNode; help: string }) {
  return (
    <Card>
      <Flex align="center" gap="8px" fontSize="sm" fontWeight="500" color="secondaryGray.600" mb="8px">
        <Icon as={icon} />
        {label}
      </Flex>
      <Text fontSize="2xl" fontWeight="bold">
        {value}
      </Text>
      <Text fontSize="xs" color="secondaryGray.600">
        {help}
      </Text>
    </Card>
  )
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text fontSize="sm" color="secondaryGray.600">
        {label}
      </Text>
      {children}
    </Box>
  )
}

export default function ProductDetailPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')

  const isNewProduct = !productId || productId === 'new'

  const [isEditing, setIsEditing] = useState(isNewProduct)
  const [activeTab, setActiveTab] = useState('details')
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false)
  const [isStockAdjustDialogOpen, setIsStockAdjustDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState<any>(
    isNewProduct
      ? {
          name: '',
          sku: '',
          category_id: '',
          description: '',
          unit_price: '',
          cost_price: '',
          reorder_level: '10',
          branch_stocks: [{ branch_id: '1', quantity: '0' }],
        }
      : {},
  )
  const [priceForm, setPriceForm] = useState({ new_price: '', reason: '' })
  const [stockAdjustForm, setStockAdjustForm] = useState({ branch_id: '1', quantity_change: '', reason: '', adjustment_type: 'add' })

  const enabled = !isNewProduct && !!productId

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => (await api.get(`/sales/products/${productId}`)).data,
    enabled,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => (await api.get('/sales/categories')).data,
  })

  const { data: branchStock = [] } = useQuery({
    queryKey: ['product-branch-stock', productId],
    queryFn: async () => (await api.get(`/inventory/products/${productId}/stock`)).data,
    enabled,
  })

  const { data: priceHistory = [] } = useQuery({
    queryKey: ['product-price-history', productId],
    queryFn: async () => (await api.get(`/inventory/products/${productId}/price-history`)).data,
    enabled,
  })

  const { data: salesData } = useQuery({
    queryKey: ['product-sales', productId],
    queryFn: async () => (await api.get(`/inventory/products/${productId}/sales`)).data,
    enabled,
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches')).data,
  })

  const { data: productRank } = useQuery({
    queryKey: ['product-rank', productId],
    queryFn: async () => (await api.get(`/sales/products/${productId}/rank`)).data,
    enabled,
  })

  const updateProductMutation = useMutation({
    mutationFn: (data: any) => api.put(`/sales/products/${productId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      setIsEditing(false)
      toast({ title: 'Product updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update product', variant: 'destructive' })
    },
  })

  const updatePriceMutation = useMutation({
    mutationFn: (data: any) => api.post(`/inventory/products/${productId}/price`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['product-price-history', productId] })
      setIsPriceDialogOpen(false)
      setPriceForm({ new_price: '', reason: '' })
      toast({ title: 'Price updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update price', variant: 'destructive' })
    },
  })

  const createProductMutation = useMutation({
    mutationFn: (data: any) => api.post('/sales/products', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({ title: 'Product created successfully' })
      navigate(`/inventory/products/${response.data.id}`)
    },
    onError: () => {
      toast({ title: 'Failed to create product', variant: 'destructive' })
    },
  })

  const adjustStockMutation = useMutation({
    mutationFn: (data: any) => api.post(`/inventory/products/${productId}/adjust-stock`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-branch-stock', productId] })
      setIsStockAdjustDialogOpen(false)
      setStockAdjustForm({ branch_id: '1', quantity_change: '', reason: '', adjustment_type: 'add' })
      toast({ title: 'Stock adjusted successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to adjust stock', variant: 'destructive' })
    },
  })

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      // Pass FormData through untouched so the browser sets the multipart boundary
      return api.post(`/sales/products/${productId}/image`, formData, { transformRequest: [(data) => data] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast({ title: 'Image uploaded successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to upload image', variant: 'destructive' })
    },
  })

  const handleStartEdit = () => {
    setEditForm({
      name: product?.name || '',
      sku: product?.sku || '',
      description: product?.description || '',
      category_id: product?.category_id?.toString() || '',
      cost_price: product?.cost_price?.toString() || '',
      unit_price: product?.unit_price?.toString() || '',
      requires_prescription: product?.requires_prescription || false,
      is_active: product?.is_active ?? true,
    })
    setIsEditing(true)
    setActiveTab('details')
  }

  const handleSave = () => {
    if (isNewProduct) {
      const branchStocks = (editForm.branch_stocks || [])
        .filter((s: any) => s.branch_id && parseInt(s.quantity) > 0)
        .map((s: any) => ({ branch_id: parseInt(s.branch_id), quantity: parseInt(s.quantity) }))
      createProductMutation.mutate({
        name: editForm.name,
        sku: editForm.sku || null,
        description: editForm.description || null,
        category_id: editForm.category_id ? parseInt(editForm.category_id) : null,
        cost_price: editForm.cost_price ? parseFloat(editForm.cost_price) : null,
        unit_price: parseFloat(editForm.unit_price),
        reorder_level: editForm.reorder_level ? parseInt(editForm.reorder_level) : 10,
        branch_stocks: branchStocks,
      })
    } else {
      updateProductMutation.mutate({
        ...editForm,
        category_id: editForm.category_id ? parseInt(editForm.category_id) : null,
        cost_price: editForm.cost_price ? parseFloat(editForm.cost_price) : null,
        unit_price: parseFloat(editForm.unit_price),
      })
    }
  }

  const handlePriceChange = () => {
    if (!priceForm.new_price) {
      toast({ title: 'Please enter a new price', variant: 'destructive' })
      return
    }
    updatePriceMutation.mutate({ new_price: parseFloat(priceForm.new_price), reason: priceForm.reason })
  }

  const handleStockAdjust = () => {
    if (!stockAdjustForm.quantity_change || !stockAdjustForm.reason) {
      toast({ title: 'Please enter quantity and reason', variant: 'destructive' })
      return
    }
    const qty = parseInt(stockAdjustForm.quantity_change)
    adjustStockMutation.mutate({
      branch_id: parseInt(stockAdjustForm.branch_id),
      quantity_change: stockAdjustForm.adjustment_type === 'add' ? qty : -qty,
      reason: stockAdjustForm.reason,
    })
  }

  const setBranchStock = (index: number, patch: any) => {
    const newStocks = [...editForm.branch_stocks]
    newStocks[index] = { ...newStocks[index], ...patch }
    setEditForm({ ...editForm, branch_stocks: newStocks })
  }

  const addBranchStock = () => {
    const usedBranches = editForm.branch_stocks?.map((s: any) => s.branch_id) || []
    const availableBranch = branches.find((b: any) => !usedBranches.includes(b.id.toString()))
    if (availableBranch) {
      setEditForm({ ...editForm, branch_stocks: [...(editForm.branch_stocks || []), { branch_id: availableBranch.id.toString(), quantity: '0' }] })
    }
  }

  const field = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEditForm({ ...editForm, [key]: e.target.value })

  const totalStock = branchStock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0)

  if (!isNewProduct && isLoading) {
    return (
      <Flex justify="center" align="center" h="256px">
        <Spinner color="brand.500" />
      </Flex>
    )
  }

  if (!isNewProduct && !product) {
    return (
      <Flex justify="center" align="center" h="256px">
        Product not found
      </Flex>
    )
  }

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate('/inventory/products')} mb="8px">
        Back
      </Button>
      <Flex justify="space-between" align={{ base: 'start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap="12px" mb="20px">
        <Box>
          <Heading size="lg" data-tour="page-title">
            {isNewProduct ? 'New Product' : product?.name}
          </Heading>
          {!isNewProduct && (
            <Text color="secondaryGray.600" fontFamily="mono">
              {product?.sku}
            </Text>
          )}
        </Box>
        <Flex gap="8px" wrap="wrap">
          {isEditing ? (
            <>
              {!isNewProduct && (
                <Button variant="light" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button variant="brand" leftIcon={<MdSave />} onClick={handleSave} isLoading={createProductMutation.isPending || updateProductMutation.isPending}>
                {isNewProduct ? 'Create Product' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="light" leftIcon={<MdInventory2 />} onClick={() => setIsStockAdjustDialogOpen(true)}>
                Adjust Stock
              </Button>
              <Button variant="light" leftIcon={<MdAttachMoney />} onClick={() => setIsPriceDialogOpen(true)}>
                Change Price
              </Button>
              <Button variant="brand" leftIcon={<MdEdit />} onClick={handleStartEdit}>
                Edit Product
              </Button>
            </>
          )}
        </Flex>
      </Flex>

      {!isNewProduct && (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px" mb="20px">
          <SmallStat icon={MdInventory2} label="Total Stock" value={totalStock} help="Across all branches" />
          <SmallStat
            icon={MdAttachMoney}
            label="Sale Price"
            value={`GH₵${product?.unit_price?.toLocaleString()}`}
            help={`Cost: GH₵${product?.cost_price?.toLocaleString() || '0'}`}
          />
          <SmallStat icon={MdTrendingUp} label="Total Sales" value={salesData?.total_quantity || 0} help="Units sold" />
          <SmallStat icon={MdAttachMoney} label="Revenue" value={`GH₵${salesData?.total_revenue?.toLocaleString() || '0'}`} help="All time" />
        </SimpleGrid>
      )}

      {/* Sales Rank Card */}
      {!isNewProduct && productRank && (
        <SectionCard
          title={
            <Flex align="center" gap="8px" fontSize="md">
              <Icon as={MdEmojiEvents} color="yellow.500" />
              Sales Ranking
            </Flex>
          }
          border="2px solid"
          borderColor="brand.100"
          mb="20px"
        >
          <Flex align="center" gap="24px" direction={{ base: 'column', md: 'row' }}>
            <Box textAlign="center">
              <Text fontSize="4xl" fontWeight="bold" color="brand.500">
                #{productRank.rank}
              </Text>
              <Text fontSize="xs" color="secondaryGray.600">
                of {productRank.total_products} products
              </Text>
            </Box>
            <Stack flex="1" spacing="8px" w="100%">
              <Flex justify="space-between" fontSize="sm">
                <Text color="secondaryGray.600">Percentile</Text>
                <Text fontWeight="500">{productRank.percentile}%</Text>
              </Flex>
              <Progress value={productRank.percentile} colorScheme="brandScheme" size="sm" borderRadius="full" />
              <Text fontSize="xs" color="secondaryGray.600">
                {productRank.total_sold} units sold total
              </Text>
            </Stack>
            {productRank.top_3?.length > 0 && (
              <Box borderLeft={{ md: '1px solid' }} borderColor={{ md: 'secondaryGray.100' }} ps={{ md: '16px' }}>
                <Text fontSize="xs" fontWeight="500" mb="8px">
                  Top Sellers
                </Text>
                {productRank.top_3.slice(0, 3).map((item: any, idx: number) => (
                  <Flex key={item.id} align="center" gap="8px" fontSize="xs">
                    <Text fontWeight="bold" color={['yellow.500', 'gray.400', 'orange.600'][idx]}>
                      #{idx + 1}
                    </Text>
                    <Text noOfLines={1} maxW="100px">
                      {item.name}
                    </Text>
                    <Text color="secondaryGray.600">({item.total_sold})</Text>
                  </Flex>
                ))}
              </Box>
            )}
          </Flex>
        </SectionCard>
      )}

      <Tabs variant="soft-rounded" index={TABS.indexOf(activeTab)} onChange={(i) => setActiveTab(TABS[i])}>
        <TabList gap="8px" flexWrap="wrap" mb="16px">
          <Tab>Details</Tab>
          {!isNewProduct && <Tab>Stock by Branch</Tab>}
          {!isNewProduct && <Tab>Price History</Tab>}
          {!isNewProduct && <Tab>Sales</Tab>}
        </TabList>

        <TabPanels>
          <TabPanel p="0">
            <Card>
              {isEditing ? (
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing="16px">
                  <Field label="Product Name">
                    <Input variant="main" value={editForm.name} onChange={field('name')} />
                  </Field>
                  <Field label="SKU">
                    <Input variant="main" value={editForm.sku} onChange={field('sku')} />
                  </Field>
                  <Field label="Category" helper="Medication categories show when prescribing medications. Optical categories for glasses/lens.">
                    <Select variant="main" placeholder="Select category" value={editForm.category_id} onChange={field('category_id')}>
                      {categories.map((cat: any) => (
                        <option key={cat.id} value={cat.id.toString()}>
                          {cat.name} ({cat.category_type || 'general'})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Cost Price">
                    <Input variant="main" type="number" value={editForm.cost_price} onChange={field('cost_price')} />
                  </Field>
                  <Field label="Sale Price">
                    <Input variant="main" type="number" value={editForm.unit_price} onChange={field('unit_price')} />
                  </Field>
                  <GridItem colSpan={{ base: 1, md: 2 }}>
                    <Field label="Description">
                      <Textarea variant="main" rows={3} value={editForm.description} onChange={field('description')} />
                    </Field>
                  </GridItem>
                  {isNewProduct && (
                    <>
                      <GridItem colSpan={{ base: 1, md: 2 }}>
                        <Flex justify="space-between" align="center" mb="8px">
                          <Text fontSize="sm" fontWeight="500">
                            Initial Stock by Branch
                          </Text>
                          <Button variant="light" size="sm" onClick={addBranchStock} isDisabled={(editForm.branch_stocks?.length || 0) >= branches.length}>
                            + Add Branch
                          </Button>
                        </Flex>
                        <Stack spacing="8px">
                          {(editForm.branch_stocks || []).map((stock: any, index: number) => (
                            <Flex key={index} align="center" gap="8px">
                              <Select
                                variant="main"
                                flex="1"
                                placeholder="Select branch"
                                value={stock.branch_id}
                                onChange={(e) => setBranchStock(index, { branch_id: e.target.value })}
                              >
                                {branches.map((b: any) => (
                                  <option key={b.id} value={b.id.toString()}>
                                    {b.name}
                                  </option>
                                ))}
                              </Select>
                              <Input
                                variant="main"
                                type="number"
                                min="0"
                                w="96px"
                                placeholder="Qty"
                                value={stock.quantity}
                                onChange={(e) => setBranchStock(index, { quantity: e.target.value })}
                              />
                              {editForm.branch_stocks.length > 1 && (
                                <IconButton
                                  aria-label="Remove branch"
                                  variant="ghost"
                                  size="sm"
                                  icon={<MdClose />}
                                  onClick={() => setEditForm({ ...editForm, branch_stocks: editForm.branch_stocks.filter((_: any, i: number) => i !== index) })}
                                />
                              )}
                            </Flex>
                          ))}
                        </Stack>
                      </GridItem>
                      <Field label="Reorder Level">
                        <Input variant="main" type="number" min="0" placeholder="10" value={editForm.reorder_level} onChange={field('reorder_level')} />
                      </Field>
                    </>
                  )}
                  <Flex align="center" gap="16px">
                    <Checkbox isChecked={editForm.requires_prescription} onChange={(e) => setEditForm({ ...editForm, requires_prescription: e.target.checked })}>
                      Requires Prescription
                    </Checkbox>
                    {!isNewProduct && (
                      <Checkbox isChecked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}>
                        Active
                      </Checkbox>
                    )}
                  </Flex>
                </SimpleGrid>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing="16px">
                  <InfoItem label="Category">
                    <Text fontWeight="500">{product.category?.name || 'Uncategorized'}</Text>
                  </InfoItem>
                  <InfoItem label="Status">
                    <Badge colorScheme={product.is_active ? 'green' : 'red'}>{product.is_active ? 'Active' : 'Inactive'}</Badge>
                  </InfoItem>
                  <InfoItem label="Requires Prescription">
                    <Badge colorScheme={product.requires_prescription ? 'yellow' : 'gray'}>{product.requires_prescription ? 'Yes' : 'No'}</Badge>
                  </InfoItem>
                  <InfoItem label="Created">
                    <Text fontWeight="500">{product.created_at ? new Date(product.created_at).toLocaleDateString() : '-'}</Text>
                  </InfoItem>
                  {product.description && (
                    <GridItem colSpan={{ base: 1, md: 2 }}>
                      <InfoItem label="Description">
                        <Text>{product.description}</Text>
                      </InfoItem>
                    </GridItem>
                  )}
                  <GridItem colSpan={{ base: 1, md: 2 }}>
                    <InfoItem label="Product Image">
                      <Flex align="start" gap="16px" mt="8px">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            w="128px"
                            h="128px"
                            objectFit="cover"
                            borderRadius="12px"
                            border="1px solid"
                            borderColor="secondaryGray.100"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        ) : (
                          <Flex w="128px" h="128px" bg={imageBg} borderRadius="12px" align="center" justify="center">
                            <Icon as={MdImage} w="32px" h="32px" color="secondaryGray.600" />
                          </Flex>
                        )}
                        <Box>
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) uploadImageMutation.mutate(file)
                            }}
                          />
                          <Button
                            variant="light"
                            size="sm"
                            leftIcon={<MdImage />}
                            onClick={() => imageInputRef.current?.click()}
                            isLoading={uploadImageMutation.isPending}
                            loadingText="Uploading..."
                          >
                            {product.image_url ? 'Change Image' : 'Upload Image'}
                          </Button>
                          <Text fontSize="xs" color="secondaryGray.600" mt="4px">
                            JPEG, PNG, GIF or WEBP. Max 5MB.
                          </Text>
                        </Box>
                      </Flex>
                    </InfoItem>
                  </GridItem>
                </SimpleGrid>
              )}
            </Card>
          </TabPanel>

          {!isNewProduct && (
            <TabPanel p="0">
              <SectionCard
                title={
                  <Flex align="center" gap="8px">
                    <Icon as={MdBusiness} />
                    Stock by Branch
                  </Flex>
                }
              >
                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Branch</Th>
                        <Th>Quantity</Th>
                        <Th>Min Quantity</Th>
                        <Th>Status</Th>
                        <Th>Last Restocked</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {branchStock.length === 0 ? (
                        <TableMessageRow colSpan={5}>No stock records found</TableMessageRow>
                      ) : (
                        branchStock.map((stock: any) => {
                          const low = stock.quantity <= stock.min_quantity
                          return (
                            <Tr key={stock.id}>
                              <Td fontWeight="500">{stock.branch?.name || `Branch #${stock.branch_id}`}</Td>
                              <Td>{stock.quantity}</Td>
                              <Td>{stock.min_quantity}</Td>
                              <Td>
                                <Badge colorScheme={low ? 'red' : 'green'}>{low ? 'Low Stock' : 'In Stock'}</Badge>
                              </Td>
                              <Td>{stock.last_restocked ? new Date(stock.last_restocked).toLocaleDateString() : '-'}</Td>
                            </Tr>
                          )
                        })
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </SectionCard>
            </TabPanel>
          )}

          {!isNewProduct && (
            <TabPanel p="0">
              <SectionCard
                title={
                  <Flex align="center" gap="8px">
                    <Icon as={MdHistory} />
                    Price History
                  </Flex>
                }
              >
                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Date</Th>
                        <Th>Old Price</Th>
                        <Th>New Price</Th>
                        <Th>Changed By</Th>
                        <Th>Reason</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {priceHistory.length === 0 ? (
                        <TableMessageRow colSpan={5}>No price changes recorded</TableMessageRow>
                      ) : (
                        priceHistory.map((history: any) => (
                          <Tr key={history.id}>
                            <Td>{new Date(history.changed_at).toLocaleDateString()}</Td>
                            <Td>GH₵{history.old_price?.toLocaleString() || '0'}</Td>
                            <Td>GH₵{history.new_price?.toLocaleString()}</Td>
                            <Td>{history.changed_by?.first_name || '-'}</Td>
                            <Td>{history.reason || '-'}</Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </SectionCard>
            </TabPanel>
          )}

          {!isNewProduct && (
            <TabPanel p="0">
              <SectionCard
                title={
                  <Flex align="center" gap="8px">
                    <Icon as={MdTrendingUp} />
                    Sales Summary
                  </Flex>
                }
              >
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing="16px" mb="24px">
                  <RowBox display="block" p="16px">
                    <Text fontSize="sm" color="secondaryGray.600">
                      Total Units Sold
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold">
                      {salesData?.total_quantity || 0}
                    </Text>
                  </RowBox>
                  <RowBox display="block" p="16px">
                    <Text fontSize="sm" color="secondaryGray.600">
                      Total Revenue
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold">
                      GH₵{salesData?.total_revenue?.toLocaleString() || '0'}
                    </Text>
                  </RowBox>
                  <RowBox display="block" p="16px">
                    <Text fontSize="sm" color="secondaryGray.600">
                      Avg. Sale Price
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold">
                      GH₵{salesData?.total_quantity ? (salesData.total_revenue / salesData.total_quantity).toFixed(2) : '0'}
                    </Text>
                  </RowBox>
                </SimpleGrid>

                <Heading size="sm" mb="16px">
                  Recent Sales
                </Heading>
                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Date</Th>
                        <Th>Receipt #</Th>
                        <Th>Quantity</Th>
                        <Th>Unit Price</Th>
                        <Th>Total</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {!salesData?.history || salesData.history.length === 0 ? (
                        <TableMessageRow colSpan={5}>No sales recorded for this product</TableMessageRow>
                      ) : (
                        salesData.history.map((sale: any) => (
                          <Tr key={sale.id}>
                            <Td>{sale.date ? new Date(sale.date).toLocaleDateString() : '-'}</Td>
                            <Td fontFamily="mono">{sale.receipt_number}</Td>
                            <Td>{sale.quantity}</Td>
                            <Td>GH₵{sale.unit_price?.toLocaleString()}</Td>
                            <Td fontWeight="500">GH₵{sale.total?.toLocaleString()}</Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </SectionCard>
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>

      {/* Change Price Dialog */}
      <AppModal
        isOpen={isPriceDialogOpen}
        onClose={() => setIsPriceDialogOpen(false)}
        title="Change Product Price"
        footer={
          <>
            <Button variant="light" onClick={() => setIsPriceDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handlePriceChange} isLoading={updatePriceMutation.isPending} loadingText="Updating...">
              Update Price
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <InfoItem label="Current Price">
            <Text fontSize="xl" fontWeight="bold">
              GH₵{product?.unit_price?.toLocaleString() || '0'}
            </Text>
          </InfoItem>
          <Field label="New Price" isRequired>
            <Input
              variant="main"
              type="number"
              placeholder="Enter new price"
              value={priceForm.new_price}
              onChange={(e) => setPriceForm({ ...priceForm, new_price: e.target.value })}
            />
          </Field>
          <Field label="Reason for Change">
            <Textarea
              variant="main"
              rows={2}
              placeholder="Optional: explain the price change"
              value={priceForm.reason}
              onChange={(e) => setPriceForm({ ...priceForm, reason: e.target.value })}
            />
          </Field>
        </Stack>
      </AppModal>

      {/* Stock Adjustment Dialog */}
      <AppModal
        isOpen={isStockAdjustDialogOpen}
        onClose={() => setIsStockAdjustDialogOpen(false)}
        title="Adjust Stock Quantity"
        footer={
          <>
            <Button variant="light" onClick={() => setIsStockAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleStockAdjust} isLoading={adjustStockMutation.isPending} loadingText="Adjusting...">
              Adjust Stock
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Branch" isRequired>
            <Select
              variant="main"
              placeholder="Select branch"
              value={stockAdjustForm.branch_id}
              onChange={(e) => setStockAdjustForm({ ...stockAdjustForm, branch_id: e.target.value })}
            >
              {branches.map((b: any) => (
                <option key={b.id} value={b.id.toString()}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Adjustment Type">
            <Select variant="main" value={stockAdjustForm.adjustment_type} onChange={(e) => setStockAdjustForm({ ...stockAdjustForm, adjustment_type: e.target.value })}>
              <option value="add">Add Stock</option>
              <option value="remove">Remove Stock</option>
            </Select>
          </Field>
          <Field label="Quantity" isRequired>
            <Input
              variant="main"
              type="number"
              min="1"
              placeholder="Enter quantity"
              value={stockAdjustForm.quantity_change}
              onChange={(e) => setStockAdjustForm({ ...stockAdjustForm, quantity_change: e.target.value })}
            />
          </Field>
          <Field label="Reason" isRequired>
            <Select
              variant="main"
              placeholder="Select reason"
              value={stockAdjustForm.reason}
              onChange={(e) => setStockAdjustForm({ ...stockAdjustForm, reason: e.target.value })}
            >
              <option value="inventory_count">Inventory Count Correction</option>
              <option value="damaged">Damaged/Expired</option>
              <option value="returned">Customer Return</option>
              <option value="transfer_in">Transfer In</option>
              <option value="transfer_out">Transfer Out</option>
              <option value="new_stock">New Stock Received</option>
              <option value="theft_loss">Theft/Loss</option>
              <option value="other">Other</option>
            </Select>
          </Field>
        </Stack>
      </AppModal>
    </>
  )
}
