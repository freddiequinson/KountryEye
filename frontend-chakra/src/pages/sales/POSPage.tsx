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
  InputGroup,
  InputLeftElement,
  Select,
  SimpleGrid,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { MdAdd, MdCreditCard, MdDelete, MdPerson, MdRemove, MdSearch, MdShoppingCart } from 'react-icons/md'
import { SalesReceiptModal } from '@/components/SalesReceiptModal'
import api from '@/lib/api'
import { useVatRate } from '@/hooks/use-vat-rate'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/auth'
import Card from '@/components/card/Card'
import ProductCard from '@/components/card/ProductCard'
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
  const vatRate = useVatRate()
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
  // Cart prices are base prices; everything on screen is shown with VAT added, matching what the backend charges.
  const withVat = (amount: number) => amount * (1 + vatRate / 100)
  const money = (amount: number) => `GH₵${withVat(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  const netAmount = subtotal - discountAmount
  const total = netAmount + Math.round(netAmount * vatRate) / 100
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

  const productImage = (id: number) => products.find((p: any) => p.id === id)?.image_url as string | undefined

  const pill = (active: boolean) => ({
    variant: 'unstyled',
    h: 'auto',
    minW: 'auto',
    flexShrink: 0,
    fontSize: 'md',
    fontWeight: active ? '700' : '500',
    color: active ? 'brand.600' : 'secondaryGray.600',
    borderBottom: '2px solid',
    borderColor: active ? 'brand.500' : 'transparent',
    borderRadius: 0,
    pb: '4px',
    _hover: { color: 'brand.600' },
  })

  return (
    <Flex direction={{ base: 'column', xl: 'row' }} gap="20px" align="start">
      {/* Left side - Products */}
      <Flex flex="1" direction="column" minW="0" w="100%" data-tour="products">
        {/* Banner, after Horizon's marketplace banner */}
        <Box position="relative" overflow="hidden" borderRadius="30px" color="white" bg="linear-gradient(120deg, #0B2415 0%, #14472A 50%, #2F7A3F 100%)" px={{ base: '22px', md: '40px' }} py={{ base: '26px', md: '40px' }}>
          <Box position="absolute" top="-110px" right="-40px" w="320px" h="320px" borderRadius="full" border="1px solid rgba(255,255,255,0.1)" />
          <Box position="absolute" bottom="-90px" right="18%" w="220px" h="220px" borderRadius="full" bg="rgba(12, 192, 223, 0.22)" filter="blur(50px)" />
          <Box position="relative" maxW="560px">
            <Heading as="h1" fontSize={{ base: '26px', md: '34px' }} fontWeight="700" lineHeight="1.2" data-tour="page-title">
              Point of Sale
            </Heading>
            <Text fontSize="md" fontWeight="500" color="whiteAlpha.800" mt="8px" mb="20px">
              Find frames, lenses and eye care products, add them to the cart and take payment.
            </Text>
            <InputGroup size="lg">
              <InputLeftElement pointerEvents="none">
                <Icon as={MdSearch} color="secondaryGray.500" />
              </InputLeftElement>
              <Input bg="white" color="secondaryGray.900" border="none" borderRadius="16px" fontSize="md" fontWeight="500" placeholder="Search products by name or SKU..." _placeholder={{ color: 'secondaryGray.500' }} value={search} onChange={(e) => setSearch(e.target.value)} />
            </InputGroup>
          </Box>
        </Box>

        <Flex mt="34px" mb="20px" justify="space-between" direction={{ base: 'column', md: 'row' }} align={{ base: 'start', md: 'center' }} gap="12px">
          <Text fontSize="2xl" fontWeight="700" ms={{ md: '8px' }} flexShrink={0}>
            {selectedCategoryId === null ? 'All Products' : categories.find((c: any) => c.id === selectedCategoryId)?.name}
            <Text as="span" fontSize="md" fontWeight="500" color="secondaryGray.600" ms="10px">
              {products.length}
            </Text>
          </Text>
          {categories.length > 0 && (
            <Flex gap={{ base: '22px', md: '32px' }} overflowX="auto" maxW="100%" pb="4px" className="thin-scrollbar">
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
        </Flex>

        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing="20px">
          {products.map((product: any) => (
            <ProductCard
              key={product.id}
              image={product.image_url}
              name={product.name}
              sub={product.sku}
              price={money(parseFloat(product.unit_price) || 0)}
              stock={getProductStock(product.id)}
              onAdd={() => addToCart(product)}
            />
          ))}
        </SimpleGrid>
        {products.length === 0 && (
          <Card>
            <EmptyState icon={MdShoppingCart}>{search ? 'No products found' : 'Start typing to search products'}</EmptyState>
          </Card>
        )}
      </Flex>

      {/* Right side - Cart */}
      <Card w={{ base: '100%', xl: '400px' }} flexShrink={0} p="0" position={{ xl: 'sticky' }} top={{ xl: '96px' }} maxH={{ xl: 'calc(100vh - 116px)' }} data-tour="cart">
        <Box p="20px" pb="16px">
          <Flex justify="space-between" align="center" mb="14px">
            <Text fontSize="22px" fontWeight="700" lineHeight="100%">
              Cart
              <Text as="span" fontSize="md" fontWeight="500" color="secondaryGray.600" ms="8px">
                {cart.length} item{cart.length === 1 ? '' : 's'}
              </Text>
            </Text>
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
        <Box flex="1" overflowY="auto" px="20px" py="12px" minH="160px" className="thin-scrollbar">
          {cart.length === 0 ? (
            <EmptyState icon={MdShoppingCart} title="Cart is empty">
              Click products to add them
            </EmptyState>
          ) : (
            <Stack spacing="16px">
              {cart.map((item) => (
                <Flex key={item.product_id} align="center" gap="12px">
                  <Flex w="52px" h="52px" minW="52px" borderRadius="16px" bg={imageBg} align="center" justify="center" overflow="hidden">
                    {productImage(item.product_id) ? <Image src={productImage(item.product_id)} alt="" w="100%" h="100%" objectFit="cover" /> : <Icon as={MdShoppingCart} color="secondaryGray.500" />}
                  </Flex>
                  <Box flex="1" minW="0">
                    <Text fontWeight="700" fontSize="sm" noOfLines={1}>
                      {item.product_name}
                    </Text>
                    <Text fontSize="xs" color="secondaryGray.600">
                      {money(item.unit_price)} each
                    </Text>
                    <Flex align="center" gap="6px" mt="6px">
                      <IconButton aria-label="Decrease" variant="light" size="xs" borderRadius="full" icon={<MdRemove />} onClick={() => updateQuantity(item.product_id, -1)} />
                      <Text minW="24px" textAlign="center" fontWeight="700" fontSize="sm">
                        {item.quantity}
                      </Text>
                      <IconButton aria-label="Increase" variant="light" size="xs" borderRadius="full" icon={<MdAdd />} onClick={() => updateQuantity(item.product_id, 1)} />
                    </Flex>
                  </Box>
                  <Flex direction="column" align="end" gap="6px">
                    <Text fontWeight="700" fontSize="md">
                      {money(item.quantity * item.unit_price)}
                    </Text>
                    <IconButton aria-label="Remove" variant="ghost" size="xs" color="red.500" icon={<MdDelete />} onClick={() => setCart(cart.filter((i) => i.product_id !== item.product_id))} />
                  </Flex>
                </Flex>
              ))}
            </Stack>
          )}
        </Box>

        {/* Cart Summary */}
        <Stack spacing="12px" p="20px" borderTop="1px solid" borderColor={borderColor} data-tour="payment">
          <Flex justify="space-between" fontSize="sm">
            <Text>Subtotal</Text>
            <Text>{money(subtotal)}</Text>
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
                -{money(discountAmount)}
              </Text>
            </Flex>
          )}
          <Divider />
          <Flex justify="space-between" align="center" fontWeight="bold">
            <Text fontSize="lg">Total</Text>
            <Text fontSize="2xl" color="brand.600" _dark={{ color: "white" }}>GH₵{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
          </Flex>
          <Button variant="brand" size="lg" leftIcon={<MdCreditCard />} isDisabled={cart.length === 0} onClick={() => setIsPaymentDialogOpen(true)}>
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
              GH₵{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
                    GH₵{change.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
