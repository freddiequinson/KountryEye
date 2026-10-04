// Small shared building blocks used across pages (replacements for the shadcn ui/ primitives).
import { useRef, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Td,
  Text,
  Tr,
  useColorModeValue,
  type FormControlProps,
  type InputGroupProps,
  type ModalProps,
} from '@chakra-ui/react'
import { MdCreditCard, MdPayments, MdReceipt, MdSearch } from 'react-icons/md'

// Label + control, the shadcn `<div className="space-y-2"><Label/>{control}</div>` pattern.
export function Field({
  label,
  helper,
  children,
  ...rest
}: Omit<FormControlProps, 'label'> & { label?: ReactNode; helper?: ReactNode; children: ReactNode }) {
  return (
    <FormControl {...rest}>
      {label && <FormLabel>{label}</FormLabel>}
      {children}
      {helper && <FormHelperText fontSize="xs">{helper}</FormHelperText>}
    </FormControl>
  )
}

// Dialog with title, optional description, body and footer.
export function AppModal({
  isOpen,
  onClose,
  title,
  description,
  footer,
  children,
  size = 'md',
  ...rest
}: Omit<ModalProps, 'children'> & { title?: ReactNode; description?: ReactNode; footer?: ReactNode; children?: ReactNode }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size={size} isCentered scrollBehavior="inside" {...rest}>
      <ModalOverlay />
      <ModalContent mx="16px">
        {title && (
          <ModalHeader pe="48px">
            {title}
            {description && (
              <Text fontSize="sm" fontWeight="normal" color="secondaryGray.600" mt="4px">
                {description}
              </Text>
            )}
          </ModalHeader>
        )}
        <ModalCloseButton />
        <ModalBody pb={footer ? '8px' : '24px'}>{children}</ModalBody>
        {footer && <ModalFooter gap="8px">{footer}</ModalFooter>}
      </ModalContent>
    </Modal>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  autoFocus,
  ...rest
}: Omit<InputGroupProps, 'onChange'> & { value: string; onChange: (value: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <InputGroup maxW={{ base: '100%', md: '360px' }} {...rest}>
      <InputLeftElement pointerEvents="none">
        <Icon as={MdSearch} color="secondaryGray.600" />
      </InputLeftElement>
      <Input variant="main" placeholder={placeholder} value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
    </InputGroup>
  )
}

// Full-width table row for loading / empty states.
export function TableMessageRow({ colSpan, loading, children }: { colSpan: number; loading?: boolean; children?: ReactNode }) {
  return (
    <Tr>
      <Td colSpan={colSpan} textAlign="center" py="32px" color="secondaryGray.600">
        {loading ? <Spinner size="sm" color="brand.500" /> : children}
      </Td>
    </Tr>
  )
}

// Centered empty / loading placeholder outside tables.
export function EmptyState({ icon, title, children }: { icon?: React.ElementType; title?: ReactNode; children?: ReactNode }) {
  return (
    <Flex direction="column" align="center" textAlign="center" py="40px" color="secondaryGray.600">
      {icon && <Icon as={icon} w="48px" h="48px" mb="12px" opacity={0.5} />}
      {title && (
        <Text fontWeight="600" mb="4px">
          {title}
        </Text>
      )}
      {children && <Box fontSize="sm">{children}</Box>}
    </Flex>
  )
}

// Confirmation dialog for destructive actions (shadcn AlertDialog replacement).
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Delete',
  isLoading,
  colorScheme = 'red',
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  children?: ReactNode
  confirmLabel?: ReactNode
  isLoading?: boolean
  colorScheme?: string
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} leastDestructiveRef={cancelRef} isCentered>
      <AlertDialogOverlay>
        <AlertDialogContent borderRadius="20px" mx="16px">
          <AlertDialogHeader>{title}</AlertDialogHeader>
          <AlertDialogBody color="secondaryGray.600">{children}</AlertDialogBody>
          <AlertDialogFooter gap="8px">
            <Button ref={cancelRef} variant="light" onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme={colorScheme} onClick={onConfirm} isLoading={isLoading}>
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: MdPayments },
  { value: 'card', label: 'Card', icon: MdCreditCard },
  { value: 'mobile_money', label: 'MoMo', icon: MdReceipt },
]

// Big Cash / Card / MoMo toggle buttons.
export function PaymentMethodPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <SimpleGrid columns={3} spacing="8px">
      {PAYMENT_METHODS.map((m) => (
        <Button key={m.value} variant={value === m.value ? 'brand' : 'light'} h="64px" flexDirection="column" gap="4px" onClick={() => onChange(m.value)}>
          <Icon as={m.icon} w="20px" h="20px" />
          {m.label}
        </Button>
      ))}
    </SimpleGrid>
  )
}

// "Showing x to y of n" + First/Previous/Next/Last controls.
export function Pagination({
  page,
  totalPages,
  total,
  perPage,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  perPage: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <Flex justify="space-between" align="center" gap="12px" wrap="wrap" pt="16px">
      <Text fontSize="sm" color="secondaryGray.600">
        Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total} entries
      </Text>
      <Flex align="center" gap="8px">
        <Button variant="light" size="sm" onClick={() => onChange(1)} isDisabled={page === 1}>
          First
        </Button>
        <Button variant="light" size="sm" onClick={() => onChange(Math.max(1, page - 1))} isDisabled={page === 1}>
          Previous
        </Button>
        <Text fontSize="sm" px="8px">
          Page {page} of {totalPages}
        </Text>
        <Button variant="light" size="sm" onClick={() => onChange(Math.min(totalPages, page + 1))} isDisabled={page === totalPages}>
          Next
        </Button>
        <Button variant="light" size="sm" onClick={() => onChange(totalPages)} isDisabled={page === totalPages}>
          Last
        </Button>
      </Flex>
    </Flex>
  )
}

// Wraps a Chakra <Table> so wide tables scroll horizontally on small screens.
export function TableBox({ children, ...rest }: React.ComponentProps<typeof Box>) {
  const borderColor = useColorModeValue('gray.100', 'whiteAlpha.100')
  return (
    <Box overflowX="auto" border="1px solid" borderColor={borderColor} borderRadius="16px" {...rest}>
      {children}
    </Box>
  )
}
