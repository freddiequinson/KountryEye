import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  User,
  Users,
  Circle,
  FileText,
  Package,
  X,
  Eye,
  Calendar,
  DollarSign,
  AtSign,
  Reply,
  CornerUpLeft,
  Check,
  CheckCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import GifPicker from '@/components/GifPicker';

interface Conversation {
  id: number;
  is_group: boolean;
  name: string;
  other_user_id: number | null;
  other_user_online: boolean;
  other_user_typing: boolean;
  last_message: {
    content: string;
    sender_id: number;
    created_at: string;
  } | null;
  unread_count: number;
  updated_at: string;
}

interface ReplyInfo {
  id: number;
  sender_name: string;
  content: string;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  message_type: string;
  fund_request_id: number | null;
  product_id: number | null;
  product_name: string | null;
  reply_to_id: number | null;
  reply_to: ReplyInfo | null;
  is_edited: boolean;
  is_delivered: boolean;
  is_read: boolean;
  created_at: string;
}

interface MessageableUser {
  id: number;
  name: string;
  email: string;
  role: string | null;
  branch: string | null;
  avatar_url: string | null;
  is_online: boolean;
}

// Inline Product Card component that fetches product details
function ProductCardInline({ 
  productId, 
  productName, 
  isOwn, 
  onClick 
}: { 
  productId: number; 
  productName: string; 
  isOwn: boolean; 
  onClick: () => void;
}) {
  const { data: product } = useQuery({
    queryKey: ['product-inline', productId],
    queryFn: async () => {
      const res = await api.get(`/sales/products/${productId}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return (
    <div
      className={`my-2 rounded-lg overflow-hidden ${isOwn ? 'bg-primary-foreground/20' : 'bg-background'} cursor-pointer hover:opacity-90 transition-opacity border`}
      onClick={onClick}
    >
      <div className="flex">
        {product?.image_url ? (
          <img 
            src={product.image_url} 
            alt={productName}
            className="w-16 h-16 object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 bg-muted flex items-center justify-center flex-shrink-0">
            <Package className="h-6 w-6 text-green-500" />
          </div>
        )}
        <div className="flex-1 p-2 min-w-0">
          <p className="font-medium text-sm truncate">{productName}</p>
          {product ? (
            <>
              <p className="text-sm text-green-600 font-bold">GH₵{product.unit_price}</p>
              <p className="text-xs opacity-60">{product.category?.name || 'Product'}</p>
            </>
          ) : (
            <>
              <p className="text-xs text-green-600 font-bold">View Product</p>
              <p className="text-xs opacity-60">Tap to see details & price</p>
            </>
          )}
        </div>
        <div className="flex items-center pr-2">
          <Eye className="h-4 w-4 opacity-50" />
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { conversationId } = useParams<{ conversationId?: string }>();
  
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const selectedConversationRef = useRef<Conversation | null>(null);
  const navigate = useNavigate();
  
  // Keep ref in sync with state for WebSocket callbacks
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);
  
  // @ Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionType, setMentionType] = useState<'product' | 'fund-request' | 'visit' | 'patient' | 'user' | null>(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [attachments, setAttachments] = useState<Array<{type: string; id: number; name: string; extra?: any}>>([]);
  
  // Attachment preview modal state
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{type: string; id: number} | null>(null);
  
  // GIF picker easter egg state
  const [showGifPicker, setShowGifPicker] = useState(false);
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  
  const isAdmin = user?.role === 'Admin' || user?.is_superuser;

  // Mention type definitions
  const mentionTypes = [
    { key: 'product', label: 'Product', icon: Package, prefix: '@product:' },
    { key: 'fund-request', label: 'Memo', icon: FileText, prefix: '@fund:' },
    { key: 'visit', label: 'Visit', icon: Eye, prefix: '@visit:' },
    { key: 'patient', label: 'Patient', icon: User, prefix: '@patient:' },
    { key: 'user', label: 'User/Staff', icon: Users, prefix: '@user:' },
  ];

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await api.get('/messaging/conversations');
      return response.data;
    },
    refetchInterval: 5000, // Poll every 5 seconds for new messages
  });

  // Select conversation from URL parameter
  useEffect(() => {
    if (conversationId && conversations.length > 0 && !selectedConversation) {
      const conv = conversations.find((c: Conversation) => c.id === parseInt(conversationId));
      if (conv) {
        setSelectedConversation(conv);
      }
    }
  }, [conversationId, conversations, selectedConversation]);

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const response = await api.get(`/messaging/conversations/${selectedConversation.id}/messages`);
      return response.data;
    },
    enabled: !!selectedConversation,
    refetchInterval: 3000, // Poll every 3 seconds
    staleTime: 0, // Always consider data stale to fetch immediately
    refetchOnMount: 'always', // Always refetch when conversation changes
  });

  // Fetch messageable users
  const { data: messageableUsers = [] } = useQuery({
    queryKey: ['messageable-users', userSearch],
    queryFn: async () => {
      const params = userSearch ? `?search=${encodeURIComponent(userSearch)}` : '';
      const response = await api.get(`/messaging/users/messageable${params}`);
      return response.data;
    },
  });

  // Fetch items for @ mention search (or recent items if no search)
  const { data: mentionResults = [] } = useQuery({
    queryKey: ['mention-search', mentionType, mentionSearch, isAdmin],
    queryFn: async () => {
      if (!mentionType) return [];
      
      const searchTerm = mentionSearch.trim();
      
      switch (mentionType) {
        case 'product':
          // Products: show recent or search results
          const prodUrl = searchTerm 
            ? `/sales/products?search=${encodeURIComponent(searchTerm)}&limit=10`
            : `/sales/products?limit=10`; // Recent products
          const prodRes = await api.get(prodUrl);
          return (prodRes.data.products || prodRes.data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            subtitle: `GH₵${p.selling_price} • ${p.category_name || 'Uncategorized'}`,
            type: 'product',
          }));
        case 'fund-request':
          // Fund requests: admins see all, employees see their own
          const frUrl = isAdmin ? '/fund-requests?limit=10' : '/fund-requests?my_requests=true';
          const frRes = await api.get(frUrl);
          let frData = frRes.data || [];
          if (searchTerm) {
            frData = frData.filter((fr: any) => fr.title.toLowerCase().includes(searchTerm.toLowerCase()));
          }
          return frData.slice(0, 10).map((fr: any) => ({
            id: fr.id,
            name: fr.title,
            subtitle: `GH₵${fr.amount} • ${fr.status} • ${fr.requested_by_name || 'Unknown'}`,
            type: 'fund-request',
          }));
        case 'visit':
          // Visits: show recent or search results
          const visitUrl = searchTerm 
            ? `/patients/visits/search?q=${encodeURIComponent(searchTerm)}&limit=10`
            : `/patients/visits/search?q=&limit=10`; // Recent visits
          const visitRes = await api.get(visitUrl);
          return (visitRes.data || []).map((v: any) => ({
            id: v.id,
            name: `Visit #${v.id} - ${v.patient_name || 'Unknown'}`,
            subtitle: `${v.visit_date} • ${v.status}`,
            type: 'visit',
          }));
        case 'patient':
          // Patients: show recent or search results
          const patUrl = searchTerm 
            ? `/patients?search=${encodeURIComponent(searchTerm)}&limit=10`
            : `/patients?limit=10`; // Recent patients
          const patRes = await api.get(patUrl);
          return (patRes.data.patients || patRes.data || []).map((p: any) => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`,
            subtitle: p.phone || p.email || 'No contact',
            type: 'patient',
          }));
        case 'user':
          // Users: show messageable users
          const userUrl = searchTerm 
            ? `/messaging/users/messageable?search=${encodeURIComponent(searchTerm)}`
            : `/messaging/users/messageable`; // All messageable users
          const userRes = await api.get(userUrl);
          return (userRes.data || []).slice(0, 10).map((u: any) => ({
            id: u.id,
            name: u.name,
            subtitle: `${u.role || 'Staff'}${u.branch ? ` • ${u.branch}` : ''}`,
            type: 'user',
          }));
        default:
          return [];
      }
    },
    enabled: showMentionDropdown && !!mentionType,
  });

  // Fetch attachment details for preview
  const { data: attachmentDetails, isLoading: attachmentLoading } = useQuery({
    queryKey: ['attachment-preview', previewAttachment?.type, previewAttachment?.id],
    queryFn: async () => {
      if (!previewAttachment) return null;
      
      switch (previewAttachment.type) {
        case 'product':
          const prodRes = await api.get(`/sales/products/${previewAttachment.id}`);
          return { type: 'product', data: prodRes.data };
        case 'fund-request':
          const frRes = await api.get(`/fund-requests/${previewAttachment.id}`);
          return { type: 'fund-request', data: frRes.data };
        case 'visit':
          const visitRes = await api.get(`/patients/visits/${previewAttachment.id}`);
          return { type: 'visit', data: visitRes.data };
        case 'patient':
          const patRes = await api.get(`/patients/${previewAttachment.id}`);
          return { type: 'patient', data: patRes.data };
        case 'user':
          const userRes = await api.get(`/users/${previewAttachment.id}`);
          return { type: 'user', data: userRes.data };
        default:
          return null;
      }
    },
    enabled: showAttachmentPreview && !!previewAttachment,
  });

  // Open attachment preview
  const openAttachmentPreview = (type: string, id: number) => {
    setPreviewAttachment({ type, id });
    setShowAttachmentPreview(true);
  };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: number; content: string; messageType?: string; fundRequestId?: number; productId?: number; replyToId?: number }) => {
      const response = await api.post(`/messaging/conversations/${data.conversationId}/messages`, {
        content: data.content,
        message_type: data.messageType || 'text',
        fund_request_id: data.fundRequestId,
        product_id: data.productId,
        reply_to_id: data.replyToId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation?.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setMessageText('');
      setReplyingTo(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    },
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await api.post('/messaging/conversations', {
        participant_ids: [userId],
        is_group: false,
      });
      return response.data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setShowNewChatDialog(false);
      // Find and select the conversation
      const convResponse = await api.get('/messaging/conversations');
      const conv = convResponse.data.find((c: Conversation) => c.id === data.id);
      if (conv) {
        setSelectedConversation(conv);
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to start conversation', variant: 'destructive' });
    },
  });

  // Set up WebSocket connection with reconnection
  useEffect(() => {
    if (!user?.id) return;

    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    const connectWebSocket = () => {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/messaging/ws/${user.id}`;
      
      try {
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
          reconnectAttempts = 0;
          // Refresh conversations to update online status
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['messageable-users'] });
        };
        
        wsRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === 'new_message') {
            queryClient.invalidateQueries({ queryKey: ['messages', data.data.conversation_id] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          } else if (data.type === 'typing') {
            // Use ref to get current selected conversation (avoids stale closure)
            const currentConv = selectedConversationRef.current;
            if (currentConv && data.data.conversation_id === currentConv.id) {
              setOtherTyping(data.data.is_typing);
            }
          } else if (data.type === 'notification') {
            toast({
              title: data.data.title,
              description: data.data.message,
            });
          } else if (data.type === 'user_online' || data.type === 'user_offline') {
            // Update selected conversation's online status immediately
            const currentConv = selectedConversationRef.current;
            if (currentConv && currentConv.other_user_id === data.data.user_id) {
              setSelectedConversation(prev => prev ? {
                ...prev,
                other_user_online: data.data.is_online
              } : null);
            }
            // Refresh conversations to update online status
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
            queryClient.invalidateQueries({ queryKey: ['messageable-users'] });
          } else if (data.type === 'message_read') {
            // Update message read status in real-time
            const currentConv = selectedConversationRef.current;
            if (currentConv && data.data.conversation_id === currentConv.id) {
              queryClient.invalidateQueries({ queryKey: ['messages', currentConv.id] });
            }
          }
        };
        
        wsRef.current.onclose = () => {
          console.log('WebSocket disconnected');
          // Attempt to reconnect
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
            reconnectTimeout = setTimeout(connectWebSocket, delay);
          }
        };
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
      }
    };
    
    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user?.id]);

  // Join conversation when selected and mark messages as read
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedConversation) {
      wsRef.current.send(JSON.stringify({
        type: 'join_conversation',
        conversation_id: selectedConversation.id,
      }));
      
      // Mark messages as read when opening conversation
      api.post(`/messaging/conversations/${selectedConversation.id}/mark-read`).catch(() => {});
    }
  }, [selectedConversation?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when new messages arrive
  useEffect(() => {
    if (selectedConversation && messages.length > 0) {
      const hasUnreadFromOthers = messages.some(
        (m: Message) => m.sender_id !== user?.id && !m.is_read
      );
      if (hasUnreadFromOthers) {
        api.post(`/messaging/conversations/${selectedConversation.id}/mark-read`)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation.id] });
            queryClient.invalidateQueries({ queryKey: ['unread-messages'] });
          })
          .catch(() => {});
      }
    }
  }, [messages, selectedConversation?.id, user?.id]);

  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping && wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedConversation) {
      setIsTyping(true);
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversation_id: selectedConversation.id,
        is_typing: true,
      }));
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedConversation) {
        wsRef.current.send(JSON.stringify({
          type: 'typing',
          conversation_id: selectedConversation.id,
          is_typing: false,
        }));
      }
    }, 2000);
  };

  const handleSendMessage = () => {
    if ((!messageText.trim() && attachments.length === 0) || !selectedConversation) return;
    
    // Build message content with attachment references
    let content = messageText.trim();
    if (attachments.length > 0) {
      const attachmentText = attachments.map(a => `[@${a.type}:${a.id}:${a.name}]`).join(' ');
      content = content ? `${content}\n${attachmentText}` : attachmentText;
    }
    
    // Get first attachment for legacy fields
    const fundRequest = attachments.find(a => a.type === 'fund-request');
    const product = attachments.find(a => a.type === 'product');
    
    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      content: content,
      messageType: attachments.length > 0 ? attachments[0].type : 'text',
      fundRequestId: fundRequest?.id,
      productId: product?.id,
      replyToId: replyingTo?.id,
    });
    
    // Clear after sending
    setAttachments([]);
  };

  // Handle sending a GIF (easter egg)
  const handleSendGif = (gifUrl: string) => {
    if (!selectedConversation) return;
    
    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      content: `[gif:${gifUrl}]`,
      messageType: 'gif',
    });
    
    setShowGifPicker(false);
  };

  const handleViewUserProfile = (userId: number) => {
    if (isAdmin) {
      navigate(`/admin/user-profile/${userId}`);
    }
  };

  // Handle @ mention detection in input
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setMessageText(value);
    handleTyping();
    
    // Easter egg: Check for /gif command
    if (value.trim().toLowerCase() === '/gif') {
      setShowGifPicker(true);
      setMessageText('');
      return;
    }
    
    // Check for @ trigger - match @type:search pattern (allows spaces in search)
    const textBeforeCursor = value.substring(0, cursorPos);
    
    // Match @word or @word:anything pattern
    const atMatch = textBeforeCursor.match(/@(\w+:?[^@]*)$/) || textBeforeCursor.match(/@$/);
    
    if (atMatch) {
      const fullQuery = atMatch[1] || '';
      const queryLower = fullQuery.toLowerCase();
      setMentionStartIndex(cursorPos - atMatch[0].length);
      
      // Check if it matches a type prefix with colon (e.g., @product:search term)
      if (queryLower.startsWith('product:')) {
        setMentionType('product');
        setMentionSearch(fullQuery.substring(8)); // After 'product:'
        setShowMentionDropdown(true);
      } else if (queryLower.startsWith('fund:')) {
        setMentionType('fund-request');
        setMentionSearch(fullQuery.substring(5)); // After 'fund:'
        setShowMentionDropdown(true);
      } else if (queryLower.startsWith('visit:')) {
        setMentionType('visit');
        setMentionSearch(fullQuery.substring(6)); // After 'visit:'
        setShowMentionDropdown(true);
      } else if (queryLower.startsWith('patient:')) {
        setMentionType('patient');
        setMentionSearch(fullQuery.substring(8)); // After 'patient:'
        setShowMentionDropdown(true);
      } else if (queryLower.startsWith('user:')) {
        setMentionType('user');
        setMentionSearch(fullQuery.substring(5)); // After 'user:'
        setShowMentionDropdown(true);
      } else if (queryLower === 'p' || queryLower === 'product') {
        setMentionType('product');
        setMentionSearch('');
        setShowMentionDropdown(true);
      } else if (queryLower === 'f' || queryLower === 'fund') {
        setMentionType('fund-request');
        setMentionSearch('');
        setShowMentionDropdown(true);
      } else if (queryLower === 'v' || queryLower === 'visit') {
        setMentionType('visit');
        setMentionSearch('');
        setShowMentionDropdown(true);
      } else if (queryLower === 'pat' || queryLower === 'patient') {
        setMentionType('patient');
        setMentionSearch('');
        setShowMentionDropdown(true);
      } else if (queryLower === 'u' || queryLower === 'user') {
        setMentionType('user');
        setMentionSearch('');
        setShowMentionDropdown(true);
      } else if (fullQuery === '') {
        // Just @ typed, show type selector
        setMentionType(null);
        setShowMentionDropdown(true);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
      setMentionType(null);
    }
  };

  // Select a mention type
  const selectMentionType = (type: 'product' | 'fund-request' | 'visit' | 'patient' | 'user') => {
    setMentionType(type);
    setMentionSearch('');
    // Update input to show the prefix
    const prefix = mentionTypes.find(m => m.key === type)?.prefix || '@';
    const before = messageText.substring(0, mentionStartIndex);
    const after = messageText.substring(mentionStartIndex + 1);
    setMessageText(before + prefix + after);
    inputRef.current?.focus();
  };

  // Select a mention result
  const selectMentionResult = (item: {id: number; name: string; type: string; subtitle?: string}) => {
    // Add to attachments
    setAttachments(prev => [...prev, { type: item.type, id: item.id, name: item.name }]);
    
    // Remove the @mention text from input
    const before = messageText.substring(0, mentionStartIndex);
    setMessageText(before);
    
    setShowMentionDropdown(false);
    setMentionType(null);
    setMentionSearch('');
    inputRef.current?.focus();
  };

  // Remove an attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Get icon for attachment type
  const getAttachmentIcon = (type: string) => {
    switch (type) {
      case 'product': return <Package className="h-4 w-4 text-green-500" />;
      case 'fund-request': return <FileText className="h-4 w-4 text-blue-500" />;
      case 'visit': return <Eye className="h-4 w-4 text-purple-500" />;
      case 'patient': return <User className="h-4 w-4 text-orange-500" />;
      case 'user': return <Users className="h-4 w-4 text-indigo-500" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  // Render a rich product card for inline display - uses cached product data
  const renderProductCard = (id: number, name: string, isOwn: boolean, key: string) => {
    // We'll use a simple approach - show the card and fetch details on click
    // For inline display, we show a nice card with the product name
    return (
      <ProductCardInline 
        key={key}
        productId={id} 
        productName={name} 
        isOwn={isOwn} 
        onClick={() => openAttachmentPreview('product', id)} 
      />
    );
  };

  // Render a rich user card for inline display
  const renderUserCard = (id: number, name: string, isOwn: boolean, key: string) => {
    return (
      <div
        key={key}
        className={`my-2 rounded-lg overflow-hidden ${isOwn ? 'bg-primary-foreground/20' : 'bg-background'} cursor-pointer hover:opacity-90 transition-opacity border`}
        onClick={() => openAttachmentPreview('user', id)}
      >
        <div className="flex items-center p-2 gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-indigo-100 text-indigo-600">
              {name.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{name}</p>
            <p className="text-xs opacity-60">Tap to view profile or message</p>
          </div>
          <MessageSquare className="h-4 w-4 opacity-50" />
        </div>
      </div>
    );
  };

  // Parse message content and render inline attachment references as clickable cards
  const renderMessageContent = (content: string, isOwn: boolean) => {
    // Check for GIF message (easter egg)
    const gifMatch = content.match(/^\[gif:(https?:\/\/[^\]]+)\]$/);
    if (gifMatch) {
      return (
        <div className="max-w-xs">
          <img 
            src={gifMatch[1]} 
            alt="GIF" 
            className="rounded-lg max-w-full h-auto"
            loading="lazy"
          />
        </div>
      );
    }
    
    // Regex to match [@type:id:name] pattern
    const attachmentRegex = /\[@([\w-]+):(\d+):([^\]]+)\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let hasOnlyProductAttachment = false;

    // Check if message is ONLY a product attachment (no other text)
    const trimmedContent = content.trim();
    const singleProductMatch = trimmedContent.match(/^\[@product:(\d+):([^\]]+)\]$/);
    const singleUserMatch = trimmedContent.match(/^\[@user:(\d+):([^\]]+)\]$/);
    
    if (singleProductMatch) {
      // Render as rich product card
      return renderProductCard(parseInt(singleProductMatch[1], 10), singleProductMatch[2], isOwn, 'product-card');
    }
    
    if (singleUserMatch) {
      // Render as rich user card
      return renderUserCard(parseInt(singleUserMatch[1], 10), singleUserMatch[2], isOwn, 'user-card');
    }

    while ((match = attachmentRegex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        if (textBefore.trim()) {
          parts.push(<span key={`text-${lastIndex}`} className="whitespace-pre-wrap">{textBefore}</span>);
        }
      }

      const [fullMatch, type, idStr, name] = match;
      const id = parseInt(idStr, 10);

      // Render as clickable card (compact version for mixed content)
      parts.push(
        <div
          key={`attachment-${match.index}`}
          className={`my-1 p-2 rounded ${isOwn ? 'bg-primary-foreground/20' : 'bg-background/50'} flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity`}
          onClick={() => openAttachmentPreview(type, id)}
        >
          {getAttachmentIcon(type)}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs opacity-70 ml-2 capitalize">{type.replace('-', ' ')}</span>
          </div>
          <Eye className="h-3 w-3 opacity-50" />
        </div>
      );

      lastIndex = match.index + fullMatch.length;
    }

    // Add remaining text after last match
    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex);
      if (remainingText.trim()) {
        parts.push(<span key={`text-${lastIndex}`} className="whitespace-pre-wrap">{remainingText}</span>);
      }
    }

    // If no attachments found, just return the content as-is
    if (parts.length === 0) {
      return <p className="whitespace-pre-wrap">{content}</p>;
    }

    return <div>{parts}</div>;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // Easter egg: Check for /gif command before sending
      if (messageText.trim().toLowerCase() === '/gif') {
        setShowGifPicker(true);
        setMessageText('');
        return;
      }
      
      handleSendMessage();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-GB', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Conversations List */}
      <Card className="w-80 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Messages</h2>
            <Button size="sm" variant="outline" onClick={() => setShowNewChatDialog(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search conversations..." className="pl-9" />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No conversations yet</p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setShowNewChatDialog(true)}
              >
                Start a new chat
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((conv: Conversation) => (
                <div
                  key={conv.id}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => setSelectedConversation(conv)}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar>
                        <AvatarFallback>{getInitials(conv.name)}</AvatarFallback>
                      </Avatar>
                      {conv.other_user_online && (
                        <Circle className="absolute bottom-0 right-0 h-3 w-3 fill-green-500 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{conv.name}</p>
                        {conv.last_message && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(conv.last_message.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.other_user_typing ? (
                            <span className="text-blue-500 italic">typing...</span>
                          ) : conv.last_message ? (
                            conv.last_message.content
                          ) : (
                            'No messages yet'
                          )}
                        </p>
                        {conv.unread_count > 0 && (
                          <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar 
                  className={isAdmin && selectedConversation.other_user_id ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''}
                  onClick={() => {
                    if (isAdmin && selectedConversation.other_user_id) {
                      handleViewUserProfile(selectedConversation.other_user_id);
                    }
                  }}
                >
                  <AvatarFallback>{getInitials(selectedConversation.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p 
                    className={`font-medium ${isAdmin && selectedConversation.other_user_id ? 'cursor-pointer hover:underline' : ''}`}
                    onClick={() => {
                      if (isAdmin && selectedConversation.other_user_id) {
                        handleViewUserProfile(selectedConversation.other_user_id);
                      }
                    }}
                  >
                    {selectedConversation.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {otherTyping ? (
                      <span className="text-blue-500">typing...</span>
                    ) : selectedConversation.other_user_online ? (
                      <span className="text-green-500">Online</span>
                    ) : (
                      'Offline'
                    )}
                    {isAdmin && selectedConversation.other_user_id && (
                      <span className="ml-2 text-primary cursor-pointer hover:underline" onClick={() => handleViewUserProfile(selectedConversation.other_user_id!)}>
                        View Profile
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="text-center text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg: Message) => {
                    const isOwn = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}
                      >
                        <div className={`flex items-end gap-1 max-w-[70%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                          <div
                            className={`rounded-lg p-3 ${
                              isOwn
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {/* Reply preview if this is a reply */}
                            {msg.reply_to && (
                              <div 
                                className={`mb-2 p-2 rounded border-l-2 ${
                                  isOwn 
                                    ? 'bg-primary-foreground/10 border-primary-foreground/50' 
                                    : 'bg-background/50 border-muted-foreground/50'
                                }`}
                              >
                                <p className={`text-xs font-medium ${isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                  <CornerUpLeft className="h-3 w-3 inline mr-1" />
                                  {msg.reply_to.sender_name}
                                </p>
                                <p className={`text-xs truncate ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground/80'}`}>
                                  {msg.reply_to.content}
                                </p>
                              </div>
                            )}
                            {!isOwn && (
                              <p className="text-xs font-medium mb-1 opacity-70">
                                {msg.sender_name}
                              </p>
                            )}
                            {/* Render message content with inline attachment cards */}
                            {renderMessageContent(msg.content, isOwn)}
                            
                            <div className={`flex items-center gap-1 text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              <span>{formatTime(msg.created_at)}</span>
                              {isOwn && (
                                <span title={msg.is_read ? "Read" : msg.is_delivered ? "Delivered" : "Sent"}>
                                  {msg.is_read ? (
                                    <CheckCheck className="h-3 w-3 text-blue-400" />
                                  ) : msg.is_delivered ? (
                                    <CheckCheck className="h-3 w-3" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Reply button */}
                          <button
                            onClick={() => setReplyingTo(msg)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                            title="Reply"
                          >
                            <Reply className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t relative">
              {/* Reply preview bar */}
              {replyingTo && (
                <div className="mb-2 p-2 bg-muted rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <CornerUpLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        Replying to {replyingTo.sender_name}
                      </p>
                      <p className="text-sm truncate">{replyingTo.content}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setReplyingTo(null)} 
                    className="p-1 hover:bg-background rounded flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              
              {/* Show attachments */}
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm">
                      {getAttachmentIcon(att.type)}
                      <span className="max-w-32 truncate">{att.name}</span>
                      <button onClick={() => removeAttachment(idx)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* @ Mention Dropdown */}
              {showMentionDropdown && (
                <div className="absolute bottom-full left-4 right-4 mb-2 bg-background border rounded-lg shadow-lg max-h-64 overflow-auto z-50">
                  {!mentionType ? (
                    // Show type selector
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground px-2 py-1">Select what to reference:</p>
                      {mentionTypes.map((type) => (
                        <div
                          key={type.key}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded cursor-pointer"
                          onClick={() => selectMentionType(type.key as any)}
                        >
                          <type.icon className="h-4 w-4" />
                          <span>{type.label}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{type.prefix}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Show search results or recent items
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground px-2 py-1">
                        {mentionSearch.trim() 
                          ? `Searching ${mentionType}s: "${mentionSearch}"` 
                          : `Recent ${mentionType}s (type to search)`}
                      </p>
                      {mentionResults.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-3 py-2">
                          {mentionSearch.trim() ? 'No results found' : 'No recent items'}
                        </p>
                      ) : (
                        mentionResults.map((item: any) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded cursor-pointer"
                            onClick={() => selectMentionResult(item)}
                          >
                            {getAttachmentIcon(item.type)}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="relative flex items-center gap-2">
                {/* GIF Picker (Easter Egg) */}
                {showGifPicker && (
                  <GifPicker 
                    onSelect={handleSendGif} 
                    onClose={() => setShowGifPicker(false)} 
                  />
                )}
                
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    value={messageText}
                    onChange={handleMessageInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder="Type @ to reference items..."
                    className="pr-10"
                  />
                  <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={(!messageText.trim() && attachments.length === 0) || sendMessageMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Type <code className="bg-muted px-1 rounded">@</code> to reference products, memos, visits, or patients
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select a conversation to start messaging</p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setShowNewChatDialog(true)}
              >
                Or start a new chat
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* New Chat Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users..."
                className="pl-9"
              />
            </div>
            
            <ScrollArea className="h-64">
              {messageableUsers.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No users found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messageableUsers.map((u: MessageableUser) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => createConversationMutation.mutate(u.id)}
                    >
                      <div className="relative">
                        <Avatar>
                          <AvatarFallback>{getInitials(u.name)}</AvatarFallback>
                        </Avatar>
                        {u.is_online && (
                          <Circle className="absolute bottom-0 right-0 h-3 w-3 fill-green-500 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{u.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {u.role} {u.branch && `• ${u.branch}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attachment Preview Modal */}
      <Dialog open={showAttachmentPreview} onOpenChange={setShowAttachmentPreview}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewAttachment && getAttachmentIcon(previewAttachment.type)}
              {previewAttachment?.type === 'product' && 'Product Details'}
              {previewAttachment?.type === 'fund-request' && 'Memo Details'}
              {previewAttachment?.type === 'visit' && 'Visit Details'}
              {previewAttachment?.type === 'patient' && 'Patient Details'}
              {previewAttachment?.type === 'user' && 'User Details'}
            </DialogTitle>
          </DialogHeader>
          
          {attachmentLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : attachmentDetails ? (
            <div className="space-y-4">
              {/* Product Preview */}
              {attachmentDetails.type === 'product' && (
                <div className="space-y-3">
                  <div className="bg-muted p-4 rounded-lg flex gap-4">
                    {attachmentDetails.data.image_url ? (
                      <img 
                        src={attachmentDetails.data.image_url} 
                        alt={attachmentDetails.data.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-background rounded-lg flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{attachmentDetails.data.name}</h3>
                      <p className="text-2xl font-bold text-green-600">
                        GH₵{attachmentDetails.data.unit_price || attachmentDetails.data.selling_price || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {attachmentDetails.data.category?.name || 'Uncategorized'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Category</p>
                      <p className="font-medium">{attachmentDetails.data.category?.name || 'Uncategorized'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">SKU</p>
                      <p className="font-medium">{attachmentDetails.data.sku || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cost Price</p>
                      <p className="font-medium">GH₵{attachmentDetails.data.cost_price || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Prescription</p>
                      <p className="font-medium">{attachmentDetails.data.requires_prescription ? 'Required' : 'Not Required'}</p>
                    </div>
                  </div>
                  {attachmentDetails.data.description && (
                    <div>
                      <p className="text-muted-foreground text-sm">Description</p>
                      <p className="text-sm">{attachmentDetails.data.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Fund Request Preview */}
              {attachmentDetails.type === 'fund-request' && (
                <div className="space-y-3">
                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="font-bold text-lg">{attachmentDetails.data.title}</h3>
                    <p className="text-2xl font-bold text-blue-600">
                      GH₵{attachmentDetails.data.amount}
                    </p>
                    <Badge className="mt-2">{attachmentDetails.data.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Requested By</p>
                      <p className="font-medium">{attachmentDetails.data.requested_by_name || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Purpose</p>
                      <p className="font-medium">{attachmentDetails.data.purpose || 'Other'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">{new Date(attachmentDetails.data.created_at).toLocaleDateString()}</p>
                    </div>
                    {attachmentDetails.data.disbursement_method && (
                      <div>
                        <p className="text-muted-foreground">Disbursement</p>
                        <p className="font-medium capitalize">{attachmentDetails.data.disbursement_method}</p>
                      </div>
                    )}
                  </div>
                  {attachmentDetails.data.description && (
                    <div>
                      <p className="text-muted-foreground text-sm">Description</p>
                      <p className="text-sm">{attachmentDetails.data.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Visit Preview */}
              {attachmentDetails.type === 'visit' && (
                <div className="space-y-3">
                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="font-bold text-lg">Visit #{attachmentDetails.data.id}</h3>
                    <p className="text-muted-foreground">
                      {attachmentDetails.data.patient_name || 'Unknown Patient'}
                    </p>
                    <Badge className="mt-2">{attachmentDetails.data.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Visit Date</p>
                      <p className="font-medium">{attachmentDetails.data.visit_date || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Payment Status</p>
                      <p className="font-medium capitalize">{attachmentDetails.data.payment_status || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Amount Paid</p>
                      <p className="font-medium">GH₵{attachmentDetails.data.amount_paid || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Payment Type</p>
                      <p className="font-medium capitalize">{attachmentDetails.data.payment_type || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Patient Preview */}
              {attachmentDetails.type === 'patient' && (
                <div className="space-y-3">
                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="font-bold text-lg">
                      {attachmentDetails.data.first_name} {attachmentDetails.data.last_name}
                    </h3>
                    <p className="text-muted-foreground">{attachmentDetails.data.patient_number}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{attachmentDetails.data.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{attachmentDetails.data.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Gender</p>
                      <p className="font-medium capitalize">{attachmentDetails.data.gender || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">{attachmentDetails.data.date_of_birth || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* User Preview */}
              {attachmentDetails.type === 'user' && (
                <div className="space-y-3">
                  <div className="bg-muted p-4 rounded-lg flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="text-xl">
                        {attachmentDetails.data.first_name?.[0]}{attachmentDetails.data.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-lg">
                        {attachmentDetails.data.first_name} {attachmentDetails.data.last_name}
                      </h3>
                      <p className="text-muted-foreground">{attachmentDetails.data.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Role</p>
                      <p className="font-medium">{attachmentDetails.data.role_name || 'Staff'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Branch</p>
                      <p className="font-medium">{attachmentDetails.data.branch_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{attachmentDetails.data.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-medium">{attachmentDetails.data.is_active ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Could not load details
            </div>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAttachmentPreview(false)}>
              Close
            </Button>
            
            {/* User actions - Send Message */}
            {previewAttachment?.type === 'user' && previewAttachment.id !== user?.id && (
              <Button onClick={() => {
                // Start a conversation with this user
                createConversationMutation.mutate(previewAttachment.id);
                setShowAttachmentPreview(false);
              }}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Send Message
              </Button>
            )}
            {previewAttachment?.type === 'user' && isAdmin && (
              <Button variant="secondary" onClick={() => {
                navigate(`/admin/user-profile/${previewAttachment.id}`);
                setShowAttachmentPreview(false);
              }}>
                View Full Profile
              </Button>
            )}
            
            {/* Patient actions */}
            {previewAttachment?.type === 'patient' && (
              <Button onClick={() => {
                navigate(`/patients/${previewAttachment.id}`);
                setShowAttachmentPreview(false);
              }}>
                View Full Profile
              </Button>
            )}
            
            {/* Fund request actions */}
            {previewAttachment?.type === 'fund-request' && (
              <Button onClick={() => {
                navigate('/fund-requests');
                setShowAttachmentPreview(false);
              }}>
                Go to Memos
              </Button>
            )}
            
            {/* Visit actions */}
            {previewAttachment?.type === 'visit' && attachmentDetails?.data?.patient_id && (
              <Button onClick={() => {
                navigate(`/patients/${attachmentDetails.data.patient_id}`);
                setShowAttachmentPreview(false);
              }}>
                View Patient
              </Button>
            )}
            
            {/* Product actions */}
            {previewAttachment?.type === 'product' && (
              <Button onClick={() => {
                navigate('/inventory/products');
                setShowAttachmentPreview(false);
              }}>
                Go to Inventory
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
