import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  Table,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import { MdAccessTime, MdApartment, MdArrowBack, MdAttachMoney, MdCalendarToday, MdCheckCircle, MdDescription, MdEmail, MdLocationOn, MdPerson, MdPersonAdd, MdPhone, MdVisibility } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { ConfirmDialog, EmptyState, TableBox } from '@/components/ui'
import { StatusBadge } from './shared'

function InfoLine({ icon, children }: { icon: IconType; children: React.ReactNode }) {
  return (
    <Flex align="center" gap="8px">
      <Icon as={icon} color="secondaryGray.600" />
      <Box>{children}</Box>
    </Flex>
  )
}

function MiniStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card>
      <Text fontSize="sm" color="secondaryGray.600" mb="8px">
        {label}
      </Text>
      {children}
    </Card>
  )
}

const titled = (icon: IconType, text: string) => (
  <Flex align="center" gap="8px">
    <Icon as={icon} />
    {text}
  </Flex>
)

const paidBadge = (isPaid: boolean) => <Badge colorScheme={isPaid ? 'green' : 'yellow'}>{isPaid ? 'Paid' : 'Pending'}</Badge>

export default function ReferralDetailPage() {
  const { referralId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [confirmConvert, setConfirmConvert] = useState(false)

  const { data: referral, isLoading } = useQuery({
    queryKey: ['referral', referralId],
    queryFn: async () => (await api.get(`/technician/referrals/${referralId}`)).data,
    enabled: !!referralId,
  })

  const convertToPatientMutation = useMutation({
    mutationFn: async () => (await api.post(`/technician/referrals/${referralId}/convert-to-patient`)).data,
    onSuccess: (data) => {
      toast({ title: 'Success', description: `Client converted to patient. Patient #: ${data.patient_number}` })
      queryClient.invalidateQueries({ queryKey: ['referral', referralId] })
      setConfirmConvert(false)
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to convert client to patient', variant: 'destructive' })
    },
  })

  const statusBadge = (status: string) => {
    if (status === 'pending')
      return (
        <Badge colorScheme="yellow" display="inline-flex" alignItems="center" gap="4px">
          <Icon as={MdAccessTime} />
          Pending
        </Badge>
      )
    if (status === 'completed')
      return (
        <Badge colorScheme="green" display="inline-flex" alignItems="center" gap="4px">
          <Icon as={MdCheckCircle} />
          Completed
        </Badge>
      )
    return <StatusBadge status={status} />
  }

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="256px">
        <Spinner color="brand.500" />
      </Flex>
    )
  }

  if (!referral) {
    return (
      <EmptyState title="Referral not found">
        <Button variant="light" leftIcon={<MdArrowBack />} mt="12px" onClick={() => navigate('/technician/referrals')}>
          Back to Referrals
        </Button>
      </EmptyState>
    )
  }

  const scans = referral.scans || []
  const addScan = () => navigate(`/technician/scans/new?referral=${referralId}`)

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate('/technician/referrals')} mb="8px">
        Back
      </Button>
      <PageHeader
        title={`Referral ${referral.referral_number}`}
        description={referral.client_name}
        actions={
          <HStack spacing="8px">
            {!referral.patient_id && (
              <Button variant="light" leftIcon={<MdPersonAdd />} onClick={() => setConfirmConvert(true)}>
                Convert to Patient
              </Button>
            )}
            <Button variant="brand" leftIcon={<MdVisibility />} onClick={addScan}>
              Add Scan
            </Button>
          </HStack>
        }
      />

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing="20px" mb="20px">
        <MiniStat label="Status">{statusBadge(referral.status)}</MiniStat>
        <MiniStat label="Service Fee">
          <Text fontSize="2xl" fontWeight="700">
            GH₵{referral.service_fee?.toLocaleString() || '0'}
          </Text>
        </MiniStat>
        <MiniStat label="Scans">
          <Text fontSize="2xl" fontWeight="700">
            {scans.length}
          </Text>
        </MiniStat>
        <MiniStat label="Payment">
          {referral.payment ? (
            paidBadge(referral.payment.is_paid)
          ) : (
            <Text fontSize="sm" color="secondaryGray.600">
              No payment
            </Text>
          )}
        </MiniStat>
      </SimpleGrid>

      <Tabs variant="soft-rounded" isLazy>
        <TabList gap="8px" mb="16px" flexWrap="wrap">
          <Tab>Client Details</Tab>
          <Tab>Scans ({scans.length})</Tab>
          <Tab>Payment</Tab>
        </TabList>

        <TabPanels>
          <TabPanel p="0">
            <Stack spacing="20px">
              <SectionCard title={titled(MdPerson, 'Client Information')}>
                <Stack spacing="12px">
                  <InfoLine icon={MdPerson}>
                    <Text fontWeight="600">{referral.client_name}</Text>
                  </InfoLine>
                  {referral.client_phone && <InfoLine icon={MdPhone}>{referral.client_phone}</InfoLine>}
                  {referral.client_email && <InfoLine icon={MdEmail}>{referral.client_email}</InfoLine>}
                  {referral.client_address && <InfoLine icon={MdLocationOn}>{referral.client_address}</InfoLine>}
                  {referral.client_dob && <InfoLine icon={MdCalendarToday}>DOB: {new Date(referral.client_dob).toLocaleDateString()}</InfoLine>}
                  {referral.client_sex && <InfoLine icon={MdPerson}>Sex: {referral.client_sex}</InfoLine>}
                  {referral.patient_id && (
                    <Box pt="8px" borderTop="1px solid" borderColor="secondaryGray.100">
                      <Badge variant="outline" cursor="pointer" onClick={() => navigate(`/patients/${referral.patient_id}`)}>
                        Linked to Patient #{referral.patient_id}
                      </Badge>
                    </Box>
                  )}
                </Stack>
              </SectionCard>

              <SectionCard title={titled(MdApartment, 'Referring Doctor')}>
                {referral.referral_doctor ? (
                  <Stack spacing="12px">
                    <InfoLine icon={MdPerson}>
                      <Text fontWeight="600">{referral.referral_doctor.name}</Text>
                    </InfoLine>
                    {referral.referral_doctor.clinic_name && <InfoLine icon={MdApartment}>{referral.referral_doctor.clinic_name}</InfoLine>}
                    {referral.referral_doctor.phone && <InfoLine icon={MdPhone}>{referral.referral_doctor.phone}</InfoLine>}
                  </Stack>
                ) : (
                  <Text color="secondaryGray.600">No referring doctor assigned</Text>
                )}
              </SectionCard>

              <SectionCard title={titled(MdDescription, 'Referral Details')} gridColumn={{ md: 'span 2' }}>
                <Stack spacing="16px">
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing="16px">
                    <Box>
                      <Text fontSize="sm" color="secondaryGray.600">
                        Referral Date
                      </Text>
                      <Text fontWeight="600">{referral.referral_date ? new Date(referral.referral_date).toLocaleDateString() : '-'}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="secondaryGray.600">
                        Technician
                      </Text>
                      <Text fontWeight="600">{referral.technician?.name || '-'}</Text>
                    </Box>
                  </SimpleGrid>
                  {referral.reason && (
                    <Box>
                      <Text fontSize="sm" color="secondaryGray.600">
                        Reason for Referral
                      </Text>
                      <Text>{referral.reason}</Text>
                    </Box>
                  )}
                  {referral.notes && (
                    <Box>
                      <Text fontSize="sm" color="secondaryGray.600">
                        Notes
                      </Text>
                      <Text>{referral.notes}</Text>
                    </Box>
                  )}
                </Stack>
              </SectionCard>
            </Stack>
          </TabPanel>

          <TabPanel p="0">
            <SectionCard
              title="Scans"
              actions={
                <Button size="sm" variant="brand" leftIcon={<MdVisibility />} onClick={addScan}>
                  Add Scan
                </Button>
              }
            >
              {scans.length === 0 ? (
                <EmptyState icon={MdVisibility}>No scans recorded for this referral</EmptyState>
              ) : (
                <TableBox>
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Scan #</Th>
                        <Th>Type</Th>
                        <Th>Date</Th>
                        <Th>Status</Th>
                        <Th />
                      </Tr>
                    </Thead>
                    <Tbody>
                      {scans.map((scan: any) => (
                        <Tr key={scan.id}>
                          <Td fontFamily="mono">{scan.scan_number}</Td>
                          <Td>{scan.scan_type}</Td>
                          <Td>{scan.scan_date ? new Date(scan.scan_date).toLocaleDateString() : '-'}</Td>
                          <Td>
                            <StatusBadge status={scan.status} />
                          </Td>
                          <Td>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/technician/scans/${scan.id}`)}>
                              View
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableBox>
              )}
            </SectionCard>
          </TabPanel>

          <TabPanel p="0">
            <SectionCard title={titled(MdAttachMoney, 'Payment Information')}>
              {referral.payment ? (
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing="16px">
                  <Box>
                    <Text fontSize="sm" color="secondaryGray.600">
                      Amount
                    </Text>
                    <Text fontSize="2xl" fontWeight="700">
                      GH₵{referral.payment.amount?.toLocaleString()}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="secondaryGray.600" mb="4px">
                      Status
                    </Text>
                    {paidBadge(referral.payment.is_paid)}
                  </Box>
                  {referral.payment.payment_date && (
                    <Box>
                      <Text fontSize="sm" color="secondaryGray.600">
                        Payment Date
                      </Text>
                      <Text fontWeight="600">{new Date(referral.payment.payment_date).toLocaleDateString()}</Text>
                    </Box>
                  )}
                </SimpleGrid>
              ) : (
                <EmptyState icon={MdAttachMoney}>No payment recorded for this referral</EmptyState>
              )}
            </SectionCard>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <ConfirmDialog
        isOpen={confirmConvert}
        onClose={() => setConfirmConvert(false)}
        onConfirm={() => convertToPatientMutation.mutate()}
        isLoading={convertToPatientMutation.isPending}
        title="Convert to patient?"
        confirmLabel="Convert"
        colorScheme="green"
      >
        This creates a full patient record for {referral.client_name}.
      </ConfirmDialog>
    </>
  )
}
