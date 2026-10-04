import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Button,
  Flex,
  HStack,
  Icon,
  IconButton,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { MdAccessTime, MdAdd, MdCalendarToday, MdCheckCircle, MdChevronLeft, MdChevronRight, MdDescription, MdPerson, MdSettings, MdVisibility } from 'react-icons/md'
import api from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'
import { EmptyState, SearchInput, TableBox } from '@/components/ui'
import { QuickActions } from '@/components/dashboard/widgets'
import { PricingCards, PricingModal, SCAN_TYPE_LABELS, ScanTypeBadge, StatusBadge } from './shared'

export default function ScansPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showPricingDialog, setShowPricingDialog] = useState(false)

  const { data: scansData, isLoading } = useQuery({
    queryKey: ['scans', typeFilter, statusFilter, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (typeFilter && typeFilter !== 'all') params.append('scan_type', typeFilter)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      params.append('skip', ((page - 1) * pageSize).toString())
      params.append('limit', pageSize.toString())
      return (await api.get(`/technician/scans?${params.toString()}`)).data
    },
  })

  const scans = Array.isArray(scansData) ? scansData : scansData?.items || []
  const totalCount = scansData?.total || scans.length
  const totalPages = Math.ceil(totalCount / pageSize)

  const { data: pricing = [] } = useQuery({
    queryKey: ['scan-pricing'],
    queryFn: async () => (await api.get('/technician/scan-pricing')).data,
  })

  const term = search.toLowerCase()
  const filteredScans = scans.filter(
    (s: any) => s.scan_number?.toLowerCase().includes(term) || s.patient?.name?.toLowerCase().includes(term) || s.client_name?.toLowerCase().includes(term)
  )

  return (
    <>
      <PageHeader
        title="Technician Scans"
        description="OCT, Visual Field Test, Fundus Photography, and Pachymeter scans"
        actions={
          <HStack spacing="8px">
            <Button variant="light" leftIcon={<MdSettings />} onClick={() => setShowPricingDialog(true)} data-tour="pricing">
              Pricing
            </Button>
            <Button variant="brand" leftIcon={<MdAdd />} onClick={() => navigate('/technician/scans/new')} data-tour="new-scan">
              New Scan
            </Button>
          </HStack>
        }
      />

      <PricingCards pricing={pricing} />

      <Card mb="20px">
        <QuickActions
          columns={{ base: 2, md: 4 }}
          actions={Object.entries(SCAN_TYPE_LABELS).map(([type, label]) => ({
            label: type === 'oct' ? 'OCT Scan' : label,
            icon: MdVisibility,
            onClick: () => navigate(`/technician/scans/new?type=${type}`),
          }))}
        />
      </Card>

      <Card mb="20px">
        <Flex gap="12px" wrap="wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by scan number, patient name..." flex="1" minW="200px" maxW="100%" />
          <Select variant="main" w="180px" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            {Object.entries(SCAN_TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </Select>
          <Select variant="main" w="180px" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="reviewed">Reviewed</option>
          </Select>
        </Flex>
      </Card>

      <SectionCard title={`Scans (${filteredScans.length})`}>
        {isLoading ? (
          <Flex justify="center" py="32px">
            <Spinner color="brand.500" />
          </Flex>
        ) : filteredScans.length === 0 ? (
          <EmptyState icon={MdVisibility} title="No scans found">
            <Button variant="link" colorScheme="brand" mt="8px" onClick={() => navigate('/technician/scans/new')}>
              Record your first scan
            </Button>
          </EmptyState>
        ) : (
          <TableBox>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Scan #</Th>
                  <Th>Type</Th>
                  <Th>Patient/Client</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>PDF</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredScans.map((scan: any) => (
                  <Tr key={scan.id} cursor="pointer" _hover={{ bg: 'secondaryGray.100', _dark: { bg: 'whiteAlpha.50' } }} onClick={() => navigate(`/technician/scans/${scan.id}`)}>
                    <Td fontFamily="mono" fontSize="sm">
                      {scan.scan_number}
                    </Td>
                    <Td>
                      <ScanTypeBadge type={scan.scan_type} />
                    </Td>
                    <Td>
                      <Flex align="center" gap="8px">
                        <Icon as={MdPerson} color="secondaryGray.600" />
                        <Text>{scan.patient?.name || scan.client_name || 'N/A'}</Text>
                      </Flex>
                      {scan.patient?.patient_number && (
                        <Text fontSize="xs" color="secondaryGray.600" ms="24px">
                          {scan.patient.patient_number}
                        </Text>
                      )}
                    </Td>
                    <Td>
                      <Flex align="center" gap="4px" fontSize="sm">
                        <Icon as={MdCalendarToday} color="secondaryGray.600" />
                        {scan.scan_date ? new Date(scan.scan_date).toLocaleDateString() : 'N/A'}
                      </Flex>
                    </Td>
                    <Td>
                      <Flex align="center" gap="4px">
                        {scan.status === 'reviewed' && <Icon as={MdCheckCircle} color="purple.500" />}
                        {scan.status === 'pending' && <Icon as={MdAccessTime} color="yellow.500" />}
                        <StatusBadge status={scan.status} />
                      </Flex>
                    </Td>
                    <Td>
                      {scan.has_pdf ? (
                        <Badge variant="outline" colorScheme="green" display="inline-flex" alignItems="center" gap="4px">
                          <Icon as={MdDescription} />
                          PDF
                        </Badge>
                      ) : (
                        <Text color="secondaryGray.600" fontSize="sm">
                          -
                        </Text>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableBox>
        )}

        {totalPages > 1 && (
          <Flex justify="space-between" align="center" pt="16px" gap="12px" wrap="wrap">
            <HStack spacing="8px" fontSize="sm" color="secondaryGray.600">
              <Text>Show</Text>
              <Select
                size="sm"
                variant="main"
                w="80px"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value))
                  setPage(1)
                }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
              <Text>per page</Text>
            </HStack>
            <HStack spacing="8px">
              <Text fontSize="sm" color="secondaryGray.600">
                Page {page} of {totalPages}
              </Text>
              <IconButton aria-label="Previous page" size="sm" variant="light" icon={<MdChevronLeft />} onClick={() => setPage((p) => Math.max(1, p - 1))} isDisabled={page === 1} />
              <IconButton aria-label="Next page" size="sm" variant="light" icon={<MdChevronRight />} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} isDisabled={page === totalPages} />
            </HStack>
          </Flex>
        )}
      </SectionCard>

      <PricingModal isOpen={showPricingDialog} onClose={() => setShowPricingDialog(false)} pricing={pricing} />
    </>
  )
}
