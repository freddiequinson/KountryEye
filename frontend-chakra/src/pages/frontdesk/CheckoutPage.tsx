import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  Icon,
  IconButton,
  Input,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import {
  MdArrowBack,
  MdCheckCircle,
  MdCreditCard,
  MdDownload,
  MdErrorOutline,
  MdInventory2,
  MdLogout,
  MdPerson,
  MdPrint,
  MdReceipt,
  MdVisibility,
} from 'react-icons/md'
import { FaStethoscope } from 'react-icons/fa'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { RowBox } from '@/components/dashboard/widgets'
import { AppModal, Field, PaymentMethodPicker } from '@/components/ui'

const statusScheme = (ok: boolean) => (ok ? 'green' : 'gray')

function IconTitle({ icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Flex align="center" gap="8px">
      <Icon as={icon} />
      {children}
    </Flex>
  )
}

function TotalRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <Divider />
      <Flex justify="space-between" pt="4px">
        <Text fontWeight="500">{label}</Text>
        {children}
      </Flex>
    </>
  )
}

export default function CheckoutPage() {
  const { visitId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const mutedBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false)
  const [isDebtConfirmDialogOpen, setIsDebtConfirmDialogOpen] = useState(false)
  const [debtInfo, setDebtInfo] = useState<{ total_debt: number; message: string } | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  const { data: summary, isLoading } = useQuery({
    queryKey: ['checkout-summary', visitId],
    queryFn: async () => (await api.get(`/checkout/visits/${visitId}/checkout-summary`)).data,
    enabled: !!visitId,
  })

  // Fetch prescriptions for this visit
  const { data: prescriptions = [] } = useQuery({
    queryKey: ['visit-prescriptions', visitId],
    queryFn: async () => (await api.get(`/clinical/visits/${visitId}/prescriptions`)).data,
    enabled: !!visitId,
  })

  const paymentMutation = useMutation({
    mutationFn: (data: { amount: number; payment_method: string }) => api.post(`/checkout/visits/${visitId}/checkout`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkout-summary', visitId] })
      setIsPaymentDialogOpen(false)
      setPaymentAmount('')
      toast({ title: 'Payment recorded successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to record payment', variant: 'destructive' })
    },
  })

  const handlePayment = () => {
    const amount = parseFloat(paymentAmount)
    if (amount <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' })
      return
    }
    paymentMutation.mutate({ amount, payment_method: paymentMethod })
  }

  const openPdf = async (url: string, errorTitle: string) => {
    try {
      const response = await api.get(url, { responseType: 'blob' })
      window.open(window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' })), '_blank')
    } catch {
      toast({ title: errorTitle, variant: 'destructive' })
    }
  }

  const checkoutMutation = useMutation({
    mutationFn: (confirmWithDebt: boolean = false) => api.post(`/checkout/visits/${visitId}/complete-checkout`, { confirm_with_debt: confirmWithDebt }),
    onSuccess: (response) => {
      const data = response.data

      // Check if backend is asking for debt confirmation
      if (data.requires_confirmation && data.has_outstanding_debt) {
        setDebtInfo({ total_debt: data.total_debt, message: data.message })
        setIsCheckoutDialogOpen(false)
        setIsDebtConfirmDialogOpen(true)
        return
      }

      // Checkout was successful
      queryClient.invalidateQueries({ queryKey: ['checkout-summary', visitId] })
      setIsCheckoutDialogOpen(false)
      setIsDebtConfirmDialogOpen(false)
      toast({
        title: 'Patient checked out successfully',
        description: data.debt_notice || 'Visit has been marked as completed.',
        variant: 'default',
      })
    },
    onError: () => {
      toast({ title: 'Failed to complete checkout', variant: 'destructive' })
    },
  })

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="256px">
        <Spinner color="brand.500" size="lg" />
      </Flex>
    )
  }

  if (!summary) {
    return (
      <Box textAlign="center" py="48px">
        <Text color="secondaryGray.600">Visit not found</Text>
        <Button variant="light" mt="16px" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Box>
    )
  }

  const { patient, charges, summary: totals } = summary
  const balanceColor = totals.balance_due > 0 ? 'red.500' : 'green.500'

  return (
    <>
      {/* Header */}
      <Flex justify="space-between" align={{ base: 'start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap="12px" mb="20px">
        <Flex align="center" gap="16px">
          <IconButton aria-label="Back" variant="ghost" icon={<MdArrowBack />} onClick={() => navigate(-1)} />
          <Box>
            <Heading size="lg" display="flex" alignItems="center" gap="8px" data-tour="page-title">
              <Icon as={MdReceipt} />
              Patient Checkout
            </Heading>
            <Text color="secondaryGray.600">
              Visit #{summary.visit_number} • {summary.visit_date?.split('T')[0]}
            </Text>
          </Box>
        </Flex>
        <Flex gap="8px" wrap="wrap">
          <Button variant="light" leftIcon={<MdPrint />} onClick={() => openPdf(`/checkout/visits/${visitId}/checkout-receipt`, 'Failed to generate receipt')}>
            Print Receipt
          </Button>
          {totals.balance_due > 0 && (
            <Button variant="brand" leftIcon={<MdCreditCard />} onClick={() => setIsPaymentDialogOpen(true)}>
              Record Payment
            </Button>
          )}
          {summary.status !== 'checked_out' ? (
            <Button colorScheme="green" leftIcon={<MdLogout />} onClick={() => setIsCheckoutDialogOpen(true)}>
              Complete Checkout
            </Button>
          ) : (
            <Badge colorScheme="green" fontSize="md" px="16px" py="8px" borderRadius="12px">
              <Icon as={MdCheckCircle} me="8px" verticalAlign="middle" />
              Checked Out
            </Badge>
          )}
        </Flex>
      </Flex>

      <Stack spacing="20px">
        {/* Patient Info */}
        <Card>
          <Flex justify="space-between" align="center" gap="12px" wrap="wrap">
            <Box>
              <Heading size="md">{patient.name}</Heading>
              <Text color="secondaryGray.600">
                {patient.patient_number} • {patient.phone}
              </Text>
            </Box>
            <Badge colorScheme={totals.is_fully_paid ? 'green' : 'red'} fontSize="md" px="16px" py="8px" borderRadius="12px">
              <Icon as={totals.is_fully_paid ? MdCheckCircle : MdErrorOutline} me="8px" verticalAlign="middle" />
              {totals.is_fully_paid ? 'Fully Paid' : `Balance Due: GH₵${totals.balance_due.toLocaleString()}`}
            </Badge>
          </Flex>
        </Card>

        {/* Consultation */}
        <SectionCard title={<IconTitle icon={FaStethoscope}>Consultation</IconTitle>}>
          <Stack spacing="12px">
            {charges.consultation.type && (
              <Flex justify="space-between">
                <Text color="secondaryGray.600">Type</Text>
                <Text fontWeight="500">{charges.consultation.type}</Text>
              </Flex>
            )}
            <Flex justify="space-between">
              <Text color="secondaryGray.600">Fee</Text>
              <Text fontWeight="500">GH₵{charges.consultation.fee.toLocaleString()}</Text>
            </Flex>
            <Flex justify="space-between">
              <Text color="secondaryGray.600">Paid</Text>
              <Text color="green.500">GH₵{charges.consultation.paid.toLocaleString()}</Text>
            </Flex>
            <TotalRow label="Balance">
              <Text fontWeight="bold" color={charges.consultation.balance > 0 ? 'red.500' : 'green.500'}>
                GH₵{charges.consultation.balance.toLocaleString()}
              </Text>
            </TotalRow>
            <Box>
              <Badge colorScheme={statusScheme(charges.consultation.payment_status === 'paid')}>{charges.consultation.payment_status}</Badge>
            </Box>
          </Stack>
        </SectionCard>

        {/* Scans */}
        <SectionCard title={<IconTitle icon={MdVisibility}>Scans ({charges.scans.items.length})</IconTitle>}>
          {charges.scans.items.length === 0 ? (
            <Text color="secondaryGray.600" fontSize="sm">
              No scans for this visit
            </Text>
          ) : (
            <Stack spacing="12px">
              {charges.scans.items.map((scan: any) => (
                <Flex key={scan.id} justify="space-between" align="center" fontSize="sm">
                  <Text>{scan.scan_type.toUpperCase()}</Text>
                  <Box textAlign="right">
                    <Text as="span" fontWeight="500">
                      GH₵{scan.amount.toLocaleString()}
                    </Text>
                    <Badge colorScheme={statusScheme(scan.status === 'paid')} ms="8px">
                      {scan.status}
                    </Badge>
                  </Box>
                </Flex>
              ))}
              <TotalRow label="Total">
                <Text fontWeight="bold">GH₵{charges.scans.total.toLocaleString()}</Text>
              </TotalRow>
            </Stack>
          )}
        </SectionCard>

        {/* Products */}
        <SectionCard title={<IconTitle icon={MdInventory2}>Products ({charges.products.items.length})</IconTitle>}>
          {charges.products.items.length === 0 ? (
            <Text color="secondaryGray.600" fontSize="sm">
              No products purchased
            </Text>
          ) : (
            <Stack spacing="12px">
              {charges.products.items.map((item: any, idx: number) => (
                <Flex key={idx} justify="space-between" align="center" fontSize="sm">
                  <Box>
                    <Text as="span" fontWeight="500">
                      {item.product_name}
                    </Text>
                    <Text as="span" color="secondaryGray.600" ms="8px">
                      x{item.quantity}
                    </Text>
                  </Box>
                  <Box textAlign="right">
                    <Text as="span" fontWeight="500">
                      GH₵{item.total.toLocaleString()}
                    </Text>
                    <Badge colorScheme={statusScheme(item.status === 'completed')} ms="8px">
                      {item.status}
                    </Badge>
                  </Box>
                </Flex>
              ))}
              <TotalRow label="Total">
                <Text fontWeight="bold">GH₵{charges.products.total.toLocaleString()}</Text>
              </TotalRow>
            </Stack>
          )}
        </SectionCard>

        {/* Optical Prescriptions - for download */}
        {prescriptions.length > 0 && (
          <SectionCard title={<IconTitle icon={MdVisibility}>Optical Prescriptions ({prescriptions.length})</IconTitle>}>
            <Stack spacing="12px">
              {prescriptions.map((prescription: any) => (
                <RowBox key={prescription.id}>
                  <Box>
                    <Flex align="center" gap="8px">
                      <Badge variant="outline" fontSize="xs">
                        {prescription.prescription_type || 'Optical'}
                      </Badge>
                      <Text fontWeight="500">{prescription.items?.map((i: any) => i.name).join(', ') || 'Spectacles Prescription'}</Text>
                    </Flex>
                    {(prescription.sphere_od || prescription.sphere_os) && (
                      <Text fontSize="xs" color="secondaryGray.600" mt="4px">
                        OD: {prescription.sphere_od || '-'} / {prescription.cylinder_od || '-'} | OS: {prescription.sphere_os || '-'} /{' '}
                        {prescription.cylinder_os || '-'} | Add: {prescription.add_power || '-'}
                      </Text>
                    )}
                  </Box>
                  <Button
                    variant="light"
                    size="sm"
                    leftIcon={<MdDownload />}
                    onClick={() => openPdf(`/clinical/prescriptions/${prescription.id}/download-pdf`, 'Failed to download prescription')}
                  >
                    Download PDF
                  </Button>
                </RowBox>
              ))}
            </Stack>
          </SectionCard>
        )}

        {/* Summary */}
        <Card bg={mutedBg}>
          <SimpleGrid columns={3} spacing="32px" textAlign="center">
            <Box>
              <Text fontSize="sm" color="secondaryGray.600">
                Grand Total
              </Text>
              <Text fontSize="3xl" fontWeight="bold">
                GH₵{totals.grand_total.toLocaleString()}
              </Text>
            </Box>
            <Box>
              <Text fontSize="sm" color="secondaryGray.600">
                Total Paid
              </Text>
              <Text fontSize="3xl" fontWeight="bold" color="green.500">
                GH₵{totals.total_paid.toLocaleString()}
              </Text>
            </Box>
            <Box>
              <Text fontSize="sm" color="secondaryGray.600">
                Balance Due
              </Text>
              <Text fontSize="3xl" fontWeight="bold" color={balanceColor}>
                GH₵{totals.balance_due.toLocaleString()}
              </Text>
            </Box>
          </SimpleGrid>
        </Card>
      </Stack>

      {/* Payment Dialog */}
      <AppModal
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        title="Record Payment"
        footer={
          <>
            <Button variant="light" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handlePayment} isLoading={paymentMutation.isPending} loadingText="Processing...">
              Record Payment
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Box textAlign="center" py="16px">
            <Text fontSize="sm" color="secondaryGray.600">
              Balance Due
            </Text>
            <Text fontSize="3xl" fontWeight="bold" color="red.500">
              GH₵{totals.balance_due.toLocaleString()}
            </Text>
          </Box>
          <Field label="Payment Amount">
            <Input variant="main" type="number" fontSize="lg" placeholder="Enter amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          </Field>
          <Field label="Payment Method">
            <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
          </Field>
        </Stack>
      </AppModal>

      {/* Checkout Confirmation Dialog */}
      <AppModal
        isOpen={isCheckoutDialogOpen}
        onClose={() => setIsCheckoutDialogOpen(false)}
        title={<IconTitle icon={MdLogout}>Complete Patient Checkout</IconTitle>}
        footer={
          <>
            <Button variant="light" onClick={() => setIsCheckoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button colorScheme="green" onClick={() => checkoutMutation.mutate(false)} isLoading={checkoutMutation.isPending} loadingText="Processing...">
              Confirm Checkout
            </Button>
          </>
        }
      >
        <Stack spacing="16px" py="8px">
          <Flex align="center" gap="16px" p="16px" bg={mutedBg} borderRadius="12px">
            <Icon as={MdPerson} w="40px" h="40px" color="secondaryGray.600" />
            <Box>
              <Text fontWeight="bold" fontSize="lg">
                {patient.name}
              </Text>
              <Text color="secondaryGray.600">{patient.patient_number}</Text>
            </Box>
          </Flex>
          <SimpleGrid columns={2} spacing="16px" textAlign="center">
            <Box p="12px" bg={mutedBg} borderRadius="12px">
              <Text fontSize="sm" color="secondaryGray.600">
                Total Charges
              </Text>
              <Text fontSize="xl" fontWeight="bold">
                GH₵{totals.grand_total.toLocaleString()}
              </Text>
            </Box>
            <Box p="12px" bg={mutedBg} borderRadius="12px">
              <Text fontSize="sm" color="secondaryGray.600">
                Balance
              </Text>
              <Text fontSize="xl" fontWeight="bold" color={balanceColor}>
                GH₵{totals.balance_due.toLocaleString()}
              </Text>
            </Box>
          </SimpleGrid>
          {totals.balance_due > 0 && (
            <Alert status="warning" borderRadius="12px" fontSize="sm">
              <AlertIcon />
              Patient has an outstanding balance. You can still complete checkout.
            </Alert>
          )}
          <Text fontSize="sm" color="secondaryGray.600" textAlign="center">
            This will mark the visit as completed and the patient as checked out.
          </Text>
        </Stack>
      </AppModal>

      {/* Debt Confirmation Dialog */}
      <AppModal
        isOpen={isDebtConfirmDialogOpen}
        onClose={() => setIsDebtConfirmDialogOpen(false)}
        title={
          <Flex align="center" gap="8px" color="orange.500">
            <Icon as={MdErrorOutline} />
            Outstanding Debt Warning
          </Flex>
        }
        footer={
          <>
            <Button variant="light" onClick={() => setIsDebtConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={() => checkoutMutation.mutate(true)} isLoading={checkoutMutation.isPending} loadingText="Processing...">
              Checkout with Debt
            </Button>
          </>
        }
      >
        <Stack spacing="16px" py="8px">
          <Box p="16px" bg="orange.50" border="1px solid" borderColor="orange.200" borderRadius="12px" textAlign="center">
            <Text color="orange.800" fontWeight="500" fontSize="lg">
              GH₵{debtInfo?.total_debt?.toLocaleString() || 0}
            </Text>
            <Text color="orange.700" fontSize="sm" mt="8px">
              Outstanding Debt
            </Text>
          </Box>
          <Text fontSize="sm" textAlign="center">
            {debtInfo?.message || 'This patient has an outstanding debt. Are you sure you want to check them out?'}
          </Text>
          <Text fontSize="xs" color="secondaryGray.600" textAlign="center">
            The debt will remain on their account for future payment.
          </Text>
        </Stack>
      </AppModal>
    </>
  )
}
