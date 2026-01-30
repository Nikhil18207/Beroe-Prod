"""
Web Search Engine - Serper API integration for internet search fallback

When RAG/verified sources don't have sufficient context, this engine
searches the internet and provides cited sources.

Flow:
1. RAG search → Check confidence
2. If low confidence → Web search via Serper
3. Return results with source URLs for citation
"""

import os
import requests
from typing import Dict, Any, List, Optional


class WebSearchEngine:
    """
    Web Search Engine using Serper API (Google Search)

    Used as fallback when verified sources (RAG) don't have sufficient context.
    All results include source URLs for proper citation.
    """

    SERPER_API_URL = "https://google.serper.dev/search"

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Web Search Engine

        Args:
            api_key: Serper API key (if None, reads from environment)
        """
        self.api_key = api_key or os.getenv('SERPER_API_KEY', '')
        self.enabled = bool(self.api_key)

        if not self.enabled:
            print("[WARN] SERPER_API_KEY not set - web search disabled")
        else:
            print("[OK] Web Search Engine initialized with Serper API")

    def search(
        self,
        query: str,
        num_results: int = 5,
        search_type: str = "search"
    ) -> Dict[str, Any]:
        """
        Search the web using Serper API

        Args:
            query: Search query
            num_results: Number of results to return (max 10)
            search_type: Type of search ("search", "news", "images")

        Returns:
            Dict with:
            - success: bool
            - results: List of search results with title, snippet, url
            - sources: Formatted source citations
            - context: Combined text for LLM prompt
        """
        if not self.enabled:
            return {
                'success': False,
                'error': 'Web search not configured (missing SERPER_API_KEY)',
                'results': [],
                'sources': '',
                'context': ''
            }

        try:
            headers = {
                'X-API-KEY': self.api_key,
                'Content-Type': 'application/json'
            }

            payload = {
                'q': query,
                'num': min(num_results, 10)
            }

            response = requests.post(
                self.SERPER_API_URL,
                headers=headers,
                json=payload,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()

            # Parse organic results
            results = []
            for item in data.get('organic', [])[:num_results]:
                results.append({
                    'title': item.get('title', ''),
                    'snippet': item.get('snippet', ''),
                    'url': item.get('link', ''),
                    'position': item.get('position', 0)
                })

            # Also include knowledge graph if available
            knowledge_graph = data.get('knowledgeGraph', {})
            if knowledge_graph:
                kg_text = f"Knowledge Graph: {knowledge_graph.get('title', '')} - {knowledge_graph.get('description', '')}"
                results.insert(0, {
                    'title': knowledge_graph.get('title', 'Knowledge Graph'),
                    'snippet': knowledge_graph.get('description', ''),
                    'url': knowledge_graph.get('website', 'Google Knowledge Graph'),
                    'position': 0,
                    'is_knowledge_graph': True
                })

            # Format for LLM context
            context_parts = []
            source_citations = []

            for i, result in enumerate(results, 1):
                citation_id = f"[WEB-{i}]"
                context_parts.append(
                    f"{citation_id} {result['title']}\n{result['snippet']}\nSource: {result['url']}"
                )
                source_citations.append(f"{citation_id}: {result['url']}")

            return {
                'success': True,
                'results': results,
                'sources': "\n".join(source_citations),
                'context': "\n\n".join(context_parts),
                'query': query,
                'source_type': 'internet'
            }

        except requests.exceptions.Timeout:
            return {
                'success': False,
                'error': 'Web search timed out',
                'results': [],
                'sources': '',
                'context': ''
            }
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f'Web search failed: {str(e)}',
                'results': [],
                'sources': '',
                'context': ''
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}',
                'results': [],
                'sources': '',
                'context': ''
            }

    def search_procurement_context(
        self,
        category: str,
        topic: str,
        region: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search for procurement-specific context

        Args:
            category: Product/service category (e.g., "Solar Panels")
            topic: Specific topic (e.g., "market trends", "supplier risks")
            region: Optional region filter

        Returns:
            Search results formatted for procurement briefs
        """
        # Build procurement-focused query
        query_parts = [category, topic, "procurement", "supply chain"]
        if region:
            query_parts.append(region)
        query_parts.append("2024 2025")  # Recent data

        query = " ".join(query_parts)

        results = self.search(query, num_results=5)

        if results['success']:
            results['search_context'] = {
                'category': category,
                'topic': topic,
                'region': region
            }

        return results

    def get_market_intelligence(self, category: str) -> Dict[str, Any]:
        """
        Get market intelligence for a category from the web

        Args:
            category: Product/service category

        Returns:
            Market intelligence with cited sources
        """
        queries = [
            f"{category} market size growth 2024 2025",
            f"{category} top suppliers manufacturers global",
            f"{category} supply chain risks challenges"
        ]

        all_results = []
        all_sources = []
        all_context = []

        for query in queries:
            result = self.search(query, num_results=3)
            if result['success']:
                all_results.extend(result['results'])
                all_sources.append(result['sources'])
                all_context.append(result['context'])

        return {
            'success': len(all_results) > 0,
            'results': all_results,
            'sources': "\n".join(all_sources),
            'context': "\n\n---\n\n".join(all_context),
            'category': category,
            'source_type': 'internet'
        }


# Convenience function
def search_web(query: str, num_results: int = 5) -> Dict[str, Any]:
    """Quick web search function"""
    engine = WebSearchEngine()
    return engine.search(query, num_results)
