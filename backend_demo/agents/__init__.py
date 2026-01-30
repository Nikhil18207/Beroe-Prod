"""
Microagent Architecture for Brief Generation

This module provides specialized agents for different aspects of procurement brief generation:

- BaseAgent: Common functionality for all agents (RAG, LLM, Web Search, data access)
- DataAnalysisAgent: Spend analysis, supplier metrics, concentration calculations
- RiskAssessmentAgent: Risk evaluation, rule violations, risk scoring
- RecommendationAgent: Strategic recommendations with business justification
- MarketIntelligenceAgent: Market context, regional insights, cost drivers
- BriefOrchestrator: Coordinates all agents to generate complete briefs

Source Priority:
1. Verified Sources (RAG/FAISS) - cite as [SOURCE-N]
2. Internet Sources (Serper Web Search) - cite as [WEB-N] with URL

Architecture:
                    +-------------------+
                    | BriefOrchestrator |
                    +--------+----------+
                             |
        +--------------------+--------------------+
        |          |                |             |
   +----v----+ +---v----+  +--------v-------+ +---v----+
   |  Data   | |  Risk  |  | Recommendation | | Market |
   | Analysis| |Assessment|  |    Agent      | | Intel  |
   +----+----+ +----+---+  +-------+--------+ +---+----+
        |           |              |              |
        +-----+-----+--------------+-------+------+
              |                            |
        +-----v-----+               +------v------+
        | BaseAgent |               | FAISS RAG   |
        +-----+-----+               +------+------+
              |                            |
              +------------+---------------+
                           |
                    +------v------+
                    | Web Search  |
                    | (Fallback)  |
                    +-------------+
"""

from .base_agent import BaseAgent
from .data_analysis_agent import DataAnalysisAgent
from .risk_assessment_agent import RiskAssessmentAgent
from .recommendation_agent import RecommendationAgent
from .market_intelligence_agent import MarketIntelligenceAgent
from .brief_orchestrator import BriefOrchestrator

__all__ = [
    'BaseAgent',
    'DataAnalysisAgent',
    'RiskAssessmentAgent',
    'RecommendationAgent',
    'MarketIntelligenceAgent',
    'BriefOrchestrator'
]
