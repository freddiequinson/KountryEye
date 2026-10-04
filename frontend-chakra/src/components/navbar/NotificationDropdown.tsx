import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Flex,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  Text,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import {
  MdAttachMoney,
  MdCheck,
  MdDescription,
  MdDoneAll,
  MdErrorOutline,
  MdMessage,
  MdNotificationsNone,
} from 'react-icons/md'
import api from '@/lib/api'

export interface Notification {
  id: number
  title: string
  message: string | null
  notification_type: string
  reference_type: string | null
  reference_id: number | null
  action_url: string | null
  is_read: boolean
  created_at: string
}

export const notificationIcons: Record<string, [IconType, string]> = {
  fund_request: [MdDescription, 'blue.500'],
  fund_approved: [MdAttachMoney, 'green.500'],
  fund_rejected: [MdErrorOutline, 'red.500'],
  fund_disbursed: [MdAttachMoney, 'purple.500'],
  fund_received: [MdCheck, 'green.500'],
  message: [MdMessage, 'blue.500'],
  system: [MdNotificationsNone, 'gray.500'],
}

export const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function NotificationDropdown() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const navbarIcon = useColorModeValue('gray.400', 'white')
  const menuBg = useColorModeValue('white', 'navy.800')
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const unreadBg = useColorModeValue('brand.50', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.200')
  const shadow = useColorModeValue('14px 17px 40px 4px rgba(112, 144, 176, 0.18)', '14px 17px 40px 4px rgba(112, 144, 176, 0.06)')

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications?limit=20')).data,
    refetchInterval: 30000, // Poll every 30 seconds
  })

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: async () => (await api.get('/notifications/count')).data,
    refetchInterval: 15000, // Poll every 15 seconds
    staleTime: 0, // Always fetch fresh data
  })
  const unreadCount = countData?.unread_count || 0

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'], refetchType: 'all' })
    queryClient.invalidateQueries({ queryKey: ['notifications-count'], refetchType: 'all' })
  }

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: number) => api.post(`/notifications/${notificationId}/read`),
    onSuccess: invalidate,
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: invalidate,
  })

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) markAsReadMutation.mutate(notification.id)
    if (notification.action_url) {
      onClose()
      navigate(notification.action_url)
    }
  }

  return (
    <Menu isOpen={isOpen} onOpen={onOpen} onClose={onClose} placement="bottom-end">
      <Box position="relative">
        <MenuButton
          as={IconButton}
          aria-label="Notifications"
          variant="ghost"
          size="sm"
          borderRadius="full"
          icon={<Icon as={MdNotificationsNone} color={navbarIcon} w="20px" h="20px" />}
        />
        {unreadCount > 0 && (
          <Badge
            colorScheme="red"
            variant="solid"
            borderRadius="full"
            fontSize="10px"
            position="absolute"
            top="-2px"
            right="-4px"
            pointerEvents="none"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Box>
      <MenuList boxShadow={shadow} p="16px" borderRadius="20px" bg={menuBg} border="none" mt="16px" w={{ base: '90vw', md: '380px' }} maxW="380px">
        <Flex justify="space-between" align="center" mb="12px">
          <Text fontSize="md" fontWeight="600" color={textColor}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <Button size="xs" variant="ghost" leftIcon={<MdDoneAll />} onClick={() => markAllAsReadMutation.mutate()}>
              Mark all read
            </Button>
          )}
        </Flex>

        <Box maxH="320px" overflowY="auto" className="thin-scrollbar">
          {notifications.length === 0 ? (
            <Flex direction="column" align="center" py="32px" color="secondaryGray.600">
              <Icon as={MdNotificationsNone} w="48px" h="48px" opacity={0.5} mb="12px" />
              <Text>No notifications</Text>
            </Flex>
          ) : (
            notifications.map((notification) => {
              const [icon, color] = notificationIcons[notification.notification_type] || notificationIcons.system
              return (
                <Flex
                  key={notification.id}
                  gap="12px"
                  p="10px"
                  borderRadius="12px"
                  cursor="pointer"
                  bg={notification.is_read ? 'transparent' : unreadBg}
                  _hover={{ bg: hoverBg }}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <Icon as={icon} color={color} mt="3px" />
                  <Box flex="1" minW="0">
                    <Flex justify="space-between" align="center">
                      <Text fontSize="sm" color={textColor} fontWeight={notification.is_read ? 'normal' : '600'}>
                        {notification.title}
                      </Text>
                      {!notification.is_read && <Box h="8px" w="8px" borderRadius="full" bg="brand.500" flexShrink={0} />}
                    </Flex>
                    {notification.message && (
                      <Text fontSize="xs" color="secondaryGray.600" noOfLines={1}>
                        {notification.message}
                      </Text>
                    )}
                    <Text fontSize="xs" color="secondaryGray.600" mt="2px">
                      {formatRelativeTime(notification.created_at)}
                    </Text>
                  </Box>
                </Flex>
              )
            })
          )}
        </Box>

        {notifications.length > 0 && (
          <Button
            mt="12px"
            w="100%"
            size="sm"
            variant="light"
            onClick={() => {
              onClose()
              navigate('/notifications')
            }}
          >
            View all notifications
          </Button>
        )}
      </MenuList>
    </Menu>
  )
}
