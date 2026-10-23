import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Flex, HStack, Spinner, useColorModeValue } from '@chakra-ui/react'
import { MdDelete, MdDoneAll, MdNotificationsNone } from 'react-icons/md'
import api from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import SectionCard from '@/components/card/SectionCard'
import { EmptyState } from '@/components/ui'
import HistoryItem from '@/components/HistoryItem'
import { formatRelativeTime, notificationIcons, type Notification } from '@/components/navbar/NotificationDropdown'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const unreadBg = useColorModeValue('brand.50', 'whiteAlpha.100')

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
          <Box mx={{ md: '-8px' }}>
            {notifications.map((notification: Notification) => {
              const [icon, color] = notificationIcons[notification.notification_type] || notificationIcons.system
              return (
                <Box key={notification.id} borderRadius="20px" bg={notification.is_read ? undefined : unreadBg} mb="4px">
                  <HistoryItem
                    icon={icon}
                    tileColor={color}
                    name={
                      <Flex as="span" align="center" gap="8px">
                        {notification.title}
                        {!notification.is_read && <Box as="span" w="8px" h="8px" borderRadius="full" bg="brand.500" flexShrink={0} />}
                      </Flex>
                    }
                    sub={notification.message}
                    end={formatRelativeTime(notification.created_at)}
                    onClick={() => handleNotificationClick(notification)}
                  />
                </Box>
              )
            })}
          </Box>
        )}
      </SectionCard>
    </>
  )
}
