import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Icon,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
  useColorModeValue,
} from '@chakra-ui/react'
import { MdBusiness, MdCheckCircle, MdWarningAmber } from 'react-icons/md'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'

export default function BranchVerificationModal() {
  const { user, setUser } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [issueNote, setIssueNote] = useState('')
  const tint = useColorModeValue('brand.50', 'whiteAlpha.100')
  const textColor = useColorModeValue('secondaryGray.900', 'white')

  // Check if verification is needed
  const { data: verificationStatus, isLoading } = useQuery({
    queryKey: ['branch-verification-status'],
    queryFn: async () => (await api.get('/branch-assignments/me/branch-verification-status')).data,
    enabled: !!user,
    refetchOnWindowFocus: false,
  })

  const verifyMutation = useMutation({
    mutationFn: (data: { confirmed: boolean; note?: string }) => api.post('/branch-assignments/me/verify-branch', data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['branch-verification-status'] })
      if (variables.confirmed) {
        toast({ title: 'Branch verified', description: `You are now working at ${response.data.branch_name}` })
        // Update user state to clear verification flag
        if (user) setUser({ ...user, branch_verification_required: false })
      } else {
        toast({ title: 'Issue reported', description: 'Your administrator has been notified.', variant: 'default' })
      }
      setShowIssueForm(false)
      setIssueNote('')
    },
    onError: () => {
      toast({ title: 'Failed to verify branch', variant: 'destructive' })
    },
  })

  const handleReportIssue = () => {
    if (!issueNote.trim()) {
      toast({ title: 'Please provide a reason', variant: 'destructive' })
      return
    }
    verifyMutation.mutate({ confirmed: false, note: issueNote })
  }

  // Don't show if loading or no verification needed
  if (isLoading || !verificationStatus?.verification_required) return null

  const assignment = verificationStatus.assignment

  return (
    <Modal isOpen onClose={() => {}} closeOnOverlayClick={false} closeOnEsc={false} isCentered size="md">
      <ModalOverlay />
      <ModalContent borderRadius="20px" mx="16px">
        <ModalHeader>
          <Flex align="center" gap="8px">
            <Icon as={MdBusiness} color="brand.500" w="24px" h="24px" />
            Branch Assignment Verification
          </Flex>
          <Text fontSize="sm" fontWeight="normal" color="secondaryGray.600" mt="6px">
            Your branch assignment has been updated. Please verify you are at the correct location.
          </Text>
        </ModalHeader>
        <ModalBody>
          <Box bg={tint} borderRadius="16px" p="16px" mb="16px">
            <Text fontWeight="600" fontSize="lg" color={textColor} mb="8px">
              You have been assigned to:
            </Text>
            <Flex align="center" gap="12px">
              <Icon as={MdBusiness} color="brand.500" w="32px" h="32px" />
              <Box>
                <Text fontSize="xl" fontWeight="bold" color="brand.500">
                  {assignment?.branch_name}
                </Text>
                <Text fontSize="sm" color="secondaryGray.600">
                  Assigned by {assignment?.assigned_by_name} on{' '}
                  {assignment?.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString() : 'N/A'}
                </Text>
              </Box>
            </Flex>
            {assignment?.effective_from && (
              <Text fontSize="sm" mt="8px">
                <strong>Effective from:</strong> {new Date(assignment.effective_from).toLocaleDateString()}
              </Text>
            )}
            {assignment?.notes && (
              <Text fontSize="sm" mt="8px" color="secondaryGray.600">
                <strong>Note:</strong> {assignment.notes}
              </Text>
            )}
          </Box>

          {!showIssueForm ? (
            <Alert status="warning" borderRadius="12px" fontSize="sm">
              <AlertIcon />
              <Text>
                <strong>Security Check:</strong> Please confirm you are physically present at this branch before continuing. This ensures all
                your transactions are recorded correctly.
              </Text>
            </Alert>
          ) : (
            <>
              <Alert status="error" borderRadius="12px" fontSize="sm" mb="12px">
                <AlertIcon />
                <Text>
                  <strong>Report Issue:</strong> If you are not at the assigned branch, please explain why.
                </Text>
              </Alert>
              <FormControl>
                <FormLabel fontSize="sm">Why are you not at the assigned branch?</FormLabel>
                <Textarea
                  variant="main"
                  rows={3}
                  value={issueNote}
                  onChange={(e) => setIssueNote(e.target.value)}
                  placeholder="e.g., I was not informed of this change, I am still at the previous branch, etc."
                />
              </FormControl>
            </>
          )}
        </ModalBody>
        <ModalFooter gap="8px" flexDirection={{ base: 'column', sm: 'row' }}>
          {!showIssueForm ? (
            <>
              <Button variant="light" w={{ base: '100%', sm: 'auto' }} leftIcon={<MdWarningAmber />} onClick={() => setShowIssueForm(true)}>
                I'm not at this branch
              </Button>
              <Button
                variant="brand"
                w={{ base: '100%', sm: 'auto' }}
                leftIcon={<MdCheckCircle />}
                isLoading={verifyMutation.isPending}
                loadingText="Verifying..."
                onClick={() => verifyMutation.mutate({ confirmed: true })}
              >
                Yes, I am at this branch
              </Button>
            </>
          ) : (
            <>
              <Button variant="light" w={{ base: '100%', sm: 'auto' }} onClick={() => setShowIssueForm(false)}>
                Back
              </Button>
              <Button
                colorScheme="red"
                w={{ base: '100%', sm: 'auto' }}
                isLoading={verifyMutation.isPending}
                loadingText="Submitting..."
                isDisabled={!issueNote.trim()}
                onClick={handleReportIssue}
              >
                Submit Issue Report
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
