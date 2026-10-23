import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, AlertIcon, Badge, Box, Button, Flex, Heading, Icon, IconButton, Input, Select, Spinner, Stack, Text, Wrap } from '@chakra-ui/react'
import { MdBarChart, MdClear, MdDownload, MdErrorOutline, MdFilterList, MdInfoOutline, MdRefresh, MdTerminal, MdWarningAmber } from 'react-icons/md'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import Card from '@/components/card/Card'
import SectionCard from '@/components/card/SectionCard'

interface LogEntry {
  timestamp: string
  level: 'error' | 'warning' | 'info' | 'debug'
  message: string
}

const levelColor: Record<string, string> = { error: 'red.300', warning: 'yellow.300', debug: 'gray.400' }
const levelIcon: Record<string, React.ElementType> = { error: MdErrorOutline, warning: MdWarningAmber }

export default function TerminalPage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const logsEndRef = useRef<HTMLDivElement>(null)

  const [lines, setLines] = useState(100)
  const [filterType, setFilterType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const isAdmin = !!user?.is_superuser

  const { data: logsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['system-logs', lines, filterType],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('lines', lines.toString())
      if (filterType !== 'all') params.append('filter_type', filterType)
      return (await api.get(`/system/logs?${params.toString()}`)).data
    },
    enabled: isAdmin,
    refetchInterval: autoRefresh ? 5000 : false,
  })

  const { data: errorSummary } = useQuery({
    queryKey: ['error-summary'],
    queryFn: async () => (await api.get('/system/logs/errors-summary')).data,
    enabled: isAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Download error logs and clear after download
  const handleDownloadLogs = async () => {
    try {
      const response = await api.get('/system/logs/download', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/plain' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `kountryeye_errors_${new Date().toISOString().slice(0, 10)}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      try {
        await api.post('/system/logs/clear')
        toast({ title: 'Error logs downloaded and cleared successfully' })
        refetch()
        queryClient.invalidateQueries({ queryKey: ['error-summary'] })
      } catch {
        toast({ title: 'Logs downloaded but failed to clear', variant: 'default' })
      }
    } catch {
      toast({ title: 'Failed to download logs', variant: 'destructive' })
    }
  }

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logsData])

  const filteredLogs = (logsData?.logs || []).filter((log: LogEntry) => !searchTerm || log.message.toLowerCase().includes(searchTerm.toLowerCase()))

  if (!isAdmin) {
    return (
      <Flex justify="center" align="center" h="400px">
        <Card w="384px" textAlign="center" alignItems="center">
          <Icon as={MdErrorOutline} w="48px" h="48px" color="red.500" mb="16px" />
          <Heading size="md" mb="8px">
            Access Denied
          </Heading>
          <Text color="secondaryGray.600">Admin access required to view system logs.</Text>
        </Card>
      </Flex>
    )
  }

  return (
    <Stack spacing="16px">
      <Flex justify="space-between" align={{ base: 'start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap="12px">
        <Flex align="center" gap="8px">
          <Icon as={MdTerminal} w="24px" h="24px" />
          <Heading size="lg" data-tour="page-title">
            System Terminal
          </Heading>
          <Badge variant="outline" ms="8px">
            {logsData?.total || 0} entries
          </Badge>
        </Flex>
        <Flex gap="8px" wrap="wrap">
          <Button variant="light" size="sm" leftIcon={<MdDownload />} onClick={handleDownloadLogs}>
            Download Errors
          </Button>
          <Button variant={autoRefresh ? 'brand' : 'light'} size="sm" leftIcon={<MdRefresh />} onClick={() => setAutoRefresh(!autoRefresh)}>
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button variant="light" size="sm" leftIcon={<MdRefresh />} onClick={() => refetch()} isLoading={isRefetching}>
            Refresh
          </Button>
        </Flex>
      </Flex>

      {/* Filters */}
      <Card py="16px">
        <Flex align="center" gap="16px" wrap="wrap">
          <Flex align="center" gap="8px">
            <Icon as={MdFilterList} color="secondaryGray.600" />
            <Text fontSize="sm" fontWeight="500">
              Filters:
            </Text>
          </Flex>
          <Select variant="main" w="128px" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
          </Select>
          <Select variant="main" w="128px" value={lines.toString()} onChange={(e) => setLines(parseInt(e.target.value))}>
            <option value="50">50 lines</option>
            <option value="100">100 lines</option>
            <option value="200">200 lines</option>
            <option value="500">500 lines</option>
          </Select>
          <Input variant="main" w="256px" placeholder="Search logs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          {searchTerm && <IconButton aria-label="Clear search" variant="ghost" size="sm" icon={<MdClear />} onClick={() => setSearchTerm('')} />}
        </Flex>
      </Card>

      {/* Error Summary */}
      {errorSummary?.total_errors > 0 && (
        <SectionCard
          title={
            <Flex align="center" gap="8px" fontSize="sm">
              <Icon as={MdBarChart} />
              Error Summary ({errorSummary.total_errors} errors detected)
            </Flex>
          }
          border="1px solid"
          borderColor="orange.300"
        >
          <Wrap spacing="8px" mb="12px">
            {Object.entries(errorSummary.error_types || {}).map(([type, count]) => (
              <Badge key={type} variant="outline">
                {type.replace('_', ' ')}: {count as number}
              </Badge>
            ))}
          </Wrap>
          {errorSummary.recent_errors?.length > 0 && (
            <Stack spacing="4px" maxH="128px" overflowY="auto">
              <Text fontSize="xs" fontWeight="500" color="secondaryGray.600">
                Recent Errors:
              </Text>
              {errorSummary.recent_errors.slice(0, 5).map((err: { type: string; message: string }, i: number) => (
                <Text key={i} fontSize="xs" p="8px" border="1px solid" borderColor="red.200" borderRadius="8px" noOfLines={1}>
                  <Badge colorScheme="red" me="8px" fontSize="10px">
                    {err.type}
                  </Badge>
                  {err.message.slice(0, 200)}...
                </Text>
              ))}
            </Stack>
          )}
        </SectionCard>
      )}

      {/* Terminal Output */}
      <Box bg="gray.900" color="gray.100" borderRadius="20px" overflow="hidden">
        <Flex align="center" gap="8px" py="8px" px="16px" bg="gray.800" borderBottom="1px solid" borderColor="gray.700" fontFamily="mono" fontSize="sm">
          <Flex gap="6px">
            <Box w="12px" h="12px" borderRadius="full" bg="red.500" />
            <Box w="12px" h="12px" borderRadius="full" bg="yellow.500" />
            <Box w="12px" h="12px" borderRadius="full" bg="green.500" />
          </Flex>
          <Text ms="8px">kountryeye-server — journalctl</Text>
        </Flex>
        <Box h="calc(100vh - 360px)" minH="300px" overflowY="auto" className="thin-scrollbar">
          {isLoading ? (
            <Flex justify="center" align="center" h="100%">
              <Spinner color="gray.500" size="lg" />
            </Flex>
          ) : (
            <Box fontFamily="mono" fontSize="xs" p="16px">
              {filteredLogs.length === 0 ? (
                <Text color="gray.500" textAlign="center" py="32px">
                  No logs found matching your criteria
                </Text>
              ) : (
                filteredLogs.map((log: LogEntry, index: number) => (
                  <Flex key={index} align="start" gap="8px" py="2px" px="8px" mx="-8px" borderRadius="4px" _hover={{ bg: 'gray.800' }} color={levelColor[log.level] || 'green.300'}>
                    <Icon as={levelIcon[log.level] || MdInfoOutline} flexShrink={0} opacity={0.5} mt="2px" />
                    <Text wordBreak="break-all">{log.message}</Text>
                  </Flex>
                ))
              )}
              <div ref={logsEndRef} />
            </Box>
          )}
        </Box>
      </Box>

      {logsData?.errors && (
        <Alert status="error" borderRadius="16px">
          <AlertIcon />
          <Text fontWeight="500" me="8px">
            Error retrieving logs:
          </Text>
          {logsData.errors}
        </Alert>
      )}
    </Stack>
  )
}
