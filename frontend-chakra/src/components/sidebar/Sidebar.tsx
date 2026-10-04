import { useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Collapse,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  Flex,
  Icon,
  Image,
  Text,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import { MdChevronRight, MdHelpOutline, MdLogout, MdPerson, MdAccessTime, MdSettings } from 'react-icons/md'
import { HSeparator } from '@/components/separator/Separator'
import { useAuthStore } from '@/stores/auth'
import { activityLogger } from '@/lib/activityLogger'
import api from '@/lib/api'
import { getNavSections, getRoleDisplayName, getUserRole } from '@/config/nav'

export const SIDEBAR_WIDTH = 290
export const SIDEBAR_COLLAPSED_WIDTH = 88

const tourId = (title: string) => `nav-${title.toLowerCase().replace(/\s+/g, '-')}`

function NavItemLink({
  to,
  title,
  icon,
  active,
  collapsed,
  badge,
  tour,
  onClick,
}: {
  to?: string
  title: string
  icon: IconType
  active: boolean
  collapsed: boolean
  badge?: number
  tour?: string
  onClick?: () => void
}) {
  const activeColor = useColorModeValue('gray.700', 'white')
  const textColor = useColorModeValue('secondaryGray.500', 'white')
  const activeIcon = useColorModeValue('brand.500', 'white')
  const brandColor = useColorModeValue('brand.500', 'brand.400')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')

  const body = (
    <Flex
      align="center"
      py="5px"
      ps={collapsed ? '0' : '10px'}
      justify={collapsed ? 'center' : 'start'}
      borderRadius="12px"
      _hover={{ bg: hoverBg }}
      cursor="pointer"
      data-tour={tour}
      onClick={onClick}
    >
      <Flex align="center" flex="1" justify={collapsed ? 'center' : 'start'} position="relative">
        <Icon as={icon} w="20px" h="20px" color={active ? activeIcon : textColor} me={collapsed ? '0' : '18px'} />
        {!collapsed && (
          <Text me="auto" color={active ? activeColor : textColor} fontWeight={active ? 'bold' : 'normal'} fontSize="md">
            {title}
          </Text>
        )}
        {!!badge && (
          <Badge
            colorScheme="red"
            variant="solid"
            borderRadius="full"
            fontSize="10px"
            position={collapsed ? 'absolute' : 'static'}
            top="-6px"
            right="10px"
            me={collapsed ? '0' : '8px'}
          >
            {badge > 99 ? '99+' : badge}
          </Badge>
        )}
      </Flex>
      {!collapsed && <Box h="36px" w="4px" bg={active ? brandColor : 'transparent'} borderRadius="5px" />}
    </Flex>
  )

  const link = to ? <NavLink to={to}>{body}</NavLink> : body
  return collapsed ? (
    <Tooltip label={title} placement="right" hasArrow>
      <Box>{link}</Box>
    </Tooltip>
  ) : (
    link
  )
}

export function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [openSection, setOpenSection] = useState<string | null>('main')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const sectionColor = useColorModeValue('gray.700', 'white')

  // Fetch unread message count
  const { data: unreadData } = useQuery({
    queryKey: ['unread-messages'],
    queryFn: async () => (await api.get('/messaging/unread-count')).data,
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!user,
  })
  const unreadCount = unreadData?.unread_count || 0

  const sections = getNavSections(user)
  const footerItems = [
    { title: 'My Profile', url: '/profile', icon: MdPerson, tour: 'nav-profile' },
    { title: 'Attendance', url: '/attendance', icon: MdAccessTime },
    ...(getUserRole(user) === 'admin' ? [{ title: 'Settings', url: '/admin/settings', icon: MdSettings }] : []),
    { title: 'Help', url: '/help', icon: MdHelpOutline, tour: 'nav-help' },
  ]

  // Longest nav URL that matches the current path is the active one (so /inventory/products doesn't also light up /inventory)
  const allUrls = [...sections.flatMap((s) => s.items.map((i) => i.url)), ...footerItems.map((i) => i.url)]
  const activeUrl = allUrls
    .filter((url) => location.pathname === url || (url !== '/' && location.pathname.startsWith(url + '/')))
    .sort((a, b) => b.length - a.length)[0]

  const handleLogout = () => {
    setShowLogoutConfirm(false)
    activityLogger.logout()
    logout()
    navigate('/login')
  }

  return (
    <Flex direction="column" h="100%" pt="25px" px={collapsed ? '12px' : '16px'}>
      <Flex
        align="center"
        justify={collapsed ? 'center' : 'start'}
        gap="12px"
        mb="20px"
        cursor="pointer"
        onClick={() => {
          navigate('/')
          onNavigate?.()
        }}
        data-tour="sidebar-logo"
      >
        <Image src="/kountry-sidebarilogo.png" alt="Kountry Eyecare" h="40px" w="40px" borderRadius="8px" />
        {!collapsed && (
          <Box minW="0">
            <Text fontWeight="bold" fontSize="lg" color={textColor} noOfLines={1}>
              Kountry Eyecare
            </Text>
            <Text fontSize="sm" color="secondaryGray.600" noOfLines={1}>
              {getRoleDisplayName(user)}
            </Text>
          </Box>
        )}
      </Flex>
      <HSeparator mb="16px" />

      <Box flex="1" overflowY="auto" overflowX="hidden" className="thin-scrollbar" mx="-4px" px="4px">
        {sections.map((section) =>
          collapsed ? (
            <Box key={section.id} mb="8px">
              {section.items.map((item) => (
                <NavItemLink
                  key={item.url}
                  to={item.url}
                  title={item.title}
                  icon={item.icon}
                  active={activeUrl === item.url}
                  collapsed
                  badge={item.url === '/messages' ? unreadCount : undefined}
                />
              ))}
              <HSeparator mt="8px" />
            </Box>
          ) : (
            <Box key={section.id} mb="4px">
              <Flex
                as="button"
                type="button"
                w="100%"
                align="center"
                ps="10px"
                pe="8px"
                py="10px"
                onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
                data-tour={`section-${section.id}`}
              >
                <Icon as={section.icon} w="18px" h="18px" color="secondaryGray.600" me="14px" />
                <Text flex="1" textAlign="left" fontSize="sm" fontWeight="bold" textTransform="uppercase" letterSpacing="0.5px" color={sectionColor}>
                  {section.title}
                </Text>
                <Icon
                  as={MdChevronRight}
                  color="secondaryGray.600"
                  transform={openSection === section.id ? 'rotate(90deg)' : 'none'}
                  transition="transform 0.2s"
                />
              </Flex>
              <Collapse in={openSection === section.id} animateOpacity>
                <Box ps="8px">
                  {section.items.map((item) => (
                    <NavItemLink
                      key={item.url}
                      to={item.url}
                      title={item.title}
                      icon={item.icon}
                      active={activeUrl === item.url}
                      collapsed={false}
                      tour={tourId(item.title)}
                      badge={item.url === '/messages' ? unreadCount : undefined}
                      onClick={onNavigate}
                    />
                  ))}
                </Box>
              </Collapse>
            </Box>
          ),
        )}
      </Box>

      <HSeparator my="12px" />
      <Box pb="20px">
        {footerItems.map((item) => (
          <NavItemLink
            key={item.url}
            to={item.url}
            title={item.title}
            icon={item.icon}
            active={activeUrl === item.url}
            collapsed={collapsed}
            tour={item.tour}
            onClick={onNavigate}
          />
        ))}
        <NavItemLink title="Logout" icon={MdLogout} active={false} collapsed={collapsed} onClick={() => setShowLogoutConfirm(true)} />
      </Box>

      <AlertDialog isOpen={showLogoutConfirm} leastDestructiveRef={cancelRef} onClose={() => setShowLogoutConfirm(false)} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="20px">
            <AlertDialogHeader>Confirm Logout</AlertDialogHeader>
            <AlertDialogBody color="secondaryGray.600">
              Are you sure you want to logout? You will need to sign in again to access the system.
            </AlertDialogBody>
            <AlertDialogFooter gap="8px">
              <Button ref={cancelRef} variant="light" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleLogout}>
                Yes, Logout
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Flex>
  )
}

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const bg = useColorModeValue('white', 'navy.800')
  const shadow = useColorModeValue('14px 17px 40px 4px rgba(112, 144, 176, 0.08)', 'unset')

  return (
    <Box
      display={{ base: 'none', lg: 'block' }}
      position="fixed"
      top="0"
      left="0"
      h="100vh"
      w={`${collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px`}
      bg={bg}
      boxShadow={shadow}
      transition="width 0.2s linear"
      zIndex="10"
    >
      <SidebarContent collapsed={collapsed} />
    </Box>
  )
}

export function SidebarDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const bg = useColorModeValue('white', 'navy.800')

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="left">
      <DrawerOverlay />
      <DrawerContent w="285px" maxW="285px" bg={bg}>
        <DrawerCloseButton zIndex="3" />
        <DrawerBody px="0" pb="0">
          <SidebarContent collapsed={false} onNavigate={onClose} />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
