"""
Backend package initialization

This module provides backward-compatible imports for modules that were
moved during the codebase reorganization. Old import patterns will still work.

Supported import patterns:
    # Old patterns (still work):
    from backend.conversational_ai import ConversationalAI
    from backend.conversation_memory import ConversationMemory
    from backend.llm_recommendation_system import LLMRecommendationSystem

    # New patterns (recommended):
    from backend.engines.conversational_ai import ConversationalAI
    from backend.engines import ConversationalAI, DataLoader, RuleEngine
"""

__version__ = "1.0.0"


def __getattr__(name):
    """
    Lazy import for backward compatibility.
    This avoids loading heavy modules until they're actually needed.
    """
    if name == 'ConversationalAI':
        from backend.engines.conversational_ai import ConversationalAI
        return ConversationalAI
    elif name == 'ConversationMemory':
        from backend.engines.conversation_memory import ConversationMemory
        return ConversationMemory
    elif name == 'LLMRecommendationSystem':
        from backend.engines.llm_recommendation_system import LLMRecommendationSystem
        return LLMRecommendationSystem
    elif name == 'SemanticUseCaseMatcher':
        from backend.engines.semantic_use_case_matcher import SemanticUseCaseMatcher
        return SemanticUseCaseMatcher
    elif name == 'RuleEngine':
        from backend.engines.rule_evaluation_engine import RuleEvaluationEngine
        return RuleEvaluationEngine
    raise AttributeError(f"module 'backend' has no attribute '{name}'")
