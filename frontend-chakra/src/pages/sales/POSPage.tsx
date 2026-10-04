import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  Icon,
  IconButton,
  Image,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { MdAdd, MdCreditCard, MdDelete, MdPerson, MdRemove, MdShoppingCart } from 'react-icons/md'
import { SalesReceiptModal } from '@/components/SalesReceiptModal'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/auth'
import Card from '@/components/card/Card'
import { RowBox } from '@/components/dashboard/widgets'
import { AppModal, EmptyState, Field, PaymentMethodPicker, SearchInput } from '@/components/ui'

interface CartItem {
  product_id: number
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  discount_percent: number
}

export default function POSPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuthStore()
  const borderColor = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const imageBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const visitBg = useColorModeValue('blue.50', 'whiteAlpha.100')

  const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name
  const isFrontdesk = roleName?.toLowerCase() === 'frontdesk' || roleName?.toLowerCase() === 'front desk'

  const [search, setSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [selectedVisit, setSelectedVisit] = useState<any>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [completedSale, setCompletedSale] = useState<any>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)

  const { data: products = [] } = useQuery({
    queryKey: ['pos-products', search, selectedCategoryId],
    queryFn: async () => {
      const params: Record<string, any> = { search }
      if (selectedCategoryId) params.category_id = selectedCategoryId
      return (await api.get('/sales/products', { params })).data
    },
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['pos-categories'],
    queryFn: async () => (await api.get('/sales/categories')).data,
  })

  // Fetch stock for branch 1 (TODO: use user's current branch)
  const { data: branchStock = [] } = useQuery({
    queryKey: ['pos-branch-stock'],
    queryFn: async () => (await api.get('/sales/stock/1')).data,
  })

  const getProductStock = (productId: number) => branchStock.find((s: any) => s.product_id === productId)?.quantity || 0

  const { data: customers = [] } = useQuery({
    queryKey: ['pos-customers', customerSearch],
    queryFn: async () => {
      if (customerSearch.length < 2) return []
      return (await api.get(`/patients/search?q=${customerSearch}`)).data
    },
    enabled: customerSearch.length >= 2,
  })

  // Fetch active visits for selected patient
  const { data: patientVisits = [] } = useQuery({
    queryKey: ['patient-active-visits', selectedCustomer?.id],
    queryFn: async () => (await api.get(`/checkout/patients/${selectedCustomer.id}/active-visits`)).data,
    enabled: !!selectedCustomer?.id,
    staleTime: 0, // Always refetch
    refetchOnMount: true,
  })

  const createSaleMutation = useMutation({
    mutationFn: (data: any) => api.post('/sales/create', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['branch-stock'] })
      queryClient.invalidateQueries({ queryKey: ['pos-products'] })
      queryClient.invalidateQueries({ queryKey: ['pos-branch-stock'] })

      // Store completed sale for receipt and show receipt modal
      setCompletedSale({
        ...response.data,
        items: cart.map((item, idx) => ({
          id: idx,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.unit_price * item.quantity * (item.discount_percent / 100),
          total: item.quantity * item.unit_price * (1 - item.discount_percent / 100),
          product: { name: item.product_name, sku: item.sku },
        })),
        patient: selectedCustomer,
      })
      setIsReceiptOpen(true)

      setCart([])
      setSelectedCustomer(null)
      setSelectedVisit(null)
      setDiscountPercent(0)
      setIsPaymentDialogOpen(false)
      setAmountPaid('')
      toast({ title: 'Sale completed successfully!', description: `Receipt: ${response.data.receipt_number}` })
    },
    onError: (error: any) => {
      toast({ title: 'Failed to complete sale', description: error.response?.data?.detail || 'Unknown error', variant: 'destructive' })
    },
  })

  const addToCart = (product: any) => {
    const stockQty = getProductStock(product.id)
    const existing = cart.find((item) => item.product_id === product.id)
    if ((existing?.quantity || 0) + 1 > stockQty) {
      toast({ title: `Only ${stockQty} in stock`, variant: 'destructive' })
      return
    }
    if (existing) {
      setCart(cart.map((item) => (item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item)))
    } else {
      setCart([
        ...cart,
        { product_id: product.id, product_name: product.name, sku: product.sku, quantity: 1, unit_price: parseFloat(product.unit_price), discount_percent: 0 },
      ])
    }
  }

  const updateQuantity = (productId: number, delta: number) => {
    const stockQty = getProductStock(productId)
    setCart(
      cart.map((item) => {
        if (item.product_id !== productId) return item
        const newQty = Math.max(1, item.quantity + delta)
        if (newQty > stockQty) {
          toast({ title: `Only ${stockQty} in stock`, variant: 'destructive' })
          return item
        }
        return { ...item, quantity: newQty }
      }),
    )
  }

  const subtotal = cart.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unit_price
    return sum + (itemTotal - itemTotal * (item.discount_percent / 100))
  }, 0)
  const discountAmount = subtotal * (discountPercent / 100)
  const total = subtotal - discountAmount
  const change = parseFloat(amountPaid || '0') - total

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      toast({ title: 'Cart is empty', variant: 'destructive' })
      return
    }
    if (parseFloat(amountPaid || '0') < total && paymentMethod === 'cash') {
      toast({ title: 'Insufficient payment amount', variant: 'destructive' })
      return
    }
    createSaleMutation.mutate({
      branch_id: 1, // TODO: Get from user's current branch
      patient_id: selectedCustomer?.id || null,
      visit_id: selectedVisit?.id || null,
      items: cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.unit_price * item.quantity * (item.discount_percent / 100),
      })),
      discount_percent: discountPercent,
      discount_amount: 0,
      payment_method: paymentMethod,
    })
  }

  const pill = (active: boolean) => ({
    variant: active ? 'brand' : 'light',
    size: 'sm',
    borderRadius: 'full',
    flexShrink: 0,
  })

  return (
    <Flex direction={{ base: 'column', lg: 'row' }} gap="20px" h={{ lg: 'calc(100vh - 150px)' }}>
      {/* Left side - Products */}
      <Flex flex="1" direction="column" minW="0" data-tour="products">
        <Heading size="lg" mb="12px" data-tour="page-title">
          Point of Sale
        </Heading>
        <SearchInput maxW="100%" size="lg" placeholder="Search products by name or SKU..." value={search} onChange={setSearch} />
        {categories.length > 0 && (
          <Flex gap="8px" overflowX="auto" mt="12px" pb="4px" className="thin-scrollbar">
            <Button {...pill(selectedCategoryId === null)} onClick={() => setSelectedCategoryId(null)}>
              All
            </Button>
            {categories.map((cat: any) => (
              <Button key={cat.id} {...pill(selectedCategoryId === cat.id)} onClick={() => setSelectedCategoryId(cat.id)}>
                {cat.name}
              </Button>
            ))}
          </Flex>
        )}

        <Box flex="1" overflowY="auto" mt="16px" className="thin-scrollbar">
          <SimpleGrid columns={{ base: 2, md: 3, xl: 4 }} spacing="12px">
            {products.map((product: any) => {
              const stockQty = getProductStock(product.id)
              const isOutOfStock = stockQty <= 0
              return (
                <Card
                  key={product.id}
                  p="16px"
                  cursor={isOutOfStock ? 'not-allowed' : 'pointer'}
                  opacity={isOutOfStock ? 0.5 : 1}
                  border="2px solid"
                  borderColor="transparent"
                  _hover={{ borderColor: 'brand.400' }}
                  transition="border-color 0.15s"
                  onClick={() => !isOutOfStock && addToCart(product)}
                >
                  <Flex
                    position="relative"
                    align="center"
                    justify="center"
                    bg={imageBg}
                    borderRadius="12px"
                    mb="8px"
                    overflow="hidden"
                    sx={{ aspectRatio: '1 / 1' }}
                  >
                    {product.image_url ? (
                      <Image src={product.image_url} alt={product.name} w="100%" h="100%" objectFit="cover" />
                    ) : (
                      <Icon as={MdShoppingCart} w="32px" h="32px" color="secondaryGray.600" />
                    )}
                    <Badge
                      position="absolute"
                      top="4px"
                      right="4px"
                      fontSize="xs"
                      colorScheme={stockQty > 10 ? 'green' : stockQty > 0 ? 'orange' : 'red'}
                    >
                      {stockQty} in stock
                    </Badge>
                  </Flex>
                  <Text fontWeight="500" fontSize="sm" noOfLines={1}>
                    {product.name}
                  </Text>
                  <Text fontSize="xs" color="secondaryGray.600">
                    {product.sku}
                  </Text>
                  <Text fontWeight="bold" color="brand.500" mt="4px">
                    GH₵{product.unit_price?.toLocaleString()}
                  </Text>
                </Card>
              )
            })}
          </SimpleGrid>
          {products.length === 0 && <EmptyState>{search ? 'No products found' : 'Start typing to search products'}</EmptyState>}
        </Box>
      </Flex>

      {/* Right side - Cart */}
      <Card w={{ base: '100%', lg: '384px' }} p="0" data-tour="cart">
        <Box p="16px" borderBottom="1px solid" borderColor={borderColor}>
          <Flex justify="space-between" align="center" mb="8px">
            <Heading size="md" display="flex" alignItems="center" gap="8px">
              <Icon as={MdShoppingCart} />
              Cart ({cart.length})
            </Heading>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCart([])}>
                Clear
              </Button>
            )}
          </Flex>

          {/* Customer Selection */}
          <RowBox cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => setIsCustomerDialogOpen(true)}>
            {selectedCustomer ? (
              <Flex align="center" gap="8px" w="100%">
                <Icon as={MdPerson} />
                <Text fontWeight="500">
                  {selectedCustomer.first_name} {selectedCustomer.last_name}
                </Text>
                <Badge ms="auto">{selectedCustomer.patient_number}</Badge>
              </Flex>
            ) : (
              <Flex align="center" gap="8px" color="secondaryGray.600">
                <Icon as={MdPerson} />
                <Text>Select Customer (Optional)</Text>
              </Flex>
            )}
          </RowBox>
        </Box>

        {/* Visit Selection - shows when patient has active visits */}
        {selectedCustomer && patientVisits.length > 0 && (
          <Box px="16px" pt="12px">
            <Field label="Link to Active Visit (Optional)" helper="Link to visit if patient is here for consultation. Leave as walk-in for direct purchases.">
              <Select
                variant="main"
                size="sm"
                bg={visitBg}
                value={selectedVisit?.id || ''}
                onChange={(e) => setSelectedVisit(patientVisits.find((v: any) => v.id === parseInt(e.target.value)) || null)}
              >
                <option value="">Walk-in Purchase (no visit)</option>
                {patientVisits.map((visit: any) => (
                  <option key={visit.id} value={visit.id}>
                    {visit.visit_number} - {visit.visit_date?.split('T')[0]} ({visit.status})
                  </option>
                ))}
              </Select>
            </Field>
          </Box>
        )}

        {/* Cart Items */}
        <Box flex="1" overflowY="auto" p="16px" minH={{ base: '160px', lg: 0 }} className="thin-scrollbar">
          {cart.length === 0 ? (
            <EmptyState icon={MdShoppingCart} title="Cart is empty">
              Click products to add them
            </EmptyState>
          ) : (
            <Stack spacing="12px">
              {cart.map((item) => (
                <RowBox key={item.product_id} p="8px" gap="8px">
                  <Box flex="1" minW="0">
                    <Text fontWeight="500" fontSize="sm" noOfLines={1}>
                      {item.product_name}
                    </Text>
                    <Text fontSize="xs" color="secondaryGray.600">
                      GH₵{item.unit_price.toLocaleString()} each
                    </Text>
                  </Box>
                  <Flex align="center" gap="4px">
                    <IconButton aria-label="Decrease" variant="light" size="xs" icon={<MdRemove />} onClick={() => updateQuantity(item.product_id, -1)} />
                    <Text w="32px" textAlign="center" fontWeight="500">
                      {item.quantity}
                    </Text>
                    <IconButton aria-label="Increase" variant="light" size="xs" icon={<MdAdd />} onClick={() => updateQuantity(item.product_id, 1)} />
                  </Flex>
                  <Text fontWeight="500" w="80px" textAlign="right">
                    GH₵{(item.quantity * item.unit_price).toLocaleString()}
                  </Text>
                  <IconButton
                    aria-label="Remove"
                    variant="ghost"
                    size="xs"
                    color="red.500"
                    icon={<MdDelete />}
                    onClick={() => setCart(cart.filter((i) => i.product_id !== item.product_id))}
                  />
                </RowBox>
              ))}
            </Stack>
          )}
        </Box>

        {/* Cart Summary */}
        <Stack spacing="12px" p="16px" borderTop="1px solid" borderColor={borderColor} data-tour="payment">
          <Flex justify="space-between" fontSize="sm">
            <Text>Subtotal</Text>
            <Text>GH₵{subtotal.toLocaleString()}</Text>
          </Flex>
          {!isFrontdesk && (
            <Flex align="center" gap="8px">
              <Text fontSize="sm">Discount</Text>
              <Input
                variant="main"
                type="number"
                size="sm"
                w="64px"
                textAlign="center"
                min={0}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
              />
              <Text fontSize="sm">%</Text>
              <Text ms="auto" fontSize="sm">
                -GH₵{discountAmount.toLocaleString()}
              </Text>
            </Flex>
          )}
          <Divider />
          <Flex justify="space-between" fontWeight="bold" fontSize="lg">
            <Text>Total</Text>
            <Text color="brand.500">GH₵{total.toLocaleString()}</Text>
          </Flex>
          <Button variant="brand" h="48px" fontSize="lg" leftIcon={<MdCreditCard />} isDisabled={cart.length === 0} onClick={() => setIsPaymentDialogOpen(true)}>
            Checkout
          </Button>
        </Stack>
      </Card>

      {/* Customer Selection Dialog */}
      <AppModal
        isOpen={isCustomerDialogOpen}
        onClose={() => setIsCustomerDialogOpen(false)}
        title="Select Customer"
        footer={
          <Button
            variant="light"
            onClick={() => {
              setSelectedCustomer(null)
              setIsCustomerDialogOpen(false)
            }}
          >
            Continue without customer
          </Button>
        }
      >
        <Stack spacing="16px">
          <SearchInput maxW="100%" placeholder="Search by name or phone..." value={customerSearch} onChange={setCustomerSearch} />
          <Stack spacing="8px" maxH="256px" overflowY="auto">
            {customers.map((customer: any) => (
              <RowBox
                key={customer.id}
                display="block"
                cursor="pointer"
                _hover={{ bg: hoverBg }}
                onClick={() => {
                  setSelectedCustomer(customer)
                  setIsCustomerDialogOpen(false)
                  setCustomerSearch('')
                }}
              >
                <Text fontWeight="500">
                  {customer.first_name} {customer.last_name}
                </Text>
                <Text fontSize="sm" color="secondaryGray.600">
                  {customer.phone} • {customer.patient_number}
                </Text>
              </RowBox>
            ))}
            {customerSearch.length >= 2 && customers.length === 0 && (
              <Text textAlign="center" py="16px" color="secondaryGray.600">
                No customers found
              </Text>
            )}
          </Stack>
        </Stack>
      </AppModal>

      {/* Payment Dialog */}
      <AppModal
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        title="Complete Payment"
        footer={
          <>
            <Button variant="light" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" minW="128px" isLoading={createSaleMutation.isPending} loadingText="Processing..." onClick={handleCompleteSale}>
              Complete Sale
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Box textAlign="center" py="16px">
            <Text fontSize="sm" color="secondaryGray.600">
              Total Amount
            </Text>
            <Text fontSize="4xl" fontWeight="bold" color="brand.500">
              GH₵{total.toLocaleString()}
            </Text>
          </Box>
          <Field label="Payment Method">
            <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
          </Field>
          {paymentMethod === 'cash' && (
            <>
              <Field label="Amount Received">
                <Input variant="main" type="number" h="48px" fontSize="lg" placeholder="Enter amount" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
              </Field>
              {parseFloat(amountPaid || '0') >= total && (
                <Box p="12px" bg="green.50" border="1px solid" borderColor="green.200" borderRadius="12px" textAlign="center">
                  <Text fontSize="sm" color="green.600">
                    Change
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold" color="green.700">
                    GH₵{change.toLocaleString()}
                  </Text>
                </Box>
              )}
            </>
          )}
        </Stack>
      </AppModal>

      <SalesReceiptModal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} sale={completedSale} />
    </Flex>
  )
}
