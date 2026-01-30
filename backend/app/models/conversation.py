"""
Conversation Models
Stores chat conversations and messages.
"""

import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Integer, Text, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class MessageRole(str, enum.Enum):
    """Message sender role."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Conversation(Base):
    """Chat conversation session."""

    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True
    )
    # Links to analysis session if conversation is about specific analysis

    # Conversation Info
    title: Mapped[str] = mapped_column(String(500), default="New Conversation")
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # State
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    panel_state: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # Current panel state: "empty", "spend_overview", "category_summary", etc.

    # Context
    context: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Stores relevant context for the conversation
    # {"category": "Vegetable Oils", "opportunities": [...]}

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="conversations")
    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at"
    )

    def __repr__(self) -> str:
        return f"<Conversation {self.title[:50]}>"

    @property
    def message_count(self) -> int:
        return len(self.messages)


class Message(Base):
    """Individual message in a conversation."""

    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Message Content
    role: Mapped[MessageRole] = mapped_column(SQLEnum(MessageRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Additional Content (cards, attachments)
    attachments: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # Structure: [{"name": "...", "size": "...", "type": "pdf"}]

    cards: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Structure: {
    #   "summaryCard": {"icon": "...", "category": "...", "description": "..."},
    #   "opportunityCard": {"title": "...", "savings": "..."},
    #   "artifactCard": {...},
    #   "sourcingMixCard": {...}
    # }

    # Metadata
    thinking_time: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # e.g., "1m 13s"
    is_italic: Mapped[bool] = mapped_column(Boolean, default=False)

    # Panel State Change
    panel_state_change: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # If this message triggers a panel state change

    # Token Usage
    prompt_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")

    def __repr__(self) -> str:
        return f"<Message {self.role.value}: {self.content[:50]}...>"
