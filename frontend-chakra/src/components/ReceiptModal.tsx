import { Button, Flex, Heading, Icon, Text } from '@chakra-ui/react'
import { MdCheckCircleOutline, MdDownload } from 'react-icons/md'
import { AppModal } from '@/components/ui'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  receiptUrl: string
  receiptNumber?: string
  patientName?: string
  totalAmount?: number
}

export function ReceiptModal({ isOpen, onClose, receiptUrl, receiptNumber, patientName, totalAmount }: ReceiptModalProps) {
  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Payment Receipt">
      <Flex direction="column" align="center" textAlign="center" py="16px">
        <Icon as={MdCheckCircleOutline} w="64px" h="64px" color="green.500" mb="8px" />
        <Heading size="md" mb="8px">
          Payment Successful!
        </Heading>
        {receiptNumber && (
          <Text fontSize="sm" color="secondaryGray.600" mb="4px">
            Receipt: {receiptNumber}
          </Text>
        )}
        {patientName && (
          <Text fontSize="sm" color="secondaryGray.600" mb="4px">
            Patient: {patientName}
          </Text>
        )}
        {totalAmount !== undefined && (
          <Text fontSize="2xl" fontWeight="bold" color="green.500">
            GHS {totalAmount.toFixed(2)}
          </Text>
        )}
      </Flex>
      <Flex gap="8px">
        <Button variant="brand" flex="1" leftIcon={<MdDownload />} onClick={() => window.open(receiptUrl, '_blank')}>
          Download Receipt
        </Button>
        <Button variant="light" flex="1" onClick={onClose}>
          Close
        </Button>
      </Flex>
    </AppModal>
  )
}
