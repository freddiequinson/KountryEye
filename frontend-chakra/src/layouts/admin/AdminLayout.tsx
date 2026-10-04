import { useState, type ReactNode } from 'react'
import { Box, useDisclosure } from '@chakra-ui/react'
import Sidebar, { SidebarDrawer, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from '@/components/sidebar/Sidebar'
import Navbar from '@/components/navbar/Navbar'
import { DailyGreetingToast } from '@/components/DailyGreetingToast'
import BranchVerificationModal from '@/components/BranchVerificationModal'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

const COLLAPSE_KEY = 'kountry-sidebar-collapsed'

export default function AdminLayout({ children }: { children: ReactNode }) {
  useKeyboardShortcuts()
  const drawer = useDisclosure()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === 'true')

  const toggleCollapse = () => {
    localStorage.setItem(COLLAPSE_KEY, String(!collapsed))
    setCollapsed(!collapsed)
  }

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH

  return (
    <Box>
      <Sidebar collapsed={collapsed} />
      <SidebarDrawer isOpen={drawer.isOpen} onClose={drawer.onClose} />
      <Box
        ms={{ base: 0, lg: `${sidebarWidth}px` }}
        minH="100vh"
        px={{ base: '12px', md: '30px' }}
        pb="30px"
        transition="margin 0.2s linear"
      >
        <Navbar onOpenDrawer={drawer.onOpen} onToggleCollapse={toggleCollapse} />
        {children}
      </Box>
      <DailyGreetingToast />
      <BranchVerificationModal />
    </Box>
  )
}
