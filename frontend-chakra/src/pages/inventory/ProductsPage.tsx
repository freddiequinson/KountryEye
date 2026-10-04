import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormLabel,
  Heading,
  Icon,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react'
import { MdAdd, MdArrowBack, MdDelete, MdDownload, MdTune, MdUpload } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import { AppModal, ConfirmDialog, Field, Pagination, SearchInput, TableMessageRow } from '@/components/ui'

const ITEMS_PER_PAGE = 20
const categoryScheme: Record<string, string> = { medication: 'blue', optical: 'purple' }

const emptyMapping: Record<string, string> = {
  name: '',
  sku: '',
  category: '',
  cost_price: '',
  unit_price: '',
  description: '',
  stock_quantity: '',
  branch_id: '',
}

const MAPPING_FIELDS = [
  { key: 'name', label: 'Product Name *' },
  { key: 'sku', label: 'SKU' },
  { key: 'category', label: 'Category' },
  { key: 'cost_price', label: 'Cost Price' },
  { key: 'unit_price', label: 'Sale Price *' },
  { key: 'description', label: 'Description' },
  { key: 'stock_quantity', label: 'Stock Quantity' },
  { key: 'branch_id', label: 'Branch ID' },
]

const COLUMN_LABELS = {
  sku: 'SKU',
  name: 'Name',
  category: 'Category',
  costPrice: 'Cost Price',
  salePrice: 'Sale Price',
  totalStock: 'Total Stock',
  warehouseStock: 'Warehouse Stock',
  branchStock: 'Branches Stock',
  status: 'Status',
}

const qtyScheme = (qty: number, high = 10) => (qty > high ? 'green' : qty > 0 ? 'orange' : 'red')

export default function ProductsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const dropBorder = useColorModeValue('secondaryGray.400', 'whiteAlpha.300')

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(emptyMapping)
  const [showMapping, setShowMapping] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<keyof typeof COLUMN_LABELS, boolean>>({
    sku: true,
    name: true,
    category: true,
    costPrice: true,
    salePrice: true,
    totalStock: true,
    warehouseStock: true,
    branchStock: true,
    status: true,
  })
  const [showBranchStock, setShowBranchStock] = useState<number[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [productToDelete, setProductToDelete] = useState<number | null>(null)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search, categoryFilter],
    queryFn: async () => {
      const params: any = {}
      if (search) params.search = search
      if (categoryFilter && categoryFilter !== 'all') params.category_id = categoryFilter
      return (await api.get('/sales/products', { params })).data
    },
  })

  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE)
  const paginatedProducts = products.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => (await api.get('/sales/categories')).data,
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches')).data,
  })

  const { data: allStock = [] } = useQuery({
    queryKey: ['all-branch-stock'],
    queryFn: async () => {
      const stockData: any[] = []
      for (const branch of branches) {
        const response = await api.get(`/sales/stock/${branch.id}`)
        stockData.push(...response.data.map((s: any) => ({ ...s, branch_name: branch.name })))
      }
      return stockData
    },
    enabled: branches.length > 0,
  })

  const { data: stockSummary = [] } = useQuery({
    queryKey: ['stock-summary'],
    queryFn: async () => (await api.get('/inventory/stock-summary')).data,
  })

  const getProductStock = (productId: number) => {
    const stocks = allStock.filter((s: any) => s.product_id === productId)
    const branchTotal = stocks.reduce((sum: number, s: any) => sum + s.quantity, 0)
    const warehouseTotal = stockSummary.find((s: any) => s.product_id === productId)?.warehouse_stock || 0
    return { branchTotal, warehouseTotal, total: warehouseTotal + branchTotal, byBranch: stocks }
  }

  const deleteProductMutation = useMutation({
    mutationFn: (productId: number) => api.delete(`/sales/products/${productId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setProductToDelete(null)
      toast({ title: 'Product deleted successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to delete product', variant: 'destructive' })
    },
  })

  const exportProducts = async (format: 'csv' | 'xlsx') => {
    try {
      const response = await api.get(`/sales/products/export?format=${format}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `products.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    }
  }

  const closeImportDialog = () => {
    setIsImportDialogOpen(false)
    setCsvFile(null)
    setImportResult(null)
    setCsvHeaders([])
    setShowMapping(false)
    setColumnMapping(emptyMapping)
  }

  const handleCsvSelected = async (file: File | null) => {
    setCsvFile(file)
    if (!file) return
    const headers = (await file.text())
      .split('\n')[0]
      .split(',')
      .map((h) => h.trim().replace(/"/g, ''))
    setCsvHeaders(headers)
    // Auto-map columns if names match
    const newMapping = { ...columnMapping }
    headers.forEach((h) => {
      const lower = h.toLowerCase()
      if (lower.includes('name') && !lower.includes('category')) newMapping.name = h
      if (lower.includes('sku')) newMapping.sku = h
      if (lower.includes('category')) newMapping.category = h
      if (lower.includes('cost')) newMapping.cost_price = h
      if (lower.includes('price') && !lower.includes('cost')) newMapping.unit_price = h
      if (lower.includes('desc')) newMapping.description = h
      if (lower.includes('stock') || lower.includes('quantity') || lower.includes('qty')) newMapping.stock_quantity = h
    })
    setColumnMapping(newMapping)
  }

  const handleImport = async () => {
    if (!csvFile) return
    const formData = new FormData()
    formData.append('file', csvFile)
    formData.append('column_mapping', JSON.stringify(columnMapping))
    try {
      const response = await api.post('/sales/products/import-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImportResult(response.data)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['branch-stock'] })
      queryClient.invalidateQueries({ queryKey: ['all-branch-stock'] })
      toast({ title: `Imported ${response.data.created} products, ${response.data.stock_records || 0} stock records` })
    } catch (error: any) {
      toast({ title: 'Import failed', description: error.response?.data?.detail || 'Unknown error', variant: 'destructive' })
    }
  }

  const colCount = 10 + showBranchStock.length

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate('/inventory')} mb="8px">
        Back
      </Button>
      <PageHeader
        title="Products"
        actions={
          <>
            <Button variant="light" leftIcon={<MdDownload />} onClick={() => exportProducts('csv')}>
              Export CSV
            </Button>
            <Button variant="light" leftIcon={<MdDownload />} onClick={() => exportProducts('xlsx')}>
              Export Excel
            </Button>
            <Button variant="light" leftIcon={<MdUpload />} onClick={() => setIsImportDialogOpen(true)}>
              Import CSV
            </Button>
            <Button variant="brand" leftIcon={<MdAdd />} onClick={() => navigate('/inventory/products/new')}>
              Add Product
            </Button>
          </>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px" mb="20px">
        <StatCard name="Total Products" value={products.length} />
        <StatCard name="Active" value={products.filter((p: any) => p.is_active).length} valueColor="green.500" />
        <StatCard name="Categories" value={categories.length} />
        <StatCard name="Branches" value={branches.length} />
      </SimpleGrid>

      <Card>
        <Flex gap="12px" mb="16px" wrap="wrap">
          <SearchInput
            flex="1"
            maxW="100%"
            placeholder="Search products..."
            value={search}
            onChange={(v) => {
              setSearch(v)
              setCurrentPage(1)
            }}
          />
          <Select
            variant="main"
            w={{ base: '100%', md: '224px' }}
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="all">All Categories</option>
            {categories.map((cat: any) => (
              <option key={cat.id} value={cat.id.toString()}>
                {cat.name} ({cat.category_type || 'general'})
              </option>
            ))}
          </Select>
          <Button variant="light" leftIcon={<MdTune />} onClick={() => setIsColumnDialogOpen(true)}>
            Columns
          </Button>
        </Flex>

        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                {visibleColumns.sku && <Th>SKU</Th>}
                {visibleColumns.name && <Th>Name</Th>}
                {visibleColumns.category && <Th>Category</Th>}
                {visibleColumns.costPrice && <Th>Cost Price</Th>}
                {visibleColumns.salePrice && <Th>Sale Price</Th>}
                {visibleColumns.totalStock && <Th>Total</Th>}
                {visibleColumns.warehouseStock && <Th>Warehouse</Th>}
                {visibleColumns.branchStock && <Th>Branches</Th>}
                {showBranchStock.map((branchId) => (
                  <Th key={branchId}>{branches.find((b: any) => b.id === branchId)?.name || `Branch ${branchId}`}</Th>
                ))}
                {visibleColumns.status && <Th>Status</Th>}
                <Th w="64px">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <TableMessageRow colSpan={colCount} loading />
              ) : paginatedProducts.length === 0 ? (
                <TableMessageRow colSpan={colCount}>No products found</TableMessageRow>
              ) : (
                paginatedProducts.map((product: any) => {
                  const stock = getProductStock(product.id)
                  return (
                    <Tr key={product.id} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => navigate(`/inventory/products/${product.id}`)}>
                      {visibleColumns.sku && <Td fontFamily="mono">{product.sku}</Td>}
                      {visibleColumns.name && <Td fontWeight="600">{product.name}</Td>}
                      {visibleColumns.category && (
                        <Td>
                          <Stack spacing="4px">
                            <Text>{product.category?.name || '-'}</Text>
                            {product.category?.category_type && (
                              <Badge colorScheme={categoryScheme[product.category.category_type] || 'gray'} variant="outline" fontSize="xs" w="fit-content">
                                {product.category.category_type}
                              </Badge>
                            )}
                          </Stack>
                        </Td>
                      )}
                      {visibleColumns.costPrice && <Td>GH₵{product.cost_price?.toLocaleString() || '0'}</Td>}
                      {visibleColumns.salePrice && <Td>GH₵{product.unit_price?.toLocaleString() || '0'}</Td>}
                      {visibleColumns.totalStock && (
                        <Td>
                          <Badge colorScheme={qtyScheme(stock.total)}>{stock.total}</Badge>
                        </Td>
                      )}
                      {visibleColumns.warehouseStock && (
                        <Td>
                          <Badge colorScheme={stock.warehouseTotal > 10 ? 'gray' : stock.warehouseTotal > 0 ? 'orange' : 'gray'} variant={stock.warehouseTotal ? 'subtle' : 'outline'}>
                            {stock.warehouseTotal}
                          </Badge>
                        </Td>
                      )}
                      {visibleColumns.branchStock && (
                        <Td>
                          <Badge colorScheme={qtyScheme(stock.branchTotal)}>{stock.branchTotal}</Badge>
                        </Td>
                      )}
                      {showBranchStock.map((branchId) => {
                        const qty = stock.byBranch.find((s: any) => s.branch_id === branchId)?.quantity || 0
                        return (
                          <Td key={branchId}>
                            <Badge colorScheme={qty > 5 ? 'gray' : qty > 0 ? 'orange' : 'red'}>{qty}</Badge>
                          </Td>
                        )
                      })}
                      {visibleColumns.status && (
                        <Td>
                          <Badge colorScheme={product.is_active ? 'green' : 'red'}>{product.is_active ? 'Active' : 'Inactive'}</Badge>
                        </Td>
                      )}
                      <Td>
                        <IconButton
                          aria-label="Delete product"
                          variant="ghost"
                          size="sm"
                          color="red.500"
                          icon={<MdDelete />}
                          onClick={(e) => {
                            e.stopPropagation()
                            setProductToDelete(product.id)
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
        <Pagination page={currentPage} totalPages={totalPages} total={products.length} perPage={ITEMS_PER_PAGE} onChange={setCurrentPage} />
      </Card>

      <ConfirmDialog
        isOpen={productToDelete !== null}
        onClose={() => setProductToDelete(null)}
        onConfirm={() => productToDelete !== null && deleteProductMutation.mutate(productToDelete)}
        isLoading={deleteProductMutation.isPending}
        title="Delete Product"
      >
        Are you sure you want to delete this product?
      </ConfirmDialog>

      {/* Import CSV Dialog */}
      <AppModal
        isOpen={isImportDialogOpen}
        onClose={closeImportDialog}
        size="2xl"
        title="Import Products from CSV"
        footer={
          <>
            <Button variant="light" onClick={closeImportDialog}>
              {importResult ? 'Close' : 'Cancel'}
            </Button>
            {!importResult && csvFile && (
              <Button variant="brand" isDisabled={!columnMapping.name || !columnMapping.unit_price} onClick={handleImport}>
                Import Products
              </Button>
            )}
          </>
        }
      >
        {!importResult ? (
          !showMapping ? (
            <Stack spacing="16px">
              <Flex direction="column" align="center" border="2px dashed" borderColor={dropBorder} borderRadius="16px" p="32px" textAlign="center">
                <Icon as={MdUpload} w="48px" h="48px" color="secondaryGray.600" mb="16px" />
                <Text fontSize="sm" color="secondaryGray.600" mb="8px">
                  {csvFile ? csvFile.name : 'Select a CSV file to import'}
                </Text>
                <Input type="file" accept=".csv" maxW="320px" pt="4px" onChange={(e) => handleCsvSelected(e.target.files?.[0] || null)} />
              </Flex>
              {csvFile && csvHeaders.length > 0 && (
                <Button variant="light" w="100%" leftIcon={<MdTune />} onClick={() => setShowMapping(true)}>
                  Configure Column Mapping
                </Button>
              )}
            </Stack>
          ) : (
            <Stack spacing="16px">
              <Flex justify="space-between" align="center">
                <Heading size="sm">Map CSV Columns</Heading>
                <Button variant="ghost" size="sm" onClick={() => setShowMapping(false)}>
                  Back
                </Button>
              </Flex>
              <Text fontSize="sm" color="secondaryGray.600">
                Match your CSV columns to the product fields
              </Text>
              <Stack spacing="12px">
                {MAPPING_FIELDS.map(({ key, label }) => (
                  <Flex key={key} align="center" gap="16px">
                    <FormLabel w="128px" m="0">
                      {label}
                    </FormLabel>
                    <Select variant="main" flex="1" value={columnMapping[key] || ''} onChange={(e) => setColumnMapping({ ...columnMapping, [key]: e.target.value })}>
                      <option value="">-- None --</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </Flex>
                ))}
              </Stack>
            </Stack>
          )
        ) : (
          <Stack spacing="16px">
            <SimpleGrid columns={2} spacing="16px">
              <StatCard name={<Text color="green.500">Created</Text>} value={importResult.created} />
              <StatCard name={<Text color="blue.500">Updated</Text>} value={importResult.updated} />
            </SimpleGrid>
            {importResult.total_errors > 0 && (
              <Box p="16px" bg="red.50" border="1px solid" borderColor="red.200" borderRadius="12px">
                <Text fontWeight="500" color="red.800" mb="8px">
                  {importResult.total_errors} errors occurred
                </Text>
                <Stack as="ul" spacing="4px" fontSize="sm" color="red.600" ps="16px">
                  {importResult.errors.map((err: string, i: number) => (
                    <li key={i}>{err}</li>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </AppModal>

      {/* Column Settings Dialog */}
      <AppModal
        isOpen={isColumnDialogOpen}
        onClose={() => setIsColumnDialogOpen(false)}
        title="Column Settings"
        footer={
          <Button variant="light" onClick={() => setIsColumnDialogOpen(false)}>
            Close
          </Button>
        }
      >
        <Stack spacing="16px">
          <Field label="Visible Columns">
            <SimpleGrid columns={2} spacing="8px">
              {(Object.entries(COLUMN_LABELS) as [keyof typeof COLUMN_LABELS, string][]).map(([key, label]) => (
                <Checkbox key={key} isChecked={visibleColumns[key]} onChange={(e) => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}>
                  <Text fontSize="sm">{label}</Text>
                </Checkbox>
              ))}
            </SimpleGrid>
          </Field>
          <Field label="Show Stock by Branch">
            <SimpleGrid columns={2} spacing="8px">
              {branches.map((branch: any) => (
                <Checkbox
                  key={branch.id}
                  isChecked={showBranchStock.includes(branch.id)}
                  onChange={(e) =>
                    setShowBranchStock(e.target.checked ? [...showBranchStock, branch.id] : showBranchStock.filter((id) => id !== branch.id))
                  }
                >
                  <Text fontSize="sm">{branch.name}</Text>
                </Checkbox>
              ))}
            </SimpleGrid>
          </Field>
        </Stack>
      </AppModal>
    </>
  )
}
