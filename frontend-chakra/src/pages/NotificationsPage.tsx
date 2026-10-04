import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Flex, HStack, Icon, Spinner, Stack, Text, useColorModeValue } from '@chakra-ui/react'
import { MdDelete, MdDoneAll, MdNotificationsNone } from 'react-icons/md'
import api from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import SectionCard from '@/components/card/SectionCard'
import { EmptyState } from '@/components/ui'
import { formatRelativeTime, notificationIcons, type Notification } from '@/components/navbar/NotificationDropdown'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const unreadBg = useColorModeValue('brand.50', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.100', 'whiteAlpha.50')
  const dividerColor = useColorModeValue('gray.100', 'whiteAlpha.100')

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: async () => (await api.get('/notifications?limit=100')).data,
  })

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

  const clearAllMutation = useMutation({
    mutationFn: () => api.delete('/notifications/clear-all'),
    onSuccess: invalidate,
  })

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) markAsReadMutation.mutate(notification.id)
    if (notification.action_url) navigate(notification.action_url)
  }

  const unreadCount = notifications.filter((n: Notification) => !n.is_read).length

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <HStack spacing="8px">
            {unreadCount > 0 && (
              <Button variant="light" size="sm" leftIcon={<MdDoneAll />} onClick={() => markAllAsReadMutation.mutate()} isLoading={markAllAsReadMutation.isPending}>
                Mark all as read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="light" size="sm" leftIcon={<MdDelete />} onClick={() => clearAllMutation.mutate()} isLoading={clearAllMutation.isPending}>
                Clear all
              </Button>
            )}
          </HStack>
        }
      />

      <SectionCard title={`All Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}>
        {isLoading ? (
          <Flex justify="center" py="32px">
            <Spinner color="brand.500" />
          </Flex>
        ) : notifications.length === 0 ? (
          <EmptyState icon={MdNotificationsNone}>No notifications</EmptyState>
        ) : (
          <Stack spacing="0" divider={<Box borderBottom="1px solid" borderColor={dividerColor} />}>
            {notifications.map((notification: Notification) => {
              const [icon, color] = notificationIcons[notification.notification_type] || notificationIcons.system
              return (
                <Flex
                  key={notification.id}
                  gap="16px"
                  align="start"
                  p="16px"
                  borderRadius="12px"
                  cursor="pointer"
                  bg={notification.is_read ? undefined : unreadBg}
                  _hover={{ bg: hoverBg }}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <Icon as={icon} color={color} w="20px" h="20px" mt="2px" />
                  <Box flex="1" minW="0">
                    <Flex justify="space-between" align="center" gap="8px">
                      <Text fontSize="sm" fontWeight={notification.is_read ? 'normal' : '700'}>
                        {notification.title}
                      </Text>
                      <HStack spacing="8px" flexShrink={0}>
                        {!notification.is_read && <Box w="8px" h="8px" borderRadius="full" bg="brand.500" />}
                        <Text fontSize="xs" color="secondaryGray.600">
                          {formatRelativeTime(notification.created_at)}
                        </Text>
                      </HStack>
                    </Flex>
                    {notification.message && (
                      <Text fontSize="sm" color="secondaryGray.600" mt="4px">
                        {notification.message}
                      </Text>
                    )}
                  </Box>
                </Flex>
              )
            })}
          </Stack>
        )}
      </SectionCard>
    </>
  )
}
