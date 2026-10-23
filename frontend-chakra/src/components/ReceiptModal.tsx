import { useState } from 'react'
import { Box, Button, Flex, Icon, Image, Text } from '@chakra-ui/react'
import { MdCheckCircle, MdPrint } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { AppModal } from '@/components/ui'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  /** Receipt PDF, as an API path such as `/receipts/visit/12`. */
  receiptUrl: string
  receiptNumber?: string
  patientName?: string
  /** Amount received in this payment. */
  totalAmount?: number
  /** What was owed before this payment; with it the slip shows the balance left or the overpayment. */
  amountDue?: number
  paymentMethod?: string
}

const ghs = (amount: number) => `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const methodLabel = (method: string) =>
  ({ cash: 'Cash', card: 'Card', mobile_money: 'Mobile Money', momo: 'Mobile Money', transfer: 'Bank Transfer', insurance: 'Insurance', visioncare: 'VisionCare' })[method] || method

// Shown right after a payment: a slip in the receipt design with what was received, and the printable receipt one click away.
export function ReceiptModal({ isOpen, onClose, receiptUrl, receiptNumber, patientName, totalAmount, amountDue, paymentMethod }: ReceiptModalProps) {
  const { toast } = useToast()
  const [opening, setOpening] = useState(false)
  const received = totalAmount ?? 0
  const left = amountDue === undefined ? 0 : amountDue - received

  // Receipts are fetched with the signed-in session, then opened as a PDF
  const openReceipt = async () => {
    setOpening(true)
    try {
      const response = await api.get(receiptUrl.replace(/^\/api\/v1/, ''), { responseType: 'blob' })
      window.open(window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' })), '_blank')
    } catch {
      toast({ title: 'Failed to open the receipt', variant: 'destructive' })
    } finally {
      setOpening(false)
    }
  }

  const row = (label: string, value: React.ReactNode) => (
    <Flex justify="space-between" gap="12px" fontSize="sm" py="5px">
      <Text fontWeight="800" fontSize="12px" letterSpacing="0.04em" textTransform="uppercase" color="brand.600" _dark={{ color: 'brand.300' }}>
        {label}
      </Text>
      <Text fontWeight="600" textAlign="right">
        {value}
      </Text>
    </Flex>
  )

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <>
          <Button variant="light" onClick={onClose}>
            Close
          </Button>
          <Button variant="brand" leftIcon={<MdPrint />} isLoading={opening} loadingText="Opening..." onClick={openReceipt}>
            Print receipt
          </Button>
        </>
      }
    >
      <Box mt="20px" borderRadius="16px" overflow="hidden" border="1px solid" borderColor="secondaryGray.100" _dark={{ borderColor: 'whiteAlpha.200' }}>
        <Flex>
          <Box w="70%" px="18px" py="16px" borderBottomRightRadius="48px" bg="linear-gradient(100deg, #14472A 0%, #3E8141 100%)">
            <Box w="fit-content" bg="white" borderRadius="8px" px="10px" py="6px">
              <Image src="/kountry-logo.png" alt="Kountry Eyecare" h="30px" />
            </Box>
          </Box>
          <Flex flex="1" direction="column" align="end" gap="10px" pt="16px">
            <Box w="74%" h="12px" borderLeftRadius="full" bg="brand.100" _dark={{ bg: 'whiteAlpha.200' }} />
            <Box w="50%" h="12px" borderLeftRadius="full" bg="brand.100" _dark={{ bg: 'whiteAlpha.200' }} />
          </Flex>
        </Flex>

        <Box px="20px" pt="18px" pb="20px">
          <Flex align="center" gap="8px" mb="12px">
            <Icon as={MdCheckCircle} w="22px" h="22px" color="green.500" />
            <Text fontSize="lg" fontWeight="800">
              Payment received
            </Text>
          </Flex>
          {receiptNumber && row('Receipt', `N° ${receiptNumber}`)}
          {patientName && row('Patient', patientName)}
          {paymentMethod && row('Method', methodLabel(paymentMethod))}

          {totalAmount !== undefined && (
            <Box mt="12px" pt="12px" borderTop="1.5px solid" borderColor="brand.500">
              {amountDue !== undefined && row('Amount due', ghs(amountDue))}
              <Flex justify="space-between" align="baseline" py="5px">
                <Text fontWeight="800" fontSize="13px" letterSpacing="0.04em" textTransform="uppercase" color="brand.600" _dark={{ color: 'brand.300' }}>
                  Received
                </Text>
                <Text fontSize="2xl" fontWeight="800">
                  {ghs(received)}
                </Text>
              </Flex>
              {amountDue !== undefined &&
                (left > 0 ? (
                  <Flex justify="space-between" fontWeight="800" fontSize="sm" color="red.500" py="5px">
                    <Text>BALANCE DUE</Text>
                    <Text>{ghs(left)}</Text>
                  </Flex>
                ) : left < 0 ? (
                  <Flex justify="space-between" fontWeight="800" fontSize="sm" color="orange.500" py="5px">
                    <Text>OVERPAID: RETURN OR CREDIT</Text>
                    <Text>{ghs(-left)}</Text>
                  </Flex>
                ) : (
                  <Text fontWeight="700" fontSize="sm" color="green.500" py="5px">
                    Paid in full
                  </Text>
                ))}
            </Box>
          )}
        </Box>
      </Box>
    </AppModal>
  )
}
