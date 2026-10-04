import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Badge, Box, Button, Collapse, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerOverlay, Flex, Icon, Image, Text, Tooltip, useColorModeValue } from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import { MdExpandMore, MdHelpOutline } from 'react-icons/md'
import { useAuthStore } from '@/stores/auth'
import api from '@/lib/api'
import { getNavSections, getRoleDisplayName } from '@/config/nav'

export const SIDEBAR_WIDTH = 272
export const SIDEBAR_COLLAPSED_WIDTH = 84

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
  to: string
  title: string
  icon: IconType
  active: boolean
  collapsed: boolean
  badge?: number
  tour?: string
  onClick?: () => void
}) {
  const activeColor = useColorModeValue('brand.700', 'white')
  const textColor = useColorModeValue('secondaryGray.700', 'secondaryGray.500')
  const activeBg = useColorModeValue('brand.50', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.50')

  const link = (
    <NavLink to={to} onClick={onClick}>
      <Flex
        position="relative"
        align="center"
        h="44px"
        px={collapsed ? '0' : '12px'}
        mb="2px"
        justify={collapsed ? 'center' : 'start'}
        borderRadius="10px"
        color={active ? activeColor : textColor}
        bg={active ? activeBg : 'transparent'}
        _hover={{ bg: active ? activeBg : hoverBg, color: activeColor }}
        transition="background .15s ease, color .15s ease"
        data-tour={tour}
        role="group"
      >
        {/* the brand bar slides between items when the route changes */}
        {active && (
          <Box as={motion.div} layoutId={collapsed ? 'nav-bar-collapsed' : 'nav-bar'} position="absolute" left="-12px" top="8px" bottom="8px" w="4px" borderRightRadius="4px" bg="brand.500" />
        )}
        <Icon as={icon} w="20px" h="20px" me={collapsed ? '0' : '12px'} flexShrink={0} transition="transform .2s ease" _groupHover={{ transform: 'scale(1.15) rotate(-6deg)' }} />
        {!collapsed && (
          <Text flex="1" fontSize="15px" fontWeight={active ? '700' : '500'} noOfLines={1}>
            {title}
          </Text>
        )}
        {!!badge && (
          <Badge
            bg="red.500"
            color="white"
            px="6px"
            py="3px"
            fontSize="10px"
            position={collapsed ? 'absolute' : 'static'}
            top="2px"
            right="8px"
          >
            {badge > 99 ? '99+' : badge}
          </Badge>
        )}
      </Flex>
    </NavLink>
  )

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
  const { user } = useAuthStore()
  // sections the user opened or closed by hand; anything else is open only if it holds the current page
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const divider = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')

  // Fetch unread message count
  const { data: unreadData } = useQuery({
    queryKey: ['unread-messages'],
    queryFn: async () => (await api.get('/messaging/unread-count')).data,
    refetchInterval: 30000,
    enabled: !!user,
  })
  const unreadCount = unreadData?.unread_count || 0

  const sections = getNavSections(user)

  // Longest nav URL that matches the current path is the active one (so /inventory/products doesn't also light up /inventory)
  const activeUrl = sections
    .flatMap((s) => s.items.map((i) => i.url))
    .filter((url) => location.pathname === url || (url !== '/' && location.pathname.startsWith(url + '/')))
    .sort((a, b) => b.length - a.length)[0]

  // default: only the section holding the current page is open (the first one when the page isn't in the menu)
  const homeSection = sections.find((sec) => sec.items.some((i) => i.url === activeUrl)) || sections[0]
  const isSectionOpen = (section: (typeof sections)[number]) => toggled[section.id] ?? section.id === homeSection?.id

  return (
    <Flex direction="column" h="100%">
      <Flex
        align="center"
        justify={collapsed ? 'center' : 'start'}
        gap="12px"
        h="76px"
        px={collapsed ? '0' : '20px'}
        borderBottom="1px solid"
        borderColor={divider}
        cursor="pointer"
        flexShrink={0}
        onClick={() => {
          navigate('/')
          onNavigate?.()
        }}
        data-tour="sidebar-logo"
      >
        <Image src="/kountry-sidebarilogo.png" alt="Kountry Eyecare" h="40px" w="40px" borderRadius="10px" />
        {!collapsed && (
          <Box minW="0">
            <Text fontWeight="800" fontSize="16px" letterSpacing="-0.02em" color={textColor} noOfLines={1}>
              Kountry Eyecare
            </Text>
            <Text fontSize="12px" fontWeight="500" color="secondaryGray.600" noOfLines={1}>
              {getRoleDisplayName(user)}
            </Text>
          </Box>
        )}
      </Flex>

      <Box flex="1" overflowY="auto" overflowX="hidden" className="thin-scrollbar" px="12px" py="14px">
        {sections.map((section, index) => {
          const isOpen = isSectionOpen(section)
          return (
            <Box key={section.id} mb="10px">
              {collapsed ? (
                index > 0 && <Box h="1px" bg={divider} mx="8px" mb="10px" />
              ) : (
                <Flex
                  as="button"
                  type="button"
                  w="100%"
                  align="center"
                  px="12px"
                  py="6px"
                  mb="2px"
                  color="secondaryGray.500"
                  _hover={{ color: 'secondaryGray.700' }}
                  onClick={() => setToggled((prev) => ({ ...prev, [section.id]: !isOpen }))}
                  data-tour={`section-${section.id}`}
                >
                  <Text flex="1" textAlign="left" fontSize="11px" fontWeight="700" textTransform="uppercase" letterSpacing="0.1em">
                    {section.title}
                  </Text>
                  <Icon as={MdExpandMore} transform={isOpen ? 'none' : 'rotate(-90deg)'} transition="transform 0.2s" />
                </Flex>
              )}
              <Collapse in={collapsed || isOpen} animateOpacity style={{ overflow: 'visible' }}>
                {section.items.map((item) => (
                  <NavItemLink
                    key={item.url}
                    to={item.url}
                    title={item.title}
                    icon={item.icon}
                    active={activeUrl === item.url}
                    collapsed={collapsed}
                    tour={collapsed ? undefined : tourId(item.title)}
                    badge={item.url === '/messages' ? unreadCount : undefined}
                    onClick={onNavigate}
                  />
                ))}
              </Collapse>
            </Box>
          )
        })}
      </Box>

      {/* Help card (profile, attendance, settings and logout live in the navbar profile menu) */}
      {!collapsed && (
        <Box p="12px" flexShrink={0}>
          <Box position="relative" overflow="hidden" borderRadius="16px" p="16px" color="white" bg="linear-gradient(135deg, #14472A 0%, #3E8141 100%)" data-tour="nav-help">
            <Box position="absolute" top="-30px" right="-30px" w="110px" h="110px" borderRadius="full" bg="whiteAlpha.200" />
            <Box position="absolute" bottom="-40px" right="20px" w="80px" h="80px" borderRadius="full" bg="rgba(12,192,223,0.25)" filter="blur(12px)" />
            <Text position="relative" fontWeight="700" fontSize="14px">
              Need a hand?
            </Text>
            <Text position="relative" fontSize="12px" color="whiteAlpha.800" mt="2px" mb="12px">
              Guides, shortcuts and page tutorials.
            </Text>
            <Button
              position="relative"
              size="sm"
              bg="white"
              color="brand.700"
              _hover={{ bg: 'whiteAlpha.900' }}
              leftIcon={<MdHelpOutline />}
              onClick={() => {
                navigate('/help')
                onNavigate?.()
              }}
            >
              Help centre
            </Button>
          </Box>
        </Box>
      )}
    </Flex>
  )
}

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const bg = useColorModeValue('white', 'navy.800')
  const border = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')

  return (
    <Box
      display={{ base: 'none', lg: 'block' }}
      position="fixed"
      top="0"
      left="0"
      h="100vh"
      w={`${collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px`}
      bg={bg}
      borderRight="1px solid"
      borderColor={border}
      transition="width 0.2s ease"
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
        <DrawerCloseButton zIndex="3" top="22px" />
        <DrawerBody p="0">
          <SidebarContent collapsed={false} onNavigate={onClose} />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
