"""
Engines package - Core processing engines for brief generation

Includes:
- DataLoader: Data access and category resolution
- RuleEvaluationEngine: Procurement rule compliance checking
- LLMEngine: OpenAI GPT integration
- LeadershipBriefGenerator: Brief generation (with optional agent architecture)
- DOCXExporter: Document export
- FAISSVectorStore: RAG vector database
- WebSearchEngine: Internet search fallback with source citation
- BriefVerifier: LLM-based verification using Perplexity API
- BriefChatAssistant: Conversational AI for brief discussions (Groq)
"""

# Core engines
from .data_loader import DataLoader
from .rule_evaluation_engine import RuleEvaluationEngine
from .llm_engine import LLMEngine
from .web_search_engine import WebSearchEngine
from .brief_verifier import BriefVerifier
from .brief_chat_assistant import BriefChatAssistant

# Document and export engines
from .leadership_brief_generator import LeadershipBriefGenerator
from .docx_exporter import DOCXExporter

# RAG vector store (lazy import to avoid issues if faiss not installed)
def get_faiss_vector_store():
    """Get FAISSVectorStore class (lazy import)"""
    from .faiss_vector_store import FAISSVectorStore
    return FAISSVectorStore

__all__ = [
    'DataLoader',
    'RuleEvaluationEngine',
    'LLMEngine',
    'WebSearchEngine',
    'BriefVerifier',
    'BriefChatAssistant',
    'LeadershipBriefGenerator',
    'DOCXExporter',
    'get_faiss_vector_store',
]
