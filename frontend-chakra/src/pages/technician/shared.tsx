// Labels, badges and dialogs shared by the technician pages.
import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Box, Button, Flex, Icon, Input, InputGroup, InputLeftAddon, SimpleGrid, Stack, Text, useColorModeValue } from '@chakra-ui/react'
import { MdAccessTime, MdCheck, MdErrorOutline } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import Card from '@/components/card/Card'
import { AppModal, Field, PaymentMethodPicker } from '@/components/ui'

export const SCAN_TYPE_LABELS: Record<string, string> = {
  oct: 'OCT',
  vft: 'Visual Field Test',
  fundus: 'Fundus Photography',
  pachymeter: 'Pachymeter',
}

export const SCAN_TYPE_FULL_LABELS: Record<string, string> = {
  oct: 'Optical Coherence Tomography (OCT)',
  vft: 'Visual Field Test (VFT)',
  fundus: 'Fundus Photography',
  pachymeter: 'Pachymeter',
}

const SCAN_DESCRIPTIONS: Record<string, string> = {
  oct: 'Optical Coherence Tomography',
  vft: 'Visual Field Testing',
  fundus: 'Retinal Photography',
  pachymeter: 'Corneal Thickness Measurement',
}

export const SCAN_TYPE_SCHEME: Record<string, string> = { oct: 'blue', vft: 'purple', fundus: 'green', pachymeter: 'orange' }
const STATUS_SCHEME: Record<string, string> = { pending: 'yellow', in_progress: 'blue', completed: 'green', reviewed: 'purple', cancelled: 'red' }

export function StatusBadge({ status }: { status: string }) {
  return <Badge colorScheme={STATUS_SCHEME[status] || 'gray'}>{status?.replace('_', ' ')}</Badge>
}

export function ScanTypeBadge({ type, full }: { type: string; full?: boolean }) {
  return <Badge colorScheme={SCAN_TYPE_SCHEME[type] || 'gray'}>{(full ? SCAN_TYPE_FULL_LABELS : SCAN_TYPE_LABELS)[type] || type}</Badge>
}

// Paid / In Deficit / Unpaid
export function PaymentBadge({ payment }: { payment?: { is_paid?: boolean; added_to_deficit?: boolean } | null }) {
  const [scheme, icon, label] = payment?.is_paid ? ['green', MdCheck, 'Paid'] : payment?.added_to_deficit ? ['orange', MdErrorOutline, 'In Deficit'] : ['red', MdAccessTime, 'Unpaid']
  return (
    <Badge colorScheme={scheme} display="inline-flex" alignItems="center" gap="4px">
      <Icon as={icon} />
      {label}
    </Badge>
  )
}

export function PricingCards({ pricing }: { pricing: any[] }) {
  return (
    <SimpleGrid columns={{ base: 2, md: 4 }} spacing="20px" mb="20px">
      {pricing.map((p) => (
        <Card key={p.scan_type}>
          <Flex justify="space-between" align="center" gap="8px">
            <Box>
              <Text fontSize="sm" color="secondaryGray.600">
                {SCAN_TYPE_LABELS[p.scan_type] || p.scan_type}
              </Text>
              <Text fontSize="2xl" fontWeight="700">
                GH₵ {p.price}
              </Text>
            </Box>
            <Badge colorScheme={SCAN_TYPE_SCHEME[p.scan_type] || 'gray'}>{p.scan_type.toUpperCase()}</Badge>
          </Flex>
        </Card>
      ))}
    </SimpleGrid>
  )
}

// Edit the price of each scan type; a field saves when it loses focus.
export function PricingModal({ isOpen, onClose, pricing }: { isOpen: boolean; onClose: () => void; pricing: any[] }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const updatePricingMutation = useMutation({
    mutationFn: async ({ scanType, price }: { scanType: string; price: number }) => (await api.put(`/technician/scan-pricing/${scanType}`, null, { params: { price } })).data,
    onSuccess: () => {
      toast({ title: 'Success', description: 'Pricing updated' })
      queryClient.invalidateQueries({ queryKey: ['scan-pricing'] })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update pricing', variant: 'destructive' })
    },
  })

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Scan Pricing"
      description="Set the price for each scan type. Changes save when you leave a field."
      footer={
        <Button variant="brand" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Stack spacing="16px">
        {Object.keys(SCAN_TYPE_LABELS).map((scanType) => {
          const existingPrice = pricing.find((p) => p.scan_type === scanType)
          return (
            <Flex key={scanType} align="center" gap="16px">
              <Box flex="1">
                <Text fontWeight="600">{SCAN_TYPE_LABELS[scanType]}</Text>
                <Text fontSize="xs" color="secondaryGray.600">
                  {SCAN_DESCRIPTIONS[scanType]}
                </Text>
              </Box>
              <InputGroup w="160px" size="sm">
                <InputLeftAddon borderRadius="12px 0 0 12px">GH₵</InputLeftAddon>
                <Input
                  variant="main"
                  borderRadius="0 12px 12px 0"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  defaultValue={existingPrice?.price || ''}
                  onBlur={(e) => {
                    const newPrice = parseFloat(e.target.value)
                    if (!isNaN(newPrice) && newPrice >= 0 && newPrice !== existingPrice?.price) {
                      updatePricingMutation.mutate({ scanType, price: newPrice })
                    }
                  }}
                />
              </InputGroup>
            </Flex>
          )
        })}
      </Stack>
    </AppModal>
  )
}

// Record a payment for one scan; the caller runs the mark-paid mutation.
export function ScanPaymentModal({
  isOpen,
  onClose,
  scanType,
  amount,
  patientName,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean
  onClose: () => void
  scanType?: string
  amount: number | string
  patientName?: string
  onConfirm: (method: string) => void
  isLoading?: boolean
}) {
  const [method, setMethod] = useState('')
  const summaryBg = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')

  useEffect(() => {
    if (isOpen) setMethod('')
  }, [isOpen])

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      footer={
        <>
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" isDisabled={!method} isLoading={isLoading} onClick={() => onConfirm(method)}>
            Confirm Payment
          </Button>
        </>
      }
    >
      <Stack spacing="16px">
        <Stack spacing="8px" p="16px" bg={summaryBg} borderRadius="12px">
          {patientName && (
            <Flex justify="space-between">
              <Text color="secondaryGray.600">Patient:</Text>
              <Text fontWeight="600">{patientName}</Text>
            </Flex>
          )}
          <Flex justify="space-between">
            <Text color="secondaryGray.600">Scan Type:</Text>
            {scanType && <ScanTypeBadge type={scanType} full />}
          </Flex>
          <Flex justify="space-between">
            <Text color="secondaryGray.600">Amount:</Text>
            <Text fontWeight="700" fontSize="lg">
              GH₵ {amount}
            </Text>
          </Flex>
        </Stack>
        <Field label="Payment Method" isRequired>
          <PaymentMethodPicker value={method} onChange={setMethod} />
        </Field>
      </Stack>
    </AppModal>
  )
}
