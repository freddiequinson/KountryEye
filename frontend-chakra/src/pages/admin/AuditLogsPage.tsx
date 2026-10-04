import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Badge, Box, Button, Flex, Icon, Input, Select, SimpleGrid, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react'
import { MdAccessTime, MdDescription, MdFilterList, MdMonitor, MdPerson, MdRefresh, MdTimeline } from 'react-icons/md'
import api from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/card/StatCard'
import SectionCard from '@/components/card/SectionCard'
import { EmptyState, Field, Pagination, SearchInput } from '@/components/ui'

const LIMIT = 50

const defaultFilters = () => ({
  user_id: 'all',
  role_id: 'all',
  action: 'all',
  module: 'all',
  search: '',
  start_date: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
  end_date: format(new Date(), 'yyyy-MM-dd'),
})

const actionScheme = (action: string) => {
  if (action?.includes('login')) return 'green'
  if (action?.includes('logout')) return 'gray'
  if (action?.includes('create') || action?.includes('add')) return 'blue'
  if (action?.includes('update') || action?.includes('edit')) return 'yellow'
  if (action?.includes('delete') || action?.includes('remove')) return 'red'
  if (action?.includes('view') || action?.includes('page')) return 'purple'
  if (action?.includes('payment') || action?.includes('sale')) return 'teal'
  return 'gray'
}

export default function AuditLogsPage() {
  const [filters, setFilters] = useState(defaultFilters)
  const [page, setPage] = useState(0)

  const setFilter = (key: keyof ReturnType<typeof defaultFilters>, value: string) => {
    setFilters({ ...filters, [key]: value })
    setPage(0)
  }

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => (await api.get('/users/')).data,
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles-list'],
    queryFn: async () => (await api.get('/permissions/roles')).data,
  })

  const { data: actions = [] } = useQuery({
    queryKey: ['audit-actions'],
    queryFn: async () => (await api.get('/audit/logs/actions')).data.actions || [],
  })

  const { data: modules = [] } = useQuery({
    queryKey: ['audit-modules'],
    queryFn: async () => (await api.get('/audit/logs/modules')).data.modules || [],
  })

  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: async () => {
      const params: any = { skip: page * LIMIT, limit: LIMIT }
      if (filters.user_id !== 'all') params.user_id = filters.user_id
      if (filters.role_id !== 'all') params.role_id = filters.role_id
      if (filters.action !== 'all') params.action = filters.action
      if (filters.module !== 'all') params.module = filters.module
      if (filters.search) params.search = filters.search
      if (filters.start_date) params.start_date = filters.start_date
      if (filters.end_date) params.end_date = filters.end_date
      return (await api.get('/audit/logs', { params })).data
    },
  })

  const { data: summary } = useQuery({
    queryKey: ['audit-summary', filters.start_date, filters.end_date],
    queryFn: async () => (await api.get('/audit/logs/summary', { params: { start_date: filters.start_date, end_date: filters.end_date } })).data,
  })

  const logs = logsData?.items || []
  const total = logsData?.total || 0
  const totalPages = Math.ceil(total / LIMIT)

  return (
    <>
      <PageHeader
        title={
          <Flex as="span" align="center" gap="8px">
            <Icon as={MdDescription} />
            Audit Logs
          </Flex>
        }
        description="View system activities, user actions, and access logs"
        actions={
          <Button variant="light" leftIcon={<MdRefresh />} onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      {/* Summary Cards */}
      {summary && (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing="20px" mb="20px">
          <StatCard name="Total Activities" value={summary.total_activities?.toLocaleString()} icon={MdTimeline} iconColor="blue.500" />
          <StatCard name="Active Users" value={summary.most_active_users?.length || 0} icon={MdPerson} iconColor="green.500" />
          <StatCard name="Top Action" value={<Text fontSize="lg" noOfLines={1}>{summary.by_action?.[0]?.action || '-'}</Text>} icon={MdMonitor} iconColor="purple.500" />
          <StatCard
            name="Date Range"
            value={
              <Text fontSize="sm">
                {filters.start_date} to {filters.end_date}
              </Text>
            }
            icon={MdAccessTime}
            iconColor="orange.500"
          />
        </SimpleGrid>
      )}

      {/* Filters */}
      <SectionCard
        title={
          <Flex align="center" gap="8px">
            <Icon as={MdFilterList} />
            Filters
          </Flex>
        }
        mb="20px"
      >
        <SimpleGrid columns={{ base: 1, md: 3, xl: 6 }} spacing="16px">
          <Field label="Search">
            <SearchInput maxW="100%" value={filters.search} onChange={(v) => setFilter('search', v)} />
          </Field>
          <Field label="User">
            <Select variant="main" value={filters.user_id} onChange={(e) => setFilter('user_id', e.target.value)}>
              <option value="all">All users</option>
              {users.map((user: any) => (
                <option key={user.id} value={user.id.toString()}>
                  {user.first_name} {user.last_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Role">
            <Select variant="main" value={filters.role_id} onChange={(e) => setFilter('role_id', e.target.value)}>
              <option value="all">All roles</option>
              {roles.map((role: any) => (
                <option key={role.id} value={role.id.toString()}>
                  {role.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Action">
            <Select variant="main" value={filters.action} onChange={(e) => setFilter('action', e.target.value)}>
              <option value="all">All actions</option>
              {actions.map((action: string) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Module">
            <Select variant="main" value={filters.module} onChange={(e) => setFilter('module', e.target.value)}>
              <option value="all">All modules</option>
              {modules.map((module: string) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date Range">
            <Flex gap="8px">
              <Input variant="main" type="date" fontSize="xs" px="8px" value={filters.start_date} onChange={(e) => setFilter('start_date', e.target.value)} />
              <Input variant="main" type="date" fontSize="xs" px="8px" value={filters.end_date} onChange={(e) => setFilter('end_date', e.target.value)} />
            </Flex>
          </Field>
        </SimpleGrid>
        <Flex justify="end" mt="16px">
          <Button
            variant="light"
            size="sm"
            onClick={() => {
              setFilters(defaultFilters())
              setPage(0)
            }}
          >
            Clear Filters
          </Button>
        </Flex>
      </SectionCard>

      {/* Logs Table */}
      <SectionCard title="Activity Logs" actions={<Text fontSize="sm" color="secondaryGray.600">{total.toLocaleString()} total records</Text>}>
        {isLoading ? (
          <Flex justify="center" py="48px">
            <Spinner size="lg" color="brand.500" />
          </Flex>
        ) : logs.length === 0 ? (
          <EmptyState icon={MdTimeline} title="No activity logs found">
            Try adjusting your filters
          </EmptyState>
        ) : (
          <>
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Time</Th>
                    <Th>User</Th>
                    <Th>Action</Th>
                    <Th>Module</Th>
                    <Th>Description</Th>
                    <Th>Page</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {logs.map((log: any) => (
                    <Tr key={log.id}>
                      <Td whiteSpace="nowrap">{log.created_at ? format(new Date(log.created_at), 'MMM d, HH:mm:ss') : '-'}</Td>
                      <Td>
                        <Text fontWeight="500">{log.user_name}</Text>
                        <Text fontSize="xs" color="secondaryGray.600">
                          {log.user_email}
                        </Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={actionScheme(log.action)}>{log.action}</Badge>
                      </Td>
                      <Td>{log.module || '-'}</Td>
                      <Td maxW="320px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                        {log.description || '-'}
                      </Td>
                      <Td color="secondaryGray.600" maxW="320px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                        {log.page_path || '-'}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
            <Pagination page={page + 1} totalPages={totalPages} total={total} perPage={LIMIT} onChange={(p) => setPage(p - 1)} />
          </>
        )}
      </SectionCard>
    </>
  )
}
