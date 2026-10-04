import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Box, Flex, Heading, Icon, Input, InputGroup, InputLeftElement, InputRightElement, SimpleGrid, Spinner, Stack, Text, Wrap, useColorModeValue } from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import {
  MdAccessTime,
  MdArrowForward,
  MdAssignment,
  MdAttachMoney,
  MdBarChart,
  MdBuild,
  MdBusiness,
  MdCampaign,
  MdCheckCircle,
  MdDescription,
  MdInventory2,
  MdManageAccounts,
  MdOpenInNew,
  MdPeople,
  MdReceipt,
  MdSearch,
  MdSearchOff,
  MdShoppingBag,
  MdAutoAwesome,
  MdVisibility,
} from 'react-icons/md'
import { FaGlasses } from 'react-icons/fa'
import api from '@/lib/api'
import Card from '@/components/card/Card'

interface SearchResult {
  id: number
  title: string
  subtitle: string
  url: string
  meta?: Record<string, any>
}

interface SearchResponse {
  query: string
  total_count: number
  results: Record<string, SearchResult[]>
}

const categoryConfig: Record<string, { label: string; icon: IconType; scheme: string }> = {
  patients: { label: 'Patients', icon: MdPeople, scheme: 'blue' },
  staff: { label: 'Staff', icon: MdManageAccounts, scheme: 'purple' },
  visits: { label: 'Visits', icon: MdAssignment, scheme: 'green' },
  scans: { label: 'Scans', icon: MdVisibility, scheme: 'cyan' },
  referrals: { label: 'Referrals', icon: MdOpenInNew, scheme: 'orange' },
  referral_doctors: { label: 'Referral Doctors', icon: MdManageAccounts, scheme: 'teal' },
  products: { label: 'Products', icon: MdInventory2, scheme: 'yellow' },
  sales: { label: 'Sales & Receipts', icon: MdReceipt, scheme: 'green' },
  assets: { label: 'Assets & Devices', icon: MdBuild, scheme: 'gray' },
  fund_requests: { label: 'Memos & Fund Requests', icon: MdDescription, scheme: 'pink' },
  tasks: { label: 'Tasks', icon: MdCheckCircle, scheme: 'purple' },
  branches: { label: 'Branches', icon: MdBusiness, scheme: 'blue' },
  invoices: { label: 'Invoices', icon: MdAttachMoney, scheme: 'yellow' },
  orders: { label: 'Glasses Orders', icon: FaGlasses, scheme: 'pink' },
  campaigns: { label: 'Campaigns', icon: MdCampaign, scheme: 'purple' },
  expenses: { label: 'Expenses', icon: MdBarChart, scheme: 'red' },
  vendors: { label: 'Vendors', icon: MdShoppingBag, scheme: 'green' },
  revenue: { label: 'Revenue', icon: MdAttachMoney, scheme: 'green' },
}

const SUGGESTIONS = [
  { label: 'Patient name or phone', example: 'Fredrick' },
  { label: 'Receipt number', example: 'RCP-' },
  { label: 'Scan number', example: 'SCN-' },
  { label: 'Staff member', example: 'Ebenezer' },
  { label: 'Asset or device', example: 'OCT machine' },
  { label: 'Fund request', example: 'transport' },
]

const recentSearchesKey = 'kountry_recent_searches'

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(recentSearchesKey) || '[]')
  } catch {
    return []
  }
}

function saveRecentSearch(term: string) {
  const recent = getRecentSearches().filter((s) => s !== term)
  recent.unshift(term)
  localStorage.setItem(recentSearchesKey, JSON.stringify(recent.slice(0, 8)))
}

export default function GlobalSearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') || ''
  const [query, setQuery] = useState(urlQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Follow ?q= changes made from outside this page (e.g. the navbar search box)
  useEffect(() => {
    if (urlQuery !== debouncedQuery.trim()) {
      setQuery(urlQuery)
      setDebouncedQuery(urlQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery])

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(value)
        setSearchParams(value.trim() ? { q: value.trim() } : {})
      }, 350)
    },
    [setSearchParams],
  )

  const { data, isLoading, isFetching } = useQuery<SearchResponse>({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => (await api.get('/search/global', { params: { q: debouncedQuery, limit: 15 } })).data,
    enabled: debouncedQuery.trim().length >= 1,
    staleTime: 30000,
  })

  useEffect(() => {
    if (data && debouncedQuery.trim()) saveRecentSearch(debouncedQuery.trim())
  }, [data, debouncedQuery])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('')
      setDebouncedQuery('')
      setSearchParams({})
    }
  }

  const recentSearches = getRecentSearches()
  const hasResults = !!data && data.total_count > 0
  const hasSearched = debouncedQuery.trim().length >= 1
  const filteredResults = data?.results ? (activeFilter ? { [activeFilter]: data.results[activeFilter] || [] } : data.results) : {}
  const categoryKeys = data?.results ? Object.keys(data.results) : []

  return (
    <Box maxW="896px" mx="auto">
      {/* Search Header */}
      <Card mb="20px">
        <Flex align="center" gap="12px" mb="8px">
          <Icon as={MdAutoAwesome} w="28px" h="28px" color="brand.500" />
          <Heading size="lg" data-tour="page-title">
            Global Search
          </Heading>
        </Flex>
        <Text fontSize="sm" color="secondaryGray.600" mb="16px">
          Search across patients, staff, scans, products, receipts, assets, memos, and more.
        </Text>
        <InputGroup size="lg">
          <InputLeftElement pointerEvents="none" h="56px">
            <Icon as={MdSearch} w="20px" h="20px" color="secondaryGray.600" />
          </InputLeftElement>
          <Input
            ref={inputRef}
            variant="main"
            h="56px"
            fontSize="lg"
            borderWidth="2px"
            placeholder="Search anything... patients, phone numbers, receipts, scans, staff, assets..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {(isLoading || isFetching) && debouncedQuery && (
            <InputRightElement h="56px">
              <Spinner size="sm" color="brand.500" />
            </InputRightElement>
          )}
        </InputGroup>

        {/* Category filter pills */}
        {hasResults && categoryKeys.length > 1 && (
          <Wrap spacing="8px" mt="12px">
            <Badge as="button" px="12px" py="4px" borderRadius="full" variant={activeFilter === null ? 'solid' : 'outline'} colorScheme="brand" onClick={() => setActiveFilter(null)}>
              All ({data.total_count})
            </Badge>
            {categoryKeys.map((key) => {
              const cfg = categoryConfig[key]
              return (
                <Badge
                  key={key}
                  as="button"
                  px="12px"
                  py="4px"
                  borderRadius="full"
                  display="inline-flex"
                  alignItems="center"
                  gap="4px"
                  colorScheme={activeFilter === key ? 'brand' : cfg?.scheme || 'gray'}
                  variant={activeFilter === key ? 'solid' : 'subtle'}
                  onClick={() => setActiveFilter(activeFilter === key ? null : key)}
                >
                  {cfg && <Icon as={cfg.icon} />}
                  {cfg?.label || key} ({data.results[key]?.length || 0})
                </Badge>
              )
            })}
          </Wrap>
        )}
      </Card>

      {/* No query yet - show recent searches & suggestions */}
      {!hasSearched && (
        <Stack spacing="24px">
          {recentSearches.length > 0 && (
            <Box>
              <Flex align="center" gap="8px" fontSize="sm" fontWeight="500" color="secondaryGray.600" mb="12px">
                <Icon as={MdAccessTime} />
                Recent Searches
              </Flex>
              <Wrap spacing="8px">
                {recentSearches.map((term, i) => (
                  <Badge
                    key={i}
                    as="button"
                    variant="outline"
                    px="12px"
                    py="6px"
                    borderRadius="full"
                    fontSize="sm"
                    textTransform="none"
                    display="inline-flex"
                    alignItems="center"
                    gap="6px"
                    _hover={{ bg: hoverBg }}
                    onClick={() => handleQueryChange(term)}
                  >
                    <Icon as={MdSearch} />
                    {term}
                  </Badge>
                ))}
              </Wrap>
            </Box>
          )}

          <Box>
            <Text fontSize="sm" fontWeight="500" color="secondaryGray.600" mb="12px">
              Try searching for
            </Text>
            <SimpleGrid columns={{ base: 2, md: 3 }} spacing="12px">
              {SUGGESTIONS.map((s) => (
                <Card key={s.label} p="12px" cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleQueryChange(s.example)}>
                  <Text fontSize="sm" fontWeight="500">
                    {s.label}
                  </Text>
                  <Text fontSize="xs" color="secondaryGray.600">
                    e.g. "{s.example}"
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          </Box>
        </Stack>
      )}

      {isLoading && hasSearched && (
        <Flex direction="column" align="center" py="80px">
          <Spinner size="xl" color="brand.500" mb="16px" />
          <Text color="secondaryGray.600">Searching across all records...</Text>
        </Flex>
      )}

      {hasSearched && !isLoading && !hasResults && (
        <Flex direction="column" align="center" py="80px" textAlign="center">
          <Icon as={MdSearchOff} w="64px" h="64px" color="secondaryGray.400" mb="16px" />
          <Heading size="md" mb="4px">
            No results found
          </Heading>
          <Text color="secondaryGray.600" fontSize="sm">
            No matches for "
            <Text as="span" fontWeight="500">
              {debouncedQuery}
            </Text>
            ". Try a different search term.
          </Text>
        </Flex>
      )}

      {hasSearched && !isLoading && hasResults && (
        <Stack spacing="24px">
          <Text fontSize="sm" color="secondaryGray.600">
            Found{' '}
            <Text as="span" fontWeight="600" color="inherit">
              {data.total_count}
            </Text>{' '}
            results for "
            <Text as="span" fontWeight="500">
              {data.query}
            </Text>
            "
          </Text>

          {Object.entries(filteredResults).map(([category, items]) => {
            if (!items || items.length === 0) return null
            const cfg = categoryConfig[category] || { label: category, icon: MdSearch, scheme: 'gray' }
            return (
              <Card key={category}>
                <Flex align="center" gap="8px" mb="12px">
                  <Badge colorScheme={cfg.scheme} borderRadius="full" px="10px" py="4px" display="inline-flex" alignItems="center" gap="6px">
                    <Icon as={cfg.icon} />
                    {cfg.label}
                  </Badge>
                  <Text fontSize="xs" color="secondaryGray.600">
                    {items.length} result{items.length !== 1 ? 's' : ''}
                  </Text>
                </Flex>
                <Stack spacing="4px">
                  {items.map((item) => (
                    <Flex
                      key={`${category}-${item.id}`}
                      role="group"
                      align="center"
                      gap="12px"
                      p="12px"
                      borderRadius="12px"
                      cursor="pointer"
                      _hover={{ bg: hoverBg }}
                      onClick={() => navigate(item.url)}
                    >
                      <Flex align="center" justify="center" h="36px" w="36px" borderRadius="10px" flexShrink={0} bg={`${cfg.scheme}.100`} color={`${cfg.scheme}.700`}>
                        <Icon as={cfg.icon} />
                      </Flex>
                      <Box flex="1" minW="0">
                        <Text fontWeight="500" fontSize="sm" noOfLines={1}>
                          {item.title}
                        </Text>
                        <Text fontSize="xs" color="secondaryGray.600" noOfLines={1}>
                          {item.subtitle}
                        </Text>
                      </Box>
                      <Icon as={MdArrowForward} color="secondaryGray.600" opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.15s" flexShrink={0} />
                    </Flex>
                  ))}
                </Stack>
              </Card>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}
