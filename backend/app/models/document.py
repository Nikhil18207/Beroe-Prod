"""
Document Models
Stores uploaded documents and their extracted content/embeddings.
"""

import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from enum import Enum
from sqlalchemy import String, DateTime, Float, ForeignKey, Integer, Text, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY

from app.database import Base


class DocumentType(str, Enum):
    """Document type classification."""
    CONTRACT = "contract"
    PLAYBOOK = "playbook"
    SPEND_DATA = "spend_data"
    SUPPLIER_LIST = "supplier_list"
    POLICY = "policy"
    OTHER = "other"


class ProcessingStatus(str, Enum):
    """Document processing status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

if TYPE_CHECKING:
    from app.models.session import AnalysisSession


class Document(Base):
    """Uploaded document (PDF, Excel, etc.)."""

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("analysis_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # File Info
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # "pdf", "xlsx", "csv", "docx"
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)  # bytes
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)

    # Document Classification
    document_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # "contract", "spend_data", "supplier_list", "playbook", "other"

    # Processing Status
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Extracted Metadata
    extracted_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Structure varies by document type
    # For contracts: {"supplier_name": "...", "expiry_date": "...", "pricing_terms": [...]}
    # For spend data: {"columns": [...], "row_count": 1000}

    # Page Count (for PDFs)
    page_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    session: Mapped["AnalysisSession"] = relationship("AnalysisSession", back_populates="documents")
    chunks: Mapped[List["DocumentChunk"]] = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Document {self.original_filename}>"


class DocumentChunk(Base):
    """
    Document chunk for RAG/embedding storage.
    Stores text chunks with their vector embeddings.
    """

    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Chunk Content
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Chunk Metadata
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    section_title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    chunk_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # "text", "table", "heading", "list"

    # Token Count
    token_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Embedding Vector (using pgvector)
    # Note: For pgvector, we store as ARRAY and convert
    # In production, use: embedding = mapped_column(Vector(1536))
    embedding: Mapped[Optional[list]] = mapped_column(ARRAY(Float), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="chunks")

    def __repr__(self) -> str:
        return f"<DocumentChunk {self.document_id}:{self.chunk_index}>"
