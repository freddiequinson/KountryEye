import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Collapse,
  Flex,
  HStack,
  Icon,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Select,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { MdAdd, MdApartment, MdCalendarToday, MdExpandMore, MdChevronRight, MdGridView, MdList, MdMoreVert, MdPeople, MdPersonAdd, MdPhone, MdVisibility } from 'react-icons/md'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { ConfirmDialog, EmptyState, SearchInput, TableBox } from '@/components/ui'
import { StatusBadge } from './shared'

const rowHover = { bg: 'secondaryGray.100', _dark: { bg: 'whiteAlpha.50' } }
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : 'N/A')
const fmtFee = (n?: number) => `GH₵ ${(n || 0).toLocaleString()}`

export default function ReferralsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list')
  const [expandedDoctors, setExpandedDoctors] = useState<Set<number>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [convertingId, setConvertingId] = useState<number | null>(null)

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['referrals', statusFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      return (await api.get(`/technician/referrals?${params.toString()}`)).data
    },
  })

  const convertToPatientMutation = useMutation({
    mutationFn: async (referralId: number) => (await api.post(`/technician/referrals/${referralId}/convert-to-patient`)).data,
    onSuccess: (data) => {
      toast({ title: 'Success', description: `Client converted to patient. Patient #: ${data.patient_number}` })
      queryClient.invalidateQueries({ queryKey: ['referrals'] })
      setConvertingId(null)
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to convert client to patient', variant: 'destructive' })
    },
  })

  const term = search.toLowerCase()
  const filteredReferrals = referrals.filter(
    (r: any) => r.client_name?.toLowerCase().includes(term) || r.referral_number?.toLowerCase().includes(term) || r.referral_doctor?.name?.toLowerCase().includes(term)
  )

  const groupedByDoctor = useMemo(() => {
    const groups: Record<number, { doctor: any; referrals: any[]; totalFees: number }> = {}
    filteredReferrals.forEach((r: any) => {
      const doctorId = r.referral_doctor?.id || 0
      if (!groups[doctorId]) groups[doctorId] = { doctor: r.referral_doctor || { id: 0, name: 'Unknown Doctor' }, referrals: [], totalFees: 0 }
      groups[doctorId].referrals.push(r)
      groups[doctorId].totalFees += r.service_fee || 0
    })
    return Object.values(groups).sort((a, b) => b.referrals.length - a.referrals.length)
  }, [filteredReferrals])

  const toggleDoctorExpanded = (doctorId: number) => {
    setExpandedDoctors((prev) => {
      const next = new Set(prev)
      if (next.has(doctorId)) next.delete(doctorId)
      else next.add(doctorId)
      return next
    })
  }

  const rowMenu = (referral: any, withView: boolean) => (
    <Menu placement="bottom-end" isLazy>
      <MenuButton as={IconButton} aria-label="Actions" variant="ghost" size="sm" icon={<MdMoreVert />} onClick={(e) => e.stopPropagation()} />
      <MenuList onClick={(e) => e.stopPropagation()}>
        {withView && (
          <MenuItem icon={<MdVisibility />} onClick={() => navigate(`/technician/referrals/${referral.id}`)}>
            View Details
          </MenuItem>
        )}
        <MenuItem icon={<MdVisibility />} onClick={() => navigate(`/technician/scans/new?referral=${referral.id}`)}>
          Add Scan
        </MenuItem>
        {!referral.patient_id && (
          <MenuItem icon={<MdPersonAdd />} onClick={() => setConvertingId(referral.id)}>
            Convert to Patient
          </MenuItem>
        )}
      </MenuList>
    </Menu>
  )

  return (
    <>
      <PageHeader
        title="External Referrals"
        description="Manage referrals from external doctors and hospitals"
        actions={
          <Button variant="brand" leftIcon={<MdAdd />} onClick={() => navigate('/technician/referrals/new')}>
            New Referral
          </Button>
        }
      />

      <Card mb="20px">
        <Flex gap="12px" wrap="wrap" align="center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by client name, referral number, or doctor..." flex="1" minW="200px" maxW="100%" />
          <Input variant="main" type="date" w="160px" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date" />
          <Input variant="main" type="date" w="160px" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date" />
          <Select variant="main" w="180px" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <ButtonGroup isAttached size="sm">
            <Button leftIcon={<MdList />} variant={viewMode === 'list' ? 'brand' : 'light'} onClick={() => setViewMode('list')}>
              List
            </Button>
            <Button leftIcon={<MdGridView />} variant={viewMode === 'grouped' ? 'brand' : 'light'} onClick={() => setViewMode('grouped')}>
              By Doctor
            </Button>
          </ButtonGroup>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
              }}
            >
              Clear Dates
            </Button>
          )}
        </Flex>
      </Card>

      {viewMode === 'list' && (
        <SectionCard title={`Referrals (${filteredReferrals.length})`}>
          {isLoading ? (
            <Flex justify="center" py="32px">
              <Spinner color="brand.500" />
            </Flex>
          ) : filteredReferrals.length === 0 ? (
            <EmptyState icon={MdPeople} title="No referrals found">
              <Button variant="link" colorScheme="brand" mt="8px" onClick={() => navigate('/technician/referrals/new')}>
                Add your first referral
              </Button>
            </EmptyState>
          ) : (
            <TableBox>
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Referral #</Th>
                    <Th>Client</Th>
                    <Th>Referring Doctor</Th>
                    <Th>Date</Th>
                    <Th>Service Fee</Th>
                    <Th>Status</Th>
                    <Th w="50px" />
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredReferrals.map((referral: any) => (
                    <Tr key={referral.id} cursor="pointer" _hover={rowHover} onClick={() => navigate(`/technician/referrals/${referral.id}`)}>
                      <Td fontFamily="mono" fontSize="sm">
                        {referral.referral_number}
                      </Td>
                      <Td>
                        <Text fontWeight="600">{referral.client_name}</Text>
                        {referral.client_phone && (
                          <Flex align="center" gap="4px" fontSize="xs" color="secondaryGray.600">
                            <Icon as={MdPhone} />
                            {referral.client_phone}
                          </Flex>
                        )}
                        {referral.patient_id && (
                          <Badge variant="outline" mt="4px">
                            Patient #{referral.patient_id}
                          </Badge>
                        )}
                      </Td>
                      <Td>
                        <Text fontWeight="600">{referral.referral_doctor?.name}</Text>
                        {referral.referral_doctor?.clinic_name && (
                          <Flex align="center" gap="4px" fontSize="xs" color="secondaryGray.600">
                            <Icon as={MdApartment} />
                            {referral.referral_doctor.clinic_name}
                          </Flex>
                        )}
                      </Td>
                      <Td>
                        <Flex align="center" gap="4px" fontSize="sm">
                          <Icon as={MdCalendarToday} color="secondaryGray.600" />
                          {fmtDate(referral.referral_date)}
                        </Flex>
                      </Td>
                      <Td>{fmtFee(referral.service_fee)}</Td>
                      <Td>
                        <StatusBadge status={referral.status} />
                      </Td>
                      <Td>{rowMenu(referral, true)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableBox>
          )}
        </SectionCard>
      )}

      {viewMode === 'grouped' && (
        <Stack spacing="16px">
          {isLoading ? (
            <Card>
              <Flex justify="center" py="32px">
                <Spinner color="brand.500" />
              </Flex>
            </Card>
          ) : groupedByDoctor.length === 0 ? (
            <Card>
              <EmptyState icon={MdPeople}>No referrals found</EmptyState>
            </Card>
          ) : (
            groupedByDoctor.map((group) => {
              const expanded = expandedDoctors.has(group.doctor.id)
              return (
                <Card key={group.doctor.id} p="0" overflow="hidden">
                  <Flex justify="space-between" align="center" gap="16px" p="20px" cursor="pointer" _hover={rowHover} onClick={() => toggleDoctorExpanded(group.doctor.id)}>
                    <Flex align="center" gap="16px" minW="0">
                      <Icon as={expanded ? MdExpandMore : MdChevronRight} w="20px" h="20px" color="secondaryGray.600" />
                      <Box minW="0">
                        <Text fontWeight="700" fontSize="lg">
                          {group.doctor.name}
                        </Text>
                        <HStack spacing="12px" fontSize="sm" color="secondaryGray.600" flexWrap="wrap">
                          {group.doctor.clinic_name && (
                            <Flex align="center" gap="4px">
                              <Icon as={MdApartment} />
                              {group.doctor.clinic_name}
                            </Flex>
                          )}
                          {group.doctor.phone && (
                            <Flex align="center" gap="4px">
                              <Icon as={MdPhone} />
                              {group.doctor.phone}
                            </Flex>
                          )}
                        </HStack>
                      </Box>
                    </Flex>
                    <HStack spacing="24px" textAlign="right">
                      <Box>
                        <Text fontSize="2xl" fontWeight="700">
                          {group.referrals.length}
                        </Text>
                        <Text fontSize="xs" color="secondaryGray.600">
                          referrals
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="lg" fontWeight="700" color="green.500">
                          {fmtFee(group.totalFees)}
                        </Text>
                        <Text fontSize="xs" color="secondaryGray.600">
                          total fees
                        </Text>
                      </Box>
                    </HStack>
                  </Flex>
                  <Collapse in={expanded} animateOpacity>
                    <Box px="20px" pb="20px" overflowX="auto">
                      <Table variant="simple" size="sm">
                        <Thead>
                          <Tr>
                            <Th>Referral #</Th>
                            <Th>Client</Th>
                            <Th>Date</Th>
                            <Th>Service Fee</Th>
                            <Th>Status</Th>
                            <Th w="50px" />
                          </Tr>
                        </Thead>
                        <Tbody>
                          {group.referrals.map((referral: any) => (
                            <Tr key={referral.id} cursor="pointer" _hover={rowHover} onClick={() => navigate(`/technician/referrals/${referral.id}`)}>
                              <Td fontFamily="mono" fontSize="sm">
                                {referral.referral_number}
                              </Td>
                              <Td>
                                <Text fontWeight="600">{referral.client_name}</Text>
                                {referral.client_phone && (
                                  <Text fontSize="xs" color="secondaryGray.600">
                                    {referral.client_phone}
                                  </Text>
                                )}
                              </Td>
                              <Td>{fmtDate(referral.referral_date)}</Td>
                              <Td>{fmtFee(referral.service_fee)}</Td>
                              <Td>
                                <StatusBadge status={referral.status} />
                              </Td>
                              <Td>{rowMenu(referral, false)}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  </Collapse>
                </Card>
              )
            })
          )}
        </Stack>
      )}

      <ConfirmDialog
        isOpen={convertingId !== null}
        onClose={() => setConvertingId(null)}
        onConfirm={() => convertingId !== null && convertToPatientMutation.mutate(convertingId)}
        isLoading={convertToPatientMutation.isPending}
        title="Convert to patient?"
        confirmLabel="Convert"
        colorScheme="green"
      >
        This creates a full patient record for this client.
      </ConfirmDialog>
    </>
  )
}
