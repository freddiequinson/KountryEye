import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  AvatarBadge,
  Badge,
  Box,
  Button,
  Center,
  Code,
  Flex,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import {
  MdAdd,
  MdAlternateEmail,
  MdArrowBack,
  MdCheck,
  MdClose,
  MdDelete,
  MdDescription,
  MdDoneAll,
  MdEdit,
  MdForum,
  MdGroups,
  MdInventory2,
  MdPeople,
  MdPerson,
  MdReply,
  MdSend,
  MdVisibility,
} from 'react-icons/md'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/use-toast'
import { getUserRole } from '@/config/nav'
import Card from '@/components/card/Card'
import GifPicker from '@/components/GifPicker'
import { AppModal, ConfirmDialog, EmptyState, Field, SearchInput } from '@/components/ui'

interface Conversation {
  id: number
  is_group: boolean
  name: string
  other_user_id: number | null
  other_user_online: boolean
  other_user_typing: boolean
  last_message: { content: string; sender_id: number; created_at: string } | null
  unread_count: number
  updated_at: string
  participants?: Array<{ id: number; name: string; role?: string }>
}

interface ReplyInfo {
  id: number
  sender_name: string
  content: string
}

interface Message {
  id: number
  conversation_id: number
  sender_id: number
  sender_name: string
  content: string
  message_type: string
  fund_request_id: number | null
  product_id: number | null
  product_name: string | null
  reply_to_id: number | null
  reply_to: ReplyInfo | null
  is_edited: boolean
  is_delivered: boolean
  is_read: boolean
  created_at: string
}

interface MessageableUser {
  id: number
  name: string
  email: string
  role: string | null
  branch: string | null
  avatar_url: string | null
  is_online: boolean
}

type MentionType = 'product' | 'fund-request' | 'visit' | 'patient' | 'user'

const mentionTypes: { key: MentionType; label: string; icon: IconType; prefix: string }[] = [
  { key: 'product', label: 'Product', icon: MdInventory2, prefix: '@product:' },
  { key: 'fund-request', label: 'Memo', icon: MdDescription, prefix: '@fund:' },
  { key: 'visit', label: 'Visit', icon: MdVisibility, prefix: '@visit:' },
  { key: 'patient', label: 'Patient', icon: MdPerson, prefix: '@patient:' },
  { key: 'user', label: 'User/Staff', icon: MdPeople, prefix: '@user:' },
]

const ATTACHMENT_ICONS: Record<string, [IconType, string]> = {
  product: [MdInventory2, 'green.500'],
  'fund-request': [MdDescription, 'blue.500'],
  visit: [MdVisibility, 'purple.500'],
  patient: [MdPerson, 'orange.500'],
  user: [MdPeople, 'cyan.500'],
}

const PREVIEW_TITLES: Record<string, string> = {
  product: 'Product Details',
  'fund-request': 'Memo Details',
  visit: 'Visit Details',
  patient: 'Patient Details',
  user: 'User Details',
}

function AttachmentIcon({ type, size = '16px' }: { type: string; size?: string }) {
  const [icon, color] = ATTACHMENT_ICONS[type] || [MdDescription, undefined]
  return <Icon as={icon} color={color} w={size} h={size} flexShrink={0} />
}

// [label, value, capitalize?]
function DetailGrid({ items }: { items: [string, React.ReactNode, boolean?][] }) {
  return (
    <SimpleGrid columns={2} spacing="12px" fontSize="sm">
      {items.map(([label, value, capitalize]) => (
        <Box key={label}>
          <Text color="secondaryGray.600">{label}</Text>
          <Text fontWeight="600" textTransform={capitalize ? 'capitalize' : undefined}>
            {value}
          </Text>
        </Box>
      ))}
    </SimpleGrid>
  )
}

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString('en-GB', { weekday: 'short' })
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Inline product card that fetches product details
function ProductCardInline({ productId, productName, onClick }: { productId: number; productName: string; onClick: () => void }) {
  const { data: product } = useQuery({
    queryKey: ['product-inline', productId],
    queryFn: async () => (await api.get(`/sales/products/${productId}`)).data,
    staleTime: 5 * 60 * 1000,
  })
  const bg = useColorModeValue('white', 'navy.900')

  return (
    <Flex my="8px" borderRadius="12px" overflow="hidden" border="1px solid" borderColor="blackAlpha.200" bg={bg} color="inherit" cursor="pointer" _hover={{ opacity: 0.9 }} onClick={onClick}>
      {product?.image_url ? (
        <Image src={product.image_url} alt={productName} w="64px" h="64px" objectFit="cover" flexShrink={0} />
      ) : (
        <Center w="64px" h="64px" bg="secondaryGray.100" flexShrink={0}>
          <Icon as={MdInventory2} w="24px" h="24px" color="green.500" />
        </Center>
      )}
      <Box flex="1" p="8px" minW="0">
        <Text fontWeight="600" fontSize="sm" noOfLines={1} color="secondaryGray.900" _dark={{ color: 'white' }}>
          {productName}
        </Text>
        {product ? (
          <>
            <Text fontSize="sm" color="green.500" fontWeight="700">
              GH₵{product.unit_price}
            </Text>
            <Text fontSize="xs" color="secondaryGray.600">
              {product.category?.name || 'Product'}
            </Text>
          </>
        ) : (
          <>
            <Text fontSize="xs" color="green.500" fontWeight="700">
              View Product
            </Text>
            <Text fontSize="xs" color="secondaryGray.600">
              Tap to see details & price
            </Text>
          </>
        )}
      </Box>
      <Center pe="8px">
        <Icon as={MdVisibility} color="secondaryGray.600" />
      </Center>
    </Flex>
  )
}

// Selectable user list used by the group chat and broadcast dialogs
function UserPickList({ users, selected, onToggle, h }: { users: MessageableUser[]; selected: number[]; onToggle: (id: number) => void; h: string }) {
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200')
  const selectedBg = useColorModeValue('brand.50', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.100', 'whiteAlpha.50')
  return (
    <Box border="1px solid" borderColor={borderColor} borderRadius="12px" h={h} overflowY="auto" className="thin-scrollbar">
      {users.map((u) => {
        const isSelected = selected.includes(u.id)
        return (
          <Flex
            key={u.id}
            align="center"
            gap="12px"
            p="12px"
            cursor="pointer"
            borderBottom="1px solid"
            borderColor={borderColor}
            borderLeft="3px solid"
            borderLeftColor={isSelected ? 'brand.500' : 'transparent'}
            bg={isSelected ? selectedBg : undefined}
            _hover={isSelected ? undefined : { bg: hoverBg }}
            onClick={() => onToggle(u.id)}
          >
            <Center w="20px" h="20px" borderRadius="4px" border="2px solid" borderColor={isSelected ? 'brand.500' : 'secondaryGray.400'} bg={isSelected ? 'brand.500' : undefined}>
              {isSelected && <Icon as={MdCheck} color="white" w="14px" h="14px" />}
            </Center>
            <Avatar size="sm" name={u.name} />
            <Box flex="1" minW="0">
              <Text fontWeight="600" fontSize="sm">
                {u.name}
              </Text>
              <Text fontSize="xs" color="secondaryGray.600">
                {u.role} {u.branch && `• ${u.branch}`}
              </Text>
            </Box>
          </Flex>
        )
      })}
    </Box>
  )
}

export default function MessagesPage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { conversationId } = useParams<{ conversationId?: string }>()

  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messageText, setMessageText] = useState('')
  const [conversationSearch, setConversationSearch] = useState('')
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [showGroupChatDialog, setShowGroupChatDialog] = useState(false)
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false)
  const [showGroupMembersDialog, setShowGroupMembersDialog] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [groupName, setGroupName] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const selectedConversationRef = useRef<Conversation | null>(null)

  // Keep ref in sync with state for WebSocket callbacks
  useEffect(() => {
    selectedConversationRef.current = selectedConversation
  }, [selectedConversation])

  // @ Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionType, setMentionType] = useState<MentionType | null>(null)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)
  const [attachments, setAttachments] = useState<Array<{ type: string; id: number; name: string; extra?: any }>>([])

  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<{ type: string; id: number } | null>(null)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deletingMessageId, setDeletingMessageId] = useState<number | null>(null)

  const isAdmin = getUserRole(user) === 'admin'

  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200')
  const mutedBg = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('secondaryGray.100', 'whiteAlpha.50')
  const bubbleBg = useColorModeValue('secondaryGray.100', 'navy.700')
  const popoverBg = useColorModeValue('white', 'navy.800')

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => (await api.get('/messaging/conversations')).data,
    refetchInterval: 5000,
  })

  // Select conversation from URL parameter
  useEffect(() => {
    if (conversationId && conversations.length > 0 && !selectedConversation) {
      const conv = conversations.find((c: Conversation) => c.id === parseInt(conversationId))
      if (conv) setSelectedConversation(conv)
    }
  }, [conversationId, conversations, selectedConversation])

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return []
      return (await api.get(`/messaging/conversations/${selectedConversation.id}/messages`)).data
    },
    enabled: !!selectedConversation,
    refetchInterval: 3000,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const { data: messageableUsers = [] } = useQuery({
    queryKey: ['messageable-users', userSearch],
    queryFn: async () => {
      const params = userSearch ? `?search=${encodeURIComponent(userSearch)}` : ''
      return (await api.get(`/messaging/users/messageable${params}`)).data
    },
  })

  // Items for @ mention search (or recent items if no search)
  const { data: mentionResults = [] } = useQuery({
    queryKey: ['mention-search', mentionType, mentionSearch, isAdmin],
    queryFn: async () => {
      if (!mentionType) return []
      const searchTerm = mentionSearch.trim()
      switch (mentionType) {
        case 'product': {
          const prodUrl = searchTerm ? `/sales/products?search=${encodeURIComponent(searchTerm)}&limit=10` : `/sales/products?limit=10`
          const prodRes = await api.get(prodUrl)
          return (prodRes.data.products || prodRes.data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            subtitle: `GH₵${p.selling_price} • ${p.category_name || 'Uncategorized'}`,
            type: 'product',
          }))
        }
        case 'fund-request': {
          // Admins see all, employees see their own
          const frRes = await api.get(isAdmin ? '/fund-requests?limit=10' : '/fund-requests?my_requests=true')
          let frData = frRes.data || []
          if (searchTerm) frData = frData.filter((fr: any) => fr.title.toLowerCase().includes(searchTerm.toLowerCase()))
          return frData.slice(0, 10).map((fr: any) => ({
            id: fr.id,
            name: fr.title,
            subtitle: `GH₵${fr.amount} • ${fr.status} • ${fr.requested_by_name || 'Unknown'}`,
            type: 'fund-request',
          }))
        }
        case 'visit': {
          const visitRes = await api.get(`/patients/visits/search?q=${encodeURIComponent(searchTerm)}&limit=10`)
          return (visitRes.data || []).map((v: any) => ({
            id: v.id,
            name: `Visit #${v.id} - ${v.patient_name || 'Unknown'}`,
            subtitle: `${v.visit_date} • ${v.status}`,
            type: 'visit',
          }))
        }
        case 'patient': {
          const patUrl = searchTerm ? `/patients?search=${encodeURIComponent(searchTerm)}&limit=10` : `/patients?limit=10`
          const patRes = await api.get(patUrl)
          return (patRes.data.patients || patRes.data || []).map((p: any) => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`,
            subtitle: p.phone || p.email || 'No contact',
            type: 'patient',
          }))
        }
        case 'user': {
          const userUrl = searchTerm ? `/messaging/users/messageable?search=${encodeURIComponent(searchTerm)}` : `/messaging/users/messageable`
          const userRes = await api.get(userUrl)
          return (userRes.data || []).slice(0, 10).map((u: any) => ({
            id: u.id,
            name: u.name,
            subtitle: `${u.role || 'Staff'}${u.branch ? ` • ${u.branch}` : ''}`,
            type: 'user',
          }))
        }
        default:
          return []
      }
    },
    enabled: showMentionDropdown && !!mentionType,
  })

  const PREVIEW_URLS: Record<string, string> = {
    product: '/sales/products/',
    'fund-request': '/fund-requests/',
    visit: '/patients/visits/',
    patient: '/patients/',
    user: '/users/',
  }

  const { data: attachmentDetails, isLoading: attachmentLoading } = useQuery({
    queryKey: ['attachment-preview', previewAttachment?.type, previewAttachment?.id],
    queryFn: async () => {
      if (!previewAttachment || !PREVIEW_URLS[previewAttachment.type]) return null
      const res = await api.get(`${PREVIEW_URLS[previewAttachment.type]}${previewAttachment.id}`)
      return { type: previewAttachment.type, data: res.data }
    },
    enabled: showAttachmentPreview && !!previewAttachment,
  })

  const openAttachmentPreview = (type: string, id: number) => {
    setPreviewAttachment({ type, id })
    setShowAttachmentPreview(true)
  }

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: number; content: string; messageType?: string; fundRequestId?: number; productId?: number; replyToId?: number }) =>
      (
        await api.post(`/messaging/conversations/${data.conversationId}/messages`, {
          content: data.content,
          message_type: data.messageType || 'text',
          fund_request_id: data.fundRequestId,
          product_id: data.productId,
          reply_to_id: data.replyToId,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation?.id] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setMessageText('')
      setReplyingTo(null)
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' })
    },
  })

  const selectCreatedConversation = async (id: number) => {
    const convResponse = await api.get('/messaging/conversations')
    const conv = convResponse.data.find((c: Conversation) => c.id === id)
    if (conv) setSelectedConversation(conv)
  }

  const createConversationMutation = useMutation({
    mutationFn: async (userId: number) => (await api.post('/messaging/conversations', { participant_ids: [userId], is_group: false })).data,
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setShowNewChatDialog(false)
      await selectCreatedConversation(data.id)
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to start conversation', variant: 'destructive' })
    },
  })

  const createGroupChatMutation = useMutation({
    mutationFn: async ({ userIds, name }: { userIds: number[]; name: string }) => (await api.post('/messaging/conversations', { participant_ids: userIds, is_group: true, name })).data,
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      closeGroupDialog()
      await selectCreatedConversation(data.id)
      toast({ title: 'Success', description: 'Group chat created' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create group chat', variant: 'destructive' })
    },
  })

  const broadcastMessageMutation = useMutation({
    mutationFn: async ({ userIds, message }: { userIds: number[]; message: string }) => (await api.post('/messaging/broadcast', { user_ids: userIds, message })).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      closeBroadcastDialog()
      toast({ title: 'Success', description: `Message sent to ${data.sent_count} users` })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send broadcast message', variant: 'destructive' })
    },
  })

  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: number; content: string }) => (await api.put(`/messaging/messages/${messageId}`, { content })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation?.id] })
      setEditingMessage(null)
      setEditContent('')
      toast({ title: 'Success', description: 'Message updated' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to edit message', variant: 'destructive' })
    },
  })

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => (await api.delete(`/messaging/messages/${messageId}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation?.id] })
      setDeletingMessageId(null)
      toast({ title: 'Success', description: 'Message deleted' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' })
    },
  })

  // WebSocket connection with reconnection
  useEffect(() => {
    if (!user?.id) return

    let reconnectTimeout: ReturnType<typeof setTimeout>
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5

    const connectWebSocket = () => {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/messaging/ws/${user.id}`
      try {
        wsRef.current = new WebSocket(wsUrl)

        wsRef.current.onopen = () => {
          reconnectAttempts = 0
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
          queryClient.invalidateQueries({ queryKey: ['messageable-users'] })
        }

        wsRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data)
          // Use ref to get current selected conversation (avoids stale closure)
          const currentConv = selectedConversationRef.current

          if (data.type === 'new_message') {
            queryClient.invalidateQueries({ queryKey: ['messages', data.data.conversation_id] })
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
          } else if (data.type === 'typing') {
            if (currentConv && data.data.conversation_id === currentConv.id) setOtherTyping(data.data.is_typing)
          } else if (data.type === 'notification') {
            toast({ title: data.data.title, description: data.data.message })
          } else if (data.type === 'user_online' || data.type === 'user_offline') {
            if (currentConv && currentConv.other_user_id === data.data.user_id) {
              setSelectedConversation((prev) => (prev ? { ...prev, other_user_online: data.data.is_online } : null))
            }
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
            queryClient.invalidateQueries({ queryKey: ['messageable-users'] })
          } else if (data.type === 'message_read') {
            if (currentConv && data.data.conversation_id === currentConv.id) {
              queryClient.invalidateQueries({ queryKey: ['messages', currentConv.id] })
            }
          }
        }

        wsRef.current.onclose = () => {
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
            reconnectTimeout = setTimeout(connectWebSocket, delay)
          }
        }

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error)
        }
      } catch (error) {
        console.error('WebSocket connection error:', error)
      }
    }

    connectWebSocket()

    return () => {
      clearTimeout(reconnectTimeout)
      reconnectAttempts = maxReconnectAttempts // stop the onclose handler from reconnecting after unmount
      wsRef.current?.close()
    }
  }, [user?.id])

  // Join conversation when selected and mark messages as read
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedConversation) {
      wsRef.current.send(JSON.stringify({ type: 'join_conversation', conversation_id: selectedConversation.id }))
      api.post(`/messaging/conversations/${selectedConversation.id}/mark-read`).catch(() => {})
    }
  }, [selectedConversation?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark messages as read when new messages arrive
  useEffect(() => {
    if (selectedConversation && messages.length > 0) {
      const hasUnreadFromOthers = messages.some((m: Message) => m.sender_id !== user?.id && !m.is_read)
      if (hasUnreadFromOthers) {
        api
          .post(`/messaging/conversations/${selectedConversation.id}/mark-read`)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.id] })
            queryClient.invalidateQueries({ queryKey: ['unread-messages'] })
          })
          .catch(() => {})
      }
    }
  }, [messages, selectedConversation?.id, user?.id])

  const sendTyping = (is_typing: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedConversation) {
      wsRef.current.send(JSON.stringify({ type: 'typing', conversation_id: selectedConversation.id, is_typing }))
    }
  }

  const handleTyping = () => {
    if (!isTyping && wsRef.current?.readyState === WebSocket.OPEN && selectedConversation) {
      setIsTyping(true)
      sendTyping(true)
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      sendTyping(false)
    }, 2000)
  }

  const handleSendMessage = () => {
    if ((!messageText.trim() && attachments.length === 0) || !selectedConversation) return

    // Build message content with attachment references
    let content = messageText.trim()
    if (attachments.length > 0) {
      const attachmentText = attachments.map((a) => `[@${a.type}:${a.id}:${a.name}]`).join(' ')
      content = content ? `${content}\n${attachmentText}` : attachmentText
    }

    // First attachment fills the legacy fields
    const fundRequest = attachments.find((a) => a.type === 'fund-request')
    const product = attachments.find((a) => a.type === 'product')

    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      content,
      messageType: attachments.length > 0 ? attachments[0].type : 'text',
      fundRequestId: fundRequest?.id,
      productId: product?.id,
      replyToId: replyingTo?.id,
    })
    setAttachments([])
  }

  const handleSendGif = (gifUrl: string) => {
    if (!selectedConversation) return
    sendMessageMutation.mutate({ conversationId: selectedConversation.id, content: `[gif:${gifUrl}]`, messageType: 'gif' })
    setShowGifPicker(false)
  }

  const handleViewUserProfile = (userId: number) => {
    if (isAdmin) navigate(`/admin/user-profile/${userId}`)
  }

  // @ mention detection in input
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart || 0
    setMessageText(value)
    handleTyping()

    // Easter egg: /gif opens the GIF picker
    if (value.toLowerCase().startsWith('/gif')) {
      setShowGifPicker(true)
      setMessageText('')
      return
    }

    // Match @word or @word:anything pattern (allows spaces in search)
    const textBeforeCursor = value.substring(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@(\w+:?[^@]*)$/) || textBeforeCursor.match(/@$/)

    if (!atMatch) {
      setShowMentionDropdown(false)
      setMentionType(null)
      return
    }

    const fullQuery = atMatch[1] || ''
    const queryLower = fullQuery.toLowerCase()
    setMentionStartIndex(cursorPos - atMatch[0].length)

    const prefixed: [string, MentionType][] = [
      ['product:', 'product'],
      ['fund:', 'fund-request'],
      ['visit:', 'visit'],
      ['patient:', 'patient'],
      ['user:', 'user'],
    ]
    const shorthand: Record<string, MentionType> = {
      p: 'product',
      product: 'product',
      f: 'fund-request',
      fund: 'fund-request',
      v: 'visit',
      visit: 'visit',
      pat: 'patient',
      patient: 'patient',
      u: 'user',
      user: 'user',
    }

    const hit = prefixed.find(([prefix]) => queryLower.startsWith(prefix))
    if (hit) {
      setMentionType(hit[1])
      setMentionSearch(fullQuery.substring(hit[0].length))
      setShowMentionDropdown(true)
    } else if (shorthand[queryLower]) {
      setMentionType(shorthand[queryLower])
      setMentionSearch('')
      setShowMentionDropdown(true)
    } else if (fullQuery === '') {
      // Just @ typed, show type selector
      setMentionType(null)
      setShowMentionDropdown(true)
    } else {
      setShowMentionDropdown(false)
    }
  }

  const selectMentionType = (type: MentionType) => {
    setMentionType(type)
    setMentionSearch('')
    const prefix = mentionTypes.find((m) => m.key === type)?.prefix || '@'
    const before = messageText.substring(0, mentionStartIndex)
    const after = messageText.substring(mentionStartIndex + 1)
    setMessageText(before + prefix + after)
    inputRef.current?.focus()
  }

  const selectMentionResult = (item: { id: number; name: string; type: string; subtitle?: string }) => {
    setAttachments((prev) => [...prev, { type: item.type, id: item.id, name: item.name }])
    setMessageText(messageText.substring(0, mentionStartIndex))
    setShowMentionDropdown(false)
    setMentionType(null)
    setMentionSearch('')
    inputRef.current?.focus()
  }

  // Parse message content and render inline attachment references as clickable cards
  const renderMessageContent = (content: string, isOwn: boolean) => {
    const gifMatch = content.match(/^\[gif:(https?:\/\/[^\]]+)\]$/)
    if (gifMatch) return <Image src={gifMatch[1]} alt="GIF" borderRadius="8px" maxW="xs" loading="lazy" />

    const trimmedContent = content.trim()
    const singleProductMatch = trimmedContent.match(/^\[@product:(\d+):([^\]]+)\]$/)
    if (singleProductMatch) {
      const id = parseInt(singleProductMatch[1], 10)
      return <ProductCardInline productId={id} productName={singleProductMatch[2]} onClick={() => openAttachmentPreview('product', id)} />
    }

    const singleUserMatch = trimmedContent.match(/^\[@user:(\d+):([^\]]+)\]$/)
    if (singleUserMatch) {
      const id = parseInt(singleUserMatch[1], 10)
      const name = singleUserMatch[2]
      return (
        <Flex
          my="8px"
          p="8px"
          gap="12px"
          align="center"
          borderRadius="12px"
          border="1px solid"
          borderColor="blackAlpha.200"
          bg={isOwn ? 'whiteAlpha.300' : popoverBg}
          cursor="pointer"
          _hover={{ opacity: 0.9 }}
          onClick={() => openAttachmentPreview('user', id)}
        >
          <Avatar size="sm" name={name} bg="cyan.100" color="cyan.700" />
          <Box flex="1" minW="0">
            <Text fontWeight="600" fontSize="sm" noOfLines={1}>
              {name}
            </Text>
            <Text fontSize="xs" opacity={0.7}>
              Tap to view profile or message
            </Text>
          </Box>
          <Icon as={MdForum} opacity={0.5} />
        </Flex>
      )
    }

    // Match [@type:id:name] references
    const attachmentRegex = /\[@([\w-]+):(\d+):([^\]]+)\]/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match
    while ((match = attachmentRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index)
        if (textBefore.trim()) parts.push(<Text key={`text-${lastIndex}`} as="span" whiteSpace="pre-wrap">{textBefore}</Text>)
      }
      const [fullMatch, type, idStr, name] = match
      const id = parseInt(idStr, 10)
      parts.push(
        <Flex
          key={`attachment-${match.index}`}
          my="4px"
          p="8px"
          gap="8px"
          align="center"
          borderRadius="8px"
          bg={isOwn ? 'whiteAlpha.300' : 'blackAlpha.50'}
          cursor="pointer"
          _hover={{ opacity: 0.8 }}
          onClick={() => openAttachmentPreview(type, id)}
        >
          <AttachmentIcon type={type} />
          <Box flex="1" minW="0">
            <Text as="span" fontSize="sm" fontWeight="600">
              {name}
            </Text>
            <Text as="span" fontSize="xs" opacity={0.7} ms="8px" textTransform="capitalize">
              {type.replace('-', ' ')}
            </Text>
          </Box>
          <Icon as={MdVisibility} w="12px" h="12px" opacity={0.5} />
        </Flex>
      )
      lastIndex = match.index + fullMatch.length
    }

    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex)
      if (remainingText.trim()) parts.push(<Text key={`text-${lastIndex}`} as="span" whiteSpace="pre-wrap">{remainingText}</Text>)
    }

    if (parts.length === 0) return <Text whiteSpace="pre-wrap">{content}</Text>
    return <Box>{parts}</Box>
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleUser = (id: number) => setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const closeGroupDialog = () => {
    setShowGroupChatDialog(false)
    setSelectedUsers([])
    setGroupName('')
  }

  const closeBroadcastDialog = () => {
    setShowBroadcastDialog(false)
    setSelectedUsers([])
    setBroadcastMessage('')
  }

  const closePreview = () => setShowAttachmentPreview(false)
  const goFromPreview = (path: string) => {
    navigate(path)
    closePreview()
  }

  const filteredConversations = conversations.filter((c: Conversation) => c.name.toLowerCase().includes(conversationSearch.toLowerCase()))
  const canOpenProfile = isAdmin && !!selectedConversation?.other_user_id
  const details = attachmentDetails?.data

  return (
    <>
      <Flex gap="16px" h="calc(100vh - 150px)" minH="480px" pt="10px">
        {/* Conversations list */}
        <Card p="0" w={{ base: '100%', md: '320px' }} flexShrink={0} display={{ base: selectedConversation ? 'none' : 'flex', md: 'flex' }} flexDirection="column" overflow="hidden">
          <Box p="16px" borderBottom="1px solid" borderColor={borderColor}>
            <Flex align="center" justify="space-between" mb="12px">
              <Text fontWeight="700" fontSize="lg">
                Messages
              </Text>
              <HStack spacing="4px">
                {isAdmin && (
                  <>
                    <Tooltip label="New Group Chat">
                      <IconButton aria-label="New Group Chat" size="sm" variant="light" icon={<MdGroups />} onClick={() => setShowGroupChatDialog(true)} />
                    </Tooltip>
                    <Tooltip label="Broadcast Message">
                      <IconButton aria-label="Broadcast Message" size="sm" variant="light" icon={<MdSend />} onClick={() => setShowBroadcastDialog(true)} />
                    </Tooltip>
                  </>
                )}
                <Tooltip label="New Chat">
                  <IconButton aria-label="New Chat" size="sm" variant="brand" icon={<MdAdd />} onClick={() => setShowNewChatDialog(true)} />
                </Tooltip>
              </HStack>
            </Flex>
            <SearchInput value={conversationSearch} onChange={setConversationSearch} placeholder="Search conversations..." maxW="100%" />
          </Box>

          <Box flex="1" overflowY="auto" className="thin-scrollbar">
            {conversationsLoading ? (
              <Center p="16px">
                <Spinner color="brand.500" />
              </Center>
            ) : filteredConversations.length === 0 ? (
              <EmptyState icon={MdForum} title={conversationSearch ? 'No matching conversations' : 'No conversations yet'}>
                <Button variant="link" colorScheme="brand" mt="8px" onClick={() => setShowNewChatDialog(true)}>
                  Start a new chat
                </Button>
              </EmptyState>
            ) : (
              filteredConversations.map((conv: Conversation) => (
                <Flex
                  key={conv.id}
                  gap="12px"
                  align="start"
                  p="14px 16px"
                  cursor="pointer"
                  borderBottom="1px solid"
                  borderColor={borderColor}
                  bg={selectedConversation?.id === conv.id ? mutedBg : undefined}
                  _hover={{ bg: hoverBg }}
                  onClick={() => setSelectedConversation(conv)}
                >
                  <Avatar size="md" name={conv.name}>
                    {conv.other_user_online && <AvatarBadge boxSize="1em" bg="green.500" />}
                  </Avatar>
                  <Box flex="1" minW="0">
                    <Flex justify="space-between" align="center" gap="8px">
                      <Text fontWeight="600" noOfLines={1}>
                        {conv.name}
                      </Text>
                      {conv.last_message && (
                        <Text fontSize="xs" color="secondaryGray.600" flexShrink={0}>
                          {formatTime(conv.last_message.created_at)}
                        </Text>
                      )}
                    </Flex>
                    <Flex justify="space-between" align="center" gap="8px">
                      <Text fontSize="sm" color="secondaryGray.600" noOfLines={1}>
                        {conv.other_user_typing ? (
                          <Text as="span" color="blue.500" fontStyle="italic">
                            typing...
                          </Text>
                        ) : (
                          conv.last_message?.content || 'No messages yet'
                        )}
                      </Text>
                      {conv.unread_count > 0 && (
                        <Badge bg="brand.500" color="white" borderRadius="full" minW="20px" textAlign="center">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </Flex>
                  </Box>
                </Flex>
              ))
            )}
          </Box>
        </Card>

        {/* Chat area */}
        <Card p="0" flex="1" minW="0" display={{ base: selectedConversation ? 'flex' : 'none', md: 'flex' }} flexDirection="column" overflow="hidden">
          {selectedConversation ? (
            <>
              <Flex p="16px" gap="12px" align="center" borderBottom="1px solid" borderColor={borderColor}>
                <IconButton aria-label="Back to conversations" display={{ base: 'inline-flex', md: 'none' }} variant="ghost" size="sm" icon={<MdArrowBack />} onClick={() => setSelectedConversation(null)} />
                <Avatar
                  size="md"
                  name={selectedConversation.name}
                  cursor={canOpenProfile ? 'pointer' : undefined}
                  onClick={() => canOpenProfile && handleViewUserProfile(selectedConversation.other_user_id!)}
                />
                <Box minW="0">
                  <Text
                    fontWeight="700"
                    noOfLines={1}
                    cursor={canOpenProfile ? 'pointer' : undefined}
                    _hover={canOpenProfile ? { textDecoration: 'underline' } : undefined}
                    onClick={() => canOpenProfile && handleViewUserProfile(selectedConversation.other_user_id!)}
                  >
                    {selectedConversation.name}
                  </Text>
                  <Text fontSize="xs" color="secondaryGray.600">
                    {otherTyping ? (
                      <Text as="span" color="blue.500">
                        typing...
                      </Text>
                    ) : selectedConversation.other_user_online ? (
                      <Text as="span" color="green.500">
                        Online
                      </Text>
                    ) : (
                      'Offline'
                    )}
                    {canOpenProfile && !selectedConversation.is_group && (
                      <Button variant="link" size="xs" colorScheme="brand" ms="8px" onClick={() => handleViewUserProfile(selectedConversation.other_user_id!)}>
                        View Profile
                      </Button>
                    )}
                    {selectedConversation.is_group && (
                      <Button variant="link" size="xs" colorScheme="brand" ms="8px" onClick={() => setShowGroupMembersDialog(true)}>
                        View Members
                      </Button>
                    )}
                  </Text>
                </Box>
              </Flex>

              {/* Messages */}
              <Box flex="1" overflowY="auto" p="16px" className="thin-scrollbar">
                {messagesLoading ? (
                  <Center py="32px">
                    <Spinner color="brand.500" />
                  </Center>
                ) : messages.length === 0 ? (
                  <EmptyState icon={MdForum}>No messages yet. Say hello!</EmptyState>
                ) : (
                  <Stack spacing="16px">
                    {messages.map((msg: Message) => {
                      const isOwn = msg.sender_id === user?.id
                      return (
                        <Flex key={msg.id} justify={isOwn ? 'flex-end' : 'flex-start'} role="group">
                          <Flex align="end" gap="4px" maxW={{ base: '85%', md: '70%' }} direction={isOwn ? 'row-reverse' : 'row'}>
                            <Box borderRadius="16px" p="12px" bg={isOwn ? 'brand.500' : bubbleBg} color={isOwn ? 'white' : undefined} minW="0">
                              {msg.reply_to && (
                                <Box mb="8px" p="8px" borderRadius="8px" borderLeft="3px solid" borderColor={isOwn ? 'whiteAlpha.600' : 'secondaryGray.500'} bg={isOwn ? 'whiteAlpha.200' : 'blackAlpha.50'}>
                                  <Flex align="center" gap="4px" fontSize="xs" fontWeight="600" opacity={0.85}>
                                    <Icon as={MdReply} />
                                    {msg.reply_to.sender_name}
                                  </Flex>
                                  <Text fontSize="xs" opacity={0.7} noOfLines={1}>
                                    {msg.reply_to.content}
                                  </Text>
                                </Box>
                              )}
                              {!isOwn && (
                                <Text fontSize="xs" fontWeight="600" mb="4px" opacity={0.7}>
                                  {msg.sender_name}
                                </Text>
                              )}
                              {renderMessageContent(msg.content, isOwn)}
                              <Flex align="center" gap="4px" fontSize="xs" mt="4px" opacity={0.75} justify="flex-end">
                                <Text>{formatTime(msg.created_at)}</Text>
                                {isOwn && (
                                  <Tooltip label={msg.is_read ? 'Read' : msg.is_delivered ? 'Delivered' : 'Sent'}>
                                    <span>
                                      <Icon as={msg.is_read || msg.is_delivered ? MdDoneAll : MdCheck} color={msg.is_read ? 'blue.200' : undefined} />
                                    </span>
                                  </Tooltip>
                                )}
                              </Flex>
                            </Box>
                            {/* Message actions */}
                            <HStack spacing="0" opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.15s" flexDirection={isOwn ? 'row-reverse' : 'row'}>
                              <IconButton aria-label="Reply" size="xs" variant="ghost" icon={<MdReply />} onClick={() => setReplyingTo(msg)} />
                              {(isOwn || isAdmin) && (
                                <>
                                  <IconButton
                                    aria-label="Edit"
                                    size="xs"
                                    variant="ghost"
                                    icon={<MdEdit />}
                                    onClick={() => {
                                      setEditingMessage(msg)
                                      setEditContent(msg.content)
                                    }}
                                  />
                                  <IconButton aria-label="Delete" size="xs" variant="ghost" color="red.500" icon={<MdDelete />} onClick={() => setDeletingMessageId(msg.id)} />
                                </>
                              )}
                            </HStack>
                          </Flex>
                        </Flex>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </Stack>
                )}
              </Box>

              {/* Composer */}
              <Box p="16px" borderTop="1px solid" borderColor={borderColor} position="relative">
                {editingMessage && (
                  <Box mb="8px" p="8px" bg="yellow.50" _dark={{ bg: 'rgba(236,201,75,0.12)' }} border="1px solid" borderColor="yellow.200" borderRadius="12px">
                    <Flex justify="space-between" align="center" mb="8px">
                      <Flex align="center" gap="4px" fontSize="xs" fontWeight="600" color="yellow.700" _dark={{ color: 'yellow.300' }}>
                        <Icon as={MdEdit} />
                        Editing message
                      </Flex>
                      <IconButton
                        aria-label="Cancel edit"
                        size="xs"
                        variant="ghost"
                        icon={<MdClose />}
                        onClick={() => {
                          setEditingMessage(null)
                          setEditContent('')
                        }}
                      />
                    </Flex>
                    <Flex gap="8px">
                      <Input variant="main" size="sm" value={editContent} onChange={(e) => setEditContent(e.target.value)} autoFocus />
                      <Button
                        size="sm"
                        variant="brand"
                        isDisabled={!editContent.trim()}
                        isLoading={editMessageMutation.isPending}
                        onClick={() => editContent.trim() && editMessageMutation.mutate({ messageId: editingMessage.id, content: editContent.trim() })}
                      >
                        Save
                      </Button>
                    </Flex>
                  </Box>
                )}

                {replyingTo && (
                  <Flex mb="8px" p="8px" bg={mutedBg} borderRadius="12px" justify="space-between" align="center" gap="8px">
                    <Flex align="center" gap="8px" minW="0">
                      <Icon as={MdReply} color="secondaryGray.600" flexShrink={0} />
                      <Box minW="0">
                        <Text fontSize="xs" fontWeight="600" color="secondaryGray.600">
                          Replying to {replyingTo.sender_name}
                        </Text>
                        <Text fontSize="sm" noOfLines={1}>
                          {replyingTo.content}
                        </Text>
                      </Box>
                    </Flex>
                    <IconButton aria-label="Cancel reply" size="xs" variant="ghost" icon={<MdClose />} onClick={() => setReplyingTo(null)} />
                  </Flex>
                )}

                {attachments.length > 0 && (
                  <Flex mb="8px" gap="8px" wrap="wrap">
                    {attachments.map((att, idx) => (
                      <Flex key={idx} align="center" gap="8px" px="12px" py="6px" bg={mutedBg} borderRadius="full" fontSize="sm">
                        <AttachmentIcon type={att.type} />
                        <Text maxW="128px" noOfLines={1}>
                          {att.name}
                        </Text>
                        <IconButton
                          aria-label="Remove attachment"
                          size="xs"
                          variant="unstyled"
                          minW="auto"
                          h="auto"
                          icon={<MdClose />}
                          _hover={{ color: 'red.500' }}
                          onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        />
                      </Flex>
                    ))}
                  </Flex>
                )}

                {showMentionDropdown && (
                  <Box position="absolute" bottom="100%" left="16px" right="16px" mb="8px" bg={popoverBg} border="1px solid" borderColor={borderColor} borderRadius="12px" boxShadow="lg" maxH="256px" overflowY="auto" zIndex={50} p="8px">
                    {!mentionType ? (
                      <>
                        <Text fontSize="xs" color="secondaryGray.600" px="8px" py="4px">
                          Select what to reference:
                        </Text>
                        {mentionTypes.map((type) => (
                          <Flex key={type.key} align="center" gap="12px" px="12px" py="8px" borderRadius="8px" cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => selectMentionType(type.key)}>
                            <Icon as={type.icon} />
                            <Text>{type.label}</Text>
                            <Text fontSize="xs" color="secondaryGray.600" ms="auto">
                              {type.prefix}
                            </Text>
                          </Flex>
                        ))}
                      </>
                    ) : (
                      <>
                        <Text fontSize="xs" color="secondaryGray.600" px="8px" py="4px">
                          {mentionSearch.trim() ? `Searching ${mentionType}s: "${mentionSearch}"` : `Recent ${mentionType}s (type to search)`}
                        </Text>
                        {mentionResults.length === 0 ? (
                          <Text fontSize="sm" color="secondaryGray.600" px="12px" py="8px">
                            {mentionSearch.trim() ? 'No results found' : 'No recent items'}
                          </Text>
                        ) : (
                          mentionResults.map((item: any) => (
                            <Flex key={item.id} align="center" gap="12px" px="12px" py="8px" borderRadius="8px" cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => selectMentionResult(item)}>
                              <AttachmentIcon type={item.type} />
                              <Box flex="1" minW="0">
                                <Text fontWeight="600" noOfLines={1}>
                                  {item.name}
                                </Text>
                                <Text fontSize="xs" color="secondaryGray.600" noOfLines={1}>
                                  {item.subtitle}
                                </Text>
                              </Box>
                            </Flex>
                          ))
                        )}
                      </>
                    )}
                  </Box>
                )}

                <Flex position="relative" gap="8px" align="center">
                  {showGifPicker && <GifPicker onSelect={handleSendGif} onClose={() => setShowGifPicker(false)} />}
                  <InputGroup flex="1">
                    <Input ref={inputRef} variant="main" value={messageText} onChange={handleMessageInputChange} onKeyDown={handleKeyPress} placeholder="Type @ to reference items..." />
                    <InputRightElement pointerEvents="none">
                      <Icon as={MdAlternateEmail} color="secondaryGray.600" />
                    </InputRightElement>
                  </InputGroup>
                  <IconButton
                    aria-label="Send"
                    variant="brand"
                    icon={<MdSend />}
                    onClick={handleSendMessage}
                    isDisabled={!messageText.trim() && attachments.length === 0}
                    isLoading={sendMessageMutation.isPending}
                  />
                </Flex>
                <Text fontSize="xs" color="secondaryGray.600" mt="4px">
                  Type <Code fontSize="xs">@</Code> to reference products, memos, visits, or patients
                </Text>
              </Box>
            </>
          ) : (
            <Center flex="1">
              <EmptyState icon={MdForum} title="Select a conversation to start messaging">
                <Button variant="link" colorScheme="brand" mt="8px" onClick={() => setShowNewChatDialog(true)}>
                  Or start a new chat
                </Button>
              </EmptyState>
            </Center>
          )}
        </Card>
      </Flex>

      {/* New Chat */}
      <AppModal isOpen={showNewChatDialog} onClose={() => setShowNewChatDialog(false)} title="Start New Conversation">
        <Stack spacing="16px">
          <SearchInput value={userSearch} onChange={setUserSearch} placeholder="Search users..." maxW="100%" />
          <Box h="256px" overflowY="auto" className="thin-scrollbar">
            {messageableUsers.length === 0 ? (
              <EmptyState icon={MdPeople}>No users found</EmptyState>
            ) : (
              messageableUsers.map((u: MessageableUser) => (
                <Flex key={u.id} align="center" gap="12px" p="12px" borderRadius="12px" cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => createConversationMutation.mutate(u.id)}>
                  <Avatar size="md" name={u.name}>
                    {u.is_online && <AvatarBadge boxSize="1em" bg="green.500" />}
                  </Avatar>
                  <Box flex="1">
                    <Text fontWeight="600">{u.name}</Text>
                    <Text fontSize="sm" color="secondaryGray.600">
                      {u.role} {u.branch && `• ${u.branch}`}
                    </Text>
                  </Box>
                </Flex>
              ))
            )}
          </Box>
        </Stack>
      </AppModal>

      {/* Group Chat (admin) */}
      <AppModal
        isOpen={showGroupChatDialog}
        onClose={closeGroupDialog}
        size="lg"
        title={
          <Flex align="center" gap="8px">
            <Icon as={MdGroups} color="brand.500" />
            Create Group Chat
          </Flex>
        }
        footer={
          <>
            <Button variant="light" onClick={closeGroupDialog}>
              Cancel
            </Button>
            <Button
              variant="brand"
              leftIcon={<MdGroups />}
              isDisabled={selectedUsers.length < 2 || !groupName.trim()}
              isLoading={createGroupChatMutation.isPending}
              onClick={() => createGroupChatMutation.mutate({ userIds: selectedUsers, name: groupName })}
            >
              Create Group
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Field label="Group Name">
            <Input variant="main" placeholder="e.g., Marketing Team, Project Alpha..." value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          </Field>
          <Box>
            <Flex justify="space-between" align="center" mb="8px">
              <Text fontSize="sm" fontWeight="600">
                Select Members
              </Text>
              <Badge>{selectedUsers.length} selected</Badge>
            </Flex>
            <UserPickList users={messageableUsers} selected={selectedUsers} onToggle={toggleUser} h="256px" />
            {selectedUsers.length < 2 && (
              <Text fontSize="xs" color="secondaryGray.600" mt="8px">
                Select at least 2 members to create a group
              </Text>
            )}
          </Box>
        </Stack>
      </AppModal>

      {/* Broadcast (admin) */}
      <AppModal
        isOpen={showBroadcastDialog}
        onClose={closeBroadcastDialog}
        size="lg"
        title={
          <Flex align="center" gap="8px">
            <Icon as={MdSend} color="brand.500" />
            Broadcast Message
          </Flex>
        }
        footer={
          <>
            <Button variant="light" onClick={closeBroadcastDialog}>
              Cancel
            </Button>
            <Button
              variant="brand"
              leftIcon={<MdSend />}
              isDisabled={selectedUsers.length === 0 || !broadcastMessage.trim()}
              isLoading={broadcastMessageMutation.isPending}
              onClick={() => broadcastMessageMutation.mutate({ userIds: selectedUsers, message: broadcastMessage })}
            >
              Send to {selectedUsers.length} Users
            </Button>
          </>
        }
      >
        <Stack spacing="16px">
          <Box bg={mutedBg} borderRadius="12px" p="12px" fontSize="sm" color="secondaryGray.600">
            Send the same message to multiple users. Each recipient will receive it as a separate conversation.
          </Box>
          <Box>
            <Flex justify="space-between" align="center" mb="8px">
              <Text fontSize="sm" fontWeight="600">
                Select Recipients
              </Text>
              <HStack spacing="4px">
                <Badge>{selectedUsers.length} selected</Badge>
                <Button variant="ghost" size="xs" onClick={() => setSelectedUsers(messageableUsers.map((u: MessageableUser) => u.id))}>
                  All
                </Button>
                <Button variant="ghost" size="xs" onClick={() => setSelectedUsers([])}>
                  None
                </Button>
              </HStack>
            </Flex>
            <UserPickList users={messageableUsers} selected={selectedUsers} onToggle={toggleUser} h="192px" />
          </Box>
          <Field label="Message">
            <Textarea variant="main" minH="100px" resize="none" placeholder="Type your broadcast message here..." value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} />
          </Field>
        </Stack>
      </AppModal>

      {/* Attachment preview */}
      <AppModal
        isOpen={showAttachmentPreview}
        onClose={closePreview}
        size="lg"
        title={
          previewAttachment && (
            <Flex align="center" gap="8px">
              <AttachmentIcon type={previewAttachment.type} size="20px" />
              {PREVIEW_TITLES[previewAttachment.type]}
            </Flex>
          )
        }
        footer={
          <>
            <Button variant="light" onClick={closePreview}>
              Close
            </Button>
            {previewAttachment?.type === 'user' && previewAttachment.id !== user?.id && (
              <Button
                variant="brand"
                leftIcon={<MdForum />}
                onClick={() => {
                  createConversationMutation.mutate(previewAttachment.id)
                  closePreview()
                }}
              >
                Send Message
              </Button>
            )}
            {previewAttachment?.type === 'user' && isAdmin && (
              <Button variant="light" onClick={() => goFromPreview(`/admin/user-profile/${previewAttachment.id}`)}>
                View Full Profile
              </Button>
            )}
            {previewAttachment?.type === 'patient' && (
              <Button variant="brand" onClick={() => goFromPreview(`/patients/${previewAttachment.id}`)}>
                View Full Profile
              </Button>
            )}
            {previewAttachment?.type === 'fund-request' && (
              <Button variant="brand" onClick={() => goFromPreview('/fund-requests')}>
                Go to Memos
              </Button>
            )}
            {previewAttachment?.type === 'visit' && details?.patient_id && (
              <Button variant="brand" onClick={() => goFromPreview(`/patients/${details.patient_id}`)}>
                View Patient
              </Button>
            )}
            {previewAttachment?.type === 'product' && (
              <Button variant="brand" onClick={() => goFromPreview('/inventory/products')}>
                Go to Inventory
              </Button>
            )}
          </>
        }
      >
        {attachmentLoading ? (
          <Center py="32px">
            <Spinner color="brand.500" />
          </Center>
        ) : !details ? (
          <Text py="32px" textAlign="center" color="secondaryGray.600">
            Could not load details
          </Text>
        ) : (
          <Stack spacing="16px">
            {attachmentDetails.type === 'product' && (
              <>
                <Flex bg={mutedBg} p="16px" borderRadius="12px" gap="16px">
                  {details.image_url ? (
                    <Image src={details.image_url} alt={details.name} w="80px" h="80px" objectFit="cover" borderRadius="12px" />
                  ) : (
                    <Center w="80px" h="80px" bg={popoverBg} borderRadius="12px">
                      <Icon as={MdInventory2} w="32px" h="32px" color="secondaryGray.600" />
                    </Center>
                  )}
                  <Box>
                    <Text fontWeight="700" fontSize="lg">
                      {details.name}
                    </Text>
                    <Text fontSize="2xl" fontWeight="700" color="green.500">
                      GH₵{details.unit_price || details.selling_price || 0}
                    </Text>
                    <Text fontSize="sm" color="secondaryGray.600">
                      {details.category?.name || 'Uncategorized'}
                    </Text>
                  </Box>
                </Flex>
                <DetailGrid
                  items={[
                    ['Category', details.category?.name || 'Uncategorized'],
                    ['SKU', details.sku || 'N/A'],
                    ['Cost Price', `GH₵${details.cost_price || 0}`],
                    ['Prescription', details.requires_prescription ? 'Required' : 'Not Required'],
                  ]}
                />
              </>
            )}

            {attachmentDetails.type === 'fund-request' && (
              <>
                <Box bg={mutedBg} p="16px" borderRadius="12px">
                  <Text fontWeight="700" fontSize="lg">
                    {details.title}
                  </Text>
                  <Text fontSize="2xl" fontWeight="700" color="blue.500">
                    GH₵{details.amount}
                  </Text>
                  <Badge mt="8px">{details.status}</Badge>
                </Box>
                <DetailGrid
                  items={[
                    ['Requested By', details.requested_by_name || 'Unknown'],
                    ['Purpose', details.purpose || 'Other'],
                    ['Created', new Date(details.created_at).toLocaleDateString()],
                    ...(details.disbursement_method ? ([['Disbursement', details.disbursement_method, true]] as [string, string, boolean][]) : []),
                  ]}
                />
              </>
            )}

            {attachmentDetails.type === 'visit' && (
              <>
                <Box bg={mutedBg} p="16px" borderRadius="12px">
                  <Text fontWeight="700" fontSize="lg">
                    Visit #{details.id}
                  </Text>
                  <Text color="secondaryGray.600">{details.patient_name || 'Unknown Patient'}</Text>
                  <Badge mt="8px">{details.status}</Badge>
                </Box>
                <DetailGrid
                  items={[
                    ['Visit Date', details.visit_date || 'N/A'],
                    ['Payment Status', details.payment_status || 'N/A', true],
                    ['Amount Paid', `GH₵${details.amount_paid || 0}`],
                    ['Payment Type', details.payment_type || 'N/A', true],
                  ]}
                />
              </>
            )}

            {attachmentDetails.type === 'patient' && (
              <>
                <Box bg={mutedBg} p="16px" borderRadius="12px">
                  <Text fontWeight="700" fontSize="lg">
                    {details.first_name} {details.last_name}
                  </Text>
                  <Text color="secondaryGray.600">{details.patient_number}</Text>
                </Box>
                <DetailGrid
                  items={[
                    ['Phone', details.phone || 'N/A'],
                    ['Email', details.email || 'N/A'],
                    ['Gender', details.gender || 'N/A', true],
                    ['Date of Birth', details.date_of_birth || 'N/A'],
                  ]}
                />
              </>
            )}

            {attachmentDetails.type === 'user' && (
              <>
                <Flex bg={mutedBg} p="16px" borderRadius="12px" align="center" gap="16px">
                  <Avatar size="lg" name={`${details.first_name || ''} ${details.last_name || ''}`} />
                  <Box>
                    <Text fontWeight="700" fontSize="lg">
                      {details.first_name} {details.last_name}
                    </Text>
                    <Text color="secondaryGray.600">{details.email}</Text>
                  </Box>
                </Flex>
                <DetailGrid
                  items={[
                    ['Role', details.role_name || 'Staff'],
                    ['Branch', details.branch_name || 'N/A'],
                    ['Phone', details.phone || 'N/A'],
                    ['Status', details.is_active ? 'Active' : 'Inactive'],
                  ]}
                />
              </>
            )}

            {(attachmentDetails.type === 'product' || attachmentDetails.type === 'fund-request') && details.description && (
              <Box>
                <Text fontSize="sm" color="secondaryGray.600">
                  Description
                </Text>
                <Text fontSize="sm">{details.description}</Text>
              </Box>
            )}
          </Stack>
        )}
      </AppModal>

      {/* Group members */}
      <AppModal isOpen={showGroupMembersDialog} onClose={() => setShowGroupMembersDialog(false)} size="sm" title="Group Members">
        {selectedConversation?.participants?.length ? (
          <Stack spacing="4px">
            {selectedConversation.participants.map((participant) => (
              <Flex
                key={participant.id}
                align="center"
                gap="12px"
                p="12px"
                borderRadius="12px"
                cursor={isAdmin ? 'pointer' : undefined}
                _hover={{ bg: hoverBg }}
                onClick={() => {
                  if (isAdmin) {
                    navigate(`/admin/user-profile/${participant.id}`)
                    setShowGroupMembersDialog(false)
                  }
                }}
              >
                <Avatar size="sm" name={participant.name || '??'} />
                <Box flex="1">
                  <Text fontWeight="600">{participant.name}</Text>
                  <Text fontSize="xs" color="secondaryGray.600">
                    {participant.role || 'Member'}
                  </Text>
                </Box>
              </Flex>
            ))}
          </Stack>
        ) : (
          <Text textAlign="center" color="secondaryGray.600" py="16px">
            No members found
          </Text>
        )}
      </AppModal>

      <ConfirmDialog
        isOpen={deletingMessageId !== null}
        onClose={() => setDeletingMessageId(null)}
        onConfirm={() => deletingMessageId !== null && deleteMessageMutation.mutate(deletingMessageId)}
        isLoading={deleteMessageMutation.isPending}
        title="Delete this message?"
      >
        This message will be removed from the conversation.
      </ConfirmDialog>
    </>
  )
}
