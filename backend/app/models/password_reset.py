"""
Password Reset Token Model
Stores password reset tokens for forgot password flow.
"""

import uuid
import secrets
from datetime import datetime, timedelta
from sqlalchemy import String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class PasswordResetToken(Base):
    """
    Password reset token model.
    Tokens expire after 1 hour and can only be used once.
    """

    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # The user requesting the reset
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    # The reset token (URL-safe random string)
    token: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True
    )

    # Token expiration (1 hour from creation)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Whether the token has been used
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    used_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationship
    user = relationship("User", backref="password_reset_tokens")

    @classmethod
    def generate_token(cls) -> str:
        """Generate a secure random token."""
        return secrets.token_urlsafe(32)

    @classmethod
    def create_for_user(cls, user_id: uuid.UUID, expires_hours: int = 1) -> "PasswordResetToken":
        """Create a new password reset token for a user."""
        return cls(
            user_id=user_id,
            token=cls.generate_token(),
            expires_at=datetime.utcnow() + timedelta(hours=expires_hours)
        )

    @property
    def is_valid(self) -> bool:
        """Check if token is valid (not expired and not used)."""
        return not self.is_used and datetime.utcnow() < self.expires_at

    def mark_used(self) -> None:
        """Mark the token as used."""
        self.is_used = True
        self.used_at = datetime.utcnow()
