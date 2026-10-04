import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
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
  const { pathname } = useLocation()
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
      <Box ms={{ base: 0, lg: `${sidebarWidth}px` }} minH="100vh" px={{ base: '12px', md: '28px' }} pb="40px" transition="margin 0.2s ease">
        <Box maxW="1560px" mx="auto">
          <Navbar onOpenDrawer={drawer.onOpen} onToggleCollapse={toggleCollapse} />
          {/* each page fades up as the route changes */}
          <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            {children}
          </motion.div>
        </Box>
      </Box>
      <DailyGreetingToast />
      <BranchVerificationModal />
    </Box>
  )
}
