from typing import List, Optional, Dict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from pydantic import BaseModel
import json

from app.core.database import get_db, async_session_maker
from app.api.v1.deps import get_current_active_user
from app.models.user import User, Role
from app.models.communication import Conversation, ConversationParticipant, Message, Notification, MessageReadReceipt
from app.models.sales import Product
from app.models.branch import Branch

router = APIRouter()


# ============ CONNECTION MANAGER FOR WEBSOCKET ============

class ConnectionManager:
    """Manages WebSocket connections for real-time messaging"""
    
    def __init__(self):
        # Map of user_id -> WebSocket connection
        self.active_connections: Dict[int, WebSocket] = {}
        # Map of user_id -> set of conversation_ids they're viewing
        self.user_conversations: Dict[int, set] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_conversations[user_id] = set()
        # Broadcast online status to all connected users
        await self.broadcast_online_status(user_id, True)
    
    async def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_conversations:
            del self.user_conversations[user_id]
        # Broadcast offline status to all connected users
        await self.broadcast_online_status(user_id, False)
    
    async def broadcast_online_status(self, user_id: int, is_online: bool):
        """Broadcast user online/offline status to all connected users"""
        status_msg = {
            "type": "user_online" if is_online else "user_offline",
            "data": {
                "user_id": user_id,
                "is_online": is_online
            }
        }
        for uid in list(self.active_connections.keys()):
            if uid != user_id:
                await self.send_personal_message(uid, status_msg)
    
    def set_viewing_conversation(self, user_id: int, conversation_id: int):
        if user_id in self.user_conversations:
            self.user_conversations[user_id].add(conversation_id)
    
    def stop_viewing_conversation(self, user_id: int, conversation_id: int):
        if user_id in self.user_conversations:
            self.user_conversations[user_id].discard(conversation_id)
    
    async def send_personal_message(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except:
                pass
    
    async def broadcast_to_conversation(self, conversation_id: int, message: dict, exclude_user: int = None):
        """Send message to all users in a conversation"""
        for user_id, conversations in self.user_conversations.items():
            if conversation_id in conversations and user_id != exclude_user:
                await self.send_personal_message(user_id, message)
    
    def is_user_online(self, user_id: int) -> bool:
        return user_id in self.active_connections


manager = ConnectionManager()


# ============ SCHEMAS ============

class ConversationCreate(BaseModel):
    participant_ids: List[int]
    name: Optional[str] = None
    is_group: bool = False


class MessageCreate(BaseModel):
    content: str
    message_type: str = "text"
    fund_request_id: Optional[int] = None
    product_id: Optional[int] = None
    reply_to_id: Optional[int] = None


class ReplyInfo(BaseModel):
    id: int
    sender_name: str
    content: str

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_name: str
    content: str
    message_type: str
    fund_request_id: Optional[int]
    product_id: Optional[int]
    product_name: Optional[str] = None
    reply_to_id: Optional[int] = None
    reply_to: Optional[ReplyInfo] = None
    is_edited: bool
    is_delivered: bool = False
    is_read: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# ============ HELPER FUNCTIONS ============

async def can_message_user(db: AsyncSession, sender: User, recipient_id: int) -> bool:
    """Check if sender can message recipient based on rules:
    - Admin can message anyone
    - Employees can message admin or people in their branch
    """
    # Check if sender is admin
    is_admin = sender.is_superuser
    if sender.role_id:
        role_result = await db.execute(select(Role).where(Role.id == sender.role_id))
        role = role_result.scalar_one_or_none()
        if role and role.name == "Admin":
            is_admin = True
    
    if is_admin:
        return True
    
    # Get recipient
    recipient_result = await db.execute(select(User).where(User.id == recipient_id))
    recipient = recipient_result.scalar_one_or_none()
    
    if not recipient:
        return False
    
    # Check if recipient is admin
    if recipient.is_superuser:
        return True
    if recipient.role_id:
        role_result = await db.execute(select(Role).where(Role.id == recipient.role_id))
        role = role_result.scalar_one_or_none()
        if role and role.name == "Admin":
            return True
    
    # Check if same branch
    if sender.branch_id and sender.branch_id == recipient.branch_id:
        return True
    
    return False


async def get_or_create_conversation(db: AsyncSession, user1_id: int, user2_id: int) -> Conversation:
    """Get existing 1-on-1 conversation or create new one"""
    # Find existing conversation between these two users
    result = await db.execute(
        select(Conversation)
        .join(ConversationParticipant)
        .where(and_(
            Conversation.is_group == False,
            ConversationParticipant.user_id.in_([user1_id, user2_id])
        ))
        .group_by(Conversation.id)
        .having(func.count(ConversationParticipant.id) == 2)
    )
    
    conversations = result.scalars().all()
    
    # Check if both users are in any of these conversations
    for conv in conversations:
        participants_result = await db.execute(
            select(ConversationParticipant.user_id)
            .where(ConversationParticipant.conversation_id == conv.id)
        )
        participant_ids = [p[0] for p in participants_result.all()]
        if set(participant_ids) == {user1_id, user2_id}:
            return conv
    
    # Create new conversation
    conversation = Conversation(is_group=False)
    db.add(conversation)
    await db.flush()
    
    # Add participants
    for user_id in [user1_id, user2_id]:
        participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user_id
        )
        db.add(participant)
    
    await db.commit()
    await db.refresh(conversation)
    
    return conversation


async def create_message_notification(db: AsyncSession, sender: User, recipient_id: int, conversation_id: int, message_preview: str):
    """Create notification for new message"""
    notification = Notification(
        user_id=recipient_id,
        title=f"New message from {sender.first_name}",
        message=message_preview[:100] + "..." if len(message_preview) > 100 else message_preview,
        notification_type="message",
        reference_type="conversation",
        reference_id=conversation_id,
        action_url=f"/messages/{conversation_id}"
    )
    db.add(notification)


# ============ REST ENDPOINTS ============

@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get total unread message count for current user"""
    # Get all conversations where user is a participant
    conversations_result = await db.execute(
        select(ConversationParticipant)
        .where(ConversationParticipant.user_id == current_user.id)
    )
    participants = conversations_result.scalars().all()
    
    total_unread = 0
    for p in participants:
        if p.last_read_at:
            unread_result = await db.execute(
                select(func.count(Message.id))
                .where(and_(
                    Message.conversation_id == p.conversation_id,
                    Message.created_at > p.last_read_at,
                    Message.sender_id != current_user.id
                ))
            )
        else:
            unread_result = await db.execute(
                select(func.count(Message.id))
                .where(and_(
                    Message.conversation_id == p.conversation_id,
                    Message.sender_id != current_user.id
                ))
            )
        total_unread += unread_result.scalar() or 0
    
    return {"unread_count": total_unread}

@router.get("/conversations")
async def get_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all conversations for current user"""
    # Get conversations where user is a participant
    result = await db.execute(
        select(Conversation)
        .join(ConversationParticipant)
        .where(ConversationParticipant.user_id == current_user.id)
        .order_by(desc(Conversation.updated_at))
    )
    conversations = result.scalars().all()
    
    response = []
    for conv in conversations:
        # Get participants
        participants_result = await db.execute(
            select(ConversationParticipant, User)
            .join(User, User.id == ConversationParticipant.user_id)
            .where(ConversationParticipant.conversation_id == conv.id)
        )
        participants = participants_result.all()
        
        # Get other participant for 1-on-1 chats
        other_user = None
        for p, u in participants:
            if u.id != current_user.id:
                other_user = u
                break
        
        # Get last message
        last_msg_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(desc(Message.created_at))
            .limit(1)
        )
        last_message = last_msg_result.scalar_one_or_none()
        
        # Get unread count
        my_participant = next((p for p, u in participants if u.id == current_user.id), None)
        unread_count = 0
        if my_participant and my_participant.last_read_at:
            unread_result = await db.execute(
                select(func.count(Message.id))
                .where(and_(
                    Message.conversation_id == conv.id,
                    Message.created_at > my_participant.last_read_at,
                    Message.sender_id != current_user.id
                ))
            )
            unread_count = unread_result.scalar() or 0
        elif my_participant:
            unread_result = await db.execute(
                select(func.count(Message.id))
                .where(and_(
                    Message.conversation_id == conv.id,
                    Message.sender_id != current_user.id
                ))
            )
            unread_count = unread_result.scalar() or 0
        
        # Check if other user is typing
        other_typing = False
        for p, u in participants:
            if u.id != current_user.id and p.is_typing:
                # Check if typing indicator is recent (within 5 seconds)
                if p.typing_updated_at and (datetime.utcnow() - p.typing_updated_at).seconds < 5:
                    other_typing = True
                    break
        
        response.append({
            "id": conv.id,
            "is_group": conv.is_group,
            "name": conv.name or (f"{other_user.first_name} {other_user.last_name}" if other_user else "Unknown"),
            "other_user_id": other_user.id if other_user else None,
            "other_user_online": manager.is_user_online(other_user.id) if other_user else False,
            "other_user_typing": other_typing,
            "last_message": {
                "content": last_message.content if last_message else None,
                "sender_id": last_message.sender_id if last_message else None,
                "created_at": last_message.created_at.isoformat() if last_message else None
            } if last_message else None,
            "unread_count": unread_count,
            "updated_at": conv.updated_at.isoformat()
        })
    
    return response


@router.post("/conversations")
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new conversation"""
    # Validate participants
    for user_id in data.participant_ids:
        if user_id == current_user.id:
            continue
        if not await can_message_user(db, current_user, user_id):
            raise HTTPException(status_code=403, detail=f"Cannot message user {user_id}")
    
    # For 1-on-1, check if conversation already exists
    if not data.is_group and len(data.participant_ids) == 1:
        conversation = await get_or_create_conversation(db, current_user.id, data.participant_ids[0])
        return {"id": conversation.id, "is_new": False}
    
    # Create group conversation
    conversation = Conversation(
        is_group=data.is_group,
        name=data.name
    )
    db.add(conversation)
    await db.flush()
    
    # Add current user as participant
    all_participants = set(data.participant_ids)
    all_participants.add(current_user.id)
    
    for user_id in all_participants:
        participant = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user_id
        )
        db.add(participant)
    
    await db.commit()
    
    return {"id": conversation.id, "is_new": True}


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: int,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get messages in a conversation"""
    # Verify user is participant
    participant_result = await db.execute(
        select(ConversationParticipant)
        .where(and_(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        ))
    )
    participant = participant_result.scalar_one_or_none()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")
    
    # Update last read
    participant.last_read_at = datetime.utcnow()
    
    # Get messages
    result = await db.execute(
        select(Message)
        .where(and_(
            Message.conversation_id == conversation_id,
            Message.is_deleted == False
        ))
        .order_by(desc(Message.created_at))
        .offset(skip)
        .limit(limit)
    )
    messages = result.scalars().all()
    
    response = []
    for msg in reversed(messages):  # Reverse to get chronological order
        # Get sender info
        sender_result = await db.execute(select(User).where(User.id == msg.sender_id))
        sender = sender_result.scalar_one_or_none()
        
        # Get product info if attached
        product_name = None
        if msg.product_id:
            product_result = await db.execute(select(Product).where(Product.id == msg.product_id))
            product = product_result.scalar_one_or_none()
            if product:
                product_name = product.name
        
        # Get reply-to info if this is a reply
        reply_to_info = None
        if msg.reply_to_id:
            reply_result = await db.execute(select(Message).where(Message.id == msg.reply_to_id))
            reply_msg = reply_result.scalar_one_or_none()
            if reply_msg:
                reply_sender_result = await db.execute(select(User).where(User.id == reply_msg.sender_id))
                reply_sender = reply_sender_result.scalar_one_or_none()
                reply_to_info = {
                    "id": reply_msg.id,
                    "sender_name": f"{reply_sender.first_name} {reply_sender.last_name}" if reply_sender else "Unknown",
                    "content": reply_msg.content[:100] + "..." if len(reply_msg.content) > 100 else reply_msg.content
                }
        
        # Get read receipt status for sender's own messages
        is_delivered = False
        is_read = False
        if msg.sender_id == current_user.id:
            # Check if any other participant has received/read this message
            receipt_result = await db.execute(
                select(MessageReadReceipt)
                .where(and_(
                    MessageReadReceipt.message_id == msg.id,
                    MessageReadReceipt.user_id != current_user.id
                ))
            )
            receipts = receipt_result.scalars().all()
            if receipts:
                is_delivered = any(r.delivered_at for r in receipts)
                is_read = any(r.read_at for r in receipts)
        
        response.append({
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "sender_id": msg.sender_id,
            "sender_name": f"{sender.first_name} {sender.last_name}" if sender else "Unknown",
            "content": msg.content,
            "message_type": msg.message_type,
            "fund_request_id": msg.fund_request_id,
            "product_id": msg.product_id,
            "product_name": product_name,
            "reply_to_id": msg.reply_to_id,
            "reply_to": reply_to_info,
            "is_edited": msg.is_edited,
            "is_delivered": is_delivered,
            "is_read": is_read,
            "created_at": msg.created_at.isoformat()
        })
    
    await db.commit()
    
    return response


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: int,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Send a message in a conversation"""
    # Verify user is participant
    participant_result = await db.execute(
        select(ConversationParticipant)
        .where(and_(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        ))
    )
    participant = participant_result.scalar_one_or_none()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")
    
    # Create message
    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=data.content,
        message_type=data.message_type,
        fund_request_id=data.fund_request_id,
        product_id=data.product_id,
        reply_to_id=data.reply_to_id
    )
    db.add(message)
    
    # Update conversation timestamp
    conv_result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conversation = conv_result.scalar_one_or_none()
    if conversation:
        conversation.updated_at = datetime.utcnow()
    
    # Get product name if attached
    product_name = None
    if data.product_id:
        product_result = await db.execute(select(Product).where(Product.id == data.product_id))
        product = product_result.scalar_one_or_none()
        if product:
            product_name = product.name
    
    await db.flush()
    
    # Create notifications for other participants
    all_participants_result = await db.execute(
        select(ConversationParticipant)
        .where(ConversationParticipant.conversation_id == conversation_id)
    )
    all_participants = all_participants_result.scalars().all()
    
    for p in all_participants:
        if p.user_id != current_user.id and not p.is_muted:
            await create_message_notification(db, current_user, p.user_id, conversation_id, data.content)
    
    await db.commit()
    
    # Get reply-to info if this is a reply
    reply_to_info = None
    if data.reply_to_id:
        reply_result = await db.execute(select(Message).where(Message.id == data.reply_to_id))
        reply_msg = reply_result.scalar_one_or_none()
        if reply_msg:
            reply_sender_result = await db.execute(select(User).where(User.id == reply_msg.sender_id))
            reply_sender = reply_sender_result.scalar_one_or_none()
            reply_to_info = {
                "id": reply_msg.id,
                "sender_name": f"{reply_sender.first_name} {reply_sender.last_name}" if reply_sender else "Unknown",
                "content": reply_msg.content[:100] + "..." if len(reply_msg.content) > 100 else reply_msg.content
            }
    
    # Prepare message for WebSocket broadcast
    ws_message = {
        "type": "new_message",
        "data": {
            "id": message.id,
            "conversation_id": conversation_id,
            "sender_id": current_user.id,
            "sender_name": f"{current_user.first_name} {current_user.last_name}",
            "content": data.content,
            "message_type": data.message_type,
            "fund_request_id": data.fund_request_id,
            "product_id": data.product_id,
            "product_name": product_name,
            "reply_to_id": data.reply_to_id,
            "reply_to": reply_to_info,
            "is_edited": False,
            "created_at": message.created_at.isoformat()
        }
    }
    
    # Broadcast to all participants viewing this conversation
    await manager.broadcast_to_conversation(conversation_id, ws_message, exclude_user=current_user.id)
    
    # Also send notification to participants not viewing the conversation
    for p in all_participants:
        if p.user_id != current_user.id:
            notification_msg = {
                "type": "notification",
                "data": {
                    "title": f"New message from {current_user.first_name}",
                    "message": data.content[:50] + "..." if len(data.content) > 50 else data.content,
                    "conversation_id": conversation_id
                }
            }
            await manager.send_personal_message(p.user_id, notification_msg)
    
    return {
        "id": message.id,
        "conversation_id": conversation_id,
        "sender_id": current_user.id,
        "sender_name": f"{current_user.first_name} {current_user.last_name}",
        "content": data.content,
        "message_type": data.message_type,
        "fund_request_id": data.fund_request_id,
        "product_id": data.product_id,
        "product_name": product_name,
        "reply_to_id": data.reply_to_id,
        "reply_to": reply_to_info,
        "is_edited": False,
        "is_delivered": False,
        "is_read": False,
        "created_at": message.created_at.isoformat()
    }


class MessageUpdate(BaseModel):
    content: str


@router.put("/messages/{message_id}")
async def edit_message(
    message_id: int,
    data: MessageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Edit a message (only sender or admin can edit)"""
    # Get the message
    result = await db.execute(select(Message).where(Message.id == message_id))
    message = result.scalar_one_or_none()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Check if user is admin
    is_admin = current_user.is_superuser
    if not is_admin and current_user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == current_user.role_id))
        role = role_result.scalar_one_or_none()
        if role and role.name.lower() == "admin":
            is_admin = True
    
    # Only sender or admin can edit
    if message.sender_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    
    # Update message
    message.content = data.content
    message.is_edited = True
    message.edited_at = datetime.utcnow()
    
    await db.commit()
    
    # Broadcast edit to conversation participants
    ws_message = {
        "type": "message_edited",
        "data": {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "content": data.content,
            "is_edited": True,
            "edited_at": message.edited_at.isoformat()
        }
    }
    await manager.broadcast_to_conversation(message.conversation_id, ws_message)
    
    return {"success": True, "message": "Message updated"}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a message (only sender or admin can delete)"""
    # Get the message
    result = await db.execute(select(Message).where(Message.id == message_id))
    message = result.scalar_one_or_none()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Check if user is admin
    is_admin = current_user.is_superuser
    if not is_admin and current_user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == current_user.role_id))
        role = role_result.scalar_one_or_none()
        if role and role.name.lower() == "admin":
            is_admin = True
    
    # Only sender or admin can delete
    if message.sender_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    
    # Soft delete
    message.is_deleted = True
    conversation_id = message.conversation_id
    
    await db.commit()
    
    # Broadcast deletion to conversation participants
    ws_message = {
        "type": "message_deleted",
        "data": {
            "id": message.id,
            "conversation_id": conversation_id
        }
    }
    await manager.broadcast_to_conversation(conversation_id, ws_message)
    
    return {"success": True, "message": "Message deleted"}


@router.post("/conversations/{conversation_id}/mark-read")
async def mark_messages_read(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mark all messages in a conversation as read by current user"""
    # Verify user is participant
    participant_result = await db.execute(
        select(ConversationParticipant)
        .where(and_(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        ))
    )
    participant = participant_result.scalar_one_or_none()
    
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")
    
    # Also mark any message notifications for this conversation as read
    from sqlalchemy import update
    await db.execute(
        update(Notification)
        .where(and_(
            Notification.user_id == current_user.id,
            Notification.notification_type == "message",
            Notification.reference_type == "conversation",
            Notification.reference_id == conversation_id,
            Notification.is_read == False
        ))
        .values(is_read=True, read_at=datetime.utcnow())
    )
    
    # Get all unread messages from other users
    messages_result = await db.execute(
        select(Message)
        .where(and_(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user.id,
            Message.is_deleted == False
        ))
    )
    messages = messages_result.scalars().all()
    
    now = datetime.utcnow()
    updated_message_ids = []
    
    for msg in messages:
        # Check if receipt exists
        receipt_result = await db.execute(
            select(MessageReadReceipt)
            .where(and_(
                MessageReadReceipt.message_id == msg.id,
                MessageReadReceipt.user_id == current_user.id
            ))
        )
        receipt = receipt_result.scalar_one_or_none()
        
        if receipt:
            if not receipt.read_at:
                receipt.read_at = now
                updated_message_ids.append(msg.id)
        else:
            # Create new receipt with both delivered and read
            new_receipt = MessageReadReceipt(
                message_id=msg.id,
                user_id=current_user.id,
                delivered_at=now,
                read_at=now
            )
            db.add(new_receipt)
            updated_message_ids.append(msg.id)
    
    # Update last_read_at for participant
    participant.last_read_at = now
    
    await db.commit()
    
    # Broadcast read receipt to sender via WebSocket
    if updated_message_ids:
        for msg in messages:
            if msg.id in updated_message_ids:
                read_receipt_msg = {
                    "type": "message_read",
                    "data": {
                        "conversation_id": conversation_id,
                        "message_id": msg.id,
                        "read_by": current_user.id,
                        "read_at": now.isoformat()
                    }
                }
                await manager.send_personal_message(msg.sender_id, read_receipt_msg)
    
    return {"message": "Messages marked as read", "count": len(updated_message_ids)}


@router.post("/conversations/{conversation_id}/typing")
async def set_typing_status(
    conversation_id: int,
    is_typing: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update typing indicator"""
    # Update participant typing status
    result = await db.execute(
        select(ConversationParticipant)
        .where(and_(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        ))
    )
    participant = result.scalar_one_or_none()
    
    if participant:
        participant.is_typing = is_typing
        participant.typing_updated_at = datetime.utcnow()
        await db.commit()
        
        # Broadcast typing status to other participants
        typing_msg = {
            "type": "typing",
            "data": {
                "conversation_id": conversation_id,
                "user_id": current_user.id,
                "user_name": f"{current_user.first_name} {current_user.last_name}",
                "is_typing": is_typing
            }
        }
        await manager.broadcast_to_conversation(conversation_id, typing_msg, exclude_user=current_user.id)
    
    return {"status": "ok"}


@router.get("/users/messageable")
async def get_messageable_users(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get list of users that current user can message"""
    # Check if current user is admin
    is_admin = current_user.is_superuser
    if current_user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == current_user.role_id))
        role = role_result.scalar_one_or_none()
        if role and role.name == "Admin":
            is_admin = True
    
    if is_admin:
        # Admin can message everyone
        query = select(User).where(and_(
            User.is_active == True,
            User.id != current_user.id
        ))
    else:
        # Get admins and same-branch users
        admin_role_result = await db.execute(select(Role).where(Role.name == "Admin"))
        admin_role = admin_role_result.scalar_one_or_none()
        admin_role_id = admin_role.id if admin_role else -1
        
        query = select(User).where(and_(
            User.is_active == True,
            User.id != current_user.id,
            or_(
                User.is_superuser == True,
                User.role_id == admin_role_id,
                User.branch_id == current_user.branch_id
            )
        ))
    
    if search:
        query = query.where(or_(
            User.first_name.ilike(f"%{search}%"),
            User.last_name.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%")
        ))
    
    result = await db.execute(query.order_by(User.first_name))
    users = result.scalars().all()
    
    response = []
    for user in users:
        # Get role name
        role_name = None
        if user.role_id:
            role_result = await db.execute(select(Role).where(Role.id == user.role_id))
            role = role_result.scalar_one_or_none()
            if role:
                role_name = role.name
        
        # Get branch name
        branch_name = None
        if user.branch_id:
            branch_result = await db.execute(select(Branch).where(Branch.id == user.branch_id))
            branch = branch_result.scalar_one_or_none()
            if branch:
                branch_name = branch.name
        
        response.append({
            "id": user.id,
            "name": f"{user.first_name} {user.last_name}",
            "email": user.email,
            "role": role_name,
            "branch": branch_name,
            "avatar_url": user.avatar_url,
            "is_online": manager.is_user_online(user.id)
        })
    
    return response


# ============ WEBSOCKET ENDPOINT ============

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    """WebSocket endpoint for real-time messaging"""
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "join_conversation":
                conversation_id = message.get("conversation_id")
                if conversation_id:
                    manager.set_viewing_conversation(user_id, conversation_id)
                    
            elif message.get("type") == "leave_conversation":
                conversation_id = message.get("conversation_id")
                if conversation_id:
                    manager.stop_viewing_conversation(user_id, conversation_id)
                    
            elif message.get("type") == "typing":
                conversation_id = message.get("conversation_id")
                is_typing = message.get("is_typing", True)
                
                # Update typing status in database
                async with async_session_maker() as db:
                    result = await db.execute(
                        select(ConversationParticipant)
                        .where(and_(
                            ConversationParticipant.conversation_id == conversation_id,
                            ConversationParticipant.user_id == user_id
                        ))
                    )
                    participant = result.scalar_one_or_none()
                    if participant:
                        participant.is_typing = is_typing
                        participant.typing_updated_at = datetime.utcnow()
                        await db.commit()
                
                # Broadcast to others
                typing_msg = {
                    "type": "typing",
                    "data": {
                        "conversation_id": conversation_id,
                        "user_id": user_id,
                        "is_typing": is_typing
                    }
                }
                await manager.broadcast_to_conversation(conversation_id, typing_msg, exclude_user=user_id)
                
            elif message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        await manager.disconnect(user_id)
        
        # Clear typing status for all conversations
        async with async_session_maker() as db:
            result = await db.execute(
                select(ConversationParticipant)
                .where(ConversationParticipant.user_id == user_id)
            )
            participants = result.scalars().all()
            for p in participants:
                p.is_typing = False
            await db.commit()
