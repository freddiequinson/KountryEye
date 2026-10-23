import { useEffect, useState } from 'react'
import { Box, Button, Flex, Icon, Input, InputGroup, InputLeftAddon, Select, Text } from '@chakra-ui/react'
import { MdInfoOutline } from 'react-icons/md'
import { PersonCell } from '@/components/Person'
import { IntakeSection } from '@/components/IntakeSheet'
import { AppModal, Field, PaymentMethodPicker } from '@/components/ui'

export const ghs = (amount: number) => `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export interface PaymentBill {
  patientName: string
  subtitle?: string
  lines: { label: string; amount: number }[]
  alreadyPaid?: number
  due: number
}

// Takes a payment against a bill (a visit's consultation fee, a prescription). The bill is laid out like
// the printed receipts: green header bar, ruled rows, amount due underneath.
// `methods` swaps the Cash / Card / MoMo buttons for a dropdown when a bill has its own list of methods.
export function PaymentModal({
  title,
  bill,
  methods,
  withReference,
  isOpen,
  onClose,
  isLoading,
  onSubmit,
}: {
  title: string
  bill: PaymentBill | null
  methods?: { value: string; label: string }[]
  withReference?: boolean
  isOpen: boolean
  onClose: () => void
  isLoading?: boolean
  onSubmit: (payment: { amount: number; payment_method: string; reference: string }) => void
}) {
  const due = bill?.due || 0
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')

  // Start each bill at the full amount due, paid in cash
  useEffect(() => {
    if (isOpen) {
      setAmount(due ? String(due) : '')
      setMethod('cash')
      setReference('')
    }
  }, [isOpen, due, bill?.patientName, bill?.subtitle])

  const paying = parseFloat(amount) || 0
  const over = paying - due

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={title}
      footer={
        <>
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" isDisabled={paying <= 0} isLoading={isLoading} loadingText="Processing..." onClick={() => onSubmit({ amount: paying, payment_method: method, reference })}>
            Record {paying > 0 ? ghs(paying) : 'Payment'}
          </Button>
        </>
      }
    >
      {bill && (
        <>
          <PersonCell name={bill.patientName || 'Unknown'} sub={bill.subtitle} />

          <Box mt="18px">
            <Flex justify="space-between" px="18px" py="9px" borderRadius="full" color="white" fontSize="12px" fontWeight="800" letterSpacing="0.04em" textTransform="uppercase" bg="linear-gradient(100deg, #14472A 0%, #3E8141 100%)">
              <Text>Description</Text>
              <Text>Amount</Text>
            </Flex>
            {bill.lines.map((line, index) => (
              <Flex key={index} justify="space-between" gap="12px" px="18px" py="12px" borderTop={index ? '1.5px solid' : undefined} borderColor="brand.500" fontSize="sm">
                <Text fontWeight="700">{line.label}</Text>
                <Text flexShrink={0}>{ghs(line.amount)}</Text>
              </Flex>
            ))}
            {bill.alreadyPaid !== undefined && (
              <Flex justify="space-between" px="18px" py="12px" borderTop="1.5px solid" borderColor="brand.500" fontSize="sm">
                <Text fontWeight="700">Already paid</Text>
                <Text>-{ghs(bill.alreadyPaid)}</Text>
              </Flex>
            )}
            <Flex justify="space-between" align="baseline" px="18px" pt="12px" borderTop="1.5px solid" borderColor="brand.500">
              <Text fontSize="sm" fontWeight="800" letterSpacing="0.04em" textTransform="uppercase" color="brand.600" _dark={{ color: 'brand.300' }}>
                {bill.alreadyPaid !== undefined ? 'Balance due' : 'Total due'}
              </Text>
              <Text fontSize="xl" fontWeight="800" color={due > 0 ? 'red.500' : undefined}>
                {ghs(due)}
              </Text>
            </Flex>
          </Box>

          <Box mt="26px">
            <IntakeSection title="Payment" columns={1}>
              <Field label="Amount received">
                <Flex gap="8px">
                  <InputGroup>
                    <InputLeftAddon h="42px" borderLeftRadius="10px" fontWeight="700" fontSize="sm" bg="secondaryGray.300" borderColor="secondaryGray.400" _dark={{ bg: 'whiteAlpha.100', borderColor: 'whiteAlpha.200' }}>
                      GH₵
                    </InputLeftAddon>
                    <Input variant="main" type="number" min={0} step="0.01" borderLeftRadius="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </InputGroup>
                  <Button variant="light" flexShrink={0} h="42px" isDisabled={paying === due} onClick={() => setAmount(String(due))}>
                    Full amount
                  </Button>
                </Flex>
              </Field>
              <Field label="Payment method">
                {methods ? (
                  <Select variant="main" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {methods.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <PaymentMethodPicker value={method} onChange={setMethod} />
                )}
              </Field>
              {withReference && method !== 'cash' && (
                <Field label="Reference / Transaction ID">
                  <Input variant="main" placeholder="Enter reference number" value={reference} onChange={(e) => setReference(e.target.value)} />
                </Field>
              )}
              {over > 0 ? (
                // Overpayments are accepted; say so loudly so the extra is returned or credited, not lost
                <Flex gap="10px" p="12px" borderRadius="12px" bg="orange.50" border="1px solid" borderColor="orange.200" _dark={{ bg: 'whiteAlpha.100', borderColor: 'orange.400' }}>
                  <Icon as={MdInfoOutline} color="orange.500" w="20px" h="20px" flexShrink={0} />
                  <Box fontSize="sm">
                    <Text fontWeight="800">Overpaid by {ghs(over)}</Text>
                    <Text fontWeight="500" color="secondaryGray.700" _dark={{ color: 'secondaryGray.400' }}>
                      The full {ghs(paying)} is recorded. The extra {ghs(over)} is shown on the receipt so it can be returned or credited.
                    </Text>
                  </Box>
                </Flex>
              ) : (
                <Flex justify="space-between" fontSize="sm" fontWeight="600" color="secondaryGray.600">
                  <Text>Balance after this payment</Text>
                  <Text>{ghs(-over)}</Text>
                </Flex>
              )}
            </IntakeSection>
          </Box>
        </>
      )}
    </AppModal>
  )
}
