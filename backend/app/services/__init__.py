"""
Beroe AI Procurement Platform - Services Module

This module contains service classes for:
- LLM integration (OpenAI, local models)
- Document processing and analysis
- Chat and conversation management
- Data ingestion and processing
- Metric computation
- Cached data access
"""

from app.services.llm_service import LLMService, LLMResponse, TaskComplexity
from app.services.document_service import DocumentService, DocumentAnalysisResult
from app.services.chat_service import ChatService, ChatResponse, ChatContext
from app.services.data_ingestion_service import (
    DataIngestionService,
    DataIngestionResult,
    DataSourceType,
    ingest_all_data_sources
)
from app.services.compute_service import ComputeService, METRICS_REGISTRY
from app.services.cache_service import CacheService

__all__ = [
    # LLM
    "LLMService",
    "LLMResponse",
    "TaskComplexity",
    # Document
    "DocumentService",
    "DocumentAnalysisResult",
    # Chat
    "ChatService",
    "ChatResponse",
    "ChatContext",
    # Data Pipeline (NEW)
    "DataIngestionService",
    "DataIngestionResult",
    "DataSourceType",
    "ingest_all_data_sources",
    "ComputeService",
    "METRICS_REGISTRY",
    "CacheService",
]
