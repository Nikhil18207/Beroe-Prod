"""
Base Agent - Common functionality for all microagents

Provides:
- RAG context retrieval with confidence scoring
- Web search fallback when RAG has low confidence
- LLM integration with strict grounding
- Data access utilities
- Standard prompt building

Source Priority:
1. Verified Sources (RAG/FAISS) - Internal knowledge base
2. Internet Sources (Serper) - Web search with citations
"""

import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from abc import ABC, abstractmethod

root_path = Path(__file__).parent.parent.parent
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))

from backend.engines.web_search_engine import WebSearchEngine


class BaseAgent(ABC):
    """
    Abstract base class for all microagents.

    Provides common functionality:
    - RAG context retrieval with confidence scoring
    - Web search fallback when RAG has low confidence
    - LLM generation with strict grounding
    - Fallback to template-based output
    - Source citation tracking

    ZERO HALLUCINATION POLICY:
    - All agents must cite sources
    - Low confidence triggers web search fallback
    - LLM only uses provided data + verified/cited sources

    SOURCE PRIORITY:
    1. Verified Sources (RAG) - cite as [SOURCE-N]
    2. Internet Sources (Web) - cite as [WEB-N] with URL
    """

    # Minimum confidence threshold for using LLM (vs template fallback)
    DEFAULT_CONFIDENCE_THRESHOLD = 0.4

    def __init__(
        self,
        llm_engine=None,
        vector_store=None,
        enable_llm: bool = True,
        enable_rag: bool = True,
        enable_web_search: bool = True,
        confidence_threshold: float = None
    ):
        """
        Initialize base agent with optional LLM, RAG, and web search capabilities.

        Args:
            llm_engine: LLMEngine instance for generation
            vector_store: FAISSVectorStore instance for RAG
            enable_llm: Enable LLM-powered generation
            enable_rag: Enable RAG context retrieval
            enable_web_search: Enable web search fallback when RAG has low confidence
            confidence_threshold: Minimum RAG confidence for LLM use
        """
        self.llm_engine = llm_engine
        self.vector_store = vector_store
        self.enable_llm = enable_llm and llm_engine is not None
        self.enable_rag = enable_rag and vector_store is not None
        self.enable_web_search = enable_web_search
        self.confidence_threshold = confidence_threshold or self.DEFAULT_CONFIDENCE_THRESHOLD

        # Initialize web search engine for fallback
        self.web_search_engine = WebSearchEngine() if enable_web_search else None

        # Track sources used in generation for traceability
        self._sources_used = []
        self._web_sources_used = []

    @property
    @abstractmethod
    def agent_name(self) -> str:
        """Return the agent's name for logging"""
        pass

    @abstractmethod
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the agent's primary task.

        Args:
            context: Dictionary containing all data needed for the task

        Returns:
            Dictionary with agent output and metadata
        """
        pass

    def get_rag_context(
        self,
        query: str,
        category: Optional[str] = None,
        k: int = 5
    ) -> Dict[str, Any]:
        """
        Retrieve RAG context with full metadata for traceability.

        Returns:
            Dict with:
            - context: Formatted text for LLM prompt
            - sources: List of source documents
            - confidence: Score (0-1)
            - has_strong_context: Boolean for fallback decision
        """
        if not self.enable_rag or not self.vector_store:
            return {
                'context': '',
                'sources': [],
                'confidence': 0.0,
                'has_strong_context': False,
                'source_citations': ''
            }

        try:
            results = self.vector_store.search(query=query, k=k)

            if not results:
                return {
                    'context': '',
                    'sources': [],
                    'confidence': 0.0,
                    'has_strong_context': False,
                    'source_citations': ''
                }

            # Format context with numbered citations
            context_parts = []
            sources = []
            citations = []

            for i, result in enumerate(results, 1):
                metadata = result.get('metadata', {})
                source_file = metadata.get('file_name', metadata.get('source', 'knowledge_base'))
                source_category = result.get('category', metadata.get('category', 'general'))
                content = result.get('content', '')
                score = result.get('score', 0.5)

                citation_id = f"[SOURCE-{i}]"
                context_parts.append(f"{citation_id} ({source_file}):\n{content}")

                sources.append({
                    'citation_id': citation_id,
                    'file_name': source_file,
                    'category': source_category,
                    'relevance_score': score,
                    'excerpt': content[:200] + '...' if len(content) > 200 else content
                })

                citations.append(f"{citation_id}: {source_file}")

            # Calculate confidence score
            avg_score = sum(r.get('score', 0.5) for r in results) / len(results)
            confidence = max(0, min(1, avg_score))

            # Strong context: >= threshold confidence with >= 2 relevant docs
            has_strong_context = confidence >= self.confidence_threshold and len(results) >= 2

            # Track sources for this generation
            self._sources_used = sources

            return {
                'context': "\n\n".join(context_parts),
                'sources': sources,
                'confidence': round(confidence, 2),
                'has_strong_context': has_strong_context,
                'source_citations': "\n".join(citations),
                'source_type': 'verified'
            }

        except Exception as e:
            print(f"[WARN] {self.agent_name} RAG retrieval failed: {e}")
            return {
                'context': '',
                'sources': [],
                'confidence': 0.0,
                'has_strong_context': False,
                'source_citations': '',
                'source_type': 'none'
            }

    def get_web_context(
        self,
        query: str,
        category: Optional[str] = None,
        num_results: int = 5
    ) -> Dict[str, Any]:
        """
        Retrieve context from web search (fallback when RAG has low confidence).

        This is used when verified sources don't have sufficient information.
        All results include URLs for proper citation.

        Args:
            query: Search query
            category: Optional category for context
            num_results: Number of web results to fetch

        Returns:
            Dict with:
            - context: Formatted text for LLM prompt
            - sources: List of source URLs
            - success: Whether search succeeded
            - source_type: 'internet'
        """
        if not self.enable_web_search or not self.web_search_engine:
            return {
                'context': '',
                'sources': [],
                'success': False,
                'source_citations': '',
                'source_type': 'none',
                'reason': 'Web search disabled'
            }

        try:
            # Search the web
            if category:
                result = self.web_search_engine.search_procurement_context(
                    category=category,
                    topic=query,
                    region=None
                )
            else:
                result = self.web_search_engine.search(query, num_results)

            if not result.get('success', False):
                return {
                    'context': '',
                    'sources': [],
                    'success': False,
                    'source_citations': '',
                    'source_type': 'none',
                    'reason': result.get('error', 'Web search failed')
                }

            # Format sources for tracking
            web_sources = []
            for r in result.get('results', []):
                web_sources.append({
                    'title': r.get('title', ''),
                    'url': r.get('url', ''),
                    'snippet': r.get('snippet', ''),
                    'source_type': 'internet'
                })

            # Track web sources used
            self._web_sources_used = web_sources

            return {
                'context': result.get('context', ''),
                'sources': web_sources,
                'success': True,
                'source_citations': result.get('sources', ''),
                'source_type': 'internet'
            }

        except Exception as e:
            print(f"[WARN] {self.agent_name} web search failed: {e}")
            return {
                'context': '',
                'sources': [],
                'success': False,
                'source_citations': '',
                'source_type': 'none',
                'reason': str(e)
            }

    def get_context_with_fallback(
        self,
        query: str,
        category: Optional[str] = None,
        k: int = 5
    ) -> Dict[str, Any]:
        """
        Get context using verified sources first, then web search as fallback.

        Priority:
        1. RAG (verified sources) - if confidence >= threshold
        2. Web search (internet) - if RAG confidence is low
        3. No context - if both fail

        Args:
            query: Search query
            category: Optional category filter
            k: Number of results to fetch

        Returns:
            Combined context with source type indicator
        """
        # Step 1: Try RAG (verified sources)
        rag_result = self.get_rag_context(query, category, k)

        if rag_result.get('has_strong_context', False):
            # Verified source found with good confidence
            self.log(f"Using verified source (confidence: {rag_result['confidence']:.2f})")
            return {
                'context': rag_result['context'],
                'sources': rag_result['sources'],
                'source_citations': rag_result['source_citations'],
                'source_type': 'verified',
                'confidence': rag_result['confidence'],
                'used_web_fallback': False
            }

        # Step 2: RAG confidence low - try web search fallback
        if self.enable_web_search and self.web_search_engine:
            self.log(f"RAG confidence low ({rag_result.get('confidence', 0):.2f}), trying web search...")
            web_result = self.get_web_context(query, category)

            if web_result.get('success', False):
                self.log("Using internet source (with citations)")
                return {
                    'context': web_result['context'],
                    'sources': web_result['sources'],
                    'source_citations': web_result['source_citations'],
                    'source_type': 'internet',
                    'confidence': 0.7,  # Web sources get moderate confidence
                    'used_web_fallback': True
                }

        # Step 3: Both failed - return whatever RAG had (even if low confidence)
        self.log("No strong context found from verified or web sources")
        return {
            'context': rag_result.get('context', ''),
            'sources': rag_result.get('sources', []),
            'source_citations': rag_result.get('source_citations', ''),
            'source_type': 'weak',
            'confidence': rag_result.get('confidence', 0),
            'used_web_fallback': False
        }

    def generate_with_llm(
        self,
        data_section: str,
        task_instruction: str,
        rag_query: Optional[str] = None,
        fallback_generator: callable = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate content using LLM with strict grounding.

        Uses verified sources first, then web search fallback if needed.

        Args:
            data_section: Primary data for the prompt
            task_instruction: What the LLM should generate
            rag_query: Optional query for RAG/web context
            fallback_generator: Function to call if LLM fails
            category: Optional category for better web search

        Returns:
            Dict with:
            - content: Generated text
            - method: 'llm' or 'template'
            - sources: List of sources used
            - source_type: 'verified', 'internet', or 'none'
            - confidence: Context confidence score
        """
        # Attempt context retrieval with fallback (RAG -> Web Search)
        context_result = None
        if rag_query and (self.enable_rag or self.enable_web_search):
            context_result = self.get_context_with_fallback(rag_query, category)

        # Check if we should use LLM
        has_context = context_result and (
            context_result.get('source_type') in ['verified', 'internet'] and
            context_result.get('confidence', 0) >= self.confidence_threshold
        )

        use_llm = (
            self.enable_llm and
            self.llm_engine is not None and
            (context_result is None or has_context)
        )

        if not use_llm:
            # Use fallback template
            if fallback_generator:
                content = fallback_generator()
                return {
                    'content': content,
                    'method': 'template',
                    'sources': [],
                    'source_type': 'none',
                    'confidence': 0.0,
                    'reason': 'LLM disabled or low context confidence'
                }
            else:
                return {
                    'content': '',
                    'method': 'template',
                    'sources': [],
                    'source_type': 'none',
                    'confidence': 0.0,
                    'reason': 'No fallback provided'
                }

        try:
            # Build strictly grounded prompt (handles both verified and web sources)
            prompt = self._build_grounded_prompt(data_section, context_result, task_instruction)

            # Generate with LLM
            response = self.llm_engine._generate_openai(prompt)

            # Check for refusal
            if self._is_llm_refusal(response):
                if fallback_generator:
                    return {
                        'content': fallback_generator(),
                        'method': 'template',
                        'sources': [],
                        'source_type': 'none',
                        'confidence': 0.0,
                        'reason': 'LLM refused to generate'
                    }

            # Add sources footer based on source type
            sources = context_result.get('sources', []) if context_result else []
            source_type = context_result.get('source_type', 'none') if context_result else 'none'

            if sources:
                if source_type == 'verified':
                    sources_footer = "\n\n---\n📚 Verified Sources: " + ", ".join(
                        s.get('file_name', 'knowledge_base') for s in sources[:3]
                    )
                elif source_type == 'internet':
                    sources_footer = "\n\n---\n🌐 Internet Sources:\n" + "\n".join(
                        f"• {s.get('title', 'Web')}: {s.get('url', '')}" for s in sources[:3]
                    )
                else:
                    sources_footer = ""
                response += sources_footer

            return {
                'content': response,
                'method': 'llm',
                'sources': sources,
                'source_type': source_type,
                'used_web_fallback': context_result.get('used_web_fallback', False) if context_result else False,
                'confidence': context_result.get('confidence', 0.0) if context_result else 0.0
            }

        except Exception as e:
            print(f"[WARN] {self.agent_name} LLM generation failed: {e}")
            if fallback_generator:
                return {
                    'content': fallback_generator(),
                    'method': 'template',
                    'sources': [],
                    'source_type': 'none',
                    'confidence': 0.0,
                    'reason': f'LLM error: {str(e)}'
                }
            return {
                'content': '',
                'method': 'error',
                'sources': [],
                'source_type': 'none',
                'confidence': 0.0,
                'reason': f'LLM error: {str(e)}'
            }

    def _build_grounded_prompt(
        self,
        data_section: str,
        context_result: Optional[Dict[str, Any]],
        task_instruction: str
    ) -> str:
        """Build a prompt with strict grounding rules for verified or web sources."""
        source_type = context_result.get('source_type', 'none') if context_result else 'none'

        if source_type == 'verified':
            grounding_rules = """
STRICT GROUNDING RULES (MUST FOLLOW):
1. You may ONLY use facts from the DATA SECTION and VERIFIED KNOWLEDGE BASE below
2. When using information from the knowledge base, cite it as [SOURCE-N]
3. NEVER invent or guess statistics, percentages, market trends, or industry facts
4. If specific information is not available, use phrases like "Based on the provided data..."
5. All numerical claims MUST come from the DATA SECTION
6. Do NOT make claims about market conditions unless explicitly stated in KNOWLEDGE BASE
7. Focus on ANALYSIS and SYNTHESIS of provided information, not new information
"""
            knowledge_section = f"""
📚 VERIFIED KNOWLEDGE BASE (cite as [SOURCE-N]):
{context_result['context']}

AVAILABLE VERIFIED SOURCES:
{context_result['source_citations']}
"""

        elif source_type == 'internet':
            grounding_rules = """
STRICT GROUNDING RULES (MUST FOLLOW):
1. You may ONLY use facts from the DATA SECTION and INTERNET SOURCES below
2. When using information from internet sources, cite it as [WEB-N] with the URL
3. NEVER invent or guess statistics - only use data from provided sources
4. Clearly indicate that market data comes from internet sources
5. All numerical claims MUST come from the DATA SECTION or cited web sources
6. When referencing web sources, include the source URL
7. Be transparent that this is internet-sourced information, not verified internal data
"""
            knowledge_section = f"""
🌐 INTERNET SOURCES (cite as [WEB-N] with URL):
{context_result['context']}

AVAILABLE WEB SOURCES:
{context_result['source_citations']}

NOTE: These sources are from the internet. Cite URLs when using this information.
"""

        else:
            grounding_rules = """
STRICT GROUNDING RULES (MUST FOLLOW):
1. You may ONLY use facts from the DATA SECTION below
2. NEVER invent or guess statistics, percentages, market trends, or industry facts
3. If specific information is not available, clearly state data limitations
4. All numerical claims MUST come from the DATA SECTION
5. Do NOT make claims about market conditions without data
6. Focus on ANALYSIS of provided data only
"""
            knowledge_section = """
KNOWLEDGE BASE CONTEXT:
[No relevant documents found in verified sources or internet]
Focus ONLY on analyzing the DATA SECTION below.
"""

        return f"""{grounding_rules}
{knowledge_section}

DATA SECTION (PRIMARY SOURCE - all numbers from here):
{data_section}

TASK:
{task_instruction}

REMEMBER: Cite sources with [SOURCE-N] for verified or [WEB-N] for internet. No hallucination. Only use provided information.
"""

    def _is_llm_refusal(self, response: str) -> bool:
        """Check if LLM refused to generate content."""
        if not response:
            return True

        refusal_indicators = [
            "i cannot",
            "i can't",
            "i'm unable",
            "i am unable",
            "i don't have enough information",
            "insufficient data",
            "cannot provide",
            "not enough context"
        ]

        response_lower = response.lower()[:200]
        return any(indicator in response_lower for indicator in refusal_indicators)

    def get_sources_used(self) -> List[Dict[str, Any]]:
        """Get list of verified sources used in last generation."""
        return self._sources_used

    def get_web_sources_used(self) -> List[Dict[str, Any]]:
        """Get list of web sources used in last generation."""
        return self._web_sources_used

    def get_all_sources_used(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get all sources (verified and web) used in last generation."""
        return {
            'verified': self._sources_used,
            'internet': self._web_sources_used
        }

    def log(self, message: str, level: str = "INFO"):
        """Log a message with agent name prefix."""
        prefix = {
            "INFO": "[INFO]",
            "WARN": "[WARN]",
            "ERROR": "[ERROR]",
            "OK": "[OK]"
        }.get(level, "[INFO]")
        print(f"{prefix} {self.agent_name}: {message}")
