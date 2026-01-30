"""
Chat Endpoints
Handle chat conversations with the AI assistant (Coco).
Supports both HTTP and WebSocket connections.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import uuid
from datetime import datetime
import json

from app.database import get_db, async_session_factory
from app.models.user import User
from app.models.conversation import Conversation, Message, MessageRole
from app.api.v1.auth import get_current_user, get_user_from_token
from app.services.chat_service import ChatService
from pydantic import BaseModel, Field
import structlog

logger = structlog.get_logger()

router = APIRouter()

# Initialize chat service
chat_service = ChatService()


class ChatMessageCreate(BaseModel):
    """Create a chat message."""
    content: str = Field(..., min_length=1)
    conversation_id: Optional[uuid.UUID] = None
    session_id: Optional[uuid.UUID] = None


class ChatMessageResponse(BaseModel):
    """Chat message response."""
    id: uuid.UUID
    role: str
    content: str
    thinking_time: Optional[str] = None
    cards: Optional[dict] = None
    panel_state_change: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    """Conversation response."""
    id: uuid.UUID
    title: str
    summary: Optional[str] = None
    panel_state: Optional[str] = None
    message_count: int
    created_at: datetime
    last_message_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ChatFullResponse(BaseModel):
    """Full response including both user and assistant messages."""
    status: str
    conversation_id: str
    user_message: dict
    assistant_message: dict
    panel_state_change: Optional[str] = None
    cards: Optional[dict] = None


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, ge=1, le=100)
):
    """
    List user's recent conversations.
    """
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(limit)
        .options(selectinload(Conversation.messages))
    )
    conversations = result.scalars().all()

    return [
        ConversationResponse(
            id=c.id,
            title=c.title,
            summary=c.summary,
            panel_state=c.panel_state,
            message_count=len(c.messages) if c.messages else 0,
            created_at=c.created_at,
            last_message_at=c.last_message_at
        )
        for c in conversations
    ]


@router.post("/message", response_model=ChatFullResponse)
async def send_message(
    message_data: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send a message and get AI response.

    This endpoint:
    1. Loads context from the analysis session (if provided)
    2. Processes the message through the LLM
    3. Returns the AI response with any panel state changes
    """
    try:
        # Process message through chat service
        response = await chat_service.process_message(
            user_message=message_data.content,
            conversation_id=str(message_data.conversation_id) if message_data.conversation_id else None,
            session_id=str(message_data.session_id) if message_data.session_id else None,
            user_id=str(current_user.id),
            db=db
        )

        return ChatFullResponse(
            status="success",
            conversation_id=response.metadata.get("conversation_id", ""),
            user_message={
                "id": str(uuid.uuid4()),
                "role": "user",
                "content": message_data.content
            },
            assistant_message={
                "id": response.message_id,
                "role": "assistant",
                "content": response.content,
                "thinking_time": response.thinking_time
            },
            panel_state_change=response.panel_state_change,
            cards=response.cards
        )

    except Exception as e:
        logger.error("Chat message failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process message: {str(e)}"
        )


@router.get("/conversation/{conversation_id}/messages", response_model=List[ChatMessageResponse])
async def get_conversation_messages(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all messages in a conversation.
    """
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        )
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    return [
        ChatMessageResponse(
            id=m.id,
            role=m.role.value,
            content=m.content,
            thinking_time=m.thinking_time,
            cards=m.cards,
            panel_state_change=m.panel_state_change,
            created_at=m.created_at
        )
        for m in sorted(conversation.messages, key=lambda x: x.created_at)
    ]


@router.delete("/conversation/{conversation_id}")
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a conversation.
    """
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    await db.delete(conversation)
    await db.commit()

    return {"status": "success", "deleted": True, "id": str(conversation_id)}


@router.get("/suggestions")
async def get_suggested_questions(
    session_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get suggested questions based on session context.
    """
    questions = await chat_service.get_suggested_questions(
        session_id=str(session_id) if session_id else None,
        db=db
    )

    return {"suggestions": questions}


# WebSocket connection manager
class ConnectionManager:
    """Manage WebSocket connections."""

    def __init__(self):
        self.active_connections: dict = {}  # user_id -> WebSocket

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info("WebSocket connected", user_id=user_id)

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info("WebSocket disconnected", user_id=user_id)

    async def send_message(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)


manager = ConnectionManager()


@router.websocket("/ws/{token}")
async def websocket_chat(
    websocket: WebSocket,
    token: str
):
    """
    WebSocket endpoint for real-time chat.

    Message format (client -> server):
    {
        "type": "message",
        "content": "user message",
        "session_id": "optional-session-id",
        "conversation_id": "optional-conversation-id"
    }

    Response format (server -> client):
    {
        "type": "response" | "error" | "typing",
        "content": "...",
        "thinking_time": "1.2s",
        "panel_state_change": "opportunities",
        "cards": {...}
    }
    """
    # Authenticate user from token
    async with async_session_factory() as db:
        user = await get_user_from_token(token, db)

        if not user:
            await websocket.close(code=4001, reason="Authentication failed")
            return

        user_id = str(user.id)

    await manager.connect(websocket, user_id)

    try:
        while True:
            # Receive message
            data = await websocket.receive_json()

            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if data.get("type") == "message":
                content = data.get("content", "")
                session_id = data.get("session_id")
                conversation_id = data.get("conversation_id")

                # Send typing indicator
                await websocket.send_json({"type": "typing", "status": "started"})

                # Process message
                async with async_session_factory() as db:
                    try:
                        response = await chat_service.process_message(
                            user_message=content,
                            conversation_id=conversation_id,
                            session_id=session_id,
                            user_id=user_id,
                            db=db
                        )

                        # Send response
                        await websocket.send_json({
                            "type": "response",
                            "conversation_id": response.metadata.get("conversation_id"),
                            "message_id": response.message_id,
                            "content": response.content,
                            "thinking_time": response.thinking_time,
                            "panel_state_change": response.panel_state_change,
                            "cards": response.cards
                        })

                    except Exception as e:
                        logger.error("WebSocket message processing failed", error=str(e))
                        await websocket.send_json({
                            "type": "error",
                            "message": str(e)
                        })

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        logger.error("WebSocket error", error=str(e))
        manager.disconnect(user_id)


@router.post("/demo-message")
async def demo_message(
    message_data: ChatMessageCreate
):
    """
    Demo chat endpoint without authentication.
    For testing purposes only.
    """
    from app.services.llm_service import LLMService

    llm = LLMService()

    # Simple response without context
    response = await llm.chat(
        messages=[{"role": "user", "content": message_data.content}]
    )

    return {
        "status": "success",
        "user_message": {
            "content": message_data.content
        },
        "assistant_message": {
            "content": response.content,
            "thinking_time": f"{response.latency_ms/1000:.1f}s"
        }
    }
