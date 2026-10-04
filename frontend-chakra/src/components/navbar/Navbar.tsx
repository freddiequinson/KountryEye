import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  Flex,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Tag,
  TagLabel,
  TagLeftIcon,
  Text,
  useColorMode,
  useColorModeValue,
} from '@chakra-ui/react'
import { IoMdMoon, IoMdSunny } from 'react-icons/io'
import { IoMenuOutline } from 'react-icons/io5'
import { MdBusiness, MdExpandMore, MdMenuOpen, MdSearch } from 'react-icons/md'
import NotificationDropdown from '@/components/navbar/NotificationDropdown'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { getPageTitle, getRoleDisplayName, hasPermission } from '@/config/nav'

function BranchSwitcher() {
  const { user, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const menuBg = useColorModeValue('white', 'navy.800')

  // Fetch user's accessible branches
  const { data: userBranches = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['user-branches'],
    queryFn: async () => (await api.get('/users/me/branches')).data,
    enabled: !!user,
  })

  const switchBranchMutation = useMutation({
    mutationFn: (branchId: number) => api.post(`/users/me/switch-branch/${branchId}`),
    onSuccess: (response) => {
      setUser(response.data.user)
      queryClient.invalidateQueries()
      toast({ title: 'Branch switched successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to switch branch', variant: 'destructive' })
    },
  })

  if (!user?.branch) return null
  const branchName = typeof user.branch === 'string' ? user.branch : user.branch.name
  const branchId = typeof user.branch === 'object' ? user.branch.id : null

  const tag = (
    <Tag size="lg" borderRadius="full" colorScheme="brand" variant="subtle" cursor={userBranches.length > 1 ? 'pointer' : 'default'}>
      <TagLeftIcon as={MdBusiness} />
      <TagLabel fontSize="xs" fontWeight="600" maxW="140px">
        {branchName}
      </TagLabel>
      {userBranches.length > 1 && <Icon as={MdExpandMore} ms="4px" />}
    </Tag>
  )

  if (userBranches.length <= 1) return <Box me="10px">{tag}</Box>

  return (
    <Menu placement="bottom-end">
      <MenuButton me="10px">{tag}</MenuButton>
      <MenuList bg={menuBg} border="none" borderRadius="16px" boxShadow="lg" p="8px">
        {userBranches.map((branch) => (
          <MenuItem
            key={branch.id}
            icon={<MdBusiness />}
            borderRadius="10px"
            fontWeight={branch.id === branchId ? 'bold' : 'normal'}
            color={branch.id === branchId ? 'brand.500' : undefined}
            onClick={() => switchBranchMutation.mutate(branch.id)}
          >
            {branch.name}
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  )
}

export default function Navbar({ onOpenDrawer, onToggleCollapse }: { onOpenDrawer: () => void; onToggleCollapse: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { colorMode, toggleColorMode } = useColorMode()
  const [search, setSearch] = useState('')

  const mainText = useColorModeValue('navy.700', 'white')
  const secondaryText = useColorModeValue('gray.700', 'white')
  const navbarBg = useColorModeValue('rgba(244, 247, 254, 0.2)', 'rgba(11,20,55,0.5)')
  const menuBg = useColorModeValue('white', 'navy.800')
  const navbarIcon = useColorModeValue('gray.400', 'white')
  const searchBg = useColorModeValue('secondaryGray.300', 'navy.900')
  const shadow = useColorModeValue('14px 17px 40px 4px rgba(112, 144, 176, 0.18)', '14px 17px 40px 4px rgba(112, 144, 176, 0.06)')

  const pageTitle = getPageTitle(location.pathname)
  const canSearch = hasPermission(user, ['analytics.view'])
  const fullName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) navigate(`/admin/search?q=${encodeURIComponent(search.trim())}`)
  }

  return (
    <Box
      position="sticky"
      top={{ base: '12px', md: '16px', xl: '20px' }}
      zIndex="5"
      bg={navbarBg}
      backdropFilter="blur(20px)"
      borderRadius="16px"
      px={{ base: '12px', md: '10px' }}
      ps={{ xl: '12px' }}
      py="8px"
      minH="75px"
      mb="20px"
    >
      <Flex w="100%" direction={{ base: 'column', md: 'row' }} align={{ md: 'center' }} gap={{ base: '8px', md: '0' }}>
        <Flex align="center" minW="0">
          <IconButton
            aria-label="Open menu"
            display={{ base: 'inline-flex', lg: 'none' }}
            variant="ghost"
            me="8px"
            icon={<Icon as={IoMenuOutline} w="24px" h="24px" color={navbarIcon} />}
            onClick={onOpenDrawer}
          />
          <IconButton
            aria-label="Collapse sidebar"
            display={{ base: 'none', lg: 'inline-flex' }}
            variant="ghost"
            me="8px"
            icon={<Icon as={MdMenuOpen} w="24px" h="24px" color={navbarIcon} />}
            onClick={onToggleCollapse}
          />
          <Box minW="0">
            <Breadcrumb fontSize="sm" color={secondaryText} mb="2px">
              <BreadcrumbItem>
                <Text>Pages</Text>
              </BreadcrumbItem>
              <BreadcrumbItem isCurrentPage>
                <Text>{pageTitle}</Text>
              </BreadcrumbItem>
            </Breadcrumb>
            <Text color={mainText} fontWeight="bold" fontSize={{ base: '24px', md: '30px' }} lineHeight="1.2" noOfLines={1}>
              {pageTitle}
            </Text>
          </Box>
        </Flex>

        <Flex ms="auto" w={{ base: '100%', md: 'auto' }} align="center" bg={menuBg} p="10px" borderRadius="30px" boxShadow={shadow}>
          {canSearch && (
            <form onSubmit={handleSearch} style={{ flex: 1 }}>
              <InputGroup w={{ base: '100%', md: '200px' }} me="10px">
                <InputLeftElement pointerEvents="none">
                  <Icon as={MdSearch} color="gray.400" />
                </InputLeftElement>
                <Input
                  variant="search"
                  fontSize="sm"
                  bg={searchBg}
                  fontWeight="500"
                  borderRadius="30px"
                  placeholder="Search..."
                  _placeholder={{ color: 'gray.400', fontSize: '14px' }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
            </form>
          )}
          <Box ms={canSearch ? '10px' : 'auto'} display="flex" alignItems="center">
            <BranchSwitcher />
            <NotificationDropdown />
            <IconButton
              aria-label="Toggle dark mode"
              variant="ghost"
              size="sm"
              borderRadius="full"
              me="10px"
              icon={<Icon as={colorMode === 'light' ? IoMdMoon : IoMdSunny} color={navbarIcon} w="18px" h="18px" />}
              onClick={toggleColorMode}
            />
            <Menu placement="bottom-end">
              <MenuButton>
                <Avatar size="sm" w="40px" h="40px" name={fullName || 'User'} src={user?.avatar_url} bg="brand.500" color="white" />
              </MenuButton>
              <MenuList boxShadow={shadow} p="0px" mt="10px" borderRadius="20px" bg={menuBg} border="none">
                <Box px="14px" pt="16px" pb="10px">
                  <Text fontSize="sm" fontWeight="700" color={mainText}>
                    👋&nbsp; Hey, {user?.first_name}
                  </Text>
                  <Text fontSize="xs" color="secondaryGray.600">
                    {getRoleDisplayName(user)}
                  </Text>
                </Box>
                <MenuDivider />
                <Box p="8px">
                  <MenuItem borderRadius="8px" onClick={() => navigate('/profile')}>
                    My Profile
                  </MenuItem>
                  <MenuItem borderRadius="8px" onClick={() => navigate('/attendance')}>
                    Attendance
                  </MenuItem>
                  <MenuItem borderRadius="8px" onClick={() => navigate('/help')}>
                    Help
                  </MenuItem>
                </Box>
              </MenuList>
            </Menu>
          </Box>
        </Flex>
      </Flex>
    </Box>
  )
}
