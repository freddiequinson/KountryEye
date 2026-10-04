import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  GridItem,
  Heading,
  Icon,
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from '@chakra-ui/react'
import { MdArrowBack, MdCreditCard, MdDescription, MdEvent, MdMedication } from 'react-icons/md'
import { FaGlasses } from 'react-icons/fa'
import api from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { RowBox } from '@/components/dashboard/widgets'
import { EmptyState } from '@/components/ui'

const paidScheme = (status: string) => (status === 'paid' ? 'green' : 'gray')

function SmallStat({ label, icon, children, borderColor }: { label: string; icon?: React.ElementType; children: React.ReactNode; borderColor?: string }) {
  return (
    <Card border={borderColor ? '1px solid' : undefined} borderColor={borderColor}>
      <Flex align="center" gap="8px" fontSize="sm" fontWeight="500" color="secondaryGray.600" mb="8px">
        {icon && <Icon as={icon} />}
        {label}
      </Flex>
      {children}
    </Card>
  )
}

function PrescriptionItemCard({ item, showType }: { item: any; showType?: boolean }) {
  return (
    <Card py="16px">
      <Flex justify="space-between" align="start" gap="12px">
        <Stack spacing="4px">
          <Flex align="center" gap="8px">
            {showType && <Badge variant="outline">{item.item_type}</Badge>}
            <Heading size="sm">{item.name}</Heading>
          </Flex>
          {item.dosage && (
            <Text fontSize="sm">
              <Text as="span" color="secondaryGray.600">
                Dosage:
              </Text>{' '}
              {item.dosage}
            </Text>
          )}
          {item.duration && (
            <Text fontSize="sm">
              <Text as="span" color="secondaryGray.600">
                Duration:
              </Text>{' '}
              {item.duration}
            </Text>
          )}
          {item.description && (
            <Text fontSize="sm" color="secondaryGray.600">
              {item.description}
            </Text>
          )}
          <Flex gap="8px" mt="4px">
            {item.is_external && <Badge variant="outline">External</Badge>}
            {item.was_out_of_stock && <Badge colorScheme="yellow">Was out of stock</Badge>}
          </Flex>
        </Stack>
        <Box textAlign="right">
          <Text fontWeight="500">Qty: {item.quantity}</Text>
          <Text fontSize="sm" color="secondaryGray.600">
            GHS {(item.quantity * item.unit_price).toFixed(2)}
          </Text>
          <Badge colorScheme={paidScheme(item.prescription.status)} mt="8px">
            {item.prescription.status}
          </Badge>
        </Box>
      </Flex>
    </Card>
  )
}

export default function VisitDetailPage() {
  const { patientId, visitId } = useParams<{ patientId: string; visitId: string }>()
  const navigate = useNavigate()

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}`)).data,
    enabled: !!patientId,
  })

  const { data: visitDetail, isLoading } = useQuery({
    queryKey: ['visit-detail', visitId],
    queryFn: async () => (await api.get(`/clinical/visits/${visitId}/detail`)).data,
    enabled: !!visitId,
  })

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['visit-prescriptions', visitId],
    queryFn: async () => (await api.get(`/clinical/visits/${visitId}/prescriptions`)).data,
    enabled: !!visitId,
  })

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="256px">
        <Spinner color="brand.500" />
      </Flex>
    )
  }

  // Separate medications from optical prescriptions
  const medications = prescriptions.flatMap((p: any) =>
    p.items.filter((i: any) => i.item_type === 'medication').map((item: any) => ({ ...item, prescription: p })),
  )
  const opticalItems = prescriptions.flatMap((p: any) =>
    p.items.filter((i: any) => ['spectacle', 'lens', 'other'].includes(i.item_type)).map((item: any) => ({ ...item, prescription: p })),
  )

  const balance = (visitDetail?.consultation_fee || 0) - (visitDetail?.amount_paid || 0)
  const record = visitDetail?.clinical_record

  return (
    <>
      <Button variant="ghost" size="sm" leftIcon={<MdArrowBack />} onClick={() => navigate(`/patients/${patientId}`)} mb="8px">
        Back to Patient
      </Button>
      <PageHeader
        title="Visit Details"
        description={
          <Flex as="span" align="center" gap="8px">
            {patient?.first_name} {patient?.last_name}
            <Badge variant="outline">{patient?.patient_number}</Badge>
          </Flex>
        }
      />

      {/* Visit Summary Cards */}
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px" mb="20px">
        <SmallStat label="Visit Date" icon={MdEvent}>
          <Text fontSize="lg" fontWeight="600">
            {visitDetail?.visit_date ? new Date(visitDetail.visit_date).toLocaleDateString() : '-'}
          </Text>
          <Text fontSize="sm" color="secondaryGray.600">
            {visitDetail?.visit_date ? new Date(visitDetail.visit_date).toLocaleTimeString() : ''}
          </Text>
        </SmallStat>
        <SmallStat label="Visit Type">
          <Badge variant="outline" fontSize="md">
            {visitDetail?.visit_type?.replace('_', ' ') || '-'}
          </Badge>
        </SmallStat>
        <SmallStat label="Status">
          <Badge colorScheme={visitDetail?.status === 'completed' ? 'green' : 'gray'}>{visitDetail?.status || '-'}</Badge>
        </SmallStat>
        <SmallStat label="Payment" icon={MdCreditCard} borderColor={balance > 0 ? 'red.200' : 'green.200'}>
          <Text fontSize="lg" fontWeight="600">
            GHS {visitDetail?.amount_paid?.toFixed(2) || '0.00'} / {visitDetail?.consultation_fee?.toFixed(2) || '0.00'}
          </Text>
          {balance > 0 && (
            <Text fontSize="sm" color="red.500">
              Balance: GHS {balance.toFixed(2)}
            </Text>
          )}
        </SmallStat>
      </SimpleGrid>

      <Tabs variant="soft-rounded" mb="20px">
        <TabList gap="8px" flexWrap="wrap" mb="16px">
          <Tab>
            <Icon as={MdDescription} me="8px" />
            Clinical Record
          </Tab>
          <Tab>
            <Icon as={MdMedication} me="8px" />
            Medications ({medications.length})
          </Tab>
          <Tab>
            <Icon as={FaGlasses} me="8px" />
            Optical Rx ({opticalItems.length})
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel p="0">
            {record ? (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing="20px">
                <SectionCard title="Chief Complaint">
                  <Text fontSize="sm">{record.chief_complaint || 'Not recorded'}</Text>
                </SectionCard>
                <SectionCard title="History of Present Illness">
                  <Text fontSize="sm">{record.history_of_present_illness || 'Not recorded'}</Text>
                </SectionCard>
                <SectionCard title="Visual Acuity">
                  <Stack spacing="8px">
                    <Flex justify="space-between">
                      <Text color="secondaryGray.600">OD (Right):</Text>
                      <Text fontWeight="500">{record.visual_acuity_od || '-'}</Text>
                    </Flex>
                    <Flex justify="space-between">
                      <Text color="secondaryGray.600">OS (Left):</Text>
                      <Text fontWeight="500">{record.visual_acuity_os || '-'}</Text>
                    </Flex>
                  </Stack>
                </SectionCard>
                <SectionCard title="Diagnosis">
                  <Text fontSize="sm">{record.diagnosis || 'Not recorded'}</Text>
                </SectionCard>
                <GridItem colSpan={{ base: 1, md: 2 }}>
                  <SectionCard title="Management Plan">
                    <Text fontSize="sm">{record.management_plan || 'Not recorded'}</Text>
                  </SectionCard>
                </GridItem>
                {record.follow_up_date && (
                  <SectionCard title="Follow-up Date">
                    <Text fontSize="sm" fontWeight="500">
                      {new Date(record.follow_up_date).toLocaleDateString()}
                    </Text>
                  </SectionCard>
                )}
              </SimpleGrid>
            ) : (
              <Card>
                <EmptyState>No clinical record found for this visit</EmptyState>
              </Card>
            )}
          </TabPanel>
          <TabPanel p="0">
            {medications.length > 0 ? (
              <Stack spacing="12px">
                {medications.map((item: any, index: number) => (
                  <PrescriptionItemCard key={index} item={item} />
                ))}
              </Stack>
            ) : (
              <Card>
                <EmptyState>No medications prescribed for this visit</EmptyState>
              </Card>
            )}
          </TabPanel>
          <TabPanel p="0">
            {opticalItems.length > 0 ? (
              <Stack spacing="12px">
                {opticalItems.map((item: any, index: number) => (
                  <PrescriptionItemCard key={index} item={item} showType />
                ))}
              </Stack>
            ) : (
              <Card>
                <EmptyState>No optical prescriptions for this visit</EmptyState>
              </Card>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Prescription Summary */}
      {prescriptions.length > 0 && (
        <SectionCard title="Prescription Summary">
          <Stack spacing="16px">
            {prescriptions.map((prescription: any) => (
              <RowBox key={prescription.id} display="block" p="16px">
                <Flex justify="space-between" align="center" mb="12px">
                  <Flex gap="8px">
                    <Badge colorScheme={paidScheme(prescription.status)}>{prescription.status}</Badge>
                    {prescription.is_dispensed && <Badge variant="outline">Dispensed</Badge>}
                  </Flex>
                  <Text fontSize="sm" color="secondaryGray.600">
                    {new Date(prescription.created_at).toLocaleString()}
                  </Text>
                </Flex>
                <Stack spacing="0" divider={<Divider />}>
                  {prescription.items.map((item: any) => (
                    <Flex key={item.id} justify="space-between" fontSize="sm" py="6px">
                      <Box>
                        <Text as="span" fontWeight="500">
                          {item.name}
                        </Text>
                        <Text as="span" color="secondaryGray.600" ms="8px">
                          ({item.item_type})
                        </Text>
                        {item.dosage && (
                          <Text as="span" color="secondaryGray.600" ms="8px">
                            - {item.dosage}
                          </Text>
                        )}
                      </Box>
                      <Text>
                        x{item.quantity} = GHS {(item.quantity * item.unit_price).toFixed(2)}
                      </Text>
                    </Flex>
                  ))}
                </Stack>
                <Divider mt="8px" />
                <Flex justify="end" pt="8px">
                  <Text fontWeight="600">Total: GHS {prescription.total_amount.toFixed(2)}</Text>
                </Flex>
              </RowBox>
            ))}
          </Stack>
        </SectionCard>
      )}
    </>
  )
}
