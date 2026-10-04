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
  Skeleton,
  Td,
  Text,
  Tr,
  useColorModeValue,
  type FormControlProps,
  type InputGroupProps,
  type ModalProps,
} from '@chakra-ui/react'
import { MdCreditCard, MdInbox, MdPayments, MdReceipt, MdSearch } from 'react-icons/md'

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

// Full-width table row for loading / empty states. Loading shows skeleton rows shaped like the table.
export function TableMessageRow({ colSpan, loading, children }: { colSpan: number; loading?: boolean; children?: ReactNode }) {
  if (loading) {
    return (
      <>
        {[0, 1, 2, 3, 4].map((r) => (
          <Tr key={r}>
            {Array.from({ length: colSpan }, (_, c) => (
              <Td key={c}>
                <Skeleton h="14px" borderRadius="6px" w={c === 0 ? '70%' : `${45 + ((r * 7 + c * 13) % 40)}%`} />
              </Td>
            ))}
          </Tr>
        ))}
      </>
    )
  }
  return (
    <Tr _hover={{ bg: 'transparent' }}>
      <Td colSpan={colSpan} p="0">
        <EmptyState>{children}</EmptyState>
      </Td>
    </Tr>
  )
}

// Centered empty placeholder: icon chip on a dotted halo, title and a line of help or an action.
export function EmptyState({ icon = MdInbox, title, children }: { icon?: React.ElementType; title?: ReactNode; children?: ReactNode }) {
  const chipBg = useColorModeValue('white', 'navy.700')
  const ring = useColorModeValue('secondaryGray.400', 'whiteAlpha.300')
  return (
    <Flex direction="column" align="center" textAlign="center" py="44px" px="16px">
      <Flex position="relative" w="84px" h="84px" align="center" justify="center" mb="14px">
        <Box position="absolute" inset="0" borderRadius="full" border="1.5px dashed" borderColor={ring} />
        <Box position="absolute" inset="10px" borderRadius="full" bg="brand.50" _dark={{ bg: 'whiteAlpha.100' }} />
        <Flex position="relative" w="44px" h="44px" borderRadius="13px" bg={chipBg} boxShadow="card" align="center" justify="center" color="brand.600" _dark={{ color: 'brand.300' }}>
          <Icon as={icon} w="22px" h="22px" />
        </Flex>
      </Flex>
      {title && (
        <Text fontWeight="700" fontSize="15px" mb="2px">
          {title}
        </Text>
      )}
      {children && (
        <Box fontSize="sm" fontWeight="500" color="secondaryGray.600" maxW="360px">
          {children}
        </Box>
      )}
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
  return (
    <Box overflowX="auto" {...rest}>
      {children}
    </Box>
  )
}
