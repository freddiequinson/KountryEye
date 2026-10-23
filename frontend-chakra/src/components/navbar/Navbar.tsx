import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Flex,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
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
import { MdAccessTime, MdBusiness, MdExpandMore, MdHelpOutline, MdLogout, MdMenuOpen, MdPerson, MdSearch, MdSettings } from 'react-icons/md'
import NotificationDropdown from '@/components/navbar/NotificationDropdown'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { getPageTitle, getRoleDisplayName, getUserRole, hasPermission } from '@/config/nav'
import { activityLogger } from '@/lib/activityLogger'
import { ConfirmDialog } from '@/components/ui'

function BranchSwitcher() {
  const { user, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const { toast } = useToast()
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
    <Tag size="lg" h="38px" borderRadius="10px" colorScheme="brand" variant="subtle" cursor={userBranches.length > 1 ? 'pointer' : 'default'}>
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
      <MenuList>
        {userBranches.map((branch) => (
          <MenuItem
            key={branch.id}
            icon={<MdBusiness />}
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
  const { user, logout } = useAuthStore()
  const { colorMode, toggleColorMode } = useColorMode()
  const [search, setSearch] = useState('')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const mainText = useColorModeValue('secondaryGray.900', 'white')
  const navbarBg = useColorModeValue('rgba(255, 255, 255, 0.82)', 'rgba(17, 28, 68, 0.82)')
  const border = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const iconColor = useColorModeValue('secondaryGray.700', 'white')
  const searchBg = useColorModeValue('secondaryGray.300', 'navy.900')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')

  const pageTitle = getPageTitle(location.pathname)
  const canSearch = hasPermission(user, ['analytics.view'])
  const fullName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim()
  const isAdmin = getUserRole(user) === 'admin'

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) navigate(`/admin/search?q=${encodeURIComponent(search.trim())}`)
  }

  const handleLogout = () => {
    setShowLogoutConfirm(false)
    activityLogger.logout()
    logout()
    navigate('/login')
  }

  const menuLinks = [
    { label: 'My Profile', icon: MdPerson, to: '/profile' },
    { label: 'Attendance', icon: MdAccessTime, to: '/attendance' },
    ...(isAdmin ? [{ label: 'Settings', icon: MdSettings, to: '/admin/settings' }] : []),
    { label: 'Help', icon: MdHelpOutline, to: '/help' },
  ]

  return (
    <Box
      position="sticky"
      top={{ base: '8px', md: '14px' }}
      zIndex="5"
      bg={navbarBg}
      backdropFilter="saturate(180%) blur(16px)"
      border="1px solid"
      borderColor={border}
      borderRadius="16px"
      boxShadow="card"
      px="10px"
      h="64px"
      mb="24px"
    >
      <Flex h="100%" align="center" gap="8px">
        <IconButton
          aria-label="Open menu"
          display={{ base: 'inline-flex', lg: 'none' }}
          variant="ghost"
          icon={<Icon as={IoMenuOutline} w="22px" h="22px" color={iconColor} />}
          onClick={onOpenDrawer}
        />
        <IconButton
          aria-label="Collapse sidebar"
          display={{ base: 'none', lg: 'inline-flex' }}
          variant="ghost"
          icon={<Icon as={MdMenuOpen} w="22px" h="22px" color={iconColor} />}
          onClick={onToggleCollapse}
        />
        <Flex align="center" gap="8px" minW="0" fontSize="sm" fontWeight="500" display={{ base: 'none', sm: 'flex' }}>
          <Text color="secondaryGray.500" display={{ base: 'none', md: 'block' }}>
            Kountry Eyecare
          </Text>
          <Text color="secondaryGray.400" display={{ base: 'none', md: 'block' }}>
            /
          </Text>
          <Text color={mainText} fontWeight="700" noOfLines={1}>
            {pageTitle}
          </Text>
        </Flex>

        <Flex ms="auto" align="center" gap="6px" minW="0">
          {canSearch && (
            <Box as="form" onSubmit={handleSearch} display={{ base: 'none', md: 'block' }}>
              <InputGroup w={{ md: '200px', xl: '260px' }}>
                <InputLeftElement pointerEvents="none" h="38px">
                  <Icon as={MdSearch} color="secondaryGray.500" />
                </InputLeftElement>
                <Input
                  variant="search"
                  h="38px"
                  fontSize="sm"
                  fontWeight="500"
                  bg={searchBg}
                  borderRadius="10px"
                  placeholder="Search patients, sales..."
                  _placeholder={{ color: 'secondaryGray.500' }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
            </Box>
          )}
          <Box display={{ base: 'none', sm: 'block' }}>
            <BranchSwitcher />
          </Box>
          <NotificationDropdown />
          <IconButton
            aria-label="Toggle dark mode"
            variant="ghost"
            icon={<Icon as={colorMode === 'light' ? IoMdMoon : IoMdSunny} color={iconColor} w="18px" h="18px" />}
            onClick={toggleColorMode}
          />

          <Menu placement="bottom-end">
            <MenuButton borderRadius="12px" p="4px" pe={{ md: '8px' }} _hover={{ bg: hoverBg }} _expanded={{ bg: hoverBg }} transition="background .15s ease" data-tour="nav-profile">
              <Flex align="center" gap="10px">
                <Avatar w="36px" h="36px" size="sm" name={fullName || 'User'} src={user?.avatar_url} bg="brand.600" color="white" borderRadius="10px" />
                <Box textAlign="left" display={{ base: 'none', md: 'block' }} maxW="140px">
                  <Text fontSize="13px" fontWeight="700" color={mainText} lineHeight="1.2" noOfLines={1}>
                    {fullName || 'User'}
                  </Text>
                  <Text fontSize="11px" fontWeight="500" color="secondaryGray.600" lineHeight="1.3" noOfLines={1}>
                    {getRoleDisplayName(user)}
                  </Text>
                </Box>
                <Icon as={MdExpandMore} color="secondaryGray.500" display={{ base: 'none', md: 'block' }} />
              </Flex>
            </MenuButton>
            <MenuList minW="240px" zIndex="20">
              <Flex align="center" gap="12px" px="10px" py="10px" mb="4px" borderBottom="1px solid" borderColor={border}>
                <Avatar w="40px" h="40px" name={fullName || 'User'} src={user?.avatar_url} bg="brand.600" color="white" borderRadius="12px" />
                <Box minW="0">
                  <Text fontSize="sm" fontWeight="700" color={mainText} noOfLines={1}>
                    {fullName || 'User'}
                  </Text>
                  <Text fontSize="xs" color="secondaryGray.600" noOfLines={1}>
                    {user?.email}
                  </Text>
                </Box>
              </Flex>
              {menuLinks.map((item) => (
                <MenuItem key={item.to} icon={<Icon as={item.icon} w="18px" h="18px" color="secondaryGray.600" />} onClick={() => navigate(item.to)}>
                  {item.label}
                </MenuItem>
              ))}
              <Box h="1px" bg={border} my="4px" />
              <MenuItem color="red.500" icon={<Icon as={MdLogout} w="18px" h="18px" />} onClick={() => setShowLogoutConfirm(true)}>
                Logout
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      </Flex>

      <ConfirmDialog isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} onConfirm={handleLogout} title="Confirm Logout" confirmLabel="Yes, Logout">
        Are you sure you want to logout? You will need to sign in again to access the system.
      </ConfirmDialog>
    </Box>
  )
}
